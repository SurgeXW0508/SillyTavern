import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { testSetup } from './frontent-test-utils.js';

test.beforeEach(async ({ page }) => {
    const source = await fs.readFile(new URL('../../public/script.js', import.meta.url), 'utf8');
    await page.route('**/script.js', route => route.fulfill({ contentType: 'application/javascript', body: source + '\nexport { StreamingProcessor };' }));
    await page.route('**/api/extensions/discover', async route => {
        const res = await route.fetch();
        await route.fulfill({ response: res, json: (await res.json()).filter(x => x.type === 'system') });
    });
    await page.route('**/api/settings/get', async route => {
        const res = await route.fetch(), data = await res.json(), settings = JSON.parse(data.settings);
        settings.firstRun = false; data.settings = JSON.stringify(settings);
        await route.fulfill({ response: res, json: data });
    });
    await page.route('**/api/settings/save', route => route.fulfill({ json: { result: 'ok' } }));
    await page.route('**/api/chats/save', route => route.fulfill({ json: { result: 'ok' } }));
    await page.route('**/api/backends/chat-completions/status', route => route.fulfill({ json: { data: [] } }));
    await page.route('**/api/tokenizers/**', route => route.fulfill({ json: { count: 8, token_count: 8, ids: [1, 2, 3] } }));
    await testSetup.awaitST({ page });
});

test('actual browser generator keeps native model/format snapshots and exact signed Parts through setting changes', async ({ page }) => {
    const result = await page.evaluate(async () => {
        const st = await import('/script.js'), oai = await import('/scripts/openai.js');
        st.changeMainAPI('openai');
        Object.assign(oai.oai_settings, { chat_completion_source: 'vertexai', vertexai_model: 'gemini-4-argon', stream_openai: true, show_thoughts: true, function_calling: false, n: 1 });
        const parts = [{ thought: true, text: 'one' }, { thought: true, text: 'two', thoughtSignature: 'THOUGHT' }, { text: 'A', thoughtSignature: 'A-SIG' }, { text: 'B' }, { inlineData: { mimeType: 'image/png', data: 'aGVsbG8=' }, thoughtSignature: 'IMG-SIG' }];
        const oldFetch = window.fetch;
        let requests = 0;
        window.fetch = async (url, init) => {
            if (url !== '/api/backends/chat-completions/generate') return oldFetch(url, init);
            requests++;
            const frames = [{ candidates: [{ content: { role: 'model', parts } }] }, { vertexMeta: { contract: 1, phase: 'completed', state: 'completed', model: 'gemini-4-argon' } }];
            return new Response(frames.map(f => `data: ${JSON.stringify(f)}\n\n`).join('') + 'data: [DONE]\n\n', { headers: { 'Content-Type': 'text/event-stream' } });
        };
        try {
            const generate = await oai.sendOpenAIRequest('normal', [{ role: 'user', content: 'test' }]);
            oai.oai_settings.chat_completion_source = 'custom';
            oai.oai_settings.show_thoughts = false;
            let final;
            for await (const item of generate()) final = item;
            return { requests, text: final.text, reasoning: final.state.reasoning, images: final.state.images, parts: final.state.vertexResponse.parts,
                model: final.state.vertexResponse.model, terminal: final.state.vertexMeta.state, signature: final.state.signature };
        } finally { window.fetch = oldFetch; }
    });
    expect(result).toMatchObject({ requests: 1, text: 'AB', reasoning: 'onetwo', model: 'gemini-4-argon', terminal: 'completed', signature: 'IMG-SIG' });
    expect(result.parts.map(x => x.thoughtSignature)).toEqual([undefined, 'THOUGHT', 'A-SIG', undefined, 'IMG-SIG']);
    expect(result.images).toEqual(['data:image/png;base64,aGVsbG8=']);
});

