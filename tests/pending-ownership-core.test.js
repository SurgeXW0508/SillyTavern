import { afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setConfigFilePath } from '../src/util.js';

process.env.SILLYTAVERN_PERFORMANCE_USEDISKCACHE = 'true';
process.env.SILLYTAVERN_BACKUPS_CHAT_ENABLED = 'false';
process.env.SILLYTAVERN_BACKUPS_CHAT_MAXTOTALBACKUPS = '-1';
process.env.SILLYTAVERN_BACKUPS_CHAT_THROTTLEINTERVAL = '0';
process.env.SILLYTAVERN_BACKUPS_CHAT_CHECKINTEGRITY = 'true';

/** @type {import('../src/endpoints/characters.js')} */
let charactersModule;
/** @type {import('../src/endpoints/chats.js')} */
let chatsModule;

function getFinalRouteHandler(router, method, routePath) {
    const layer = router.stack.find(
        item => item.route?.path === routePath && item.route?.methods?.[method.toLowerCase()],
    );
    return layer?.route?.stack?.at(-1)?.handle;
}

async function invokeHandler(handler, request) {
    let statusCode = 200;
    let payload;
    const response = {
        status(code) {
            statusCode = code;
            return this;
        },
        sendStatus(code) {
            statusCode = code;
            return this;
        },
        send(data) {
            payload = data;
            return this;
        },
        json(data) {
            payload = data;
            return this;
        },
    };
    await handler(request, response);
    return { statusCode, payload };
}

function extractJsFunction(src, marker) {
    const start = src.indexOf(marker);
    if (start < 0) {
        throw new Error(`Marker not found: ${marker}`);
    }
    const openParen = src.indexOf('(', start);
    let parenDepth = 0;
    let bodyStart = -1;
    for (let i = openParen; i < src.length; i++) {
        if (src[i] === '(') {
            parenDepth += 1;
        } else if (src[i] === ')') {
            parenDepth -= 1;
            if (parenDepth === 0) {
                bodyStart = src.indexOf('{', i);
                break;
            }
        }
    }
    if (bodyStart <= openParen) {
        throw new Error(`Body start not found for: ${marker}`);
    }
    let depth = 0;
    for (let i = bodyStart; i < src.length; i++) {
        const ch = src[i];
        if (ch === '{') {
            depth += 1;
        } else if (ch === '}') {
            depth -= 1;
            if (depth === 0) {
                const raw = src.slice(start, i + 1);
                return raw.startsWith('export ') ? raw.slice('export '.length) : raw;
            }
        }
    }
    throw new Error(`Failed to extract ${marker}`);
}

async function createChatSaveVmHarness() {
    const scriptPath = fileURLToPath(new URL('../public/script.js', import.meta.url));
    const scriptSource = fs.readFileSync(scriptPath, 'utf8');
    const saveChatCode = extractJsFunction(scriptSource, 'export async function saveChat(');
    const withChatSaveLockCode = extractJsFunction(scriptSource, 'export async function withChatSaveLock(');
    const saveChatConditionalCode = extractJsFunction(scriptSource, 'export async function saveChatConditional(');

    const state = {
        chat: [{ mes: 'Alice edited floor' }],
        selected_group: null,
        /** @type {number|string|undefined} */
        this_chid: '1',
        characters: [
            { avatar: 'Zoe.png', chat: 'zoe-main', name: 'Zoe' },
            { avatar: 'Alice.png', chat: 'main', name: 'Alice' },
            { avatar: 'Bob.png', chat: 'main', name: 'Bob' },
        ],
        chat_metadata: { integrity: 'hash-a' },
        name1: 'User',
        name2: 'Alice',
        neutralCharacterName: 'System',
        isChatSaving: false,
        fetchRequests: [],
        nextFetchOk: true,
        customFetchHandler: null,
        popupHandler: async () => '',
        tokenCacheSaved: 0,
        itemizedSaved: [],
        waitHook: null,
    };

    const vmModule = await import('node:vm');
    const context = vmModule.createContext({
        console: { warn: () => {}, error: () => {}, trace: () => {} },
        Date,
        Error,
        Array,
        Object,
        Boolean,
        Math,
        JSON,
        DEFAULT_SAVE_EDIT_TIMEOUT: 1000,
        get chat() { return state.chat; },
        get selected_group() { return state.selected_group; },
        get this_chid() { return state.this_chid; },
        get characters() { return state.characters; },
        get chat_metadata() { return state.chat_metadata; },
        get name1() { return state.name1; },
        get name2() { return state.name2; },
        get neutralCharacterName() { return state.neutralCharacterName; },
        get isChatSaving() { return state.isChatSaving; },
        set isChatSaving(val) { state.isChatSaving = val; },
        getCurrentChatId: () => state.selected_group ? 'group-chat' : state.characters[state.this_chid]?.chat,
        getRequestHeaders: () => ({ 'Content-Type': 'application/json' }),
        compressRequest: async (req) => req,
        cancelDebouncedChatSave: () => {},
        Number,
        waitUntilCondition: async (cond) => {
            if (state.waitHook) {
                await state.waitHook();
            }
            if (!cond()) {
                throw new Error('Timed out');
            }
        },
        fetch: async (url, init) => {
            if (state.customFetchHandler) {
                return await state.customFetchHandler(url, init);
            }
            state.fetchRequests.push({ url, body: JSON.parse(init.body) });
            if (state.nextFetchOk) {
                return { ok: true, status: 200, json: async () => ({ result: 'ok' }) };
            }
            return { ok: false, status: 500, json: async () => ({ error: 'disk full' }) };
        },
        saveGroupChat: async () => true,
        saveTokenCache: () => { state.tokenCacheSaved += 1; },
        saveItemizedPrompts: (id) => { state.itemizedSaved.push(id); },
        toastr: { error: () => {}, warning: () => {}, info: () => {}, success: () => {} },
        t: (strings) => Array.isArray(strings) ? strings.join('') : String(strings),
        Popup: { show: { input: async (...args) => await state.popupHandler(...args) } },
        window: { location: { reload: () => {} } },
    });

    vmModule.runInContext(
        `${saveChatCode}\n${withChatSaveLockCode}\n${saveChatConditionalCode}\nglobalThis.fns = { saveChat, withChatSaveLock, saveChatConditional };`,
        context,
    );
    return { state, fns: context.fns };
}

