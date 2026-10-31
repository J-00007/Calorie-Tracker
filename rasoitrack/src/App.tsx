import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import {
  Activity,
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  BookOpen,
  Camera,
  Check,
  ChevronRight,
  Clock3,
  Cookie,
  Flame,
  ImagePlus,
  Leaf,
  Loader2,
  LogOut,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Utensils,
  Wheat,
  X,
} from 'lucide-react';
import { api, auth, image } from '@appdeploy/client';

type User = {
  userId: string;
  name?: string;
  email?: string;
  picture?: string;
};

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

type NutritionTotals = {
  calories: number;
  protein: number;
  carbs: number;
  sugars: number;
};

type Analysis = {
  dishes: FoodItem[];
  totals: NutritionTotals;
  confidence: 'High' | 'Medium' | 'Low';
  assumptions: string;
};

type MealLog = {
  id: string;
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

type QuickMeal = {
  name: string;
  portion: string;
  calories: number;
  protein: number;
  carbs: number;
  sugars: number;
  note: string;
  icon: string;
};

const DAILY_GOALS = {
  calories: 2000,
  protein: 100,
  carbs: 250,
  sugars: 50,
};

const QUICK_MEALS: QuickMeal[] = [
  {
    name: 'Idli + sambar',
    portion: '2 medium idlis + 1 bowl sambar',
    calories: 280,
    protein: 10,
    carbs: 52,
    sugars: 4,
    note: 'Typical home-style serving estimate',
    icon: 'south',
  },
  {
    name: 'Vegetable poha',
    portion: '1 medium bowl',
    calories: 250,
    protein: 6,
    carbs: 42,
    sugars: 3,
    note: 'With peas and a light tempering',
    icon: 'west',
  },
  {
    name: 'Dal + rice',
    portion: '1 bowl dal + 1 cup cooked rice',
    calories: 430,
    protein: 17,
    carbs: 72,
    sugars: 4,
    note: 'Everyday vegetarian thali estimate',
    icon: 'north',
  },
];

function dateKey(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function sumMeals(meals: MealLog[]): NutritionTotals {
  return meals.reduce(
    (sum, meal) => ({
      calories: sum.calories + meal.calories,
      protein: sum.protein + meal.protein,
      carbs: sum.carbs + meal.carbs,
      sugars: sum.sugars + meal.sugars,
    }),
    { calories: 0, protein: 0, carbs: 0, sugars: 0 }
  );
}

function initials(user: User | null): string {
  const source = user?.name || user?.email || 'R';
  return source.slice(0, 1).toUpperCase();
}

function App() {
  const [authStatus, setAuthStatus] = useState<
    'loading' | 'signedOut' | 'signedIn'
  >('loading');
  const [user, setUser] = useState<User | null>(null);
  const [logs, setLogs] = useState<MealLog[]>([]);
  const [activeView, setActiveView] = useState<'overview' | 'diary'>(
    'overview'
  );
  const [authError, setAuthError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [description, setDescription] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analysisError, setAnalysisError] = useState('');
  const [editing, setEditing] = useState<MealLog | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MealLog | null>(null);
  const [diaryFilter, setDiaryFilter] = useState<'today' | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const cameraInput = useRef<HTMLInputElement>(null);
  const today = dateKey(new Date());

  async function refreshLogs() {
    const response = await api.get('/api/logs');
    const items = Array.isArray(response.data?.items)
      ? response.data.items
      : [];
    setLogs(
      items.sort(
        (a: MealLog, b: MealLog) =>
          new Date(b.eatenAt).getTime() - new Date(a.eatenAt).getTime()
      )
    );
  }

  useEffect(() => {
    let active = true;
    auth
      .getUser()
      .then(async restoredUser => {
        if (!active) return;
        if (!restoredUser) {
          setAuthStatus('signedOut');
          return;
        }
        setUser(restoredUser);
        try {
          await refreshLogs();
        } catch {
          if (active)
            setNotice(
              'Your account is ready, but the diary could not be loaded. Refresh to try again.'
            );
        }
        if (active) setAuthStatus('signedIn');
      })
      .catch(() => {
        if (active) {
          setAuthError(
            'We could not restore your session. Please sign in again.'
          );
          setAuthStatus('signedOut');
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!photoPreview) return;
    return () => URL.revokeObjectURL(photoPreview);
  }, [photoPreview]);

  const todayLogs = useMemo(
    () => logs.filter(log => dateKey(log.eatenAt) === today),
    [logs, today]
  );
  const todayTotals = useMemo(() => sumMeals(todayLogs), [todayLogs]);
  const visibleDiaryLogs = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return logs.filter(log => {
      const matchesDate =
        diaryFilter === 'all' || dateKey(log.eatenAt) === today;
      const matchesSearch =
        !query ||
        log.name.toLowerCase().includes(query) ||
        log.portion.toLowerCase().includes(query);
      return matchesDate && matchesSearch;
    });
  }, [logs, diaryFilter, today, searchTerm]);

  async function beginSignIn() {
    setAuthError('');
    try {
      await auth.signInWithRedirect();
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Sign-in could not be started.';
      setAuthError(message);
    }
  }

  async function signOut() {
    try {
      await auth.signOut();
      setUser(null);
      setLogs([]);
      setAnalysis(null);
      setAuthStatus('signedOut');
      setNotice('');
    } catch {
      setNotice('We could not sign you out. Please try again.');
    }
  }

  function selectPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setAnalysisError('Choose an image file to analyse your meal.');
      return;
    }
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setAnalysis(null);
    setAnalysisError('');
  }

  async function analyzeMeal() {
    setAnalysisError('');
    setNotice('');
    if (!description.trim() && !photoFile) {
      setAnalysisError('Add a food description or take a meal photo first.');
      return;
    }
    setAnalyzing(true);
    try {
      const payload: {
        description?: string;
        image?: string;
        mimeType?: string;
      } = {};
      if (description.trim()) payload.description = description.trim();
      if (photoFile) {
        const prepared = await image.resizeIfNeeded(photoFile, {
          maxDimension: 1600,
          maxPixels: 2_000_000,
          quality: 0.82,
          mimeType: 'image/jpeg',
        });
        payload.image = prepared.data;
        payload.mimeType = prepared.mimeType;
      }
      const response = await api.post('/api/analyze', payload);
      setAnalysis(response.data.analysis as Analysis);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '';
      setAnalysisError(
        message.includes('429')
          ? 'The nutrition analyser is busy right now. Please try again in a moment.'
          : 'We could not estimate that meal just now. Add a little more detail and try again.'
      );
    } finally {
      setAnalyzing(false);
    }
  }

  async function saveAnalysis() {
    if (!analysis) return;
    setBusy(true);
    setNotice('');
    try {
      const names = analysis.dishes.map(dish => dish.name).join(' + ');
      const portions = analysis.dishes
        .map(dish => dish.portion)
        .filter(Boolean)
        .join('; ');
      await api.post('/api/logs', {
        name: names || 'Indian meal',
        portion: portions || 'Estimated serving',
        calories: analysis.totals.calories,
        protein: analysis.totals.protein,
        carbs: analysis.totals.carbs,
        sugars: analysis.totals.sugars,
        eatenAt: new Date().toISOString(),
        source: photoFile ? 'photo' : 'description',
        notes: analysis.assumptions,
        items: analysis.dishes,
      });
      await refreshLogs();
      setAnalysis(null);
      setDescription('');
      setPhotoFile(null);
      setPhotoPreview('');
      setNotice('Meal saved to your diary.');
    } catch {
      setNotice('Your meal could not be saved. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function addQuickMeal(meal: QuickMeal) {
    setBusy(true);
    setNotice('');
    try {
      await api.post('/api/logs', {
        name: meal.name,
        portion: meal.portion,
        calories: meal.calories,
        protein: meal.protein,
        carbs: meal.carbs,
        sugars: meal.sugars,
        eatenAt: new Date().toISOString(),
        source: 'quick',
        notes: meal.note,
      });
      await refreshLogs();
      setNotice(meal.name + ' added to your diary.');
    } catch {
      setNotice('The meal could not be added. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setBusy(true);
    setNotice('');
    try {
      await api.put('/api/logs/' + encodeURIComponent(editing.id), {
        name: editing.name,
        portion: editing.portion,
        calories: editing.calories,
        protein: editing.protein,
        carbs: editing.carbs,
        sugars: editing.sugars,
        eatenAt: editing.eatenAt,
        notes: editing.notes,
      });
      await refreshLogs();
      setEditing(null);
      setNotice('Meal details updated.');
    } catch {
      setNotice('We could not update that meal. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteMeal() {
    if (!deleteTarget) return;
    setBusy(true);
    setNotice('');
    try {
      await api.delete('/api/logs/' + encodeURIComponent(deleteTarget.id));
      await refreshLogs();
      setDeleteTarget(null);
      setNotice('Meal removed from your diary.');
    } catch {
      setNotice('We could not delete that meal. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (authStatus === 'loading') {
    return (
      <div className="loading-screen">
        <div className="brand-mark">
          <Leaf size={23} />
        </div>
        <Loader2 className="spin" size={22} />
        <p>Restoring your food diary…</p>
      </div>
    );
  }

  if (authStatus === 'signedOut') {
    return (
      <div className="auth-screen">
        <div className="auth-decoration auth-decoration-one" />
        <div className="auth-decoration auth-decoration-two" />
        <header className="auth-topbar">
          <div className="brand-lockup">
            <span className="brand-mark">
              <Leaf size={22} />
            </span>
            <span>
              rasoi<span className="brand-light">track</span>
            </span>
          </div>
          <span className="auth-top-note">
            <ShieldCheck size={15} /> Private food journal
          </span>
        </header>
        <main className="auth-main">
          <section className="auth-copy">
            <span className="eyebrow">
              <span className="eyebrow-dot" /> YOUR INDIAN FOOD COMPANION
            </span>
            <h1>
              Know what’s
              <br />
              on your <em>thali.</em>
            </h1>
            <p className="auth-lede">
              A thoughtful nutrition tracker made for the food you actually eat.
              From idli and dosa to dal, biryani and everything in between.
            </p>
            <div className="auth-feature-list">
              <div>
                <span className="feature-icon">
                  <Camera size={17} />
                </span>
                <span>
                  <b>Snap or describe</b>
                  <small>Understand a meal from a photo or a few words.</small>
                </span>
              </div>
              <div>
                <span className="feature-icon">
                  <Activity size={17} />
                </span>
                <span>
                  <b>Track four essentials</b>
                  <small>Calories, protein, carbohydrates and sugars.</small>
                </span>
              </div>
              <div>
                <span className="feature-icon">
                  <BookOpen size={17} />
                </span>
                <span>
                  <b>Your diary stays yours</b>
                  <small>Come back to your saved meal history anytime.</small>
                </span>
              </div>
            </div>
          </section>
          <section className="auth-card">
            <div className="auth-card-symbol">
              <Utensils size={25} />
            </div>
            <span className="eyebrow">WELCOME TO RASOITRACK</span>
            <h2>Your plate, in perspective.</h2>
            <p>
              Sign in or create an account to start your personal food diary.
              Your saved meals will be waiting when you return.
            </p>
            <button
              className="primary-button auth-button"
              onClick={beginSignIn}
            >
              Continue to your account <ChevronRight size={17} />
            </button>
            {authError && (
              <p className="inline-error">
                <AlertCircle size={15} /> {authError}
              </p>
            )}
            <div className="secure-note">
              <ShieldCheck size={15} /> Secure sign-in with email or a supported
              provider
            </div>
            <div className="auth-card-bottom">
              No calorie perfection required. Just a clearer picture.
            </div>
          </section>
        </main>
        <footer className="auth-footer">
          MADE FOR EVERYDAY INDIAN EATING <span>•</span> ESTIMATES, NOT MEDICAL
          ADVICE
        </footer>
      </div>
    );
  }

  const firstName = user?.name?.split(' ')[0] || 'there';
  const caloriesRemaining = Math.max(
    0,
    DAILY_GOALS.calories - todayTotals.calories
  );
  const recentLogs = logs.slice(0, 4);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup sidebar-brand">
          <span className="brand-mark">
            <Leaf size={21} />
          </span>
          <span>
            rasoi<span className="brand-light">track</span>
          </span>
        </div>
        <div className="side-label">YOUR SPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          <button
            className={
              activeView === 'overview' ? 'nav-item active' : 'nav-item'
            }
            onClick={() => setActiveView('overview')}
          >
            <Activity size={18} /> Overview
          </button>
          <button
            className={activeView === 'diary' ? 'nav-item active' : 'nav-item'}
            onClick={() => setActiveView('diary')}
          >
            <BookOpen size={18} /> Food diary{' '}
            <span className="nav-count">{logs.length}</span>
          </button>
        </nav>
        <div className="sidebar-note">
          <div className="sidebar-note-icon">
            <Leaf size={17} />
          </div>
          <b>Progress, not perfection.</b>
          <p>Every meal is useful information. Keep showing up for yourself.</p>
        </div>
        <div className="sidebar-bottom">
          <div className="profile-row">
            <div className="avatar">{initials(user)}</div>
            <div className="profile-copy">
              <b>{user?.name || 'Your account'}</b>
              <small>{user?.email || 'Signed in'}</small>
            </div>
            <button
              className="icon-button logout-button"
              onClick={signOut}
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut size={17} />
            </button>
          </div>
          <div className="sidebar-footnote">
            <ShieldCheck size={13} /> Your diary is private to your account
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div>
            <div className="breadcrumb">
              YOUR FOOD JOURNAL <span>/</span>{' '}
              {activeView === 'overview' ? 'OVERVIEW' : 'FOOD DIARY'}
            </div>
            <h1>
              {activeView === 'overview'
                ? 'A good day starts here.'
                : 'Your food diary'}
            </h1>
          </div>
          <div className="topbar-right">
            <div className="date-pill">
              <span className="date-dot" />{' '}
              {new Date().toLocaleDateString('en-IN', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              })}
            </div>
            <div className="top-avatar">{initials(user)}</div>
          </div>
        </header>

        {notice && (
          <div className="notice-banner" role="status">
            <Check size={16} /> {notice}
            <button onClick={() => setNotice('')} aria-label="Dismiss message">
              <X size={15} />
            </button>
          </div>
        )}

        {activeView === 'overview' ? (
          <>
            <section className="welcome-row">
              <div>
                <p className="welcome-kicker">YOUR DAILY CHECK-IN</p>
                <h2>
                  Namaste, {firstName} <span>✦</span>
                </h2>
                <p className="welcome-subtitle">
                  A little awareness goes a long way. Here’s how today is
                  looking.
                </p>
              </div>
              <div className="streak-chip">
                <span className="streak-icon">
                  <Flame size={16} />
                </span>
                <span>
                  <b>
                    {todayLogs.length
                      ? 'You logged today'
                      : 'Your day, your pace'}
                  </b>
                  <small>
                    {todayLogs.length}{' '}
                    {todayLogs.length === 1 ? 'meal' : 'meals'} in today’s diary
                  </small>
                </span>
              </div>
            </section>

            <section className="summary-panel">
              <div className="summary-main">
                <div className="section-overline">
                  <span className="tiny-sun">✳</span> TODAY’S NUTRITION
                </div>
                <div className="calorie-number">
                  {Math.round(todayTotals.calories).toLocaleString('en-IN')}
                  <span> kcal</span>
                </div>
                <div className="calorie-caption">
                  of {DAILY_GOALS.calories.toLocaleString('en-IN')} kcal starter
                  target
                </div>
                <div className="calorie-track">
                  <div
                    style={{
                      width:
                        Math.min(
                          100,
                          (todayTotals.calories / DAILY_GOALS.calories) * 100
                        ) + '%',
                    }}
                  />
                </div>
                <div className="calorie-foot">
                  <span>
                    {Math.round(
                      (todayTotals.calories / DAILY_GOALS.calories) * 100
                    )}
                    % of target
                  </span>
                  <b>
                    {caloriesRemaining.toLocaleString('en-IN')} kcal remaining
                  </b>
                </div>
              </div>
              <div className="summary-side">
                <div className="summary-side-top">
                  <span>YOUR DAY AT A GLANCE</span>
                  <span className="summary-spark">
                    <Sparkles size={15} />
                  </span>
                </div>
                <div className="mini-stat-grid">
                  <div className="mini-stat">
                    <span className="mini-stat-icon protein">
                      <Activity size={15} />
                    </span>
                    <div>
                      <b>
                        {formatNumber(todayTotals.protein)}
                        <small>g</small>
                      </b>
                      <span>Protein</span>
                    </div>
                  </div>
                  <div className="mini-stat">
                    <span className="mini-stat-icon carbs">
                      <Wheat size={15} />
                    </span>
                    <div>
                      <b>
                        {formatNumber(todayTotals.carbs)}
                        <small>g</small>
                      </b>
                      <span>Carbs</span>
                    </div>
                  </div>
                  <div className="mini-stat">
                    <span className="mini-stat-icon sugar">
                      <Cookie size={15} />
                    </span>
                    <div>
                      <b>
                        {formatNumber(todayTotals.sugars)}
                        <small>g</small>
                      </b>
                      <span>Sugars</span>
                    </div>
                  </div>
                  <div className="mini-stat">
                    <span className="mini-stat-icon meal">
                      <Utensils size={15} />
                    </span>
                    <div>
                      <b>
                        {todayLogs.length}
                        <small></small>
                      </b>
                      <span>Meals logged</span>
                    </div>
                  </div>
                </div>
                <p className="target-footnote">
                  Starter targets are general examples, not personalised
                  nutrition advice.
                </p>
              </div>
            </section>

            <section className="macro-row">
              <div className="macro-card">
                <div className="macro-top">
                  <span className="macro-icon protein">
                    <Activity size={17} />
                  </span>
                  <span className="macro-label">PROTEIN</span>
                  <span className="macro-percent">
                    {Math.round(
                      (todayTotals.protein / DAILY_GOALS.protein) * 100
                    )}
                    %
                  </span>
                </div>
                <div className="macro-value">
                  {formatNumber(todayTotals.protein)}
                  <small> / {DAILY_GOALS.protein} g</small>
                </div>
                <div className="macro-track">
                  <div
                    className="protein-fill"
                    style={{
                      width:
                        Math.min(
                          100,
                          (todayTotals.protein / DAILY_GOALS.protein) * 100
                        ) + '%',
                    }}
                  />
                </div>
              </div>
              <div className="macro-card">
                <div className="macro-top">
                  <span className="macro-icon carbs">
                    <Wheat size={17} />
                  </span>
                  <span className="macro-label">CARBOHYDRATES</span>
                  <span className="macro-percent">
                    {Math.round((todayTotals.carbs / DAILY_GOALS.carbs) * 100)}%
                  </span>
                </div>
                <div className="macro-value">
                  {formatNumber(todayTotals.carbs)}
                  <small> / {DAILY_GOALS.carbs} g</small>
                </div>
                <div className="macro-track">
                  <div
                    className="carbs-fill"
                    style={{
                      width:
                        Math.min(
                          100,
                          (todayTotals.carbs / DAILY_GOALS.carbs) * 100
                        ) + '%',
                    }}
                  />
                </div>
              </div>
              <div className="macro-card">
                <div className="macro-top">
                  <span className="macro-icon sugar">
                    <Cookie size={17} />
                  </span>
                  <span className="macro-label">SUGARS</span>
                  <span className="macro-percent">
                    {Math.round(
                      (todayTotals.sugars / DAILY_GOALS.sugars) * 100
                    )}
                    %
                  </span>
                </div>
                <div className="macro-value">
                  {formatNumber(todayTotals.sugars)}
                  <small> / {DAILY_GOALS.sugars} g</small>
                </div>
                <div className="macro-track">
                  <div
                    className="sugar-fill"
                    style={{
                      width:
                        Math.min(
                          100,
                          (todayTotals.sugars / DAILY_GOALS.sugars) * 100
                        ) + '%',
                    }}
                  />
                </div>
              </div>
            </section>

            <div className="content-grid">
              <section className="panel analyzer-panel">
                <div className="panel-heading">
                  <div>
                    <span className="panel-eyebrow">SMART MEAL ANALYSER</span>
                    <h3>What’s on your plate?</h3>
                    <p>Show us your food or tell us what you ate.</p>
                  </div>
                  <div className="heading-icon">
                    <Sparkles size={19} />
                  </div>
                </div>
                <div className="camera-drop">
                  {photoPreview ? (
                    <div className="photo-preview-wrap">
                      <img src={photoPreview} alt="Selected meal preview" />
                      <div className="photo-preview-overlay">
                        <span>
                          <Check size={14} /> Photo ready to analyse
                        </span>
                        <button
                          onClick={() => {
                            setPhotoFile(null);
                            setPhotoPreview('');
                          }}
                          aria-label="Remove photo"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="camera-prompt"
                      onClick={() => cameraInput.current?.click()}
                    >
                      <span className="camera-circle">
                        <Camera size={22} />
                      </span>
                      <b>Take a meal photo</b>
                      <span>Use your camera or choose an image</span>
                      <small>
                        <ImagePlus size={13} /> JPG, PNG or WEBP
                      </small>
                    </button>
                  )}
                  <input
                    ref={cameraInput}
                    className="visually-hidden"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={selectPhoto}
                  />
                </div>
                <div className="or-divider">
                  <span>OR DESCRIBE YOUR MEAL</span>
                </div>
                <label className="field-label" htmlFor="meal-description">
                  WHAT DID YOU EAT?
                </label>
                <textarea
                  id="meal-description"
                  className="meal-textarea"
                  rows={3}
                  maxLength={1200}
                  placeholder="e.g. 2 masala dosas with coconut chutney and one bowl of sambar…"
                  value={description}
                  onChange={event => setDescription(event.target.value)}
                />
                <div className="textarea-footer">
                  <span>
                    Include portion sizes and cooking style for a better
                    estimate.
                  </span>
                  <span>{description.length}/1200</span>
                </div>
                {analysisError && (
                  <div className="inline-error analysis-error">
                    <AlertCircle size={15} /> {analysisError}
                  </div>
                )}
                <button
                  className="primary-button analyze-button"
                  onClick={analyzeMeal}
                  disabled={analyzing}
                >
                  {analyzing ? (
                    <>
                      <Loader2 size={17} className="spin" /> Analysing your
                      meal…
                    </>
                  ) : (
                    <>
                      <Sparkles size={17} /> Analyse nutrition{' '}
                      <ChevronRight size={17} />
                    </>
                  )}
                </button>
                <p className="estimate-note">
                  <ShieldCheck size={13} /> Estimates can vary with recipe, oil,
                  ingredients and serving size.
                </p>

                {analysis && (
                  <div className="analysis-result">
                    <div className="result-heading">
                      <div>
                        <span className="panel-eyebrow">
                          YOUR ESTIMATED BREAKDOWN
                        </span>
                        <h4>Here’s what we found</h4>
                      </div>
                      <span
                        className={
                          'confidence-pill ' + analysis.confidence.toLowerCase()
                        }
                      >
                        {analysis.confidence} confidence
                      </span>
                    </div>
                    <div className="result-calories">
                      <b>{Math.round(analysis.totals.calories)}</b>
                      <span>kcal</span>
                    </div>
                    <div className="result-macros">
                      <span>
                        <b>{formatNumber(analysis.totals.protein)}g</b> Protein
                      </span>
                      <span>
                        <b>{formatNumber(analysis.totals.carbs)}g</b> Carbs
                      </span>
                      <span>
                        <b>{formatNumber(analysis.totals.sugars)}g</b> Sugars
                      </span>
                    </div>
                    <div className="dish-breakdown">
                      {analysis.dishes.map((dish, index) => (
                        <div className="dish-line" key={dish.name + index}>
                          <span>
                            <b>{dish.name}</b>
                            <small>{dish.portion}</small>
                          </span>
                          <strong>{Math.round(dish.calories)} kcal</strong>
                        </div>
                      ))}
                    </div>
                    <p className="assumption-note">
                      <b>Assumptions:</b> {analysis.assumptions}
                    </p>
                    <button
                      className="primary-button save-analysis-button"
                      onClick={saveAnalysis}
                      disabled={busy}
                    >
                      {busy ? (
                        <Loader2 size={16} className="spin" />
                      ) : (
                        <Plus size={16} />
                      )}{' '}
                      Save meal to diary
                    </button>
                  </div>
                )}
              </section>

              <div className="right-column">
                <section className="panel quick-panel">
                  <div className="panel-heading compact-heading">
                    <div>
                      <span className="panel-eyebrow">QUICK ADD</span>
                      <h3>Common favourites</h3>
                      <p>One tap to log a typical serving.</p>
                    </div>
                    <span className="quick-heading-icon">
                      <Utensils size={17} />
                    </span>
                  </div>
                  <div className="quick-list">
                    {QUICK_MEALS.map(meal => (
                      <div className="quick-item" key={meal.name}>
                        <div className="quick-food-icon">
                          {meal.name.startsWith('Idli')
                            ? '◉'
                            : meal.name.startsWith('Vegetable')
                              ? '✿'
                              : '◒'}
                        </div>
                        <div className="quick-food-copy">
                          <b>{meal.name}</b>
                          <small>{meal.portion}</small>
                          <span>
                            {meal.calories} kcal · {meal.protein}g protein
                          </span>
                        </div>
                        <button
                          className="quick-add-button"
                          onClick={() => addQuickMeal(meal)}
                          disabled={busy}
                          aria-label={'Add ' + meal.name}
                        >
                          <Plus size={17} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="quick-disclaimer">
                    Typical serving estimates. Your recipe may differ.
                  </p>
                </section>

                <section className="panel recent-panel">
                  <div className="recent-heading">
                    <div>
                      <span className="panel-eyebrow">RECENTLY LOGGED</span>
                      <h3>Your latest meals</h3>
                    </div>
                    <button
                      className="text-link"
                      onClick={() => setActiveView('diary')}
                    >
                      View diary <ChevronRight size={15} />
                    </button>
                  </div>
                  {recentLogs.length ? (
                    <div className="recent-list">
                      {recentLogs.map(log => (
                        <div className="recent-item" key={log.id}>
                          <div className="recent-food-icon">
                            <Utensils size={16} />
                          </div>
                          <div className="recent-food-copy">
                            <b>{log.name}</b>
                            <small>
                              {formatTime(log.eatenAt)} · {log.portion}
                            </small>
                          </div>
                          <strong>
                            {Math.round(log.calories)} <small>kcal</small>
                          </strong>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-recent">
                      <span>
                        <BookOpen size={21} />
                      </span>
                      <b>Your diary is ready</b>
                      <p>
                        Analyse a meal or use Quick add to make your first
                        entry.
                      </p>
                    </div>
                  )}
                </section>
              </div>
            </div>
            <footer className="page-footnote">
              Nutrition values are estimates for general information, not a
              substitute for advice from a registered dietitian or healthcare
              professional.
            </footer>
          </>
        ) : (
          <section className="diary-page">
            <div className="diary-intro">
              <div>
                <span className="panel-eyebrow">
                  YOUR PERSONAL FOOD JOURNAL
                </span>
                <h2>Every plate tells a story.</h2>
                <p>Review, update or remove meals whenever you need to.</p>
              </div>
              <div className="diary-total">
                <b>{logs.length}</b>
                <span>total entries</span>
              </div>
            </div>
            <div className="diary-toolbar">
              <div className="filter-tabs">
                <button
                  className={
                    diaryFilter === 'all' ? 'filter-tab active' : 'filter-tab'
                  }
                  onClick={() => setDiaryFilter('all')}
                >
                  All meals
                </button>
                <button
                  className={
                    diaryFilter === 'today' ? 'filter-tab active' : 'filter-tab'
                  }
                  onClick={() => setDiaryFilter('today')}
                >
                  Today
                </button>
              </div>
              <label className="search-box">
                <Search size={16} />
                <input
                  aria-label="Search meals"
                  placeholder="Search your meals…"
                  value={searchTerm}
                  onChange={event => setSearchTerm(event.target.value)}
                />
              </label>
            </div>
            {visibleDiaryLogs.length ? (
              <div className="diary-list">
                {visibleDiaryLogs.map(log => (
                  <article className="diary-card" key={log.id}>
                    <div className="diary-card-icon">
                      <Utensils size={18} />
                    </div>
                    <div className="diary-card-main">
                      <div className="diary-card-title">
                        <h3>{log.name}</h3>
                        <span className="source-tag">
                          {log.source === 'photo'
                            ? 'Photo analysis'
                            : log.source === 'description'
                              ? 'Description'
                              : log.source === 'quick'
                                ? 'Quick add'
                                : 'Manual entry'}
                        </span>
                      </div>
                      <p>{log.portion}</p>
                      <div className="diary-date">
                        <Clock3 size={13} /> {formatDate(log.eatenAt)} ·{' '}
                        {formatTime(log.eatenAt)}
                      </div>
                      {log.notes && (
                        <div className="diary-notes">{log.notes}</div>
                      )}
                    </div>
                    <div className="diary-card-nutrition">
                      <b>
                        {Math.round(log.calories)} <small>kcal</small>
                      </b>
                      <span>{formatNumber(log.protein)}g protein</span>
                      <span>{formatNumber(log.carbs)}g carbs</span>
                      <span>{formatNumber(log.sugars)}g sugars</span>
                    </div>
                    <div className="diary-card-actions">
                      <button
                        className="icon-button"
                        onClick={() => setEditing({ ...log })}
                        title="Edit meal"
                        aria-label={'Edit ' + log.name}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        className="icon-button danger-icon"
                        onClick={() => setDeleteTarget(log)}
                        title="Delete meal"
                        aria-label={'Delete ' + log.name}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="diary-empty">
                <div>
                  <BookOpen size={26} />
                </div>
                <h3>No meals found</h3>
                <p>
                  {searchTerm
                    ? 'Try another search term.'
                    : diaryFilter === 'today'
                      ? 'Nothing logged today yet. Your next meal can be the first.'
                      : 'Your food diary is empty. Analyse a meal or try a Quick add.'}
                </p>
                <button
                  className="secondary-button"
                  onClick={() => setActiveView('overview')}
                >
                  Add a meal <ChevronRight size={15} />
                </button>
              </div>
            )}
            <footer className="page-footnote">
              Your diary is private to your signed-in account. The list shows
              your latest 100 entries.
            </footer>
          </section>
        )}
      </main>

      {editing && (
        <div className="modal-backdrop" role="presentation">
          <form className="edit-modal" onSubmit={saveEdit}>
            <div className="modal-heading">
              <div>
                <span className="panel-eyebrow">UPDATE FOOD ENTRY</span>
                <h3>Edit meal details</h3>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setEditing(null)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <label className="edit-field full-field">
              Meal name
              <input
                required
                maxLength={120}
                value={editing.name}
                onChange={event =>
                  setEditing({ ...editing, name: event.target.value })
                }
              />
            </label>
            <label className="edit-field full-field">
              Portion description
              <input
                maxLength={200}
                value={editing.portion}
                onChange={event =>
                  setEditing({ ...editing, portion: event.target.value })
                }
              />
            </label>
            <div className="edit-nutrient-grid">
              <label className="edit-field">
                Calories (kcal)
                <input
                  type="number"
                  min="0"
                  max="10000"
                  step="1"
                  value={editing.calories}
                  onChange={event =>
                    setEditing({
                      ...editing,
                      calories: Number(event.target.value),
                    })
                  }
                />
              </label>
              <label className="edit-field">
                Protein (g)
                <input
                  type="number"
                  min="0"
                  max="1000"
                  step="0.1"
                  value={editing.protein}
                  onChange={event =>
                    setEditing({
                      ...editing,
                      protein: Number(event.target.value),
                    })
                  }
                />
              </label>
              <label className="edit-field">
                Carbs (g)
                <input
                  type="number"
                  min="0"
                  max="1000"
                  step="0.1"
                  value={editing.carbs}
                  onChange={event =>
                    setEditing({
                      ...editing,
                      carbs: Number(event.target.value),
                    })
                  }
                />
              </label>
              <label className="edit-field">
                Sugars (g)
                <input
                  type="number"
                  min="0"
                  max="1000"
                  step="0.1"
                  value={editing.sugars}
                  onChange={event =>
                    setEditing({
                      ...editing,
                      sugars: Number(event.target.value),
                    })
                  }
                />
              </label>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
              <button className="primary-button" type="submit" disabled={busy}>
                {busy ? (
                  <Loader2 size={16} className="spin" />
                ) : (
                  <Check size={16} />
                )}{' '}
                Save changes
              </button>
            </div>
          </form>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-backdrop" role="presentation">
          <div
            className="confirm-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-title"
          >
            <div className="confirm-icon">
              <Trash2 size={21} />
            </div>
            <h3 id="delete-title">Remove this meal?</h3>
            <p>
              <b>{deleteTarget.name}</b> will be permanently removed from your
              food diary.
            </p>
            <div className="modal-actions">
              <button
                className="secondary-button"
                onClick={() => setDeleteTarget(null)}
              >
                Keep meal
              </button>
              <button
                className="delete-button"
                onClick={deleteMeal}
                disabled={busy}
              >
                {busy ? (
                  <Loader2 size={16} className="spin" />
                ) : (
                  <Trash2 size={16} />
                )}{' '}
                Delete meal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
