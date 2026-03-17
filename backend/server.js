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
    getRecentContext,
    getSetting,
    setSetting
} = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// ===== Utilities =====
async function fetchWithRetry(url, options, maxRetries = 3) {
    let delay = 1500; // start with 1.5s delay
    for (let i = 0; i < maxRetries; i++) {
        const response = await fetch(url, options);
        if (response.status === 429 && i < maxRetries - 1) {
            console.log(`Rate limit hit (429). Retrying in ${delay}ms... (Attempt ${i + 1} of ${maxRetries - 1})`);
            await new Promise(r => setTimeout(r, delay + Math.random() * 500)); // Add jitter
            delay *= 2; // exponential backoff
            continue;
        }
        return response;
    }
}

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

    // Get recent history for context
    const recentHistory = getRecentContext(5);
    let historyContext = '';

    if (recentHistory.length > 0) {
        historyContext = `\n\nThe user has analyzed ${recentHistory.length} prompts recently. Here's their history (most recent first):
${recentHistory.map((h, i) => `${i + 1}. Scored ${h.score}/10 ("${h.verdict}") — "${h.prompt}..." — Weaknesses: ${h.weaknesses.join(', ')}`).join('\n')}

Use this history to:
- Notice recurring weaknesses and emphasize those
- Acknowledge improvement if their score is getting better
- Avoid repeating the exact same tips from previous analyses
- Give personalized advice based on their patterns`;
    }

    const systemPrompt = `You are an expert prompt engineering tutor. Analyze the user's AI prompt and provide detailed, actionable feedback.

You MUST respond with ONLY valid JSON in this EXACT format (no markdown, no code blocks, just raw JSON):
{
  "score": <number 1-10>,
  "verdict": "<short 2-5 word verdict like 'Needs Major Work' or 'Good Foundation' or 'Excellent Prompt'>",
  "description": "<1-2 sentence summary of the overall quality>",
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "weaknesses": ["<weakness 1>", "<weakness 2>", "<weakness 3>"],
  "improved_prompt": "<the full, significantly improved version of their prompt demonstrating best practices>",
  "tips": [
    {"title": "<tip title>", "description": "<specific actionable tip>"},
    {"title": "<tip title>", "description": "<specific actionable tip>"},
    {"title": "<tip title>", "description": "<specific actionable tip>"}
  ]
}

Scoring guide:
- 1-3: Vague, no context, no specifics, no constraints
- 4-5: Some structure but missing key elements (role, format, constraints)
- 6-7: Good foundation with some specifics, could be improved
- 8-9: Well-structured with role, context, format, and constraints
- 10: Professional-grade prompt with everything perfect

Always provide at least 2 strengths (even for weak prompts, find something positive) and at least 2 weaknesses (even for strong prompts). The improved prompt should be significantly better and teach by example.${historyContext}`;

    try {
        const response = await fetchWithRetry(GROQ_API_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "llama-3.1-8b-instant",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: `User's prompt to analyze:\n"""${prompt.trim()}"""` }
                ],
                temperature: 0.7,
                response_format: { type: "json_object" },
                max_tokens: 4000
            })
        });

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
            console.error('Parse error:', e, 'Raw:', text);
            return res.status(500).json({ error: 'Unexpected AI response format. Please try again.' });
        }

        if (!analysis.score || !analysis.strengths || !analysis.weaknesses || !analysis.improved_prompt) {
            return res.status(500).json({ error: 'Incomplete analysis received. Please try again.' });
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
