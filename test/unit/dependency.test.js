import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { colorizeDiff, dependencyGroups, groupHeading, partChanged, stripRange } from '../../service/utility/version.js';
import NcuDependencyCheckActionBuildService from '../../service/action/ncu/dependencyCheck.js';
import DependencyCheckAccumulatePluginBuildService from '../../service/plugin/dependencyCheckAccumulate.js';

import { logger } from '../helpers.js';

const RED = '\u001b[31m';
const CYAN = '\u001b[36m';
const GREEN = '\u001b[32m';
const MAGENTA = '\u001b[35m';
const BOLD = '\u001b[1m';
const UNBOLD = '\u001b[22m';
const RESET = '\u001b[39m';

/* eslint-disable no-control-regex -- the ansi escapes are exactly what these match */
const ANSI = /\u001b\[[0-9]+m/;
const ANSI_ALL = /\u001b\[[0-9]+m/g;
/* eslint-enable no-control-regex */

const stripAnsi = (value) => value.replace(ANSI_ALL, '');

// styleText follows the color support of process.stdout, which is not a tty
// under the test runner, so color has to be forced to assert on the escapes.
function withColor(fn) {
	const force = process.env.FORCE_COLOR;
	const none = process.env.NO_COLOR;
	process.env.FORCE_COLOR = '1';
	delete process.env.NO_COLOR;
	try {
		return fn();
	}
	finally {
		if (force === undefined)
			delete process.env.FORCE_COLOR;
		else
			process.env.FORCE_COLOR = force;
		if (none === undefined)
			delete process.env.NO_COLOR;
		else
			process.env.NO_COLOR = none;
	}
}

function service() {
	const instance = new NcuDependencyCheckActionBuildService();
	instance._logger = logger();
	return instance;
}

// The lookup used to read only 'dependencies', so anything ncu reported from
// another section arrived without a current version and printed as 'none'.
describe('dependency check current versions', () => {
	it('resolves a current version from every dependency section', () => {
		const upgrades = service()._mapCurrentVersions(
			{ vue: '^3.5.43', eslint: '^10', vuetify: '^4.2.3', fsevents: '^2.4.0' },
			{
				dependencies: { vue: '^3.5.42' },
				devDependencies: { eslint: '^9' },
				peerDependencies: { vuetify: '^4.2.1' },
				optionalDependencies: { fsevents: '^2.3.3' }
			});

		assert.deepEqual(upgrades, {
			vue: { current: '^3.5.42', upgrade: '^3.5.43' },
			eslint: { current: '^9', upgrade: '^10' },
			vuetify: { current: '^4.2.1', upgrade: '^4.2.3' },
			fsevents: { current: '^2.3.3', upgrade: '^2.4.0' }
		});
	});

	// library_client_vue3_vuetify3 carries vuetify in both sections; the pinned
	// dev range is the useful one, so section order has to win.
	it('prefers the earlier section when a package is listed twice', () => {
		const upgrades = service()._mapCurrentVersions({ vuetify: '^4.2.3' },
			{ devDependencies: { vuetify: '^4.2.1' }, peerDependencies: { vuetify: '^4' } });

		assert.deepEqual(upgrades, { vuetify: { current: '^4.2.1', upgrade: '^4.2.3' } });
	});

	it('omits the current version for a package that is in no section', () => {
		const upgrades = service()._mapCurrentVersions({ bogus: '^1.0.0' },
			{ dependencies: { vue: '^3.5.42' } });

		assert.deepEqual(upgrades, { bogus: { upgrade: '^1.0.0' } });
		assert.ok(!('current' in upgrades.bogus));
	});

	it('skips sections the package file does not have', () => {
		const upgrades = service()._mapCurrentVersions({ eslint: '^10' },
			{ devDependencies: { eslint: '^9' } });

		assert.deepEqual(upgrades, { eslint: { current: '^9', upgrade: '^10' } });
	});

	it('treats a blank version range as no current version', () => {
		const upgrades = service()._mapCurrentVersions({ eslint: '^10' },
			{ devDependencies: { eslint: '' } });

		assert.deepEqual(upgrades, { eslint: { upgrade: '^10' } });
	});

	it('leaves an empty upgrade set alone', () => {
		assert.deepEqual(service()._mapCurrentVersions({}, { dependencies: { vue: '^3.5.42' } }), {});
	});
});

describe('dependency check accumulate output', () => {
	async function render(upgrades) {
		const plugin = new DependencyCheckAccumulatePluginBuildService();
		plugin._logger = logger();
		plugin._outputAccumulator = '';
		plugin._outputAccumulatorPlain = '';
		await plugin._completeItem('correlation', {},
			{ repo: 'library_client_vue3_vuetify3', repo_url: 'https://example.test/repo.git', upgrades: upgrades });
		return { console: plugin._outputAccumulator, plain: plugin._outputAccumulatorPlain };
	}

	it('reports the current version for a dev dependency instead of none', async () => {
		const upgrades = service()._mapCurrentVersions({ vue: '^3.5.43', eslint: '^10' },
			{ dependencies: { vue: '^3.5.42' }, devDependencies: { eslint: '^9' } });

		const output = await render(upgrades);
		assert.ok(stripAnsi(output.console).includes('vue: ^3.5.42 -> ^3.5.43'));
		assert.ok(stripAnsi(output.console).includes('eslint: ^9 -> ^10'));
		assert.ok(!output.console.includes('none'));
	});

	it('still reports none for a package that is not in the package file', async () => {
		const output = await render(service()._mapCurrentVersions({ bogus: '^1.0.0' }, {}));
		assert.ok(stripAnsi(output.console).includes('bogus: none -> ^1.0.0'));
	});

	// the accumulated output is also written to <tag>.txt, which must not pick
	// up the escape codes that the console copy carries
	it('keeps the file copy free of color escapes', async () => {
		const upgrades = service()._mapCurrentVersions({ vue: '^3.5.43' }, { dependencies: { vue: '^3.5.42' } });

		const output = await render(upgrades);
		assert.ok(!ANSI.test(output.plain), 'the file copy should have no escape codes');
		assert.ok(output.plain.includes('vue: ^3.5.42 -> ^3.5.43'));
		assert.equal(stripAnsi(output.console), output.plain);
	});
});

// Mirrors the colorize behavior of the ncu cli: the upgrade stays plain up to
// the first part that changed and is colored from there on.
describe('dependency version colorize', () => {
	it('colors only the patch part, in green', () => {
		assert.equal(withColor(() => colorizeDiff('^18.0.12', '^18.0.14')), '^18.0.' + GREEN + '14' + RESET);
	});

	it('colors the minor and patch parts, in cyan', () => {
		assert.equal(withColor(() => colorizeDiff('^3.5.42', '^3.6.0')), '^3.' + CYAN + '6.0' + RESET);
	});

	it('colors the whole version on a major bump, in red', () => {
		assert.equal(withColor(() => colorizeDiff('^9', '^10')), '^' + RED + '10' + RESET);
		assert.equal(withColor(() => colorizeDiff('^4.2.1', '^5.0.0')), '^' + RED + '5.0.0' + RESET);
	});

	// ncu treats any change to a 0.x version as breaking
	it('colors a version zero change in red no matter which part moved', () => {
		assert.equal(withColor(() => colorizeDiff('^0.19.1', '^0.19.2')), '^0.19.' + RED + '2' + RESET);
	});

	it('leaves the range operator uncolored and compares without it', () => {
		assert.equal(withColor(() => colorizeDiff('<1.2.3', '^1.2.9')), '^1.2.' + GREEN + '9' + RESET);
		assert.equal(withColor(() => colorizeDiff('~5.0.1', '~5.0.3')), '~5.0.' + GREEN + '3' + RESET);
	});

	it('colors the whole version when there is no current version', () => {
		assert.equal(withColor(() => colorizeDiff(null, '^1.0.0')), '^' + RED + '1.0.0' + RESET);
		assert.equal(withColor(() => colorizeDiff(undefined, '^1.0.0')), '^' + RED + '1.0.0' + RESET);
	});

	it('returns the version unchanged when the stream has no color support', () => {
		const none = process.env.NO_COLOR;
		const force = process.env.FORCE_COLOR;
		process.env.NO_COLOR = '1';
		delete process.env.FORCE_COLOR;
		try {
			const result = colorizeDiff('^18.0.12', '^18.0.14');
			assert.equal(result, '^18.0.14');
			assert.ok(!ANSI.test(result));
		}
		finally {
			if (none === undefined)
				delete process.env.NO_COLOR;
			else
				process.env.NO_COLOR = none;
			if (force !== undefined)
				process.env.FORCE_COLOR = force;
		}
	});

	it('strips every range operator it knows about', () => {
		assert.equal(stripRange('^1.2.3'), '1.2.3');
		assert.equal(stripRange('~1.2.3'), '1.2.3');
		assert.equal(stripRange('>=1.2.3'), '1.2.3');
		assert.equal(stripRange('<1.2.3'), '1.2.3');
		assert.equal(stripRange('1.2.3'), '1.2.3');
	});
});

// Mirrors ncu's --format group output: which part moved decides the group, and
// the groups print in ncu's order with its headings.
describe('dependency version groups', () => {
	it('names the part of the version that moved', () => {
		assert.equal(partChanged('^18.0.12', '^18.0.14'), 'patch');
		assert.equal(partChanged('^14.4.0', '^14.5.0'), 'minor');
		assert.equal(partChanged('^9.39.5', '^10.12.0'), 'major');
		assert.equal(partChanged('^0.19.1', '^0.19.2'), 'majorVersionZero');
		assert.equal(partChanged('^1.2.3', '^1.2.3'), 'none');
	});

	it('names the part without being thrown off by the range operator', () => {
		assert.equal(partChanged('<1.2.3', '^1.2.9'), 'patch');
		assert.equal(partChanged('>=1.2.3', '^2.0.0'), 'major');
	});

	it('treats a package with no current version as a major', () => {
		assert.equal(partChanged(null, '^1.0.0'), 'major');
		assert.equal(partChanged(undefined, '^0.1.0'), 'majorVersionZero');
	});

	it('orders the groups the way ncu does, patch then minor then major', () => {
		const groups = dependencyGroups({
			eslint: { current: '^9.39.5', upgrade: '^10.12.0' },
			'@thzero/library_common': { current: '^0.19.1', upgrade: '^0.19.2' },
			'firebase-admin': { current: '^14.4.0', upgrade: '^14.5.0' },
			marked: { current: '^18.0.12', upgrade: '^18.0.14' }
		});

		assert.deepEqual(groups, [
			{ group: 'patch', packages: [ 'marked' ] },
			{ group: 'minor', packages: [ 'firebase-admin' ] },
			{ group: 'major', packages: [ 'eslint' ] },
			{ group: 'majorVersionZero', packages: [ '@thzero/library_common' ] }
		]);
	});

	it('keeps the order the packages arrived in within a group', () => {
		const groups = dependencyGroups({
			pino: { current: '^10.3.1', upgrade: '^10.4.0' },
			axios: { current: '^1.1.0', upgrade: '^1.2.0' }
		});

		assert.deepEqual(groups, [ { group: 'minor', packages: [ 'pino', 'axios' ] } ]);
	});

	it('leaves out anything that did not change', () => {
		assert.deepEqual(dependencyGroups({ vue: { current: '^3.5.42', upgrade: '^3.5.42' } }), []);
		assert.deepEqual(dependencyGroups({}), []);
	});

	it('prints ncu headings, bold label inside the group color', () => {
		assert.equal(withColor(() => groupHeading('minor')), CYAN + BOLD + 'Minor' + UNBOLD + '   Backwards-compatible features' + RESET);
		assert.equal(withColor(() => groupHeading('major')), RED + BOLD + 'Major' + UNBOLD + '   Potentially breaking API changes' + RESET);
		assert.equal(withColor(() => groupHeading('patch')), GREEN + BOLD + 'Patch' + UNBOLD + '   Backwards-compatible bug fixes' + RESET);
		assert.equal(withColor(() => groupHeading('majorVersionZero')),
			MAGENTA + BOLD + 'Major version zero' + UNBOLD + '   Anything may change' + RESET);
	});

	it('gives the same heading text with no escapes when asked for plain', () => {
		assert.equal(groupHeading('minor', true), 'Minor   Backwards-compatible features');
		assert.equal(groupHeading('majorVersionZero', true), 'Major version zero   Anything may change');
		assert.ok(!ANSI.test(withColor(() => groupHeading('major', true))));
	});

	it('falls back to the group name for a group it does not know', () => {
		assert.equal(groupHeading('somethingElse'), 'somethingElse');
	});
});

describe('dependency check accumulate grouping', () => {
	it('nests the packages under their group heading', async () => {
		const upgrades = service()._mapCurrentVersions(
			{ 'firebase-admin': '^14.5.0', eslint: '^10.12.0' },
			{ dependencies: { 'firebase-admin': '^14.4.0' }, devDependencies: { eslint: '^9.39.5' } });

		const plugin = new DependencyCheckAccumulatePluginBuildService();
		plugin._logger = logger();
		plugin._outputAccumulator = '';
		plugin._outputAccumulatorPlain = '';
		await plugin._completeItem('correlation', {},
			{ repo: 'library_server_firebase', repo_url: 'https://example.test/repo.git', upgrades: upgrades });

		assert.deepEqual(plugin._outputAccumulatorPlain.split('\n'), [
			'\tRepo: library_server_firebase',
			'\tRepo Url: https://example.test/repo.git',
			'\t\tMinor   Backwards-compatible features',
			'\t\t\tfirebase-admin: ^14.4.0 -> ^14.5.0 ',
			'\t\tMajor   Potentially breaking API changes',
			'\t\t\teslint: ^9.39.5 -> ^10.12.0 ',
			''
		]);

		// counted regardless of which group they landed in
		assert.deepEqual(plugin._totals, { 'firebase-admin': 1, eslint: 1 });
	});
});
