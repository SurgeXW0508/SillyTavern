// Native Vertex transport, adapted from Shalistera/SillyTavern 510fbb54.
// No request bodies, credentials, OAuth assertions or upstream error bodies are logged.
import fetch from 'node-fetch';
import { createHash } from 'node:crypto';
import { readSecret, SECRET_KEYS } from '../secrets.js';
import { generateJWTToken, getProjectIdFromServiceAccount, getVertexHost } from '../google.js';
import { getUntrustedRequestAgent } from '../../private-request-filter.js';
import { getConfigValue } from '../../util.js';
import { VertexError } from './vertex-protocol.js';

export function vertexHost(region) {
    const host = getVertexHost(region);
    if (!host) throw new VertexError('VERTEX_CONFIG', 'Invalid Vertex region.', 400);
    return host;
}

const ALLOWED_RPC_STATUSES = new Set([
    'INVALID_ARGUMENT', 'FAILED_PRECONDITION', 'OUT_OF_RANGE', 'UNAUTHENTICATED',
    'PERMISSION_DENIED', 'NOT_FOUND', 'ABORTED', 'ALREADY_EXISTS',
    'RESOURCE_EXHAUSTED', 'CANCELLED', 'DATA_LOSS', 'UNKNOWN',
    'INTERNAL', 'UNIMPLEMENTED', 'UNAVAILABLE', 'DEADLINE_EXCEEDED',
]);

const ALLOWED_ERROR_REASONS = new Set([
    'API_KEY_INVALID', 'API_KEY_EXPIRED', 'API_KEY_HTTP_REFERRER_BLOCKED', 'API_KEY_IP_ADDRESS_BLOCKED',
    'API_KEY_SERVICE_BLOCKED', 'ACCESS_TOKEN_EXPIRED', 'ACCESS_TOKEN_TYPE_UNSUPPORTED',
    'ACCESS_TOKEN_SCOPE_INSUFFICIENT', 'CREDENTIALS_MISSING', 'ACCOUNT_STATE_INVALID',
    'BILLING_DISABLED', 'SERVICE_DISABLED', 'CONSUMER_INVALID', 'CONSUMER_SUSPENDED',
    'PROJECT_DELETED', 'PROJECT_INVALID', 'USER_PROJECT_DENIED', 'IAM_PERMISSION_DENIED',
    'ORG_POLICY_VIOLATED', 'VPC_SERVICE_CONTROLS_BLOCKED', 'RATE_LIMIT_EXCEEDED',
    'QUOTA_EXCEEDED', 'RESOURCE_USAGE_RESTRICTION_VIOLATED', 'OVERLOADED',
    'MODEL_NOT_FOUND', 'PUBLISHER_MODEL_NOT_FOUND', 'LOCATION_INVALID',
    'LOCATION_TAXONOMY_INVALID', 'REGION_NOT_SUPPORTED',
]);

const ALLOWED_FIELD_PATH = /^(?:generationConfig|generation_config|thinkingConfig|thinking_config|toolConfig|tool_config|tools|systemInstruction|system_instruction|contents|safetySettings|safety_settings|model|labels|cachedContent|cached_content)(?:\.[a-z][a-zA-Z0-9_]{0,48}|\[\d{1,4}\]){0,8}$/;

/** Bounded decoded bytes, used for JSON success responses. */
export async function readVertexJson(response, limit = 65536) {
    const chunks = [];
    let bytes = 0;
    try {
        for await (const chunk of response.body || []) {
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            bytes += buffer.length;
            if (bytes > limit) throw new VertexError('VERTEX_RESPONSE_LIMIT', 'Vertex response exceeds the safety limit.');
            chunks.push(buffer);
        }
        try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new VertexError('VERTEX_INVALID_RESPONSE', 'Vertex returned invalid JSON.'); }
    } finally {
        response.body?.destroy();
    }
}

/** Safely read at most 16 KiB from an HTTP error body within 5s to extract structured RPC enums; never throws. */
export async function readVertexErrorEnvelope(response, limit = 16384, timeoutMs = 5000) {
    let timer;
    try {
        const readBody = (async () => {
            const chunks = [];
            let bytes = 0;
            for await (const chunk of response?.body || []) {
                const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
                bytes += buffer.length;
                if (bytes > limit) return null;
                chunks.push(buffer);
            }
            if (!bytes) return null;
            const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            const envelope = Array.isArray(parsed) ? parsed[0]?.error : parsed?.error;
            return envelope && typeof envelope === 'object' && !Array.isArray(envelope) ? envelope : null;
        })();
        readBody.catch(() => null);
        const timeout = new Promise(resolve => {
            timer = setTimeout(() => {
                response?.body?.destroy?.();
                resolve(null);
            }, timeoutMs);
            timer.unref?.();
        });
        return await Promise.race([readBody, timeout]);
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
        response?.body?.destroy?.();
    }
}

