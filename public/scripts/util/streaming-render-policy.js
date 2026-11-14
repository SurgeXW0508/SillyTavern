// Adapted from Shalistera/SillyTavern@b35c996c (AGPL-3.0)

export const HIDDEN_STREAMING_MIN_INTERVAL_MS = 250;

/**
 * Limit expensive preview renders in hidden tabs without altering foreground
 * invalid-FPS fallback behavior, network chunk consumption, per-token events,
 * error flushes, or the final message render.
 * @param {object} options Render policy inputs
 * @param {number} options.baseInterval Foreground interval already validated by Stopwatch
 * @param {boolean} options.hidden Whether the document is currently hidden
 * @param {number} [options.currentInterval=1] Fallback interval if baseInterval is non-finite
 * @returns {number} Preview interval in milliseconds
 */
export function getStreamingRenderInterval({ baseInterval, hidden, currentInterval = 1 }) {
    const foregroundInterval = Number.isFinite(baseInterval) && baseInterval > 0
        ? baseInterval
        : (Number.isFinite(currentInterval) && currentInterval > 0 ? currentInterval : 1);
    return hidden ? Math.max(foregroundInterval, HIDDEN_STREAMING_MIN_INTERVAL_MS) : foregroundInterval;
}
