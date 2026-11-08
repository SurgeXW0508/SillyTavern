import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable } from 'node:stream';
import { EventEmitter } from 'node:events';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { Response } from 'node-fetch';
import { setConfigFilePath } from '../src/util.js';
setConfigFilePath(fileURLToPath(new URL('../default/config.yaml', import.meta.url)));
const { vertexOptions, buildVertexRequest, readVertexSse, VertexFunctionStream, VERTEX_LIMITS } = await import('../src/endpoints/backends/vertex-protocol.js');
const { createVertexGeneration, createVertexHandler, vertexResultFrame } = await import('../src/endpoints/backends/vertex-native.js');
const { createVertexConnectionResolver, vertexHost } = await import('../src/endpoints/backends/vertex-transport.js');
const { appendVertexParts, vertexResponseRecord, applyVertexMessageState, reusableVertexResponse } = await import('../public/scripts/vertex-state.js');
const base = { model: 'gemini-4-argon', stream: true, chat_completion_source: 'vertexai', max_tokens: 131072,
    messages: [{ role: 'user', content: 'PRIVATE_PROMPT' }], include_reasoning: true, reasoning_effort: 'low' };
const context = (overrides = {}) => ({ body: structuredClone({ ...base, ...overrides }), user: { directories: { root: '/unused/vertex-contract' } } });
const frame = value => `data: ${JSON.stringify(value)}\n\n`;
const candidate = (parts, finishReason, extra = {}) => ({ candidates: [{ index: 0, content: { role: 'model', parts }, ...(finishReason ? { finishReason } : {}), ...extra }] });
const upstream = events => new Response(Readable.from(events.map(frame)), { headers: { 'content-type': 'text/event-stream' } });
const resolveConnection = async () => ({ url: 'https://aiplatform.googleapis.com/mock', headers: {} });
const run = (fetchImpl, input = context(), extra = {}) => createVertexGeneration({ fetchImpl, resolveConnection, ...extra })(input);
const tool = name => ({ type: 'function', function: { name, parameters: { type: 'object', properties: { content: { type: 'string' } }, required: ['content'] } } });

test('native protocol maps parameters without mutating settings; ignored/unsupported parameters are explicit', () => {
    const input = context({ temperature: 0.2, top_k: 20, top_p: 0.8, tools: [tool('lookup')], tool_choice: 'required' });
    const original = structuredClone(input);
    const options = vertexOptions(input.body), body = buildVertexRequest(input, options);
    assert.deepEqual(input, original);
    assert.deepEqual(options.ignoredParameters, ['temperature', 'top_p', 'top_k']);
    assert.equal(body.generationConfig.temperature, undefined);
    assert.equal(body.generationConfig.thinkingConfig.thinkingLevel, 'LOW');
    assert.equal(body.toolConfig.functionCallingConfig.streamFunctionCallArguments, true);
    assert.equal(body.toolConfig.functionCallingConfig.mode, 'ANY');
    for (const override of [{ n: 2 }, { logprobs: true }, { frequency_penalty: 0.5 }, { seed: 1 }, { vertexai_region: 'us-central1' }, { vertexai_api_version: 'v1' }]) assert.throws(() => vertexOptions({ ...base, ...override }));
    assert.throws(() => buildVertexRequest(context({ tools: [{ type: 'future_unsupported_tool' }] })), /Unsupported/);
    assert.throws(() => buildVertexRequest(context({ tools: [tool('lookup')], tool_choice: { type: 'function', function: { name: 'missing' } } })), /tool_choice/);
    assert.equal(vertexOptions({ ...base, model: 'gemini-3.1-flash-lite' }).streamArguments, false);
});

test('JSON/schema, image input/output, native tools and old-model mixing have explicit behavior', () => {
    const input = context({ model: 'gemini-3.1-flash-image', request_images: true, request_image_resolution: '2K', responseSchema: { type: 'object', properties: { answer: { type: 'string' } } },
        messages: [{ role: 'user', content: [{ type: 'text', text: 'image' }, { type: 'image_url', image_url: { url: 'data:image/png;base64,aGVsbG8=' } }] }], tools: [{ type: 'google_search', google_search: {} }] });
    const body = buildVertexRequest(input);
    assert.equal(body.contents[0].parts[1].inlineData.mimeType, 'image/png');
    assert.deepEqual(body.tools, [{ googleSearch: {} }]);
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    assert.deepEqual(body.generationConfig.responseModalities, ['TEXT', 'IMAGE']);
    assert.throws(() => buildVertexRequest(context({ request_images: true })), /图像/);
    assert.throws(() => buildVertexRequest(context({ model: 'gemini-2.5-flash', tools: [tool('lookup')], enable_web_search: true })), /组合/);
});

