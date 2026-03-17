# ✨ AI Prompt Tutor

AI-powered prompt analysis tool that rates, reviews, and improves your AI prompts — with history tracking and personalized feedback.

## Features

- 🎯 **Prompt Rating** — Score from 1-10 with animated gauge
- 💪 **Strengths & Weaknesses** — Detailed breakdown
- 🚀 **Improved Prompt** — AI generates a better version (copy with one click)
- 💡 **Pro Tips** — Specific actionable advice
- 📜 **Prompt History** — All past analyses stored in SQLite database
- 📊 **Stats Dashboard** — Track your progress (average score, trend, best score)
- 🧠 **Smart Reviews** — AI uses your history to give personalized, non-repetitive feedback
- 🎓 **Cheat Sheet** — Built-in prompt engineering guide

## Tech Stack

- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Node.js + Express
- **Database**: SQLite (via better-sqlite3)
- **AI**: Google Gemini 2.0 Flash API

## Setup

```bash
# 1. Install dependencies
cd backend
npm install

# 2. Start the server
npm start

# 3. Open in browser
# Go to http://localhost:3000

# 4. Add your free Gemini API key
# Click the 🔑 icon → paste your key from https://aistudio.google.com/apikey
```

## Project Structure

```
ai prompt/
├── backend/
│   ├── server.js       ← Express API server
│   ├── database.js     ← SQLite database layer
│   ├── package.json    ← Dependencies
│   └── prompts.db      ← Database (auto-created)
├── frontend/
│   ├── index.html      ← Main page
│   ├── style.css       ← Light theme styles
│   └── app.js          ← Frontend logic
├── .gitignore
└── README.md
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/analyze` | Analyze a prompt |
| GET | `/api/history` | Get prompt history |
| GET | `/api/history/:id` | Get single analysis |
| DELETE | `/api/history/:id` | Delete analysis |
| DELETE | `/api/history` | Clear all history |
| GET | `/api/stats` | Get score statistics |
| POST | `/api/settings/apikey` | Save API key |
| GET | `/api/settings/apikey/status` | Check if key is set |
