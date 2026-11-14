// Adapted from Shalistera/SillyTavern 510fbb545f3c713c869e86fff106b3d1a830ce63.
// Gemini 4 (Argon / Carbon / Hydrogen) REST contracts: https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/guides/gemini-4-argon
// Partial arguments: https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/tools/function-calling
import { StringDecoder } from 'node:string_decoder';
import { convertGooglePrompt, getPromptNames, calculateGoogleBudgetTokens } from '../../prompt-converters.js';
import { GEMINI_SAFETY, VERTEX_SAFETY } from '../../constants.js';

export class VertexError extends Error {
    constructor(code, message, status = 502) {
        super(message);
        this.name = 'VertexError';
        this.code = code;
        this.status = status;
    }
}

const fail = message => { throw new VertexError('VERTEX_CONFIG', message, 400); };
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const isGemini4 = model => typeof model === 'string' && /^gemini-4(?:[.-]|$)/i.test(model);
const CONSERVATIVE_GEMINI4_PROFILE = Object.freeze({
    label: 'Gemini 4',
    flex: false,
    v1SegmentCap: Object.freeze({ stream: 65536, nonStream: 32768 }),
    maxThinkingLevel: 'HIGH',
    prefixMismatchBehavior: 'DROP',
});
const GEMINI4_TEXT_PROFILES = Object.freeze({
    argon: Object.freeze({
        label: 'Argon',
        flex: false,
        v1SegmentCap: Object.freeze({ stream: 65536, nonStream: 32768 }),
        maxThinkingLevel: 'HIGH',
        prefixMismatchBehavior: 'DROP',
    }),
    carbon: Object.freeze({
        label: 'Carbon',
        flex: false,
        v1SegmentCap: Object.freeze({ stream: 65536, nonStream: 32768 }),
        maxThinkingLevel: 'HIGH',
        prefixMismatchBehavior: 'DROP',
    }),
    hydrogen: Object.freeze({
        label: 'Hydrogen',
        flex: true,
        v1SegmentCap: Object.freeze({ stream: 65536, nonStream: 65536 }),
        maxThinkingLevel: 'XHIGH',
        prefixMismatchBehavior: 'DROP',
    }),
});
export function gemini4TextProfile(model) {
    if (!isGemini4(model) || /-image(?:-|$)/i.test(model)) return null;
    const variant = /^gemini-4-([a-z0-9]+)(?:-|$)/i.exec(model)?.[1]?.toLowerCase();
    return (variant && Object.hasOwn(GEMINI4_TEXT_PROFILES, variant))
        ? GEMINI4_TEXT_PROFILES[variant]
        : CONSERVATIVE_GEMINI4_PROFILE;
}
const modern = model => typeof model === 'string' && /^gemini-[34](?:[.-]|$)/i.test(model);
const STRICT_GEMINI3_MODEL_RE = /gemini-3\.[678]-flash|gemini-3\.5-flash-lite/i;
export const isNoSamplingModel = model => Boolean(gemini4TextProfile(model)) || STRICT_GEMINI3_MODEL_RE.test(model);
export const rejectsPrefillModel = model => Boolean(gemini4TextProfile(model)) || STRICT_GEMINI3_MODEL_RE.test(model);
export const VERTEX_LIMITS = Object.freeze({ eventBytes: 32 * 1024 * 1024, responseBytes: 64 * 1024 * 1024, argumentBytes: 4 * 1024 * 1024, parts: 100000, calls: 1024 });
export const ALLOWED_POLICY_REASONS = new Set([
    'SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'OTHER', 'MODEL_ARMOR', 'JAILBREAK',
    'RECITATION', 'MALFORMED_FUNCTION_CALL', 'UNEXPECTED_TOOL_CALL', 'TOO_MANY_TOOL_CALLS',
    'IMAGE_SAFETY', 'IMAGE_PROHIBITED_CONTENT', 'IMAGE_RECITATION', 'IMAGE_OTHER', 'NO_IMAGE', 'LANGUAGE',
]);