for (const type of ['normal', 'continue', 'swipe']) test(`native ${type} stream failure flushes text, signature, terminal and swipe metadata`, async ({ page }) => {
    const result = await page.evaluate(async type => {
        const st = await import('/script.js');
        const { power_user } = await import('/scripts/power-user.js');
        const { PromptReasoning } = await import('/scripts/reasoning.js');
        const { vertexResponseRecord } = await import('/scripts/vertex-state.js');
        st.changeMainAPI('openai');
        Object.assign(power_user, { streaming_fps: 30, stream_fade_in: false, message_token_count_enabled: false });
        const prefix = type === 'continue' ? 'Existing. ' : '';
        const message = { name: 'Assistant', mes: prefix, is_user: false, is_system: false, extra: {}, send_date: new Date().toISOString(), swipe_id: 0, swipes: [prefix], swipe_info: [{}] };
        st.chat.splice(0, st.chat.length, message); await st.redisplayChat({ fade: false });
        const p = new st.StreamingProcessor(type, false, new Date(), prefix, new PromptReasoning()); p.messageId = 0;
        p.generator = async function* () {
            yield { text: '**Partial**', swipes: [], toolCalls: [], state: { reasoning: 'plan', signature: 'NATIVE_SIG',
                vertexResponse: vertexResponseRecord([{ text: '**Partial**', thoughtSignature: 'NATIVE_SIG' }], 'gemini-4-argon'),
                vertexMeta: { contract: 1, state: 'partial', phase: 'partial' } } };
            throw new Error('simulated upstream reset');
        };
        let received = 0;
        const counted = () => { received++; };
        st.eventSource.on(st.event_types.MESSAGE_RECEIVED, counted);
        await p.generate();
        st.eventSource.removeListener(st.event_types.MESSAGE_RECEIVED, counted);
        return { received, text: message.mes, signature: message.extra.reasoning_signature, native: message.extra.vertex_response, terminal: message.extra.vertex_generation,
            swipe: message.swipe_info[0].extra, stopped: p.isStopped, dom: document.querySelector('#chat .mes_text')?.textContent };
    }, type);
    expect(result.text).toBe(type === 'continue' ? 'Existing. **Partial**' : '**Partial**');
    expect(result.signature).toBe('NATIVE_SIG');
    expect(result.terminal.state).toBe('partial'); expect(result.swipe.vertex_generation.state).toBe('partial');
    expect(result.native.parts.at(-1).thoughtSignature).toBe('NATIVE_SIG');
    expect(result.dom).toContain('Partial'); expect(result.stopped).toBe(true); expect(result.received).toBe(1);
});

test('stopping a native stream preserves received content and records canceled instead of completed', async ({ page }) => {
    const result = await page.evaluate(async () => {
        const st = await import('/script.js'), { PromptReasoning } = await import('/scripts/reasoning.js'), { vertexResponseRecord } = await import('/scripts/vertex-state.js');
        const { power_user } = await import('/scripts/power-user.js'); power_user.message_token_count_enabled = false;
        const message = { name: 'Assistant', mes: '', is_user: false, is_system: false, extra: {}, send_date: new Date().toISOString(), swipe_id: 0, swipes: [''], swipe_info: [{}] };
        st.chat.splice(0, st.chat.length, message); await st.redisplayChat({ fade: false });
        const p = new st.StreamingProcessor('normal', false, new Date(), '', new PromptReasoning()); p.messageId = 0;
        const stopped = () => p.onStopStreaming(); st.eventSource.once(st.event_types.STREAM_TOKEN_RECEIVED, stopped);
        p.generator = async function* () { yield { text: 'Stopped content', swipes: [], toolCalls: [], state: { vertexResponse: vertexResponseRecord([{ text: 'Stopped content', thoughtSignature: 'STOP_SIG' }], 'gemini-4-argon'), vertexMeta: { contract: 1 } } }; };
        await p.generate(); await p.onFinishStreaming(0, p.result);
        return { text: message.mes, state: message.extra.vertex_generation.state, signature: message.extra.reasoning_signature, swipe: message.swipe_info[0].extra.vertex_generation.state };
    });
    expect(result).toEqual({ text: 'Stopped content', state: 'canceled', signature: 'STOP_SIG', swipe: 'canceled' });
});

