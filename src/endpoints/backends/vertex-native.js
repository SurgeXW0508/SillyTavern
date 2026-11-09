// Vertex-only generation service and HTTP adapter. Derived from Shalistera 510fbb54.
// Generation owns upstream resources; the HTTP adapter owns the browser connection.
import fetch from 'node-fetch';
import { postProcessPrompt, getPromptNames } from '../../prompt-converters.js';
import { flattenSchema } from '../../util.js';
import { VertexError, VERTEX_LIMITS, vertexOptions, buildVertexRequest, readVertexSse, VertexFunctionStream } from './vertex-protocol.js';
import { resolveVertexConnection, readVertexJson, vertexHttpError } from './vertex-transport.js';

const usageKeys = ['promptTokenCount', 'candidatesTokenCount', 'thoughtsTokenCount', 'cachedContentTokenCount', 'totalTokenCount', 'toolUsePromptTokenCount'];

function appendParts(target, parts) {
    for (const part of parts || []) {
        const previous = target.at(-1);
        if (typeof part.text === 'string' && !part.thoughtSignature && previous && typeof previous.text === 'string' && !!previous.thought === !!part.thought && !previous.thoughtSignature) previous.text += part.text;
        else target.push(structuredClone(part));
        if (target.length > VERTEX_LIMITS.parts) throw new VertexError('VERTEX_RESPONSE_LIMIT', 'Too many Vertex response parts.');
    }
}

function publicError(error, timedOut, phase) {
    if (timedOut) return { code: 'VERTEX_DEADLINE', message: 'Vertex generation reached the configured total deadline.', status: 504, phase };
    if (error instanceof VertexError) return { code: error.code, message: error.message, status: error.status, apiStatus: error.apiStatus, phase };
    // Never relay network error.message/URL or arbitrary upstream errors (which can echo prompts/keys).
    return { code: 'VERTEX_NETWORK', message: 'The Vertex connection was interrupted or could not be established.', status: 502, phase };
}

/**
 * One invocation owns its deadline, upstream streams and terminal result.
 * emit(frame, signal) is awaitable for backpressure. It never receives credentials.
 * The HTTP adapter supplies browser cancellation and awaits outgoing frame writes.
 */