function resolveThinkingLevel(model, effort) {
    const normalized = effort === 'minimal' ? 'min' : effort;
    if (!['min', 'low', 'medium', 'high', 'max'].includes(normalized)) return null;
    if (/^gemini-3(?:\.0)?-pro-image/i.test(model)) return 'HIGH';
    if (/^gemini-3\.1-flash(?:-lite)?-image/i.test(model)) {
        return ['high', 'max'].includes(normalized) ? 'HIGH' : 'MINIMAL';
    }
    if (/^gemini-3(?:\.0)?-pro(?:-|$)/i.test(model)) {
        return ['high', 'max'].includes(normalized) ? 'HIGH' : 'LOW';
    }
    const noMinimal = isGemini4(model) || /gemini-3\.[78]-flash|-pro(?:-|$)/i.test(model);
    return {
        min: noMinimal ? 'LOW' : 'MINIMAL',
        low: 'LOW',
        medium: 'MEDIUM',
        high: 'HIGH',
        max: gemini4TextProfile(model)?.maxThinkingLevel ?? 'HIGH',
    }[normalized];
}

function choice(value, allowed, fallback, field) {
    if (value === undefined || value === null || value === '') return fallback;
    if (!allowed.includes(value)) fail(`${field} 的值无效。`);
    return value;
}

export function vertexOptions(input) {
    const model = String(input.model || '');
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(model)) fail('Vertex 模型 ID 无效。');
    if (input.tools !== undefined && !Array.isArray(input.tools)) fail('tools 应为数组。');
    const gemini4 = gemini4TextProfile(model);
    const omitSampling = isNoSamplingModel(model);
    if (input.n !== undefined && Number(input.n) !== 1) fail('Vertex Native only supports one candidate per request.');
    if (input.logprobs || input.top_logprobs || (input.logit_bias && Object.keys(input.logit_bias).length)) fail('Vertex Native does not support logprobs or logit bias.');
    const hasSeed = input.seed !== undefined && input.seed !== null && input.seed !== ''
        && typeof input.seed !== 'boolean' && Number.isFinite(Number(input.seed)) && Number(input.seed) >= 0;
    const ignoredParameters = omitSampling ? [
        ...(input.temperature !== undefined ? ['temperature'] : []),
        ...(input.top_p !== undefined ? ['top_p'] : []),
        ...(Number(input.top_k) > 0 ? ['top_k'] : []),
        ...(Number(input.frequency_penalty || 0) !== 0 ? ['frequency_penalty'] : []),
        ...(Number(input.presence_penalty || 0) !== 0 ? ['presence_penalty'] : []),
        ...(gemini4 && hasSeed ? ['seed'] : []),
    ] : [];
    if (gemini4 && !['global', 'us', 'eu'].includes(input.vertexai_region || 'global')) fail(`${gemini4.label} requires global, us or eu.`);
    const tier = choice(input.vertexai_service_tier, ['auto', 'standard', 'priority', 'flex'], 'auto', '服务档位');
    const capacity = choice(input.vertexai_request_type, ['auto', 'shared', 'dedicated'], 'auto', '容量类型');
    const version = choice(input.vertexai_api_version, ['auto', 'v1', 'v1beta1'], 'auto', 'API 版本');
    const timeout = Number(input.vertexai_timeout ?? 1200);
    if (!Number.isFinite(timeout) || timeout < 30 || timeout > 7200) fail('总等待上限应为 30～7200 秒。');
    if (tier === 'flex' && (input.vertexai_region || 'global') !== 'global') fail('Flex 需要 global 区域。');
    if (gemini4 && !gemini4.flex && tier === 'flex') fail(`当前 Vertex 官方 Flex 支持列表未列出 ${gemini4.label}，请选择默认、Standard 或 Priority。`);
    if (capacity === 'dedicated' && tier !== 'auto') fail('仅专用容量与 PayGo 档位不能同时指定。');
    const autoContinue = input.vertexai_auto_continue !== false && Boolean(gemini4);
    const max = Number(input.max_tokens ?? 65536);
    if (!Number.isInteger(max) || max < 1 || max > 1048576) fail('输出上限应为 1～1048576 个 token。');
    if (gemini4 && version === 'v1' && autoContinue) {
        const v1Cap = input.stream ? gemini4.v1SegmentCap.stream : gemini4.v1SegmentCap.nonStream;
        if (max > v1Cap) fail(`${gemini4.label} 超长续传需要 v1beta1，请将 API 版本设为自动或 v1beta1。`);
    }
    return { model, gemini4, omitSampling, tier, capacity, max, timeoutMs: timeout * 1000, autoContinue,
        apiVersion: version === 'auto' ? (gemini4 ? 'v1beta1' : 'v1') : version,
        streamArguments: modern(model) && !/^gemini-3\.1-flash-lite/.test(model) && input.stream === true && input.vertexai_argument_streaming !== false,
        ignoredParameters,
        unwrapContent: input.vertexai_unwrap_content === true && input.tools?.length === 1 && input.tools[0]?.function?.name === 'actual_content' };
}

