import GitHubSourceActionBuildService from './index.js';

class GitHubPullRequestSourceActionBuildService extends GitHubSourceActionBuildService {
	constructor() {
		super();
	}

	async _process(correlationId, buildLog, repo, offset) {
		let status = {
			commited: false,
			merged: false,
			pullNumber: null,
			completed: false
		}

		if (this._isDryRun(buildLog)) {
			this._infoDryRun(`would create and merge a github pull request from 'dev' to 'master' for '${repo.repo}' titled '${repo.label}'.`, offset);
			return this._successResponse(status, correlationId);
		}

		let response = await this._pullRequest(correlationId, repo, status, offset);
		if (!response.success)
			return response;

		status = response.results;
		if (!status.commited || !status.merged)
			return this._successResponse(status, correlationId);

		if (!repo.wait) {
			status.completed = true;
			return this._successResponse(status, correlationId);
		}

		response = await this._checkWorkflow(correlationId, repo, status, offset);
		if (!response.success)
			return response;

		status.completed = true;
		return this._successResponse(status, correlationId);
	}

	async _checkWorkflow(correlationId, repoI, status, offset) {
		try {
			this._enforceNotNull('GitHubPullRequestSourceActionBuildService', '_checkWorkflow', status, 'status', correlationId);

			this._info(`check workflow for completion...`, offset);

			const owner = this._config.get('owner');
			const repo = repoI.repo;

			// A run is queued asynchronously after the merge, so asking for one
			// straight away can find nothing and skip the wait entirely. Give it a
			// window to appear before deciding there is nothing to wait for.
			const run_id = await this._findWorkflowRun(correlationId, owner, repo, offset);
			if (!run_id) {
				this._info(`No workflow started within ${this._workflowDiscoverTimeout / 1000} seconds; not waiting.`, offset);
				return this._successResponse(status, correlationId);
			}

			this._logger.debug('GitHubPullRequestSourceActionBuildService', '_checkWorkflow', 'run_id', run_id, correlationId);

			const pollExpires = Date.now() + this._workflowPollTimeout;
			while (true) {
				const response = await this._octokit.request('GET /repos/{owner}/{repo}/actions/runs/{run_id}', {
					owner,
					repo,
					run_id
				});
				if (!response || (response.status !== 200))
					throw Error(`Error trying to check workflow '${run_id}'.`);

				if (response.data.status === 'completed') {
					this._info(`Workflow '${run_id}' completed with '${response.data.conclusion}'.`, offset);
					break;
				}

				if (Date.now() >= pollExpires)
					throw Error(`Timed out after ${this._workflowPollTimeout / 1000} seconds waiting for workflow '${run_id}' to complete.`);

				await new Promise(resolve => setTimeout(resolve, this._workflowPollInterval));
			}

			return this._successResponse(status, correlationId);
		}
		catch (err) {
			return this._error('GitHubPullRequestSourceActionBuildService', '_checkWorkflow', null, err, null, null, correlationId);
		}
		finally {
			this._info(`...checking workflow completed.`, offset);
		}
	}

	get _workflowPollInterval() {
		return 1000 * 15;
	}

	get _workflowDiscoverTimeout() {
		return 1000 * 60;
	}

	get _workflowPollTimeout() {
		return 1000 * 60 * 10;
	}

	async _findWorkflowRun(correlationId, owner, repo, offset) {
		const active = ['queued', 'in_progress', 'requested', 'waiting', 'pending'];
		const expires = Date.now() + this._workflowDiscoverTimeout;

		while (true) {
			const response = await this._octokit.request('GET /repos/{owner}/{repo}/actions/runs', {
				owner,
				repo,
				per_page: 10
			});
			if (!response || (response.status !== 200))
				throw Error(`Error trying to list workflows for '${repo}'.`);

			const runs = response.data.workflow_runs ? response.data.workflow_runs : [];
			const run = runs.find(l => active.includes(l.status));
			if (run)
				return run.id;

			if (Date.now() >= expires)
				return null;

			this._info(`Waiting for a workflow to start...`, offset);
			await new Promise(resolve => setTimeout(resolve, this._workflowPollInterval));
		}
	}

