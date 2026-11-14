import { test, expect } from '@playwright/test';
import { setupCoreReliability } from '../util/core-reliability-fixture.mjs';

test.beforeEach(async ({ page }) => setupCoreReliability(page));

test('closed-folder Set indexing matches legacy visibility across 3000 characters, groups, selected closed folders, and sub-entity views', async ({ page }) => {
    const result = await page.evaluate(async () => {
        const {
            TAG_FOLDER_TYPES,
            tags,
            tag_map,
            filterByTagState,
        } = await import('/scripts/tags.js');
        const { entitiesFilter } = await import('/script.js');
        const { FILTER_TYPES } = await import('/scripts/filters.js');

        const prevTags = structuredClone(tags);
        const prevTagMap = structuredClone(tag_map);
        const prevTagFilter = structuredClone(entitiesFilter.getFilterData(FILTER_TYPES.TAG));
        const prevSearchFilter = entitiesFilter.getFilterData(FILTER_TYPES.SEARCH);

        // Exact reference implementation of pre-optimization filterByTagState
        function legacyFilterByTagState(entities, { globalDisplayFilters = false, subForEntity = undefined, filterHidden = true } = {}) {
            const filterData = structuredClone(entitiesFilter.getFilterData(FILTER_TYPES.TAG));
            let out = entities.filter(entity => {
                if (entity.type === 'tag') {
                    if (filterData.selected.includes(entity.id) || filterData.excluded.includes(entity.id)) {
                        return false;
                    }
                }
                return true;
            });

            if (globalDisplayFilters) {
                const closedFolders = out.filter(x => x.type === 'tag' && TAG_FOLDER_TYPES[x.item.folder_type] === TAG_FOLDER_TYPES.CLOSED);
                out = out.filter(entity => {
                    if (filterHidden && entity.type !== 'tag' && closedFolders.some(f => entitiesFilter.isElementTagged(entity, f.id) && !filterData.selected.includes(f.id))) {
                        return false;
                    }
                    if (entity.type === 'tag') {
                        return entity.entities.length > 0 || entitiesFilter.getFilterData(FILTER_TYPES.SEARCH);
                    }
                    return true;
                });
            }

            if (subForEntity !== undefined && subForEntity.type === 'tag') {
                const closedFolders = out.filter(x => x.type === 'tag' && TAG_FOLDER_TYPES[x.item.folder_type] === TAG_FOLDER_TYPES.CLOSED);
                out = out.filter(sub => {
                    if (sub.type === 'tag' || !entitiesFilter.isElementTagged(sub, subForEntity.item.id)) {
                        return false;
                    }
                    if (filterHidden && sub.type !== 'tag' && TAG_FOLDER_TYPES[subForEntity.item.folder_type] !== TAG_FOLDER_TYPES.CLOSED && closedFolders.some(f => entitiesFilter.isElementTagged(sub, f.id) && !filterData.selected.includes(f.id))) {
                        return false;
                    }
                    return true;
                });
            }

            return out;
        }

        try {
            tags.splice(0, tags.length);
            for (const k of Object.keys(tag_map)) {
                delete tag_map[k];
            }

            const folderEntities = [];
            // 12 CLOSED folders, 8 OPEN folders, 5 NONE tags
            for (let i = 0; i < 25; i++) {
                const folderType = i < 12 ? 'CLOSED' : i < 20 ? 'OPEN' : 'NONE';
                const tagObj = {
                    id: `perf-folder-${i}`,
                    name: `Folder ${i}`,
                    folder_type: folderType,
                };
                tags.push(tagObj);
                folderEntities.push({
                    type: 'tag',
                    id: tagObj.id,
                    item: tagObj,
                    entities: i === 11 ? [] : [{ id: 0 }], // folder 11 is empty
                });
            }

            const charAndGroupEntities = [];
            for (let c = 0; c < 3000; c++) {
                const avatar = `card_${c}.png`;
                const assigned = [];
                if (c % 3 === 0) assigned.push(`perf-folder-${c % 11}`); // in a closed folder (0..10)
                if (c % 5 === 0) assigned.push(`perf-folder-${12 + (c % 8)}`); // also in an open folder (12..19)
                if (c % 7 === 0) assigned.push(`perf-folder-${20 + (c % 5)}`); // plain tag
                if (assigned.length > 0) {
                    tag_map[avatar] = assigned;
                }
                charAndGroupEntities.push({
                    type: 'character',
                    id: c,
                    item: { avatar, name: `Char ${c}` },
                });
            }

            for (let g = 0; g < 20; g++) {
                const groupId = `group_${g}`;
                tag_map[groupId] = g % 2 === 0 ? [`perf-folder-${g % 10}`] : [`perf-folder-${12 + (g % 8)}`];
                charAndGroupEntities.push({
                    type: 'group',
                    id: groupId,
                    item: { id: groupId, name: `Group ${g}` },
                });
            }

            const allEntities = [...folderEntities, ...charAndGroupEntities];
            entitiesFilter.setFilterData(FILTER_TYPES.SEARCH, '');

            // Case 1: Default state (no selected tags -> all 12 closed folders hide their members)
            entitiesFilter.setFilterData(FILTER_TYPES.TAG, { selected: [], excluded: [] });
            const globalActual1 = filterByTagState(allEntities, { globalDisplayFilters: true }).map(e => `${e.type}:${e.id}`);
            const globalExpected1 = legacyFilterByTagState(allEntities, { globalDisplayFilters: true }).map(e => `${e.type}:${e.id}`);

            // Case 2: Closed folder 0 is selected -> treated as opened!
            entitiesFilter.setFilterData(FILTER_TYPES.TAG, { selected: ['perf-folder-0'], excluded: ['perf-folder-20'] });
            const globalActual2 = filterByTagState(allEntities, { globalDisplayFilters: true }).map(e => `${e.type}:${e.id}`);
            const globalExpected2 = legacyFilterByTagState(allEntities, { globalDisplayFilters: true }).map(e => `${e.type}:${e.id}`);

            // Case 3: Viewing inside an OPEN folder (members also in unselected CLOSED folders stay hidden)
            entitiesFilter.setFilterData(FILTER_TYPES.TAG, { selected: [], excluded: [] });
            const subOpenActual = filterByTagState(allEntities, { subForEntity: folderEntities[12] }).map(e => `${e.type}:${e.id}`);
            const subOpenExpected = legacyFilterByTagState(allEntities, { subForEntity: folderEntities[12] }).map(e => `${e.type}:${e.id}`);

            // Case 4: Viewing inside a CLOSED folder itself (its members MUST be shown!)
            const subClosedActual = filterByTagState(allEntities, { subForEntity: folderEntities[0] }).map(e => `${e.type}:${e.id}`);
            const subClosedExpected = legacyFilterByTagState(allEntities, { subForEntity: folderEntities[0] }).map(e => `${e.type}:${e.id}`);

            // Case 5: No closed folders present (short-circuit path)
            const noClosedEntities = allEntities.filter(e => !(e.type === 'tag' && e.item.folder_type === 'CLOSED'));
            const shortCircuitActual = filterByTagState(noClosedEntities, { globalDisplayFilters: true }).map(e => `${e.type}:${e.id}`);
            const shortCircuitExpected = legacyFilterByTagState(noClosedEntities, { globalDisplayFilters: true }).map(e => `${e.type}:${e.id}`);

            return {
                count1: globalActual1.length,
                match1: JSON.stringify(globalActual1) === JSON.stringify(globalExpected1),
                match2: JSON.stringify(globalActual2) === JSON.stringify(globalExpected2),
                matchSubOpen: JSON.stringify(subOpenActual) === JSON.stringify(subOpenExpected),
                matchSubClosed: JSON.stringify(subClosedActual) === JSON.stringify(subClosedExpected),
                subClosedNonEmpty: subClosedActual.length > 0,
                matchShortCircuit: JSON.stringify(shortCircuitActual) === JSON.stringify(shortCircuitExpected),
            };
        } finally {
            tags.splice(0, tags.length, ...prevTags);
            for (const k of Object.keys(tag_map)) {
                delete tag_map[k];
            }
            Object.assign(tag_map, prevTagMap);
            entitiesFilter.setFilterData(FILTER_TYPES.TAG, prevTagFilter);
            entitiesFilter.setFilterData(FILTER_TYPES.SEARCH, prevSearchFilter);
        }
    });

    expect(result.count1).toBeGreaterThan(1500);
    expect(result.match1).toBe(true);
    expect(result.match2).toBe(true);
    expect(result.matchSubOpen).toBe(true);
    expect(result.matchSubClosed).toBe(true);
    expect(result.subClosedNonEmpty).toBe(true);
    expect(result.matchShortCircuit).toBe(true);
});