/** Build one immutable request; continuation changes only the top-level token. */
export function buildVertexRequest(request, options = vertexOptions(request.body)) {
    const input = request.body;
    if (!Array.isArray(input.messages) || !input.messages.length) fail('Vertex 请求需要非空消息列表。');
    const prompt = convertGooglePrompt(structuredClone(input.messages), options.model, !!input.use_sysprompt, getPromptNames(request), { nativeVertex: true });
    const rejectsPrefill = rejectsPrefillModel(options.model);
    if (rejectsPrefill && prompt.contents.at(-1)?.role === 'model') {
        if (input.type !== 'continue') fail('This model does not accept assistant prefill. Use Continue or end the history with a user/tool result.');
        prompt.contents.push({ role: 'user', parts: [{ text: 'Continue the previous assistant response from where it ended, without repeating it.' }] });
    }
    const config = { maxOutputTokens: options.max };
    if (!options.omitSampling) {
        if (typeof input.temperature === 'number' && Number.isFinite(input.temperature)) config.temperature = input.temperature;
        if (typeof input.top_p === 'number' && Number.isFinite(input.top_p)) config.topP = input.top_p;
        if (typeof input.top_k === 'number' && Number.isFinite(input.top_k) && input.top_k > 0) config.topK = input.top_k;
        if (typeof input.frequency_penalty === 'number' && Number.isFinite(input.frequency_penalty) && input.frequency_penalty !== 0) config.frequencyPenalty = input.frequency_penalty;
        if (typeof input.presence_penalty === 'number' && Number.isFinite(input.presence_penalty) && input.presence_penalty !== 0) config.presencePenalty = input.presence_penalty;
    }
    if (!options.gemini4 && typeof input.seed === 'number' && Number.isFinite(input.seed) && input.seed >= 0) {
        config.seed = input.seed;
    }
    if (input.stop !== undefined && (!Array.isArray(input.stop) || input.stop.length > 5 || input.stop.some(x => typeof x !== 'string' || !x.length || x.length > 512))) fail('Vertex stop sequences must be at most five non-empty strings.');
    if (Array.isArray(input.stop) && input.stop.length) config.stopSequences = input.stop;
    if (input.responseMimeType) config.responseMimeType = input.responseMimeType;
    const schema = input.responseSchema ?? input.json_schema?.value;
    if (schema) { config.responseSchema = schema; config.responseMimeType ||= 'application/json'; }
    if (modern(options.model)) {
        config.thinkingConfig = { includeThoughts: !!input.include_reasoning };
        if (options.gemini4?.prefixMismatchBehavior) {
            config.thinkingConfig.prefixMismatchBehavior = options.gemini4.prefixMismatchBehavior;
        }
        const effort = input.reasoning_effort;
        if (effort && effort !== 'auto') {
            const level = resolveThinkingLevel(options.model, effort);
            if (!level) fail('此模型需要 auto、low、medium 或 high 思考档位。');
            config.thinkingConfig.thinkingLevel = level;
        }
    } else if (/^gemini-2\.5-(?:flash|pro)/.test(options.model) && !/-image/.test(options.model)) {
        const budget = calculateGoogleBudgetTokens(options.max, input.reasoning_effort || 'auto', options.model);
        config.thinkingConfig = { includeThoughts: budget === 0 ? false : !!input.include_reasoning };
        if (Number.isInteger(budget)) config.thinkingConfig.thinkingBudget = budget;
    }
    if (input.request_images) {
        if (options.gemini4) fail(`${options.gemini4.label} 返回文本，图像生成需要选择图像模型。`);
        config.responseModalities = ['TEXT', 'IMAGE'];
        const imageConfig = {};
        if (input.request_image_resolution && modern(options.model)) imageConfig.imageSize = input.request_image_resolution;
        if (input.request_image_aspect_ratio) imageConfig.aspectRatio = input.request_image_aspect_ratio;
        if (Object.keys(imageConfig).length) config.imageConfig = imageConfig;
    }
    const body = { contents: prompt.contents, generationConfig: config, safetySettings: [...GEMINI_SAFETY, ...VERTEX_SAFETY] };
    if (prompt.system_instruction.parts.length) body.systemInstruction = prompt.system_instruction;
    const declarations = [], tools = [];
    for (const tool of input.tools || []) {
        if (!object(tool)) fail('工具定义应为对象。');
        if (tool.type === 'function') {
            if (!object(tool.function) || typeof tool.function.name !== 'string') fail('函数定义缺少名称。');
            const fn = structuredClone(tool.function);
            delete fn.strict;
            if (fn.parameters) delete fn.parameters.$schema;
            if (fn.parameters?.properties && !Object.keys(fn.parameters.properties).length) delete fn.parameters;
            declarations.push(fn);
        } else if (['google_search', 'googleSearch', 'url_context', 'urlContext', 'code_execution', 'codeExecution', 'retrieval', 'googleMaps'].includes(tool.type) && tool[tool.type]) {
            const key = ({ google_search: 'googleSearch', url_context: 'urlContext', code_execution: 'codeExecution' })[tool.type] || tool.type;
            if (!object(tool[tool.type])) fail('Native tool configuration must be an object.');
            tools.push({ [key]: structuredClone(tool[tool.type]) });
        } else fail('Unsupported Vertex tool type. Use function, googleSearch, urlContext, codeExecution, retrieval or googleMaps.');
    }
    if (declarations.length > 128) fail('Too many Vertex function declarations.');
    if (declarations.length) tools.unshift({ functionDeclarations: declarations });
    if (input.enable_web_search) tools.push({ googleSearch: {} });
    if (tools.length) body.tools = tools;
    if (declarations.length) {
        const selected = input.tool_choice;
        if (selected !== undefined && !['auto', 'none', 'required', 'validated'].includes(selected) && !(object(selected) && selected.type === 'function' && declarations.some(f => f.name === selected.function?.name))) fail('Invalid Vertex tool_choice.');
        const mode = { auto: 'AUTO', none: 'NONE', required: 'ANY', validated: 'VALIDATED' }[selected] || 'AUTO';
        body.toolConfig = { functionCallingConfig: { mode } };
        if (selected?.function?.name) body.toolConfig.functionCallingConfig = { mode: 'ANY', allowedFunctionNames: [selected.function.name] };
    }
    if (options.gemini4) {
        const thinking = body.generationConfig.thinkingConfig;
        if (thinking?.thinkingBudget !== undefined) fail(`${options.gemini4.label} 使用 thinkingLevel，不支持 thinkingBudget。`);
        const allowedLevels = options.gemini4.maxThinkingLevel === 'XHIGH'
            ? ['LOW', 'MEDIUM', 'HIGH', 'XHIGH']
            : ['LOW', 'MEDIUM', 'HIGH'];
        if (thinking?.thinkingLevel && !allowedLevels.includes(thinking.thinkingLevel)) {
            fail(`${options.gemini4.label} thinkingLevel 只支持 ${allowedLevels.join('、')}。`);
        }
        if (thinking?.prefixMismatchBehavior && !['DROP', 'ERROR'].includes(thinking.prefixMismatchBehavior)) {
            fail(`${options.gemini4.label} prefixMismatchBehavior 只支持 DROP、ERROR。`);
        }
    }
    if (options.omitSampling) {
        for (const key of ['temperature', 'topP', 'topK', 'candidateCount', 'frequencyPenalty', 'presencePenalty']) delete body.generationConfig[key];
    }
    if (body.tools && !Array.isArray(body.tools)) fail('tools 应为数组。');
    const hasFunctions = body.tools?.some(t => t.functionDeclarations?.length || t.function_declarations?.length);
    if (hasFunctions && options.streamArguments) {
        body.toolConfig ||= {};
        body.toolConfig.functionCallingConfig ||= { mode: 'AUTO' };
        body.toolConfig.functionCallingConfig.streamFunctionCallArguments = true;
    }
    if (!modern(options.model) && hasFunctions && body.tools.some(t => !t.functionDeclarations && !t.function_declarations)) {
        fail('此旧模型的函数调用与内置工具组合不受支持，请关闭搜索、URL 读取或代码执行。');
    }
    if (body.generationConfig.candidateCount && body.generationConfig.candidateCount !== 1) fail('当前聊天通道每次接收一个候选回复。');
    return body;
}

