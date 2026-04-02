const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// In-memory storage (Vercel serverless = ephemeral filesystem)
let promptHistory = [];
let settings = {};
let chatHistory = [];
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

function detectPromptElements(text) {
    const t = String(text || '');
    return {
        role: /act as|you are a?|persona|pretend|role|as a|expert|assistant|developer|scientist|writer|teacher|coach/i.test(t),
        format: /\b(json|markdown|table|csv|format|output|structure|code block|email|report|essay|html|xml|numbered list|bullet(?: points?)?|step-by-step)\b|(?:return|respond|output)\s+(?:in|as)\s+(?:a|an)?\s*(?:json|table|list|markdown|csv)/i.test(t),
        constraints: /\b(limit|max|must|exactly|no more|at least|words|under|avoid|don't|do not|never|only|restrict|constraint|edge case(?:s)?|handle edge|including edge)\b/i.test(t),
        examples: /example|sample|for instance|input:|output:|e\.g\.|demonstrate|like this|such as/i.test(t),
        context: /context|background|situation|scenario|given that|assuming|based on|the goal|objective|purpose|audience|for (?:a|an) [\w\s-]+ (?:student|beginner)|target audience/i.test(t)
    };
}

function getApiKey() {
    return process.env.GROQ_API_KEY || settings.groq_api_key;
}

// --- API Key Management ---
app.post('/api/set-api-key', (req, res) => {
    const { apiKey } = req.body;
    if (!apiKey || apiKey.length < 20) return res.status(400).json({ error: 'Invalid API key' });
    settings.groq_api_key = apiKey;
    res.json({ message: 'API key saved successfully' });
});

app.get('/api/check-api-key', (req, res) => {
    // Check environment variable first, then in-memory
    const hasKey = !!(process.env.GROQ_API_KEY || settings.groq_api_key);
    res.json({ hasKey });
});

// Settings compatibility aliases
app.post('/api/settings/apikey', (req, res) => {
    const { apiKey } = req.body;
    if (!apiKey || apiKey.length < 20) return res.status(400).json({ error: 'Invalid API key' });
    settings.groq_api_key = apiKey;
    res.json({ success: true, message: 'Saved' });
});

app.get('/api/settings/apikey/status', (req, res) => {
    const configured = !!(process.env.GROQ_API_KEY || settings.groq_api_key);
    res.json({ configured, hasKey: configured });
});

app.get('/api/usage', (req, res) => {
    res.json(getBudgetSnapshot());
});

// --- Craft Prompt From Idea ---
app.post('/api/craft-prompt', async (req, res) => {
    try {
        const { idea, tone, audience, format } = req.body || {};
        if (!idea || !idea.trim()) return res.status(400).json({ error: 'An idea is required' });
        if (idea.trim().length > 2000) return res.status(400).json({ error: 'Idea too long. Keep it under 2000 characters.' });

        const apiKey = getApiKey();
        if (!apiKey) return res.status(400).json({ error: 'API key not configured' });

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

        let response = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'llama-3.1-8b-instant',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `Craft a prompt from this idea:\n"""${idea.trim()}"""` }
                ],
                temperature: 0.7,
                response_format: { type: 'json_object' },
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
                    model: 'llama-3.1-8b-instant',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: `Craft a prompt from this idea:\n"""${idea.trim()}"""` }
                    ],
                    temperature: 0.7,
                    response_format: { type: 'json_object' },
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
        if (!text) return res.status(500).json({ error: 'No response from AI. Please try again.' });

        let result;
        try {
            let cleanText = text.trim();
            if (cleanText.startsWith('```')) {
                cleanText = cleanText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
            }
            result = JSON.parse(cleanText);
        } catch {
            return res.status(500).json({ error: 'Invalid AI response. Please try again.' });
        }

        res.json({ success: true, ...result, budget: getBudgetSnapshot() });
    } catch (error) {
        console.error('Craft prompt error:', error);
        res.status(500).json({ error: error.message || 'Something went wrong.' });
    }
});

