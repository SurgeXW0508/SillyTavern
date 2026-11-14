import { morphdom } from '../../lib.js';

/**
 * Creates a content writer scoped to one streaming or reasoning handler instance.
 * Formatting still runs on every update; only identical connected DOM writes are
 * skipped, and state is recorded only after a write succeeds.
 * Adapted from Shalistera/SillyTavern@01b87c88 (AGPL-3.0).
 * @returns {(element: HTMLElement, html: string, fade: boolean, force?: boolean) => boolean} Whether content was written
 */
export function createStreamingContentUpdater() {
    /** @type {HTMLElement|null} */
    let lastElement = null;
    /** @type {string|undefined} */
    let lastHtml;
    /** @type {boolean|undefined} */
    let lastFade;

    return (element, html, fade, force = false) => {
        const normalizedFade = Boolean(fade);
        if (!force
            && element === lastElement
            && element?.isConnected === true
            && html === lastHtml
            && normalizedFade === lastFade) {
            return false;
        }
        if (normalizedFade) {
            applyStreamFadeIn(element, html);
        } else {
            element.innerHTML = html;
        }
        lastElement = element;
        lastHtml = html;
        lastFade = normalizedFade;
        return true;
    };
}

/**
 * Check if the current browser supports native segmentation function.
 * @returns {boolean} True if the Segmenter is supported by the current browser.
 */
export function isSegmenterSupported() {
    return typeof Intl.Segmenter === 'function';
}

/**
 * Segment text in the given HTML content using Intl.Segmenter.
 * @param {HTMLElement} htmlElement Target HTML element
 * @param {string} htmlContent HTML content to segment
 * @param {'word'|'grapheme'|'sentence'} [granularity='word'] Text split granularity
 */
export function segmentTextInElement(htmlElement, htmlContent, granularity = 'word') {
    htmlElement.innerHTML = htmlContent;

    if (!isSegmenterSupported()) {
        return;
    }

    // TODO: Support more locales, make granularity configurable.
    const segmenter = new Intl.Segmenter('en-US', { granularity });
    const textNodes = [];
    const walker = document.createTreeWalker(htmlElement, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
        const textNode = /** @type {Text} */ (walker.currentNode);

        // Skip ancestors of code/pre
        if (textNode.parentElement && textNode.parentElement.closest('pre, code')) {
            continue;
        }

        // Skip text nodes that are empty or only whitespace
        if (/^\s*$/.test(textNode.data)) {
            continue;
        }

        textNodes.push(textNode);
    }

    // Split every text node into segments using spans
    for (const textNode of textNodes) {
        const fragment = document.createDocumentFragment();
        const segments = segmenter.segment(textNode.data);
        for (const segment of segments) {
            // TODO: Apply a different class for different segment length/content?
            // For now, just use a single class for all segments.
            const span = document.createElement('span');
            span.innerText = segment.segment;
            span.className = 'text_segment';
            fragment.appendChild(span);
        }
        textNode.replaceWith(fragment);
    }
}

/**
 * Apply stream fade-in effect to the given message text element by morphing its content.
 * @param {HTMLElement} messageTextElement Message text element
 * @param {string} htmlContent New HTML content to apply
 */
export function applyStreamFadeIn(messageTextElement, htmlContent) {
    const targetElement = /** @type {HTMLElement} */ (messageTextElement.cloneNode());
    segmentTextInElement(targetElement, htmlContent);
    morphdom(messageTextElement, targetElement);
}
