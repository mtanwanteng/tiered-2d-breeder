# Bari the Architect

An interactive element fusion game inspired by Infinite Craft. Combine base elements by dragging and dropping them together to discover new creations — powered by AI for unlimited combinations.

## How It Works

Start with 6 base elements (Fire, Water, Earth, Air, Plant, Stone) and drag them from the sidebar palette into the workspace. When two elements are placed close together, they fuse into a new element. There are 14 built-in recipes (e.g. Fire + Water = Steam), and any unknown combination is sent to Google Gemini to generate a creative result with a name and color. Newly discovered elements are added to your palette for further experimentation.

## Tech Stack

- **TypeScript** with strict mode
- **Next.js** for the app shell and Vercel-ready API routes
- **Vertex AI** via server-side route handlers for AI-powered element fusion and era progression
- **Postgres + Drizzle** for auth and persisted tapestry metadata
- **AWS S3** for persisted tapestry image storage
- Vanilla DOM with Pointer Events for drag-and-drop

## Getting Started

```bash
npm install
```

Create a `.env.local` file in the project root using `.env.local.example` as a starting point.

The app now supports persisted tapestry storage. To enable it locally or in production, set:

```
DATABASE_URL=...
DATABASE_URL_UNPOOLED=...
BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
NEXT_PUBLIC_DISCORD_CLIENT_ID=...
AWS_REGION=us-east-1
AWS_S3_TAPESTRY_BUCKET=...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_TAPESTRY_PREFIX=dev
AWS_S3_TAPESTRY_BRANCH_PREFIX=
```

For local development, authenticate with Application Default Credentials:

```bash
gcloud auth application-default login
```

For Vercel, provide `GOOGLE_APPLICATION_CREDENTIALS_JSON` as an environment variable containing the service account JSON.

For AWS-backed tapestry storage, either:

- create the bucket and IAM credentials from `terraform/`, then copy the resulting values into your app env vars, or
- point the app at an existing private S3 bucket with `AWS_REGION` and `AWS_S3_TAPESTRY_BUCKET`.

Persisted tapestry objects are namespaced automatically:

- production writes under `prod/...`
- non-production writes under `dev/...`

If you later want stable branch-specific prefixes, set `AWS_S3_TAPESTRY_BRANCH_PREFIX`. If you want to fully override the computed prefix, set `AWS_S3_TAPESTRY_PREFIX`.

If the AWS tapestry env vars are omitted, tapestry generation still works, but the image stays ephemeral and no DB record/share page is created.

Then start the dev server:

```bash
npm run dev
```

## Scripts

| Command         | Description                               |
| --------------- | ----------------------------------------- |
| `npm run dev`   | Start the Next.js development server      |
| `npm run build` | Create the production build               |
| `npm run start` | Run the production server locally         |
