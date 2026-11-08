// Native Vertex transport, adapted from Shalistera/SillyTavern 510fbb54.
// No request bodies, credentials, OAuth assertions or upstream error bodies are logged.
import fetch from 'node-fetch';
import { createHash } from 'node:crypto';
import { readSecret, SECRET_KEYS } from '../secrets.js';
import { generateJWTToken, getProjectIdFromServiceAccount } from '../google.js';
import { getUntrustedRequestAgent } from '../../private-request-filter.js';
import { getConfigValue } from '../../util.js';
import { VertexError } from './vertex-protocol.js';

export function vertexHost(region) {
    if (region === 'global') return 'https://aiplatform.googleapis.com';
    if (region === 'us' || region === 'eu') return `https://aiplatform.${region}.rep.googleapis.com`;
    if (!/^[a-z]+-[a-z]+\d+$/.test(region)) throw new VertexError('VERTEX_CONFIG', 'Invalid Vertex region.', 400);
    return `https://${region}-aiplatform.googleapis.com`;
}

/** Bounded decoded bytes, used for both JSON success and error responses. */
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

export function vertexHttpError(status, apiStatus) {
    const messages = { 400: 'Vertex rejected the request or model parameters.', 401: 'Vertex authentication failed.', 403: 'Vertex denied access to this model or project.',
        404: 'Vertex model or location was not found.', 429: 'Vertex quota or capacity limit reached.', 503: 'Vertex is temporarily unavailable.' };
    const error = new VertexError('VERTEX_HTTP', messages[status] || `Vertex returned HTTP ${Number(status) || 502}.`, Number(status) || 502);
    if (/^[A-Z_]{1,64}$/.test(apiStatus)) error.apiStatus = apiStatus;
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
