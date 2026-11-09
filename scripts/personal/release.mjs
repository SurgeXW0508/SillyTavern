// Personal release metadata only. Never imported by the SillyTavern runtime.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const shaPattern = /^[a-f0-9]{40}$/;
export function validateConfig(config) {
    assert.equal(config.schema_version, 1);
    assert.match(config.version, /^\d+\.\d+\.\d+-personal\.\d+$/);
    assert.equal(config.tag, `v${config.version}`);
    assert.match(config.runtime_commit, shaPattern);
    assert.equal(config.official_upstream.repository, 'SillyTavern/SillyTavern');
    assert.match(config.official_upstream.commit, shaPattern);
    assert.match(config.image_repository, /^ghcr\.io\/surgexw0508\/[a-z0-9-]+$/);
    assert.equal(config.tools.repository, 'SurgeXW0508/ST-BaiBai-Tools');
    assert.equal(config.tools.branch, 'personal/stable');
    assert.match(config.tools.commit, shaPattern);
    assert.match(config.tools.runtime_tree_sha256, /^[a-f0-9]{64}$/);
    assert.equal(config.tools.excluded_document, 'AGENTS.md');
    assert.equal(config.tools.save_generate, 'not_assembled');
    assert.equal(config.baibaoku.repository, 'baibai-git/baibaoku');
    assert.match(config.baibaoku.commit, shaPattern);
    assert.equal(config.policies.save_generate, 'disabled');
    assert.equal(config.policies.server_plugin_auto_update, false);
    assert.equal(config.acceptance.candidate_runtime, config.runtime_commit);
    assert.equal(config.acceptance.formal_image_nas_smoke, 'pending');
    return config;
}

// Explicitly bounded to release infrastructure and documentation. Application,
// Dockerfile, package/lock files, config and vendor runtime are never exempted.
export function assertRuntimeUnchanged(files) {
    const permitted = /^(?:docs\/personal-fork\/|\.github\/workflows\/|scripts\/personal\/|tests\/personal\/|deploy\/personal\/|personal-release\.json$|AGENTS\.md$)/;
    const unexpected = files.filter(path => !permitted.test(path));
    assert.deepEqual(unexpected, [], 'Frozen Runtime changed; reopen review instead of silently publishing');
}

export function makeManifest(config, { commit, digest, created, runUrl }) {
    validateConfig(config);
    assert.match(commit, shaPattern);
    assert.match(digest, /^sha256:[a-f0-9]{64}$/);
    assert.ok(Number.isFinite(Date.parse(created)));
    assert.match(runUrl, /^https:\/\/github\.com\/SurgeXW0508\/SillyTavern\/actions\/runs\/\d+$/);
    return {
        schema_version: 1,
        core: { repository: 'SurgeXW0508/SillyTavern', release: config.tag, commit,
            runtime_commit: config.runtime_commit, image: `${config.image_repository}:${config.version}`,
            digest, image_ref: `${config.image_repository}@${digest}`, built_at: created, build_run: runUrl },
        official_upstream: config.official_upstream,
        tools: config.tools, baibaoku: config.baibaoku,
        compatibility: config.acceptance, policies: config.policies,
    };
}

function git(...args) { return execFileSync('git', args, { encoding: 'utf8' }).trim(); }
function main() {
    const config = validateConfig(JSON.parse(readFileSync('personal-release.json', 'utf8')));
    if (process.argv[2] === 'check') {
        for (const base of [config.runtime_commit, config.official_upstream.commit]) git('merge-base', '--is-ancestor', base, 'HEAD');
        const files = git('diff', '--name-only', config.runtime_commit, 'HEAD').split('\n').filter(Boolean);
        assertRuntimeUnchanged(files);
        // Include worktree/index changes for local checks; CI runs a clean checkout.
        assertRuntimeUnchanged(git('diff', '--name-only', config.runtime_commit).split('\n').filter(Boolean));
        console.log(`Verified ${config.tag}: frozen runtime ${config.runtime_commit}; ${files.length} release/document paths`);
        return;
    }
    if (process.argv[2] === 'manifest') {
        const manifest = makeManifest(config, { commit: process.env.CORE_COMMIT, digest: process.env.IMAGE_DIGEST,
            created: process.env.BUILD_DATE, runUrl: process.env.BUILD_RUN_URL });
        mkdirSync('release-output', { recursive: true });
        writeFileSync('release-output/validated-stack.json', JSON.stringify(manifest, null, 2) + '\n');
        writeFileSync('release-output/stack.env', `# Released artifact; no credentials. Use with the existing NAS Compose.\nST_IMAGE=${manifest.core.image_ref}\n`);
        writeFileSync('release-output/RELEASE_NOTES.md', `Personal SillyTavern ${config.tag}\n\nOfficial baseline: ${config.official_upstream.commit}\nRelease commit: ${manifest.core.commit}\nFrozen Runtime: ${config.runtime_commit}\nImage: ${manifest.core.image_ref}\nBuild: ${manifest.core.build_run}\n\nValidated plugin pins and user-reported Candidate coverage are in validated-stack.json.\nFormal GHCR image NAS smoke remains pending; do not delete rollback assets yet.\nNo latest tag, local patches, npm publication or automatic NAS deployment.\n`);
        return;
    }
    throw new Error('Usage: node scripts/personal/release.mjs check|manifest');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
