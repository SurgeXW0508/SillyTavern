import { test, expect } from '@playwright/test';
import { setupCoreReliability } from '../util/core-reliability-fixture.mjs';

test.beforeEach(async ({ page }) => setupCoreReliability(page));

test('WorldInfoBuffer scan reuse matches full checkWorldInfo behavior across recursion, min_activations, injections, context flags, case sensitivity, whole words, regex, and group scoring', async ({ page }) => {
    const bookName = 'STAGE_CORE_PERF_WI_BOOK';
    const result = await page.evaluate(async ({ bookName }) => {
        const st = await import('/script.js');
        const wi = await import('/scripts/world-info.js');
        const {
            checkWorldInfo,
            createNewWorldInfo,
            createWorldInfoEntry,
            deleteWorldInfo,
            loadWorldInfo,
            saveWorldInfo,
            selected_world_info,
            world_info_logic,
            world_names,
        } = wi;

        const prevSelected = [...selected_world_info];
        const prevDepth = Number($('#world_info_depth').val() || 2);
        const prevMinAct = Number($('#world_info_min_activations').val() || 0);
        const prevMaxDepth = Number($('#world_info_min_activations_depth_max').val() || 0);
        const prevMaxSteps = Number($('#world_info_max_recursion_steps').val() || 0);
        const prevCase = $('#world_info_case_sensitive').prop('checked');
        const prevWhole = $('#world_info_match_whole_words').prop('checked');
        const prevGroupScoring = $('#world_info_use_group_scoring').prop('checked');
        const prevBudget = Number($('#world_info_budget').val() || 25);

        try {
            if (world_names.includes(bookName)) {
                await deleteWorldInfo(bookName);
            }
            await createNewWorldInfo(bookName, { interactive: false });
            const data = await loadWorldInfo(bookName);

            // 1. Plain case-insensitive + triggers recursion keyword
            const e1 = createWorldInfoEntry(bookName, data);
            Object.assign(e1, {
                key: ['dragonstone', 'valyrian'],
                content: 'Lore E1 unlocks RECURSE_SIGIL_TOKEN.',
                caseSensitive: false,
                matchWholeWords: false,
                order: 100,
            });

            // 2. Activated only via recursion (must NOT activate during MIN_ACTIVATIONS scan)
            const e2 = createWorldInfoEntry(bookName, data);
            Object.assign(e2, {
                key: ['recurse_sigil_token'],
                content: 'Lore E2 activated from recursion.',
                caseSensitive: false,
                order: 95,
            });

            // 3. Case-sensitive check: 'CitadelVault' vs 'citadelvault'
            const e3 = createWorldInfoEntry(bookName, data);
            Object.assign(e3, {
                key: ['CitadelVault'],
                content: 'Lore E3 case-sensitive hit.',
                caseSensitive: true,
                order: 90,
            });

            // 4. Whole-word boundary check: 'ark' should NOT match 'darkness', only standalone 'ark'
            const e4 = createWorldInfoEntry(bookName, data);
            Object.assign(e4, {
                key: ['ark'],
                content: 'Lore E4 whole-word hit.',
                matchWholeWords: true,
                caseSensitive: false,
                order: 85,
            });

            // 5. Regex key check
            const e5 = createWorldInfoEntry(bookName, data);
            Object.assign(e5, {
                key: ['/rune-\\d{3}/i'],
                content: 'Lore E5 regex hit.',
                order: 80,
            });

            // 6. Persona context flag check
            const e6 = createWorldInfoEntry(bookName, data);
            Object.assign(e6, {
                key: ['starforged_persona'],
                matchPersonaDescription: true,
                content: 'Lore E6 persona context hit.',
                order: 75,
            });

            // 7. Inclusion group scoring: e7B matches 2 keys + 1 secondary key vs e7A matching 1 key
            const e7A = createWorldInfoEntry(bookName, data);
            Object.assign(e7A, {
                key: ['guild_banner'],
                group: 'guild_slot',
                groupOverride: false,
                useGroupScoring: true,
                weight: 100,
                content: 'Lore E7A lower score.',
                order: 70,
            });
            const e7B = createWorldInfoEntry(bookName, data);
            Object.assign(e7B, {
                key: ['guild_banner', 'silver_coin'],
                keysecondary: ['merchant_seal'],
                selective: true,
                selectiveLogic: world_info_logic.AND_ALL,
                group: 'guild_slot',
                groupOverride: false,
                useGroupScoring: true,
                weight: 100,
                content: 'Lore E7B higher score winner.',
                order: 71,
            });

            // 8. Deeper message entry unlocked when min_activations advances skew
            const e8 = createWorldInfoEntry(bookName, data);
            Object.assign(e8, {
                key: ['ancient_depth_relic'],
                content: 'Lore E8 deep skew hit.',
                order: 65,
            });

            // 9. Extension prompt injection match
            const e9 = createWorldInfoEntry(bookName, data);
            Object.assign(e9, {
                key: ['injected_beacon_phrase'],
                content: 'Lore E9 extension injection hit.',
                order: 60,
            });

            await saveWorldInfo(bookName, data, true);
            selected_world_info.splice(0, selected_world_info.length, bookName);

            // Configure UI/settings via jQuery change events so module-scoped WI vars update
            $('#world_info_depth').val(2).trigger('input');
            $('#world_info_budget').val(80).trigger('input');
            $('#world_info_case_sensitive').prop('checked', false).trigger('change');
            $('#world_info_match_whole_words').prop('checked', false).trigger('change');
            $('#world_info_use_group_scoring').prop('checked', true).trigger('change');

            // Mode A: Recursion scan (max_recursion_steps = 3, min_activations = 0)
            $('#world_info_min_activations').val(0).trigger('input');
            $('#world_info_max_recursion_steps').val(3).trigger('input');

            st.setExtensionPrompt('CORE_PERF_TEST_INJECT', 'Signal: INJECTED_BEACON_PHRASE', 1, 0, true);

            const messages = [
                'We arrived at DragonStone carrying a silver_coin and merchant_seal under guild_banner in total darkness.',
                'Inside citadelvault (lowercase) we saw RUNE-404 carved on stone.',
                'Four floors deeper lay the ancient_depth_relic beside an ark.',
            ];
            const globalScanData = {
                personaDescription: 'Traveler with STARFORGED_PERSONA heritage.',
                characterDescription: '',
                characterPersonality: '',
                characterDepthPrompt: '',
                scenario: '',
                creatorNotes: '',
                trigger: 'normal',
            };

            const scanA = await checkWorldInfo(messages, 8192, true, globalScanData);
            const activatedA = [...scanA.allActivatedEntries].map(e => e.content).sort();

            // Mutate personaDescription + uppercase CitadelVault to verify fresh scan & case-sensitive match
            const scanA2 = await checkWorldInfo(
                ['CitadelVault unlocked.', ...messages.slice(1)],
                8192,
                true,
                { ...globalScanData, personaDescription: 'Ordinary traveler.' },
            );
            const activatedA2 = [...scanA2.allActivatedEntries].map(e => e.content).sort();

            // Mode B: min_activations skew scan (max_recursion_steps = 0, min_activations = 8, depth_max = 5)
            $('#world_info_max_recursion_steps').val(0).trigger('input');
            $('#world_info_min_activations').val(8).trigger('input');
            $('#world_info_min_activations_depth_max').val(5).trigger('input');
            const scanB = await checkWorldInfo(messages, 8192, true, globalScanData);
            const activatedB = [...scanB.allActivatedEntries].map(e => e.content).sort();

            return { activatedA, activatedA2, activatedB };
        } finally {
            st.setExtensionPrompt('CORE_PERF_TEST_INJECT', '', 1, 0, false);
            selected_world_info.splice(0, selected_world_info.length, ...prevSelected);
            $('#world_info_depth').val(prevDepth).trigger('input');
            $('#world_info_min_activations').val(prevMinAct).trigger('input');
            $('#world_info_min_activations_depth_max').val(prevMaxDepth).trigger('input');
            $('#world_info_max_recursion_steps').val(prevMaxSteps).trigger('input');
            $('#world_info_case_sensitive').prop('checked', prevCase).trigger('change');
            $('#world_info_match_whole_words').prop('checked', prevWhole).trigger('change');
            $('#world_info_use_group_scoring').prop('checked', prevGroupScoring).trigger('change');
            $('#world_info_budget').val(prevBudget).trigger('input');
            if (world_names.includes(bookName)) {
                await deleteWorldInfo(bookName);
            }
        }
    }, { bookName });

    // Scan A (depth=2, recursion=3): E1, E2 (via recursion), E5, E6, E7B (wins group), E9 (inject); NOT E3 (wrong case), NOT E4 ('darkness' != whole word 'ark', and msg[2] is depth 3), NOT E8 (depth 3)
    expect(result.activatedA).toEqual([
        'Lore E1 unlocks RECURSE_SIGIL_TOKEN.',
        'Lore E2 activated from recursion.',
        'Lore E5 regex hit.',
        'Lore E6 persona context hit.',
        'Lore E7B higher score winner.',
        'Lore E9 extension injection hit.',
    ]);

    // Scan A2: CitadelVault matches E3, personaDescription changed so E6 does NOT match
    expect(result.activatedA2).toContain('Lore E3 case-sensitive hit.');
    expect(result.activatedA2).not.toContain('Lore E6 persona context hit.');

    // Scan B (min_activations advances skew to msg[2]): E4 ('ark' whole word) and E8 ('ancient_depth_relic') activate
    expect(result.activatedB).toContain('Lore E4 whole-word hit.');
    expect(result.activatedB).toContain('Lore E8 deep skew hit.');
});