test('applyCharacterTagsToMessageDivs filters 1000-floor chat via Set and handles mesIds=0, single floor, range, and empty/null', async ({ page }) => {
    const result = await page.evaluate(async () => {
        const {
            tags,
            tag_map,
            applyCharacterTagsToMessageDivs,
        } = await import('/scripts/tags.js');

        const prevTags = structuredClone(tags);
        const prevTagMap = structuredClone(tag_map);
        const chatEl = document.getElementById('chat');
        const prevHtml = chatEl.innerHTML;

        try {
            tags.splice(0, tags.length,
                { id: 't-hero', name: 'Hero, Lead' },
                { id: 't-mage', name: 'Arcane Mage' },
                { id: 't-rival', name: 'Rival' },
            );
            for (const k of Object.keys(tag_map)) {
                delete tag_map[k];
            }
            tag_map['hero.png'] = ['t-hero', 't-mage'];
            tag_map['rival.png'] = ['t-rival'];

            const frag = document.createDocumentFragment();
            for (let i = 0; i < 1000; i++) {
                const mes = document.createElement('div');
                mes.className = 'mes';
                mes.setAttribute('mesid', String(i));
                mes.setAttribute('data-char-tag-stale', 'true');
                const avatarWrap = document.createElement('div');
                avatarWrap.className = 'avatar';
                const img = document.createElement('img');
                if (i % 3 === 0) {
                    img.setAttribute('src', '/thumbnail?type=avatar&file=hero.png');
                } else if (i % 3 === 1) {
                    img.setAttribute('src', '/thumbnail?type=avatar&file=rival.png');
                } else {
                    img.setAttribute('src', '/User Avatars/user.png');
                }
                avatarWrap.appendChild(img);
                mes.appendChild(avatarWrap);
                frag.appendChild(mes);
            }
            chatEl.replaceChildren(frag);

            // 1. Single mesIds: 0 MUST only update floor 0 and leave floor 1's stale marker intact!
            applyCharacterTagsToMessageDivs({ mesIds: 0 });
            const floor0AfterZero = chatEl.querySelector('.mes[mesid="0"]').getAttribute('data-char-tags');
            const floor0StaleRemoved = !chatEl.querySelector('.mes[mesid="0"]').hasAttribute('data-char-tag-stale');
            const floor1UntouchedOnZero = chatEl.querySelector('.mes[mesid="1"]').hasAttribute('data-char-tag-stale');

            // 2. Single mesIds: 511 updates only floor 511
            applyCharacterTagsToMessageDivs({ mesIds: 511 });
            const floor511Tags = chatEl.querySelector('.mes[mesid="511"]').getAttribute('data-char-tags');
            const floor2StillUntouched = chatEl.querySelector('.mes[mesid="2"]').hasAttribute('data-char-tag-stale');

            // 3. Full range [0..999] updates all 1000 floors accurately
            const fullRange = Array.from({ length: 1000 }, (_, i) => i);
            applyCharacterTagsToMessageDivs({ mesIds: fullRange });

            let all1000Valid = true;
            const children = chatEl.querySelectorAll('.mes');
            for (let i = 0; i < 1000; i++) {
                const el = children[i];
                if (el.hasAttribute('data-char-tag-stale')) {
                    all1000Valid = false;
                    break;
                }
                const charTags = el.getAttribute('data-char-tags');
                if (i % 3 === 0 && charTags !== 'Hero  Lead,Arcane Mage') {
                    all1000Valid = false;
                    break;
                }
                if (i % 3 === 1 && charTags !== 'Rival') {
                    all1000Valid = false;
                    break;
                }
                if (i % 3 === 2 && charTags !== null) {
                    all1000Valid = false;
                    break;
                }
            }

            // 4. Empty / null / default call refreshes all messages cleanly
            chatEl.querySelector('.mes[mesid="999"]').setAttribute('data-char-tag-stale', 'true');
            applyCharacterTagsToMessageDivs({ mesIds: null });
            const nullClearedAll = !chatEl.querySelector('.mes[mesid="999"]').hasAttribute('data-char-tag-stale');

            return {
                floor0AfterZero,
                floor0StaleRemoved,
                floor1UntouchedOnZero,
                floor511Tags,
                floor2StillUntouched,
                all1000Valid,
                nullClearedAll,
            };
        } finally {
            chatEl.innerHTML = prevHtml;
            tags.splice(0, tags.length, ...prevTags);
            for (const k of Object.keys(tag_map)) {
                delete tag_map[k];
            }
            Object.assign(tag_map, prevTagMap);
        }
    });

    expect(result.floor0AfterZero).toBe('Hero  Lead,Arcane Mage');
    expect(result.floor0StaleRemoved).toBe(true);
    expect(result.floor1UntouchedOnZero).toBe(true);
    expect(result.floor511Tags).toBe('Rival');
    expect(result.floor2StillUntouched).toBe(true);
    expect(result.all1000Valid).toBe(true);
    expect(result.nullClearedAll).toBe(true);
});
