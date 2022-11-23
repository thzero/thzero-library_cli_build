// import spawn from 'await-spawn';
import spawn from 'cross-spawn';

import NpmActionBuildService from './index.js';

class NpmFetchDependencyPublishActionBuildService extends NpmActionBuildService {
	constructor() {
		super();
	}

	async _process(correlationId, buildLog, repo, offset) {
		try {
			this._info(`npm install request...`, offset);

			// await spawn('npm', [
			// 		'i',
			// 		'--production'
			// 	], 
			// 	{ 
			// 		cwd: repo.path,
			// // 		stdio: 'inherit',
			// 		env: {
			// 			NPM_TOKEN: this._token
			// 		}
			// 	});
			await new Promise(async (resolve, reject) => {
				const child = spawn('npm', [
					'install',
					'--production'
				], 
				{ 
					cwd: repo.pathPublish,
					// stdio: 'inherit',
					env: {
						NPM_TOKEN: this._token,
						PATH: process.env.PATH
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
						this._info(`...npm install request completed.`, offset);
						return resolve(stdout);
					}

					if (!String.isNullOrEmpty(stderr)) {
						if (stderr.includes('E403')) {
							this._info(`...npm install request failed; version already exists.`, offset);
							return resolve(stdout);
						}
					}

					const message = `NPM install exited with code ${code}.`;
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
			this._info(`...npm install request failed.`, offset);
			return this._error('NpmFetchDependencyPublishActionBuildService', '_process', null, err, null, null, correlationId);
		}
	}

	get _prefix() {
		return 'npm';
	}

	get _step() {
		return 'fetch-dependency-publish';
	}
}

export default NpmFetchDependencyPublishActionBuildService;
