import simpleGit from 'simple-git';

import ActionBuildService from '../index.js';

class GitCommitSourceActionBuildService extends ActionBuildService {
	constructor() {
        super();
    }

	async _process(correlationId, buildLog, repo, offset) {
		const git = simpleGit({
			baseDir: repo.path
		});

		const results = [];

		let result = await git.init();
		results.push(result);
		result = await git.add('.');
		results.push(result);
		result = await git.commit(repo.label);
		results.push(result);
		result = await git.push();
		results.push(result);

		return this._successResponse(results, correlationId);
	}

	get _prefix() {
		return 'git';
	}

	get _step() {
		return 'commit';
	}
}

export default GitCommitSourceActionBuildService;
