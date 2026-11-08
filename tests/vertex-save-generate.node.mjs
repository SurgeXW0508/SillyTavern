// Optional paired-plugin integration: install the pinned, separately supplied compatibility patch
// in plugins/baibaoku first. No plugin source is vendored by the ST repository.
import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import https from 'node:https';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import express from 'express';
import { setTimeout as sleep } from 'node:timers/promises';
import { setConfigFilePath } from '../src/util.js';

const pluginFile = new URL('../plugins/baibaoku/src/save-generate.js', import.meta.url);
const hasPlugin = await fs.access(pluginFile).then(() => true, () => false);
const root = await fs.mkdtemp(path.join(os.tmpdir(), 'st-vertex-http-'));
const oldHttpAgent = http.globalAgent, oldHttpsAgent = https.globalAgent;
let server, provider, origin, providerOrigin, closeSaveGenerateJobs, readVertexSse, sqliteDriver;
const calls = new Map(), disconnected = new Map(), users = new Map();
const event = value => `data: ${JSON.stringify(value)}\n\n`;
const candidate = (parts, reason = 'STOP') => ({ candidates: [{ content: { role: 'model', parts }, ...(reason ? { finishReason: reason } : {}) }] });
const input = (scenario, stream = true) => ({ model: 'gemini-4-argon', stream, type: 'normal', chat_completion_source: 'vertexai', max_tokens: 1000,
    messages: [{ role: 'user', content: scenario }], include_reasoning: true, reasoning_effort: 'low', vertexai_region: 'global',
    reverse_proxy: providerOrigin, proxy_password: 'PRIVATE_PROXY' });
const save = name => ({ kind: 'character', type: 'normal', avatar_url: 'fixture.png', file_name: name, chatId: name, ch_name: 'Fixture', expectedFloor: 1 });
async function call(route, body, user = 'alice', options = {}) {
    return fetch(origin + route, { method: 'POST', headers: { 'content-type': 'application/json', 'x-test-user': user }, body: JSON.stringify(body), ...options });
}
const native = '/api/backends/chat-completions/generate';
const background = '/api/plugins/baibaoku/v1/chats/save-generate';
async function collect(response) {
    const text = await response.text();
    const frames = [];
    if ((response.headers.get('content-type')?.includes('text/event-stream') || /^\s*(?:data:|:)/.test(text))) for await (const f of readVertexSse(Readable.from([text]))) frames.push(f);
    return { text, frames, json: frames.length ? null : JSON.parse(text) };
}
async function job(id, user = 'alice') {
    const res = await call(background + '/status', { jobId: id }, user);
    return { status: res.status, data: await res.json() };
}

