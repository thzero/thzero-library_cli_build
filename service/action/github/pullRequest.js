import GitHubSourceActionBuildService from './index';

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

			let response = await this._octokit.request('GET /repos/{owner}/{repo}/actions/runs', {
				owner,
				repo,
				status: 'in_progress'
			});
			if (!response || (response.status !== 200))
				return this._error('GitHubPullRequestSourceActionBuildService', '_checkWorkflow', 'Error trying to get workflow.', null, null, null, correlationId);

			const results = response.data.workflow_runs && response.data.workflow_runs.length > 0;
			if (!results) {
				this._info(`No active workflow found.`, offset);
				return this._successResponse(status, correlationId);
			}

			const workflow = response.data.workflow_runs.pop();
			if (!workflow) {
				this._info(`No active workflow found.`, offset);
				return this._successResponse(status, correlationId);
			}

			let run_id = workflow.id;
			this._logger.debug('GitHubPullRequestSourceActionBuildService', '_checkWorkflow', 'workflow.id', run_id, correlationId);

			const interval = 1000 * 45;

			// const timeout = (prom, time) => Promise.race([prom, new Promise((_r, rej) => setTimeout(() => { rej({ success: false }); }, time))]);
			// await timeout(new Promise((resolve, reject) => {
			// 	const timer = setInterval((async function () {
			// 		try {
			// 			response = await this._octokit.request('GET /repos/{owner}/{repo}/actions/runs/{run_id}', {
			// 				owner,
			// 				repo,
			// 				run_id
			// 			});
			// 			if (!response || (response.status !== 200))
			// 				throw Error(`Error trying to check workflow '${run_id}'.`);

			// 			if (response.data.status === 'completed') {
			// 				clearInterval(timer);
			// 				resolve({ success: true });
			// 				return;
			// 			}
			// 		}
			// 		catch(err) {
			// 			reject(err);
			// 		}
			// 	}).bind(this), 1000 * 15);
			// }), interval);
			const promiseTimer = new Promise((resolve, reject) => {
				const timer = setInterval((async function () {
					try {
						response = await this._octokit.request('GET /repos/{owner}/{repo}/actions/runs/{run_id}', {
							owner,
							repo,
							run_id
						});
						if (!response || (response.status !== 200))
							throw Error(`Error trying to check workflow '${run_id}'.`);

						if (response.data.status === 'completed') {
							clearInterval(timer);
							resolve(this._successResponse(true, correlationId));
							return;
						}
					}
					catch(err) {
						reject(err);
					}
				}).bind(this), 1000 * 15);
			});

			response = await promiseTimer;
			return this._successResponse(status, correlationId);
		}
		catch (err) {
			return this._error('GitHubPullRequestSourceActionBuildService', '_checkWorkflow', null, err, null, null, correlationId);
		}
		finally {
			this._info(`...checking workflow completed.`, offset);
		}
	}

	async _pullRequest(correlationId, repoI, status, offset) {
		try {
			this._enforceNotNull('GitHubPullRequestSourceActionBuildService', '_pullRequest', status, 'status', correlationId);

			this._info(`creating github pull request...`, offset);

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

			this._info(`creating github pull request...`, offset);

			if (repoI.pullNumber) {
				this._info(`...creating github pull request '${repoI.pullNumber}' completed.`, offset);
				this._logger.debug('GitHubPullRequestSourceActionBuildService', '_pullRequest', 'pullNumber', pullNumber, correlationId);
				return this._successResponse(pullNumber, correlationId);
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
				throw Error(`Error trying to merge pull request '${pull_number}.`);

			repoI.pullNumber = response.data.number;

			// TODO
			// if (!response.data.mergeable) {
			// 	this._info(`Pull request '${pull_number}' not mergeable.`);
			// 	return this._successResponse(response.mergeable, correlationId);
			// }

			this._logger.debug('GitHubPullRequestSourceActionBuildService', '_pullRequest', 'pullNumber', repoI.pullNumber, correlationId);

			this._info(`...creating github pull request '${repoI.pullNumber}' completed.`, offset);

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
				throw Error(`Error trying to merge pull request '${pull_number}.`);

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