// --- Prompt Analysis ---
app.post('/api/analyze', async (req, res) => {
    try {
        const { prompt, mode } = req.body;
        if (!prompt || !prompt.trim()) return res.status(400).json({ error: 'Prompt is required' });
        if (prompt.trim().length > 8000) return res.status(400).json({ error: 'Prompt too long. Keep it under 8000 characters.' });

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

        const apiKey = getApiKey();
        if (!apiKey) return res.status(400).json({ error: 'API key not configured' });

        const existing = promptHistory.find(p => p.prompt_text === cleanPrompt);
        if (existing) {
            return res.json({ success: true, id: existing.id, analysis: existing, cached: true, mode: selectedMode, budget: getBudgetSnapshot() });
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
            model: 'llama-3.1-8b-instant',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Analyze this prompt:\n"""${cleanPrompt}"""` }
            ],
            temperature: profile.temperature,
            response_format: { type: 'json_object' },
            max_tokens: profile.maxTokens
        };

        const fetchOptions = {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        };

        let response = await fetch(GROQ_API_URL, fetchOptions);

        if (response.status === 429) {
            await new Promise(r => setTimeout(r, 3000));
            response = await fetch(GROQ_API_URL, fetchOptions);
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            if (response.status === 401) return res.status(401).json({ error: 'Invalid API key. Please check your Groq API key.' });
            if (response.status === 429) return res.status(429).json({ error: 'Rate limit exceeded. Please wait and try again.' });
            throw new Error(errorData.error?.message || `API error: ${response.status}`);
        }

        const data = await response.json();
        const usageTokens = data?.usage?.total_tokens || estimatedTokens;
        consumeTokens(usageTokens);
        const content = data.choices[0]?.message?.content;

        if (!content) throw new Error('Empty response from AI');

        let analysis;
        try {
            let cleanText = content.trim();
            if (cleanText.startsWith('```')) {
                cleanText = cleanText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
            }
            analysis = JSON.parse(cleanText);
        } catch {
            throw new Error('Invalid analysis format returned by model.');
        }

        if (typeof analysis.improved === 'string') {
            analysis.improved = {
                default: analysis.improved,
                developer: analysis.improvedDeveloper || analysis.improved,
                beginner: analysis.improvedBeginner || analysis.improved
            };
        }

        const tips = analysis.proTips || analysis.tips || [];
        const improvedDefault = analysis.improved?.default || analysis.improved || analysis.improved_prompt || '';
        const improvedDeveloper = analysis.improved?.developer || analysis.improvedDeveloper || improvedDefault;
        const improvedBeginner = analysis.improved?.beginner || analysis.improvedBeginner || improvedDefault;

        const inferredElements = analysis.elements && Object.values(analysis.elements).some(Boolean)
            ? analysis.elements
            : detectPromptElements(cleanPrompt);

        const entry = {
            id: Date.now(),
            prompt_text: cleanPrompt,
            score: analysis.score || 0,
            category: analysis.category || analysis.label || analysis.verdict || '',
            scoreLabel: analysis.scoreLabel || analysis.label || '',
            tone: analysis.tone || '',
            elements: inferredElements,
            strengths: analysis.strengths || [],
            missing: analysis.missing || analysis.weaknesses || [],
            tips,
            improved: improvedDefault,
            improvedDeveloper,
            improvedBeginner,
            isSaved: false,
            created_at: new Date().toISOString()
        };

        promptHistory.unshift(entry);
        if (promptHistory.length > 200) promptHistory = promptHistory.slice(0, 200);

        res.json({ success: true, id: entry.id, analysis: entry, cached: false, mode: selectedMode, tokenUsage: usageTokens, budget: getBudgetSnapshot() });
    } catch (error) {
        console.error('Analysis error:', error);
        res.status(500).json({ error: error.message });
    }
});