async function createBranchAndGroupVmHarness() {
    const scriptPath = fileURLToPath(new URL('../public/script.js', import.meta.url));
    const groupChatsPath = fileURLToPath(new URL('../public/scripts/group-chats.js', import.meta.url));
    const bookmarksPath = fileURLToPath(new URL('../public/scripts/bookmarks.js', import.meta.url));
    const scriptSource = fs.readFileSync(scriptPath, 'utf8');
    const groupChatsSource = fs.readFileSync(groupChatsPath, 'utf8');
    const bookmarksSource = fs.readFileSync(bookmarksPath, 'utf8');

    const saveChatCode = extractJsFunction(scriptSource, 'export async function saveChat(');
    const withChatSaveLockCode = extractJsFunction(scriptSource, 'export async function withChatSaveLock(');
    const selectCharacterByIdCode = extractJsFunction(scriptSource, 'export async function selectCharacterById(');
    const postGroupChatSaveCode = extractJsFunction(groupChatsSource, 'async function postGroupChatSave(');
    const sendBoundGroupChatSaveCode = extractJsFunction(groupChatsSource, 'async function sendBoundGroupChatSave(');
    const saveGroupChatCode = extractJsFunction(groupChatsSource, 'async function saveGroupChat(');
    const saveGroupBookmarkChatCode = extractJsFunction(groupChatsSource, 'export async function saveGroupBookmarkChat(');
    const captureOriginCode = extractJsFunction(bookmarksSource, 'function captureBookmarkOriginContext(');
    const getExistingChatNamesCode = extractJsFunction(bookmarksSource, 'async function getExistingChatNames(');
    const getBranchChatSnapshotCode = extractJsFunction(bookmarksSource, 'function getBranchChatSnapshot(');
    const createBranchCode = extractJsFunction(bookmarksSource, 'export async function createBranch(');
    const branchChatCode = extractJsFunction(bookmarksSource, 'export async function branchChat(');

    const aliceOriginalMessage = { mes: 'Alice branch floor 0', extra: {} };
    const state = {
        aliceOriginalMessage,
        chat: [aliceOriginalMessage],
        selected_group: null,
        this_chid: 0,
        characters: [
            { avatar: 'Alice.png', chat: 'Alice - Main', name: 'Alice' },
            { avatar: 'Bob.png', chat: 'Bob - Main', name: 'Bob' },
        ],
        groups: [
            { id: 'grp-1', name: 'Party', chat_id: 'group-chat-a', chats: ['group-chat-a'] },
        ],
        chat_metadata: { integrity: 'alice-meta', note: 'from-alice' },
        name2: 'Alice',
        neutralCharacterName: 'System',
        isChatSaving: false,
        is_group_generating: false,
        is_send_press: false,
        requests: [],
        openedCharacterChats: [],
        openedGroupChats: [],
        editedGroups: [],
        itemizedSaved: [],
        infoToasts: [],
        lockObservedDuringInitialFetch: false,
        chidAfterBlockedUiSwitch: null,
        onInitialConflictSave: null,
        popupResult: 'OVERWRITE',
    };

    const vmModule = await import('node:vm');
    const context = vmModule.createContext({
        console: { warn: () => {}, error: () => {}, trace: () => {} },
        Date,
        Error,
        Array,
        Object,
        Boolean,
        Number,
        String,
        Math,
        JSON,
        structuredClone,
        DEFAULT_SAVE_EDIT_TIMEOUT: 1000,
        get chat() { return state.chat; },
        get selected_group() { return state.selected_group; },
        set selected_group(v) { state.selected_group = v; },
        get this_chid() { return state.this_chid; },
        set this_chid(v) { state.this_chid = v; },
        get characters() { return state.characters; },
        get groups() { return state.groups; },
        get chat_metadata() { return state.chat_metadata; },
        get name2() { return state.name2; },
        get neutralCharacterName() { return state.neutralCharacterName; },
        get isChatSaving() { return state.isChatSaving; },
        set isChatSaving(v) { state.isChatSaving = v; },
        get is_group_generating() { return state.is_group_generating; },
        get is_send_press() { return state.is_send_press; },
        getCurrentChatDetails: () => ({
            sessionName: state.selected_group
                ? (state.groups.find(g => g.id === state.selected_group)?.chat_id ?? '')
                : (state.characters[state.this_chid]?.chat ?? ''),
        }),
        getUniqueName: (base, existsFn, { nameBuilder, startIndex = 1 }) => {
            for (let i = startIndex; i < 100; i++) {
                const candidate = nameBuilder(base, i);
                if (!existsFn(candidate)) {
                    return candidate;
                }
            }
            return null;
        },
        uuidv4: () => 'branch-uuid-1',
        syncSwipeToMes: () => true,
        getRequestHeaders: () => ({ 'Content-Type': 'application/json' }),
        compressRequest: async (req) => req,
        waitUntilCondition: async (cond) => {
            if (!cond()) {
                throw new Error('Timed out');
            }
        },
        fetch: async (url, init) => {
            const body = JSON.parse(init.body);
            state.requests.push({ url, body, lockHeldDuringFetch: state.isChatSaving });
            if (url === '/api/characters/chats') {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({ 0: { file_name: 'Alice - Main.jsonl' } }),
                };
            }
            if (!body.force) {
                if (state.onInitialConflictSave) {
                    await state.onInitialConflictSave(url, body);
                }
                return {
                    ok: false,
                    status: 400,
                    statusText: 'Bad Request',
                    json: async () => ({ error: 'integrity' }),
                };
            }
            return { ok: true, status: 200, json: async () => ({ result: 'ok' }) };
        },
        Popup: { show: { input: async () => state.popupResult } },
        toastr: {
            error: () => {},
            warning: () => {},
            info: (msg) => { state.infoToasts.push(msg); },
            success: () => {},
        },
        t: (strings) => Array.isArray(strings) ? strings.join('') : String(strings),
        window: { location: { reload: () => {} } },
        saveItemizedPrompts: async (name) => { state.itemizedSaved.push(name); },
        openCharacterChat: async (name) => { state.openedCharacterChats.push(name); },
        openGroupChat: async (gid, cid) => { state.openedGroupChats.push({ gid, cid }); },
        editGroup: async (gid) => { state.editedGroups.push(gid); },
        setCharacterId: (id) => { state.this_chid = id; },
        setCharacterName: (n) => { state.name2 = n; },
        resetSelectedGroup: () => { state.selected_group = null; },
        clearChat: async () => { state.chat = []; },
        cancelTtsPlay: () => {},
        getChat: async () => {},
        unshallowCharacter: async () => {},
        select_selected_character: () => {},
    });

    vmModule.runInContext(
        [
            'let selected_button = ""; let this_edit_mes_id;',
            saveChatCode,
            withChatSaveLockCode,
            selectCharacterByIdCode,
            postGroupChatSaveCode,
            sendBoundGroupChatSaveCode,
            saveGroupChatCode,
            saveGroupBookmarkChatCode,
            captureOriginCode,
            getExistingChatNamesCode,
            getBranchChatSnapshotCode,
            createBranchCode,
            branchChatCode,
            'globalThis.fns = { branchChat, createBranch, selectCharacterById, saveGroupChat, saveGroupBookmarkChat };',
        ].join('\n'),
        context,
    );
    return { state, fns: context.fns };
}

