# Bari — Game Design Document

## Overview

Bari is a civilization-building game where players guide a village through the ages by combining items. Starting with raw elements, players drag and drop items together to create increasingly advanced concepts. An AI generates new items with names, visuals, descriptions, and lore. A tiered progression system gives each level of combination a distinct creative flavor, and an era advancement system moves the civilization through historical ages based on the player's creations.

The player wins by guiding their civilization through a series of eras, achieving goals that reflect humanity's progression — developing tools, agriculture, writing, and beyond.

## Core Loop

1. An era begins with seed items in the inventory (e.g., Fire, Water, Earth)
2. Drag an item from the inventory into the workspace
3. Drag a second item on top of it (within 48px) to combine
4. Both parents are consumed; a new child item spawns at their midpoint
5. The child is added to the inventory for reuse
6. Repeat, climbing through tiers and working toward era goals
7. When a goal is achieved (AI-judged or fallback), the civilization advances to the next era with new seeds and challenges

## Combining

Combining is the primary player action. Two items are dragged together in the workspace, and the result is determined by:

1. **Hardcoded recipes** (tier 2) — instant, deterministic
2. **AI generation** (tiers 3-5) — sent to the backend, each tier uses a distinct prompt personality
3. **Recipe cache** — AI results are cached in-session so repeated combinations are instant

Combinations are order-independent: Fire + Water and Water + Fire produce the same result.

## Tier System

| Tier | Source | Description |
|------|--------|-------------|
| 1 | Era seeds | Base items for the current era |
| 2 | Hardcoded | Fixed recipes from tier-1 pairs |
| 3 | AI-generated | Creative, grounded concepts |
| 4 | AI-generated | Abstract, philosophical, mythological |
| 5 | AI-generated | Cosmic, legendary, transcendent — cannot be combined further |

**Tier calculation**: `min(max(parentA.tier, parentB.tier) + 1, 5)`

Tier-5 items are final discoveries. They cannot participate in any combination — attempting to overlap a tier-5 item shows a red glow on both items.

## Item Data Model

Every item has:

| Field | Description |
|-------|-------------|
| `name` | Display name (e.g., "Steam", "Lava") |
| `color` | Hex color for the item background |
| `tier` | 1-5 |
| `emoji` | Single emoji as visual representation |
| `description` | One sentence of flavor text (shown on hover) |
| `narrative` | 2-3 sentences of lore (shown on hover, styled like Dark Souls item descriptions) |

For AI-generated items, all fields are produced by the model in a single call.

## Era System

### Eras

Each era represents a stage of civilization. Defined in `src/eras.json`:

| Era | Seeds | Example Goals |
|-----|-------|---------------|
| Stone Age | Fire, Water, Earth, Air, Plant, Stone | Create a tool; develop agriculture |
| Bronze Age | Metal, Grain, Clay, Beast, River, Sun | Create writing or governance; build trade infrastructure |
| Iron Age | Iron, Script, Horse, Harbor, Temple, Field | Develop philosophy or science; build military fortification |

Each era has:
- **Seeds**: 6 starting items with full data (emoji, description, narrative)
- **Goals**: 1-3 objectives, any of which can trigger advancement

### Advancement

After each combination, the system checks for advancement:

1. **AI-judged** — The last 20 actions and current inventory are sent to the AI, which judges whether a goal has been achieved and generates a narrative
2. **Fallback** — If the player accumulates enough tier-5 items (per-goal threshold), advancement triggers automatically

On advancement:
- A modal shows the narrative and new era name
- The workspace is cleared
- New era seeds are loaded into the inventory
- Goals update

### Backend Endpoint

```
POST /api/check-era
Request: { model, goal, actionLog, inventory }
Response: { passed: boolean, narrative: string }
```

## Bari (Avatar)

Bari is a character avatar displayed at the bottom of the inventory sidebar. He represents the player's civilization.

- **Idle**: Gentle floating bob animation (3s cycle)
- **Active**: Bouncing animation during AI combine calls (0.5s cycle)
- **Placeholder**: Boy emoji (currently), to be replaced with custom art

## AI Integration

### Prompts

Tier-specific prompts are stored in `src/prompts.json` for easy hand-editing:

- **Tier 3**: Creative concept fusion — grounded, recognizable results with straightforward lore
- **Tier 4**: Alchemical synthesis — abstract, philosophical, mythological results with mysterious lore
- **Tier 5**: Cosmic oracle — legendary, paradoxical results with cryptic, Dark Souls-style lore

Prompts use `{{a}}` and `{{b}}` placeholders. The AI returns: `name`, `color`, `emoji`, `description`, `narrative`.

### Available Models

Hot-swappable via dropdown in the sidebar:

