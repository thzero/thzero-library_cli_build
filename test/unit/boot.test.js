import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import BootMain from '../../boot/index.js';
import BuildPlugin from '../../boot/plugins/build.js';

import { quiet, Response } from '../helpers.js';

async function start(argv) {
	process.argv = ['node', 'index.js', ...argv];
	const { result } = await quiet(() => new BootMain().start(BuildPlugin));
	return result;
}

// start() used to return a bare `false` for these, which index.js then read
// `.success` off of - so --help and --version exited 1.
describe('boot', () => {
	it('returns a response for --help', async () => {
		const response = await start(['--help']);
		assert.ok(response instanceof Response);
		assert.ok(Response.hasSucceeded(response));
	});

	it('returns a response for --version', async () => {
		assert.ok(Response.hasSucceeded(await start(['--version'])));
	});

	it('fails when --build is missing', async () => {
		const response = await start([]);
		assert.ok(response instanceof Response);
		assert.ok(Response.hasFailed(response));
	});

	it('fails on conflicting version flags', async () => {
		assert.ok(Response.hasFailed(await start(['--build', 'default', '--mi', '--mai'])));
	});

	it('fails on a non-numeric version argument', async () => {
		assert.ok(Response.hasFailed(await start(['--build', 'default', '--major', 'abc'])));
	});
});