class MockElement {
    constructor(tagName = 'div', classes = [], id = '') {
        this.tagName = tagName.toUpperCase();
        this.nodeType = 1;
        this.id = id;
        this.parentElement = null;
        this.isConnected = true;
        this.children = [];
        this.attributes = new Map();
        this.listeners = new Map();
        this.querySelectorAllCalls = 0;
        this._classes = new Set(classes);
        this.classList = {
            add: (...tokens) => {
                for (const token of tokens) {
                    if (token) this._classes.add(token);
                }
            },
            remove: (...tokens) => {
                for (const token of tokens) {
                    this._classes.delete(token);
                }
            },
            contains: (token) => this._classes.has(token),
        };
    }

    get className() {
        return Array.from(this._classes).join(' ');
    }

    appendChild(child) {
        child.parentElement = this;
        child.isConnected = this.isConnected;
        this.children.push(child);
        return child;
    }

    hasAttribute(name) {
        return this.attributes.has(name);
    }

    getAttribute(name) {
        return this.attributes.has(name) ? this.attributes.get(name) : null;
    }

    setAttribute(name, value) {
        this.attributes.set(name, String(value));
    }

    removeAttribute(name) {
        this.attributes.delete(name);
    }

    addEventListener(type, listener) {
        const list = this.listeners.get(type) ?? [];
        list.push(listener);
        this.listeners.set(type, list);
    }

    contains(other) {
        let cur = other;
        while (cur) {
            if (cur === this) return true;
            cur = cur.parentElement;
        }
        return false;
    }

    closest(selector) {
        if (selector === '#chat') {
            let cur = this;
            while (cur) {
                if (cur.id === 'chat') return cur;
                cur = cur.parentElement;
            }
        }
        return null;
    }

    matches(selectorList) {
        const parts = String(selectorList).split(',').map(s => s.trim()).filter(Boolean);
        return parts.some(part => this._matchesSingle(part));
    }

    _matchesSingle(selector) {
        if (selector === '.scroll-reset-container') {
            return this.classList.contains('scroll-reset-container');
        }
        if (selector === '.extraMesButtons>div:not(.mes_button)') {
            return this.tagName === 'DIV'
                && !this.classList.contains('mes_button')
                && Boolean(this.parentElement?.classList.contains('extraMesButtons'));
        }
        const ancestorPairMatch = /^\.([A-Za-z0-9_-]+)\s+\.([A-Za-z0-9_-]+)$/.exec(selector);
        if (ancestorPairMatch) {
            const [, ancestorClass, descendantClass] = ancestorPairMatch;
            if (!this.classList.contains(descendantClass)) return false;
            let ancestor = this.parentElement;
            while (ancestor) {
                if (ancestor.classList.contains(ancestorClass)) return true;
                ancestor = ancestor.parentElement;
            }
            return false;
        }
        if (selector.startsWith('.') && !/[\s>:+[\]()]/.test(selector.slice(1))) {
            const requiredClasses = selector.slice(1).split('.').filter(Boolean);
            return requiredClasses.every(cls => this.classList.contains(cls));
        }
        return false;
    }

