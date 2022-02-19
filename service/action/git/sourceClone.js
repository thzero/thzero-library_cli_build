import simpleGit from 'simple-git';

import ActionBuildService from '../index';

class GitCloneSourceActionBuildService extends ActionBuildService {
	constructor() {
        super();
    }

	async _process(correlationId, buildLog, repo, offset) {
		const git = simpleGit({
			baseDir: repo.pathCwd
		});

		let repository = repo.repo_url;
		if (String.isNullOrEmpty(repository))
			return this._error('GitCloneSourceActionBuildService', '_process', `Empty repository url in package.json for '${repo.repo}', unable to perform a pull.`, null, null, null, correlationId);
	
		const branch = !String.isNullOrEmpty(repo.branch) ? repo.branch : (!String.isNullOrEmpty(buildLog.args.branch) ? buildLog.args.branch : 'dev');
		const options = ['--branch', branch];
		const statusResults = await git.clone(repository, repo.pathPublish, options);
		if (statusResults)
			this._info(`Cloned.`, offset);

		return this._successResponse(statusResults, correlationId);
	}

	get _prefix() {
		return 'git';
	}

	get _step() {
		return 'clone';
	}
}

export default GitCloneSourceActionBuildService;
