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
        if (selector === '.mes_buttons .mes_button') {
            if (!this.classList.contains('mes_button')) return false;
            let ancestor = this.parentElement;
            while (ancestor) {
                if (ancestor.classList.contains('mes_buttons')) return true;
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

            // Non-interactable #chat container class churn (e.g. last_mes / lastInContext) must skip scheduling.
            mesRow.classList.add('last_mes');
            observerCallback([
                { type: 'attributes', attributeName: 'class', target: mesRow, oldValue: 'mes' },
            ]);
            expect(rafQueue.length).toBe(0);

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

            // Mutation storm (> 40 added nodes) collapses into a single document.body pass.
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
});
