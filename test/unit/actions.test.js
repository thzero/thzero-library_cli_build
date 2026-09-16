import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import fs from 'fs';
import path from 'path';

import GitCloneSourceActionBuildService from '../../service/action/git/sourceClone.js';
import GitCommitSourceActionBuildService from '../../service/action/git/sourceCommit.js';
import GitPublishCloneSourceActionBuildService from '../../service/action/git/sourcePublishClone.js';
import GitHubPullRequestSourceActionBuildService from '../../service/action/github/pullRequest.js';
import LicenseActionBuildService from '../../service/action/license.js';
import PublishActionBuildService from '../../service/action/publish.js';

import { logger, tempDir, gitRepo, gitBranch, gitCommitCount, writePackage, BuildLogStub, Response } from '../helpers.js';

const forbidden = (what) => ({ process: async () => { throw Error(what + ' must not run'); } });

describe('source clone', () => {
	// The clone target used to be repo.pathPublish, which is not set yet at
	// clone time. simple-git drops an undefined directory, so git fell back to
	// the url basename - correct only while every repo key matches its url.
	it('clones into repo.path even when the repo key differs from the url basename', async () => {
		const root = tempDir('clone');
		const upstream = gitRepo(root + '/upstream_project', 'dev');
		const sourceDir = root + '/source';
		fs.mkdirSync(sourceDir);

		const service = new GitCloneSourceActionBuildService();
		service._logger = logger();

		const repo = { repo: 'renamed_local', repo_url: upstream, pathCwd: sourceDir, path: sourceDir + '/renamed_local' };
		const response = await service._process('correlation', { args: { branch: 'dev' } }, repo, 0);

		assert.ok(Response.hasSucceeded(response));
		assert.ok(fs.existsSync(repo.path + '/marker.txt'), 'the clone should land in repo.path');
		assert.ok(!fs.existsSync(sourceDir + '/upstream_project'), 'no fallback to the url basename');
		assert.equal(gitBranch(repo.path), 'dev');
	});

	it('fails when the repo url is missing', async () => {
		const service = new GitCloneSourceActionBuildService();
		service._logger = logger();
		const response = await service._process('correlation', { args: {} },
			{ repo: 'x', pathCwd: tempDir('clone-nourl'), path: 'unused' }, 0);
		assert.ok(Response.hasFailed(response));
	});
});

describe('source commit', () => {
	it('does not re-init an existing clone', () => {
		const source = fs.readFileSync(new URL('../../service/action/git/sourceCommit.js', import.meta.url), 'utf8');
		assert.ok(!source.includes('git.init()'));
	});

	it('commits nothing during a dry run and reports what it would have committed', async () => {
		const dir = gitRepo(tempDir('commit'));
		fs.writeFileSync(path.join(dir, 'marker.txt'), 'changed');
		fs.writeFileSync(path.join(dir, 'added.txt'), 'new');

		const service = new GitCommitSourceActionBuildService();
		const log = logger();
		service._logger = log;

		const before = gitCommitCount(dir);
		const response = await service._process('correlation', { args: { dryRun: true } },
			{ repo: 'fixture', path: dir, label: 'major version update' }, 0);

		assert.ok(Response.hasSucceeded(response));
		assert.equal(gitCommitCount(dir), before);
		assert.ok(log.has("would commit 2 file(s) with the label 'major version update'"));
		assert.equal(fs.readFileSync(path.join(dir, 'marker.txt'), 'utf8'), 'changed');
	});
});

