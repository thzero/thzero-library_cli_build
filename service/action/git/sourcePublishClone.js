import fs from 'fs';
import path from 'path';

import simpleGit from 'simple-git';

import ActionBuildService from '../index';

class GitPublishCloneSourceActionBuildService extends ActionBuildService {
	constructor() {
        super();
    }

	async _process(correlationId, buildLog, repo, offset) {
		repo.pathPublish = path.join(repo.pathPublish, repo.repo);
		if (!fs.existsSync(repo.pathPublish))
			fs.mkdirSync(repo.pathPublish);

		const git = simpleGit({
			baseDir: repo.pathPublish
		});

		let repository = repo.repo_url;
		if (String.isNullOrEmpty(repository))
			return this._error('GitPublishCloneSourceActionBuildService', '_process', `Empty repository url in package.json for '${repo.repo}', unable to perform a pull.`, null, null, null, correlationId);
	
		const statusResults = await git.clone(repository, repo.pathPublish);
		if (statusResults)
			this._info(`Cloned.`, offset);

		return this._successResponse(statusResults, correlationId);
	}

	get _prefix() {
		return 'git';
	}

	get _step() {
		return 'clone-publish';
	}
}

export default GitPublishCloneSourceActionBuildService;
