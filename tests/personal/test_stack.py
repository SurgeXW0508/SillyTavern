import copy
import importlib.util
from pathlib import Path
import unittest
spec = importlib.util.spec_from_file_location('verify_stack', Path(__file__).parents[2] / 'deploy/personal/verify-stack.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class StackChecks(unittest.TestCase):
    def setUp(self):
        self.core = {'commit': 'release-sha', 'runtime_commit': 'runtime-sha', 'digest': 'sha256:digest'}
        self.container = {'Config': {'WorkingDir': '/app', 'Labels': {'org.opencontainers.image.revision': 'release-sha'}},
                          'State': {'Running': True, 'Health': {'Status': 'healthy'}}, 'Image': 'image-id', 'RestartCount': 0}
        self.image = {'RepoDigests': ['ghcr.io/owner/image@sha256:digest']}

    def test_digest_and_label_both_required_for_release(self):
        self.assertFalse(module.check_core(self.container, self.image, self.core, 'release')['problems'])
        self.image['RepoDigests'] = []
        self.assertIn('image_digest_mismatch', module.check_core(self.container, self.image, self.core, 'release')['problems'])
        self.container['Config']['Labels'] = {}
        self.assertIn('release_commit_mismatch', module.check_core(self.container, self.image, self.core, 'release')['problems'])

    def test_image_label_does_not_hide_a_core_bind_mount(self):
        for destination in ['/app', '/app/src', '/app/public/script.js']:
            modified = copy.deepcopy(self.container)
            modified['Mounts'] = [{'Destination': destination}]
            self.assertIn('mount_shadows_core', module.check_core(modified, self.image, self.core, 'release')['problems'])
        self.container['Mounts'] = [{'Destination': '/app/data'}, {'Destination': '/app/public/scripts/extensions/third-party'}]
        self.assertFalse(module.check_core(self.container, self.image, self.core, 'release')['problems'])

    def test_missing_tracking_never_becomes_default_branch(self):
        entries = '100644 blob ' + 'a' * 40 + '\tdist/index.js\n'
        expected = {'repository': 'SurgeXW0508/ST-BaiBai-Tools', 'branch': 'personal/stable', 'commit': 'validated', 'runtime_tree_sha256': module.runtime_tree(entries)}
        values = {('rev-parse', 'HEAD'): 'validated', ('branch', '--show-current'): 'personal/stable',
                  ('rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'): '',
                  ('remote', 'get-url', 'origin'): 'https://github.com/SurgeXW0508/ST-BaiBai-Tools.git',
                  ('status', '--porcelain'): '', ('ls-tree', '-r', 'HEAD'): entries}
        self.assertFalse(module.check_tools(expected, lambda *args: values[args])['ok'])
        values[('rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}')] = 'origin/personal/stable'
        self.assertTrue(module.check_tools(expected, lambda *args: values[args])['ok'])
        values[('rev-parse', 'HEAD')] = 'docs-only-successor'
        values[('ls-tree', '-r', 'HEAD')] += '100644 blob ' + 'b' * 40 + '\tAGENTS.md\n'
        self.assertTrue(module.check_tools(expected, lambda *args: values[args])['metadata_only_revision'])
        values[('ls-tree', '-r', 'HEAD')] = entries.replace('a' * 40, 'c' * 40)
        self.assertFalse(module.check_tools(expected, lambda *args: values[args])['ok'])

    def test_remote_credentials_are_not_returned(self):
        self.assertEqual(module.normalized_repository('https://user:DUMMY@github.com/owner/repo.git?token=DUMMY'), 'owner/repo')
        self.assertIsNone(module.normalized_repository('https://example.invalid/owner/repo.git'))