test('Continue preserves an assistant turn and adds an explicit user continuation; prefill is rejected', () => {
    const messages = [{ role: 'user', content: 'start' }, { role: 'assistant', content: 'partial answer' }];
    assert.throws(() => buildVertexRequest(context({ messages })), /prefill/);
    const body = buildVertexRequest(context({ messages, type: 'continue' }));
    assert.equal(body.contents[1].role, 'model');
    assert.equal(body.contents[1].parts[0].text, 'partial answer');
    assert.equal(body.contents[2].role, 'user');
    assert.match(body.contents[2].parts[0].text, /Continue/);
    const legacy = buildVertexRequest(context({ model: 'gemini-2.5-flash', messages }));
    assert.equal(legacy.contents.at(-1).role, 'model');
});

test('UTF8, CRLF, multiline data and trailing complete SSE JSON are parsed as complete frames', async () => {
    const bytes = Buffer.from(': keepalive\r\n\r\ndata: {"text":\r\ndata: "中文🙂"}\r\n\r\ndata: {"end":true}');
    const result = [];
    for await (const value of readVertexSse(Readable.from([...bytes].map(b => Buffer.from([b]))))) result.push(value);
    assert.deepEqual(result, [{ text: '中文🙂' }, { end: true }]);
    await assert.rejects(async () => { for await (const _ of readVertexSse(Readable.from(['data: invalid\n\n']))) void _; }, /JSON/);
    await assert.rejects(async () => { for await (const _ of readVertexSse(Readable.from(['data: ' + 'x'.repeat(VERTEX_LIMITS.eventBytes + 1)]))) void _; }, /32 MiB/);
});

test('function fragments preserve IDs/signatures, multiple calls, nested values and empty closing fragments', () => {
    const c = new VertexFunctionStream();
    c.transform(candidate([{ functionCall: { name: 'first', willContinue: true, partialArgs: [{ jsonPath: '$.content', stringValue: '中文', willContinue: true }] }, thoughtSignature: 'sig1' }]));
    c.transform(candidate([{ functionCall: { id: 'a', willContinue: true, partialArgs: [{ jsonPath: '$.content', stringValue: '🙂', willContinue: true }] } }]));
    const a = c.transform(candidate([{ functionCall: { id: 'a', partialArgs: [{ jsonPath: '$.content' }] } }])).candidates[0].content.parts[0];
    assert.deepEqual(a, { functionCall: { name: 'first', id: 'a', args: { content: '中文🙂' } }, thoughtSignature: 'sig1' });
    const b = c.transform(candidate([{ functionCall: { name: 'second', id: 'b', args: { location: { name: 'Tokyo' } } }, thoughtSignature: 'sig2' }])).candidates[0].content.parts[0];
    assert.equal(b.functionCall.id, 'b');
    assert.equal(b.thoughtSignature, 'sig2');
    assert.equal(c.completed, 2);
    assert.equal(c.active.size, 0);
    assert.throws(() => c.transform(candidate([{ functionCall: { name: 'first', id: 'a', args: { content: '中文🙂' } } }])), /repeated/);
});

test('explicit IDs may interleave; anonymous ambiguity, prototype keys and oversized arguments fail safely', () => {
    const c = new VertexFunctionStream();
    c.transform(candidate([{ functionCall: { name: 'lookup', id: 'a', willContinue: true } }, { functionCall: { name: 'lookup', id: 'b', willContinue: true } }]));
    assert.throws(() => c.transform(candidate([{ functionCall: { partialArgs: [{ jsonPath: '$.content', stringValue: 'ambiguous' }] } }])), /Ambiguous/);
    const final = c.transform(candidate([{ functionCall: { id: 'b', args: { content: 'B' } } }, { functionCall: { id: 'a', args: { content: 'A' } } }])).candidates[0].content.parts;
    assert.deepEqual(final.map(p => p.functionCall.id), ['a', 'b']);
    assert.throws(() => new VertexFunctionStream().transform(candidate([{ functionCall: { name: 'bad', partialArgs: [{ jsonPath: '$.__proto__.polluted', boolValue: true }] } }])), /禁止/);
    assert.equal({}.polluted, undefined);
    assert.throws(() => new VertexFunctionStream().transform(candidate([{ functionCall: { name: 'big', args: { content: 'x'.repeat(VERTEX_LIMITS.argumentBytes) } } }])), /limit/);
});

