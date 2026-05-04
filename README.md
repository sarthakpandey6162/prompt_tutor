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
- ML Models: PyTorch + Flask API
- AI Provider: Groq Chat Completions API
- Charts: Chart.js
- Storage: Persistent JSON files (designed for persistent disks)

## Project Structure

```text
.
├─ backend/             # Node.js/Express server with JSON file persistence
├─ frontend/            # Web UI
├─ ml_models/           # PyTorch Models & Flask API
├─ tests/               # API integration tests
├─ package.json         # Root scripts
├─ render.yaml          # Render Blueprint infrastructure config
└─ README.md
```

## Quick Start (Local)

### 1. Install dependencies

From backend folder (Node.js server):

```bash
cd backend
npm install
```

From ML folder (Python ML service):

```bash
cd ml_models
pip install -r requirements.txt
```

### 2. Run the servers

Run the backend server (Terminal 1):

```bash
npm start
```

Run the ML server (Terminal 2):

```bash
cd ml_models
python serve.py
```

### 3. Open the app

Visit:

- http://localhost:3000

### 4. Configure API key

Use the in-app Settings modal to save your Groq key, or set it via environment variables (`GROQ_API_KEY`).

## Hybrid ML Heuristic Engine

The local ML prediction engine uses a powerful **hybrid** approach to ensure professional-grade, API-level scoring locally:
1. **Raw Predictions:** It queries the custom PyTorch BiLSTM and CNN models.
2. **Regex Augmentation:** It intercepts the predictions and uses advanced Regular Expressions to guarantee perfect detection of specific elements (like JSON formats or constrained word counts).
3. **Structural Blending:** The engine calculates a secondary score based on writing quality (sentence count, formatting, detail) and blends it 60/40 with the calibrated PyTorch score.

This guarantees high-quality, realistic feedback without needing thousands of hours of retraining!

## Deployment (Render)

This repository is fully configured to be deployed on [Render](https://render.com) using the included `render.yaml` Blueprint.

Unlike Vercel, Render supports **Persistent Disks** (so you don't lose your chat history) and **Background Workers** (so you can easily run the PyTorch models).

### How to deploy:
1. Go to your [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** and select **Blueprint**.
3. Connect your GitHub repository.
4. Click **Apply**.

Render will automatically provision two services:
1. **prompt-tutor-ml:** A Python web service running the ML models via Gunicorn.
2. **prompt-tutor-web:** A Node.js web service running your backend, connected automatically to the ML service and a persistent `/data` disk.

*Note: Make sure to add your `GROQ_API_KEY` in the Render Environment Variables tab after the setup completes.*

## API Overview

### Health and Config

| Method | Endpoint | Description |
|---|---|---|
| GET | /api/health | Service health check |
| GET | /api/ml/health | ML Service health check |
| GET | /api/usage | Current token budget snapshot |

### Prompt Analysis and Crafting

| Method | Endpoint | Description |
|---|---|---|
| POST | /api/analyze | Analyze prompt and generate improved variants |
| POST | /api/craft-prompt | Build a high-quality prompt from an idea |
| POST | /api/ml/test | Compare ML model to API benchmark |

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
