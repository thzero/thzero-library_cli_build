import fs from 'fs';
import path from 'path';

import ActionBuildService from '../index.js';

class SourceCopyActionBuildService extends ActionBuildService {
	constructor() {
		super();
	}

	async _process(correlationId, buildLog, repo, offset) {
		const sourcePath = buildLog.args ? buildLog.args.source : null;
		if (!sourcePath)
			return this._error('SourceCopyActionBuildService', '_process', `No source path provided, use --source or --src.`, null, null, null, correlationId);

		const sourceRepoPath = path.join(sourcePath, repo.repo);
		if (!fs.existsSync(sourceRepoPath))
			return this._error('SourceCopyActionBuildService', '_process', `Source path '${sourceRepoPath}' does not exist.`, null, null, null, correlationId);

		this._info(`Copying from '${sourceRepoPath}' to '${repo.path}'...`, offset);

		const excluded = ['.git', 'node_modules'];
		fs.cpSync(sourceRepoPath, repo.path, {
			recursive: true,
			filter: (src) => !excluded.some(e => src.split(path.sep).includes(e))
		});

		this._info(`Copy complete.`, offset);

		return this._success(correlationId);
	}

	get _prefix() {
		return '';
	}

	get _step() {
		return 'copy';
	}
}

export default SourceCopyActionBuildService;
