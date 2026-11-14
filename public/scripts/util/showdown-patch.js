// Adapted from Shalistera/SillyTavern@80898271 and @bebe62bd (AGPL-3.0)

/**
 * Original ordered expansion for unusual or extension-provided HTML spans.
 * Kept verbatim as the safety fallback whenever fast-path invariants do not hold.
 * @param {string} text Intermediate markdown text
 * @param {string[]} spans Hashed HTML span table
 * @returns {string} Text with hashed spans restored
 */
function replaceSpansSequentially(text, spans) {
    for (var i = 0; i < spans.length; ++i) {
        var repText = spans[i],
            // limiter to prevent infinite loop (assume 10 as limit for recurse)
            limit = 0;

        while (/¨C(\d+)C/.test(repText)) {
            var num = RegExp.$1;
            repText = repText.replace('¨C' + num + 'C', spans[num]);
            if (limit === 10000) {
                console.error('maximum nesting of 10000 spans reached!!!');
                break;
            }
            ++limit;
        }
        text = text.replace('¨C' + i + 'C', repText);
    }
    return text;
}

/**
 * Patches showdown to unrestrictedly unhash HTML spans.
 * @param {import('showdown')} showdown The showdown object to patch
 */
export function addShowdownPatch(showdown) {
    showdown.subParser('unhashHTMLSpans', function (text, options, globals) {
        'use strict';
        text = globals.converter._dispatch('unhashHTMLSpans.before', text, options, globals);

        const spans = globals.gHtmlSpans;
        const replacements = [];
        // Native hashed spans are complete HTML elements. Other values and
        // special String.replace substitutions require the original ordered path.
        // HTML tag boundaries also prevent replacements from forming new tokens with neighbors.
        let canReplaceTogether = Array.isArray(spans);
        if (canReplaceTogether) {
            for (let index = 0; index < spans.length; index++) {
                const span = spans[index];
                if (typeof span !== 'string' || !span.startsWith('<') || !span.endsWith('>') || /\$[$&`']/.test(span)) {
                    canReplaceTogether = false;
                    break;
                }
            }
        }
        if (canReplaceTogether) {
            for (let index = 0; index < spans.length; index++) {
                let replacement = spans[index];
                let limit = 0;
                while (/¨C(\d+)C/.test(replacement)) {
                    const nestedIndex = RegExp.$1;
                    if (!/^(?:0|[1-9]\d*)$/.test(nestedIndex) || Number(nestedIndex) >= spans.length) {
                        canReplaceTogether = false;
                        break;
                    }
                    replacement = replacement.replace('¨C' + nestedIndex + 'C', spans[nestedIndex]);
                    if (++limit > 10000) {
                        canReplaceTogether = false;
                        break;
                    }
                }
                if (!canReplaceTogether) {
                    break;
                }
                // Extensions can attach non-index keys (for example "01") to the span table;
                // validate the resolved value as well before enabling single-pass replacement.
                if (typeof replacement !== 'string'
                    || !replacement.startsWith('<')
                    || !replacement.endsWith('>')
                    || /¨C\d+C|\$[$&`']/.test(replacement)) {
                    canReplaceTogether = false;
                    break;
                }
                replacements.push(replacement);
            }
        }

        if (canReplaceTogether) {
            // Replace only the first occurrence of each canonical numeric index, matching String.replace.
            const replaced = new Set();
            text = text.replace(/¨C(0|[1-9]\d*)C/g, (token, digits) => {
                const index = Number(digits);
                if (index >= replacements.length || replaced.has(index)) {
                    return token;
                }
                replaced.add(index);
                return replacements[index];
            });
        } else {
            text = replaceSpansSequentially(text, spans);
        }

        text = globals.converter._dispatch('unhashHTMLSpans.after', text, options, globals);
        return text;
    });
}