describe('publish', () => {
	it('resolves pathPublish once, to <cwd>/publish/<repo>', async () => {
		const dir = tempDir('publish-path');
		const pathPackage = writePackage(dir, '1.0.0');

		const seen = [];
		const capture = { process: async (correlationId, buildLog, repo) => { seen.push(repo.pathPublish); return Response.success('c'); } };

		const service = new PublishActionBuildService();
		service._logger = logger();
		service._servicePublishCloneSource = capture;
		service._serviceDependencyFetchPublish = capture;
		service._servicePackagePublish = capture;

		const buildLog = new BuildLogStub({});
		buildLog.pathCwd = dir;
		buildLog.buildType = { actions: ['publish'] };

		const repo = { repo: 'library_common', scope: '@thzero', dirty: true, pathPackage: pathPackage };
		await service._process('correlation', buildLog, repo, 0);

		const expected = path.join(dir, 'publish', 'library_common');
		assert.equal(repo.pathPublish, expected);
		assert.ok(seen.every(l => l === expected), 'every sub-action sees the same path');
		assert.ok(fs.existsSync(path.join(dir, 'publish')));
	});

	// npm never ships node_modules in the tarball, so the install only matters
	// for a repo with a prepare or prepack script.
	it('skips the dependency install unless the build type asks for it', async () => {
		const dir = tempDir('publish-install');
		const pathPackage = writePackage(dir, '1.0.0');

		const service = new PublishActionBuildService();
		service._logger = logger();
		service._servicePublishCloneSource = { process: async () => Response.success('c') };
		service._serviceDependencyFetchPublish = forbidden('npm install');
		service._servicePackagePublish = { process: async () => Response.success('c') };

		const buildLog = new BuildLogStub({});
		buildLog.pathCwd = dir;
		buildLog.buildType = { actions: ['publish'] };

		const response = await service._process('correlation', buildLog,
			{ repo: 'library_common', dirty: true, pathPackage: pathPackage }, 0);

		assert.ok(Response.hasSucceeded(response));
	});

	it('runs the dependency install when the build type names it', async () => {
		const dir = tempDir('publish-install-on');
		const pathPackage = writePackage(dir, '1.0.0');

		let ran = false;
		const service = new PublishActionBuildService();
		service._logger = logger();
		service._servicePublishCloneSource = { process: async () => Response.success('c') };
		service._serviceDependencyFetchPublish = { process: async () => { ran = true; return Response.success('c'); } };
		service._servicePackagePublish = { process: async () => Response.success('c') };

		const buildLog = new BuildLogStub({});
		buildLog.pathCwd = dir;
		buildLog.buildType = { actions: ['publish', 'publishDependencyFetch'] };

		await service._process('correlation', buildLog,
			{ repo: 'library_common', dirty: true, pathPackage: pathPackage }, 0);

		assert.equal(ran, true);
	});

	it('publishes nothing during a dry run and names the package', async () => {
		const dir = tempDir('publish-dry');
		const pathPackage = writePackage(dir, '1.0.0');

		const service = new PublishActionBuildService();
		const log = logger();
		service._logger = log;
		service._servicePublishCloneSource = forbidden('the publish clone');
		service._serviceDependencyFetchPublish = forbidden('npm install');
		service._servicePackagePublish = forbidden('npm publish');

		const buildLog = new BuildLogStub({ dryRun: true });
		buildLog.pathCwd = dir;
		buildLog.buildType = { actions: ['publish'] };

		const response = await service._process('correlation', buildLog,
			{ repo: 'library_common', scope: '@thzero', dirty: true, pathPackage: pathPackage }, 0);

		assert.ok(Response.hasSucceeded(response));
		assert.ok(log.has("would publish '@thzero/library_common@1.0.0' to npm"));
	});

	it('skips a repo that is not dirty', async () => {
		const service = new PublishActionBuildService();
		service._logger = logger();
		service._servicePublishCloneSource = forbidden('the publish clone');
		service._serviceDependencyFetchPublish = forbidden('npm install');
		service._servicePackagePublish = forbidden('npm publish');

		const buildLog = new BuildLogStub({});
		buildLog.pathCwd = tempDir('publish-clean');
		buildLog.buildType = { actions: ['publish'] };

		assert.ok(Response.hasSucceeded(await service._process('correlation', buildLog,
			{ repo: 'library_common', dirty: false }, 0)));
	});

	it('clone does not append the repo name a second time', async () => {
		const root = tempDir('publish-clone');
		const upstream = gitRepo(root + '/upstream', 'master');
		const target = root + '/publish/library_common';
		fs.mkdirSync(root + '/publish', { recursive: true });

		const service = new GitPublishCloneSourceActionBuildService();
		service._logger = logger();

		const repo = { repo: 'library_common', repo_url: upstream, pathPublish: target };
		const response = await service._process('correlation', { args: {} }, repo, 0);

		assert.ok(Response.hasSucceeded(response));
		assert.equal(repo.pathPublish, target);
		assert.ok(fs.existsSync(target + '/marker.txt'));
		assert.ok(!fs.existsSync(target + '/library_common'), 'no doubled <repo>/<repo> directory');
	});
});

describe('license', () => {
	async function update(label, year) {
		const dir = tempDir('license');
		fs.writeFileSync(path.join(dir, 'license.md'), 'Copyright (c) 2020-2024 thZero');

		const service = new LicenseActionBuildService();
		service._logger = logger();

		const repo = { repo: 'fixture', path: dir, label: label };
		const response = await service._process('correlation', { args: { year: year } }, repo, 0);
		return { response: response, repo: repo, text: fs.readFileSync(path.join(dir, 'license.md'), 'utf8') };
	}

	it('updates the copyright year range and marks the repo dirty', async () => {
		const { text, repo } = await update(undefined, 2026);
		assert.equal(text, 'Copyright (c) 2020-2026 thZero');
		assert.equal(repo.dirty, true);
	});

	it('supplies a label when none was given', async () => {
		assert.equal((await update(undefined, 2026)).repo.label, 'copyright update');
	});

	it('keeps an explicit --label', async () => {
		assert.equal((await update('my release label', 2026)).repo.label, 'my release label');
	});

	it('succeeds when there is no license file', async () => {
		const service = new LicenseActionBuildService();
		service._logger = logger();
		assert.ok(Response.hasSucceeded(await service._process('correlation', { args: {} },
			{ repo: 'fixture', path: tempDir('license-none') }, 0)));
	});
});

