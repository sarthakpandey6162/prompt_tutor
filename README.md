# AI Prompt Tutor

AI Prompt Tutor is a full-stack prompt engineering assistant that helps users write better prompts, analyze quality, and track improvement over time.

It combines prompt scoring, AI-powered rewrites, chat tutoring, a prompt library, and visual analytics in one lightweight app.

## What It Does

- Analyzes a prompt and returns score, strengths, missing elements, and improvement tips
- Generates improved prompt variants for different usage styles
- Saves prompt history with search, filters, save/unsave, and import/export
- Visualizes progress with trend, distribution, and element coverage charts
- Includes Tutor Chat, Lessons, Challenges, and a built-in cheat sheet
- Supports Demo Mode for presentations when live API access is unavailable

## Tech Stack

- Frontend: HTML, CSS, Vanilla JavaScript
- Backend: Node.js + Express
- AI Provider: Groq Chat Completions API
- Charts: Chart.js
- Local storage (development backend): JSON files under backend/
- Serverless deployment: Vercel (ephemeral in-memory storage in api/index.js)

## Project Structure

```text
.
├─ api/                 # Vercel serverless API (in-memory data at runtime)
├─ backend/             # Local Express server with JSON file persistence
├─ frontend/            # Web UI
├─ tests/               # API integration tests (node:test + supertest)
├─ package.json         # Root scripts (tests)
├─ vercel.json          # Vercel routing/build config
└─ README.md
```

## Quick Start (Local)

### 1. Install dependencies

From project root (test dependencies):

```bash
npm install
```

From backend folder (app server dependencies):

```bash
cd backend
npm install
```

### 2. Run the backend server

```bash
npm start
```

Server runs on:

- http://localhost:3000

### 3. Open the app

Visit:

- http://localhost:3000

### 4. Configure API key

Use the in-app Settings modal to save your Groq key, or set it via API.

Local backend stores key in backend/settings.json.

## Running Tests

From project root:

```bash
npm test
```

## Deployment (Vercel)

This repo is configured for Vercel via vercel.json:

- /api/* routes to api/index.js
- Frontend static files are served from frontend/

Important behavior on Vercel:

- Data is in-memory and ephemeral in api/index.js
- Use environment variable GROQ_API_KEY for reliable key configuration

## API Overview

### Health and Config

| Method | Endpoint | Description |
|---|---|---|
| GET | /api/health | Service health check |
| GET | /api/usage | Current token budget snapshot |
| POST | /api/settings/apikey | Save API key |
| GET | /api/settings/apikey/status | Check key configuration |

Compatibility aliases also exist in serverless API:

- POST /api/set-api-key
- GET /api/check-api-key

### Prompt Analysis and Crafting

| Method | Endpoint | Description |
|---|---|---|
| POST | /api/analyze | Analyze prompt and generate improved variants |
| POST | /api/craft-prompt | Build a high-quality prompt from an idea |

### History and Stats

| Method | Endpoint | Description |
|---|---|---|
| GET | /api/history | Fetch prompt history |
| GET | /api/history/:id | Fetch one history item |
| POST | /api/history/import | Import history entries |
| PATCH | /api/history/:id/save | Toggle saved state |
| DELETE | /api/history/:id | Delete one item |
| DELETE | /api/history | Clear all history |
| GET | /api/stats | Aggregated stats and chart data |

### Chat

| Method | Endpoint | Description |
|---|---|---|
| GET | /api/chat | Fetch chat history |
| DELETE | /api/chat | Clear chat history |
| POST | /api/chat/stream | Stream tutor response |

## Demo Mode (Presentation Safe)

If internet access or API quota is unreliable:

1. Open Settings
2. Enable Demo Mode
3. Use Craft, Library, Stats, and Chat with realistic mock behavior

Demo Mode is useful for classroom demos, evaluations, and offline showcases.

## Known Differences: Local vs Vercel

- Local backend (backend/server.js): JSON file persistence
- Vercel API (api/index.js): in-memory runtime data (resets on cold start/redeploy)

## 2-Minute Demo Script

1. Open Craft and analyze a sample prompt
2. Show score, missing elements, and improved variants
3. Save to Library and demonstrate search/filter
4. Open Stats and explain trend + element coverage
5. Ask Tutor Chat for prompt refinement advice

## License

No license file is currently included in this repository.