	async _pullRequest(correlationId, repoI, status, offset) {
		try {
			this._enforceNotNull('GitHubPullRequestSourceActionBuildService', '_pullRequest', status, 'status', correlationId);

			this._info(`creating github pull request...#`, offset);

			const responseCreate = await this._pullRequestCreate(correlationId, repoI, status, offset + 1);
			if (!responseCreate.success)
				return responseCreate;

			if (!responseCreate.results.commited)
				return this._successResponse(responseCreate.results, correlationId);

			const responseMerge = await this._pullRequestMerge(correlationId, repoI, status, offset + 1);
			if (!responseMerge.success)
				return responseMerge;

			return this._successResponse(true, correlationId);
		}
		catch (err) {
			return this._error('GitHubPullRequestSourceActionBuildService', '_pullRequest', null, err, null, null, correlationId);
		}
		finally {
			this._info(`...creating github pull request completed.`, offset);
		}
	}

	async _pullRequestCreate(correlationId, repoI, status, offset) {
		try {
			this._enforceNotNull('GitHubPullRequestSourceActionBuildService', '_pullRequestCreate', status, 'status', correlationId);

			this._info(`creating github pull request...#`, offset);

			if (repoI.pullNumber) {
				this._info(`...creating github pull request #'${repoI.pullNumber}' completed.`, offset);
				this._logger.debug('GitHubPullRequestSourceActionBuildService', '_pullRequest', 'pullNumber', repoI.pullNumber, correlationId);
				return this._successResponse(repoI.pullNumber, correlationId);
			}

			const config = {
				owner: this._config.get('owner'),
				repo: repoI.repo,
				title: repoI.label,
				body: repoI.label,
				head: 'dev',
				base: 'master'
			};

			let response = await this._octokit.request(`POST /repos/{owner}/{repo}/pulls`, config);
			if (!response || (response.status !== 201))
				throw Error(`Error trying to create a pull request for '${repoI.repo}'.`);

			repoI.pullNumber = response.data.number;

			// TODO
			// if (!response.data.mergeable) {
			// 	this._info(`Pull request '${pull_number}' not mergeable.`);
			// 	return this._successResponse(response.mergeable, correlationId);
			// }

			this._logger.debug('GitHubPullRequestSourceActionBuildService', '_pullRequest', 'pullNumber', repoI.pullNumber, correlationId);

			this._info(`...creating github pull request #'${repoI.pullNumber}' completed.`, offset);

			status.pullNumber = repoI.pullNumber;
			status.commited = true;
			return this._successResponse(status, correlationId);
		}
		catch (err) {
			if (err.status === 422) {
				this._info(`...creating github pull request failed - No commits.`, offset);
				return this._successResponse(status, correlationId);
			}

			this._info(`...creating github pull request failed.`, offset);
			return this._error('GitHubPullRequestSourceActionBuildService', '_pullRequest', null, err, null, null, correlationId);
		}
	}

	async _pullRequestMerge(correlationId, repoI, status, offset) {
		try {
			this._enforceNotEmpty('GitHubPullRequestSourceActionBuildService', '_pullRequestMerge', repoI.pullNumber, 'repoI.pullNumber', correlationId);
			this._enforceNotNull('GitHubPullRequestSourceActionBuildService', '_pullRequestMerge', status, 'status', correlationId);

			this._info(`merge github pull request '${repoI.pullNumber}...`, offset);

			const config = {
				owner: this._config.get('owner'),
				repo: repoI.repo,
				pull_number: repoI.pullNumber
			};

			const response = await this._octokit.request(`PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge`, config);
			if (!response || (response.status !== 200)) 
				throw Error(`Error trying to merge pull request '${repoI.pullNumber}'.`);

			status.merged = true;
			this._info(`...merge github pull request '${repoI.pullNumber}' completed.`, offset);
			return this._successResponse(status, correlationId);
		}
		catch (err) {
			this._info(`...merge github pull request '${repoI.pullNumber}' failed.`, offset);
			return this._error('GitHubPullRequestSourceActionBuildService', '_pullRequestMerge', null, err, null, null, correlationId);
		}
	}

	get _prefix() {
		return 'github';
	}

	get _step() {
		return 'pullrequest';
	}
}

export default GitHubPullRequestSourceActionBuildService;
