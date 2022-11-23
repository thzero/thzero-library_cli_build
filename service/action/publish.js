import fs from 'fs';
import path from 'path';

import Constants from '../../constants.js';

import ActionBuildService from './index.js';

class PublishActionBuildService extends ActionBuildService {
	constructor() {
		super();

		this._serviceDependencyFetchPublish = null;
		this._servicePackagePublish = null;
		this._servicePublishCloneSource = null;

		this.actionPublish = 'publish';
		this.actionPublishDependencyFetch = 'publishDependencyFetch';
		this.actionPublishOnly = 'publishOnly';
		this.actionPublishClone = 'publishClone';
	}

	async init(injector) {
		await super.init(injector);

		this._serviceDependencyFetchPublish = this._injector.getService(Constants.InjectorKeys.SERVICE_BUILD_ACTION_PUBLISH_DEPENDENCY_FETCH);
		this._servicePackagePublish = this._injector.getService(Constants.InjectorKeys.SERVICE_BUILD_ACTION_PUBLISH_PACKAGE);
		this._servicePublishCloneSource = this._injector.getService(Constants.InjectorKeys.SERVICE_BUILD_ACTION_PUBLISH_SOURCE_CLONE);
	}

	async _process(correlationId, buildLog, repo, offset) {
		repo.pathPublish = path.join(buildLog.pathCwd, 'publish');

		if (!this._checkAction(correlationId, buildLog, this.actionPublishOnly)) {
			if (!repo.dirty) {
				buildLog.step(repo.repo, this.actionPublish);
				buildLog.stepSuccess(repo.repo, this.actionPublish, repo.dirty);
				return this._success(correlationId);
			}
		}
		
		if (!fs.existsSync(repo.pathPublish))
			fs.mkdirSync(repo.pathPublish);

		buildLog.step(repo.repo, this.actionPublishClone);
		let response = await this._servicePublishCloneSource.process(correlationId, buildLog, repo, offset);
		if (!response.success) {
			buildLog.stepFailure(repo.repo, this.actionPublishClone);
			return response;
		}
		buildLog.stepSuccess(repo.repo, this.actionPublishClone);

		buildLog.step(repo.repo, this.actionPublishDependencyFetch);
		response = await this._serviceDependencyFetchPublish.process(correlationId, buildLog, repo, offset);
		if (!response.success) {
			buildLog.stepFailure(repo.repo, this.actionPublishDependencyFetch);
			return response;
		}
		buildLog.stepSuccess(repo.repo, this.actionPublishDependencyFetch);

		buildLog.step(repo.repo, this.actionPublish);
		response = await this._servicePackagePublish.process(correlationId, buildLog, repo, offset);
		if (!response.success) {
			buildLog.stepFailure(repo.repo, this.actionPublish);
			return response;
		}
		buildLog.stepSuccess(repo.repo, this.actionPublish);

		return this._success(correlationId);
	}

	get _prefix() {
		return '';
	}

	get _step() {
		return 'publish';
	}
}

export default PublishActionBuildService;