before(async () => {
    provider = http.createServer(async (req, res) => {
        let raw = ''; for await (const chunk of req) raw += chunk;
        const body = JSON.parse(raw || '{}');
        if (req.url.includes('/chat/completions')) {
            calls.set('openai', (calls.get('openai') || 0) + 1);
            res.writeHead(200, { 'content-type': body.stream ? 'text/event-stream' : 'application/json' });
            res.end(body.stream ? event({ choices: [{ index: 0, delta: { content: 'OPENAI_OK' }, finish_reason: 'stop' }] }) + 'data: [DONE]\n\n' : JSON.stringify({ choices: [{ message: { content: 'OPENAI_OK' } }] })); return;
        }
        const scenario = body.contents?.[0]?.parts?.[0]?.text || 'normal';
        calls.set(scenario, (calls.get(scenario) || 0) + 1);
        const stream = req.url.includes('streamGenerateContent');
        res.on('close', () => { if (!res.writableFinished) disconnected.set(scenario, (disconnected.get(scenario) || 0) + 1); });
        if (scenario === 'rate-limit') { res.writeHead(429); res.end('PRIVATE_PROXY PRIVATE_PROMPT'); return; }
        if (scenario === 'redirect') { res.writeHead(307, { location: providerOrigin + '/forbidden-target' }); res.end(); return; }
        res.writeHead(200, { 'content-type': stream ? 'text/event-stream' : 'application/json' });
        const parts = [{ thought: true, text: 'plan', thoughtSignature: 'THOUGHT_SIG' }, { text: 'VERTEX_OK', thoughtSignature: 'TEXT_SIG' }];
        if (scenario === 'tool') {
            const result = candidate([{ functionCall: { name: 'lookup', id: 'native-call', args: { location: 'Tokyo' } }, thoughtSignature: 'TOOL_SIG' }]);
            res.end(stream ? event(result) : JSON.stringify(result)); return;
        }
        if (scenario === 'tool-roundtrip') {
            const responseParts = body.contents.at(-1)?.parts || [];
            if (responseParts[0]?.functionResponse) {
                assert.deepEqual(responseParts.map(p => p.functionResponse.id), ['call-a', 'call-b']);
                assert.deepEqual(responseParts.map(p => p.functionResponse.name), ['lookup', 'lookup']);
                assert.equal(body.contents.at(-2).parts[0].thoughtSignature, 'ROUNDTRIP_SIG');
                res.end(event(candidate([{ text: 'TOOL_ROUNDTRIP_OK' }]))); return;
            }
            res.end(event(candidate([{ functionCall: { name: 'lookup', id: 'call-a', args: { location: 'A' } }, thoughtSignature: 'ROUNDTRIP_SIG' },
                { functionCall: { name: 'lookup', id: 'call-b', args: { location: 'B' } } }]))); return;
        }
        if (scenario === 'envelope') {
            const result = candidate([{ functionCall: { name: 'actual_content', id: 'envelope-call', args: { content: 'UNWRAPPED' } }, thoughtSignature: 'ENVELOPE_SIG' }]);
            res.end(stream ? event(result) : JSON.stringify(result)); return;
        }
        if (scenario === 'truncated') { res.end(event(candidate(parts, null))); return; }
        if (scenario === 'reset') { res.write(event(candidate(parts, null))); setTimeout(() => res.destroy(), 15); return; }
        if (scenario === 'cancel' || scenario === 'native-cancel' || scenario === 'discard' || scenario === 'subscriber-gone' || scenario === 'shutdown') {
            res.write(event(candidate(parts, null)));
            await sleep(scenario === 'subscriber-gone' ? 70 : 2000);
            if (!res.destroyed) res.end(event(candidate([{ text: '_TAIL' }]))); return;
        }
        const result = { ...candidate(parts, scenario === 'max-tokens' ? 'MAX_TOKENS' : 'STOP'), usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 6, totalTokenCount: 11 } };
        res.end(stream ? event(result) : JSON.stringify(result));
    });
    await new Promise(resolve => provider.listen(0, '127.0.0.1', resolve));
    providerOrigin = `http://127.0.0.1:${provider.address().port}`;
    const config = path.join(root, 'config.yaml');
    await fs.writeFile(config, `vertexai:\n  allowedReverseProxyOrigins: [${JSON.stringify(providerOrigin)}]\ngemini:\n  thoughtSignatures: true\n`);
    setConfigFilePath(config);
    globalThis.DATA_ROOT = path.join(root, 'data');
    const { default: initFilter } = await import('../src/private-request-filter.js');
    initFilter({ listen: false, enabled: true, privateAddressWhitelist: ['127.0.0.1/32'], logBlocked: false, logAllowed: false, allowUnresolvedHosts: false, enableKeepAlive: false });
    const { router } = await import('../src/endpoints/backends/chat-completions.js');
    ({ readVertexSse } = await import('../src/endpoints/backends/vertex-protocol.js'));
    const app = express(); app.use(express.json({ limit: '2mb' }));
    app.use((req, _res, next) => { req.user = users.get(req.headers['x-test-user'] || 'alice'); next(); });
    for (const user of ['alice', 'bob', 'broken-store']) {
        const userRoot = path.join(root, user), chats = path.join(userRoot, 'chats');
        await fs.mkdir(path.join(chats, 'fixture'), { recursive: true });
        users.set(user, { profile: { handle: user }, directories: { root: userRoot, chats } });
    }
    app.use('/api/backends/chat-completions', router);
    if (hasPlugin) {
        const plugin = await import(pluginFile);
        sqliteDriver = await (await import(new URL('../plugins/baibaoku/src/database.js', import.meta.url))).loadSqliteDriver();
        closeSaveGenerateJobs = plugin.closeSaveGenerateJobs;
        const pr = express.Router(); plugin.registerSaveGenerateEndpoints(pr); app.use('/api/plugins/baibaoku', pr);
    }
    server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    origin = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    await closeSaveGenerateJobs?.();
    server?.closeAllConnections(); provider?.closeAllConnections();
    if (server) await new Promise(resolve => server.close(resolve));
    if (provider) await new Promise(resolve => provider.close(resolve));
    http.globalAgent = oldHttpAgent; https.globalAgent = oldHttpsAgent;
    await fs.rm(root, { recursive: true, force: true });
});

