const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../api/index');

test('GET /api/health returns ok', async () => {
    const res = await request(app).get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
});

test('POST /api/history/import validates payload', async () => {
    const res = await request(app)
        .post('/api/history/import')
        .send({ prompts: [] });

    assert.equal(res.status, 400);
    assert.match(res.body.error || '', /prompts array is required/i);
});

test('POST /api/history/import merges valid prompts', async () => {
    await request(app).delete('/api/history');

    const payload = {
        prompts: [
            {
                id: 111,
                prompt_text: 'Write a haiku about clean code.',
                score: 8,
                category: 'Creative',
                created_at: new Date().toISOString()
            }
        ]
    };

    const importRes = await request(app)
        .post('/api/history/import')
        .send(payload);

    assert.equal(importRes.status, 200);
    assert.equal(importRes.body.success, true);
    assert.equal(importRes.body.imported, 1);

    const historyRes = await request(app).get('/api/history');
    assert.equal(historyRes.status, 200);
    assert.equal(Array.isArray(historyRes.body), true);
    assert.equal(historyRes.body.length >= 1, true);
    assert.equal(historyRes.body[0].prompt_text, 'Write a haiku about clean code.');
});

test('GET /api/stats returns expected shape', async () => {
    const res = await request(app).get('/api/stats');
    assert.equal(res.status, 200);
    assert.equal(typeof res.body.totalAnalyzed, 'number');
    assert.equal(typeof res.body.averageScore, 'number');
    assert.equal(typeof res.body.bestScore, 'number');
    assert.equal(typeof res.body.trend, 'string');
    assert.equal(Array.isArray(res.body.scoreHistory), true);
    assert.equal(typeof res.body.elementUsage, 'object');
});

test('DELETE /api/history clears imported prompts', async () => {
    const importRes = await request(app)
        .post('/api/history/import')
        .send({
            prompts: [
                { id: 222, prompt_text: 'Test prompt one', score: 6, created_at: new Date().toISOString() },
                { id: 223, prompt_text: 'Test prompt two', score: 9, created_at: new Date().toISOString() }
            ]
        });
    assert.equal(importRes.status, 200);

    const clearRes = await request(app).delete('/api/history');
    assert.equal(clearRes.status, 200);
    assert.equal(clearRes.body.success, true);

    const historyRes = await request(app).get('/api/history');
    assert.equal(historyRes.status, 200);
    assert.equal(Array.isArray(historyRes.body), true);
    assert.equal(historyRes.body.length, 0);
});
