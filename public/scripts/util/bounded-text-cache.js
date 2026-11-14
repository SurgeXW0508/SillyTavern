// Adapted from Shalistera/SillyTavern@b34249a6 (AGPL-3.0)

const DEFAULT_MAX_ENTRIES = 16;
const DEFAULT_MAX_CHARS = 2 * 1024 * 1024;

/**
 * Bounded LRU text cache with O(1) incremental character accounting.
 * Designed to live inside a single short-lived scan instance and be collected
 * when that scan finishes. Oversized values may occupy an empty cache alone
 * so back-to-back keyword checks on a large scan slice still reuse work.
 */
export class BoundedTextCache {
    /** @type {Map<string, string>} */
    #entries = new Map();
    #totalChars = 0;
    #maxEntries;
    #maxChars;

    /**
     * @param {object} [options]
     * @param {number} [options.maxEntries=16] Maximum number of resident entries
     * @param {number} [options.maxChars=2097152] Soft character budget across keys + values
     */
    constructor({ maxEntries = DEFAULT_MAX_ENTRIES, maxChars = DEFAULT_MAX_CHARS } = {}) {
        this.#maxEntries = Math.max(1, Math.trunc(maxEntries));
        this.#maxChars = Math.max(0, Math.trunc(maxChars));
    }

    /** @returns {number} Number of cached entries */
    get size() {
        return this.#entries.size;
    }

    /** @returns {number} Total retained UTF-16 code units across keys and values */
    get totalChars() {
        return this.#totalChars;
    }

    /**
     * @param {string} key
     * @returns {boolean}
     */
    has(key) {
        return this.#entries.has(key);
    }

    /**
     * Retrieves a cached string and refreshes its recency order.
     * @param {string} key
     * @returns {string|undefined}
     */
    get(key) {
        if (!this.#entries.has(key)) {
            return undefined;
        }
        const value = /** @type {string} */ (this.#entries.get(key));
        this.#entries.delete(key);
        this.#entries.set(key, value);
        return value;
    }

    /**
     * Stores a string, evicting least-recently-used entries until within budget.
     * @param {string} key
     * @param {string} value
     * @returns {void}
     */
    set(key, value) {
        if (this.#entries.has(key)) {
            const previous = /** @type {string} */ (this.#entries.get(key));
            this.#totalChars -= key.length + previous.length;
            this.#entries.delete(key);
        }

        const entryChars = key.length + value.length;
        while (this.#entries.size > 0
            && (this.#entries.size >= this.#maxEntries || this.#totalChars + entryChars > this.#maxChars)) {
            const oldestKey = /** @type {string} */ (this.#entries.keys().next().value);
            const oldestValue = /** @type {string} */ (this.#entries.get(oldestKey));
            this.#totalChars -= oldestKey.length + oldestValue.length;
            this.#entries.delete(oldestKey);
        }

        this.#entries.set(key, value);
        this.#totalChars += entryChars;
    }

    /**
     * Clears all cached strings and resets character accounting.
     * @returns {void}
     */
    clear() {
        this.#entries.clear();
        this.#totalChars = 0;
    }
}