function extractVertexErrorDiagnostics(envelope) {
    if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) return { apiStatus: undefined, tags: [] };
    // Never inspect envelope.message or fieldViolations[].description, which can echo prompts/keys/URLs.
    const apiStatus = typeof envelope.status === 'string' && ALLOWED_RPC_STATUSES.has(envelope.status) ? envelope.status : undefined;
    const tags = apiStatus ? [apiStatus] : [];
    const details = Array.isArray(envelope.details) ? envelope.details.slice(0, 16) : [];
    let reason;
    const fields = [];
    for (const item of details) {
        if (!item || typeof item !== 'object') continue;
        if (!reason && typeof item.reason === 'string' && ALLOWED_ERROR_REASONS.has(item.reason)) {
            reason = item.reason;
        }
        if (Array.isArray(item.fieldViolations)) {
            for (const violation of item.fieldViolations) {
                const field = violation?.field;
                if (typeof field === 'string' && ALLOWED_FIELD_PATH.test(field) && !fields.includes(field) && fields.length < 3) {
                    fields.push(field);
                }
            }
        }
    }
    if (reason && !tags.includes(reason)) tags.push(reason);
    for (const field of fields) tags.push(field);
    return { apiStatus, tags };
}

export function vertexHttpError(status, detail) {
    const messages = { 400: 'Vertex rejected the request or model parameters.', 401: 'Vertex authentication failed.', 403: 'Vertex denied access to this model or project.',
        404: 'Vertex model or location was not found.', 429: 'Vertex quota or capacity limit reached.', 503: 'Vertex is temporarily unavailable.' };
    const envelope = typeof detail === 'string' ? { status: detail } : detail;
    const { apiStatus, tags } = extractVertexErrorDiagnostics(envelope);
    const base = messages[status] || `Vertex returned HTTP ${Number(status) || 502}.`;
    const error = new VertexError('VERTEX_HTTP', tags.length ? `${base} [${tags.join(' · ')}]` : base, Number(status) || 502);
    if (apiStatus) error.apiStatus = apiStatus;
    return error;
}

/**
 * Authentication cache is scoped to the user directory AND the complete selected secret.
 * Refreshes are deliberately not shared: one caller's cancellation cannot abort another user/job.
 */
