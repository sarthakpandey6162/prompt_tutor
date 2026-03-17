const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// In-memory storage (Vercel serverless = ephemeral filesystem)
let promptHistory = [];
let settings = {};

// --- API Key Management ---
app.post('/api/set-api-key', (req, res) => {
    const { apiKey } = req.body;
    if (!apiKey) return res.status(400).json({ error: 'API key is required' });
    settings.groq_api_key = apiKey;
    res.json({ message: 'API key saved successfully' });
});

app.get('/api/check-api-key', (req, res) => {
    // Check environment variable first, then in-memory
    const hasKey = !!(process.env.GROQ_API_KEY || settings.groq_api_key);
    res.json({ hasKey });
});

// --- Prompt Analysis ---
app.post('/api/analyze', async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

        const apiKey = process.env.GROQ_API_KEY || settings.groq_api_key;
        if (!apiKey) return res.status(400).json({ error: 'API key not configured' });

        const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

        const systemPrompt = `You are an expert AI prompt engineer. Analyze the given prompt and provide feedback in the following JSON format only. Do not include any text outside the JSON:
{
    "score": <number 1-10>,
    "verdict": "<short verdict like 'Excellent Prompt' or 'Needs Major Work'>",
    "description": "<1-2 sentence analysis>",
    "strengths": ["<strength 1>", "<strength 2>"],
    "weaknesses": ["<weakness 1>", "<weakness 2>"],
    "improved_prompt": "<your improved version of the prompt>",
    "tips": [
        {"title": "<tip title>", "description": "<tip description>"},
        {"title": "<tip title>", "description": "<tip description>"}
    ]
}`;

        const response = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.1-8b-instant',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `Analyze this prompt:\n\n"${prompt}"` }
                ],
                temperature: 0.7,
                max_tokens: 4000
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `API error: ${response.status}`);
        }

        const data = await response.json();
        const content = data.choices[0]?.message?.content;

        if (!content) throw new Error('Empty response from AI');

        // Parse JSON from response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('Incomplete analysis received. Please try again.');

        const analysis = JSON.parse(jsonMatch[0]);

        // Store in memory
        const entry = {
            id: Date.now().toString(),
            prompt: prompt.substring(0, 200),
            score: analysis.score || 0,
            analysis,
            timestamp: new Date().toISOString()
        };
        promptHistory.unshift(entry);
        if (promptHistory.length > 50) promptHistory = promptHistory.slice(0, 50);

        res.json({ analysis });
    } catch (error) {
        console.error('Analysis error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// --- History ---
app.get('/api/history', (req, res) => {
    res.json(promptHistory);
});

app.delete('/api/history/:id', (req, res) => {
    promptHistory = promptHistory.filter(p => p.id !== req.params.id);
    res.json({ message: 'Deleted' });
});

app.delete('/api/history', (req, res) => {
    promptHistory = [];
    res.json({ message: 'History cleared' });
});

// --- Stats ---
app.get('/api/stats', (req, res) => {
    const total = promptHistory.length;
    const avg = total > 0
        ? (promptHistory.reduce((sum, p) => sum + (p.score || 0), 0) / total).toFixed(1)
        : '0.0';
    res.json({ totalPrompts: total, averageScore: parseFloat(avg) });
});

// Export for Vercel
module.exports = app;
