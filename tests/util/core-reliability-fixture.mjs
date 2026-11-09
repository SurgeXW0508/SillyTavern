import fs from 'node:fs/promises';
import { testSetup } from '../frontend/frontent-test-utils.js';

// Exercise the real application in an isolated ST dataRoot. Only provider I/O
// and optional saves are substituted; no production extensions or credentials.
export async function setupCoreReliability(page, { stubChatSave = true, mockTokenizer = true } = {}) {
    const source = await fs.readFile(new URL('../../public/script.js', import.meta.url), 'utf8');
    await page.route('**/script.js', route => route.fulfill({ contentType: 'application/javascript', body: source + '\nexport { StreamingProcessor };' }));
    await page.route('**/api/extensions/discover', async route => {
        const response = await route.fetch();
        await route.fulfill({ response, json: (await response.json()).filter(item => item.type === 'system') });
    });
    await page.route('**/api/settings/get', async route => {
        const response = await route.fetch();
        const data = await response.json();
        const settings = JSON.parse(data.settings);
        settings.firstRun = false;
        data.settings = JSON.stringify(settings);
        await route.fulfill({ response, json: data });
    });
    await page.route('**/api/settings/save', route => route.fulfill({ json: { result: 'ok' } }));
    if (stubChatSave) await page.route('**/api/chats/save', route => route.fulfill({ json: { result: 'ok' } }));
    if (mockTokenizer) await page.route('**/api/tokenizers/**', route => route.fulfill({ json: { count: 8, token_count: 8, ids: [1, 2, 3] } }));
    await page.route('**/api/backends/chat-completions/status', route => route.fulfill({ json: { data: [] } }));
    await testSetup.awaitST({ page });
}