/** Parse complete SSE frames before forwarding so heartbeat comments cannot split JSON. */
export async function* readVertexSse(readable) {
    const decoder = new StringDecoder('utf8');
    let pending = '';
    const parse = event => {
        if (Buffer.byteLength(event) > VERTEX_LIMITS.eventBytes) throw new VertexError('VERTEX_EVENT_LIMIT', 'Vertex 单个流事件超过 32 MiB。');
        const data = event.split(/\r\n|\n|\r/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
        if (!data || data === '[DONE]') return null;
        try { return JSON.parse(data); } catch { throw new VertexError('VERTEX_INVALID_STREAM', 'Vertex 返回了无法解析的流式 JSON。'); }
    };
    for await (const chunk of readable) {
        pending += decoder.write(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        let boundary;
        while ((boundary = /\r\n\r\n|\n\n|\r\r/.exec(pending))) {
            const value = parse(pending.slice(0, boundary.index));
            pending = pending.slice(boundary.index + boundary[0].length);
            if (value !== null) yield value;
        }
        if (Buffer.byteLength(pending) > VERTEX_LIMITS.eventBytes) throw new VertexError('VERTEX_EVENT_LIMIT', 'Vertex 单个流事件超过 32 MiB。');
    }
    pending += decoder.end();
    if (pending.trim()) {
        const value = parse(pending);
        if (value !== null) yield value;
    }
}

function pathTokens(jsonPath) {
    if (typeof jsonPath !== 'string' || jsonPath[0] !== '$') fail('函数参数片段缺少有效 JSONPath。');
    const keys = [];
    const pattern = /\.([\w$-]+)|\[(\d+)|\["((?:\\.|[^"\\])*)"\]|\['((?:\\.|[^'\\])*)'\]/gy;
    let at = 1;
    while (at < jsonPath.length) {
        pattern.lastIndex = at;
        const match = pattern.exec(jsonPath);
        if (!match) fail('函数参数包含无法解析的 JSONPath。');
        let key;
        if (match[2] !== undefined) {
            if (jsonPath[pattern.lastIndex] !== ']') fail('函数数组索引格式错误。');
            at = pattern.lastIndex + 1;
            key = Number(match[2]);
            if (key > 100000) fail('函数数组索引过大。');
        } else {
            at = pattern.lastIndex;
            key = match[1] ?? (match[3] !== undefined ? JSON.parse('"' + match[3] + '"') : match[4].replace(/\\'/g, '\''));
        }
        if (['__proto__', 'prototype', 'constructor'].includes(key)) fail('函数参数包含禁止的对象键。');
        keys.push(key);
        if (keys.length > 64) fail('函数参数嵌套超过限制。');
    }
    if (!keys.length) fail('函数参数片段必须指向一个属性。');
    return keys;
}

export class VertexFunctionStream {
    constructor({ unwrapContent = false } = {}) {
        this.unwrapContent = unwrapContent;
        this.active = new Map();
        this.completed = 0;
        this.visibleChars = 0;
        this.signature = '';
        this.argumentBytes = 0;
        this.order = [];
        this.finished = new Map();
        this.completedIds = new Set();
    }

    transform(frame) {
        for (const candidate of frame.candidates || []) {
            const index = candidate.index ?? 0;
            const output = [];
            for (const part of candidate.content?.parts || []) {
                const call = part.functionCall;
                if (!call) {
                    if (!part.thought && typeof part.text === 'string') this.visibleChars += part.text.trim().length;
                    if (part.inlineData && !part.thought) this.visibleChars++;
                    output.push(part);
                    continue;
                }
                // Google streams calls sequentially when no ID is available. Explicit IDs may interleave.
                const pendingKeys = [...this.active.keys()].filter(k => k.startsWith(`${index}:`));
                if (!call.id && pendingKeys.length > 1) throw new VertexError('VERTEX_INVALID_STREAM', 'Ambiguous interleaved function arguments without a call ID.');
                const key = call.id ? `${index}:${call.id}` : pendingKeys[0] || `${index}:anonymous`;
                if (call.id && !this.active.has(key) && this.active.has(`${index}:anonymous`)) {
                    this.active.set(key, this.active.get(`${index}:anonymous`));
                    this.active.delete(`${index}:anonymous`);
                    this.order = this.order.map(k => k === `${index}:anonymous` ? key : k);
                }
                if (call.id && (typeof call.id !== 'string' || call.id.length > 1024)) throw new VertexError('VERTEX_INVALID_STREAM', 'Invalid function call ID.');
                if (call.id && this.completedIds.has(call.id)) throw new VertexError('VERTEX_DUPLICATE_FUNCTION', 'Vertex repeated a completed function call ID.');
                let state = this.active.get(key);
                this.argumentBytes += Buffer.byteLength(JSON.stringify(call));
                if (this.argumentBytes > VERTEX_LIMITS.argumentBytes || this.completed > VERTEX_LIMITS.calls) throw new VertexError('VERTEX_ARGUMENT_LIMIT', 'Vertex function arguments exceed the configured safety limit.');
                if (!state) {
                    state = { name: call.name, id: call.id, args: {}, openStrings: new Set(), emitted: '', signature: '' };
                    this.active.set(key, state);
                    this.order.push(key);
                }
                if (call.name) {
                    if (state.name && state.name !== call.name) throw new VertexError('VERTEX_INVALID_STREAM', '函数参数流发生交错，无法安全拼接。');
                    state.name = call.name;
                }
                if (call.id) {
                    if (state.id && state.id !== call.id) throw new VertexError('VERTEX_INVALID_STREAM', '函数调用 ID 在参数传输中发生变化。');
                    state.id = call.id;
                }
                if (part.thoughtSignature) state.signature = part.thoughtSignature;
                for (const fragment of call.partialArgs || []) {
                    const keys = pathTokens(fragment.jsonPath);
                    let target = state.args;
                    for (let i = 0; i < keys.length - 1; i++) {
                        target = target[keys[i]] ??= typeof keys[i + 1] === 'number' ? [] : {};
                        if (!target || typeof target !== 'object') throw new VertexError('VERTEX_INVALID_STREAM', '函数参数路径与已接收的值冲突。');
                    }
                    const key = keys.at(-1);
                    const valueKey = ['stringValue', 'numberValue', 'boolValue', 'nullValue'].find(k => Object.hasOwn(fragment, k));
                    // Google may omit an empty string value on the closing fragment.
                    if (!valueKey) {
                        if (!state.openStrings.has(fragment.jsonPath) || fragment.willContinue) throw new VertexError('VERTEX_INVALID_STREAM', '函数参数片段缺少值。');
                        state.openStrings.delete(fragment.jsonPath);
                        continue;
                    }
                    const value = valueKey === 'nullValue' ? null : fragment[valueKey];
                    target[key] = state.openStrings.has(fragment.jsonPath) ? String(target[key] ?? '') + value : value;
                    if (fragment.willContinue && valueKey === 'stringValue') state.openStrings.add(fragment.jsonPath);
                    else state.openStrings.delete(fragment.jsonPath);
                }
                if (call.args !== undefined) {
                    if (!object(call.args)) throw new VertexError('VERTEX_INVALID_STREAM', 'Vertex 函数参数应为 JSON 对象。');
                    if (state.openStrings.size) throw new VertexError('VERTEX_INVALID_STREAM', 'Full arguments arrived before partial strings completed.');
                    state.args = structuredClone(call.args);
                }
                if (this.unwrapContent && state.name === 'actual_content') {
                    const content = state.args.content;
                    if (typeof content === 'string') {
                        if (!content.startsWith(state.emitted)) throw new VertexError('VERTEX_INVALID_STREAM', '正文参数流与已输出内容不一致。');
                        const text = content.slice(state.emitted.length);
                        state.emitted = content;
                        this.visibleChars += text.trim().length;
                        if (text) output.push({ text });
                    }
                }
                if (call.willContinue !== true) {
                    if (state.openStrings.size) throw new VertexError('VERTEX_INCOMPLETE_FUNCTION', '函数调用结束时字符串参数尚未传完。');
                    if (!state.name) throw new VertexError('VERTEX_INVALID_STREAM', '完整函数调用缺少名称。');
                    const original = { functionCall: { name: state.name, args: state.args, ...(state.id ? { id: state.id } : {}) },
                        ...(state.signature ? { thoughtSignature: state.signature } : {}) };
                    if (this.unwrapContent && state.name === 'actual_content') {
                        // This signature belongs to the original function Part, not to the displayed text.
                        frame.vertexEnvelope = original;
                        this.order = this.order.filter(k => k !== key);
                    } else {
                        this.finished.set(key, original);
                        while (this.finished.has(this.order[0])) {
                            const first = this.order.shift();
                            output.push(this.finished.get(first));
                            this.finished.delete(first);
                            this.completed++;
                        }
                    }
                    if (state.id) this.completedIds.add(state.id);
                    this.active.delete(key);
                }
            }
            if (candidate.content) candidate.content.parts = output;
        }
        return frame;
    }
}
