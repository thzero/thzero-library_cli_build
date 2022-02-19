const Constants = {
	LogSpacer: '  ',
	InjectorKeys: {
		SERVICE_BUILD: 'serviceBuild',
		SERVICE_BUILD_ACTION_LICENSE: 'serviceBuildLicense',
		SERVICE_BUILD_ACTION_PUBLISH: 'serviceBuildPublish',
		SERVICE_BUILD_ACTION_DEPENDENCY_CHECK: 'serviceBuildActionDependencyCheck',
		SERVICE_BUILD_ACTION_DEPENDENCY_UPDATE: 'serviceBuildActionDependencyUpdate',
		SERVICE_BUILD_ACTION_PUBLISH_DEPENDENCY_FETCH: 'serviceBuildActionDependencyFetchPublish',
		SERVICE_BUILD_ACTION_PUBLISH_PACKAGE: 'serviceBuildActionPackagePublish',
		SERVICE_BUILD_ACTION_PUBLISH_SOURCE_CLONE: 'serviceBuildActionPublishSourceClone',
		SERVICE_BUILD_ACTION_SOURCE_LOCAL_CLONE: 'serviceBuildActionSourceLocalClone',
		SERVICE_BUILD_ACTION_SOURCE_LOCAL_COMMIT: 'serviceBuildActionSourceLocalCommit',
		SERVICE_BUILD_ACTION_SOURCE_LOCAL_PULL: 'serviceBuildActionSourceLocalPull',
		SERVICE_BUILD_ACTION_SOURCE_LOCAL_STATUS: 'serviceBuildActionSourceLocalStatus',
		SERVICE_BUILD_ACTION_SOURCE_REMOTE: 'serviceBuildActionSourceRemote',
		SERVICE_BUILD_ACTION_VERSION: 'serviceBuildVersion',
		SERVICE_BUILD_STANDARD: 'serviceBuildStandard',

		SERVICE_LOGGER_PINO: 'serviceLoggerPino',
		SERVICE_LOGGER_WISTON: 'serviceLoggerWinston'
	},
	BuildTags: {
		Standard: 'standard'
	}
}

export default Constants;
