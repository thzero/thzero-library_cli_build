import { Octokit } from '@octokit/core';

import ActionBuildService from '../index.js';

class GitHubSourceActionBuildService extends ActionBuildService {
	constructor() {
		super();

		this._octokit = null;
	}

	async init(injector) {
		super.init(injector);

		const tokens = this._getTokens(null);
		if (!tokens)
			throw Error('Invalid tokens!');
		let token = tokens.github;
		if (String.isNullOrEmpty(token))
			throw Error('Invalid github token!');
			
		this._octokit = new Octokit({ auth: token });
		if (!this._octokit)
			throw Error('Invalid octokit!');

		await this._octokit.request('GET /user');
	}
}

export default GitHubSourceActionBuildService;
