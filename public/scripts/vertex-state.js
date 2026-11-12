// Core response/history helpers. Signatures stay attached to their Parts.
export function hasUsableVertexParts(parts) {
    return Array.isArray(parts) && parts.some(p => (typeof p?.text === 'string' && p.text.length > 0) || Boolean(p?.inlineData?.data));
}

export function isUsableVertexPartial(data) {
    return data?.vertexMeta?.state === 'partial' && hasUsableVertexParts(data.responseContent?.parts);
}

export function appendVertexParts(target, parts) {
    for (const part of parts || []) {
        const previous = target.at(-1);
        if (typeof part.text === 'string' && !part.thoughtSignature && previous && typeof previous.text === 'string' && !previous.thoughtSignature && !!previous.thought === !!part.thought) previous.text += part.text;
        else target.push(structuredClone(part));
    }
}

export function vertexResponseRecord(parts, model, envelope = null) {
    return { id: globalThis.crypto.randomUUID(), model, parts: structuredClone(parts || []), ...(envelope ? { envelope: structuredClone(envelope) } : {}) };
}

export function applyVertexMessageState(message, response, meta, prefix = '') {
    if (!message || !response || !Array.isArray(response.parts)) return;
    message.extra ||= {};
    message.extra.api = 'vertexai';
    message.extra.model = response.model;
    const previous = message.extra.vertex_response;
    const parts = prefix ? (previous?.model === response.model && previous.boundText === prefix ? structuredClone(previous.parts) : [{ text: prefix }]) : [];
    appendVertexParts(parts, response.parts);
    const responseText = parts.filter(p => !p.thought).map(p => p.text || '').join('');
    message.extra.vertex_response = { id: response.id, model: response.model, parts, boundText: message.mes, replayable: String(message.mes || '').trim() === responseText.trim(), ...(response.envelope ? { envelope: structuredClone(response.envelope) } : {}) };
    message.extra.vertex_generation = structuredClone(meta || {});
    const signature = parts.filter(p => !p.functionCall && p.thoughtSignature).at(-1)?.thoughtSignature;
    message.extra.reasoning_signature = signature || null;
    // Keep active swipe metadata aligned with the message, including stopped/partial generations.
    if (Array.isArray(message.swipe_info) && message.swipe_info[message.swipe_id ?? 0]) message.swipe_info[message.swipe_id ?? 0].extra = structuredClone(message.extra);
}

export function reusableVertexResponse(message, model) {
    const record = message?.extra?.vertex_response;
    if (message.extra?.api !== 'vertexai' || message.extra?.model !== model || record?.model !== model || record.replayable === false || record.boundText !== message.mes) return null;
    return structuredClone(record);
}

export function vertexToolResponse(invocations, model) {
    const record = invocations?.[0]?.vertex_response;
    const calls = record?.parts?.filter(p => p.functionCall).map(p => p.functionCall);
    if (record?.model !== model || !Array.isArray(calls) || calls.length !== invocations.length) return null;
    const same = invocations.every((i, index) => {
        let args; try { args = typeof i.parameters === 'string' ? JSON.parse(i.parameters) : i.parameters; } catch { return false; }
        const c = calls[index];
        return i.name === c.name && (!c.id || i.id === c.id) && JSON.stringify(args) === JSON.stringify(c.args);
    });
    return same ? structuredClone(record) : null;
}

/** Only hide a display message when it still represents the exact native turn. */
export function vertexToolHistory(chat, model, groupMember = null) {
    const hiddenMessages = new Set(), responses = new Map(), displaysById = new Map();
    const eligible = m => m.extra?.api === 'vertexai' && m.extra?.model === model && (!groupMember || m.name === groupMember);
    for (const message of chat) {
        const id = message.extra?.vertex_response?.id;
        if (!id || message.extra?.tool_invocations) continue;
        if (!displaysById.has(id)) displaysById.set(id, []);
        displaysById.get(id).push(message);
    }
    for (const message of chat) {
        if (!eligible(message)) continue;
        const response = vertexToolResponse(message.extra?.tool_invocations, model);
        if (!response) continue;
        const displays = displaysById.get(response.id) || [];
        const display = displays.length === 1 ? displays[0] : null;
        const current = display && eligible(display) ? reusableVertexResponse(display, model) : null;
        if (current && JSON.stringify(current.parts) === JSON.stringify(response.parts)) {
            hiddenMessages.add(display);
        } else {
            // Edited/deleted/regex-transformed text belongs to the visible history.
            // Only unchanged function Parts (including their own signatures) survive.
            response.parts = response.parts.filter(p => p.functionCall);
        }
        responses.set(message, response);
    }
    return { hiddenMessages, responses };
}
