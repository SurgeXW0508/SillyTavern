export const vertexDefaults = {
    vertexai_service_tier: 'auto',
    vertexai_request_type: 'auto',
    vertexai_api_version: 'auto',
    vertexai_timeout: 1200,
    vertexai_auto_continue: true,
    vertexai_argument_streaming: true,
    vertexai_unwrap_content: false,
};

export const vertexSettingsMap = Object.fromEntries(Object.entries(vertexDefaults)
    .map(([key, value]) => [key, [`#${key}`, key, typeof value === 'boolean', true]]));

export function initVertexUI(settings, save) {
    for (const [key, fallback] of Object.entries(vertexDefaults)) {
        const element = document.getElementById(key);
        element?.addEventListener('change', () => {
            settings[key] = typeof fallback === 'boolean' ? element.checked
                : typeof fallback === 'number' ? Number(element.value) : element.value;
            save();
        });
    }
}

const WAITING_PHASES = new Set(['connecting', 'authentication', 'waiting_for_vertex', 'continuation']);
const TERMINAL_STATES = new Set(['completed', 'partial', 'failed', 'canceled']);
const PHASE_LABELS = {
    connecting: '正在连接…',
    partial: '部分完成',
    failed: '失败',
    canceled: '已取消',
    authentication: '正在认证',
    waiting_for_vertex: '等待 Vertex',
    receiving: '接收正文',
    continuation: '正在续传',
    completed: '已完成',
};

let runtime = {};
let waitTimer = null;
let waitStartedAt = null;

function stopWaitTimer() {
    if (waitTimer !== null) {
        clearInterval(waitTimer);
        waitTimer = null;
    }
    waitStartedAt = null;
}

export function formatVertexUsage(usage) {
    if (!usage || typeof usage !== 'object') return '';
    const hasPrompt = Number.isFinite(usage.promptTokenCount);
    const hasCandidates = Number.isFinite(usage.candidatesTokenCount);
    const hasThoughts = Number.isFinite(usage.thoughtsTokenCount) && usage.thoughtsTokenCount > 0;
    const hasTotal = Number.isFinite(usage.totalTokenCount);
    if (!hasPrompt && !hasCandidates && !hasThoughts) {
        return hasTotal ? `${usage.totalTokenCount} tokens` : '';
    }
    const parts = [];
    if (hasPrompt) {
        let inputText = `输入 ${usage.promptTokenCount}`;
        if (Number.isFinite(usage.cachedContentTokenCount) && usage.cachedContentTokenCount > 0) {
            const pct = usage.promptTokenCount > 0 ? Math.round((usage.cachedContentTokenCount / usage.promptTokenCount) * 100) : 0;
            inputText += pct > 0 ? ` (缓存 ${usage.cachedContentTokenCount}, ${pct}%)` : ` (缓存 ${usage.cachedContentTokenCount})`;
        }
        parts.push(inputText);
    }
    if (hasThoughts) parts.push(`思考 ${usage.thoughtsTokenCount}`);
    if (hasCandidates) parts.push(`输出 ${usage.candidatesTokenCount}`);
    const breakdown = parts.join(' / ');
    return hasTotal ? `${breakdown} (${usage.totalTokenCount} tokens)` : breakdown;
}

function renderRuntime(output) {
    const details = [PHASE_LABELS[runtime.phase] || '正在请求'];
    if (WAITING_PHASES.has(runtime.phase) && waitStartedAt !== null) {
        const waitSeconds = Math.floor((Date.now() - waitStartedAt) / 1000);
        if (waitSeconds >= 1) details.push(`${waitSeconds}s`);
    } else if (TERMINAL_STATES.has(runtime.state) && Number.isFinite(runtime.elapsedMs) && runtime.elapsedMs >= 100) {
        details.push(`${(runtime.elapsedMs / 1000).toFixed(1)}s`);
    }
    if (runtime.trafficType) details.push(runtime.trafficType);
    if (runtime.segments > 1) details.push(`${runtime.segments} 段`);
    if (runtime.usageSummary) details.push(runtime.usageSummary);
    if (runtime.warning) details.push(runtime.warning);
    if (runtime.ignoredParameters?.length) details.push(`模型忽略：${runtime.ignoredParameters.join(', ')}`);
    const text = details.join(' · ');
    if (output.textContent !== text) output.textContent = text;
}

function ensureWaitTimer() {
    if (waitStartedAt === null) waitStartedAt = Date.now();
    if (waitTimer !== null) return;
    waitTimer = setInterval(() => {
        const output = globalThis.document?.getElementById?.('vertexai_runtime');
        if (!output || !WAITING_PHASES.has(runtime.phase)) {
            stopWaitTimer();
            return;
        }
        renderRuntime(output);
    }, 1000);
    waitTimer.unref?.();
}

export function resetVertexRuntime() {
    stopWaitTimer();
    runtime = {};
    const output = globalThis.document?.getElementById?.('vertexai_runtime');
    if (output) output.textContent = '';
}

export function updateVertexRuntime(frame) {
    const output = globalThis.document?.getElementById?.('vertexai_runtime');
    if (!output) {
        stopWaitTimer();
        return;
    }
    if (frame === null) {
        stopWaitTimer();
        runtime = { phase: 'connecting' };
        ensureWaitTimer();
        renderRuntime(output);
        return;
    }
    if (frame.error) {
        stopWaitTimer();
        output.textContent = `${frame.vertexMeta?.state === 'partial' ? '部分完成 · ' : ''}${frame.error.message || 'Vertex 请求失败'}`;
        return;
    }
    const wasWaiting = WAITING_PHASES.has(runtime.phase);
    Object.assign(runtime, frame.vertexMeta || {});
    if (frame.usageMetadata?.trafficType) runtime.trafficType = frame.usageMetadata.trafficType;
    if (!frame.vertexMeta?.state && frame.candidates?.some(c => c.content?.parts?.length)) runtime.phase = 'receiving';
    if (TERMINAL_STATES.has(frame.vertexMeta?.state)) {
        runtime.usageSummary = formatVertexUsage(frame.usageMetadata);
    }
    if (WAITING_PHASES.has(runtime.phase) && !TERMINAL_STATES.has(runtime.state)) {
        if (!wasWaiting) waitStartedAt = Date.now();
        ensureWaitTimer();
    } else {
        stopWaitTimer();
    }
    renderRuntime(output);
}
