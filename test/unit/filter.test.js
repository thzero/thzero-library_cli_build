import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import BuildService from '../../service/build.js';
import Cli from '../../boot/cli.js';

import { logger, quiet } from '../helpers.js';

// The same shape as the default build: nested groups with the repos that
// matter for filtering.
const REPOS = [
	{ repo: 'library_cli' },
	{ name: 'library_id services...', repos: [{ repo: 'library_id_nanoid' }, { repo: 'library_id_shortuuid' }] },
	{ repo: 'library_common' },
	{ repo: 'library_common_service' },
	{
		name: 'library_client...',
		repos: [
			{ repo: 'library_client' },
			{ name: 'nested', repos: [{ repo: 'library_client_vue3' }, { repo: 'library_client_vue3_store_pinia' }] }
		]
	},
	{ name: 'server...', repos: [{ repo: 'library_server' }, { repo: 'library_server_logger_pino' }] }
];

function filter(patterns) {
	const service = new BuildService();
	service._logger = logger();
	const pruned = service._filterRepos(REPOS, patterns.map(l => service._filterPattern(l)));
	const names = [];
	const walk = (repos) => repos.forEach(r => r.repos ? walk(r.repos) : names.push(r.repo));
	walk(pruned);
	return { names: names, count: service._countRepos(pruned), tree: pruned };
}

describe('repo filter', () => {
	it('matches a prefix wildcard', () => {
		assert.deepEqual(filter(['library_id*']).names, ['library_id_nanoid', 'library_id_shortuuid']);
	});

	it('matches several patterns at once', () => {
		assert.deepEqual(filter(['library_id*', 'library_common*', 'library_server*']).names, [
			'library_id_nanoid', 'library_id_shortuuid',
			'library_common', 'library_common_service',
			'library_server', 'library_server_logger_pino'
		]);
	});

	it('matches the client repos', () => {
		assert.deepEqual(filter(['library_client*']).names,
			['library_client', 'library_client_vue3', 'library_client_vue3_store_pinia']);
	});

	it('anchors an exact name so it does not catch longer ones', () => {
		assert.deepEqual(filter(['library_common']).names, ['library_common']);
	});

	it('matches a wildcard in the middle', () => {
		assert.deepEqual(filter(['*vue3*']).names, ['library_client_vue3', 'library_client_vue3_store_pinia']);
	});

	it('is case insensitive', () => {
		assert.deepEqual(filter(['LIBRARY_COMMON*']).names, ['library_common', 'library_common_service']);
	});

	it('drops groups that have nothing left under them', () => {
		const { tree } = filter(['library_id*']);
		assert.equal(tree.length, 1);
		assert.equal(tree[0].name, 'library_id services...');
	});

	it('does not mutate the original repo tree', () => {
		filter(['library_id*']);
		assert.equal(REPOS.length, 6);
		assert.equal(REPOS[1].repos.length, 2);
	});

	it('returns nothing when no repo matches', () => {
		assert.equal(filter(['nope*']).count, 0);
	});

	it('treats regex characters in a pattern literally', () => {
		assert.equal(filter(['library.common']).count, 0, 'a dot should not match an underscore');
	});
});

describe('--filter argument', () => {
	async function run(argv) {
		process.argv = ['node', 'index.js', ...argv];
		const cli = new Cli();
		const { result, out } = await quiet(() => cli.run());
		return { ok: result, args: cli.args || {}, out: out.join(' | ') };
	}

	it('is absent unless given', async () => {
		assert.equal((await run(['--build', 'default'])).args.filter, undefined);
	});

	it('splits a comma separated list and trims each pattern', async () => {
		assert.deepEqual((await run(['--build', 'default', '--filter', 'library_id* , library_common*'])).args.filter,
			['library_id*', 'library_common*']);
	});

	it('accepts the --fi alias', async () => {
		assert.deepEqual((await run(['--build', 'default', '--fi', 'library_server*'])).args.filter, ['library_server*']);
	});

	it('accepts the flag repeated', async () => {
		assert.deepEqual((await run(['--build', 'default', '--filter', 'library_id*', '--filter', 'library_server*'])).args.filter,
			['library_id*', 'library_server*']);
	});

	it('rejects --filter with no value', async () => {
		const { ok, out } = await run(['--build', 'default', '--filter']);
		assert.equal(ok, false);
		assert.match(out, /filter requires one or more/);
	});

	it('rejects an empty filter', async () => {
		const { ok, out } = await run(['--build', 'default', '--filter', ' , ']);
		assert.equal(ok, false);
		assert.match(out, /filter must be one or more/);
	});
});
