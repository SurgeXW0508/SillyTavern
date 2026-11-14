import { describe, test, expect, jest } from '@jest/globals';
import showdown from 'showdown';
import { addShowdownPatch } from '../public/scripts/util/showdown-patch.js';

/**
 * Verbatim upstream unhashHTMLSpans implementation used as differential oracle.
 * @param {string} text
 * @param {string[]} gHtmlSpans
 * @returns {string}
 */
function legacyUnhashHTMLSpans(text, gHtmlSpans) {
    for (let i = 0; i < gHtmlSpans.length; ++i) {
        let repText = gHtmlSpans[i];
        let limit = 0;

        while (/¨C(\d+)C/.test(repText)) {
            const num = RegExp.$1;
            repText = repText.replace('¨C' + num + 'C', gHtmlSpans[num]);
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

function createPatchedParser() {
    let capturedParser = null;
    const fakeShowdown = {
        subParser(name, fn) {
            if (name === 'unhashHTMLSpans') {
                capturedParser = fn;
            }
        },
    };
    addShowdownPatch(/** @type {any} */ (fakeShowdown));
    return (text, spans) => capturedParser(text, {}, {
        gHtmlSpans: spans,
        converter: {
            _dispatch: (_evt, value) => value,
        },
    });
}

describe('addShowdownPatch differential & adversarial parity', () => {
    const runPatched = createPatchedParser();

    test('matches legacy expansion for flat, nested, backward-nested, duplicate, and leading-zero tokens', () => {
        const cases = [
            {
                text: 'Hello ¨C0C world ¨C1C and duplicate ¨C0C plus ¨C01C and ¨C99C',
                spans: ['<q>"quoted"</q>', '<span class="thought"><em>inner</em></span>'],
            },
            {
                text: 'Nested forward ¨C0C and direct ¨C1C',
                spans: ['<div class="box">¨C1C</div>', '<span>¨C2C</span>', '<b>leaf</b>'],
            },
            {
                text: 'Nested backward ¨C1C then ¨C0C',
                spans: ['<i>first</i>', '<span>¨C0C</span>'],
            },
            {
                text: 'Adjacent ¨C¨C0CC boundaries',
                spans: ['<span>safe</span>'],
            },
            {
                text: 'Empty table passthrough ¨C0C',
                spans: [],
            },
        ];

        for (const { text, spans } of cases) {
            expect(runPatched(text, spans)).toBe(legacyUnhashHTMLSpans(text, spans));
        }
    });

    test('falls back cleanly for special String.replace patterns, non-tag spans, and non-index extension keys', () => {
        const nonIndexSpans = ['<span>¨C01C</span>'];
        nonIndexSpans['01'] = '<b>$$100 $\' $`</b>';

        const cases = [
            {
                text: 'Prefix ¨C0C suffix',
                spans: ['<span>price is $$100 and $& and $` and $\'</span>'],
            },
            {
                text: 'Plain text span ¨C0C',
                spans: ['not-an-html-tag'],
            },
            {
                text: 'Non-index nested ¨C0C',
                spans: nonIndexSpans,
            },
        ];

        for (const { text, spans } of cases) {
            expect(runPatched(text, spans)).toBe(legacyUnhashHTMLSpans(text, spans));
        }
    });

    test('preserves indexed span semantics when an extension overrides Array Symbol.iterator', () => {
        const spans = ['<span>zero</span>', '<em>one</em>'];
        spans[Symbol.iterator] = function* () {
            yield '<b/>';
        };
        const text = 'A ¨C0C B ¨C1C';
        expect(runPatched(text, spans)).toBe(legacyUnhashHTMLSpans(text, spans));
        expect(runPatched(text, spans)).toBe('A <span>zero</span> B <em>one</em>');
    });

    test('falls back identically when cyclic spans exceed the 10000 recursion guard', () => {
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        try {
            const cyclic = ['<span>¨C0C</span>'];
            const patchedOut = runPatched('Start ¨C0C end', cyclic);
            const legacyOut = legacyUnhashHTMLSpans('Start ¨C0C end', cyclic);
            expect(patchedOut).toBe(legacyOut);
            expect(errorSpy).toHaveBeenCalledWith('maximum nesting of 10000 spans reached!!!');
        } finally {
            errorSpy.mockRestore();
        }
    });

    test('renders identical HTML through a real Showdown Converter on tag-heavy long replies', () => {
        addShowdownPatch(showdown);
        const converter = new showdown.Converter({
            tables: true,
            strikethrough: true,
            literalMidWordUnderscores: true,
        });
        const lines = Array.from({ length: 400 }, (_, i) =>
            `Paragraph ${i}: <q class="quote">"Hello **world** ${i}"</q> and <span data-idx="${i}">*italic ${i}*</span> with \`code_${i}\`.`,
        ).join('\n\n');

        const html = converter.makeHtml(lines);
        expect(html).toContain('<q class="quote">');
        expect(html).toContain('data-idx="399"');
        expect(html).not.toMatch(/¨C\d+C/);
    });
});
