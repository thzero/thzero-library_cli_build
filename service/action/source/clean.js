import fs from 'fs';
import path from 'path';

import ActionBuildService from '../index.js';

class SourceCleanActionBuildService extends ActionBuildService {
	constructor() {
		super();
	}

	async _process(correlationId, buildLog, repo, offset) {
		const sourceRepoPath = repo.path;
		if (fs.existsSync(sourceRepoPath)) {
			this._info(`Cleaning source '${sourceRepoPath}'...`, offset);
			fs.rmSync(sourceRepoPath, { recursive: true, force: true });
			this._info(`Clean source complete.`, offset);
		}
		else
			this._info(`Source path '${sourceRepoPath}' does not exist, skipping.`, offset);

		const publishRepoPath = path.join(buildLog.pathCwd, 'publish', repo.repo);
		if (fs.existsSync(publishRepoPath)) {
			this._info(`Cleaning publish '${publishRepoPath}'...`, offset);
			fs.rmSync(publishRepoPath, { recursive: true, force: true });
			this._info(`Clean publish complete.`, offset);
		}
		else
			this._info(`Publish path '${publishRepoPath}' does not exist, skipping.`, offset);

		return this._success(correlationId);
	}

	get _prefix() {
		return '';
	}

	get _step() {
		return 'clean';
	}
}

export default SourceCleanActionBuildService;
