#!/usr/bin/env python3
"""Read-only Docker/Git verification. No pull, checkout, restart, update or cleanup."""
import argparse
import hashlib
import json
import subprocess
from pathlib import PurePosixPath
from urllib.parse import urlsplit


def command(*args):
    result = subprocess.run(args, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode:
        # Git remote URLs and container environments must never enter error output.
        raise RuntimeError('Read-only Docker/Git query failed; check the selected container, paths and Git history locally')
    return result.stdout.strip()


def runtime_tree(entries):
    lines = [line for line in entries.splitlines() if line.split('\t', 1)[1] != 'AGENTS.md']
    return hashlib.sha256(('\n'.join(lines) + '\n').encode()).hexdigest()


def normalized_repository(origin):
    if origin.startswith('git@github.com:'):
        return origin[len('git@github.com:'):].removesuffix('.git')
    parsed = urlsplit(origin)
    return parsed.path.strip('/').removesuffix('.git') if parsed.hostname == 'github.com' else None


def check_core(container, image, core, phase):
    labels = container.get('Config', {}).get('Labels') or {}
    running = container.get('State', {}).get('Running') is True
    problems = []
    if not running:
        problems.append('container_not_running')
    health = container.get('State', {}).get('Health', {}).get('Status')
    if health and health != 'healthy':
        problems.append('container_not_healthy')
    if phase == 'release':
        if labels.get('org.opencontainers.image.revision') != core['commit']:
            problems.append('release_commit_mismatch')
        if core['digest'] not in [value.rsplit('@', 1)[-1] for value in image.get('RepoDigests', [])]:
            problems.append('image_digest_mismatch')
    elif core['runtime_commit'] not in [labels.get('io.sillytavern.personal.runtime-revision'), labels.get('org.opencontainers.image.revision')]:
        problems.append('candidate_runtime_label_unverified')
    app = container.get('Config', {}).get('WorkingDir')
    if app:
        targets = [PurePosixPath(app) / name for name in ['src', 'public/script.js', 'public/scripts/openai.js', 'server.js', 'package.json']]
        for mount in container.get('Mounts', []):
            destination = PurePosixPath(mount['Destination'])
            if any(target == destination or destination in target.parents for target in targets):
                problems.append('mount_shadows_core')
    return {'image_id': container.get('Image'), 'health': health or 'not_configured',
            'restart_count': container.get('RestartCount'), 'running': running,
            'release_commit': labels.get('org.opencontainers.image.revision'), 'problems': problems}


def check_tools(expected, query):
    actual = query('rev-parse', 'HEAD')
    branch = query('branch', '--show-current')
    tracking = query('rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}')
    origin = normalized_repository(query('remote', 'get-url', 'origin'))
    clean = query('status', '--porcelain') == ''
    tree_matches = runtime_tree(query('ls-tree', '-r', 'HEAD')) == expected['runtime_tree_sha256']
    ok = clean and tree_matches and branch == expected['branch'] and tracking == f"origin/{expected['branch']}" and origin == expected['repository']
    return {'commit': actual, 'validated_commit': expected['commit'], 'branch': branch, 'tracking': tracking,
            'runtime_tree_matches': tree_matches, 'metadata_only_revision': tree_matches and actual != expected['commit'], 'clean': clean, 'ok': ok}


def inspect(manifest, settings, phase, run=command):
    name = settings['container']
    container = json.loads(run('docker', 'inspect', name))[0]
    image = json.loads(run('docker', 'image', 'inspect', container['Image']))[0]
    core = check_core(container, image, manifest['core'], phase)
    query = lambda directory: lambda *args: run('docker', 'exec', name, 'git', '--no-optional-locks', '-C', directory, *args)
    tools = check_tools(manifest['tools'], query(settings['tools_directory']))
    bbk_query = query(settings['baibaoku_directory'])
    bbk = {'commit': bbk_query('rev-parse', 'HEAD'), 'clean': bbk_query('status', '--porcelain') == ''}
    bbk['ok'] = bbk['clean'] and bbk['commit'] == manifest['baibaoku']['commit']
    if core['running'] and core['health'] == 'not_configured':
        try:
            run('docker', 'exec', name, 'node', 'src/healthcheck.js')
            core['health'] = 'probe_passed_no_docker_healthcheck'
        except RuntimeError:
            core['problems'].append('health_probe_failed')
    return {'phase': phase, 'container': name, 'core': core, 'tools': tools, 'baibaoku': bbk,
            'ok': not core['problems'] and tools['ok'] and bbk['ok'],
            'manual_checks': ['Save Generate off', 'Generate Retry off', 'server/self updates disabled', 'one Tools installation', 'model smoke']}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--stack', required=True, help='Downloaded validated-stack.json')
    parser.add_argument('--config', required=True, help='Locally confirmed paths JSON; no credentials')
    parser.add_argument('--phase', choices=['candidate', 'release'], default='release')
    args = parser.parse_args()
    with open(args.stack, encoding='utf8') as stream:
        manifest = json.load(stream)
    with open(args.config, encoding='utf8') as stream:
        settings = json.load(stream)
    try:
        result = inspect(manifest, settings, args.phase)
    except (RuntimeError, KeyError, ValueError) as error:
        print(json.dumps({'ok': False, 'error': str(error)}, ensure_ascii=False))
        return 1
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result['ok'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