for (const stream of [true, false]) for (const paired of [false, true]) test(`${paired ? 'Save Generate' : 'native HTTP'} ${stream ? 'SSE' : 'JSON'}: reasoning/signature/usage and one request`, { skip: paired && !hasPlugin }, async () => {
    const before = calls.get('normal') || 0;
    const body = input('normal', stream), res = await call(paired ? background : native, paired ? { save: save(`normal-${stream}`), generate: body } : body);
    const id = res.headers.get('x-baibaoku-save-generate-job-id');
    const result = await collect(res);
    assert.equal(calls.get('normal') - before, 1); assert.match(result.text, /VERTEX_OK/);
    if (stream) { assert.equal(result.frames.at(-1).vertexMeta.state, 'completed'); assert.equal(result.text.split('data: [DONE]').length - 1, 1); }
    else { assert.equal(result.json.vertexMeta.state, 'completed'); assert.equal(result.json.usageMetadata.totalTokenCount, 11); }
    if (paired) {
        const data = (await job(id)).data.data;
        assert.equal(data.status, 'completed'); assert.equal(data.resultText, 'VERTEX_OK');
        assert.equal(data.savedMessage.extra.reasoning, 'plan'); assert.equal(data.savedMessage.extra.reasoning_signature, 'TEXT_SIG');
        assert.deepEqual(data.savedMessage.extra.vertex_response.parts.map(p => p.thoughtSignature), ['THOUGHT_SIG', 'TEXT_SIG']);
        const db = sqliteDriver.open(path.join(users.get('alice').directories.root, 'baibaoku/databases/baibaoku.internal.sqlite'));
        const row = db.prepare('SELECT payload FROM save_generate_jobs WHERE id = ?').get(id);
        assert.ok(row); assert.ok(!row.payload.includes('PRIVATE_PROXY')); assert.equal(JSON.parse(row.payload).status, 'completed'); db.close();
        await closeSaveGenerateJobs();
        const recovered = (await job(id)).data.data;
        assert.equal(recovered.savedMessage.extra.reasoning_signature, 'TEXT_SIG');
        assert.deepEqual(recovered.savedMessage, data.savedMessage);
        assert.equal((await job(id, 'bob')).status, 404);
    }
});

for (const scenario of ['truncated', 'reset', 'rate-limit', 'max-tokens']) for (const paired of [false, true]) test(`${paired ? 'Save Generate' : 'native HTTP'} ${scenario}: explicit terminal, retained partial, no retry`, { skip: paired && !hasPlugin }, async () => {
    const before = calls.get(scenario) || 0;
    const body = input(scenario), res = await call(paired ? background : native, paired ? { save: save(scenario), generate: body } : body);
    const id = res.headers.get('x-baibaoku-save-generate-job-id'), result = await collect(res);
    assert.equal(calls.get(scenario) - before, 1);
    const terminal = result.frames.at(-1);
    assert.equal(terminal.vertexMeta.state, scenario === 'rate-limit' ? 'failed' : 'partial');
    if (scenario !== 'max-tokens') assert.ok(terminal.error);
    if (scenario !== 'rate-limit') assert.match(result.text, /VERTEX_OK/);
    assert.equal(result.text.split('data: [DONE]').length - 1, 1);
    assert.ok(!result.text.includes('PRIVATE_PROXY'));
    if (paired) {
        const data = (await job(id)).data.data;
        assert.equal(data.status, scenario === 'rate-limit' ? 'failed' : 'partial');
        assert.equal(data.resultText, scenario === 'rate-limit' ? '' : 'VERTEX_OK');
        if (data.resultText) assert.equal(data.savedMessage.extra.vertex_generation.state, 'partial');
    }
});

