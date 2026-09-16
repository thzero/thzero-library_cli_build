import fs from 'fs';
import path from 'path';
import minimist from 'minimist';

import LibraryCommonUtility from '@thzero/library_common/utility/index.js';

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
	--dryRun, --dr :: process the build without committing, merging, or publishing anything ::
	--label, --l <label> ::
	--source, --src <path> :: path to the source directory to copy from ::
	--major, --vma <version> :: package major version to use ::
	--majorIncrement, --mai :: increment the package major version, resetting the minor and patch versions to 0 ::
	--minor, --vmi <version> :: package minor version to use, minor default to 0 ::
	--minorIncrement, --mi :: increment the package minor version, resetting the patch version to 0 ::
	--filter, --fi <patterns> :: comma separated repo name patterns limiting the build to matching repos, '*' matches any sequence ::
	--parallel, --par [count] :: run repos marked 'wait': false alongside their siblings, defaults to 4 at a time ::
	--pi :: increment the package patch version, defaults to true, use --no-pi to disable ::
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

				if (LibraryCommonUtility.isNotNull(args.branch) || LibraryCommonUtility.isNotNull(args.r))
					this._args.branch = args.branch || args.r;

				if (LibraryCommonUtility.isNotNull(args.build) || LibraryCommonUtility.isNotNull(args.b))
					this._args.build = args.build || args.b;

				if (LibraryCommonUtility.isNotNull(args.type) || LibraryCommonUtility.isNotNull(args.t))
					this._args.buildType = args.type || args.t;

				if (LibraryCommonUtility.isNotNull(args.working) || LibraryCommonUtility.isNotNull(args.w))
					this._args.working = args.working || args.w;

				if (LibraryCommonUtility.isNotNull(args.source) || LibraryCommonUtility.isNotNull(args.src))
					this._args.source = args.source || args.src;

				if (LibraryCommonUtility.isNotNull(args.label) || LibraryCommonUtility.isNotNull(args.l))
					this._args.label = args.label || args.l;

				if (LibraryCommonUtility.isNotNull(args.major) || LibraryCommonUtility.isNotNull(args.vma)) {
					this._args.major = args.major || args.vma;
					if (!String.isNullOrEmpty(this._args.major)) {
						this._args.major = parseInt(this._args.major);
						if (this._args.major === NaN) {
							console.log('See --help, major must be a number.');
							return false;
						}
						
						const year = new Date().getFullYear();
						if (this._args.major < 1) {
							console.log(`See --help, major must be a number that is greater than 1.`);
							return false;
						}
					}
				}

				if (LibraryCommonUtility.isNotNull(args.minor) || LibraryCommonUtility.isNotNull(args.vmi)) {
					this._args.minor = args.minor || args.vmi;
					if (!String.isNullOrEmpty(this._args.minor)) {
						this._args.minor = parseInt(this._args.minor);
						if (this._args.minor === NaN) {
							console.log('See --help, minor must be a number.');
							return false;
						}
						
						const year = new Date().getFullYear();
						if (this._args.minor < 0) {
							console.log(`See --help, minor must be a number that is greater than 0.`);
							return false;
						}
					}
				}

				if (args.majorIncrement === true || args.mai === true)
					this._args.majorIncrement = true;

				if (args.minorIncrement === true || args.mi === true)
					this._args.minorIncrement = true;

				if (this._args.majorIncrement && this._args.minorIncrement) {
					console.log('See --help, --majorIncrement and --minorIncrement cannot be combined.');
					return false;
				}

				if ((this._args.majorIncrement || this._args.minorIncrement) && (LibraryCommonUtility.isNotNull(this._args.major) || LibraryCommonUtility.isNotNull(this._args.minor))) {
					console.log('See --help, --majorIncrement and --minorIncrement cannot be combined with --major or --minor.');
					return false;
				}

				this._args.dryRun = args.dryRun === true || args.dr === true;

				if (LibraryCommonUtility.isNotNull(args.filter) || LibraryCommonUtility.isNotNull(args.fi)) {
					let filter = args.filter || args.fi;
					if (filter === true) {
						console.log('See --help, filter requires one or more comma separated repo name patterns.');
						return false;
					}

					if (Array.isArray(filter))
						filter = filter.join(',');

					this._args.filter = String(filter).split(',').map(l => l.trim()).filter(l => l.length > 0);
					if (this._args.filter.length === 0) {
						console.log('See --help, filter must be one or more comma separated repo name patterns.');
						return false;
					}
				}

				if (LibraryCommonUtility.isNotNull(args.parallel) || LibraryCommonUtility.isNotNull(args.par)) {
					let parallel = args.parallel || args.par;
					if (parallel === true)
						parallel = 4;

					this._args.parallel = parseInt(parallel);
					if (Number.isNaN(this._args.parallel) || (this._args.parallel < 1)) {
						console.log('See --help, parallel must be a number greater than 0.');
						return false;
					}
				}

				this._args.pi = args.pi !== false;

				if (LibraryCommonUtility.isNotNull(args.year) || LibraryCommonUtility.isNotNull(args.y)) {
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
