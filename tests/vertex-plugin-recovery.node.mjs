// Run the actual paired front-end adapter functions against controlled ST persistence/events.
// The separately reviewed plugin patch is required; ST does not vendor the extension.
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { parse } from 'espree';
const url = new URL('../public/scripts/extensions/third-party/ST-BaiBai-Tools/src/features/saveGenerate.js', import.meta.url);
const source = await fs.readFile(url, 'utf8').catch(() => null);
const names = ['isEligibleSaveGenerateBody', 'markSaveGenerateBackendAvailable', 'isSaveGenerateTerminalStatus', 'isSaveGenerateSavedStatus',
    'insertNativeVertexResult', 'isCurrentSaveGenerateMessageAlreadyInserted', 'isSaveGenerateExpectedFloorInsertable', 'getCurrentSaveGenerateChatTailMessage',
    'isSaveGenerateTextIncludedInMessage', 'normalizeSaveGenerateComparableText'];
const code = source ? parse(source, { ecmaVersion: 'latest', sourceType: 'module', range: true }).body.filter(n => n.type === 'FunctionDeclaration' && names.includes(n.id?.name)).map(n => source.slice(...n.range)).join('\n') : '';
const hasAdapter = code.includes('async function insertNativeVertexResult');
function harness() {
    const seen = new Set(), saves = [], events = [], renders = [];
    let chatId = 'chat', onSave = null;
    const scriptModule = { chat: [{ is_user: true, mes: 'user' }], async saveChat(value) { saves.push(structuredClone(value)); await onSave?.(); }, addOneMessage: m => renders.push(m) };
    const globals = { scriptModule, characters: [{ avatar: 'fixture.png', chat: 'chat' }], this_chid: 0, selected_group: null, structuredClone,
        Date, console, toastr: { warning() {} }, eventSource: { async emit(...args) { events.push(args); } }, event_types: { MESSAGE_RECEIVED: 'received', CHARACTER_MESSAGE_RENDERED: 'rendered' },
        getCurrentSaveGenerateChatId: () => chatId, isSaveGenerateJobSeen: job => seen.has(job.id), markSaveGenerateJobSeen: job => seen.add(job.id),
        reloadCurrentChat: async () => {}, getCompleteResponseToolName: () => '' };
    const context = vm.createContext(globals);
    vm.runInContext(code, context);
    return { api: context, scriptModule, seen, saves, events, renders, setSave: f => { onSave = f; }, switchChat() { chatId = 'other'; scriptModule.chat = [{ is_user: true, mes: 'other' }]; } };
}
const job = () => ({ id: 'native-job', status: 'partial', save: { avatar_url: 'fixture.png', expectedFloor: 1 }, savedMessageFloor: 1,
    savedMessage: { name: 'Fixture', is_user: false, mes: '{{user}} must remain literal', swipe_id: 0, swipes: ['{{user}} must remain literal'],
        extra: { api: 'vertexai', model: 'gemini-4-argon', reasoning: 'plan', reasoning_signature: 'SIG', vertex_generation: { contract: 1, state: 'partial' },
            vertex_response: { model: 'gemini-4-argon', parts: [{ text: '{{user}} must remain literal', thoughtSignature: 'SIG' }] } },
        swipe_info: [{ extra: { api: 'vertexai', reasoning_signature: 'SIG' } }] } });

test('paired extension distinguishes supported native text/envelope from generic tools and image output', { skip: !hasAdapter }, () => {
    const { api } = harness();
    assert.equal(api.isEligibleSaveGenerateBody({ chat_completion_source: 'vertexai' }), true);
    assert.equal(api.isEligibleSaveGenerateBody({ chat_completion_source: 'vertexai', request_images: true }), false);
    const tool = { type: 'function', function: { name: 'actual_content' } };
    assert.equal(api.isEligibleSaveGenerateBody({ chat_completion_source: 'vertexai', tools: [tool] }), false);
    assert.equal(api.isEligibleSaveGenerateBody({ chat_completion_source: 'vertexai', tools: [tool], vertexai_unwrap_content: true }), true);
    assert.equal(api.isEligibleSaveGenerateBody({ chat_completion_source: 'vertexai', tools: [tool, tool], vertexai_unwrap_content: true }), false);
    assert.equal(api.isSaveGenerateTerminalStatus('partial'), true); assert.equal(api.isSaveGenerateSavedStatus('partial'), true);
});

test('capabilities are refreshed from actual status and missing native capability disables interception', { skip: !hasAdapter }, () => {
    const { api } = harness(), state = {};
    api.markSaveGenerateBackendAvailable(state, true, { capabilities: { saveGenerateNativeVertexContract: 1 } });
    assert.equal(state.backendSupportsNativeVertex, true);
    api.markSaveGenerateBackendAvailable(state, true, { capabilities: {} }); assert.equal(state.backendSupportsNativeVertex, false);
    api.markSaveGenerateBackendAvailable(state, true); assert.equal(state.backendSupportsNativeVertex, false);
    api.markSaveGenerateBackendAvailable(state, false); assert.equal(state.backendSupportsNativeVertex, false);
});

test('recovery inserts one complete message, preserves metadata/literal text, and persists before events', { skip: !hasAdapter }, async () => {
    const h = harness(), j = job();
    h.setSave(() => { assert.equal(h.events.length, 0); assert.equal(h.seen.has(j.id), false); });
    await h.api.insertNativeVertexResult(j, 'chat'); await h.api.insertNativeVertexResult(j, 'chat');
    assert.equal(h.saves.length, 1); assert.equal(h.scriptModule.chat.length, 2); assert.equal(h.events.length, 2); assert.equal(h.renders.length, 1);
    assert.deepEqual(h.saves[0].chatData[1], j.savedMessage);
    assert.equal(h.seen.has(j.id), true); assert.equal(h.saves[0].chatName, 'chat');
});

test('a chat switch during persistence does not render or write into the new chat', { skip: !hasAdapter }, async () => {
    const h = harness(), j = job(); h.setSave(() => h.switchChat());
    await h.api.insertNativeVertexResult(j, 'chat');
    assert.equal(h.saves.length, 1); assert.equal(h.saves[0].chatName, 'chat'); assert.equal(h.saves[0].chatData[1].extra.reasoning_signature, 'SIG');
    assert.equal(h.scriptModule.chat.length, 1); assert.equal(h.scriptModule.chat[0].mes, 'other'); assert.equal(h.renders.length, 0); assert.equal(h.events.length, 0);
    assert.equal(h.seen.has(j.id), true);
});

test('failed recovery remains retryable and does not duplicate or regenerate the message', { skip: !hasAdapter }, async () => {
    const h = harness(), j = job(); h.setSave(async () => { throw new Error('storage unavailable'); });
    await assert.rejects(h.api.insertNativeVertexResult(j, 'chat'), /storage unavailable/);
    assert.equal(h.scriptModule.chat.length, 1); assert.equal(h.seen.has(j.id), false);
    h.setSave(null); await h.api.insertNativeVertexResult(j, 'chat');
    assert.equal(h.scriptModule.chat.length, 2); assert.equal(h.seen.has(j.id), true); assert.equal(h.renders.length, 1);
});
