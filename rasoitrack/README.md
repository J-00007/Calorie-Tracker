# RasoiTrack

RasoiTrack is an Indian-cuisine-focused nutrition tracker for calories, protein, carbohydrates, and sugars.

## Features

- Account sign-in and session restoration through AppDeploy Auth.
- Food estimation from a camera photo or a written meal description.
- Indian dishes and components estimated separately where possible.
- Daily calorie and macronutrient summaries.
- Private food logs, with edit and confirmed-delete actions.
- Quick-add entries for common Indian meals.
- Responsive desktop and mobile layouts.

## Project layout

- `src/App.tsx` — React application and user workflows.
- `src/index.css` — application styling.
- `src/main.tsx` — React entry point.
- `backend/index.ts` — authenticated API routes, AI analysis, and per-user meal storage.
- `tests/tests.json` — end-to-end test scenarios.
- `package.json`, `vite.config.ts`, `tsconfig.json` — frontend build configuration.

## Platform requirements

This source is built for the **AppDeploy** runtime. The frontend uses `@appdeploy/client`, and the backend uses `@appdeploy/sdk` for authentication, database access, and AI extraction. Those packages and services are provided by the AppDeploy deployment environment; this repository does not contain credentials or API keys.

The deployed application is available at:

https://rasoitrack-5knt0m.v2.appdeploy.ai/

## Nutrition estimate note

Values are estimates, not laboratory measurements. Results depend on portion size, regional recipe, ingredients, oil/ghee, and preparation method. The starter daily targets are examples and are not personalised medical advice.
