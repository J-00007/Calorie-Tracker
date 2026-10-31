import { router, json, error, requireAuth, db, ai } from '@appdeploy/sdk';

type FoodItem = {
  name: string;
  portion: string;
  calories: number;
  protein: number;
  carbs: number;
  sugars: number;
  confidence?: string;
  notes?: string;
};

type MealRecord = Record<string, unknown> & {
  userId: string;
  name: string;
  portion: string;
  calories: number;
  protein: number;
  carbs: number;
  sugars: number;
  eatenAt: string;
  source: string;
  notes: string;
  items?: FoodItem[];
};

function userTable(userId: string): string {
  const safeId = userId.replace(/[^A-Za-z0-9_.-]/g, '').replace(/-/g, '');
  return 'foodlogs_' + safeId;
}

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function cleanText(
  value: unknown,
  fallback: string,
  maxLength: number
): string {
  if (typeof value !== 'string') return fallback;
  return value.trim().slice(0, maxLength) || fallback;
}

function cleanNumber(value: unknown): number | null {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 10000) return null;
  return Math.round(number * 10) / 10;
}

function normalizedDish(value: unknown): FoodItem | null {
  const item = asObject(value);
  const name = cleanText(item.name, '', 100);
  const portion = cleanText(item.portion, '1 serving (estimated)', 140);
  const calories = cleanNumber(item.calories);
  const protein = cleanNumber(item.protein);
  const carbs = cleanNumber(item.carbs);
  const sugars = cleanNumber(item.sugars);
  if (
    !name ||
    calories === null ||
    protein === null ||
    carbs === null ||
    sugars === null
  )
    return null;
  return {
    name,
    portion,
    calories,
    protein,
    carbs,
    sugars,
    confidence: cleanText(item.confidence, 'Medium', 20),
    notes: cleanText(item.notes, '', 240),
  };
}

function total(
  items: FoodItem[],
  field: 'calories' | 'protein' | 'carbs' | 'sugars'
): number {
  return (
    Math.round(items.reduce((sum, item) => sum + item[field], 0) * 10) / 10
  );
}

function validDate(value: unknown): string {
  if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) {
    return new Date(value).toISOString();
  }
  return new Date().toISOString();
}