test('actual_content is explicit and separate from normal and mixed tools', async () => {
    const events = [candidate([{ functionCall: { name: 'actual_content', args: { content: '正文' } }, thoughtSignature: 'special-signature' }], 'STOP')];
    const normal = await run(async () => upstream(events), context({ tools: [tool('actual_content')] }));
    assert.equal(normal.text, ''); assert.equal(normal.responseContent.parts[0].functionCall.name, 'actual_content');
    const special = await run(async () => upstream(events), context({ tools: [tool('actual_content')], vertexai_unwrap_content: true }));
    assert.equal(special.text, '正文'); assert.equal(special.signature, null); assert.equal(special.metadata.vertexEnvelope.thoughtSignature, 'special-signature');
    assert.equal(vertexOptions({ ...base, tools: [tool('actual_content'), tool('other')], vertexai_unwrap_content: true }).unwrapContent, false);
});

test('streamed and non-streamed results preserve reasoning, images, usage, finish and original signature positions', async () => {
    const parts = [{ thought: true, text: 'reason', thoughtSignature: 'reason-sig' }, { text: 'first' }, { text: 'second', thoughtSignature: 'text-sig' }, { inlineData: { mimeType: 'image/png', data: 'aGVsbG8=' }, thoughtSignature: 'image-sig' }];
    for (const stream of [true, false]) {
        const events = [{ ...candidate(structuredClone(parts), 'STOP', { groundingMetadata: { webSearchQueries: ['test'] } }), responseId: 'resp', usageMetadata: { totalTokenCount: 12 } }];
        const result = await run(async () => stream ? upstream(events) : new Response(JSON.stringify(events[0])), context({ stream, model: 'gemini-3.1-flash-image' }));
        assert.equal(result.state, 'completed');
        assert.equal(result.text, 'firstsecond'); assert.equal(result.reasoning, 'reason');
        assert.deepEqual(result.responseContent.parts, parts);
        assert.equal(result.usageMetadata.totalTokenCount, 12);
        assert.equal(result.candidate.groundingMetadata.webSearchQueries[0], 'test');
        assert.equal(vertexResultFrame(result).responseId, 'resp');
    }
});

test('long decoding is explicit continuation, preserves the original request and never exposes tokens', async () => {
    const requests = [], frames = [];
    const result = await createVertexGeneration({ resolveConnection, fetchImpl: async (_url, init) => {
        requests.push(JSON.parse(init.body));
        return upstream(requests.length === 1 ? [{ ...candidate([{ text: 'first' }], 'CONTINUATION', { continuationToken: 'PRIVATE_CONTINUATION' }), usageMetadata: { totalTokenCount: 9 } }]
            : [{ ...candidate([{ text: 'second' }], 'STOP'), usageMetadata: { totalTokenCount: 11 } }]);
    } })(context(), { emit: async f => { frames.push(f); } });
    assert.equal(result.state, 'completed'); assert.equal(result.text, 'firstsecond');
    assert.equal(requests.length, 2); assert.equal(requests[1].continuationToken, 'PRIVATE_CONTINUATION');
    delete requests[1].continuationToken; assert.deepEqual(requests[1], requests[0]);
    assert.ok(!JSON.stringify({ frames, result }).includes('PRIVATE_CONTINUATION'));
    assert.equal(result.usageMetadata.totalTokenCount, 20);
});

for (const [name, events, expected, code] of [
    ['truncated stream', [candidate([{ text: 'partial' }])], 'partial', 'VERTEX_INCOMPLETE_STREAM'],
    ['empty completion', [candidate([], 'STOP')], 'failed', 'VERTEX_EMPTY'],
    ['safety finish', [candidate([{ text: 'partial' }], 'SAFETY')], 'partial', 'VERTEX_FINISH'],
    ['token limit', [candidate([{ text: 'partial' }], 'MAX_TOKENS')], 'partial', undefined],
    ['thought only', [candidate([{ thought: true, text: 'thinking' }], 'STOP')], 'partial', 'VERTEX_EMPTY'],
    ['incomplete function', [candidate([{ functionCall: { name: 'lookup', willContinue: true } }], 'STOP')], 'failed', 'VERTEX_INCOMPLETE_FUNCTION'],
]) test(`terminal result: ${name}`, async () => {
    let calls = 0;
    const result = await run(async () => { calls++; return upstream(events); });
    assert.equal(calls, 1); assert.equal(result.state, expected); assert.equal(result.error?.code, code);
    if (expected === 'partial') assert.ok(result.responseContent.parts.length);
});

