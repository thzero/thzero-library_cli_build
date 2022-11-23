import Constants from '../../constants.js';

import ProcessBuildService from './index.js';

class StandardProcessBuildService extends ProcessBuildService {
	constructor() {
		super();

		this._serviceDependencyCheck = null;
		this._serviceDependencyUpdate = null;
		this._serviceLicense = null;
		this._servicePublish = null;
		this._servicePublishPackage = null;
		this._serviceSourceLocalClone = null;
		this._serviceSourceLocalCommit = null;
		this._serviceSourceLocalPull = null;
		this._serviceSourceLocalStatus = null;
		this._serviceSourceLocalCommit = null;
		this._serviceSourceRemote = null;
		this._serviceVersion = null;

		this.actionDependencyCheck = 'dependencyCheck';
		this.actionDependencyUpdate = 'dependencyUpdate';
		this.actionLicense = 'license';
		this.actionPublish = 'publish';
		this.actionPublishOnly = 'publishOnly';
		this.actionSourceClone = 'clone';
		this.actionSourceCommit = 'commit';
		this.actionSourceMerge = 'merge';
		this.actionSourcePull = 'pull';
		this.actionSourceStatus = 'status';
		this.actionSourceVersion = 'version';
		this.actionSourceVersionAlways = 'versionAlways';
	}

	async init(injector) {
		await super.init(injector);

		this._serviceDependencyCheck = this._injector.getService(Constants.InjectorKeys.SERVICE_BUILD_ACTION_DEPENDENCY_CHECK);
		this._serviceDependencyUpdate = this._injector.getService(Constants.InjectorKeys.SERVICE_BUILD_ACTION_DEPENDENCY_UPDATE);
		this._serviceLicense = this._injector.getService(Constants.InjectorKeys.SERVICE_BUILD_ACTION_LICENSE);
		this._servicePublish = this._injector.getService(Constants.InjectorKeys.SERVICE_BUILD_ACTION_PUBLISH);
		this._servicePublishPackage = this._injector.getService(Constants.InjectorKeys.SERVICE_BUILD_ACTION_PUBLISH_PACKAGE);
		this._serviceSourceLocalClone = this._injector.getService(Constants.InjectorKeys.SERVICE_BUILD_ACTION_SOURCE_LOCAL_CLONE);
		this._serviceSourceLocalCommit = this._injector.getService(Constants.InjectorKeys.SERVICE_BUILD_ACTION_SOURCE_LOCAL_COMMIT);
		this._serviceSourceLocalPull = this._injector.getService(Constants.InjectorKeys.SERVICE_BUILD_ACTION_SOURCE_LOCAL_PULL);
		this._serviceSourceLocalStatus = this._injector.getService(Constants.InjectorKeys.SERVICE_BUILD_ACTION_SOURCE_LOCAL_STATUS);
		this._serviceSourceRemote = this._injector.getService(Constants.InjectorKeys.SERVICE_BUILD_ACTION_SOURCE_REMOTE);
		this._serviceVersion = this._injector.getService(Constants.InjectorKeys.SERVICE_BUILD_ACTION_VERSION);
	}

