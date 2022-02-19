import { updateVersion } from '@thzero/library_cli/api';

import ActionBuildService from './index';

class VersionActionBuildService extends ActionBuildService {
	constructor() {
		super();
	}

	async _process(correlationId, buildLog, repo, offset) {
		const results = await updateVersion({
			packagePath: repo.pathPackage,
			pi: true
		});
		this._logger.info2('\t\t' + (results.message || results.error) ? results.message ? results.message : '' : results.error ? results.error : 'failed');

		if (results.success)
			repo.dirty = true;

		return this._successResponse(results, correlationId);
	}

	get _prefix() {
		return '';
	}

	get _step() {
		return 'version';
	}
}

export default VersionActionBuildService;
