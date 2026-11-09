import { test, expect } from '@playwright/test';
import { setupCoreReliability } from '../util/core-reliability-fixture.mjs';

test.beforeEach(async ({ page }) => setupCoreReliability(page));

for (const type of ['normal', 'continue', 'swipe', 'impersonate']) test(`${type} failure preserves displayed and pending content without duplicate previews or completion`, async ({ page }) => {
    const result = await page.evaluate(async type => {
        const st = await import('/script.js');
        const { PromptReasoning } = await import('/scripts/reasoning.js');
        const { power_user } = await import('/scripts/power-user.js');
        Object.assign(power_user, { streaming_fps: 30, stream_fade_in: false, message_token_count_enabled: false });
        st.changeMainAPI('openai');
        const prefix = type === 'continue' ? 'Prefix. ' : '';
        const message = { name: 'Assistant', mes: prefix, is_user: false, is_system: false, extra: {}, send_date: new Date().toISOString(), swipe_id: 0, swipes: [prefix], swipe_info: [{}] };
        st.chat.splice(0, st.chat.length, message);
        await st.redisplayChat({ fade: false });
        const p = new st.StreamingProcessor(type, false, new Date(), prefix, new PromptReasoning());
        p.messageId = 0;
        let clock = Date.now(), closed = 0, received = 0, rendered = 0;
        const now = Date.now, progress = p.onProgressStreaming.bind(p), previews = [];
        p.onProgressStreaming = async (...args) => { previews.push(args[1]); return progress(...args); };
        const receivedListener = () => received++, renderedListener = () => rendered++;
        st.eventSource.on(st.event_types.MESSAGE_RECEIVED, receivedListener);
        st.eventSource.on(st.event_types.CHARACTER_MESSAGE_RENDERED, renderedListener);
        p.generator = async function* () {
            try {
                clock += 40;
                yield { text: 'Displayed', state: { reasoning: 'First thought' }, toolCalls: [] };
                clock += 1;
                yield { text: '**Displayed + pending**', state: { reasoning: 'All thoughts' }, toolCalls: [] };
                throw new Error('Synthetic upstream reset');
            } finally { closed++; }
        };
        try {
            Date.now = () => clock;
            await p.generate();
            return { text: message.mes, reasoning: message.extra.reasoning, swipe: message.swipes[0], input: document.querySelector('#send_textarea').value,
                received, rendered, previews, closed, stopped: p.isStopped, aborted: p.abortController.signal.aborted, finished: p.isFinished };
        } finally {
            Date.now = now;
            st.eventSource.removeListener(st.event_types.MESSAGE_RECEIVED, receivedListener);
            st.eventSource.removeListener(st.event_types.CHARACTER_MESSAGE_RENDERED, renderedListener);
        }
    }, type);
    expect(result).toMatchObject({ stopped: true, aborted: true, finished: false, closed: 1, received: type === 'impersonate' ? 0 : 1, rendered: type === 'impersonate' ? 0 : 1 });
    expect(result.previews).toEqual([type === 'continue' ? 'Prefix. Displayed' : 'Displayed', type === 'continue' ? 'Prefix. **Displayed + pending**' : '**Displayed + pending**']);
    const text = { impersonate: '', normal: '**Displayed + pending**', swipe: '**Displayed + pending**', continue: 'Prefix. **Displayed + pending**' }[type];
    expect(result.text).toBe(text);
    expect(result.swipe).toBe(text);
    expect(result.reasoning).toBe(type === 'impersonate' ? undefined : 'All thoughts');
    expect(result.input).toBe(type === 'impersonate' ? '**Displayed + pending**' : '');
});

for (const elapsed of [1, 40]) test(`a renderer failure after ${elapsed}ms is never retried and settles once`, async ({ page }) => {
    const result = await page.evaluate(async elapsed => {
        const st = await import('/script.js'), { PromptReasoning } = await import('/scripts/reasoning.js'), { power_user } = await import('/scripts/power-user.js');
        Object.assign(power_user, { streaming_fps: 30, stream_fade_in: false, message_token_count_enabled: false });
        const message = { name: 'Assistant', mes: '', extra: {}, swipe_id: 0, swipes: [''], swipe_info: [{}] };
        st.chat.splice(0, st.chat.length, message);
        await st.redisplayChat({ fade: false });
        const p = new st.StreamingProcessor('normal', false, new Date(), '', new PromptReasoning());
        p.messageId = 0;
        let previews = 0, received = 0, clock = Date.now();
        const now = Date.now, progress = p.onProgressStreaming.bind(p), counted = () => received++;
        st.eventSource.on(st.event_types.MESSAGE_RECEIVED, counted);
        p.onProgressStreaming = async (...args) => { previews++; await progress(...args); throw new Error('Synthetic renderer failure after state update'); };
        p.generator = async function* () { clock += elapsed; yield { text: 'Retained', state: { reasoning: 'Plan' }, toolCalls: [] }; throw new Error('Synthetic reset'); };
        try {
            Date.now = () => clock;
            await p.generate();
            await new Promise(resolve => setTimeout(resolve, 0));
            return { previews, received, text: message.mes, reasoning: message.extra.reasoning, aborted: p.abortController.signal.aborted, stopped: p.isStopped };
        } finally { Date.now = now; st.eventSource.removeListener(st.event_types.MESSAGE_RECEIVED, counted); }
    }, elapsed);
    expect(result).toEqual({ previews: 1, received: 1, text: 'Retained', reasoning: 'Plan', aborted: true, stopped: true });
});