for (const type of ['normal', 'swipe', 'appendFinal']) test(`non-stream ${type} saves native metadata before message events and does not reuse edited Parts`, async ({ page }) => {
    const result = await page.evaluate(async type => {
        const st = await import('/script.js'), { vertexResponseRecord, reusableVertexResponse } = await import('/scripts/vertex-state.js'), { power_user } = await import('/scripts/power-user.js');
        power_user.message_token_count_enabled = false;
        const old = { name: 'Assistant', mes: 'Old', is_user: false, extra: {}, send_date: new Date().toISOString(), swipe_id: type === 'swipe' ? 1 : 0, swipes: ['Old'], swipe_info: [{}] };
        st.chat.splice(0, st.chat.length, old); await st.redisplayChat({ fade: false });
        const observed = [], listener = id => observed.push(st.chat[id]?.extra?.vertex_generation?.state);
        st.eventSource.on(st.event_types.MESSAGE_RECEIVED, listener);
        try {
            await st.saveReply({ type, getMessage: type === 'appendFinal' ? 'OldNew' : 'New', vertexResponse: vertexResponseRecord([{ text: 'New', thoughtSignature: 'JSON_SIG' }], 'gemini-4-argon'), vertexMeta: { contract: 1, state: 'completed' } });
            const m = st.chat.at(-1), valid = Boolean(reusableVertexResponse(m, 'gemini-4-argon'));
            m.mes += 'edit';
            return { observed, valid, editedReusable: Boolean(reusableVertexResponse(m, 'gemini-4-argon')), signature: m.extra.reasoning_signature,
                swipe: m.swipe_info[m.swipe_id].extra.vertex_generation.state, parts: m.extra.vertex_response.parts };
        } finally { st.eventSource.removeListener(st.event_types.MESSAGE_RECEIVED, listener); }
    }, type);
    expect(result.observed).toEqual(['completed']); expect(result.valid).toBe(true); expect(result.editedReusable).toBe(false);
    expect(result.signature).toBe('JSON_SIG'); expect(result.swipe).toBe('completed');
    expect(result.parts.map(p => p.text || '').join('')).toBe({ normal: 'New', swipe: 'New', appendFinal: 'OldNew' }[type]);
});

test('tool parser and serializer retain provider IDs and per-call signatures; other-provider fields stay isolated', async ({ page }) => {
    const result = await page.evaluate(async () => {
        const st = await import('/script.js'), { ToolManager } = await import('/scripts/tool-calling.js'), oai = await import('/scripts/openai.js');
        st.changeMainAPI('openai');
        Object.assign(oai.oai_settings, { chat_completion_source: 'vertexai', vertexai_model: 'gemini-4-argon', function_calling: true, custom_prompt_post_processing: '' });
        const calls = [];
        ToolManager.parseToolCalls(calls, { candidates: [{ content: { parts: [
            { functionCall: { name: 'lookup', id: 'native-a', args: { location: 'A' } }, thoughtSignature: 'SIG_A' },
            { functionCall: { name: 'lookup', id: 'native-b', args: { location: 'B' } }, thoughtSignature: 'SIG_B' },
        ] } }] });
        const invocations = [{ id: 'native-a', name: 'lookup', parameters: '{"location":"A"}', signature: 'SIG_A' }, { id: 'native-b', name: 'lookup', parameters: '{"location":"B"}', signature: 'SIG_B' }];
        const message = await oai.Message.createAsync('assistant', '');
        await message.setToolCalls(invocations, true);
        message.vertex_response = { model: 'gemini-4-argon', parts: [{ functionCall: { name: 'lookup', id: 'native-a', args: { location: 'A' } }, thoughtSignature: 'SIG_A' }] };
        const c = new oai.MessageCollection(); c.collection.push(message);
        return { calls, serialized: c.getChat()[0] };
    });
    expect(result.calls[0].map(c => c.id)).toEqual(['native-a', 'native-b']);
    expect(result.calls[0].map(c => c.thoughtSignature)).toEqual(['SIG_A', 'SIG_B']);
    expect(result.serialized.tool_calls.map(c => c.signature)).toEqual(['SIG_A', 'SIG_B']);
    expect(result.serialized.vertex_response.parts[0].thoughtSignature).toBe('SIG_A');
});