| Model | Publisher | Notes |
|-------|-----------|-------|
| Gemini 2.5 Flash | Google | Default, fast and cheap |
| Gemini 3.1 | Google | Newer model |
| Claude Haiku 4.5 | Anthropic | Requires Model Garden subscription |

All models are called through Google Vertex AI.

## Visual Feedback

### Glow System (during drag)
- **Green glow** on both items when they overlap and can be combined
- **Red glow** on both items when a tier-5 is involved (blocked)

### Tier Stars
Star icons in the top-right corner of each item, count equals tier.

### Tooltips
Hovering over any item (inventory or workspace) shows description and narrative in a tooltip.

### Toast Notifications
Combination results appear as a toast at the top of the screen with emoji (e.g., "Fire + Water = Steam"). Auto-dismisses after 2 seconds.

### Era Advancement Modal
Centered modal with gold border, era title, narrative text, and "Continue" button.

### Merge Animation
Child items pulse (scale 1 to 1.2 to 1) over 400ms on spawn.

## UI Layout

```
+--------------------+----------------------------------+
|  INVENTORY         |                                  |
|                    |                                  |
|  Stone Age         |                                  |
|  o Create a tool   |       W O R K S P A C E         |
|  o Develop agri.   |                                  |
|  ────────────      |   [Earth]    [Steam]             |
|  Model [v]         |                                  |
|  ────────────      |        [Lava]                    |
|  Fire  ****        |                                  |
|  Water ****        |                                  |
|  Earth ****        |                                  |
|  Air   ****        |                                  |
|  Plant ****        |                                  |
|  Stone ****        |                                  |
|  ...               |                                  |
|                    |                                  |
|     Bari           |                                  |
+--------------------+----------------------------------+
```

- **Inventory sidebar** (220px): Era display, goals, model selector, item list, Bari avatar
- **Workspace** (remaining space): Free-form canvas for dragging and combining
- **Dark theme**: Body #1a1a2e, sidebar #16213e, accent #e94560, era gold #ffd700

## Architecture

### Frontend (Vite + TypeScript)
- Vanilla DOM with Pointer Events for drag-and-drop
- No framework — pure TypeScript
- Calls `/api/combine` for AI-generated items
- Calls `/api/check-era` for advancement checks

### Backend (Express + Node.js)
- Proxies requests to Google Vertex AI
- Authenticates via Application Default Credentials (ADC) locally
- Handles model-specific API differences (Gemini structured schema vs Claude raw JSON)
- Endpoints:
  - `POST /api/combine { model, prompt }` — returns `{ name, color, emoji, description, narrative }`
  - `POST /api/check-era { model, goal, actionLog, inventory }` — returns `{ passed, narrative }`

### Database-Ready Interfaces

| Interface | Current Implementation | Future |
|-----------|----------------------|--------|
| `RecipeProvider` | `InMemoryRecipeStore` — hardcoded tier-2 + session cache | DB-backed, persistent across sessions |
| `PromptProvider` | `FilePromptProvider` — reads `prompts.json` | DB-backed, editable without deploys |

### Key Types

| Type | Purpose |
|------|---------|
| `ElementData` | Full item data (name, color, tier, emoji, description, narrative) |
| `CombineResult` | What the AI returns (same fields minus tier) |
| `ActionLogEntry` | Tracks each combination (timestamp, parents, result, tier) |
| `Era` | Era definition (name, seeds, goals) |
| `EraGoal` | A goal with description and fallback tier-5 count |

### Infrastructure (Terraform + GCP)
- **Project**: `sc-ai-innovation-lab-2-dev`
- **Region**: `us-central1`
- Terraform manages: Vertex AI API enablement, service account, IAM role binding
- Local auth: `gcloud auth application-default login`

## Running the Project

```bash
npm install
gcloud auth application-default login
npm run dev
```

Runs the Express backend (port 3001) and Vite dev server concurrently, with Vite proxying `/api` to the backend.

## Open Design Questions

1. **Era seed packs**: How many items per era? Do higher eras start with higher-tier seeds?
2. **Culture routing**: Player actions should influence the next era's culture (e.g., herding focus → Mongolian empire). Needs prompt design for the AI "narrator."
3. **Narration depth**: How much to show vs hide (Dark Souls sparse storytelling approach). Need prompt work to extract meaningful fragments from longer narratives.
4. **Win conditions**: Is there a final victory state across all eras? What does "winning" look like?
5. **Item persistence across eras**: Do items carry over, or does each era start completely fresh?
6. **Visual storytelling**: Emoji are a placeholder — eventually AI-generated images or sprites.
7. **Fallback tuning**: Tier-5 count thresholds per era need playtesting to feel right.
