import '@thzero/library_common/utility/string.js';

import fs from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';

import Response from '@thzero/library_common/response/index.js';

export { Response };

// Services resolve their logger through the injector; tests drive the private
// _process methods directly, so a collecting stub is enough.
export function logger() {
	const lines = [];
	const noop = () => {};
	return {
		lines: lines,
		info2: (message) => lines.push(String(message)),
		debug: noop,
		error: noop,
		exception: noop,
		has: (fragment) => lines.some(l => l.includes(fragment))
	};
}

export function tempDir(prefix) {
	return fs.mkdtempSync(path.join(os.tmpdir(), prefix + '-')).split(path.sep).join('/');
}

export function gitRepo(dir, branch) {
	fs.mkdirSync(dir, { recursive: true });
	execSync(`git init -q -b ${branch || 'dev'}`, { cwd: dir, shell: true });
	execSync('git config user.email test@example.com', { cwd: dir, shell: true });
	execSync('git config user.name test', { cwd: dir, shell: true });
	fs.writeFileSync(path.join(dir, 'marker.txt'), 'initial');
	execSync('git add . && git commit -q -m initial', { cwd: dir, shell: true });
	return dir;
}

export function gitCommitCount(dir) {
	return Number(execSync('git rev-list --count HEAD', { cwd: dir }).toString().trim());
}

export function gitBranch(dir) {
	return execSync('git branch --show-current', { cwd: dir }).toString().trim();
}

export function writePackage(dir, version) {
	const parts = version.split('.').map(Number);
	const filePath = path.join(dir, 'package.json');
	fs.writeFileSync(filePath, JSON.stringify({
		name: '@thzero/fixture',
		version: version,
		version_major: parts[0],
		version_minor: parts[1],
		version_patch: parts[2],
		version_date: '01/01/2020'
	}, null, 2));
	return filePath;
}

export function readPackage(filePath) {
	return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// Mirrors the step bookkeeping of BuildLog in service/build.js, including its
// throw when a step is completed under a name that was never started - that
// throw is what made a version failure surface as 'Invalid step'.
export class BuildLogStub {
	constructor(args) {
		this.args = args || {};
		this.started = [];
		this.recorded = [];
	}

	step(name, action) {
		this.started.push(action);
		this.recorded.push('step:' + action);
	}

	stepFailure(name, action) {
		this._complete(name, action, false);
	}

	stepSuccess(name, action) {
		this._complete(name, action, true);
	}

	_complete(name, action, success) {
		if (!this.started.some(l => l.toLowerCase() === action.toLowerCase()))
			throw Error(`Invalid step '${action}' for '${name}'.`);
		this.recorded.push((success ? 'ok:' : 'fail:') + action);
	}
}

// Runs fn with console.log and console.error silenced, returning what was logged.
export async function quiet(fn) {
	const out = [];
	const origLog = console.log;
	const origError = console.error;
	console.log = (...args) => out.push(args.join(' '));
	console.error = (...args) => out.push(args.join(' '));
	try {
		const result = await fn();
		return { result: result, out: out };
	}
	finally {
		console.log = origLog;
		console.error = origError;
	}
}