test('HTTP failures and body interruption do not retry or leak upstream prompt/key/URL diagnostics', async () => {
    for (const status of [400, 401, 403, 404, 429, 503]) {
        let calls = 0;
        const result = await run(async () => { calls++; return new Response('PRIVATE_PROMPT PRIVATE_KEY https://secret.invalid', { status }); });
        assert.equal(result.error.status, status); assert.equal(calls, 1);
        assert.ok(!JSON.stringify(result).includes('PRIVATE_')); assert.ok(!JSON.stringify(result).includes('secret.invalid'));
    }
    let calls = 0;
    const result = await run(async () => { calls++; return new Response(Readable.from((async function* () { yield frame(candidate([{ text: 'keep me' }])); throw new Error('PRIVATE_KEY'); })())); });
    assert.equal(result.state, 'partial'); assert.equal(result.text, 'keep me'); assert.equal(calls, 1);
    assert.equal(result.error.code, 'VERTEX_NETWORK');
});

test('caller cancellation during auth and during a response stops all I/O and preserves partial data', async () => {
    const early = new AbortController(); early.abort();
    let calls = 0;
    const canceled = await run(async () => { calls++; }, { ...context(), signal: early.signal });
    assert.equal(canceled.state, 'canceled'); assert.equal(calls, 0);
    const controller = new AbortController(); let upstreamSignal;
    const result = await createVertexGeneration({ resolveConnection, fetchImpl: async (_url, { signal }) => {
        upstreamSignal = signal;
        return new Response(Readable.from((async function* () { yield frame(candidate([{ text: 'partial' }])); controller.abort(); signal.throwIfAborted(); })()));
    } })({ ...context(), signal: controller.signal });
    assert.equal(result.state, 'canceled'); assert.equal(result.text, 'partial'); assert.equal(upstreamSignal.aborted, true);
});

test('deadline aborts upstream and settles with an explicit timeout, without leaving a timer', async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    let ready;
    const started = new Promise(resolve => { ready = resolve; });
    const promise = createVertexGeneration({ resolveConnection, fetchImpl: async (_url, { signal }) => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('abort')), { once: true }); ready();
    }) })(context({ vertexai_timeout: 30 }));
    await started; t.mock.timers.tick(30000);
    const result = await promise;
    assert.equal(result.error.code, 'VERTEX_DEADLINE'); assert.equal(result.state, 'failed');
});

test('API-key modes, regions and proxy origin policy produce bounded, credential-safe requests', async () => {
    const resolve = createVertexConnectionResolver({ readSecretImpl: () => 'PRIVATE_KEY', allowedProxyOrigins: () => ['https://proxy.invalid'] });
    const req = context();
    const c = await resolve(req, vertexOptions(req.body));
    assert.equal(c.headers['x-goog-api-key'], 'PRIVATE_KEY');
    assert.ok(!c.url.includes('PRIVATE_KEY'));
    assert.equal(vertexHost('eu'), 'https://aiplatform.eu.rep.googleapis.com');
    assert.equal(vertexHost('asia-northeast1'), 'https://asia-northeast1-aiplatform.googleapis.com');
    await assert.rejects(resolve(context({ reverse_proxy: 'https://blocked.invalid', proxy_password: 'PRIVATE_PROXY' }), vertexOptions(base)), /allowedReverseProxyOrigins/);
    for (const url of ['https://user:secret@proxy.invalid', 'https://proxy.invalid?key=secret', 'https://proxy.invalid#secret', 'file:///etc/passwd']) await assert.rejects(resolve(context({ reverse_proxy: url }), vertexOptions(base)));
    const proxied = await resolve(context({ reverse_proxy: 'https://proxy.invalid/v1/', proxy_password: 'PRIVATE_PROXY' }), vertexOptions(base));
    assert.equal(new URL(proxied.url).pathname, '/v1beta1/publishers/google/models/gemini-4-argon:streamGenerateContent');
    assert.equal(proxied.headers.Authorization, 'Bearer PRIVATE_PROXY');
    assert.equal(proxied.headers['x-goog-api-key'], undefined);
});

