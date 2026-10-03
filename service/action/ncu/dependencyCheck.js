import ncu from 'npm-check-updates';
import fs from 'fs';

import ActionBuildService from '../index.js';

class NcuDependencyCheckActionBuildService extends ActionBuildService {
	constructor() {
		super();
	}

	async _process(correlationId, buildLog, repo, offset) {
		const options = {
			upgrade: false,
			jsonUpgraded: false,
			silent: false,
			packageFile: repo.pathPackage
		};

		if (repo.dependencyReject)
			options.reject = repo.dependencyReject;

		let upgrades = await ncu(options);

		this._logger.debug('NcuDependencyCheckActionBuildService', '_process', 'upgrades', upgrades, correlationId);
		const upgraded = (upgrades ? (Object.entries(upgrades).length > 0) : false);
		this._logger.debug('NcuDependencyCheckActionBuildService', '_process', 'upgraded', upgraded, correlationId);

		if (upgraded) {
			this._info(`NPM changes detected.`, offset + 1);
			this._info(JSON.stringify(upgrades, null, 2), offset + 1);
			if (String.isNullOrEmpty(repo.label))
				repo.label = 'npm changes';
			// repo.dirty = true;

			let packageJs = fs.readFileSync(repo.pathPackage, 'utf8');
			packageJs = JSON.parse(packageJs);
			this._mapCurrentVersions(upgrades, packageJs);
		}
		else
			this._info(`No NPM changes detected.`, offset + 1);

		const plugins = this._getPluginsByStep(correlationId, buildLog);
		if (plugins) {
			for (const plugin of plugins) 
				await plugin.process(correlationId, repo, upgrades);
		}

		return this._successResponse(upgraded, correlationId);
	}

	// ncu reports upgrades from every dependency section, so the current version
	// has to be looked up in all of them - reading only 'dependencies' left every
	// dev, peer and optional dependency without a current version, which the
	// accumulate plugin then reported as 'none'.
	_mapCurrentVersions(upgrades, packageJs) {
		const sections = [ 'dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies' ];
		let current;
		for (const [key, value] of Object.entries(upgrades)) {
			current = null;
			for (const section of sections) {
				if (packageJs[section] && packageJs[section][key]) {
					current = packageJs[section][key];
					break;
				}
			}
			upgrades[key] = String.isNullOrEmpty(current) ? { upgrade: value } : { current: current, upgrade: value };
		}
		return upgrades;
	}

	get _prefix() {
		return 'ncu';
	}

	get _step() {
		return 'dependency-check';
	}
}

export default NcuDependencyCheckActionBuildService;
