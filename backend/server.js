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
    setSetting,
    toggleSave,
    importHistory,
    getChatHistory,
    addChatMessage,
    clearChatHistory
} = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const TOKEN_LIMIT_PER_MINUTE = 6000;
const usageWindow = [];
const MODE_PROFILES = {
    quick: { maxTokens: 280, temperature: 0.45 },
    balanced: { maxTokens: 520, temperature: 0.65 },
    deep: { maxTokens: 760, temperature: 0.8 }
};

function pruneUsageWindow() {
    const cutoff = Date.now() - 60_000;
    while (usageWindow.length && usageWindow[0].ts < cutoff) usageWindow.shift();
}

function getCurrentUsage() {
    pruneUsageWindow();
    return usageWindow.reduce((sum, entry) => sum + (entry.tokens || 0), 0);
}

function getBudgetSnapshot(extraReserved = 0) {
    const used = getCurrentUsage();
    const remaining = Math.max(0, TOKEN_LIMIT_PER_MINUTE - used - extraReserved);
    const oldest = usageWindow[0];
    const resetsInMs = oldest ? Math.max(0, 60_000 - (Date.now() - oldest.ts)) : 0;
    return { limit: TOKEN_LIMIT_PER_MINUTE, used, remaining, resetsInMs };
}

function estimateRequestTokens(prompt, modeProfile) {
    const inputTokens = Math.ceil((String(prompt || '').length + 900) / 4);
    return inputTokens + (modeProfile?.maxTokens || MODE_PROFILES.balanced.maxTokens);
}

function consumeTokens(tokens) {
    const safe = Math.max(0, Math.round(Number(tokens) || 0));
    usageWindow.push({ ts: Date.now(), tokens: safe });
    pruneUsageWindow();
}

// ===== Middleware =====
app.use(cors());
app.use(express.json({ limit: '1mb' }));

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

app.get('/api/usage', (req, res) => {
    res.json(getBudgetSnapshot());
});

// --- Analyze Prompt ---
app.post('/api/analyze', async (req, res) => {
    const { prompt, mode, model } = req.body;

    if (!prompt || !prompt.trim()) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    if (prompt.trim().length > 8000) {
        return res.status(400).json({ error: 'Prompt too long. Keep it under 8000 characters.' });
    }

    const cleanPrompt = prompt.trim();
    const selectedMode = MODE_PROFILES[mode] ? mode : 'balanced';
    const profile = MODE_PROFILES[selectedMode];

    const estimatedTokens = estimateRequestTokens(cleanPrompt, profile);
    const budgetBefore = getBudgetSnapshot();
    if (budgetBefore.remaining < estimatedTokens) {
        return res.status(429).json({
            error: 'Token budget low. Try Quick mode or wait for reset.',
            budget: budgetBefore,
            estimatedTokens,
            mode: selectedMode
        });
    }

    const existing = findAnalysisByPrompt(cleanPrompt);
    if (existing) {
        return res.json({
            success: true,
            id: existing.id,
            analysis: existing,
            cached: true,
            mode: selectedMode,
            budget: getBudgetSnapshot()
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
        model: model || "llama-3.1-8b-instant",
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Analyze this prompt:\n"""${prompt.trim()}"""` }
        ],
        temperature: profile.temperature,
        response_format: { type: "json_object" },
        max_tokens: profile.maxTokens
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
        const usageTokens = data?.usage?.total_tokens || estimatedTokens;
        consumeTokens(usageTokens);

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
            analysis,
            cached: false,
            mode: selectedMode,
            tokenUsage: usageTokens,
            budget: getBudgetSnapshot()
        });

    } catch (error) {
        console.error('Analysis error:', error);
        res.status(500).json({ error: error.message || 'Something went wrong. Please try again.' });
    }
});

// --- Craft Prompt from Idea ---
app.post('/api/craft-prompt', async (req, res) => {
    const { idea, tone, audience, format } = req.body;

    if (!idea || !idea.trim()) {
        return res.status(400).json({ error: 'An idea is required' });
    }

    if (idea.trim().length > 2000) {
        return res.status(400).json({ error: 'Idea too long. Keep it under 2000 characters.' });
    }

    const apiKey = getSetting('groq_api_key');
    if (!apiKey) {
        return res.status(400).json({ error: 'API key not configured. Please set your Groq API key first.' });
    }

    const estimatedTokens = estimateRequestTokens(idea, MODE_PROFILES.balanced);
    const budget = getBudgetSnapshot();
    if (budget.remaining < estimatedTokens) {
        return res.status(429).json({
            error: 'Token budget low. Please wait a moment and try again.',
            budget
        });
    }

    const toneHint = tone ? `Tone: ${tone}.` : '';
    const audienceHint = audience ? `Target audience: ${audience}.` : '';
    const formatHint = format ? `Desired output format: ${format}.` : '';

    const systemPrompt = `You are an expert prompt engineer. The user will give you a rough idea or goal. Your job is to craft a highly effective, well-structured AI prompt from that idea.

Rules:
- The prompt should be specific, actionable, and include role, context, constraints, and output format where applicable.
- Make it professional-grade quality (score 8+/10 on prompt engineering standards).
- ${toneHint} ${audienceHint} ${formatHint}

Respond ONLY with valid JSON:
{
  "prompt": "<the crafted prompt>",
  "title": "<short 3-5 word title for this prompt>",
  "tips": ["<tip about why this structure works>", "<another tip>"]
}`;

    try {
        let response = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "llama-3.1-8b-instant",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: `Craft a prompt from this idea:\n"""${idea.trim()}"""` }
                ],
                temperature: 0.7,
                response_format: { type: "json_object" },
                max_tokens: 600
            })
        });

        if (response.status === 429) {
            await new Promise(r => setTimeout(r, 3000));
            response = await fetch(GROQ_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: "llama-3.1-8b-instant",
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: `Craft a prompt from this idea:\n"""${idea.trim()}"""` }
                    ],
                    temperature: 0.7,
                    response_format: { type: "json_object" },
                    max_tokens: 600
                })
            });
            if (response.status === 429) {
                return res.status(429).json({ error: 'API limit reached. Please wait and try again.' });
            }
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            return res.status(response.status).json({ error: errorData?.error?.message || `API error (${response.status})` });
        }

        const data = await response.json();
        const usageTokens = data?.usage?.total_tokens || estimatedTokens;
        consumeTokens(usageTokens);

        const text = data.choices?.[0]?.message?.content;
        if (!text) {
            return res.status(500).json({ error: 'No response from AI. Please try again.' });
        }

        let result;
        try {
            let cleanText = text.trim();
            if (cleanText.startsWith('```')) {
                cleanText = cleanText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
            }
            result = JSON.parse(cleanText);
        } catch (e) {
            return res.status(500).json({ error: 'Invalid AI response. Please try again.' });
        }

        res.json({
            success: true,
            ...result,
            budget: getBudgetSnapshot()
        });

    } catch (error) {
        console.error('Craft prompt error:', error);
        res.status(500).json({ error: error.message || 'Something went wrong.' });
    }
});