    querySelectorAll(selectorList) {
        this.querySelectorAllCalls += 1;
        const results = [];
        const visit = (node) => {
            for (const child of node.children) {
                if (child.matches(selectorList)) {
                    results.push(child);
                }
                visit(child);
            }
        };
        visit(this);
        return results;
    }
}

beforeAll(async () => {
    setConfigFilePath(fileURLToPath(new URL('../default/config.yaml', import.meta.url)));
    charactersModule = await import('../src/endpoints/characters.js');
    chatsModule = await import('../src/endpoints/chats.js');
});

describe('Pending Ownership Core Fixes (WP-2)', () => {
    let tmpDir;
    let directories;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'st-pending-core-'));
        directories = {
            characters: path.join(tmpDir, 'characters'),
            chats: path.join(tmpDir, 'chats'),
            groups: path.join(tmpDir, 'groups'),
            groupChats: path.join(tmpDir, 'group chats'),
            worlds: path.join(tmpDir, 'worlds'),
        };
        for (const dir of Object.values(directories)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });

    afterEach(() => {
        jest.restoreAllMocks();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    test('characters.js promotes DiskCache hit into memoryCache so repeated POST /get avoids re-reading DiskCache', async () => {
        const avatarName = 'DiskPromotedAlice.png';
        fs.writeFileSync(path.join(directories.characters, avatarName), 'placeholder-png-bytes');

        const cardPayload = JSON.stringify({
            spec: 'chara_card_v2',
            spec_version: '2.0',
            data: {
                name: 'Alice',
                description: 'Curiosity',
                personality: '',
                scenario: '',
                first_mes: 'Hello there!',
                mes_example: '',
                creator_notes: '',
                system_prompt: '',
                post_history_instructions: '',
                alternate_greetings: [],
                tags: ['wonderland'],
                creator: 'Lewis',
                character_version: '1.0',
                extensions: {
                    talkativeness: 0.5,
                    fav: true,
                    world: '',
                },
            },
        });

        const getItem = jest.fn().mockResolvedValue(cardPayload);
        const setItem = jest.fn().mockResolvedValue(undefined);
        jest.spyOn(charactersModule.diskCache, 'instance').mockResolvedValue(/** @type {any} */ ({
            getItem,
            setItem,
        }));

        const handler = getFinalRouteHandler(charactersModule.router, 'post', '/get');
        expect(typeof handler).toBe('function');

        const first = await invokeHandler(handler, {
            body: { avatar_url: avatarName },
            user: { directories },
        });
        expect(first.statusCode).toBe(200);
        expect(first.payload.name).toBe('Alice');
        expect(first.payload.fav).toBe(true);
        expect(getItem).toHaveBeenCalledTimes(1);

        const second = await invokeHandler(handler, {
            body: { avatar_url: avatarName },
            user: { directories },
        });
        expect(second.statusCode).toBe(200);
        expect(second.payload.name).toBe('Alice');
        expect(getItem).toHaveBeenCalledTimes(1);
    });

    test('chats.js POST /search bypasses per-line JSON parsing on filename match and matches multi-word queries across turns', async () => {
        const charChatsDir = path.join(directories.chats, 'Alice');
        fs.mkdirSync(charChatsDir, { recursive: true });

        const filenameHitLines = [
            JSON.stringify({ user_name: 'User', character_name: 'Alice', chat_metadata: {} }),
            ...Array.from({ length: 40 }, (_, idx) => JSON.stringify({
                name: 'Alice',
                is_user: false,
                mes: `Unrelated body line ${idx}`,
                send_date: '2026-01-01T00:00:00.000Z',
            })),
        ];
        fs.writeFileSync(path.join(charChatsDir, 'alpha-roadmap-session.jsonl'), filenameHitLines.join('\n'));

        const handler = getFinalRouteHandler(chatsModule.router, 'post', '/search');
        expect(typeof handler).toBe('function');

        const parseSpy = jest.spyOn(JSON, 'parse');
        const filenameSearch = await invokeHandler(handler, {
            body: { avatar_url: 'Alice.png', query: 'alpha roadmap' },
            user: { directories },
        });
        expect(filenameSearch.statusCode).toBe(200);
        expect(filenameSearch.payload.map(item => item.file_name)).toEqual(['alpha-roadmap-session']);
        // Only the final line is parsed to extract preview/message metadata when filenameMatched is true.
        expect(parseSpy.mock.calls.length).toBeLessThanOrEqual(2);
        parseSpy.mockRestore();

        fs.writeFileSync(path.join(charChatsDir, 'body-cross-turn.jsonl'), [
            JSON.stringify({ user_name: 'User', character_name: 'Alice', chat_metadata: {} }),
            JSON.stringify({ name: 'Alice', is_user: false, mes: 'First turn mentions nebula', send_date: '2026-01-01T00:00:00.000Z' }),
            JSON.stringify({ name: 'User', is_user: true, mes: 'Middle filler', send_date: '2026-01-01T00:01:00.000Z' }),
            JSON.stringify({ name: 'Alice', is_user: false, mes: 'Final turn mentions horizon', send_date: '2026-01-01T00:02:00.000Z' }),
        ].join('\n'));

        fs.writeFileSync(path.join(charChatsDir, 'body-partial.jsonl'), [
            JSON.stringify({ user_name: 'User', character_name: 'Alice', chat_metadata: {} }),
            JSON.stringify({ name: 'Alice', is_user: false, mes: 'Only mentions nebula here', send_date: '2026-01-01T00:00:00.000Z' }),
        ].join('\n'));

        const bodySearch = await invokeHandler(handler, {
            body: { avatar_url: 'Alice.png', query: 'nebula horizon' },
            user: { directories },
        });
        expect(bodySearch.statusCode).toBe(200);
        expect(bodySearch.payload.map(item => item.file_name)).toEqual(['body-cross-turn']);
    });

    test('keyboard.js coalesces mutations per frame, deduplicates scroll-reset listeners, and skips #chat container class churn', async () => {
        let observerCallback = null;
        let observeOptions = null;
        /** @type {Array<() => void>} */
        const rafQueue = [];

        const prevGlobals = {
            CSS: global.CSS,
            Node: global.Node,
            Element: global.Element,
            HTMLElement: global.HTMLElement,
            MutationObserver: global.MutationObserver,
            document: global.document,
            requestAnimationFrame: global.requestAnimationFrame,
        };

        const body = new MockElement('body');
        const docListeners = new Map();
        const mockDocument = {
            body,
            activeElement: null,
            querySelectorAll: (sel) => body.querySelectorAll(sel),
            addEventListener: (type, fn) => {
                docListeners.set(type, fn);
            },
        };

        global.CSS = /** @type {any} */ ({ supports: () => true });
        global.Node = /** @type {any} */ ({ ELEMENT_NODE: 1 });
        global.Element = /** @type {any} */ (MockElement);
        global.HTMLElement = /** @type {any} */ (MockElement);
        global.MutationObserver = /** @type {any} */ (class {
            constructor(cb) {
                observerCallback = cb;
            }
            observe(_target, opts) {
                observeOptions = opts;
            }
        });
        global.document = /** @type {any} */ (mockDocument);
        global.requestAnimationFrame = (cb) => {
            rafQueue.push(/** @type {any} */ (cb));
            return rafQueue.length;
        };

        try {
            const scrollContainer = body.appendChild(new MockElement('div', ['scroll-reset-container']));
            const menuBtn = scrollContainer.appendChild(new MockElement('div', ['menu_button']));
            const chatRoot = body.appendChild(new MockElement('div', [], 'chat'));
            const mesRow = chatRoot.appendChild(new MockElement('div', ['mes']));
            const mesButtons = mesRow.appendChild(new MockElement('div', ['mes_buttons']));
            const mesBtn = mesButtons.appendChild(new MockElement('div', ['mes_button']));

            const keyboardModule = await import('../public/scripts/keyboard.js');
            keyboardModule.initKeyboard();

            expect(observeOptions).toMatchObject({
                childList: true,
                subtree: true,
                attributes: true,
                attributeOldValue: true,
                attributeFilter: ['class'],
            });
            expect(menuBtn.attributes.get('tabindex')).toBe('0');
            expect(mesBtn.attributes.get('tabindex')).toBe('0');
            expect(scrollContainer.listeners.get('focusout')?.length).toBe(1);
            // Init performs 1 combined interactable query + 1 scroll-reset query (not 29 separate queries).
            expect(body.querySelectorAllCalls).toBe(2);

            // Repeated scan of scroll-reset container must NOT attach duplicate focusout listeners.
            observerCallback([
                { type: 'attributes', attributeName: 'class', target: scrollContainer, oldValue: 'scroll-reset-container' },
                { type: 'childList', addedNodes: [menuBtn] },
            ]);
            expect(rafQueue.length).toBe(1);
            const flushFirst = rafQueue.shift();
            flushFirst();
            expect(scrollContainer.listeners.get('focusout')?.length).toBe(1);
            // menuBtn is a descendant of scrollContainer, so ancestor collapsing skips scanning menuBtn directly.
            expect(menuBtn.querySelectorAllCalls).toBe(0);

            // Irrelevant #chat container class churn (e.g. last_mes / streaming) must skip scheduling.
            mesRow.classList.add('last_mes', 'streaming');
            observerCallback([
                { type: 'attributes', attributeName: 'class', target: mesRow, oldValue: 'mes' },
            ]);
            expect(rafQueue.length).toBe(0);

            // Ancestor-dependent selector (.mes_buttons .mes_button): child inserted before parent gains .mes_buttons.
            const lateMesButtons = mesRow.appendChild(new MockElement('div', []));
            const lateMesBtn = lateMesButtons.appendChild(new MockElement('div', ['mes_button']));
            observerCallback([
                { type: 'childList', addedNodes: [lateMesButtons] },
            ]);
            expect(rafQueue.length).toBe(1);
            rafQueue.shift()();
            expect(lateMesBtn.hasAttribute('tabindex')).toBe(false);

            lateMesButtons.classList.add('mes_buttons');
            observerCallback([
                { type: 'attributes', attributeName: 'class', target: lateMesButtons, oldValue: '' },
            ]);
            expect(rafQueue.length).toBe(1);
            rafQueue.shift()();
            expect(lateMesBtn.attributes.get('tabindex')).toBe('0');
            expect(lateMesBtn.classList.contains('interactable')).toBe(true);

            // .extraMesButtons>div:not(.mes_button) ancestor class addition and child .mes_button removal.
            const extraWrap = mesRow.appendChild(new MockElement('div', []));
            const extraAction = extraWrap.appendChild(new MockElement('div', ['mes_button']));
            observerCallback([
                { type: 'childList', addedNodes: [extraWrap] },
            ]);
            rafQueue.shift()();
            expect(extraAction.hasAttribute('tabindex')).toBe(false);

            extraWrap.classList.add('extraMesButtons');
            observerCallback([
                { type: 'attributes', attributeName: 'class', target: extraWrap, oldValue: '' },
            ]);
            expect(rafQueue.length).toBe(1);
            rafQueue.shift()();
            expect(extraAction.hasAttribute('tabindex')).toBe(false);

            extraAction.classList.remove('mes_button');
            observerCallback([
                { type: 'attributes', attributeName: 'class', target: extraAction, oldValue: 'mes_button' },
            ]);
            expect(rafQueue.length).toBe(1);
            rafQueue.shift()();
            expect(extraAction.attributes.get('tabindex')).toBe('0');

            // Dynamic registerInteractableType refreshes the #chat relevant class index.
            keyboardModule.registerInteractableType('.custom_box .custom_btn');
            const customBox = mesRow.appendChild(new MockElement('div', []));
            const customBtn = customBox.appendChild(new MockElement('div', ['custom_btn']));
            observerCallback([
                { type: 'childList', addedNodes: [customBox] },
            ]);
            rafQueue.shift()();
            expect(customBtn.hasAttribute('tabindex')).toBe(false);

            customBox.classList.add('custom_box');
            observerCallback([
                { type: 'attributes', attributeName: 'class', target: customBox, oldValue: '' },
            ]);
            expect(rafQueue.length).toBe(1);
            rafQueue.shift()();
            expect(customBtn.attributes.get('tabindex')).toBe('0');

            // Ancestor disabled toggle inside #chat MUST schedule and update descendant .mes_button tabindex.
            mesButtons.classList.add('disabled');
            observerCallback([
                { type: 'attributes', attributeName: 'class', target: mesButtons, oldValue: 'mes_buttons' },
            ]);
            expect(rafQueue.length).toBe(1);
            rafQueue.shift()();
            expect(mesBtn.hasAttribute('tabindex')).toBe(false);

            mesButtons.classList.remove('disabled');
            observerCallback([
                { type: 'attributes', attributeName: 'class', target: mesButtons, oldValue: 'mes_buttons disabled' },
            ]);
            expect(rafQueue.length).toBe(1);
            rafQueue.shift()();
            expect(mesBtn.attributes.get('tabindex')).toBe('0');

            // Mutation storm (> 40 added nodes directly under body) collapses into a single document.body pass.
            body.querySelectorAllCalls = 0;
            const stormNodes = Array.from({ length: 45 }, () => {
                const card = body.appendChild(new MockElement('div', ['character_select']));
                return card;
            });
            observerCallback([
                { type: 'childList', addedNodes: stormNodes },
            ]);
            expect(rafQueue.length).toBe(1);
            rafQueue.shift()();
            expect(body.querySelectorAllCalls).toBe(2);
            expect(stormNodes.every(card => card.attributes.get('tabindex') === '0' && card.querySelectorAllCalls === 0)).toBe(true);

            // Streaming burst (> 40 sibling nodes inside .mes_text) scans ONLY .mes_text (LCA), NOT document.body!
            body.querySelectorAllCalls = 0;
            const mesText = mesRow.appendChild(new MockElement('div', ['mes_text']));
            const streamParagraphs = Array.from({ length: 48 }, () => {
                const p = mesText.appendChild(new MockElement('p', []));
                p.appendChild(new MockElement('div', ['menu_button']));
                return p;
            });
            observerCallback([
                { type: 'childList', addedNodes: streamParagraphs },
            ]);
            expect(rafQueue.length).toBe(1);
            rafQueue.shift()();
            expect(body.querySelectorAllCalls).toBe(0);
            expect(mesText.querySelectorAllCalls).toBe(2);
            expect(streamParagraphs.every(p => p.children[0].attributes.get('tabindex') === '0')).toBe(true);

            // Background-tab queue overflow (> 512 queued nodes while rAF is paused) caps memory and flushes once via body.
            body.querySelectorAllCalls = 0;
            const overflowNodes = Array.from({ length: 530 }, () => {
                const detached = new MockElement('div', ['menu_button']);
                detached.isConnected = false;
                return detached;
            });
            const survivingBtn = body.appendChild(new MockElement('div', ['menu_button']));
            observerCallback([
                { type: 'childList', addedNodes: [...overflowNodes, survivingBtn] },
            ]);
            expect(rafQueue.length).toBe(1);
            rafQueue.shift()();
            expect(body.querySelectorAllCalls).toBe(2);
            expect(survivingBtn.attributes.get('tabindex')).toBe('0');
        } finally {
            global.CSS = prevGlobals.CSS;
            global.Node = prevGlobals.Node;
            global.Element = prevGlobals.Element;
            global.HTMLElement = prevGlobals.HTMLElement;
            global.MutationObserver = prevGlobals.MutationObserver;
            global.document = prevGlobals.document;
            global.requestAnimationFrame = prevGlobals.requestAnimationFrame;
        }
    });

    test('characters.js preserves root name and tags on legacy V2 cards where data.name and data.tags are undefined', async () => {
        const avatarName = 'LegacyRootCard.png';
        fs.writeFileSync(path.join(directories.characters, avatarName), 'placeholder-png-bytes');

        const legacyV2Payload = JSON.stringify({
            name: 'LegacyRootAlice',
            tags: ['legacy-tag'],
            spec: 'chara_card_v2',
            spec_version: '2.0',
            data: {
                description: 'V2 data without data.name',
                first_mes: 'Greetings!',
                extensions: {
                    fav: true,
                },
            },
        });

        jest.spyOn(charactersModule.diskCache, 'instance').mockResolvedValue(/** @type {any} */ ({
            getItem: jest.fn().mockResolvedValue(legacyV2Payload),
            setItem: jest.fn().mockResolvedValue(undefined),
        }));

        const handler = getFinalRouteHandler(charactersModule.router, 'post', '/get');
        const result = await invokeHandler(handler, {
            body: { avatar_url: avatarName },
            user: { directories },
        });
        expect(result.statusCode).toBe(200);
        expect(result.payload.name).toBe('LegacyRootAlice');
        expect(result.payload.tags).toEqual(['legacy-tag']);
        expect(result.payload.description).toBe('V2 data without data.name');
    });

    test('saveChatConditional aborts cross-chat drift during lock wait, tolerates same-avatar this_chid reindexing, and propagates boolean save status', async () => {
        const { state, fns } = await createChatSaveVmHarness();
        const { saveChat, saveChatConditional } = fns;

        // 1. Happy path returns true and saves Alice's 'main' chat.
        expect(await saveChatConditional()).toBe(true);
        expect(state.fetchRequests).toHaveLength(1);
        expect(state.fetchRequests[0].body.avatar_url).toBe('Alice.png');
        expect(state.tokenCacheSaved).toBe(1);

        // 2. Same character ('Alice.png', 'main') reindexed by getCharacters() ('1' string -> 0 number after deleting Zoe.png) MUST NOT false-abort!
        state.isChatSaving = true;
        state.waitHook = async () => {
            state.characters.shift(); // Removes Zoe.png; Alice.png moves from index 1 to 0
            state.this_chid = 0; // Numeric index instead of string '1'
            state.isChatSaving = false;
        };
        expect(await saveChatConditional()).toBe(true);
        expect(state.fetchRequests).toHaveLength(2);
        expect(state.fetchRequests[1].body.avatar_url).toBe('Alice.png');
        expect(state.fetchRequests[1].body.file_name).toBe('main');
        expect(state.tokenCacheSaved).toBe(2);
        state.waitHook = null;

        // 3. HTTP 500 returns false and skips saveTokenCache / saveItemizedPrompts.
        state.nextFetchOk = false;
        expect(await saveChatConditional()).toBe(false);
        expect(state.fetchRequests).toHaveLength(3);
        expect(state.tokenCacheSaved).toBe(2);

        // 4. Same-filename ('main') switch from Alice.png to Bob.png during lock wait aborts without calling fetch!
        state.nextFetchOk = true;
        state.isChatSaving = true;
        state.waitHook = async () => {
            // Simulate in-flight save finishing while user switched to Bob ('main' chat on both!)
            state.this_chid = 1;
            state.name2 = 'Bob';
            state.chat = [{ mes: 'Bob untouched floor' }];
            state.isChatSaving = false;
        };
        expect(await saveChatConditional()).toBe(false);
        // No save request was sent for Bob!
        expect(state.fetchRequests).toHaveLength(3);
        state.waitHook = null;

        // 5. Force-overwrite (OVERWRITE) after switching active character A -> B (and even into a group!) preserves bound target A & snapshot!
        state.this_chid = 0; // Alice.png
        state.selected_group = null;
        state.name2 = 'Alice';
        state.chat = [{ mes: 'Alice original floor before conflict' }];
        state.chat_metadata = { integrity: 'alice-integrity-1' };
        const overwriteRequests = [];
        const scriptedResponses = [
            () => {
                // While the first request is in flight, active chat switches to Bob (or even a group)!
                state.this_chid = 1; // Bob.png
                state.name2 = 'Bob';
                state.selected_group = 'group-switched-mid-popup';
                state.chat = [{ mes: 'Bob floor that must never overwrite or receive Alice snapshot' }];
                state.chat_metadata = { integrity: 'bob-integrity-999' };
                return {
                    ok: false,
                    status: 400,
                    statusText: 'Bad Request',
                    json: async () => ({ error: 'integrity' }),
                };
            },
            () => ({ ok: true, status: 200, json: async () => ({ result: 'ok' }) }),
        ];
        state.customFetchHandler = async (url, init) => {
            const parsed = JSON.parse(init.body);
            overwriteRequests.push({ url, body: parsed });
            const nextStep = scriptedResponses.shift();
            return nextStep();
        };
        state.popupHandler = async () => 'OVERWRITE';

        expect(await saveChat()).toBe(true);
        expect(overwriteRequests).toHaveLength(2);
        expect(overwriteRequests[0].body.force).toBe(false);
        expect(overwriteRequests[1].body.force).toBe(true);
        expect(overwriteRequests[1].body.avatar_url).toBe('Alice.png');
        expect(overwriteRequests[1].body.ch_name).toBe('Alice');
        expect(overwriteRequests[1].body.file_name).toBe('main');
        expect(overwriteRequests[1].body.chat).toEqual([
            {
                chat_metadata: { integrity: 'alice-integrity-1' },
                user_name: 'unused',
                character_name: 'unused',
            },
            { mes: 'Alice original floor before conflict' },
        ]);
    });

    test('native branchChat / createBranch and group save retries keep original bound target, snapshot, and save lock across mid-flight switches and OVERWRITE', async () => {
        const { state, fns } = await createBranchAndGroupVmHarness();
        const { branchChat, selectCharacterById, saveGroupChat, saveGroupBookmarkChat } = fns;

        // A. Exact Reviewer P1 #1 reproduction:
        // Start Alice's branch save; while save request is in flight:
        // 1) Native UI selectCharacterById(1) is blocked by isChatSaving lock!
        // 2) Even if external code force-switches this_chid/chat/metadata to Bob before OVERWRITE confirmation,
        //    OVERWRITE still writes Alice's snapshot into Alice.png (never Bob.png), and branchChat does NOT hijack Bob's open chat!
        state.onInitialConflictSave = async () => {
            state.lockObservedDuringInitialFetch = state.isChatSaving;
            await selectCharacterById(1);
            state.chidAfterBlockedUiSwitch = state.this_chid;

            // Force-simulate character switch to Bob while awaiting integrity conflict + OVERWRITE:
            state.this_chid = 1;
            state.name2 = 'Bob';
            state.chat = [{ mes: 'Bob active chat floor' }];
            state.chat_metadata = { integrity: 'bob-meta', note: 'from-bob' };
        };

        const createdBranchName = await branchChat(0);
        expect(createdBranchName).toBe('Alice - Main - Branch #1');
        expect(state.lockObservedDuringInitialFetch).toBe(true);
        expect(state.chidAfterBlockedUiSwitch).toBe(0); // Native switch blocked by shared save lock!
        expect(state.infoToasts.length).toBeGreaterThan(0);

        const chatSaveCalls = state.requests.filter(r => r.url === '/api/chats/save');
        expect(chatSaveCalls).toHaveLength(2);
        for (const call of chatSaveCalls) {
            expect(call.lockHeldDuringFetch).toBe(true);
            expect(call.body.avatar_url).toBe('Alice.png');
            expect(call.body.ch_name).toBe('Alice');
            expect(call.body.file_name).toBe('Alice - Main - Branch #1');
            expect(call.body.chat[0].chat_metadata).toEqual({
                integrity: 'branch-uuid-1',
                note: 'from-alice',
                main_chat: 'Alice - Main',
            });
            expect(call.body.chat.slice(1)).toEqual([{ mes: 'Alice branch floor 0', extra: {} }]);
        }
        expect(chatSaveCalls[0].body.force).toBe(false);
        expect(chatSaveCalls[1].body.force).toBe(true);
        expect(state.aliceOriginalMessage.extra.branches).toEqual(['Alice - Main - Branch #1']);
        // Because active chat drifted to Bob, branchChat must NOT overwrite itemizedPrompts or call openCharacterChat on Bob!
        expect(state.itemizedSaved).toEqual([]);
        expect(state.openedCharacterChats).toEqual([]);
        expect(state.isChatSaving).toBe(false);

        // B. Group saveGroupChat & saveGroupBookmarkChat force-overwrite retries keep bound group chat_id & snapshot!
        state.requests = [];
        state.selected_group = 'grp-1';
        state.groups[0].chat_id = 'group-chat-a';
        state.chat = [{ mes: 'Group A original floor' }];
        state.chat_metadata = { integrity: 'grp-meta-a' };
        state.onInitialConflictSave = async () => {
            // Mutate group chat_id, chat contents, and chat_metadata mid-flight before OVERWRITE!
            state.groups[0].chat_id = 'group-chat-b';
            state.chat = [{ mes: 'Group B mutated floor' }];
            state.chat_metadata = { integrity: 'grp-meta-b' };
        };

        expect(await saveGroupChat('grp-1', true)).toBe(true);
        expect(state.requests).toHaveLength(2);
        expect(state.requests[0].body.force).toBe(false);
        expect(state.requests[1].body.force).toBe(true);
        expect(state.requests[1].body.id).toBe('group-chat-a');
        expect(state.requests[1].body.chat).toEqual([
            {
                chat_metadata: { integrity: 'grp-meta-a' },
                user_name: 'unused',
                character_name: 'unused',
            },
            { mes: 'Group A original floor' },
        ]);

        // Also verify saveGroupBookmarkChat binds snapshot across OVERWRITE and appends to group.chats once on success!
        state.requests = [];
        state.groups[0].chats = ['group-chat-a'];
        state.chat = [{ mes: 'Group branch floor 0' }];
        state.chat_metadata = { integrity: 'grp-branch-base' };
        expect(await saveGroupBookmarkChat('grp-1', 'group-chat-a - Branch #1', { main_chat: 'group-chat-a' }, 0)).toBe(true);
        expect(state.requests).toHaveLength(2);
        expect(state.requests[1].body.force).toBe(true);
        expect(state.requests[1].body.id).toBe('group-chat-a - Branch #1');
        expect(state.requests[1].body.chat[1]).toEqual({ mes: 'Group branch floor 0' });
        expect(state.groups[0].chats).toEqual(['group-chat-a', 'group-chat-a - Branch #1']);
    });

    test('world-info.js dry-run guards suppress global scan events and preserve externalActivations', () => {
        const wiPath = fileURLToPath(new URL('../public/scripts/world-info.js', import.meta.url));
        const wiSource = fs.readFileSync(wiPath, 'utf8');

        expect(wiSource).toContain('export async function getSortedEntries({ isDryRun = false } = {})');
        expect(wiSource).toMatch(/if\s*\(!isDryRun\)\s*\{\s*await eventSource\.emit\(event_types\.WORLDINFO_ENTRIES_LOADED/);
        expect(wiSource).toContain('const sortedEntries = await getSortedEntries({ isDryRun });');
        expect(wiSource).toMatch(/if\s*\(!isDryRun\)\s*\{\s*await eventSource\.emit\(event_types\.WORLDINFO_SCAN_DONE/);
        expect(wiSource).toMatch(/if\s*\(!isDryRun\)\s*\{\s*buffer\.resetExternalEffects\(\);\s*\}/);
    });
});
