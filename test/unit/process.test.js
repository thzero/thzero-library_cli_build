import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import BuildService from '../../service/build.js';
import StandardProcessBuildService from '../../service/process/standard.js';

import { logger, BuildLogStub, Response } from '../helpers.js';

function standard(actions) {
	const service = new StandardProcessBuildService();
	service._logger = logger();
	service._buildType = { actions: actions };
	return service;
}

const succeeds = { process: async () => Response.success('c') };
const forbidden = (what) => ({ process: async () => { throw Error(what + ' must not run'); } });

describe('standard build process', () => {
	it('records build log steps for the status action', async () => {
		const service = standard(['status']);
		service._serviceSourceLocalStatus = succeeds;

		const buildLog = new BuildLogStub();
		assert.ok(Response.hasSucceeded(await service._process('correlation', buildLog, { repo: 'library_common', label: 'x' }, 1)));
		assert.deepEqual(buildLog.recorded, ['step:status', 'ok:status']);
	});

	// stepFailure was called with 'version' after the step was started as
	// 'versionAlways', so BuildLog threw "Invalid step" over the real cause.
	it('records a versionAlways failure under its own step name', async () => {
		const service = standard(['versionAlways']);
		service._serviceVersion = { process: async () => Response.error('Version', '_process', 'boom', null, null, null, 'c') };

		const buildLog = new BuildLogStub();
		const response = await service._process('correlation', buildLog, { repo: 'library_common', label: 'x' }, 1);

		assert.ok(Response.hasFailed(response));
		assert.deepEqual(buildLog.recorded, ['step:versionAlways', 'fail:versionAlways']);
	});

	it('surfaces the real version failure rather than throwing', async () => {
		const service = standard(['versionAlways']);
		service._serviceVersion = { process: async () => Response.error('Version', '_process', 'boom', null, null, null, 'c') };
		await assert.doesNotReject(() => service._process('correlation', new BuildLogStub(), { repo: 'library_common', label: 'x' }, 1));
	});

	it('returns an error response when a dirty repo has no label', async () => {
		const service = standard(['versionAlways', 'commit']);
		service._serviceVersion = { process: async (correlationId, buildLog, repo) => { repo.dirty = true; return Response.success('c'); } };
		service._serviceSourceLocalCommit = forbidden('commit');

		const response = await service._process('correlation', new BuildLogStub(), { repo: 'library_common' }, 1);

		assert.ok(Response.hasFailed(response));
		assert.match(response.message, /No label provided/);
	});

	it('skips the commit when the repo is clean', async () => {
		const service = standard(['status', 'commit']);
		service._serviceSourceLocalStatus = succeeds;
		service._serviceSourceLocalCommit = forbidden('commit');
		assert.ok(Response.hasSucceeded(await service._process('correlation', new BuildLogStub(), { repo: 'library_common', label: 'x' }, 1)));
	});

	it('only runs the actions named by the build type', async () => {
		const service = standard(['clean']);
		service._serviceSourceLocalClean = succeeds;
		service._serviceSourceLocalClone = forbidden('clone');
		service._serviceVersion = forbidden('version');

		const buildLog = new BuildLogStub();
		assert.ok(Response.hasSucceeded(await service._process('correlation', buildLog, { repo: 'library_common', label: 'x' }, 1)));
		assert.deepEqual(buildLog.recorded, ['step:clean', 'ok:clean']);
	});

	describe('mergeOnly', () => {
		it('opens the pull request for a repo that is not dirty', async () => {
			let seen = null;
			const service = standard(['mergeOnly']);
			service._serviceSourceRemote = { process: async (correlationId, buildLog, repo) => { seen = repo.repo; return Response.success('c'); } };
			service._serviceSourceLocalClone = forbidden('clone');
			service._serviceVersion = forbidden('version');
			service._serviceSourceLocalCommit = forbidden('commit');
			service._servicePublish = forbidden('publish');

			const buildLog = new BuildLogStub();
			const response = await service._process('correlation', buildLog, { repo: 'library_common', label: 'workflow updates' }, 1);

			assert.ok(Response.hasSucceeded(response));
			assert.equal(seen, 'library_common');
			assert.deepEqual(buildLog.recorded, ['step:merge', 'ok:merge']);
		});

		it('requires a label for the pull request title', async () => {
			const service = standard(['mergeOnly']);
			service._serviceSourceRemote = forbidden('merge');
			const response = await service._process('correlation', new BuildLogStub(), { repo: 'library_common' }, 1);
			assert.ok(Response.hasFailed(response));
		});

		it('still gates a plain merge on the repo being dirty', async () => {
			const service = standard(['merge']);
			service._serviceSourceRemote = forbidden('merge');
			assert.ok(Response.hasSucceeded(await service._process('correlation', new BuildLogStub(), { repo: 'library_common', label: 'x' }, 1)));
		});
	});
});

