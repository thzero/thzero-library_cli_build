import fs from 'fs';
import path from 'path';

import Constants from '../constants.js';

import LibraryCommonUtility from '@thzero/library_common/utility/index.js';
import LibraryMomentUtility from '@thzero/library_common/utility/moment.js';

import Service from '@thzero/library_common_service/service/index.js';

import PluginBuildService from './plugin/index.js';
import ProcessBuildService from './process/index.js';

class BuildService extends Service {
	constructor() {
		super();

		this._buildPlugins = [];
		this._buildProcessors = [];
	}

	async init(injector) {
		await super.init(injector);

		const services = injector.getSingletons();
		for (const service of services) {
			if (!(service instanceof PluginBuildService))
				continue;

			this._buildPlugins.push(service);
		}

		for (const service of services) {
			if (!(service instanceof ProcessBuildService))
				continue;

			this._buildProcessors.push(service);
		}
	}

	async process(correlationId, args) {
		let buildLog = null;
		
		try {
			this._enforceNotNull('BuildService', 'process', args, 'args', correlationId);
			this._enforceNotEmpty('BuildService', 'process', args.build, 'args.build', correlationId);

			this._logger.info2('');
			this._logger.info2(`building '${args.build}'...`);
			if (args.dryRun === true)
				this._logger.info2(`*** DRY RUN - no commits, pull requests, merges, or npm publishes will be performed. ***`);

			let pathCwd = process.cwd();
			if (!String.isNullOrEmpty(args.working)) {
				this._logger.info('BuildService', 'process', 'args.working', args.working, correlationId); // TODO: debug
				args.working = path.normalize(args.working);
				this._logger.info('BuildService', 'process', 'args.working.normalize', args.working, correlationId); // TODO: debug
				args.working = path.resolve(args.working);
				this._logger.info('BuildService', 'process', 'args.working.resolve', args.working, correlationId); // TODO: debug
				if (!fs.existsSync(args.working))
					throw Error ('Provided working path does not exist.');

				pathCwd = args.working;
			}
			pathCwd = path.join(pathCwd, 'working');
			this._info(`Working path: ${pathCwd}`);
			if (!fs.existsSync(pathCwd))
				throw Error (`Working path '${pathCwd}' does not exist.`);

			if (false) {
				const build = null; // TODO: load from file
				buildLog = new BuildLog(build, args);
			}
			else {
				let builds;
				const pathBuild = path.join(pathCwd, 'builds.json');
				if (fs.existsSync(pathBuild)) {
					const data = fs.readFileSync(pathBuild);
					this._enforceNotNull('BuildService', 'process', data, 'data', correlationId);
					builds = JSON.parse(data);
				}
				this._enforceNotNull('BuildService', 'process', builds, 'builds', correlationId);

				const build = builds.find(l => l.name.toLowerCase() === args.build.toLowerCase());
				this._enforceNotNull('BuildService', 'process', build, 'build parameter', correlationId);
				this._enforceNotNull('BuildService', 'process', build.repos, 'build.repos', correlationId);

				if (args.filter && (args.filter.length > 0)) {
					build.repos = this._filterRepos(build.repos, args.filter.map(l => this._filterPattern(l)));
					const matched = this._countRepos(build.repos);
					if (matched === 0)
						return this._error('BuildService', 'process', `No repos in build '${args.build}' match the filter '${args.filter.join(', ')}'.`, null, null, null, correlationId);

					this._info(`Filter '${args.filter.join(', ')}' matched ${matched} repo(s).`);
				}

				buildLog = new BuildLog(build, args);
			}

			const buildTypes = this._config.get('buildTypes');
			this._enforceNotNull('BuildService', 'process', buildTypes, 'buildTypes', correlationId);
			let buildType = args.buildType;
			if (String.isNullOrEmpty(buildType))
				buildType = !String.isNullOrEmpty(buildLog.buildType) ? buildLog.buildType : null;
			this._enforceNotEmpty('BuildService', 'process', buildType, 'type parameter', correlationId);
			
			const buildTypeI = buildTypes.find(l => l.tag.toLowerCase() === buildType.toLowerCase());
			if (!buildTypeI)
				return this._error('BuildService', 'process', `Build type not found for tag '${buildType}'.`, null, null, null, correlationId);

			let buildServiceTag = buildTypeI.builderService;
			if (String.isNullOrEmpty(buildServiceTag))
				buildServiceTag = !String.isNullOrEmpty(buildTypeI.buildService) ? buildTypeI.buildService : Constants.BuildTags.Standard;

			const buildService = this._buildProcessors.find(l => l.tag.toLowerCase() === buildServiceTag.toLowerCase());
			this._enforceNotNull('BuildService', 'buildService', buildService, 'buildService', correlationId);
			
			buildLog.pathCwd = pathCwd;
			buildLog.pluginsAvailable = [];
			buildLog.buildType = buildTypeI;
			buildService.buildType = buildTypeI;

			if (buildLog.buildType.plugins) {
				let plugin;
				for(const tag of buildLog.buildType.plugins) {
					plugin = this._buildPlugins.find(l => l.tag.toLowerCase() === tag.toLowerCase())
					if (!plugin)
						continue;

					buildLog.pluginsAvailable.push(plugin);
				}
			}

			const response = await this._processRepos(correlationId, args, buildService, buildLog, buildLog.repos, 0);

			for (const plugin of buildLog.pluginsAvailable)
				await plugin.complete(correlationId, buildLog);

			return response;
		}
		catch (err) {
			return this._error('BuildService', 'process', null, err, null, null, correlationId);
		}
		finally {
			this._logger.info2(`...building completed.`);
			this._logger.info2('');

			if (buildLog) {
				delete buildLog.pluginsAvailable;
				this._logger.info2('Build Log:\n' + JSON.stringify(buildLog, null, 2));
			}
		}
	}

