import path from 'path';
import fs from 'fs/promises';

// import spawn from 'await-spawn';
import spawn from 'cross-spawn';

import NpmActionBuildService from './index';

class PublishPackageNpmActionBuildService extends NpmActionBuildService {
	constructor() {
		super();
	}

	async _process(correlationId, buildLog, repo, offset) {
		try {
			this._info(`npm publishing request...`, offset);

			const response = await this._checkVersion(correlationId, repo, repo.pathPublish, offset);
			if (!response || !response.success) {
				this._info(`...npm publishing request failed; version already exists.`, offset);
				return { success: true };
			}

			const content = '//registry.npmjs.org/:_authToken=${NPM_TOKEN}';
			await fs.writeFile(path.join(repo.pathPublish, '.npmrc'), content);

			// await spawn('npm', [
				// 	'publish',
				// 	'.',
				// 	'--access public',
				// 	// '--dry-run'
				// ], 
				// { 
				// 	cwd: repo.pathPublish,
				// 	stdio: 'inherit',
				// 	env: {
				// 		NPM_TOKEN: this._token
				// 	}
				// });
			await new Promise(async (resolve, reject) => {
				const child = spawn('npm', [
					'publish',
					'.',
					'--access public',
					// '--dry-run'
				], 
				{ 
					cwd: repo.pathPublish,
					// stdio: 'inherit',
					env: {
						NPM_TOKEN: this._token
					}
				});

				let stderr = '';
				let stdout = '';
				child.stdout.setEncoding('utf8');
				child.stdout.on('data', (chunk) => {
					stdout += chunk;
				});

				child.stderr.setEncoding('utf8');
				child.stderr.on('data', (chunk) => {
					stderr += chunk;
				});
				child.on('error', reject);
				child.on('close', code => {
					if (code === 0) {
						this._info(`...npm publishing request completed.`, offset);
						return resolve(stdout);
					}

					if (!String.isNullOrEmpty(stderr)) {
						if (stderr.includes('E403')) {
							this._info(`...npm publishing request failed; version already exists.`, offset);
							return resolve(stdout);
						}
					}

					const message = `NPM process exited with code ${code}.`;
					const err = Error(message);
					err.code = code;
					err.stderr = stderr;
					err.stdout = stdout;
					reject(err);
				});
			});

			return { success: true };
		}
		catch (err) {
			this._info(`...npm publishing request failed.`, offset);
			return this._error('PublishPackageNpmActionBuildService', '_process', null, err, null, null, correlationId);
		}
	}

	get _prefix() {
		return 'npm';
	}

	get _step() {
		return 'npm-publish';
	}
}

export default PublishPackageNpmActionBuildService;