// --- Get History ---
app.get('/api/history', (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const history = getHistory(limit);
    res.json(history);
});

// --- Import History ---
app.post('/api/history/import', (req, res) => {
    const { prompts, mode } = req.body || {};
    if (!Array.isArray(prompts) || prompts.length === 0) {
        return res.status(400).json({ error: 'prompts array is required' });
    }

    const imported = importHistory(prompts, mode === 'replace' ? 'replace' : 'merge');
    res.json({ success: true, imported });
});

// --- Get Single History Item ---
app.get('/api/history/:id', (req, res) => {
    const item = getHistoryById(parseInt(req.params.id));
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
});

// --- Toggle Save Prompts ---
app.patch('/api/history/:id/save', (req, res) => {
    const isSaved = toggleSave(parseInt(req.params.id));
    if (isSaved === null) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true, isSaved });
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

// --- Chat Endpoints ---
app.get('/api/chat', (req, res) => {
    res.json(getChatHistory());
});

app.delete('/api/chat', (req, res) => {
    clearChatHistory();
    res.json({ success: true });
});

app.post('/api/chat/stream', async (req, res) => {
    const { messages, model } = req.body;
    
    if (!messages || !messages.length) return res.status(400).json({ error: 'No messages provided' });

    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.role === 'user') {
        addChatMessage('user', lastMsg.content);
    }

    const apiKey = getSetting('groq_api_key');
    if (!apiKey) {
        return res.status(400).json({ error: 'API key not configured. Please set your Groq API key first.' });
    }

    const selectedModel = model || 'llama-3.1-8b-instant';

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
        const fetchResponse = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: selectedModel,
                messages: messages,
                stream: true,
                temperature: 0.7,
                max_tokens: 1500
            })
        });

        if (!fetchResponse.ok) {
            const err = await fetchResponse.json().catch(()=>({}));
            res.write(`data: ${JSON.stringify({ error: err?.error?.message || 'API Error' })}\n\n`);
            return res.end();
        }

        let fullAiText = '';
        const reader = fetchResponse.body.getReader();
        const decoder = new TextDecoder();
        
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            for (const line of lines) {
                if (line.startsWith('data: ') && line !== 'data: [DONE]') { // Note: [DONE] is handled below if needed, but OpenAI spec sends data: [DONE]
                    try {
                        let jsonStr = line.substring(6).trim();
                        if (jsonStr === '[DONE]') continue;
                        const parsed = JSON.parse(jsonStr);
                        const content = parsed.choices[0]?.delta?.content || '';
                        if (content) {
                            fullAiText += content;
                            res.write(`data: ${JSON.stringify({ content })}\n\n`);
                        }
                    } catch (e) {}
                }
            }
        }

        addChatMessage('assistant', fullAiText);
        res.write('data: [DONE]\n\n');
        res.end();

    } catch (err) {
        console.error('Stream error:', err);
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        res.end();
    }
});

app.get('/api/health', (req, res) => {
    res.json({ ok: true });
});

// --- Fallback: serve index.html for SPA ---
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

module.exports = app;

// ===== Start Server =====
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`
╔══════════════════════════════════════╗
║   🚀 AI Prompt Tutor Server         ║
║   Running on http://localhost:${PORT}   ║
╚══════════════════════════════════════╝
    `);
    });
}
