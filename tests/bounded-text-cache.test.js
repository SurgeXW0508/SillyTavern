import { describe, test, expect } from '@jest/globals';
import { BoundedTextCache } from '../public/scripts/util/bounded-text-cache.js';

describe('BoundedTextCache', () => {
    test('stores, refreshes LRU order on get, updates existing keys, and tracks totalChars accurately', () => {
        const cache = new BoundedTextCache({ maxEntries: 3, maxChars: 100 });
        cache.set('k1', 'alpha'); // 2 + 5 = 7
        cache.set('k2', 'bravo'); // 2 + 5 = 7 -> 14
        cache.set('k3', 'charlie'); // 2 + 7 = 9 -> 23
        expect(cache.size).toBe(3);
        expect(cache.totalChars).toBe(23);

        // Refresh k1 so k2 becomes least-recently-used
        expect(cache.get('k1')).toBe('alpha');
        cache.set('k4', 'delta'); // evicts k2 (7), adds 7 -> 23
        expect(cache.has('k2')).toBe(false);
        expect(cache.has('k1')).toBe(true);
        expect(cache.has('k3')).toBe(true);
        expect(cache.has('k4')).toBe(true);
        expect(cache.totalChars).toBe(23);

        // Overwrite k4 with longer value without double-counting
        cache.set('k4', 'delta-extended'); // -7 + (2 + 14 = 16) -> 32
        expect(cache.size).toBe(3);
        expect(cache.totalChars).toBe(32);

        cache.clear();
        expect(cache.size).toBe(0);
        expect(cache.totalChars).toBe(0);
    });

    test('evicts oldest entries when character budget is exceeded and allows a single oversized item alone', () => {
        const cache = new BoundedTextCache({ maxEntries: 16, maxChars: 20 });
        cache.set('a', '12345678'); // 9
        cache.set('b', '12345678'); // 9 -> 18
        cache.set('c', '12345678'); // +9 > 20 -> evicts 'a' -> 18
        expect(cache.has('a')).toBe(false);
        expect(cache.has('b')).toBe(true);
        expect(cache.has('c')).toBe(true);
        expect(cache.totalChars).toBe(18);

        // Oversized single entry evicts everything else, occupies cache alone, then is evicted on next set
        const huge = 'x'.repeat(50);
        cache.set('huge', huge);
        expect(cache.size).toBe(1);
        expect(cache.get('huge')).toBe(huge);
        expect(cache.totalChars).toBe(4 + 50);

        cache.set('small', 'ok');
        expect(cache.has('huge')).toBe(false);
        expect(cache.size).toBe(1);
        expect(cache.get('small')).toBe('ok');
        expect(cache.totalChars).toBe(5 + 2);
    });
});