test('actual tool actions run once per call and their saved invocation record carries the native response', async ({ page }) => {
    const result = await page.evaluate(async () => {
        const st = await import('/script.js'), { ToolManager } = await import('/scripts/tool-calling.js'), oai = await import('/scripts/openai.js');
        const { vertexResponseRecord } = await import('/scripts/vertex-state.js');
        st.changeMainAPI('openai');
        Object.assign(oai.oai_settings, { chat_completion_source: 'vertexai', vertexai_model: 'gemini-4-argon', function_calling: true, custom_prompt_post_processing: '' });
        const executed = [];
        ToolManager.registerFunctionTool({ name: 'phasec_lookup', displayName: 'Lookup', description: 'Isolated test', parameters: { type: 'object', properties: { location: { type: 'string' } } },
            action: args => { executed.push(args.location); return { result: args.location }; } });
        const parts = ['A', 'B'].map((location, i) => ({ functionCall: { name: 'phasec_lookup', id: `call-${i}`, args: { location } }, thoughtSignature: `sig-${i}` }));
        try {
            const response = vertexResponseRecord(parts, 'gemini-4-argon');
            const result = await ToolManager.invokeFunctionTools({ responseContent: { parts } }, { vertexResponse: response });
            await ToolManager.saveFunctionToolInvocations(result.invocations);
            return { executed, invocations: result.invocations, saved: st.chat.at(-1).extra.tool_invocations };
        } finally { ToolManager.unregisterFunctionTool('phasec_lookup'); }
    });
    expect(result.executed).toEqual(['A', 'B']);
    expect(result.invocations.map(i => i.id)).toEqual(['call-0', 'call-1']);
    expect(result.saved.map(i => i.signature)).toEqual(['sig-0', 'sig-1']);
    expect(result.saved[0].vertex_response.parts).toHaveLength(2);
});

test('the complete Generate flow regenerates once and replaces the active reply and its native metadata', async ({ page }) => {
    const result = await page.evaluate(async () => {
        const st = await import('/script.js'), { oai_settings } = await import('/scripts/openai.js'), { power_user } = await import('/scripts/power-user.js');
        await st.newAssistantChat({ temporary: true }); st.changeMainAPI('openai');
        Object.assign(oai_settings, { chat_completion_source: 'vertexai', vertexai_model: 'gemini-4-argon', stream_openai: true, function_calling: false,
            show_thoughts: true, openai_max_context: 131072, openai_max_tokens: 2048, custom_prompt_post_processing: '' });
        Object.assign(power_user, { message_token_count_enabled: false, auto_continue: false, auto_swipe: false, stream_fade_in: false });
        st.setOnlineStatus('gemini-4-argon');
        const user = { name: 'User', mes: 'Test', is_user: true, is_system: false, extra: {} }; st.chat.push(user); await st.addOneMessage(user);
        const oldFetch = window.fetch, types = [];
        window.fetch = async (url, init) => {
            if (url !== '/api/backends/chat-completions/generate') return oldFetch(url, init);
            const body = JSON.parse(init.body); types.push(body.type);
            const frame = { candidates: [{ content: { role: 'model', parts: [{ text: `Reply-${types.length}`, thoughtSignature: `SIG-${types.length}` }] }, finishReason: 'STOP' }] };
            const meta = { contract: 1, state: 'completed', phase: 'completed', model: 'gemini-4-argon' };
            return body.stream ? new Response(`data: ${JSON.stringify(frame)}\n\ndata: ${JSON.stringify({ vertexMeta: meta })}\n\ndata: [DONE]\n\n`, { headers: { 'Content-Type': 'text/event-stream' } })
                : new Response(JSON.stringify({ ...frame, responseContent: frame.candidates[0].content, choices: [{ message: { content: `Reply-${types.length}` } }], vertexMeta: meta }), { headers: { 'Content-Type': 'application/json' } });
        };
        try {
            await st.Generate('normal', { automatic_trigger: true }); const before = st.chat.length;
            oai_settings.stream_openai = false; await st.Generate('regenerate', { automatic_trigger: true });
            const last = st.chat.at(-1);
            return { types, before, after: st.chat.length, text: last.mes, signature: last.extra.reasoning_signature, native: last.extra.vertex_response.parts, state: last.extra.vertex_generation.state };
        } finally { window.fetch = oldFetch; }
    });
    expect(result.types).toEqual(['normal', 'regenerate']); expect(result.after).toBe(result.before);
    expect(result.text).toBe('Reply-2'); expect(result.signature).toBe('SIG-2'); expect(result.state).toBe('completed');
    expect(result.native).toEqual([{ text: 'Reply-2', thoughtSignature: 'SIG-2' }]);
});