export function createVertexConnectionResolver({ fetchImpl = fetch, readSecretImpl = readSecret, signJwt = generateJWTToken, now = Date.now,
    allowedProxyOrigins = () => getConfigValue('vertexai.allowedReverseProxyOrigins', []) } = {}) {
    const tokens = new Map();
    return async function resolveVertexConnection(context, options, signal) {
        const input = context.body;
        if (!context.user?.directories?.root) throw new VertexError('VERTEX_AUTH', 'An authenticated user data directory is required.', 401);
        const headers = { 'Content-Type': 'application/json', Accept: input.stream ? 'text/event-stream' : 'application/json' };
        const region = input.vertexai_region || 'global';
        const host = vertexHost(region);
        const method = input.stream ? 'streamGenerateContent' : 'generateContent';
        let prefix, project, agent, cacheKey;
        if (input.reverse_proxy) {
            let proxy;
            try { proxy = new URL(input.reverse_proxy); } catch { throw new VertexError('VERTEX_CONFIG', 'Invalid Vertex reverse proxy URL.', 400); }
            if (!['http:', 'https:'].includes(proxy.protocol) || proxy.username || proxy.password || proxy.search || proxy.hash) {
                throw new VertexError('VERTEX_CONFIG', 'Reverse proxy must be an HTTP(S) base URL without credentials, query or fragment.', 400);
            }
            // User-controlled destinations require an operator-approved origin, even through an outbound proxy.
            // This also avoids accidentally forwarding a saved Google credential to an arbitrary service.
            const allowed = allowedProxyOrigins();
            if (!Array.isArray(allowed) || !allowed.includes(proxy.origin)) throw new VertexError('VERTEX_PROXY_NOT_ALLOWED', 'Vertex reverse proxy origin is not in vertexai.allowedReverseProxyOrigins.', 403);
            if (typeof input.proxy_password !== 'string' || /[\r\n]/.test(input.proxy_password)) throw new VertexError('VERTEX_CONFIG', 'Invalid reverse proxy authentication.', 400);
            prefix = `${proxy.toString().replace(/\/$/, '').replace(/\/(v1|v1beta1)$/, '')}/${options.apiVersion}`;
            headers.Authorization = `Bearer ${input.proxy_password}`;
            agent = getUntrustedRequestAgent();
        } else if ((input.vertexai_auth_mode || 'express') === 'express') {
            const key = readSecretImpl(context.user.directories, SECRET_KEYS.VERTEXAI, input.secret_id);
            if (typeof key !== 'string' || !key || /[\r\n]/.test(key)) throw new VertexError('VERTEX_AUTH', 'Save a valid Vertex API key for this user.', 401);
            headers['x-goog-api-key'] = key;
            project = input.vertexai_express_project_id;
            if (!project && region !== 'global') throw new VertexError('VERTEX_CONFIG', 'Express mode without a project uses the global endpoint.', 400);
            prefix = `${host}/${options.apiVersion}`;
        } else if (input.vertexai_auth_mode === 'full') {
            const raw = readSecretImpl(context.user.directories, SECRET_KEYS.VERTEXAI_SERVICE_ACCOUNT, input.secret_id);
            let account;
            try {
                account = JSON.parse(raw);
                project = getProjectIdFromServiceAccount(account);
                if (typeof account.client_email !== 'string' || typeof account.private_key !== 'string') throw new Error();
            } catch { throw new VertexError('VERTEX_AUTH', 'Save a valid service account JSON for this user.', 401); }
            cacheKey = createHash('sha256').update(context.user.directories.root).update('\0').update(raw).digest('hex');
            let cached = tokens.get(cacheKey);
            if (!cached || cached.expires <= now() + 60000) {
                let jwt;
                try { jwt = await signJwt(account); } catch { throw new VertexError('VERTEX_AUTH', 'Service account signing failed.', 401); }
                const response = await fetchImpl('https://oauth2.googleapis.com/token', {
                    method: 'POST', redirect: 'error', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal,
                    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
                });
                if (!response.ok) { response.body?.destroy(); throw new VertexError('VERTEX_AUTH', 'Service account token exchange failed.', 401); }
                const data = await readVertexJson(response);
                if (typeof data.access_token !== 'string' || !data.access_token || /[\r\n]/.test(data.access_token)) throw new VertexError('VERTEX_AUTH', 'Token exchange returned no valid access token.', 401);
                const expires = Number(data.expires_in);
                cached = { token: data.access_token, expires: now() + Math.max(0, Math.min(Number.isFinite(expires) ? expires : 3600, 3600)) * 1000 };
                for (const [key, value] of tokens) if (value.expires <= now()) tokens.delete(key);
                if (tokens.size >= 100) tokens.delete(tokens.keys().next().value);
                tokens.set(cacheKey, cached);
            }
            headers.Authorization = `Bearer ${cached.token}`;
            prefix = `${host}/${options.apiVersion}`;
        } else throw new VertexError('VERTEX_AUTH', 'Unsupported Vertex authentication mode.', 400);
        if (project && (typeof project !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9.:-]{0,127}$/.test(project))) throw new VertexError('VERTEX_CONFIG', 'Invalid Google Cloud project ID.', 400);
        if (project) prefix += `/projects/${encodeURIComponent(project)}/locations/${encodeURIComponent(region)}`;
        if (options.tier !== 'auto') headers['X-Vertex-AI-LLM-Shared-Request-Type'] = options.tier;
        if (options.capacity !== 'auto') headers['X-Vertex-AI-LLM-Request-Type'] = options.capacity;
        if (options.tier === 'flex') headers['X-Server-Timeout'] = String(Math.min(1800, options.timeoutMs / 1000));
        return { url: `${prefix}/publishers/google/models/${encodeURIComponent(options.model)}:${method}${input.stream ? '?alt=sse' : ''}`, headers, agent,
            invalidate: () => { if (cacheKey) tokens.delete(cacheKey); } };
    };
}

export const resolveVertexConnection = createVertexConnectionResolver();
