import NotImplementedError from '@thzero/library_common/errors/notImplemented';

import Service from '@thzero/library_common_service/service';

class ProcessBuildService extends Service {
	constructor() {
		super();

		this._buildType = null;
	}

	set buildType(value) { this._buildType = value; }

	async process(correlationId, buildLog, repo, offset) {
		this._enforceNotNull('ProcessBuildService', 'process', repo, 'repo', correlationId);
		this._enforceNotEmpty('ProcessBuildService', 'process', buildLog, 'buildLog', correlationId);
		this._enforceNotEmpty('ProcessBuildService', 'process', repo.repo, 'repo', correlationId);

		return await this._process(correlationId, buildLog, repo, offset);
	}

	_checkAction(correlationId, action) {
		this._enforceNotEmpty('ProcessBuildService', '_checkAction', action, 'action', correlationId);

		if (!this._buildType || !this._buildType.actions)
			return false;

		const result = this._buildType.actions.find(l => l.toLowerCase() === action.toLowerCase());
		return !String.isNullOrEmpty(result);
	}

	async _process(correlationId, buildLog, repo, offset) {
		throw new NotImplementedError();
	}

	get tag() {
		throw new NotImplementedError();
	}
}

export default ProcessBuildService;
