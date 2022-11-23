import Constants from '../../constants.js';

import BootPlugin from './index.js';

import GitCloneLocalSourceActionBuildService from '../../service/action/git/sourceClone.js';
import GitCommitLocalSourceActionBuildService from '../../service/action/git/sourceCommit.js';
import GitPublishCloneSourceActionBuildService from '../../service/action/git/sourcePublishClone.js';
import GitPullLocalSourceActionBuildService from '../../service/action/git/sourcePull.js';
import GitStatusLocalSourceActionBuildService from '../../service/action/git/sourceStatus.js';
import GitHubSourceRemoteBuildActionService from '../../service/action/github/pullRequest.js';
import LicenseBuildActionService from '../../service/action/license.js';
import NpmDependencyFetchPublishBuildService from '../../service/action/npm/publishDependencyFetch.js';
import NpmPublishPackageBuildService from '../../service/action/npm/publishPackage.js';
import NcuDepdencyCheckBuildActionService from '../../service/action/ncu/dependencyCheck.js';
import NcuDepdencyUpdateBuildActionService from '../../service/action/ncu/dependencyUpdate.js';
import PublishBuildActionService from '../../service/action/publish.js';
import VersionBuildActionService from '../../service/action/version.js';

import DependencyOnlyAccumulatePluginService from '../../service/plugin/dependencyCheckAccumulate.js';

import StandardProcessBuildService from '../../service/process/standard.js';

class BuildBootPlugin extends BootPlugin {
	async _initServices() {
		await super._initServices();

		this._injectService(Constants.InjectorKeys.SERVICE_BUILD_STANDARD, new StandardProcessBuildService());

		this._injectService(Constants.InjectorKeys.SERVICE_BUILD_ACTION_DEPENDENCY_CHECK, new NcuDepdencyCheckBuildActionService());
		this._injectService(Constants.InjectorKeys.SERVICE_BUILD_ACTION_DEPENDENCY_UPDATE, new NcuDepdencyUpdateBuildActionService());
		this._injectService(Constants.InjectorKeys.SERVICE_BUILD_ACTION_LICENSE, new LicenseBuildActionService());
		this._injectService(Constants.InjectorKeys.SERVICE_BUILD_ACTION_PUBLISH, new PublishBuildActionService());
		this._injectService(Constants.InjectorKeys.SERVICE_BUILD_ACTION_PUBLISH_DEPENDENCY_FETCH, new NpmDependencyFetchPublishBuildService());
		this._injectService(Constants.InjectorKeys.SERVICE_BUILD_ACTION_PUBLISH_PACKAGE, new NpmPublishPackageBuildService());
		this._injectService(Constants.InjectorKeys.SERVICE_BUILD_ACTION_PUBLISH_SOURCE_CLONE, new GitPublishCloneSourceActionBuildService());
		this._injectService(Constants.InjectorKeys.SERVICE_BUILD_ACTION_SOURCE_LOCAL_CLONE, new GitCloneLocalSourceActionBuildService());
		this._injectService(Constants.InjectorKeys.SERVICE_BUILD_ACTION_SOURCE_LOCAL_COMMIT, new GitCommitLocalSourceActionBuildService());
		this._injectService(Constants.InjectorKeys.SERVICE_BUILD_ACTION_SOURCE_LOCAL_PULL, new GitPullLocalSourceActionBuildService());
		this._injectService(Constants.InjectorKeys.SERVICE_BUILD_ACTION_SOURCE_LOCAL_STATUS, new GitStatusLocalSourceActionBuildService());
		this._injectService(Constants.InjectorKeys.SERVICE_BUILD_ACTION_SOURCE_REMOTE, new GitHubSourceRemoteBuildActionService());
		this._injectService(Constants.InjectorKeys.SERVICE_BUILD_ACTION_VERSION, new VersionBuildActionService());

		let plugin = new DependencyOnlyAccumulatePluginService();
		this._injectService('serviceBuildPlugin-' + plugin.tag, plugin);
	}
}

export default BuildBootPlugin;