describe('pull request', () => {
	function service(request) {
		const instance = new GitHubPullRequestSourceActionBuildService();
		instance._logger = logger();
		instance._config = { get: () => 'thzero' };
		instance._octokit = { request: request };
		return instance;
	}

	// These branches used to reference bare `pullNumber` / `pull_number`.
	it('returns the existing pull number without calling github again', async () => {
		const instance = service(() => { throw Error('octokit must not be called'); });
		const response = await instance._pullRequestCreate('correlation',
			{ repo: 'library_common', pullNumber: 7, label: 'x' }, { commited: false }, 0);

		assert.ok(Response.hasSucceeded(response));
		assert.equal(response.results, 7);
	});

	it('reports the repo when creation fails', async () => {
		const instance = service(async () => ({ status: 500 }));
		const response = await instance._pullRequestCreate('correlation',
			{ repo: 'library_common', label: 'x' }, { commited: false }, 0);

		assert.ok(Response.hasFailed(response));
		assert.match(response.err.message, /create a pull request for 'library_common'/);
	});

	it('reports the pull number when the merge fails', async () => {
		const instance = service(async () => ({ status: 500 }));
		const response = await instance._pullRequestMerge('correlation',
			{ repo: 'library_common', pullNumber: 42, label: 'x' }, { merged: false }, 0);

		assert.ok(Response.hasFailed(response));
		assert.match(response.err.message, /merge pull request '42'/);
	});

	it('makes no github calls during a dry run', async () => {
		const instance = service(() => { throw Error('octokit must not be called during a dry run'); });
		const log = logger();
		instance._logger = log;

		const response = await instance._process('correlation', { args: { dryRun: true } },
			{ repo: 'library_common', label: 'workflow updates' }, 0);

		assert.ok(Response.hasSucceeded(response));
		assert.ok(log.has('would create and merge a github pull request'));
	});
});

describe('workflow polling', () => {
	function withFakeClock(fn) {
		let clock = 1000000;
		const realSetTimeout = globalThis.setTimeout;
		const realNow = Date.now;
		globalThis.setTimeout = (callback, ms) => { clock += ms; return realSetTimeout(callback, 0); };
		Date.now = () => clock;
		const restore = () => { globalThis.setTimeout = realSetTimeout; Date.now = realNow; };
		return fn(() => clock).finally(restore);
	}

	function service(listRuns, runStatus) {
		let calls = 0;
		const instance = new GitHubPullRequestSourceActionBuildService();
		instance._logger = logger();
		instance._config = { get: () => 'thzero' };
		instance._octokit = {
			request: async (route) => {
				calls++;
				if (route.includes('runs/{run_id}'))
					return { status: 200, data: { status: runStatus(calls), conclusion: 'success' } };
				return { status: 200, data: { workflow_runs: listRuns(calls) } };
			}
		};
		instance.calls = () => calls;
		return instance;
	}

	// The run is queued asynchronously, so the old code often looked before it
	// existed, found nothing, and skipped the wait entirely.
	it('finds a run that starts after the merge', async () => {
		const instance = service(n => n >= 3 ? [{ id: 7, status: 'queued' }] : [], () => 'completed');
		await withFakeClock(async () => {
			assert.ok(Response.hasSucceeded(await instance._checkWorkflow('correlation', { repo: 'x' }, {}, 0)));
		});
	});

	it('gives up when no run ever starts', async () => {
		const instance = service(() => [], () => 'completed');
		await withFakeClock(async () => {
			assert.ok(Response.hasSucceeded(await instance._checkWorkflow('correlation', { repo: 'x' }, {}, 0)));
		});
	});

	it('does not sleep before the first status check', async () => {
		const instance = service(() => [{ id: 7, status: 'in_progress' }], () => 'completed');
		await withFakeClock(async (clock) => {
			const start = clock();
			await instance._checkWorkflow('correlation', { repo: 'x' }, {}, 0);
			assert.equal(clock() - start, 0, 'a finished workflow should cost no wait');
		});
	});

	it('gives up on a workflow that never completes', async () => {
		const instance = service(() => [{ id: 7, status: 'in_progress' }], () => 'in_progress');
		await withFakeClock(async (clock) => {
			const start = clock();
			const response = await instance._checkWorkflow('correlation', { repo: 'x' }, {}, 0);
			assert.ok(Response.hasFailed(response));
			assert.ok(instance.calls() < 100, `bounded poll count, got ${instance.calls()}`);
			assert.ok(clock() - start <= (1000 * 60 * 10) + (1000 * 15));
		});
	});
});
