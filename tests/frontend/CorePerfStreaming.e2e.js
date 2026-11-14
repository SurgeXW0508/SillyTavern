import { test, expect } from '@playwright/test';
import { setupCoreReliability } from '../util/core-reliability-fixture.mjs';

test.beforeEach(async ({ page }) => setupCoreReliability(page));

test('streaming skips unchanged reasoning/body DOM writes, reconciles final frame, and never swallows write failures', async ({ page }) => {
    const result = await page.evaluate(async () => {
        const st = await import('/script.js');
        const { PromptReasoning } = await import('/scripts/reasoning.js');
        const { power_user } = await import('/scripts/power-user.js');
        const { createStreamingContentUpdater } = await import('/scripts/util/stream-fadein.js');

        Object.assign(power_user, {
            streaming_fps: 60,
            stream_fade_in: false,
            message_token_count_enabled: false,
        });
        st.changeMainAPI('openai');

        const message = {
            name: 'Assistant',
            mes: '',
            is_user: false,
            is_system: false,
            extra: {},
            send_date: new Date().toISOString(),
            swipe_id: 0,
            swipes: [''],
            swipe_info: [{}],
        };
        st.chat.splice(0, st.chat.length, message);
        await st.redisplayChat({ fade: false });

        const reasoningEl = document.querySelector('#chat .mes[mesid="0"] .mes_reasoning');
        const bodyEl = document.querySelector('#chat .mes[mesid="0"] .mes_text');
        let reasoningMutations = 0;
        let bodyMutations = 0;
        const reasoningObserver = new MutationObserver(() => { reasoningMutations++; });
        const bodyObserver = new MutationObserver(() => { bodyMutations++; });
        reasoningObserver.observe(reasoningEl, { childList: true, characterData: true, subtree: true });
        bodyObserver.observe(bodyEl, { childList: true, characterData: true, subtree: true });

        let clock = Date.now();
        const origNow = Date.now;
        let bodyPhaseReasoningMutations = 0;
        try {
            Date.now = () => clock;
            const p = new st.StreamingProcessor('normal', false, new Date(clock), '', new PromptReasoning());
            p.messageId = 0;
            p.generator = async function* () {
                clock += 50;
                yield { text: '', state: { reasoning: 'Thought 1' }, toolCalls: [] };
                clock += 50;
                yield { text: '', state: { reasoning: 'Thought 1 + 2' }, toolCalls: [] };
                // Transition to body streaming while reasoning stays constant across 5 ticks
                clock += 50;
                yield { text: 'Part A', state: { reasoning: 'Thought 1 + 2' }, toolCalls: [] };
                await Promise.resolve();
                const beforeConstantPhase = reasoningMutations;
                for (const chunk of ['Part A B', 'Part A B C', 'Part A B C D', 'Part A B C D E']) {
                    clock += 50;
                    yield { text: chunk, state: { reasoning: 'Thought 1 + 2' }, toolCalls: [] };
                }
                await Promise.resolve();
                bodyPhaseReasoningMutations = reasoningMutations - beforeConstantPhase;
            };

            const finalOut = await p.generate();
            await p.finalizeIntermediaryMessage(0, finalOut, { unlockUI: true });

            // Second generation reusing the same message element (swipe/regenerate semantics)
            const p2 = new st.StreamingProcessor('swipe', false, new Date(clock), '', new PromptReasoning());
            p2.messageId = 0;
            message.mes = '';
            p2.generator = async function* () {
                clock += 50;
                yield { text: 'Part A B C D E', state: { reasoning: 'Thought 1 + 2' }, toolCalls: [] };
            };
            const swipeOut = await p2.generate();
            await p2.finalizeIntermediaryMessage(0, swipeOut, { unlockUI: true });

            // Direct updater failure accounting check: failed write must throw and not cache html
            const testEl = document.createElement('div');
            document.body.appendChild(testEl);
            const updater = createStreamingContentUpdater();
            let setterThrows = true;
            Object.defineProperty(testEl, 'innerHTML', {
                configurable: true,
                get: () => '',
                set(v) {
                    if (setterThrows) {
                        throw new Error('Synthetic DOM write error');
                    }
                    this.textContent = v;
                },
            });
            let caughtWriteError = false;
            try {
                updater(testEl, '<p>retry-me</p>', false);
            } catch {
                caughtWriteError = true;
            }
            setterThrows = false;
            const retryWrote = updater(testEl, '<p>retry-me</p>', false);
            testEl.remove();

            return {
                bodyPhaseReasoningMutations,
                bodyMutations,
                finalBodyText: bodyEl.textContent.trim(),
                finalReasoningText: reasoningEl.textContent.trim(),
                caughtWriteError,
                retryWrote,
            };
        } finally {
            Date.now = origNow;
            reasoningObserver.disconnect();
            bodyObserver.disconnect();
        }
    });

    expect(result.bodyPhaseReasoningMutations).toBe(0);
    expect(result.bodyMutations).toBeGreaterThanOrEqual(5);
    expect(result.finalBodyText).toBe('Part A B C D E');
    expect(result.finalReasoningText).toBe('Thought 1 + 2');
    expect(result.caughtWriteError).toBe(true);
    expect(result.retryWrote).toBe(true);
});

