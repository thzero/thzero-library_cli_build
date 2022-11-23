import simpleGit from 'simple-git';

import ActionBuildService from '../index.js';

class GitStatusSourceActionBuildService extends ActionBuildService {
	constructor() {
        super();
    }

	async _process(correlationId, buildLog, repo, offset) {
		const git = simpleGit({
			baseDir: repo.path
		});

		const statusResults = await git.status();
		const results = statusResults && statusResults.files ? statusResults.files.length > 0 : false;

		if (results) {
			this._info(`Status changes detected; must commit.`, offset);
			repo.dirty = true;
		}
		else
			this._info(`No status changes detected; nothing to commit.`, offset);

		return this._successResponse(results, correlationId);
	}

	get _prefix() {
		return 'git';
	}

	get _step() {
		return 'status';
	}
}

export default GitStatusSourceActionBuildService;
