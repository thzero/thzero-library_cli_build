import fs from 'fs';
import path from 'path';

import ActionBuildService from './index.js';

class LicenseActionBuildService extends ActionBuildService {
	constructor() {
		super();
	}

	async _process(correlationId, buildLog, repo, offset) {
		const pathLicense = path.join(repo.path, 'license.md');
		if (!fs.existsSync(pathLicense))
			return this._success(correlationId);
		
		let year = !String.isNullOrEmpty(buildLog.args.year) ? parseInt(buildLog.args.year) : new Date().getFullYear();

		const buffer = fs.readFileSync(pathLicense);
		if (!buffer)
			return this._successResponse(results, correlationId);
		
		const regex = /([0-9]{4})-([0-9]{4})/gm;
		const license = buffer.toString();
		const license2 = license.replaceAll(regex, '$1-' + year);
		if (license === license2)
			return this._success(correlationId);

		fs.writeFileSync(pathLicense, license2);

		repo.dirty = true;
		repo.label = 'copyright update';

		return this._success(correlationId);
	}

	get _prefix() {
		return '';
	}

	get _step() {
		return 'license';
	}
}

export default LicenseActionBuildService;
