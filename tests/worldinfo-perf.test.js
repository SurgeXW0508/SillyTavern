import { afterEach, beforeEach, describe, test, expect } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readWorldInfoFile, readWorldInfoFileAsync, router } from '../src/endpoints/worldinfo.js';

function getRouteHandler(method, routePath) {
    const layer = router.stack.find(
        item => item.route?.path === routePath && item.route?.methods?.[method.toLowerCase()],
    );
    return layer?.route?.stack?.[0]?.handle;
}

describe('worldinfo endpoint async read & parity', () => {
    let tmpDir;
    let directories;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'st-worldinfo-'));
        directories = { worlds: tmpDir };
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    test('readWorldInfoFileAsync matches readWorldInfoFile for valid, missing, and empty names', async () => {
        const sample = { entries: { 0: { uid: 0, key: ['alpha'], content: 'hello' } } };
        fs.writeFileSync(path.join(tmpDir, 'Alpha.json'), JSON.stringify(sample), 'utf8');

        expect(await readWorldInfoFileAsync(directories, 'Alpha', true)).toEqual(
            readWorldInfoFile(directories, 'Alpha', true),
        );
        expect(await readWorldInfoFileAsync(directories, 'MissingBook', true)).toEqual({ entries: {} });
        expect(await readWorldInfoFileAsync(directories, 'MissingBook', false)).toBeNull();
        expect(await readWorldInfoFileAsync(directories, '', true)).toEqual({ entries: {} });
    });

    test('POST /get returns 400 without name, dummy object when missing, parsed payload when valid, and 500 on corrupt JSON', async () => {
        const handler = getRouteHandler('post', '/get');
        expect(typeof handler).toBe('function');

        const invoke = async (body) => {
            let statusCode = 200;
            let payload;
            const res = {
                status(code) {
                    statusCode = code;
                    return this;
                },
                sendStatus(code) {
                    statusCode = code;
                    return this;
                },
                send(data) {
                    payload = data;
                    return this;
                },
            };
            await handler({ body, user: { directories } }, res);
            return { statusCode, payload };
        };

        expect((await invoke({})).statusCode).toBe(400);
        expect(await invoke({ name: 'DoesNotExist' })).toEqual({
            statusCode: 200,
            payload: { entries: {} },
        });

        const book = { entries: { 1: { uid: 1, key: ['dragon'], content: 'fire' } } };
        fs.writeFileSync(path.join(tmpDir, 'LoreOne.json'), JSON.stringify(book), 'utf8');
        expect(await invoke({ name: 'LoreOne' })).toEqual({
            statusCode: 200,
            payload: book,
        });

        fs.writeFileSync(path.join(tmpDir, 'Corrupt.json'), '{not-valid-json', 'utf8');
        expect((await invoke({ name: 'Corrupt' })).statusCode).toBe(500);
    });
});
