import fs from 'fs';

import LibraryCommonUtility from '@thzero/library_common/utility/index.js';

import ActionBuildService from './index.js';

class VersionActionBuildService extends ActionBuildService {
	constructor() {
		super();
	}

	async _process(correlationId, buildLog, repo, offset) {
		const args = buildLog.args ? buildLog.args : {};

		let packageJson = await fs.promises.readFile(repo.pathPackage);
		packageJson = JSON.parse(packageJson);

		let major = Number(packageJson.version_major || 0);
		let minor = Number(packageJson.version_minor || 0);
		let patch = Number(packageJson.version_patch || 0);
		const previous = `${major}.${minor}.${patch}`;

		let pi = args.pi === true;

		if (args.majorIncrement === true) {
			major = major + 1;
			minor = 0;
			patch = 0;
			pi = false;
		}
		else if (args.minorIncrement === true) {
			minor = minor + 1;
			patch = 0;
			pi = false;
		}
		else {
			if (LibraryCommonUtility.isNotNull(args.major)) {
				major = Number(args.major);
				pi = false;
			}
			if (LibraryCommonUtility.isNotNull(args.minor)) {
				minor = Number(args.minor);
				pi = false;
			}
		}

		if (pi)
			patch = patch + 1;

		const version = `${major}.${minor}.${patch}`;
		const date = this._date();

		packageJson.version = version;
		packageJson.version_major = major;
		packageJson.version_minor = minor;
		packageJson.version_patch = patch;
		packageJson.version_date = date;

		try {
			await fs.promises.writeFile(repo.pathPackage, JSON.stringify(packageJson, null, 2));
		}
		catch (err) {
			return this._error('VersionActionBuildService', '_process', null, err, null, null, correlationId);
		}

		const message = `Updated version from '${previous}' to '${version}', '${date}'.`;
		this._info(message, offset);

		repo.dirty = true;

		return this._successResponse({ success: true, message: message }, correlationId);
	}

	_date() {
		const now = new Date();
		return `${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}/${now.getFullYear()}`;
	}

	get _prefix() {
		return '';
	}

	get _step() {
		return 'version';
	}
}

export default VersionActionBuildService;
