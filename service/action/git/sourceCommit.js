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

		if (this._isDryRun(buildLog)) {
			const status = await git.status();
			this._infoDryRun(`would commit ${status.files.length} file(s) with the label '${repo.label}' and push to the remote.`, offset);
			for (const file of status.files)
				this._infoDryRun(`${file.index}${file.working_dir} ${file.path}`, offset + 1);
			return this._successResponse([], correlationId);
		}

		const results = [];

		let result = await git.add('.');
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
