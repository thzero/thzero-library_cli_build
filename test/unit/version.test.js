import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import VersionActionBuildService from '../../service/action/version.js';

import { logger, tempDir, writePackage, readPackage, Response } from '../helpers.js';

async function bump(from, args) {
	const dir = tempDir('version');
	const pathPackage = writePackage(dir, from);

	const service = new VersionActionBuildService();
	service._logger = logger();

	const repo = { repo: 'fixture', pathPackage: pathPackage };
	const response = await service._process('correlation', { args: args }, repo, 0);

	return { response: response, repo: repo, packageJson: readPackage(pathPackage) };
}

describe('version action', () => {
	it('increments the patch version by default', async () => {
		assert.equal((await bump('0.18.16', { pi: true })).packageJson.version, '0.18.17');
	});

	it('increments the minor version and resets the patch', async () => {
		assert.equal((await bump('0.18.16', { pi: true, minorIncrement: true })).packageJson.version, '0.19.0');
	});

	it('increments the major version and resets the minor and patch', async () => {
		assert.equal((await bump('0.18.16', { pi: true, majorIncrement: true })).packageJson.version, '1.0.0');
	});

	it('rolls the minor version over into the next ten', async () => {
		assert.equal((await bump('0.19.3', { pi: true, minorIncrement: true })).packageJson.version, '0.20.0');
	});

	it('increments a major version that is already past 1', async () => {
		assert.equal((await bump('1.7.9', { pi: true, majorIncrement: true })).packageJson.version, '2.0.0');
	});

	it('leaves the version alone when the patch increment is disabled', async () => {
		assert.equal((await bump('0.18.16', { pi: false })).packageJson.version, '0.18.16');
	});

	it('applies an explicit major and minor, leaving the patch as is', async () => {
		assert.equal((await bump('0.18.16', { pi: true, major: 2, minor: 5 })).packageJson.version, '2.5.16');
	});

	// The upstream updateVersion guarded with `if (!args.minor)`, so an explicit
	// zero fell back to whatever was already in package.json.
	it('honours an explicit zero', async () => {
		assert.equal((await bump('0.18.16', { pi: true, minor: 0 })).packageJson.version, '0.0.16');
	});

	it('writes the segments back as numbers, not strings', async () => {
		const { packageJson } = await bump('0.18.16', { pi: true, majorIncrement: true });
		assert.deepEqual(
			[packageJson.version_major, packageJson.version_minor, packageJson.version_patch],
			[1, 0, 0]);
	});

	it('stamps the version date as MM/DD/YYYY', async () => {
		const { packageJson } = await bump('0.18.16', { pi: true });
		assert.match(packageJson.version_date, /^\d{2}\/\d{2}\/\d{4}$/);
		assert.notEqual(packageJson.version_date, '01/01/2020');
	});

	it('marks the repo dirty and reports both versions', async () => {
		const { response, repo } = await bump('0.18.16', { pi: true, minorIncrement: true });
		assert.ok(Response.hasSucceeded(response));
		assert.equal(repo.dirty, true);
		assert.match(response.results.message, /0\.18\.16.*0\.19\.0/);
	});

	it('treats absent arguments as no change', async () => {
		assert.equal((await bump('0.18.16', {})).packageJson.version, '0.18.16');
	});
});