test('normal tools remain native; the explicit single actual_content envelope works through both entries', { skip: !hasPlugin }, async () => {
    const tools = [{ type: 'function', function: { name: 'lookup', parameters: { type: 'object', properties: { location: { type: 'string' } } } } }];
    const response = await collect(await call(native, { ...input('tool'), tools }));
    assert.match(response.text, /TOOL_SIG/); assert.match(response.text, /native-call/);
    const rejected = await call(background, { save: save('tool'), generate: { ...input('tool'), tools } });
    assert.equal(rejected.status, 400); await rejected.text();
    for (const paired of [false, true]) {
        const generate = { ...input('envelope'), vertexai_unwrap_content: true, tools: [{ type: 'function', function: { name: 'actual_content', parameters: { type: 'object', properties: { content: { type: 'string' } }, required: ['content'] } } }] };
        const res = await call(paired ? background : native, paired ? { save: save('envelope'), generate } : generate);
        const id = res.headers.get('x-baibaoku-save-generate-job-id');
        const data = await collect(res); assert.match(data.text, /UNWRAPPED/); assert.match(data.text, /ENVELOPE_SIG/);
        if (paired) assert.equal((await job(id)).data.data.savedMessage.extra.vertex_response.envelope.thoughtSignature, 'ENVELOPE_SIG');
    }
});

test('background cancellation aborts one upstream, retains partial signature data and settles once', { skip: !hasPlugin }, async () => {
    const response = await call(background, { save: save('cancel'), generate: input('cancel') });
    const id = response.headers.get('x-baibaoku-save-generate-job-id'), reader = response.body.getReader();
    let text = ''; while (!text.includes('VERTEX_OK')) text += new TextDecoder().decode((await reader.read()).value);
    const canceled = await call(background + '/cancel', { jobId: id }); await canceled.text();
    const data = (await job(id)).data.data;
    assert.equal(data.status, 'canceled'); assert.equal(data.resultText, 'VERTEX_OK'); assert.equal(data.savedMessage.extra.reasoning_signature, 'TEXT_SIG');
    assert.equal(calls.get('cancel'), 1); await sleep(20); assert.equal(disconnected.get('cancel'), 1);
    const again = await call(background + '/cancel', { jobId: id }); await again.text();
    assert.equal((await job(id)).data.data.finishedAt, data.finishedAt);
    await reader.cancel();
});

test('closing a subscriber preserves the background job and does not cause a second request', { skip: !hasPlugin }, async () => {
    const response = await call(background, { save: save('subscriber-gone'), generate: input('subscriber-gone') });
    const id = response.headers.get('x-baibaoku-save-generate-job-id'); await response.body.cancel();
    let data;
    for (let n = 0; n < 30; n++) { data = (await job(id)).data.data; if (data.status === 'completed') break; await sleep(15); }
    assert.equal(data.status, 'completed'); assert.equal(data.resultText, 'VERTEX_OK_TAIL'); assert.equal(calls.get('subscriber-gone'), 1);
});

test('discard cancels generation and does not recreate a removed durable job', { skip: !hasPlugin }, async () => {
    const response = await call(background, { save: save('discard'), generate: input('discard') });
    const id = response.headers.get('x-baibaoku-save-generate-job-id'), reader = response.body.getReader();
    let text = ''; while (!text.includes('VERTEX_OK')) text += new TextDecoder().decode((await reader.read()).value);
    const discarded = await call(background + '/discard', { chatId: 'discard' }); await discarded.text();
    await reader.cancel(); await sleep(25);
    assert.equal((await job(id)).status, 404); assert.equal(calls.get('discard'), 1); assert.equal(disconnected.get('discard'), 1);
});

