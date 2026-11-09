import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateConfig, assertRuntimeUnchanged, makeManifest } from '../../scripts/personal/release.mjs';
const config = JSON.parse(readFileSync(new URL('../../personal-release.json', import.meta.url)));
const args = { commit: 'a'.repeat(40), digest: `sha256:${'b'.repeat(64)}`, created: '2026-11-09T09:00:00Z', runUrl: 'https://github.com/SurgeXW0508/SillyTavern/actions/runs/123' };
test('release manifest retains exact pins, source, immutable image, and pending production evidence', () => {
    const m = makeManifest(config, args);
    assert.equal(m.tools.commit, config.tools.commit);
    assert.equal(m.baibaoku.commit, config.baibaoku.commit);
    assert.equal(m.core.runtime_commit, config.runtime_commit);
    assert.equal(m.core.image_ref, `${config.image_repository}@${args.digest}`);
    assert.equal(m.compatibility.candidate_image_id, null);
    assert.equal(m.compatibility.formal_image_nas_smoke, 'pending');
});
for (const path of ['public/script.js', 'src/endpoints/chats.js', 'Dockerfile', 'package.json', 'default/config.yaml', 'package-lock.json']) {
    test(`release infrastructure cannot excuse a runtime change to ${path}`, () => assert.throws(() => assertRuntimeUnchanged([path])));
}
test('documentation and release infrastructure do not reopen Runtime', () => {
    assert.doesNotThrow(() => assertRuntimeUnchanged(['AGENTS.md', 'personal-release.json', 'deploy/personal/verify-stack.py', '.github/workflows/personal-release.yml']));
});
for (const [key, value] of [['version', 'latest'], ['tag', 'release'], ['image_repository', 'ghcr.io/another-owner/image'], ['runtime_commit', 'main']]) {
    test(`invalid release identity ${key} is refused`, () => assert.throws(() => validateConfig({ ...config, [key]: value })));
}
test('missing image provenance cannot be published as validated metadata', () => {
    assert.throws(() => makeManifest(config, { ...args, digest: 'latest' }));
    assert.throws(() => makeManifest(config, { ...args, created: 'unknown' }));
    assert.throws(() => makeManifest(config, { ...args, runUrl: 'https://example.invalid' }));
});