describe('build service repo walking', () => {
	function service() {
		const instance = new BuildService();
		instance._logger = logger();
		return instance;
	}

	const noopBuildLog = { add: () => {}, failure: () => {}, success: () => {} };

	// This used to return the still-undefined `response`.
	it('returns an error response for a repo with no repo key', async () => {
		const response = await service()._processRepos('correlation', {}, succeeds, noopBuildLog,
			[{ name: 'a group with no repo key' }], 0);

		assert.notEqual(response, undefined);
		assert.ok(Response.hasFailed(response));
		assert.match(response.message, /invalid repo name/);
	});

	it('walks nested repo groups in order', async () => {
		const processed = [];
		const instance = service();
		instance._processExecuteRepo = async (correlationId, args, buildService, buildLog, repo) => {
			processed.push(repo.repo);
			return Response.success('c');
		};

		const repos = [
			{ repo: 'library_cli' },
			{ name: 'group', repos: [{ repo: 'library_id_nanoid' }, { repo: 'library_id_shortuuid' }] },
			{ repo: 'library_common' }
		];
		assert.ok(Response.hasSucceeded(await instance._processRepos('correlation', {}, succeeds, noopBuildLog, repos, 0)));
		assert.deepEqual(processed, ['library_cli', 'library_id_nanoid', 'library_id_shortuuid', 'library_common']);
	});

	it('stops at the first repo that fails', async () => {
		const processed = [];
		const instance = service();
		instance._processExecuteRepo = async (correlationId, args, buildService, buildLog, repo) => {
			processed.push(repo.repo);
			return repo.repo === 'second'
				? Response.error('x', 'y', 'boom', null, null, null, 'c')
				: Response.success('c');
		};

		const response = await instance._processRepos('correlation', {}, succeeds, noopBuildLog,
			[{ repo: 'first' }, { repo: 'second' }, { repo: 'third' }], 0);

		assert.ok(Response.hasFailed(response));
		assert.deepEqual(processed, ['first', 'second']);
	});

	describe('parallel batching', () => {
		const repos = [
			{ repo: 'a', wait: true },
			{ repo: 'b', wait: false },
			{ repo: 'c', wait: false },
			{ repo: 'd', wait: false },
			{ name: 'group', repos: [{ repo: 'e', wait: false }] },
			{ repo: 'f', wait: false }
		];

		const shape = (limit) => service()._batchRepos(repos, limit)
			.map(b => b.repos.map(r => r.repo || ('<' + r.name + '>')).join('+'))
			.join(' -> ');

		it('is sequential by default', () => {
			assert.equal(shape(1), 'a -> b -> c -> d -> <group> -> f');
		});

		it('batches consecutive wait:false siblings', () => {
			assert.equal(shape(4), 'a -> b+c+d -> <group> -> f');
		});

		it('respects the batch limit', () => {
			assert.equal(shape(2), 'a -> b+c -> d -> <group> -> f');
		});

		it('never batches a group or a wait:true repo', () => {
			const batches = service()._batchRepos(repos, 4);
			assert.ok(batches.every(b => b.repos.length === 1 || b.repos.every(r => r.wait === false && !r.repos)));
		});

		it('runs a batch concurrently', async () => {
			const instance = service();
			let active = 0;
			let peak = 0;
			instance._processExecuteRepo = async () => {
				active++;
				peak = Math.max(peak, active);
				await new Promise(r => setTimeout(r, 10));
				active--;
				return Response.success('c');
			};

			await instance._processRepos('correlation', { parallel: 4 }, succeeds, noopBuildLog,
				[{ repo: 'b', wait: false }, { repo: 'c', wait: false }, { repo: 'd', wait: false }], 0);

			assert.equal(peak, 3);
		});

		it('stays sequential without the flag', async () => {
			const instance = service();
			let active = 0;
			let peak = 0;
			instance._processExecuteRepo = async () => {
				active++;
				peak = Math.max(peak, active);
				await new Promise(r => setTimeout(r, 10));
				active--;
				return Response.success('c');
			};

			await instance._processRepos('correlation', {}, succeeds, noopBuildLog,
				[{ repo: 'b', wait: false }, { repo: 'c', wait: false }], 0);

			assert.equal(peak, 1);
		});
	});
});