test('evaluateMacros and MacroEngine plain-text fast paths preserve side effects, legacy angle macros, and pre/post processors', async ({ page }) => {
    const result = await page.evaluate(async () => {
        const st = await import('/script.js');
        const { evaluateMacros, MacrosParser } = await import('/scripts/macros.js');
        const { MacroEngine } = await import('/scripts/macros/engine/MacroEngine.js');
        const { MacroEnvBuilder } = await import('/scripts/macros/engine/MacroEnvBuilder.js');
        const { power_user } = await import('/scripts/power-user.js');

        const prevExperimental = power_user.experimental_macro_engine;
        const prevPreferCharPrompt = power_user.prefer_character_prompt;
        const prevChatIdHash = st.chat_metadata.chat_id_hash;

        const preHandler = (text) => text.replaceAll('__INJECT_USER__', '{{reverse::abc}}');
        const postHandler = (text) => text.replaceAll('[POST_MARK]', '<POST_OK>');

        try {
            // 1. Legacy evaluateMacros checks
            power_user.experimental_macro_engine = false;
            power_user.prefer_character_prompt = true;
            delete st.chat_metadata.chat_id_hash;

            MacrosParser.registerMacro('corePerfLegacyTestMacro', () => 'legacy-val');

            let charPromptGetterReads = 0;
            const env = {
                user: 'Alice',
                char: 'Bob',
                get charPrompt() {
                    charPromptGetterReads++;
                    return 'Custom char prompt';
                },
            };

            const plainOut = evaluateMacros('Ordinary dialogue with {single braces} and <span class="x">html</span>.', env);
            const hashInitializedOnPlain = typeof st.chat_metadata.chat_id_hash === 'number';
            const envPopulatedOnPlain = typeof env.corePerfLegacyTestMacro === 'function';

            // Lowercase legacy non-curly macro <user> / <char> must NOT be skipped
            const angleOut = evaluateMacros('Hello <user> and <CHAR>!', { user: 'Alice', char: 'Bob' });
            const curlyOut = evaluateMacros('Sum: {{reverse:123}} / {{corePerfLegacyTestMacro}}', { user: 'Alice', char: 'Bob' });

            // 2. New MacroEngine checks
            const buildEnv = (content) => MacroEnvBuilder.buildFromRawEnv({
                content,
                name1Override: 'Alice',
                name2Override: 'Bob',
            });
            const plainInput1 = 'Plain text with \\{\\{escaped braces\\}\\} and [POST_MARK]';
            const enginePlain = MacroEngine.evaluate(plainInput1, buildEnv(plainInput1));
            MacroEngine.addPreProcessor(preHandler);
            MacroEngine.addPostProcessor(postHandler);

            const plainInput2 = 'No curly macros here [POST_MARK]';
            const enginePostOnPlain = MacroEngine.evaluate(plainInput2, buildEnv(plainInput2));
            const preInput = 'Token: __INJECT_USER__ [POST_MARK]';
            const enginePreIntroducedMacro = MacroEngine.evaluate(preInput, buildEnv(preInput));

            return {
                plainOut,
                charPromptGetterReads,
                hashInitializedOnPlain,
                envPopulatedOnPlain,
                angleOut,
                curlyOut,
                enginePlain,
                enginePostOnPlain,
                enginePreIntroducedMacro,
            };
        } finally {
            MacroEngine.removePreProcessor(preHandler);
            MacroEngine.removePostProcessor(postHandler);
            power_user.experimental_macro_engine = false;
            MacrosParser.unregisterMacro('corePerfLegacyTestMacro');
            power_user.experimental_macro_engine = prevExperimental;
            power_user.prefer_character_prompt = prevPreferCharPrompt;
            if (prevChatIdHash === undefined) {
                delete st.chat_metadata.chat_id_hash;
            } else {
                st.chat_metadata.chat_id_hash = prevChatIdHash;
            }
        }
    });

    expect(result.plainOut).toBe('Ordinary dialogue with {single braces} and <span class="x">html</span>.');
    expect(result.charPromptGetterReads).toBe(1);
    expect(result.hashInitializedOnPlain).toBe(true);
    expect(result.envPopulatedOnPlain).toBe(true);
    expect(result.angleOut).toBe('Hello Alice and Bob!');
    expect(result.curlyOut).toBe('Sum: 321 / legacy-val');
    expect(result.enginePlain).toBe('Plain text with {{escaped braces}} and [POST_MARK]');
    expect(result.enginePostOnPlain).toBe('No curly macros here <POST_OK>');
    expect(result.enginePreIntroducedMacro).toBe('Token: cba <POST_OK>');
});