for (const scenario of ['text', 'reasoning-only', 'stop', 'failure', 'empty-failure', 'ordinary']) test(`complete Core Generate ${scenario} stream owns requests, tools and pending content`, async ({ page }) => {
    await page.unroute('**/api/chats/save');
    const result = await page.evaluate(async scenario => {
        const st = await import('/script.js'), { oai_settings } = await import('/scripts/openai.js'), { power_user } = await import('/scripts/power-user.js'), { ToolManager } = await import('/scripts/tool-calling.js');
        await st.newAssistantChat({ temporary: true });
        st.changeMainAPI('openai');
        Object.assign(oai_settings, { chat_completion_source: 'custom', custom_url: 'https://example.invalid', custom_model: 'fixture-model', stream_openai: true,
            function_calling: true, show_thoughts: true, openai_max_context: 32768, openai_max_tokens: 2048, custom_prompt_post_processing: '' });
        Object.assign(power_user, { streaming_fps: 30, stream_fade_in: false, message_token_count_enabled: false, auto_continue: false, auto_swipe: false });
        st.setOnlineStatus('fixture-model');
        const user = { name: 'User', mes: 'Run fixture', is_user: true, is_system: false, extra: {} };
        st.chat.push(user); await st.addOneMessage(user);
        const character = { name: 'StreamFixture', avatar: 'stream-fixture.png', chat: `stream-${crypto.randomUUID()}` };
        st.characters.push(character); st.setCharacterId(st.characters.length - 1); st.setCharacterName(character.name);
        let executed = 0, saves = 0, clock = Date.now();
        const requests = [], original = window.fetch, now = Date.now;
        ToolManager.registerFunctionTool({ name: 'reliability_tool', description: 'Synthetic fixture', parameters: { type: 'object', properties: {} }, action: () => { executed++; return 'Tool result'; } });
        const stop = () => st.streamingProcessor.onStopStreaming();
        if (scenario === 'stop') st.eventSource.once(st.event_types.STREAM_TOKEN_RECEIVED, stop);
        window.fetch = async (url, init) => {
            if (url !== '/api/backends/chat-completions/generate') { if (url === '/api/chats/save') saves++; return original(url, init); }
            requests.push(JSON.parse(init.body));
            const first = requests.length === 1;
            const delta = first ? { content: scenario === 'reasoning-only' ? '' : '**Intermediary**', reasoning_content: 'Pending plan',
                ...(scenario === 'ordinary' ? {} : { tool_calls: [{ index: 0, id: 'reliability-call', type: 'function', function: { name: 'reliability_tool', arguments: '{}' } }] }) } : { content: 'Final reply' };
            const stream = new ReadableStream({
                start(controller) {
                    if (scenario === 'empty-failure') { controller.error(new Error('Reset before first content')); return; }
                    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ choices: [{ index: 0, delta }] })}\n\n`));
                    if (scenario === 'stop') init.signal.addEventListener('abort', () => controller.error(new DOMException('Stopped', 'AbortError')), { once: true });
                    else if (scenario === 'failure') setTimeout(() => controller.error(new Error('Synthetic network reset')), 10);
                    else { controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n')); controller.close(); }
                },
            });
            return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } });
        };
        try {
            Date.now = () => clock;
            await st.Generate('normal', { automatic_trigger: true });
            const diskResponse = await original('/api/chats/get', { method: 'POST', headers: st.getRequestHeaders(), body: JSON.stringify({ avatar_url: character.avatar, file_name: character.chat }) });
            const disk = await diskResponse.json();
            return { requests, executed, saves, disk, messages: st.chat.map(m => ({ mes: m.mes, reasoning: m.extra?.reasoning })), stopped: st.streamingProcessor === null };
        } finally {
            Date.now = now; window.fetch = original;
            st.eventSource.removeListener(st.event_types.STREAM_TOKEN_RECEIVED, stop);
            ToolManager.unregisterFunctionTool('reliability_tool');
        }
    }, scenario);
    const toolRound = ['text', 'reasoning-only'].includes(scenario);
    expect(result.requests).toHaveLength(toolRound ? 2 : 1);
    expect(result.executed).toBe(toolRound ? 1 : 0);
    const partial = result.messages.find(message => message.reasoning === 'Pending plan');
    expect(Boolean(partial)).toBe(scenario !== 'empty-failure');
    expect(partial?.mes).toBe(scenario === 'empty-failure' ? undefined : scenario === 'reasoning-only' ? '' : '**Intermediary**');
    expect(result.saves === 0).toBe(scenario === 'empty-failure');
    expect(result.disk.find(message => message.extra?.reasoning === 'Pending plan')?.mes).toBe(partial?.mes);
    expect(result.messages.at(-1).mes === 'Final reply').toBe(toolRound);
    expect(result.requests[1]?.messages.filter(message => message.role === 'tool' && message.tool_call_id === 'reliability-call') ?? []).toHaveLength(toolRound ? 1 : 0);
    expect(Boolean(result.requests[1]?.messages.some(message => message.content === '**Intermediary**'))).toBe(scenario === 'text');
    expect(result.stopped).toBe(true);
});