	_info(message, offset) {
		offset = offset ?? 0;
		const spacer = Constants.LogSpacer.repeat(offset);
		this._logger.info2(`${spacer}${message}`);
	}

	async _processRepos(correlationId, args, buildService, buildLog, repos, offset) {
		this._enforceNotNull('BuildService', '_processRepos', args, 'args', correlationId);
		this._enforceNotNull('BuildService', '_processRepos', buildService, 'buildService', correlationId);
		this._enforceNotNull('BuildService', '_processRepos', buildLog, 'buildLog', correlationId);
		this._enforceNotNull('BuildService', '_processRepos', repos, 'repos', correlationId);

		const limit = this._parallelLimit(args);

		let response;
		for (const batch of this._batchRepos(repos, limit)) {
			if (batch.parallel && (batch.repos.length > 1)) {
				this._info(`processing ${batch.repos.length} independent repos together.`, offset);

				const responses = await Promise.all(batch.repos.map(l =>
					this._processRepo(correlationId, args, buildService, buildLog, l, offset)));

				response = responses.find(l => this._hasFailed(l));
				if (response)
					return response;

				continue;
			}

			response = await this._processRepo(correlationId, args, buildService, buildLog, batch.repos[0], offset);
			if (this._hasFailed(response))
				return response;
		}

		return this._success(correlationId);
	}

	// Consecutive leaf repos marked wait:false are declared independent of one
	// another, so they can run together. A group, or anything the build waits
	// on, is a barrier and runs on its own.
	_countRepos(repos) {
		let count = 0;
		for (const repo of repos)
			count += repo.repos ? this._countRepos(repo.repos) : 1;
		return count;
	}

