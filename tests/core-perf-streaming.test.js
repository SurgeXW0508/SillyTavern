import { describe, test, expect } from '@jest/globals';
import { getMessageDepth } from '../public/scripts/util/message-depth.js';

/**
 * Reference implementation matching upstream SillyTavern's full-array scan.
 * @param {{ is_system?: boolean }[]} chat
 * @param {number|string|undefined} messageId
 * @returns {number|undefined}
 */
function legacyGetMessageDepth(chat, messageId) {
    const usableMessages = chat.map((x, index) => ({ message: x, index })).filter(x => !x.message.is_system);
    const indexOf = usableMessages.findIndex(x => x.index === Number(messageId));
    return messageId >= 0 && indexOf !== -1 ? (usableMessages.length - indexOf - 1) : undefined;
}

describe('getMessageDepth', () => {
    test('counts only non-system messages strictly after target index', () => {
        const messages = [
            { mes: 'u0' },
            { mes: 's1', is_system: true },
            { mes: 'a2', is_system: false },
            { mes: 's3', is_system: true },
            { mes: 'a4' },
        ];
        expect(getMessageDepth(messages, 0)).toBe(2);
        expect(getMessageDepth(messages, '0')).toBe(2);
        expect(getMessageDepth(messages, 1)).toBeUndefined();
        expect(getMessageDepth(messages, 2)).toBe(1);
        expect(getMessageDepth(messages, '2')).toBe(1);
        expect(getMessageDepth(messages, 3)).toBeUndefined();
        expect(getMessageDepth(messages, 4)).toBe(0);
    });

    test('returns undefined for transient, out-of-bounds, system, null, boolean, or non-integer IDs', () => {
        const messages = [{ mes: 'first' }, { mes: 'second' }];
        for (const badId of [undefined, null, '', '   ', false, true, -1, '-1', 2, 99, 0.5, NaN, Infinity, 'abc']) {
            expect(getMessageDepth(messages, badId)).toBeUndefined();
        }
        expect(getMessageDepth(null, 0)).toBeUndefined();
    });

    test('streams last message in O(1) without reading preceding history elements', () => {
        let prefixReads = 0;
        const messages = Array.from({ length: 1000 }, (_, i) => {
            if (i < 999) {
                return new Proxy({ is_system: false }, {
                    get(target, prop) {
                        prefixReads++;
                        return target[prop];
                    },
                });
            }
            return { is_system: false };
        });

        expect(getMessageDepth(messages, 999)).toBe(0);
        expect(prefixReads).toBe(0);
    });

    test('matches legacy full-array formula across randomized chat histories', () => {
        let state = 0x12345678;
        const nextRand = () => {
            state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
            return state / 0x100000000;
        };

        for (let trial = 0; trial < 200; trial++) {
            const length = Math.floor(nextRand() * 40);
            const chat = Array.from({ length }, () => ({
                is_system: nextRand() < 0.3,
            }));
            for (const candidate of [-1, 0, Math.floor(length / 2), length - 1, length, undefined, String(Math.max(0, length - 1))]) {
                expect(getMessageDepth(chat, candidate)).toBe(legacyGetMessageDepth(chat, candidate));
            }
        }
    });
});
