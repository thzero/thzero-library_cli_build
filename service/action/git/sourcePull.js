import simpleGit from 'simple-git';

import ActionBuildService from '../index';

class GitPullSourceActionBuildService extends ActionBuildService {
	constructor() {
        super();
    }

	async _process(correlationId, buildLog, repo, offset) {
		const git = simpleGit({
			baseDir: repo.path
		});

		const statusResults = await git.pull();
		if (statusResults)
			this._info(`Pulled updates.`, offset);

		return this._successResponse(statusResults, correlationId);
	}

	get _prefix() {
		return 'git';
	}

	get _step() {
		return 'pull';
	}
}

export default GitPullSourceActionBuildService;