	// Prunes the repo tree down to the leaves matching a pattern, keeping a
	// group only when something under it survives.
	_filterRepos(repos, patterns) {
		const results = [];
		for (const repo of repos) {
			if (repo.repos) {
				const children = this._filterRepos(repo.repos, patterns);
				if (children.length > 0)
					results.push(Object.assign({}, repo, { repos: children }));
				continue;
			}

			if (String.isNullOrEmpty(repo.repo))
				continue;

			const name = repo.repo.toLowerCase();
			if (patterns.some(l => l.test(name)))
				results.push(repo);
		}
		return results;
	}

	_filterPattern(filter) {
		const escaped = filter.toLowerCase()
			.split('*')
			.map(l => l.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
			.join('.*');
		return new RegExp('^' + escaped + '$');
	}

	_batchRepos(repos, limit) {
		const batches = [];
		for (const repo of repos) {
			const parallel = (limit > 1) && !repo.repos && (repo.wait === false);
			const last = batches.length > 0 ? batches[batches.length - 1] : null;

			if (parallel && last && last.parallel && (last.repos.length < limit)) {
				last.repos.push(repo);
				continue;
			}

			batches.push({ parallel: parallel, repos: [repo] });
		}
		return batches;
	}

	_parallelLimit(args) {
		return (args && args.parallel) ? args.parallel : 1;
	}

	async _processRepo(correlationId, args, buildService, buildLog, repo, offset) {
		this._logger.debug('BuildService', '_processRepo', 'repo', repo, correlationId);

		if (repo.repos) {
			const repoName = String.isNullOrEmpty(repo.repo) ? repo.name : repo.repo;

			// 'wait' is only read for a repo, never for the group around it.
			if (LibraryCommonUtility.isNotNull(repo.wait))
				this._info(`'wait' on the group '${repoName}' is ignored; it only applies to a repo.`, offset + 1);

			try {
				this._info(`processing repo '${repoName}'.`, offset + 1);

				const response = await this._processRepos(correlationId, args, buildService, buildLog, repo.repos, offset + 2);
				if (this._hasFailed(response))
					buildLog.failure(repoName, 'Unable to process');

				return response;
			}
			finally {
				this._info(`...processed repo '${repoName}'.`, offset + 1);
			}
		}

		this._logger.debug('BuildService', '_processRepo', 'repo.repo', repo.repo, correlationId);
		if (String.isNullOrEmpty(repo.repo))
			return this._error('BuildService', '_processRepo', `Repo '${!String.isNullOrEmpty(repo.name) ? repo.name : '<unnamed>'}' has an invalid repo name.`, null, null, null, correlationId);

		buildLog.add(repo.repo);
		const response = await this._processExecuteRepo(correlationId, args, buildService, buildLog, LibraryCommonUtility.cloneDeep(repo), offset);
		if (this._hasFailed(response)) {
			buildLog.failure(repo.repo);
			return response;
		}

		buildLog.success(repo.repo);
		return response;
	}

	async _processExecuteRepo(correlationId, args, buildService, buildLog, repo, offset) {
		this._enforceNotNull('BuildService', '_processExecuteRepo', args, 'args', correlationId);
		this._enforceNotNull('BuildService', '_processExecuteRepo', buildService, 'buildService', correlationId);
		this._enforceNotNull('BuildService', '_processExecuteRepo', buildLog, 'buildLog', correlationId);
		this._enforceNotNull('BuildService', '_processExecuteRepo', repo, 'repo', correlationId);

		const repoName = String.isNullOrEmpty(repo.repo) ? repo.name : repo.repo;
		try {
			this._enforceNotNull('BuildService', '_processExecuteRepo', args, 'args', correlationId);
			this._enforceNotNull('BuildService', '_processExecuteRepo', buildService, 'buildService', correlationId);
			this._enforceNotNull('BuildService', '_processExecuteRepo', buildLog, 'buildLog', correlationId);
			this._enforceNotNull('BuildService', '_processExecuteRepo', repo, 'repo', correlationId);
			this._enforceNotEmpty('BuildService', '_processExecuteRepo', repo.repo, 'repo.repo', correlationId);

			this._info('-----------', offset);
			this._info(`processing repo '${repo.repo}'.`, offset);

			repo.pathCwd = path.join(buildLog.pathCwd, 'source');
			this._info(`repo '${repo.repo}' working path: ${repo.pathCwd}`, offset);
			if (!fs.existsSync(repo.pathCwd))
				fs.mkdirSync(repo.pathCwd);

			repo.path = path.join(repo.pathCwd, repo.repo);
			this._info(`repo working '${repo.repo}' path: ${repo.path}`, offset);

			repo.pathPackage = path.join(repo.path, 'package.json');
			this._info(`repo working '${repo.repo}' package path: ${repo.pathPackage}`, offset);

			repo.label = args.label;
			repo.versionIncrement = args.versionIncrement;
			repo.versionUpdate = args.versionUpdate;

			return await buildService.process(LibraryCommonUtility.generateId(), buildLog, repo, offset + 1);
		}
		finally {
			this._info(`...processed repo '${!String.isNullOrEmpty(repoName) ? repoName : '<unknown>'}'.`, offset);
			this._info('-----------\n', offset);
		}
	}
}

class BuildLog {
	constructor(build, args) {
		this.id = LibraryCommonUtility.generateId();

		this.args = args;
		this.name = build.name;
		this.buildType = build.buildType;
		this.repos = build.repos;
		this.repoResults = [];

		this.fileName = `${this.name}_${LibraryMomentUtility.getTimestamp()}.json`;
	}

