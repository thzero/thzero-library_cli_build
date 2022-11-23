import path from 'path';
import fs from 'fs/promises';

import NotImplementedError from '@thzero/library_common/errors/notImplemented.js';

import Service from '@thzero/library_common_service/service/index.js';

class PluginBuildService extends Service {
	constructor() {
		super();

		this._actions = [];
		this._outputAccumulator = null;
		this._steps = [];

		this._initializeActions();
	}

	async complete(correlationId, buildLog) {
		this._outputAccumulator = '';

		let response = await this._completeBefore(correlationId, buildLog);
		if (this._hasFailed(response))
			return response;

		for(const step of this._steps) 
		await this._completeItem(correlationId, buildLog, step);

		response = await this._completeAfter(correlationId, buildLog);
		if (this._hasFailed(response))
			return response;

		response.results;
		if (this._hasFailed(response))
			return response;

		this._logger.info2(this._outputAccumulator);
		if (!String.isNullOrEmpty(this._outputAccumulator))
			await this._write(correlationId, buildLog, this._outputAccumulator)

		return response;
	}

	async process(correlationId, repo, data) {
		this._enforceNotNull('PluginBuildService', 'process', repo, 'repo', correlationId);

		const step = {
			repo: repo.repo,
			repo_url: repo.repo_url
		};

		const response = await this._process(correlationId, repo, step, data);
		if (this._hasSucceeded(response))
			this._steps.push(step);

		return response;
	}

	get actions() {
		return this._actions;
	}

	get tag() {
		throw new NotImplementedError();
	}

	hasAction(correlationId, action) {
		if (String.isNullOrEmpty(action))
			return;

		return !String.isNullOrEmpty(this._actions.find(l => l.toLowerCase() === action.toLowerCase()));
	}

	async _completeAfter(correlationId, buildLog) {
		return this._success(correlationId);
	}

	async _completeBefore(correlationId, buildLog) {
		return this._success(correlationId);
	}

	async _completeItem(correlationId, buildLog, step) {
		return this._success(correlationId);
	}

	_initializeActions() {
	}

	_initializeAction(action) {
		this._actions.push(action);
	}

	_output(correlationId, output) {
		this._outputAccumulator += output + '\n';
	}

	async _process(correlationId, repo, step, data) {
		return this._success(correlationId);
	}

	async _write(correlationId, buildLog, output) {
		const pathOutput = path.join(buildLog.pathCwd, `${this.tag}.txt`);
		await fs.writeFile(pathOutput, output);
		this._logger.info2(`${this.tag} output is available in '${pathOutput}'.`);
	}
}

export default PluginBuildService;