// --- History ---
app.get('/api/history', (req, res) => {
    res.json(promptHistory);
});

app.post('/api/history/import', (req, res) => {
    const { prompts, mode } = req.body || {};
    if (!Array.isArray(prompts) || prompts.length === 0) {
        return res.status(400).json({ error: 'prompts array is required' });
    }

    if (mode === 'replace') {
        promptHistory = [];
    }

    const seen = new Set(promptHistory.map(p => `${p.prompt_text}::${p.created_at}`));
    let imported = 0;

    prompts.forEach((raw) => {
        if (!raw || typeof raw !== 'object') return;
        const promptText = String(raw.prompt_text || '').trim();
        if (!promptText) return;

        const createdAt = raw.created_at || new Date().toISOString();
        const key = `${promptText}::${createdAt}`;
        if (seen.has(key)) return;

        const cleanScore = parseFloat(String(raw.score).split('/')[0]);
        const score = Number.isFinite(cleanScore) ? Math.max(0, Math.min(10, cleanScore)) : 0;

        const normalizedElements = raw.elements && Object.values(raw.elements).some(Boolean)
            ? raw.elements
            : detectPromptElements(promptText);

        promptHistory.push({
            id: Number(raw.id) || Date.now() + imported,
            prompt_text: promptText,
            score,
            category: raw.category || raw.label || raw.verdict || '',
            scoreLabel: raw.scoreLabel || raw.label || '',
            tone: raw.tone || '',
            elements: normalizedElements,
            strengths: Array.isArray(raw.strengths) ? raw.strengths : [],
            missing: Array.isArray(raw.missing) ? raw.missing : (Array.isArray(raw.weaknesses) ? raw.weaknesses : []),
            tips: Array.isArray(raw.tips) ? raw.tips : (Array.isArray(raw.proTips) ? raw.proTips : []),
            improved: raw.improved || raw.improved_prompt || '',
            improvedDeveloper: raw.improvedDeveloper || raw.improved || raw.improved_prompt || '',
            improvedBeginner: raw.improvedBeginner || raw.improved || raw.improved_prompt || '',
            isSaved: !!raw.isSaved,
            created_at: createdAt
        });

        seen.add(key);
        imported += 1;
    });

    promptHistory.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json({ success: true, imported });
});

app.get('/api/history/:id', (req, res) => {
    const id = Number(req.params.id);
    const item = promptHistory.find(p => Number(p.id) === id);
    if(item) {
        res.json(item);
    } else {
        res.status(404).json({ error: 'Not found' });
    }
});