	add(name) {
		this.repoResults.push({
			name: name
		});
	}

	get(name) {
		return this._find(name);
	}

	failure(name, reason, code) {
		const repo = this._find(name);
		if (!repo)
			return;

		repo.success = false;
		repo.reason = reason;
		repo.code = code;

		this.save();
	}

	save() {
		const dir = 'logs';
		if (!fs.existsSync(dir))
			fs.mkdirSync(dir);

		const temp = LibraryCommonUtility.cloneDeep(this);
		delete temp.pluginsAvailable;
		fs.writeFileSync(path.join(dir, this.fileName), JSON.stringify(temp));
	}

	step(name, action) {
		if (String.isNullOrEmpty(name))
			throw Error(`Missing repo name.`);
		if (String.isNullOrEmpty(action))
			throw Error(`Missing repo action.`);

		const repo = this._find(name);
		if (!repo)
			throw Error(`Invalid repo '${name}'.`);

		if (!repo.steps)
			repo.steps = [];

		repo.steps.push({
			action: action,
			begun: true,
			completed: false
		});

		this.save();
	}

	stepFailure(name, action, dirty, reason, code) {
		return this._step(name, action, false, dirty, reason, code);
	}

	stepSuccess(name, action, dirty) {
		return this._step(name, action, true, dirty);
	}

	success(name) {
		const repo = this._find(name);
		if (!repo)
			return;

		repo.success = true;

		this.save();
	}

	_find(name) {
		if (String.isNullOrEmpty(name))
			return null;
		return this.repoResults.find(l => l.name && l.name.toLowerCase() === name.toLowerCase());
	}

	_step(name, action, success, dirty, reason, code) {
		if (String.isNullOrEmpty(name))
			throw Error(`Missing repo name.`);
		if (String.isNullOrEmpty(action))
			throw Error(`Missing repo action.`);

		const repo = this._find(name);
		if (!repo)
			throw Error(`Invalid repo '${name}'.`);

		const step = repo.steps.find(l => l.action.toLowerCase() === action.toLowerCase());
		if (!step)
			throw Error(`Invalid step '${action}' for '${name}'.`);

		step.completed = success;
		if (LibraryCommonUtility.isNotNull(dirty))
			step.dirty = dirty;
		if (LibraryCommonUtility.isNotNull(reason))
			step.reason = reason;
		if (LibraryCommonUtility.isNotNull(code))
			step.code = code;

		this.save();
	}
}

export default BuildService;
