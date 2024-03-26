import { updateVersion } from '@thzero/library_cli/api.js';

import ActionBuildService from './index.js';

class VersionActionBuildService extends ActionBuildService {
	constructor() {
		super();
	}

	async _process(correlationId, buildLog, repo) {
		let pi = buildLog.args.pi === true;
		let major = null;
		if (!String.isNullOrEmpty(buildLog.args.major)) {
			major = buildLog.args.major;
			pi = false;
		}
		let minor = null;
		if (!String.isNullOrEmpty(buildLog.args.minor)) {
			minor = buildLog.args.minor;
			pi = false;
		}

		const results = await updateVersion({
			packagePath: repo.pathPackage,
			major: major,
			minor: minor,
			pi: pi
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
