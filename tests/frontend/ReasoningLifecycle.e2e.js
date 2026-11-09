import { test, expect } from '@playwright/test';
import { setupCoreReliability } from '../util/core-reliability-fixture.mjs';

test('reinitialization refreshes settings once; editing, saving and reloading preserve body and signed Vertex Parts', async ({ page }) => {
    await setupCoreReliability(page, { stubChatSave: false });
    const result = await page.evaluate(async () => {
        const st = await import('/script.js');
        const reasoning = await import('/scripts/reasoning.js');
        const { power_user } = await import('/scripts/power-user.js');
        const { vertexResponseRecord } = await import('/scripts/vertex-state.js');
        await st.newAssistantChat({ temporary: true });
        const file = `reasoning-lifecycle-${crypto.randomUUID()}`;
        const character = { name: 'ReasoningFixture', avatar: 'reasoning-fixture.png', chat: file };
        st.characters.push(character);
        st.setCharacterId(st.characters.length - 1);
        st.setCharacterName(character.name);
        Object.assign(power_user.reasoning, { prefix: 'RELOADED', show_hidden: true, auto_expand: true });
        reasoning.initReasoning();
        reasoning.initReasoning();
        const prefix = document.querySelector('#reasoning_prefix');
        const settingHandlers = jQuery._data(prefix, 'events')?.input?.length;
        const ui = { prefix: prefix.value, hidden: document.querySelector('#chat').dataset.showHiddenReasoning, settingHandlers };
        const parts = [{ thought: true, text: 'original plan', thoughtSignature: 'THOUGHT-SIG' }, { text: 'Untouched body', thoughtSignature: 'BODY-SIG' }];
        const message = { name: character.name, mes: 'Untouched body', is_user: false, is_system: false, send_date: new Date().toISOString(),
            extra: { reasoning: 'original plan', reasoning_type: 'model', reasoning_signature: 'BODY-SIG', vertex_response: vertexResponseRecord(parts, 'gemini-4-argon') } };
        st.chat.splice(0, st.chat.length, message);
        await st.redisplayChat({ fade: false });
        let edits = 0, saves = 0;
        const listener = () => edits++;
        const originalFetch = window.fetch;
        st.eventSource.on(st.event_types.MESSAGE_REASONING_EDITED, listener);
        window.fetch = async (...args) => {
            if (args[0] === '/api/chats/save') saves++;
            return originalFetch(...args);
        };
        try {
            const block = jQuery('#chat .mes[mesid="0"]');
            block.find('.mes_reasoning_edit').trigger('click');
            block.find('.reasoning_edit_textarea').val('Edited plan');
            const edited = new Promise(resolve => st.eventSource.once(st.event_types.MESSAGE_REASONING_EDITED, resolve));
            block.find('.mes_reasoning_edit_done').trigger('click');
            await edited;
            // Stale buttons may still dispatch clicks after the editor is removed.
            block.find('.mes_reasoning_edit_done').trigger('click').trigger('click');
            block.find('.mes_reasoning_edit_cancel').trigger('click').trigger('click');
            block.find('.mes_reasoning_edit').trigger('click');
            block.find('.reasoning_edit_textarea').val('Must be canceled');
            block.find('.mes_reasoning_edit_cancel').trigger('click');
            await new Promise(resolve => setTimeout(resolve, 10));
            const res = await originalFetch('/api/chats/get', { method: 'POST', headers: st.getRequestHeaders(), body: JSON.stringify({ avatar_url: character.avatar, file_name: file }) });
            const disk = await res.json();
            const saved = disk.find(item => item.extra?.vertex_response);
            st.chat.splice(0, st.chat.length, saved);
            await st.redisplayChat({ fade: false });
            return { ui, edits, saves, saved, expectedParts: parts, textareas: block.find('.reasoning_edit_textarea').length,
                reloaded: st.chat[0], dom: document.querySelector('#chat .mes_reasoning').textContent };
        } finally {
            window.fetch = originalFetch;
            st.eventSource.removeListener(st.event_types.MESSAGE_REASONING_EDITED, listener);
        }
    });
    expect(result.ui).toEqual({ prefix: 'RELOADED', hidden: 'true', settingHandlers: 1 });
    expect(result).toMatchObject({ edits: 1, saves: 1, textareas: 0 });
    expect(result.saved).toEqual(result.reloaded);
    expect(result.saved.mes).toBe('Untouched body');
    expect(result.saved.extra.reasoning).toBe('Edited plan');
    expect(result.saved.extra.reasoning_signature).toBe('BODY-SIG');
    expect(result.saved.extra.vertex_response.parts).toEqual(result.expectedParts);
    expect(result.dom).toContain('Edited plan');
});