export function createVertexGeneration({ fetchImpl = fetch, resolveConnection = resolveVertexConnection } = {}) {
    return async function generateVertex(context, { emit = async () => {} } = {}) {
        const controller = new AbortController();
        const { signal } = controller;
        const cancel = () => controller.abort('caller');
        const parent = context.signal;
        parent?.addEventListener('abort', cancel, { once: true });
        if (parent?.aborted) cancel();
        const started = Date.now();
        const parts = [], usage = {}, seenTokens = new Set(), nativeMetadata = {}, candidateMetadata = {};
        let timer, remote, options, input, segments = 0, phase = 'configuration', finishReason, error, converter;
        const send = async frame => {
            signal.throwIfAborted();
            await emit(frame, signal);
            signal.throwIfAborted();
        };
        try {
            signal.throwIfAborted();
            input = { body: structuredClone(context.body), user: context.user };
            if (!input.body || typeof input.body !== 'object' || Array.isArray(input.body)) throw new VertexError('VERTEX_CONFIG', 'A request body is required.', 400);
            if (Buffer.byteLength(JSON.stringify(input.body)) > VERTEX_LIMITS.responseBytes) throw new VertexError('VERTEX_REQUEST_LIMIT', 'Vertex request exceeds the safety limit.', 413);
            options = vertexOptions(input.body);
            // Prepare a request snapshot without mutating the browser's settings.
            if (Array.isArray(input.body.messages) && input.body.custom_prompt_post_processing) input.body.messages = postProcessPrompt(input.body.messages, input.body.custom_prompt_post_processing, getPromptNames(input));
            if (input.body.json_schema?.value) input.body.json_schema.value = flattenSchema(input.body.json_schema.value, 'vertexai');
            const body = buildVertexRequest(input, options);
            converter = new VertexFunctionStream({ unwrapContent: options.unwrapContent });
            timer = setTimeout(() => controller.abort('deadline'), options.timeoutMs);
            timer.unref?.();
            let continuation;
            let receivedBytes = 0;
            do {
                signal.throwIfAborted();
                if (++segments > 32) throw new VertexError('VERTEX_CONTINUATION_LIMIT', 'Vertex continuation exceeded 32 segments.');
                phase = segments === 1 ? 'authentication' : 'continuation';
                await send({ vertexMeta: { phase, segments, ignoredParameters: options.ignoredParameters } });
                const connection = await resolveConnection(input, options, signal);
                signal.throwIfAborted();
                phase = 'waiting_for_vertex';
                await send({ vertexMeta: { phase, segments } });
                remote = await fetchImpl(connection.url, { method: 'POST', redirect: 'error', headers: connection.headers,
                    agent: connection.agent, signal, body: JSON.stringify(continuation ? { ...body, continuationToken: continuation } : body) });
                if (!remote.ok) {
                    if (remote.status === 401) connection.invalidate?.();
                    remote.body?.destroy();
                    throw vertexHttpError(remote.status);
                }
                phase = 'receiving';
                let latestUsage = {}, candidateToken, candidateReason;
                const handle = async raw => {
                    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new VertexError('VERTEX_INVALID_RESPONSE', 'Invalid Vertex response envelope.');
                    receivedBytes += Buffer.byteLength(JSON.stringify(raw));
                    if (receivedBytes > VERTEX_LIMITS.responseBytes) throw new VertexError('VERTEX_RESPONSE_LIMIT', 'Vertex generation exceeds the safety limit.');
                    if (raw.error) throw vertexHttpError(Number(raw.error.code) || 502, raw.error.status);
                    if (raw.promptFeedback?.blockReason) throw new VertexError('VERTEX_BLOCKED', 'Vertex blocked this prompt.', 400);
                    for (const [key, value] of Object.entries(raw)) if (!['candidates', 'usageMetadata', 'continuationToken'].includes(key)) nativeMetadata[key] = structuredClone(value);
                    if (raw.usageMetadata) latestUsage = raw.usageMetadata;
                    if (raw.candidates && (!Array.isArray(raw.candidates) || raw.candidates.length > 1 || raw.candidates.some(c => (c.index ?? 0) !== 0))) throw new VertexError('VERTEX_INVALID_RESPONSE', 'Expected one Vertex candidate.');
                    for (const candidate of raw.candidates || []) {
                        for (const [key, value] of Object.entries(candidate)) if (!['content', 'finishReason', 'continuationToken'].includes(key)) candidateMetadata[key] = structuredClone(value);
                        if (candidate.finishReason) {
                            if (!/^[A-Z_]{1,64}$/.test(candidate.finishReason)) throw new VertexError('VERTEX_INVALID_RESPONSE', 'Invalid Vertex finish reason.');
                            candidateReason = candidate.finishReason;
                        }
                        if (candidate.continuationToken) candidateToken = candidate.continuationToken;
                        delete candidate.continuationToken;
                        if (candidate.finishReason === 'CONTINUATION') delete candidate.finishReason;
                    }
                    delete raw.continuationToken;
                    const transformed = converter.transform(raw);
                    if (transformed.vertexEnvelope) nativeMetadata.vertexEnvelope = structuredClone(transformed.vertexEnvelope);
                    appendParts(parts, transformed.candidates?.[0]?.content?.parts);
                    await send(transformed);
                };
                if (input.body.stream === true) {
                    for await (const raw of readVertexSse(remote.body)) await handle(raw);
                } else await handle(await readVertexJson(remote, VERTEX_LIMITS.responseBytes));
                remote.body?.destroy();
                for (const key of usageKeys) if (Number.isFinite(latestUsage[key])) usage[key] = (usage[key] || 0) + latestUsage[key];
                if (latestUsage.trafficType) usage.trafficType = latestUsage.trafficType;
                finishReason = candidateReason;
                if (candidateReason === 'CONTINUATION') {
                    if (!candidateToken || typeof candidateToken !== 'string' || candidateToken.length > 1024 * 1024) throw new VertexError('VERTEX_CONTINUATION_MISSING', 'Vertex did not return a valid continuation token.');
                    if (!options.autoContinue) throw new VertexError('VERTEX_CONTINUATION_DISABLED', 'Vertex requires continuation; automatic continuation is disabled.');
                    if (seenTokens.has(candidateToken)) throw new VertexError('VERTEX_CONTINUATION_LOOP', 'Vertex repeated a continuation token.');
                    seenTokens.add(candidateToken);
                    continuation = candidateToken;
                } else continuation = undefined;
            } while (continuation);
            if (converter.active.size) throw new VertexError('VERTEX_INCOMPLETE_FUNCTION', 'Vertex ended with incomplete function arguments.');
            if (!finishReason) throw new VertexError('VERTEX_INCOMPLETE_STREAM', 'Vertex ended without a model finish marker.');
            if (!['STOP', 'MAX_TOKENS'].includes(finishReason)) throw new VertexError('VERTEX_FINISH', 'Vertex did not complete the response normally.');
            if (!converter.visibleChars && !converter.completed) throw new VertexError('VERTEX_EMPTY', 'Vertex returned no visible text, image or complete tool call.');
            signal.throwIfAborted();
        } catch (caught) {
            error = signal.aborted && controller.signal.reason !== 'deadline'
                ? { code: 'VERTEX_CANCELLED', message: 'Vertex generation was canceled.', status: 499, phase }
                : publicError(caught, controller.signal.reason === 'deadline', phase);
        } finally {
            clearTimeout(timer);
            remote?.body?.destroy();
            parent?.removeEventListener('abort', cancel);
        }
        const text = parts.filter(p => !p.thought).map(p => p.text || '').join('');
        const reasoning = parts.filter(p => p.thought).map(p => p.text || '').join('');
        const signature = parts.filter(p => !p.functionCall && p.thoughtSignature).at(-1)?.thoughtSignature || null;
        const state = error?.code === 'VERTEX_CANCELLED' ? 'canceled' : error ? (parts.length ? 'partial' : 'failed') : finishReason === 'MAX_TOKENS' ? 'partial' : 'completed';
        const vertexMeta = { phase: state, state, model: options?.model, finishReason, segments, elapsedMs: Date.now() - started,
            ignoredParameters: options?.ignoredParameters || [], ...(error ? { error } : {}), warning: finishReason === 'MAX_TOKENS' ? 'Vertex reached the output token limit; this response is partial.' : undefined };
        return { state, text, reasoning, signature, responseContent: { role: 'model', parts }, usageMetadata: usage, vertexMeta, error,
            candidate: { ...candidateMetadata, content: { role: 'model', parts }, finishReason },
            // Preserve native metadata (grounding, safety ratings, model/response IDs) for the HTTP result.
            metadata: nativeMetadata };
    };
}