test('complete Generate tool loop preserves the native turn once and sends ordered tool results without sparse history', async ({ page }) => {
    const result = await page.evaluate(async () => {
        const st = await import('/script.js'), { ToolManager } = await import('/scripts/tool-calling.js'), { oai_settings } = await import('/scripts/openai.js'), { power_user } = await import('/scripts/power-user.js');
        await st.newAssistantChat({ temporary: true }); st.changeMainAPI('openai');
        Object.assign(oai_settings, { chat_completion_source: 'vertexai', vertexai_model: 'gemini-4-argon', stream_openai: true, function_calling: true,
            show_thoughts: true, openai_max_context: 131072, openai_max_tokens: 2048, custom_prompt_post_processing: '' });
        Object.assign(power_user, { message_token_count_enabled: false, auto_continue: false, auto_swipe: false, stream_fade_in: false });
        st.setOnlineStatus('gemini-4-argon');
        const executed = [], requests = [];
        ToolManager.registerFunctionTool({ name: 'phasec_loop', description: 'Isolated tool loop', parameters: { type: 'object', properties: { location: { type: 'string' } } }, action: args => { executed.push(args.location); return `result-${args.location}`; } });
        const user = { name: 'User', mes: 'Test tool loop', is_user: true, is_system: false, extra: {} }; st.chat.push(user); await st.addOneMessage(user);
        const original = window.fetch;
        window.fetch = async (url, init) => {
            if (url !== '/api/backends/chat-completions/generate') return original(url, init);
            requests.push(JSON.parse(init.body));
            const parts = requests.length === 1 ? [{ thought: true, text: 'plan' }, { text: 'Working...' },
                { functionCall: { name: 'phasec_loop', id: 'loop-a', args: { location: 'A' } }, thoughtSignature: 'LOOP_SIG' },
                { functionCall: { name: 'phasec_loop', id: 'loop-b', args: { location: 'B' } } }] : [{ text: 'Done', thoughtSignature: 'FINAL_SIG' }];
            return new Response(`data: ${JSON.stringify({ candidates: [{ content: { role: 'model', parts }, finishReason: 'STOP' }] })}\n\ndata: ${JSON.stringify({ vertexMeta: { contract: 1, phase: 'completed', state: 'completed', model: 'gemini-4-argon' } })}\n\ndata: [DONE]\n\n`, { headers: { 'Content-Type': 'text/event-stream' } });
        };
        try {
            await st.Generate('normal', { automatic_trigger: true });
            return { executed, requests, text: st.chat.at(-1).mes, signature: st.chat.at(-1).extra.reasoning_signature };
        } finally { window.fetch = original; ToolManager.unregisterFunctionTool('phasec_loop'); }
    });
    expect(result.executed).toEqual(['A', 'B']); expect(result.requests).toHaveLength(2);
    expect(result.text).toBe('Done'); expect(result.signature).toBe('FINAL_SIG');
    expect(result.requests[1].messages.every(Boolean)).toBe(true);
    const toolCalls = result.requests[1].messages.find(m => m.tool_calls);
    expect(toolCalls.tool_calls.map(c => c.id)).toEqual(['loop-a', 'loop-b']);
    expect(toolCalls.vertex_response.parts[2].thoughtSignature).toBe('LOOP_SIG');
    expect(result.requests[1].messages.filter(m => m.role === 'tool').map(m => m.tool_call_id)).toEqual(['loop-a', 'loop-b']);
    expect(result.requests[1].messages.filter(m => m.content === 'Working...')).toHaveLength(0);
});
