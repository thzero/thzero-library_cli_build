import fs from 'fs';
import path from 'path';
import minimist from 'minimist';

class Cli {
	run() {
		const args = minimist(process.argv.slice(2));
		this._determineCommand(args);
		return this._processCommand(args);
	}

	get args() {
		return this._args;
	}

	_determineCommand(args) {
		this._cmd = 'build';

		if (args.version || args.v)
			this._cmd = 'version';

		if (args.help || args.h)
			this._cmd = 'help';
	}

	_menu() {
		const menus = {
			default: `
library-cli-build <options>

	--help, --h :: help

	--version, --v :: cli version

	--branch, --r <branch> :: name of a branch to be cloned, defaults to 'dev'
	--build, --b <build label> :: name of the build to be processed :: required
	--label, --l <label> ::
	--type, --t <build type tag> :: name of the build type used in processing ::
	--year, --y <year> :: year to replace licensing copyright with, should be within +/-1 of current ::
	--working, --w :: working path`,
		};

		return menus;
	}

	_processCommand(args) {
		switch (this._cmd) {
			case 'build':
				console.log('build');

				this._args = {
					dependencyCheck: true
				};

				if ((args.branch !== null && args.branch !== undefined) || (args.r !== null && args.r !== undefined))
					this._args.branch = args.branch || args.r;

				if ((args.build !== null && args.build !== undefined) || (args.b !== null && args.b !== undefined))
					this._args.build = args.build || args.b;

				if ((args.type !== null && args.type !== undefined) || (args.t !== null && args.t !== undefined))
					this._args.type = args.type || args.t;

				if ((args.working !== null && args.working !== undefined) || (args.w !== null && args.w !== undefined))
					this._args.working = args.working || args.w;

				if ((args.label !== null && args.label !== undefined) || (args.l !== null && args.l !== undefined))
					this._args.label = args.label || args.l;

				if ((args.year !== null && args.year !== undefined) || (args.y !== null && args.y !== undefined)) {
					this._args.year = args.year || args.y;
					if (!String.isNullOrEmpty(this._args.year)) {
						this._args.year = parseInt(this._args.year);
						if (this._args.year === NaN) {
							console.log('See --help, year must be a number.');
							return false;
						}
						
						const year = new Date().getFullYear();
						if (this._args.year < year - 1 || this._args.year > year + 1) {
							console.log(`See --help, year must be a number between ${year - 1} and ${year + 1}.`);
							return false;
						}
					}
				}

				// console.log(this._args);
				if (String.isNullOrEmpty(this._args.build)) {
					console.log('No --build specified, see --help.');
					return false;
				}

				return true;

			case 'help':
				console.log(this._menu().default);
				return  false;

			case 'version':
				console.log(this._version());
				return  false;
		}

		console.error(`"${cmd}" is not a valid command!`)
		return  false;
	}

	_version() {
		const filePath = path.join(process.cwd(), 'package.json');
		const file = fs.readFileSync(filePath, 'utf8');
		if (String.isNullOrEmpty(file))
			throw Error('Invalid package.json file for versioning; expected in the <app root> folder.');

		const packageObj = JSON.parse(file);
		if (!packageObj)
			throw Error('Invalid package.json file for versioning.');

		return `
library-cli-build version '${packageObj.version}'`;
	}
}

export default Cli;
