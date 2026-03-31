# Tiered 2D Breeder

An interactive element fusion game inspired by Infinite Craft. Combine base elements by dragging and dropping them together to discover new creations — powered by AI for unlimited combinations.

## How It Works

Start with 6 base elements (Fire, Water, Earth, Air, Plant, Stone) and drag them from the sidebar palette into the workspace. When two elements are placed close together, they fuse into a new element. There are 14 built-in recipes (e.g. Fire + Water = Steam), and any unknown combination is sent to Google Gemini to generate a creative result with a name and color. Newly discovered elements are added to your palette for further experimentation.

## Tech Stack

- **TypeScript** with strict mode
- **Vite** for dev server and bundling
- **Google Gemini API** (gemini-2.5-flash) for AI-powered element fusion
- Vanilla DOM with Pointer Events for drag-and-drop

## Getting Started

```bash
npm install
```

Create a `.env` file in the project root:

```
VITE_GEMINI_API_KEY=your_api_key_here
```

Then start the dev server:

```bash
npm run dev
```

## Scripts

| Command             | Description                          |
| ------------------- | ------------------------------------ |
| `npm run dev`       | Start Vite dev server with hot reload |
| `npm run build`     | Type-check and build for production   |
| `npm run preview`   | Preview the production build locally  |
