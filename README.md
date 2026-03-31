# Language Learning

React Router + Vite application with a Hono server entrypoint.

## Setup

Use the project root directly:

```powershell
cd "C:\Users\User\Downloads\languagelearning-master"
```

Install dependencies:

```powershell
npm install --legacy-peer-deps
```

Run local development:

```powershell
npm run dev
```

Type-check the app:

```powershell
npm run typecheck
```

Build and run production locally:

```powershell
npm run build
npm run start
```

## Environment

Create your local environment file from `.env.example` and provide the values required for your deployment target.

Key runtime variables:

- `AUTH_SECRET`
- `AUTH_URL`
- `DATABASE_URL`
- `APP_URL`

Optional integrations:

- `STRIPE_SECRET_KEY`
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `CORS_ORIGINS`
- `NEXT_PUBLIC_CREATE_BASE_URL`
- `NEXT_PUBLIC_CREATE_API_BASE_URL`
- `NEXT_PUBLIC_CREATE_HOST`
- `NEXT_PUBLIC_PROJECT_GROUP_ID`
- `NEXT_PUBLIC_CREATE_ENV`