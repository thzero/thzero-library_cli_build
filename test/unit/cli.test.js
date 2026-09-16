import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import Cli from '../../boot/cli.js';

import { quiet } from '../helpers.js';

async function run(argv) {
	process.argv = ['node', 'index.js', ...argv];
	const cli = new Cli();
	const { result, out } = await quiet(() => cli.run());
	return { ok: result, args: cli.args || {}, cmd: cli.cmd, out: out.join(' | ') };
}

describe('cli arguments', () => {
	describe('version flags', () => {
		it('defaults to a patch increment', async () => {
			const { ok, args } = await run(['--build', 'default']);
			assert.equal(ok, true);
			assert.equal(args.pi, true);
			assert.equal(args.minorIncrement, undefined);
			assert.equal(args.majorIncrement, undefined);
		});

		// --pi used to be inverted: passing it disabled the increment.
		it('keeps the patch increment on when --pi is passed explicitly', async () => {
			assert.equal((await run(['--build', 'default', '--pi'])).args.pi, true);
		});

		it('disables the patch increment with --no-pi', async () => {
			assert.equal((await run(['--build', 'default', '--no-pi'])).args.pi, false);
		});

		it('accepts --minorIncrement and its --mi alias', async () => {
			assert.equal((await run(['--build', 'default', '--minorIncrement'])).args.minorIncrement, true);
			assert.equal((await run(['--build', 'default', '--mi'])).args.minorIncrement, true);
		});

		it('accepts --majorIncrement and its --mai alias', async () => {
			assert.equal((await run(['--build', 'default', '--majorIncrement'])).args.majorIncrement, true);
			assert.equal((await run(['--build', 'default', '--mai'])).args.majorIncrement, true);
		});

		it('rejects both increments together', async () => {
			const { ok, out } = await run(['--build', 'default', '--mi', '--mai']);
			assert.equal(ok, false);
			assert.match(out, /cannot be combined/);
		});

		it('rejects an increment combined with an explicit version', async () => {
			assert.equal((await run(['--build', 'default', '--mi', '--major', '2'])).ok, false);
			assert.equal((await run(['--build', 'default', '--mai', '--minor', '3'])).ok, false);
		});
	});

	describe('numeric validation', () => {
		// `=== NaN` is never true, so these used to pass validation and produce
		// a version of "NaN.0.0".
		it('rejects a non-numeric major', async () => {
			const { ok, out } = await run(['--build', 'default', '--major', 'abc']);
			assert.equal(ok, false);
			assert.match(out, /major must be a number/);
		});

		it('rejects a non-numeric minor', async () => {
			const { ok, out } = await run(['--build', 'default', '--minor', 'xyz']);
			assert.equal(ok, false);
			assert.match(out, /minor must be a number/);
		});

		it('rejects a non-numeric year', async () => {
			const { ok, out } = await run(['--build', 'default', '--year', 'nope']);
			assert.equal(ok, false);
			assert.match(out, /year must be a number/);
		});

		it('accepts valid numbers', async () => {
			const { ok, args } = await run(['--build', 'default', '--major', '2', '--minor', '5']);
			assert.equal(ok, true);
			assert.equal(args.major, 2);
			assert.equal(args.minor, 5);
		});

		it('accepts a valid year', async () => {
			const year = new Date().getFullYear();
			assert.equal((await run(['--build', 'default', '--year', String(year)])).args.year, year);
		});
	});

	describe('dry run', () => {
		it('is off unless asked for', async () => {
			assert.equal((await run(['--build', 'default'])).args.dryRun, false);
		});

		it('accepts --dryRun and its --dr alias', async () => {
			assert.equal((await run(['--build', 'default', '--dryRun'])).args.dryRun, true);
			assert.equal((await run(['--build', 'default', '--dr'])).args.dryRun, true);
		});
	});

	describe('parallel', () => {
		it('is off unless asked for', async () => {
			assert.equal((await run(['--build', 'default'])).args.parallel, undefined);
		});

		it('defaults to 4 when given no count', async () => {
			assert.equal((await run(['--build', 'default', '--parallel'])).args.parallel, 4);
		});

		it('accepts a count and the --par alias', async () => {
			assert.equal((await run(['--build', 'default', '--parallel', '8'])).args.parallel, 8);
			assert.equal((await run(['--build', 'default', '--par', '2'])).args.parallel, 2);
		});

		it('rejects a count below one or non-numeric', async () => {
			assert.equal((await run(['--build', 'default', '--parallel', '0'])).ok, false);
			assert.equal((await run(['--build', 'default', '--parallel', 'abc'])).ok, false);
		});
	});

	describe('commands', () => {
		it('requires --build', async () => {
			const { ok, out } = await run(['--mi']);
			assert.equal(ok, false);
			assert.match(out, /No --build specified/);
		});

		it('reports help and version as their own commands', async () => {
			assert.equal((await run(['--help'])).cmd, 'help');
			assert.equal((await run(['--version'])).cmd, 'version');
		});

		it('lists the flags in the help output', async () => {
			const { out } = await run(['--help']);
			assert.match(out, /--minorIncrement/);
			assert.match(out, /--majorIncrement/);
			assert.match(out, /--dryRun/);
			assert.match(out, /--filter/);
			assert.match(out, /--parallel/);
		});
	});
});
