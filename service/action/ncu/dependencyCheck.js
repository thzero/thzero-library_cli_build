import ncu from 'npm-check-updates';
import fs from 'fs';

import ActionBuildService from '../index.js';

class NcuDepdencyCheckActionBuildService extends ActionBuildService {
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

		let upgrades = await ncu.run(options);

		this._logger.debug('NcuDepdencyUpdateBuildService', '_process', 'upgrades', upgrades, correlationId);
		const upgraded = (upgrades ? (Object.entries(upgrades).length > 0) : false);
		this._logger.debug('NcuDepdencyUpdateBuildService', '_process', 'upgraded', upgraded, correlationId);

		if (upgraded) {
			this._info(`NPM changes detected.`, offset + 1);
			this._info(JSON.stringify(upgrades, null, 2), offset + 1);
			repo.label = 'npm changes';
			// repo.dirty = true;

			let packageJs = fs.readFileSync(repo.pathPackage, 'utf8');
			packageJs = JSON.parse(packageJs);
			let current;
			for (const [key, value] of Object.entries(upgrades)) {
				try {
					current = packageJs['dependencies'][key];
					upgrades[key] = { current: current, upgrade: value };
				}
				catch (ignore) {
					upgrades[key] = { upgrade: value };
				}
			}
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

	get _prefix() {
		return 'ncu';
	}

	get _step() {
		return 'dependency-check';
	}
}

export default NcuDepdencyCheckActionBuildService;