test('persistence failure never publishes completed and does not rerun generation', { skip: !hasPlugin }, async () => {
    await fs.writeFile(path.join(users.get('broken-store').directories.root, 'baibaoku'), 'not a directory');
    const response = await call(background, { save: save('broken-store'), generate: input('normal') }, 'broken-store');
    const id = response.headers.get('x-baibaoku-save-generate-job-id'), result = await collect(response);
    assert.ok(!result.text.includes('"state":"completed"')); assert.match(result.text, /persistence failed/);
    const data = (await job(id, 'broken-store')).data.data;
    assert.equal(data.status, 'failed'); assert.equal(data.resultText, 'VERTEX_OK');
});

test('redirects are not followed, and original OpenAI-compatible requests still work directly and through Save Generate', async () => {
    const redirected = await collect(await call(native, input('redirect')));
    assert.equal(redirected.frames.at(-1).error.code, 'VERTEX_NETWORK'); assert.equal(calls.get('redirect'), 1);
    const generate = { ...input('normal'), chat_completion_source: 'custom', model: 'fixture', custom_url: providerOrigin };
    for (const paired of hasPlugin ? [false, true] : [false]) {
        const res = await call(paired ? background : native, paired ? { save: save('openai'), generate } : generate);
        const result = await res.text(); assert.match(result, /OPENAI_OK/);
    }
    assert.equal(calls.get('openai'), hasPlugin ? 2 : 1);
});

test('native HTTP disconnect cancels the upstream without a retry', async () => {
    const response = await call(native, input('native-cancel')), reader = response.body.getReader();
    let text = ''; while (!text.includes('VERTEX_OK')) text += new TextDecoder().decode((await reader.read()).value);
    await reader.cancel(); await sleep(20);
    assert.equal(disconnected.get('native-cancel'), 1); assert.equal(calls.get('native-cancel'), 1);
});

test('plugin shutdown awaits cancellation and durably preserves the received partial result', { skip: !hasPlugin }, async () => {
    const response = await call(background, { save: save('shutdown'), generate: input('shutdown') });
    const id = response.headers.get('x-baibaoku-save-generate-job-id'), reader = response.body.getReader();
    let text = ''; while (!text.includes('VERTEX_OK')) text += new TextDecoder().decode((await reader.read()).value);
    await closeSaveGenerateJobs();
    const data = (await job(id)).data.data;
    assert.equal(data.status, 'canceled'); assert.equal(data.resultText, 'VERTEX_OK'); assert.equal(data.savedMessage.extra.reasoning_signature, 'TEXT_SIG');
    assert.equal(calls.get('shutdown'), 1); await reader.cancel();
});

test('two native tool calls and their ordered responses complete a second HTTP generation with signatures intact', async () => {
    const tools = [{ type: 'function', function: { name: 'lookup', parameters: { type: 'object', properties: { location: { type: 'string' } } } } }];
    const first = await collect(await call(native, { ...input('tool-roundtrip'), tools }));
    const parts = first.frames.flatMap(f => f.candidates?.[0]?.content?.parts || []);
    const messages = [{ role: 'user', content: 'tool-roundtrip' }, { role: 'assistant', content: '', vertex_response: { model: 'gemini-4-argon', parts },
        tool_calls: parts.map(p => ({ id: p.functionCall.id, function: { name: p.functionCall.name, arguments: JSON.stringify(p.functionCall.args) }, signature: p.thoughtSignature })) },
    { role: 'tool', tool_call_id: 'call-a', content: 'result A' }, { role: 'tool', tool_call_id: 'call-b', content: 'result B' }];
    const second = await collect(await call(native, { ...input('tool-roundtrip'), messages, tools, custom_prompt_post_processing: 'merge_tools' }));
    assert.match(second.text, /TOOL_ROUNDTRIP_OK/); assert.equal(calls.get('tool-roundtrip'), 2);
});

for (const stream of [true, false]) test(`original Google AI Studio ${stream ? 'SSE' : 'JSON'} route still uses its own response path`, async () => {
    const response = await call(native, { ...input('makersuite', stream), chat_completion_source: 'makersuite', model: 'gemini-2.5-flash' });
    const result = await collect(response);
    assert.match(result.text, /VERTEX_OK/);
    if (!stream) assert.ok(result.json.responseContent);
});