test('OAuth cache separates users and selected secrets, expires, invalidates, and forbids redirects', async () => {
    let now = 0, calls = 0, secret = 'one';
    const resolver = createVertexConnectionResolver({ now: () => now, readSecretImpl: () => JSON.stringify({ project_id: 'project', client_email: secret, private_key: 'PRIVATE_KEY' }), signJwt: async () => 'PRIVATE_ASSERTION',
        fetchImpl: async (_url, init) => { calls++; assert.equal(init.redirect, 'error'); assert.ok(init.signal); return new Response(JSON.stringify({ access_token: 'PRIVATE_TOKEN', expires_in: 3600 })); } });
    const a = context({ vertexai_auth_mode: 'full' }); const signal = new AbortController().signal;
    await resolver(a, vertexOptions(a.body), signal); await resolver(a, vertexOptions(a.body), signal); assert.equal(calls, 1);
    const b = structuredClone(a); b.user.directories.root = '/other-user';
    await resolver(b, vertexOptions(b.body), signal); assert.equal(calls, 2);
    secret = 'two'; const conn = await resolver(a, vertexOptions(a.body), signal); assert.equal(calls, 3);
    conn.invalidate(); await resolver(a, vertexOptions(a.body), signal); assert.equal(calls, 4);
    now = 3600000; await resolver(a, vertexOptions(a.body), signal); assert.equal(calls, 5);
});

test('browser records preserve Part boundaries, survive persistence/swipes, and refuse edited/model-changed replay', () => {
    const signed = [{ text: 'A', thoughtSignature: 'sig-A' }, { text: 'B' }, { text: 'C', thoughtSignature: 'sig-C' }];
    const parts = []; appendVertexParts(parts, signed); assert.deepEqual(parts, signed);
    const message = { mes: 'ABC', extra: {}, swipe_id: 0, swipe_info: [{}] };
    const record = vertexResponseRecord(parts, base.model);
    applyVertexMessageState(message, record, { state: 'completed' });
    const restored = JSON.parse(JSON.stringify(message));
    assert.deepEqual(reusableVertexResponse(restored, base.model).parts, signed);
    assert.deepEqual(restored.swipe_info[0].extra.vertex_response.parts, signed);
    assert.equal(reusableVertexResponse(restored, 'gemini-other'), null);
    restored.mes += 'edit'; assert.equal(reusableVertexResponse(restored, base.model), null);
    const response = reusableVertexResponse(message, base.model); response.promptText = 'ABC';
    const req = context({ messages: [{ role: 'assistant', content: 'ABC', vertex_response: response }, { role: 'user', content: 'next' }] });
    assert.deepEqual(buildVertexRequest(req).contents[0].parts, signed);
    req.body.messages[0].content = 'changed by prompt processing';
    assert.notDeepEqual(buildVertexRequest(req).contents[0].parts, signed);
    req.body.messages[0].content = 'Assistant: ABC';
    assert.deepEqual(buildVertexRequest(req).contents[0].parts, [{ text: 'Assistant: ' }, ...signed]);
    const changed = { mes: 'regex transformed text', extra: {} };
    applyVertexMessageState(changed, record, { state: 'completed' });
    assert.equal(reusableVertexResponse(changed, base.model), null);
    changed.mes = 'new'; applyVertexMessageState(changed, vertexResponseRecord([{ text: 'new' }], base.model), { state: 'completed' });
    assert.equal(changed.extra.reasoning_signature, null);
});

