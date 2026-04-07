# Bari the Architect

An interactive element fusion game inspired by Infinite Craft. Combine base elements by dragging and dropping them together to discover new creations — powered by AI for unlimited combinations.

## How It Works

Start with 6 base elements (Fire, Water, Earth, Air, Plant, Stone) and drag them from the sidebar palette into the workspace. When two elements are placed close together, they fuse into a new element. There are 14 built-in recipes (e.g. Fire + Water = Steam), and any unknown combination is sent to Google Gemini to generate a creative result with a name and color. Newly discovered elements are added to your palette for further experimentation.

## Tech Stack

- **TypeScript** with strict mode
- **Next.js** for the app shell and Vercel-ready API routes
- **Vertex AI** via server-side route handlers for AI-powered element fusion and era progression
- Vanilla DOM with Pointer Events for drag-and-drop

## Getting Started

```bash
npm install
```

Create a `.env` file in the project root:

```
GCP_PROJECT_ID=your_gcp_project_id
GCP_REGION=us-central1
```

For local development, authenticate with Application Default Credentials:

```bash
gcloud auth application-default login
```

For Vercel, provide `GOOGLE_APPLICATION_CREDENTIALS_JSON` as an environment variable containing the service account JSON.

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
