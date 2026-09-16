// Integration tests: these reach the npm registry and spawn npm.
// Run with `npm run test:integration`; `npm test` stays offline.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import spawn from 'cross-spawn';

import NpmActionBuildService from '../../service/action/npm/index.js';

import { logger, tempDir, writePackage } from '../helpers.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function npm(args) {
	return new Promise((resolve) => {
		const child = spawn('npm', args, { env: { PATH: process.env.PATH } });
		let stdout = '';
		let stderr = '';
		child.stdout.on('data', (chunk) => stdout += chunk);
		child.stderr.on('data', (chunk) => stderr += chunk);
		child.on('close', (code) => resolve({ code: code, stdout: stdout.trim(), stderr: stderr.trim() }));
	});
}

describe('npm registry version check', () => {
	function service() {
		const instance = new NpmActionBuildService();
		instance._logger = logger();
		return instance;
	}

	// The scope separator was a backslash, so the url never resolved and the
	// check always reported the version as publishable.
	it('detects a version that is already published', async () => {
		const dir = tempDir('registry-existing');
		writePackage(dir, '0.19.1');
		const response = await service()._checkVersion('correlation',
			{ repo: 'library_common', scope: '@thzero' }, dir, 0);
		assert.equal(response.success, false);
	});

	it('allows a version that is not published', async () => {
		const dir = tempDir('registry-new');
		writePackage(dir, '99.99.99');
		const response = await service()._checkVersion('correlation',
			{ repo: 'library_common', scope: '@thzero' }, dir, 0);
		assert.equal(response.success, true);
	});

	it('allows anything for a package that is not in the registry', async () => {
		const dir = tempDir('registry-missing');
		writePackage(dir, '1.0.0');
		const response = await service()._checkVersion('correlation',
			{ repo: 'not_a_real_package_xyzzy', scope: '@thzero' }, dir, 0);
		assert.equal(response.success, true);
	});
});

describe('npm publish arguments', () => {
	// '--access public' was passed as a single argv element, which npm ignores
	// with "Unknown cli config". Scoped packages then default to restricted.
	const argv = (() => {
		const source = fs.readFileSync(path.join(root, 'service', 'action', 'npm', 'publishPackage.js'), 'utf8');
		const match = source.match(/const child = spawn\('npm', \[([\s\S]*?)\]/);
		return eval('[' + match[1] + ']');
	})();

	it('passes the publish flags as separate arguments', () => {
		assert.deepEqual(argv, ['publish', '.', '--access', 'public']);
	});

	it('is understood by npm', async () => {
		const result = await npm(['config', 'get', 'access', ...argv.slice(2)]);
		assert.equal(result.stdout, 'public');
		assert.doesNotMatch(result.stderr, /Unknown cli config/);
	});
});