app.patch('/api/history/:id/save', (req, res) => {
    const id = Number(req.params.id);
    const item = promptHistory.find(p => Number(p.id) === id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    item.isSaved = !item.isSaved;
    res.json({ success: true, isSaved: item.isSaved });
});

app.delete('/api/history/:id', (req, res) => {
    const id = Number(req.params.id);
    promptHistory = promptHistory.filter(p => Number(p.id) !== id);
    res.json({ success: true, message: 'Deleted' });
});

app.delete('/api/history', (req, res) => {
    promptHistory = [];
    res.json({ success: true, message: 'History cleared' });
});

// --- Chat ---
app.get('/api/chat', (req, res) => {
    res.json(chatHistory);
});

app.delete('/api/chat', (req, res) => {
    chatHistory = [];
    res.json({ success: true });
});

app.post('/api/chat/stream', async (req, res) => {
    try {
        const { messages, model } = req.body || {};
        if (!Array.isArray(messages) || !messages.length) {
            return res.status(400).json({ error: 'No messages provided' });
        }

        const lastMsg = messages[messages.length - 1];
        if (lastMsg && lastMsg.role === 'user') {
            chatHistory.push({ role: 'user', content: String(lastMsg.content || ''), ts: Date.now() });
            if (chatHistory.length > 400) chatHistory = chatHistory.slice(-400);
        }

        const apiKey = getApiKey();
        if (!apiKey) return res.status(400).json({ error: 'API key not configured' });

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const response = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model || 'llama-3.1-8b-instant',
                messages,
                stream: true,
                temperature: 0.7,
                max_tokens: 1500
            })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            res.write(`data: ${JSON.stringify({ error: err?.error?.message || 'API Error' })}\n\n`);
            return res.end();
        }

        let fullAiText = '';
        let buffer = '';
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const events = buffer.split('\n\n');
            buffer = events.pop() || '';

            for (const event of events) {
                const line = event.split('\n').find(l => l.startsWith('data: '));
                if (!line) continue;

                const payload = line.substring(6).trim();
                if (payload === '[DONE]') continue;

                try {
                    const parsed = JSON.parse(payload);
                    const content = parsed.choices?.[0]?.delta?.content || '';
                    if (content) {
                        fullAiText += content;
                        res.write(`data: ${JSON.stringify({ content })}\n\n`);
                    }
                } catch {
                    // Ignore partial/incomplete chunks
                }
            }
        }

        chatHistory.push({ role: 'assistant', content: fullAiText, ts: Date.now() });
        if (chatHistory.length > 400) chatHistory = chatHistory.slice(-400);

        res.write('data: [DONE]\n\n');
        res.end();
    } catch (err) {
        console.error('Chat stream error:', err);
        res.write(`data: ${JSON.stringify({ error: err.message || 'Chat error' })}\n\n`);
        res.end();
    }
});

// --- Stats ---
app.get('/api/stats', (req, res) => {
    if (!promptHistory.length) {
        return res.json({
            totalAnalyzed: 0,
            averageScore: 0,
            bestScore: 0,
            trend: 'neutral',
            scoreHistory: [],
            elementUsage: { role: 0, format: 0, constraints: 0, examples: 0, context: 0 }
        });
    }

    const parsed = promptHistory.map(p => ({
        ...p,
        cleanScore: parseFloat(String(p.score).split('/')[0]) || 0,
        cleanDate: p.created_at || new Date().toISOString()
    }));

    const totalAnalyzed = parsed.length;
    const scores = parsed.map(p => p.cleanScore);
    const averageScore = Math.round((scores.reduce((a, b) => a + b, 0) / totalAnalyzed) * 10) / 10;
    const bestScore = Math.max(...scores);

    const recent = parsed.slice(0, 5).map(p => p.cleanScore);
    const older = parsed.slice(5, 10).map(p => p.cleanScore);
    let trend = 'neutral';
    if (recent.length && older.length) {
        const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
        const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
        if (recentAvg > olderAvg + 0.5) trend = 'improving';
        else if (recentAvg < olderAvg - 0.5) trend = 'declining';
    }

    const scoreHistory = parsed.slice(0, 20).reverse().map(p => ({
        score: p.cleanScore,
        date: p.cleanDate,
        label: p.category || p.label || p.verdict || ''
    }));

    const elementUsage = { role: 0, format: 0, constraints: 0, examples: 0, context: 0 };
    parsed.forEach(p => {
        const el = p.elements && Object.values(p.elements).some(Boolean)
            ? p.elements
            : detectPromptElements(p.prompt_text);
        if (el.role) elementUsage.role++;
        if (el.format) elementUsage.format++;
        if (el.constraints) elementUsage.constraints++;
        if (el.examples) elementUsage.examples++;
        if (el.context) elementUsage.context++;
    });

    res.json({ totalAnalyzed, averageScore, bestScore, trend, scoreHistory, elementUsage });
});

app.get('/api/health', (req, res) => {
    res.json({ ok: true });
});

// Export for Vercel
module.exports = app;

// Local testing fallback
if (require.main === module) {
    app.listen(3000, () => {
        console.log('API Server running on http://localhost:3000');
    });
}
