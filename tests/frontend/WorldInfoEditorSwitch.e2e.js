import { test, expect } from '@playwright/test';
import { testSetup } from './frontent-test-utils.js';

test.describe('World Info Editor Switch & OriginalData Sync', () => {
    test.beforeEach(testSetup.awaitST);

    test('switches lorebooks cleanly, isolates cache clones, syncs originalData by uid, and filters via Set', async ({ page }) => {
        const bookA = 'STAGE_PERF_SWITCH_A';
        const bookB = 'STAGE_PERF_SWITCH_B';

        const result = await page.evaluate(async ({ bookA, bookB }) => {
            const wi = await import('./scripts/world-info.js');
            const { FilterHelper, FILTER_TYPES } = await import('./scripts/filters.js');
            const { power_user } = await import('./scripts/power-user.js');

            const {
                createNewWorldInfo,
                createWorldInfoEntry,
                deleteWorldInfo,
                deleteWIOriginalDataValue,
                loadWorldInfo,
                openWorldInfoEditor,
                saveWorldInfo,
                setWIOriginalDataValue,
                worldInfoCache,
                world_names,
            } = wi;

            const prevPlaintext = power_user.wi_key_input_plaintext;
            power_user.wi_key_input_plaintext = false;

            try {
                for (const name of [bookA, bookB]) {
                    if (world_names.includes(name)) {
                        await deleteWorldInfo(name);
                    }
                }

                await createNewWorldInfo(bookA, { interactive: false });
                await createNewWorldInfo(bookB, { interactive: false });

                // Evict bookA from cache so the next loadWorldInfo(bookA) exercises the cache-miss path
                worldInfoCache.delete(bookA);
                const missLoaded = await loadWorldInfo(bookA);
                missLoaded.entries.__mutatedInMemory = { uid: 999, comment: 'transient' };
                const hitLoaded = await loadWorldInfo(bookA);
                const cacheMissIsolated = !('__mutatedInMemory' in hitLoaded.entries);

                // Populate bookA (5 entries) and bookB (12 entries)
                const dataA = await loadWorldInfo(bookA);
                for (let i = 0; i < 5; i++) {
                    const entry = createWorldInfoEntry(bookA, dataA);
                    entry.key = [`alpha_${i}`, 'shared_key'];
                    entry.comment = `Alpha Entry ${i}`;
                    entry.content = `Alpha content ${i}`;
                }
                await saveWorldInfo(bookA, dataA, true);

                const dataB = await loadWorldInfo(bookB);
                for (let i = 0; i < 12; i++) {
                    const entry = createWorldInfoEntry(bookB, dataB);
                    entry.key = [`beta_${i}`, 'shared_key'];
                    entry.comment = `Beta Entry ${i}`;
                    entry.content = `Beta content ${i}`;
                }
                await saveWorldInfo(bookB, dataB, true);

                async function waitForCondition(predicate, timeoutMs = 5000) {
                    const start = Date.now();
                    while (Date.now() - start < timeoutMs) {
                        if (predicate()) {
                            return true;
                        }
                        await new Promise(resolve => setTimeout(resolve, 25));
                    }
                    return predicate();
                }

                async function waitForEntryCount(expected, timeoutMs = 5000) {
                    await waitForCondition(
                        () => document.querySelectorAll('#world_popup_entries_list .world_entry').length === expected,
                        timeoutMs,
                    );
                    return document.querySelectorAll('#world_popup_entries_list .world_entry').length;
                }

                // Switch A -> B, expand an entry in B so live Select2 instances exist during clearEntryList, then switch back to A
                openWorldInfoEditor(bookA);
                const countA1 = await waitForEntryCount(5);
                openWorldInfoEditor(bookB);
                const countB1 = await waitForEntryCount(12);
                document.querySelector('#world_popup_entries_list .world_entry .inline-drawer-toggle')?.dispatchEvent(
                    new MouseEvent('click', { bubbles: true, cancelable: true }),
                );
                await waitForCondition(() => Boolean($('#world_popup_entries_list .world_entry select[name="key"]').first().data('select2')));

                openWorldInfoEditor(bookA);
                const countA2 = await waitForEntryCount(5);

                // Expand first entry in A and verify lazy Select2 key helper options are populated and sorted accurately
                document.querySelector('#world_popup_entries_list .world_entry .inline-drawer-toggle')?.dispatchEvent(
                    new MouseEvent('click', { bubbles: true, cancelable: true }),
                );
                await waitForCondition(() => Boolean($('#world_popup_entries_list .world_entry select[name="key"]').first().data('select2')));
                const firstKeySelect = $('#world_popup_entries_list .world_entry select[name="key"]').first();
                firstKeySelect.select2('open');
                await waitForCondition(() => document.querySelectorAll('.select2-container--open .select2-results__option').length >= 5);
                const renderedKeyTexts = $('.select2-container--open .select2-results__option')
                    .map((_, el) => $(el).text().trim())
                    .get();
                firstKeySelect.select2('close');

                // Verify WeakMap uid index syncs across edit, push, delete, and in-place replacement
                const tracked = {
                    entries: {},
                    originalData: {
                        entries: [
                            { uid: 0, comment: 'zero', keys: ['k0'], extensions: {} },
                            { uid: 1, comment: 'one', keys: ['k1'], extensions: {} },
                            { uid: 2, comment: 'two', keys: ['k2'], extensions: {} },
                        ],
                    },
                };
                setWIOriginalDataValue(tracked, 1, 'comment', 'one-updated');
                setWIOriginalDataValue(tracked, 1, 'extensions.depth', 6);
                tracked.originalData.entries.push({ uid: 3, comment: 'three', keys: ['k3'], extensions: {} });
                setWIOriginalDataValue(tracked, 3, 'comment', 'three-updated');
                deleteWIOriginalDataValue(tracked, '1');
                setWIOriginalDataValue(tracked, 1, 'comment', 'should-not-resurrect');
                setWIOriginalDataValue(tracked, 2, 'comment', 'two-updated');

                // Verify FilterHelper wiSearchFilter Set lookup preserves ordering & subset
                const filterHelper = new FilterHelper(() => {});
                filterHelper.setFilterData(FILTER_TYPES.WORLD_INFO_SEARCH, 'Beta Entry 1');
                const sampleEntries = Object.values(dataB.entries);
                const filtered = filterHelper.wiSearchFilter(sampleEntries);

                return {
                    cacheMissIsolated,
                    countA1,
                    countB1,
                    countA2,
                    renderedKeyTexts,
                    remainingOriginalUids: tracked.originalData.entries.map(e => e.uid),
                    updatedTwo: tracked.originalData.entries.find(e => e.uid === 2)?.comment,
                    updatedThree: tracked.originalData.entries.find(e => e.uid === 3)?.comment,
                    filteredUids: filtered.map(e => e.uid),
                    filteredAllMatchB: filtered.every(e => sampleEntries.includes(e)),
                };
            } finally {
                power_user.wi_key_input_plaintext = prevPlaintext;
                for (const name of [bookA, bookB]) {
                    if (world_names.includes(name)) {
                        await deleteWorldInfo(name);
                    }
                }
            }
        }, { bookA, bookB });

        expect(result.cacheMissIsolated).toBe(true);
        expect(result.countA1).toBe(5);
        expect(result.countB1).toBe(12);
        expect(result.countA2).toBe(5);
        expect(result.renderedKeyTexts[0]).toContain('shared_key');
        expect(result.renderedKeyTexts.some(t => t.includes('beta_'))).toBe(false);
        expect(result.remainingOriginalUids).toEqual([0, 2, 3]);
        expect(result.updatedTwo).toBe('two-updated');
        expect(result.updatedThree).toBe('three-updated');
        expect(result.filteredUids.length).toBeGreaterThan(0);
        expect(result.filteredAllMatchB).toBe(true);
    });
});