export const handler = router({
  'GET /api/_healthcheck': [async () => json({ message: 'Success' })],

  'GET /api/logs': [
    requireAuth(),
    async ({ user }) => {
      try {
        const result = await db.list<MealRecord>(userTable(user!.userId), {
          limit: 100,
        });
        const items = result.items
          .filter(item => item.userId === user!.userId)
          .sort(
            (a, b) =>
              Date.parse(String(b.eatenAt)) - Date.parse(String(a.eatenAt))
          );
        return json({ items });
      } catch (err: unknown) {
        console.error('Food diary read failed', err);
        return error('Your food diary could not be loaded.', 503);
      }
    },
  ],

  'POST /api/logs': [
    requireAuth(),
    async ({ body, user }) => {
      const input = asObject(body);
      const name = cleanText(input.name, '', 120);
      const portion = cleanText(input.portion, '1 serving', 200);
      const calories = cleanNumber(input.calories);
      const protein = cleanNumber(input.protein);
      const carbs = cleanNumber(input.carbs);
      const sugars = cleanNumber(input.sugars);

      if (
        !name ||
        calories === null ||
        protein === null ||
        carbs === null ||
        sugars === null
      ) {
        return error(
          'Add a meal name and valid nutrition values before saving.',
          400
        );
      }

      const source = ['photo', 'description', 'quick', 'manual'].includes(
        String(input.source)
      )
        ? String(input.source)
        : 'manual';
      const items = Array.isArray(input.items)
        ? input.items
            .slice(0, 20)
            .map(normalizedDish)
            .filter((item): item is FoodItem => item !== null)
        : undefined;

      const record: MealRecord = {
        userId: user!.userId,
        name,
        portion,
        calories,
        protein,
        carbs,
        sugars,
        eatenAt: validDate(input.eatenAt),
        source,
        notes: cleanText(input.notes, '', 600),
        ...(items && items.length ? { items } : {}),
      };

      try {
        const [id] = await db.add(userTable(user!.userId), [record]);
        if (!id)
          return error('The meal could not be saved. Please try again.', 503);
        return json({ id });
      } catch (err: unknown) {
        console.error('Food diary create failed', err);
        return error('The meal could not be saved. Please try again.', 503);
      }
    },
  ],

  'PUT /api/logs/:id': [
    requireAuth(),
    async ({ body, user, params }) => {
      const input = asObject(body);
      const table = userTable(user!.userId);
      try {
        const [existing] = await db.get<MealRecord>(table, [params.id]);
        if (!existing || existing.userId !== user!.userId)
          return error('Meal not found.', 404);

        const calories = cleanNumber(input.calories);
        const protein = cleanNumber(input.protein);
        const carbs = cleanNumber(input.carbs);
        const sugars = cleanNumber(input.sugars);
        if (
          calories === null ||
          protein === null ||
          carbs === null ||
          sugars === null ||
          !cleanText(input.name, '', 120)
        ) {
          return error(
            'Enter a meal name and valid non-negative nutrition values.',
            400
          );
        }

        const updated: MealRecord = {
          ...existing,
          name: cleanText(input.name, String(existing.name), 120),
          portion: cleanText(input.portion, String(existing.portion), 200),
          calories,
          protein,
          carbs,
          sugars,
          eatenAt: validDate(input.eatenAt || existing.eatenAt),
          notes: cleanText(input.notes, String(existing.notes || ''), 600),
          userId: user!.userId,
        };
        const [ok] = await db.update(table, [
          { id: params.id, record: updated },
        ]);
        if (!ok)
          return error('The meal could not be updated. Please try again.', 503);
        return json({ ok: true });
      } catch (err: unknown) {
        console.error('Food diary update failed', err);
        return error('The meal could not be updated. Please try again.', 503);
      }
    },
  ],

  'DELETE /api/logs/:id': [
    requireAuth(),
    async ({ user, params }) => {
      const table = userTable(user!.userId);
      try {
        const [existing] = await db.get<MealRecord>(table, [params.id]);
        if (!existing || existing.userId !== user!.userId)
          return error('Meal not found.', 404);
        const [ok] = await db.delete(table, [params.id]);
        if (!ok)
          return error('The meal could not be deleted. Please try again.', 503);
        return json({ ok: true });
      } catch (err: unknown) {
        console.error('Food diary delete failed', err);
        return error('The meal could not be deleted. Please try again.', 503);
      }
    },
  ],

  'POST /api/analyze': [
    requireAuth(),
    async ({ body }) => {
      const input = asObject(body);
      const description =
        typeof input.description === 'string'
          ? input.description.trim().slice(0, 1200)
          : '';
      const imageData = typeof input.image === 'string' ? input.image : '';
      const mimeType = typeof input.mimeType === 'string' ? input.mimeType : '';

      if (!description && !imageData)
        return error('Add a food description or image to analyse.', 400);
      if (imageData && imageData.length > 8_400_000)
        return error('That image is too large. Choose a smaller photo.', 413);
      if (
        imageData &&
        !['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)
      ) {
        return error('Please use a JPG, PNG or WEBP image.', 400);
      }

      const schema = {
        type: 'object',
        properties: {
          isFood: { type: 'boolean' },
          dishes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                portion: { type: 'string' },
                calories: { type: 'number' },
                protein: { type: 'number' },
                carbs: { type: 'number' },
                sugars: { type: 'number' },
                confidence: { type: 'string', enum: ['High', 'Medium', 'Low'] },
                notes: { type: 'string' },
              },
              required: [
                'name',
                'portion',
                'calories',
                'protein',
                'carbs',
                'sugars',
                'confidence',
                'notes',
              ],
            },
          },
          confidence: { type: 'string', enum: ['High', 'Medium', 'Low'] },
          assumptions: { type: 'string' },
        },
        required: ['isFood', 'dishes', 'confidence', 'assumptions'],
      };

      const prompt = [
        'You are a careful nutrition estimation assistant specialising in Indian cuisines and regional home-style food.',
        'Identify the visible or described food and estimate nutrition for the portion actually shown or described.',
        'Return one dish per meaningful food component when practical, such as dosa, sambar and chutney separately.',
        'For each item estimate energy in kcal, protein in grams, total carbohydrates in grams, and total sugars in grams.',
        'Use realistic Indian recipes and serving conventions: idli and dosa batter, rice and roti portions, dal, sambar, chutneys, tadka, oil or ghee, paneer, biryani, poha, upma, paratha, snacks and sweets.',
        'Do not assume a low-oil recipe. Account for visible accompaniments and cooking fats when reasonable.',
        'If portion size or ingredients cannot be determined, use a clearly stated standard-serving assumption and lower confidence.',
        'Nutrition values are estimates, not laboratory measurements. Avoid false precision; use sensible rounded numbers.',
        'If the input is not food or cannot be identified as food, set isFood to false and return an empty dishes array.',
        'Keep assumptions concise and mention major uncertainties such as portion size, oil, ghee, sugar or recipe variation.',
      ].join(' ');

      try {
        const result = await ai.extract({
          prompt,
          ...(description ? { content: description } : {}),
          ...(imageData ? { images: [{ data: imageData, mimeType }] } : {}),
          schema,
          thinkingMode: 'FAST',
        });
        const raw = asObject(result.data);
        const dishes = Array.isArray(raw.dishes)
          ? raw.dishes
              .map(normalizedDish)
              .filter((item): item is FoodItem => item !== null)
          : [];

        if (raw.isFood !== true || dishes.length === 0) {
          return error(
            'We could not confidently identify a food item. Try a clearer photo or add a dish name and portion size.',
            422
          );
        }

        const confidence = ['High', 'Medium', 'Low'].includes(
          String(raw.confidence)
        )
          ? String(raw.confidence)
          : 'Medium';
        const analysis = {
          dishes,
          totals: {
            calories: total(dishes, 'calories'),
            protein: total(dishes, 'protein'),
            carbs: total(dishes, 'carbs'),
            sugars: total(dishes, 'sugars'),
          },
          confidence,
          assumptions: cleanText(
            raw.assumptions,
            'Portion and recipe details were estimated.',
            700
          ),
        };
        return json({ analysis });
      } catch (err: unknown) {
        console.error('Indian meal nutrition analysis failed', err);
        const rpcError = err as { statusCode?: number };
        const status = rpcError && rpcError.statusCode === 429 ? 429 : 502;
        return error(
          'Nutrition analysis is temporarily unavailable. Please try again.',
          status
        );
      }
    },
  ],
});