test('multi-tool history replays native Parts and matching IDs/results in order across multiple turns', async () => {
    const parts = [{ thought: true, text: 'plan', thoughtSignature: 'thinking' },
        { functionCall: { name: 'lookup', id: 'a', args: { location: 'A' } }, thoughtSignature: 'sig-a' },
        { functionCall: { name: 'lookup', id: 'b', args: { location: 'B' } } }];
    const response = vertexResponseRecord(parts, base.model);
    const messages = [{ role: 'user', content: 'lookup' }, { role: 'assistant', content: '', vertex_response: response,
        tool_calls: parts.filter(p => p.functionCall).map(p => ({ id: p.functionCall.id, function: { name: p.functionCall.name, arguments: JSON.stringify(p.functionCall.args) }, signature: p.thoughtSignature })) },
    { role: 'tool', tool_call_id: 'a', content: 'result A' }, { role: 'tool', tool_call_id: 'b', content: 'result B' }];
    const body = buildVertexRequest(context({ messages, tools: [tool('lookup')] }));
    assert.deepEqual(body.contents[1].parts, parts);
    assert.deepEqual(body.contents[2].parts.map(p => p.functionResponse.id), ['a', 'b']);
    assert.deepEqual(body.contents[2].parts.map(p => p.functionResponse.name), ['lookup', 'lookup']);
    const second = await run(async () => upstream([candidate([{ text: 'final', thoughtSignature: 'final-sig' }], 'STOP')]), context({ messages, tools: [tool('lookup')] }));
    assert.equal(second.state, 'completed'); assert.equal(second.signature, 'final-sig');
    let sent;
    await run(async (_url, init) => { sent = JSON.parse(init.body); return upstream([candidate([{ text: 'merged' }], 'STOP')]); }, context({ messages, tools: [tool('lookup')], custom_prompt_post_processing: 'merge_tools' }));
    assert.deepEqual(sent.contents[1].parts, parts);
});

function response() {
    const res = Object.assign(new EventEmitter(), { writes: [], headers: {}, statusCode: 200, destroyed: false, writableEnded: false, writableFinished: false });
    res.status = code => { res.statusCode = code; return res; };
    res.set = headers => { Object.assign(res.headers, headers); return res; };
    res.flushHeaders = () => { res.headersSent = true; };
    res.write = value => { res.writes.push(String(value)); return true; };
    res.end = value => { if (value) res.write(value); res.writableEnded = res.writableFinished = true; res.emit('finish'); };
    res.json = value => res.end(JSON.stringify(value));
    return res;
}

test('HTTP adapter owns early keepalives, one terminal, cleanup and disconnect cancellation', async () => {
    const req = Object.assign(new EventEmitter(), context()), res = response();
    let calls = 0;
    const generate = createVertexGeneration({ resolveConnection, fetchImpl: async (_url, { signal }) => { calls++; await sleep(20, null, { signal }); return upstream([candidate([{ text: 'done' }], 'STOP')]); } });
    await createVertexHandler({ generate, heartbeatMs: 3 })(req, res);
    const wire = res.writes.join('');
    assert.ok(wire.includes('vertex-native waiting')); assert.equal(calls, 1);
    assert.equal(wire.split('data: [DONE]').length - 1, 1);
    assert.equal(wire.split('"state":"completed"').length - 1, 1);
    assert.equal(req.listenerCount('aborted'), 0); assert.equal(res.listenerCount('close'), 0);
    const oldReq = context(), oldRes = response(); delete oldRes.flushHeaders;
    await createVertexHandler({ generate })(oldReq, oldRes); assert.equal(oldRes.statusCode, 409); assert.equal(calls, 1);
});

test('HTTP cancellation releases a backpressure wait and aborts the one upstream', async () => {
    const req = Object.assign(new EventEmitter(), context()), res = response();
    res.write = value => { res.writes.push(String(value)); queueMicrotask(() => { res.destroyed = true; res.emit('close'); }); return false; };
    let calls = 0;
    await createVertexHandler({ generate: createVertexGeneration({ resolveConnection, fetchImpl: async () => { calls++; return upstream([]); } }) })(req, res);
    assert.equal(calls, 0); assert.equal(res.listenerCount('drain'), 0); assert.equal(req.listenerCount('aborted'), 0);
});

test('a downstream that stops reading has a bounded drain wait, including after provider completion', async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const req = Object.assign(new EventEmitter(), context()), res = response();
    let ready;
    const blocked = new Promise(resolve => { ready = resolve; });
    res.write = value => {
        res.writes.push(value);
        if (String(value).includes('\"state\":\"completed\"')) { ready(); return false; }
        return true;
    };
    res.destroy = () => { res.destroyed = true; res.emit('close'); };
    const running = createVertexHandler({ drainTimeoutMs: 10, generate: createVertexGeneration({ resolveConnection, fetchImpl: async () => upstream([candidate([{ text: 'done' }], 'STOP')]) }) })(req, res);
    await blocked; t.mock.timers.tick(10); await running;
    assert.equal(res.destroyed, true); assert.equal(res.listenerCount('drain'), 0); assert.equal(req.listenerCount('aborted'), 0);
});
