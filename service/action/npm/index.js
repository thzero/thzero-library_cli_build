import path from 'path';
import fs from 'fs/promises';

import fetch from 'isomorphic-unfetch';

import ActionBuildService from '../index.js';

class NpmActionBuildService extends ActionBuildService {
	constructor() {
		super();
	}

	async init(injector) {
		await super.init(injector);

		const tokens = this._getTokens(null);
		if (!tokens)
			throw Error('Invalid tokens!');
		this._token = tokens.npm;
		if (String.isNullOrEmpty(this._token))
			throw Error('Invalid npm token!');
	}

	async _checkVersion(correlationId, repo, repPath, offset) {
		const version = await this._getVersion(correlationId, repo, repPath, offset);

		let name = repo.repo;
		if (!String.isNullOrEmpty(repo.scope))
			name = `${repo.scope}/${name}`;

		// The single version document is a couple of KB and answers the question
		// with its status code; the full packument is hundreds of KB.
		const endpoint = `https://registry.npmjs.org/${name}/${version}`;
		const res = await fetch(endpoint);
		if (!res)
			throw Error (`'${repo.repo}' issue accessing the npm registry.`);

		if (res.status === 200)
			return { success: false };

		if (res.status === 404) {
			this._info(`'${name}@${version}' not found in the npm registry.`, offset);
			return { success: true };
		}

		throw Error (`'${repo.repo}' issue accessing the npm registry; status ${res.status}.`);
	}

	async _getVersion(correlationId, repo, repPath, offset) {
		const filePath = path.join(repPath, 'package.json');
		const file = await fs.readFile(filePath, 'utf8');
		if (String.isNullOrEmpty(file))
			throw Error('Invalid package.json file for versioning; expected in the <app root> folder.');

		const packageObj = JSON.parse(file);
		if (!packageObj)
			throw Error('Invalid package.json file for versioning.');

		return packageObj.version;
	}
}

export default NpmActionBuildService;
