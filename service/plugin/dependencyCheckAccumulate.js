import PluginBuildService from '.';

class DependencyCheckAccumulatePluginBuildService extends PluginBuildService {
	static TAG = 'dependencyCheckAccumulate';

	constructor() {
		super();
		
		this._total = 0;
		this._totals = {};
		this._totalUpgrades = 0;
	}

	get tag() {
		return DependencyCheckAccumulatePluginBuildService.TAG;
	}

	async _completeAfter(correlationId, buildLog) {
		for (const step of this._steps) {
			this._total++;
			this._totalUpgrades += step.upgrades ? 1 : 0;
		}

		this._output(correlationId, '------------------------');
		this._output(correlationId, `Total:          ${this._total}`);
		this._output(correlationId, `Total Upgrades: ${this._totalUpgrades}`);
		this._output(correlationId, '------------------------');

		this._output(correlationId, 'Total Dependency Counts');

		// this._output(correlationId, JSON.stringify(this._totals, null, 2));
		for (const property in this._totals)
			this._output(correlationId, `\t${property}: ${this._totals[property]}`);

		this._output(correlationId, '\n========================');
		return this._success(correlationId);
	}

	async _completeBefore(correlationId, buildLog) {
		this._total = 0;
		this._totals = {};
		this._totalUpgrades = 0;

		this._output(correlationId, '\n========================');
		this._output(correlationId, 'Dependency Check Results');
		this._output(correlationId, '------------------------');

		return this._success(correlationId);
	}

	async _completeItem(correlationId, buildLog, step) {
		const upgrades = step.upgrades;
		if (!upgrades)
			return this._success(correlationId);

		this._output(correlationId, `\tRepo: ${step.repo}`);
		this._output(correlationId, `\tRepo Url: ${step.repo_url}`);
		// this._output(correlationId, `\tUpgrades Available: ${upgrades}`);
		// this._output(correlationId, JSON.stringify(step.upgrades, null, 2));

		let current;
		for (const property in step.upgrades) {
			current = step.upgrades[property].current;
			this._output(correlationId, `\t\t${property}: ${!String.isNullOrEmpty(current) ? current : 'none'} -> ${step.upgrades[property].upgrade} `);

			if (!this._totals[property])
				this._totals[property] = 0;
			this._totals[property] = this._totals[property] + 1;
		}
		return this._success(correlationId);
	}

	_initializeActions() {
		this._initializeAction('dependency-check');
	}

	async _process(correlationId, repo, step, data) {
		step.upgrades = data;
		return this._success(correlationId);
	}
}

export default DependencyCheckAccumulatePluginBuildService;