test('hidden tab throttles intermediate previews to 250ms without throttling token events or error flushes', async ({ page }) => {
    const result = await page.evaluate(async () => {
        const st = await import('/script.js');
        const { PromptReasoning } = await import('/scripts/reasoning.js');
        const { power_user } = await import('/scripts/power-user.js');

        Object.assign(power_user, {
            streaming_fps: 30,
            stream_fade_in: false,
            message_token_count_enabled: false,
        });
        st.changeMainAPI('openai');

        const message = {
            name: 'Assistant',
            mes: '',
            is_user: false,
            is_system: false,
            extra: {},
            send_date: new Date().toISOString(),
            swipe_id: 0,
            swipes: [''],
            swipe_info: [{}],
        };
        st.chat.splice(0, st.chat.length, message);
        await st.redisplayChat({ fade: false });

        let isHidden = true;
        const hiddenDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden');
        Object.defineProperty(document, 'hidden', {
            configurable: true,
            get: () => isHidden,
        });

        let clock = Date.now();
        const origNow = Date.now;
        let tokenEvents = 0;
        const hiddenPreviews = [];
        const visiblePreviews = [];
        const onToken = () => { tokenEvents++; };
        st.eventSource.on(st.event_types.STREAM_TOKEN_RECEIVED, onToken);

        try {
            Date.now = () => clock;
            const p = new st.StreamingProcessor('normal', false, new Date(clock), '', new PromptReasoning());
            p.messageId = 0;
            const origProgress = p.onProgressStreaming.bind(p);
            p.onProgressStreaming = async (...args) => {
                (isHidden ? hiddenPreviews : visiblePreviews).push(args[1]);
                return origProgress(...args);
            };
            p.generator = async function* () {
                // 6 chunks at +50ms each while hidden (total 300ms -> only 1 preview at >=250ms)
                for (let i = 1; i <= 6; i++) {
                    clock += 50;
                    yield { text: `Hidden-${i}`, state: {}, toolCalls: [] };
                }
                // Switch back to foreground -> immediate 30 FPS recovery on next chunks (+50ms each)
                isHidden = false;
                clock += 260;
                yield { text: 'Visible-1', state: {}, toolCalls: [] };
                clock += 50;
                yield { text: 'Visible-2', state: {}, toolCalls: [] };
            };

            const out = await p.generate();
            await p.finalizeIntermediaryMessage(0, out, { unlockUI: true });

            // Also verify hidden error path still flushes pending unrendered chunk
            isHidden = true;
            const errMsg = { name: 'Assistant', mes: '', is_user: false, is_system: false, extra: {}, swipe_id: 0, swipes: [''], swipe_info: [{}] };
            st.chat.splice(0, st.chat.length, errMsg);
            await st.redisplayChat({ fade: false });
            const pErr = new st.StreamingProcessor('normal', false, new Date(clock), '', new PromptReasoning());
            pErr.messageId = 0;
            pErr.generator = async function* () {
                clock += 20; // Below 250ms hidden interval -> throttled during loop, must flush in catch!
                yield { text: 'Recovered hidden partial', state: {}, toolCalls: [] };
                throw new Error('Synthetic hidden disconnect');
            };
            await pErr.generate();

            return {
                tokenEvents,
                hiddenPreviews,
                visiblePreviews,
                recoveredHiddenPartial: errMsg.mes,
            };
        } finally {
            Date.now = origNow;
            st.eventSource.removeListener(st.event_types.STREAM_TOKEN_RECEIVED, onToken);
            if (hiddenDesc) {
                Object.defineProperty(document, 'hidden', hiddenDesc);
            } else {
                delete document.hidden;
            }
        }
    });

    expect(result.tokenEvents).toBe(9);
    expect(result.hiddenPreviews).toEqual(['Hidden-5']);
    expect(result.visiblePreviews).toEqual(['Visible-1', 'Visible-2', 'Visible-2']);
    expect(result.recoveredHiddenPartial).toBe('Recovered hidden partial');
});
