![GitHub package.json version](https://img.shields.io/github/package-json/v/thzero/library_cli_build)
![David](https://img.shields.io/david/thzero/library_cli_build)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

# library_cli_build

A cli build tool for the opinonated @thzero/library packages.

## CLI

The tool includes a command line interface application that performs builds of the @thzero/library stack.  It has a couple of modes.

* Dependency Check which performs the following on each repo in a build.
  * Checks npm for any dependency updates.
  * If dependency updates
  *   Performs an npm install.
  *   Increments the package version.
  * Checks git status.
  * If changes are detected
    * Submits a commit both local and remote.
    * Creates a new build pull request and automatically merges the request.
* Version Update which performs the following on each repo in a build.
  * Increments the package version.
  * Creates a new build pull request and automatically merges the request.

### Usage

```
library-cli-build <options>

--help, --h :: help

--version, --v :: cli version

--build, --b <build label> :: name of the build specified in the configuration to be processed :: required
--dependencyCheck, --dc :: check and update dependencies, then commit, build, and deploy :: default
--label, --l <label> ::
--versionIncrement, --vi :: increment version update
--versionUpdate, --vu <major.minor.patch> :: update version to the specified version in <major.minor.patch> form
```

#### Help

```
library-cli-build --help
```

#### Version

```
library-cli-build --version
```

##### Build examples

##### Dependency Check

```
library-cli-build --dependencyCheck --build <build label>
```

##### Version Increment

```
library-cli-build --versionIncrement
```

##### Version Update

```
library-cli-build --versionUpdate <major.minor.patch>
```

## Configuration

Configuration must be set up.  This involed a couple of steps

* Specifying the owner of the repos.
  * It is currently assuming that all repos are owned by the same owner.
* Setting the GitHub token.
* Configuration a build configuration.

### Configuration

```
"app": {
		"owner": "<github owner; required>",
		"token": "<github token; required>"
	}
```

#### Build Configuration

In order run a build, the build label must be defined in the configuration.  This determines what repos are to be processed as part of the build, what type of build process to run, and other configuration details.

```
"app": {
		"builds": [ <array of build label objects>
		]
	}
```

#### Build Label

Each build label has the following format.

```
{
  "name": "<build label>",
  "type": "<type label; default is 'Standard'>
  "repos": [ <array of repo objects> ]
}
```

#### Build Label Repo

Each build label repo has the following format.

```
{
  "repo": "<repo name>",
  "wait": <true/false, whether to wait for the an action to be completed; default is false>
}
```