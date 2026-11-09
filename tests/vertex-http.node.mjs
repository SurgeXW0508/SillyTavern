// Core-only real HTTP routing. No plugin installation or compatibility patch.
import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import https from 'node:https';
import { Readable } from 'node:stream';
import express from 'express';
import { setTimeout as sleep } from 'node:timers/promises';
import { setConfigFilePath } from '../src/util.js';
const root = await fs.mkdtemp(path.join(os.tmpdir(), 'vertex-core-http-'));
const oldHttpAgent = http.globalAgent, oldHttpsAgent = https.globalAgent;
let server, provider, origin, providerOrigin, readVertexSse;
const calls = new Map(); let disconnects = 0;
const event = value => `data: ${JSON.stringify(value)}\n\n`;
const candidate = (parts, finishReason = 'STOP') => ({ candidates: [{ content: { role: 'model', parts }, ...(finishReason ? { finishReason } : {}) }] });
const parts = [{ thought: true, text: 'plan', thoughtSignature: 'THOUGHT_SIG' }, { text: 'Retained text.', thoughtSignature: 'TEXT_SIG' }];
const input = (scenario, stream = true) => ({ model: 'gemini-4-argon', stream, type: 'normal', chat_completion_source: 'vertexai', max_tokens: 1000,
    messages: [{ role: 'user', content: scenario }], include_reasoning: true, reasoning_effort: 'low', vertexai_region: 'global', reverse_proxy: providerOrigin, proxy_password: 'SYNTHETIC_PROXY' });
const call = body => fetch(origin + '/api/backends/chat-completions/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
before(async () => {
    provider = http.createServer(async (req, res) => {
        let raw = ''; for await (const chunk of req) raw += chunk;
        const body = JSON.parse(raw || '{}');
        const scenario = req.url.includes('/chat/completions') ? 'openai' : body.contents?.[0]?.parts?.[0]?.text;
        calls.set(scenario, (calls.get(scenario) || 0) + 1);
        if (scenario === 'openai') { res.setHeader('content-type', body.stream ? 'text/event-stream' : 'application/json'); res.end(body.stream ? event({ choices: [{ delta: { content: 'OPENAI_OK' } }] }) + 'data: [DONE]\n\n' : JSON.stringify({ choices: [{ message: { content: 'OPENAI_OK' } }] })); return; }
        if (scenario === 'failed' || body.continuationToken) { res.writeHead(503); res.end('synthetic error'); return; }
        if (scenario === 'redirect') { res.writeHead(307, { location: providerOrigin + '/must-not-follow' }); res.end(); return; }
        const stream = req.url.includes('streamGenerateContent');
        res.setHeader('content-type', stream ? 'text/event-stream' : 'application/json');
        if (scenario === 'cancel') {
            res.on('close', () => { if (!res.writableFinished) disconnects++; });
            res.write(event(candidate(parts, null))); return;
        }
        const result = { ...candidate(parts, scenario === 'partial' ? 'CONTINUATION' : 'STOP'), usageMetadata: { totalTokenCount: 9 } };
        if (scenario === 'partial') result.candidates[0].continuationToken = 'synthetic-continuation';
        res.end(stream ? event(result) : JSON.stringify(result));
    });
    await new Promise(resolve => provider.listen(0, '127.0.0.1', resolve));
    providerOrigin = `http://127.0.0.1:${provider.address().port}`;
    const config = path.join(root, 'config.yaml');
    await fs.writeFile(config, `vertexai:\n  allowedReverseProxyOrigins: [${JSON.stringify(providerOrigin)}]\ngemini:\n  thoughtSignatures: true\n`);
    setConfigFilePath(config); globalThis.DATA_ROOT = path.join(root, 'data');
    const { default: initFilter } = await import('../src/private-request-filter.js');
    initFilter({ listen: false, enabled: true, privateAddressWhitelist: ['127.0.0.1/32'], logBlocked: false, logAllowed: false, allowUnresolvedHosts: false, enableKeepAlive: false });
    const { router } = await import('../src/endpoints/backends/chat-completions.js');
    ({ readVertexSse } = await import('../src/endpoints/backends/vertex-protocol.js'));
    const app = express(); app.use(express.json()); app.use((req, _res, next) => { req.user = { profile: { handle: 'synthetic' }, directories: { root } }; next(); });
    app.use('/api/backends/chat-completions', router);
    server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve)); origin = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
    server?.closeAllConnections(); provider?.closeAllConnections();
    if (server) await new Promise(resolve => server.close(resolve));
    if (provider) await new Promise(resolve => provider.close(resolve));
    http.globalAgent = oldHttpAgent; https.globalAgent = oldHttpsAgent; await fs.rm(root, { recursive: true, force: true });
});
for (const stream of [true, false]) test(`native ${stream ? 'SSE' : 'JSON'} has one upstream request, reasoning, signature and one terminal`, async () => {
    const scenario = `normal-${stream}`, res = await call(input(scenario, stream)), wire = await res.text();
    assert.equal(calls.get(scenario), 1);
    const frames = []; if (stream) for await (const f of readVertexSse(Readable.from([wire]))) frames.push(f);
    const result = stream ? frames.at(-1) : JSON.parse(wire);
    assert.equal(result.vertexMeta.state, 'completed'); assert.equal(result.usageMetadata.totalTokenCount, 9);
    assert.equal('contract' in result.vertexMeta, false); assert.ok(!res.headers.has('x-st-vertex-native'));
    if (stream) assert.equal(wire.split('data: [DONE]').length - 1, 1);
    else assert.deepEqual(result.responseContent.parts, parts);
});
test('JSON continuation failure retains native content and partial error; an empty upstream failure stays failed', async () => {
    const result = await (await call(input('partial', false))).json();
    assert.equal(calls.get('partial'), 2); assert.equal(result.vertexMeta.state, 'partial'); assert.equal(result.error.status, 503);
    assert.equal(result.vertexMeta.error.code, result.error.code); assert.deepEqual(result.responseContent.parts, parts);
    const failed = await (await call(input('failed', false))).json();
    assert.equal(failed.vertexMeta.state, 'failed'); assert.deepEqual(failed.responseContent.parts, []); assert.equal(calls.get('failed'), 1);
});
test('native HTTP cancellation aborts the single upstream and redirects are not followed', async () => {
    const response = await call(input('cancel')), reader = response.body.getReader();
    let text = ''; while (!text.includes('Retained text.')) text += new TextDecoder().decode((await reader.read()).value);
    await reader.cancel();
    for (let i = 0; i < 30 && !disconnects; i++) await sleep(10);
    assert.equal(disconnects, 1); assert.equal(calls.get('cancel'), 1);
    const wire = await (await call(input('redirect'))).text(); assert.match(wire, /VERTEX_NETWORK/); assert.equal(calls.get('redirect'), 1);
});
for (const source of ['custom', 'makersuite']) for (const stream of [true, false]) test(`existing ${source} ${stream ? 'SSE' : 'JSON'} routing remains independent`, async () => {
    const request = { ...input('makersuite', stream), chat_completion_source: source, model: source === 'custom' ? 'fixture' : 'gemini-2.5-flash', custom_url: providerOrigin };
    const response = await call(request), text = await response.text();
    assert.match(text, source === 'custom' ? /OPENAI_OK/ : /Retained text/);
    assert.ok(!text.includes('"vertexMeta"'));
});