export function vertexResultFrame(result, { stream = false } = {}) {
    const terminal = { vertexMeta: result.vertexMeta, usageMetadata: result.usageMetadata, ...(result.error ? { error: result.error } : {}) };
    if (stream) return terminal;
    return { ...result.metadata, ...terminal, candidates: [result.candidate], responseContent: result.responseContent,
        choices: [{ message: { content: result.text, reasoning: result.reasoning } }] };
}

/** Only the HTTP adapter owns Express events, keepalives, response headers and drain. */
export function createVertexHandler({ generate = createVertexGeneration(), heartbeatMs = 10000, drainTimeoutMs = 30000 } = {}) {
    return async function sendVertexRequest(request, response) {
        const controller = new AbortController();
        const stream = request.body?.stream === true;
        let heartbeat;
        const cancel = () => { if (!response.writableFinished) controller.abort(); };
        const incomingAborted = () => controller.abort();
        response.on('close', cancel);
        response.on('error', incomingAborted);
        request.on('aborted', incomingAborted);
        const write = async (value, signal) => {
            signal.throwIfAborted();
            if (response.destroyed || response.writableEnded) { controller.abort(); signal.throwIfAborted(); return; }
            if (!response.write(value)) await new Promise((resolve, reject) => {
                let deadline;
                const cleanup = () => { clearTimeout(deadline); response.off('drain', drained); signal.removeEventListener('abort', aborted); };
                const drained = () => { cleanup(); resolve(); };
                const aborted = () => { cleanup(); reject(new VertexError('VERTEX_CANCELLED', 'Downstream canceled.', 499)); };
                deadline = setTimeout(() => { cleanup(); controller.abort(); response.destroy?.(); reject(new VertexError('VERTEX_DOWNSTREAM_TIMEOUT', 'Downstream stopped reading.', 504)); }, drainTimeoutMs);
                deadline.unref?.();
                response.once('drain', drained);
                signal.addEventListener('abort', aborted, { once: true });
                if (signal.aborted) aborted();
            });
            response.flush?.();
        };
        try {
            if (request.aborted || response.destroyed) controller.abort();
            const result = await generate({ body: request.body, user: request.user, signal: controller.signal }, { emit: async (frame, signal) => {
                if (!response.headersSent) {
                    response.status(200).set({ 'Content-Type': stream ? 'text/event-stream; charset=utf-8' : 'application/json; charset=utf-8',
                        'Cache-Control': 'no-store, no-transform', 'X-Accel-Buffering': 'no' });
                    response.flushHeaders();
                    await write(stream ? ': vertex-native connected\n\n' : '\n', signal);
                    heartbeat = setInterval(() => {
                        if (!controller.signal.aborted && !signal.aborted && !response.destroyed && !response.writableEnded && !response.writableNeedDrain) {
                            response.write(stream ? ': vertex-native waiting\n\n' : '\n');
                            response.flush?.();
                        }
                    }, heartbeatMs);
                    heartbeat.unref?.();
                }
                if (stream) await write(`data: ${JSON.stringify(frame)}\n\n`, signal);
            } });
            if (controller.signal.aborted || response.destroyed || response.writableEnded) return;
            if (!response.headersSent) return response.status(result.error?.status || 200).json(vertexResultFrame(result));
            if (stream) {
                await write(`data: ${JSON.stringify(vertexResultFrame(result, { stream: true }))}\n\n`, controller.signal);
                await write('data: [DONE]\n\n', controller.signal);
                response.end();
            } else response.end(JSON.stringify(vertexResultFrame(result)));
        } catch {
            controller.abort();
            if (!response.destroyed && !response.writableEnded) response.end();
        } finally {
            clearInterval(heartbeat);
            request.off('aborted', incomingAborted);
            response.off('close', cancel);
            response.off('error', incomingAborted);
        }
    };
}

export const sendVertexRequest = createVertexHandler();