	async _process(correlationId, buildLog, repo, offset) {
		this._enforceNotNull('StandardProcessBuildService', '_process', buildLog, 'buildLog', correlationId);
		this._enforceNotNull('StandardProcessBuildService', '_process', repo, 'repo', correlationId);
		this._enforceNotNull('StandardProcessBuildService', '_process', offset, 'offset', correlationId);

		let response;

		repo.dirty = false;

		if (this._checkAction(correlationId, this.actionSourceClone)) {
			buildLog.step(repo.repo, this.actionSourceClone);
			response = await this._serviceSourceLocalClone.process(correlationId, buildLog, repo, offset);
			if (this._hasFailed(response)) {
				buildLog.stepFailure(repo.repo, this.actionSourceClone, repo.dirty);
				return response;
			}
			buildLog.stepSuccess(repo.repo, this.actionSourceClone, repo.dirty);
		}

		if (this._checkAction(correlationId, this.actionSourcePull)) {
			buildLog.step(repo.repo, this.actionSourcePull);
			response = await this._serviceSourceLocalPull.process(correlationId, buildLog, repo, offset);
			if (this._hasFailed(response)) {
				buildLog.stepFailure(repo.repo, this.actionSourcePull, repo.dirty);
				return response;
			}
			buildLog.stepSuccess(repo.repo, this.actionSourcePull, repo.dirty);
		}

		if (this._checkAction(correlationId, this.actionLicense)) {
			buildLog.step(repo.repo, this.actionLicense);
			response = await this._serviceLicense.process(correlationId, buildLog, repo, offset);
			if (this._hasFailed(response)) {
				buildLog.stepFailure(repo.repo, this.actionLicense, repo.dirty);
				return response;
			}
			buildLog.stepSuccess(repo.repo, this.actionLicense, repo.dirty);
		}

		if (this._checkAction(correlationId, this.actionDependencyCheck)) {
			buildLog.step(repo.repo, this.actionDependencyCheck);
			response = await this._serviceDependencyCheck.process(correlationId, buildLog, repo, offset);
			if (this._hasFailed(response)) {
				buildLog.stepFailure(repo.repo, this.actionDependencyCheck, repo.dirty);
				return response;
			}
			buildLog.stepSuccess(repo.repo, this.actionDependencyCheck, repo.dirty);
		}

		if (this._checkAction(correlationId, this.actionDependencyUpdate)) {
			buildLog.step(repo.repo, this.actionDependencyUpdate);
			response = await this._serviceDependencyUpdate.process(correlationId, buildLog, repo, offset);
			if (this._hasFailed(response)) {
				buildLog.stepFailure(repo.repo, this.actionDependencyUpdate, repo.dirty);
				return response;
			}
			buildLog.stepSuccess(repo.repo, this.actionDependencyUpdate, repo.dirty);
		}

		if (this._checkAction(correlationId, this.actionSourceStatus)) {
			response = await this._serviceSourceLocalStatus.process(correlationId, buildLog, repo, offset);
			if (this._hasFailed(response))
				return response;
		}

		if (repo.dirty && this._checkAction(correlationId, this.actionSourceVersion)) {
			buildLog.step(repo.repo, this.actionSourceVersion);
			response = await this._serviceVersion.process(correlationId, buildLog, repo, offset);
			if (this._hasFailed(response)) {
				buildLog.stepFailure(repo.repo, this.actionSourceVersion, repo.dirty);
				return response;
			}
			buildLog.stepSuccess(repo.repo, this.actionSourceVersion, repo.dirty);
		}

		if (this._checkAction(correlationId, this.actionSourceVersionAlways)) {
			buildLog.step(repo.repo, this.actionSourceVersionAlways);
			response = await this._serviceVersion.process(correlationId, buildLog, repo, offset);
			if (this._hasFailed(response)) {
				buildLog.stepFailure(repo.repo, this.actionSourceVersion, repo.dirty);
				return response;
			}
			buildLog.stepSuccess(repo.repo, this.actionSourceVersionAlways, repo.dirty);
		}

		if (repo.dirty && String.isNullOrEmpty(repo.label))
			throw Error('No label.');

		if (repo.dirty && this._checkAction(correlationId, this.actionSourceCommit)) {
			buildLog.step(repo.repo, this.actionSourceCommit);
			response = await this._serviceSourceLocalCommit.process(correlationId, buildLog, repo, offset);
			if (this._hasFailed(response)) {
				buildLog.stepFailure(repo.repo, this.actionSourceCommit, repo.dirty);
				return response;
			}
			buildLog.stepSuccess(repo.repo, this.actionSourceCommit, repo.dirty);
		}

		if (repo.dirty && this._checkAction(correlationId, this.actionSourceMerge)) {
			buildLog.step(repo.repo, this.actionSourceMerge);
			response = await this._serviceSourceRemote.process(correlationId, buildLog, repo, offset);
			if (this._hasFailed(response)) {
				buildLog.stepFailure(repo.repo, this.actionSourceMerge, null);
				return response;
			}
			buildLog.stepSuccess(repo.repo, this.actionSourceMerge, null);
		}

		// if (repo.dirty && this._checkAction(correlationId, this.actionPublish)) {
		// 	repo.pathPublish = path.join(buildLog.pathCwd, "publish", repo.repo);

		// buildLog.step(repo.repo, this.actionPublish);
		// 	response = await this._serviceSourceLocalPullPublish.process(correlationId, buildLog, repo, offset);
		// 	if (this._hasFailed(response)) {
		// 		buildLog.stepFailure(repo.repo, this.actionSourcePull, false, repo.dirty);
		// 		return response;
		// 	}
		// 	buildLog.stepSuccess(repo.repo, this.actionSourcePull, true, repo.dirty);
		
		// 	// buildLog.step(repo.repo, this.actionPublish);
		// 	// 	response = await this._servicePublishPackage.process(correlationId, buildLog, repo, offset);
		// 	// 	if (this._hasFailed(response)) {
		// 	// 		buildLog.stepFailure(repo.repo, this.actionPublish, false, null);
		// 	// 		return response;
		// 	// 	}
		// 	// 	buildLog.stepSuccess(repo.repo, this.actionPublish, true, null);
		// }
		if (this._checkAction(correlationId, this.actionPublish) ||
			this._checkAction(correlationId, this.actionPublishOnly)
		) {
			response = await this._servicePublish.process(correlationId, buildLog, repo, offset);
			if (this._hasFailed(response))
				return response;
		}
		else
			response = this._success(correlationId);

		return response;
	}

	get tag() {
		return Constants.BuildTags.Standard;
	}
}

export default StandardProcessBuildService;
