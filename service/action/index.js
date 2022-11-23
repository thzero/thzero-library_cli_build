import Constants from '../../constants.js';

import NotImplementedError from '@thzero/library_common/errors/notImplemented.js';

import Service from '@thzero/library_common_service/service/index.js';

class ActionBuildService extends Service {
	constructor() {
		super();
	}

	async init(injector) {
		await super.init(injector);
	}

	get prefix() {
		return this._prefix;
	}

	async process(correlationId, buildLog, repo, offset) {
		try {
			this._enforceNotNull('ActionBuildService', 'process', repo, 'args', correlationId);
			this._enforceNotEmpty('ActionBuildService', 'process', buildLog, 'buildLog', correlationId);
			this._enforceNotEmpty('ActionBuildService', 'process', repo.repo, 'repo', correlationId);
			this._enforceNotEmpty('ActionBuildService', 'process', repo.path, 'path', correlationId);
			this._enforceNotEmpty('ActionBuildService', 'process', repo.pathPackage, 'pathPackage', correlationId);

			this._info(`processing ${this.stepName}...`, offset);

			return await this._process(correlationId, buildLog, repo, offset + 1);
		}
		catch (err) {
			return this._error('ActionBuildService', 'process', null, err, null, null, correlationId);
		}
		finally {
			this._info(`...processed ${this.stepName}.`, offset);
		}
	}

	get step() {
		return this._step;
	}

	get stepName() {
		return this._prefix + (!String.isNullOrEmpty(this._prefix) ? '-' : '') + this._step;
	}

	_checkAction(correlationId, buildLog, action) {
		this._enforceNotNull('ProcessBuildService', '_checkAction', buildLog, 'buildLog', correlationId);
		this._enforceNotEmpty('ProcessBuildService', '_checkAction', action, 'action', correlationId);

		if (!buildLog.buildType || !buildLog.buildType.actions)
			return false;

		const result = buildLog.buildType.actions.find(l => l.toLowerCase() === action.toLowerCase());
		return !String.isNullOrEmpty(result);
	}

	_getPlugin(correlationId, buildLog, tag) {
		this._enforceNotNull('ActionBuildService', '_getPlugin', buildLog, 'buildLog', correlationId);
		this._enforceNotEmpty('ActionBuildService', '_getPlugin', tag, 'tag', correlationId);

		if (!buildLog.pluginsAvailable)
			return;

		return buildLog.pluginsAvailable.find(l => l.tag.toLowerCase() === tag.toLowerCase());
	}

	_getPluginsByStep(correlationId, buildLog) {
		this._enforceNotNull('ActionBuildService', '_getPluginsByStep', buildLog, 'buildLog', correlationId);

		if (!buildLog.pluginsAvailable)
			return;

		const temp = this._step.toLowerCase();
		return buildLog.pluginsAvailable.filter(l => l.hasAction(correlationId, temp));
	}

	_getTokens(correlationId) {
		return this._config.get('tokens');
	}

	async _process(correlationId, buildLog, repo, offset) {
		throw new NotImplementedError();
	}

	_info(message, offset) {
		offset = offset != null && offset != undefined ? offset : 0;
		const spacer = Constants.LogSpacer.repeat(offset);
		this._logger.info2(`${spacer}${message}`);
	}

	get _prefix() {
		throw new NotImplementedError();
	}

	get _step() {
		throw new NotImplementedError();
	}
}

export default ActionBuildService;
