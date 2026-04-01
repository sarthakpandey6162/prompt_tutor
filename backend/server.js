/* ========================================
   AI Prompt Tutor — Express Backend Server
   ======================================== */

const express = require('express');
const cors = require('cors');
const path = require('path');
const {
    initDatabase,
    saveAnalysis,
    findAnalysisByPrompt,
    getHistory,
    getHistoryById,
    deleteHistoryItem,
    clearHistory,
    getStats,
    getSetting,
    setSetting
} = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// ===== Middleware =====
app.use(cors());
app.use(express.json());

// Serve frontend static files
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ===== Initialize Database =====
initDatabase();

// ===== API Routes =====

// --- Set API Key ---
app.post('/api/settings/apikey', (req, res) => {
    const { apiKey } = req.body;
    if (!apiKey || apiKey.length < 20) {
        return res.status(400).json({ error: 'Invalid API key' });
    }
    setSetting('groq_api_key', apiKey);
    res.json({ success: true, message: 'API key saved' });
});

// --- Check API Key Status ---
app.get('/api/settings/apikey/status', (req, res) => {
    const key = getSetting('groq_api_key');
    res.json({ configured: !!key, hasKey: !!key });
});

// --- Analyze Prompt ---
app.post('/api/analyze', async (req, res) => {
    const { prompt } = req.body;

    if (!prompt || !prompt.trim()) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    const cleanPrompt = prompt.trim();
    const existing = findAnalysisByPrompt(cleanPrompt);
    if (existing) {
        return res.json({
            success: true,
            id: existing.id,
            analysis: existing
        });
    }

    const apiKey = getSetting('groq_api_key');
    if (!apiKey) {
        return res.status(400).json({ error: 'API key not configured. Please set your Groq API key first.' });
    }

    const systemPrompt = `You are a prompt analysis expert. Analyze the user's prompt and respond ONLY with valid JSON, no extra text:
{
  "score": <1-10>,
  "category": "<Analytical|Creative|Technical|Directive|Casual|Formal>",
  "scoreLabel": "<Needs Major Work|Good Foundation|Good Prompt|Strong Prompt|Professional-Grade>",
  "strengths": ["<point>", "<point>"],
  "missing": ["<point>", "<point>"],
  "proTips": [
    {"title": "<title>", "description": "<one sentence>"}
  ],
  "improved": {
    "default": "<improved prompt>",
    "developer": "<technical version>",
    "beginner": "<simple version>"
  }
}
Scoring: 1-3 weak, 4-6 needs work, 7-8 good, 9-10 expert.`;

    const requestBody = {
        model: "llama-3.1-8b-instant",
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Analyze this prompt:\n"""${prompt.trim()}"""` }
        ],
        temperature: 0.7,
        response_format: { type: "json_object" },
        max_tokens: 600
    };

    const fetchOptions = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
    };

    try {
        let response = await fetch(GROQ_API_URL, fetchOptions);

        // Single retry after 3s on rate limit
        if (response.status === 429) {
            console.log('Rate limit hit (429). Retrying in 3s...');
            await new Promise(r => setTimeout(r, 3000));
            response = await fetch(GROQ_API_URL, fetchOptions);
            if (response.status === 429) {
                return res.status(429).json({ error: 'API limit reached. Please wait a moment and try again.' });
            }
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            if (response.status === 401) return res.status(401).json({ error: 'Invalid API key. Please check your Groq API key.' });
            if (response.status === 429) return res.status(429).json({ error: 'Rate limit exceeded. Please wait a moment and try again.' });
            return res.status(response.status).json({ error: errorData?.error?.message || `API error (${response.status})` });
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content;

        if (!text) {
            return res.status(500).json({ error: 'No response from AI. Please try again.' });
        }

        let analysis;
        try {
            let cleanText = text.trim();
            if (cleanText.startsWith('```')) {
                cleanText = cleanText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
            }
            analysis = JSON.parse(cleanText);
        } catch (e) {
            console.error('JSON parse error:', e.message, '\nRaw response:', text.substring(0, 500));
            return res.status(500).json({ 
                error: 'The AI returned an invalid response. This can happen occasionally — please try again.',
                parseError: true 
            });
        }

        if (!analysis.score || !analysis.strengths) {
            return res.status(500).json({ error: 'Incomplete analysis received. Please try again.' });
        }

        // Normalize: support both old string format and new object format for improved
        if (typeof analysis.improved === 'string') {
            analysis.improved = {
                default: analysis.improved,
                developer: analysis.improvedDeveloper || analysis.improved,
                beginner: analysis.improvedBeginner || analysis.improved
            };
        }

        // Save to database
        const id = saveAnalysis(prompt.trim(), analysis);
        
        res.json({ 
            success: true, 
            id,
            analysis 
        });

    } catch (error) {
        console.error('Analysis error:', error);
        res.status(500).json({ error: error.message || 'Something went wrong. Please try again.' });
    }
});

// --- Get History ---
app.get('/api/history', (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const history = getHistory(limit);
    res.json(history);
});

// --- Get Single History Item ---
app.get('/api/history/:id', (req, res) => {
    const item = getHistoryById(parseInt(req.params.id));
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
});

// --- Delete History Item ---
app.delete('/api/history/:id', (req, res) => {
    deleteHistoryItem(parseInt(req.params.id));
    res.json({ success: true });
});

// --- Clear All History ---
app.delete('/api/history', (req, res) => {
    clearHistory();
    res.json({ success: true });
});

// --- Get Stats ---
app.get('/api/stats', (req, res) => {
    const stats = getStats();
    res.json(stats);
});

// --- Fallback: serve index.html for SPA ---
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// ===== Start Server =====
app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════╗
║   🚀 AI Prompt Tutor Server         ║
║   Running on http://localhost:${PORT}   ║
╚══════════════════════════════════════╝
    `);
});
