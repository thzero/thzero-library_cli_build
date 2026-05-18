![GitHub package.json version](https://img.shields.io/github/package-json/v/thzero/thzero-library_cli_build)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

# thzero-library_cli_build

A cli build tool for the opinonated @thzero/library packages.

## CLI

The tool includes a command line interface application that performs builds of the @thzero/library stack.  It has a couple of modes.

* Dependency Check which performs the following on each repo in a build.
  * Checks npm for any dependency updates.
  * If dependency updates
    * Performs an npm install.
    * Increments the package version.
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

## Actions

Each build type is composed of a set of named actions that are executed in sequence for every repo in a build. The following actions are available.

### Git Actions

| Action | Description |
|--------|-------------|
| `clone` | Clones the repository from the remote source into the local working directory using the configured branch (defaults to `dev`). |
| `pull` | Pulls the latest changes from the remote into the local working directory. |
| `status` | Checks the local git status. If any changes are detected the repo is marked as dirty, triggering downstream actions such as version increment and commit. |
| `commit` | Stages all changes, commits with the current label, and pushes to the remote. Only runs when the repo is marked dirty. |

### GitHub Actions

| Action | Description |
|--------|-------------|
| `merge` | Creates a GitHub pull request for the current branch and automatically merges it. If `wait` is set on the repo, the action will poll the GitHub Actions workflow until it completes. |

### NCU (npm-check-updates) Actions

| Action | Description |
|--------|-------------|
| `dependencyCheck` | Checks each repo's `package.json` for available npm dependency upgrades without applying them. Results are passed to any configured plugins (e.g. `dependencyCheckAccumulate`). |
| `dependencyUpdate` | Checks for and applies available npm dependency upgrades to `package.json`, then marks the repo as dirty for subsequent commit. |

### Version Actions

| Action | Description |
|--------|-------------|
| `version` | Increments the package version. Only runs when the repo is marked dirty. |
| `versionAlways` | Increments the package version regardless of whether the repo is dirty. |

### License Actions

| Action | Description |
|--------|-------------|
| `license` | Updates the copyright year range in `license.md` to the current year. Marks the repo as dirty if a change is made. |

### Publish Actions

| Action | Description |
|--------|-------------|
| `publish` | Clones the repo into the `publish/` working directory, fetches publish dependencies, and publishes the package to npm. Only runs when the repo is dirty or `publishOnly` is also active. |
| `publishOnly` | Forces the publish action to run regardless of dirty state. |

## Build Types

A build type defines the ordered set of actions to execute for each repo. The following built-in build types are available and configured in `config/default.json`.

| Type | Actions | Description |
|------|---------|-------------|
| `dependencyCheck` | `clone` → `dependencyCheck` | Clones each repo and checks for available npm dependency updates. No changes are written. |
| `license` | `clone` → `license` → `version` → `commit` → `merge` → `publish` | Updates the copyright year, bumps the version, commits, merges via pull request, and publishes. |
| `publishOnly` | `publishOnly` | Republishes the current package to npm without any git operations or version changes. |
| `pullRequestOnly` | `pull` | Pulls the latest changes from remote for each repo only. |
| `standard` | `clone` → `dependencyUpdate` → `status` → `version` → `commit` → `merge` → `publish` | Full build: updates dependencies, checks status, bumps version if dirty, commits, merges via pull request, and publishes. |
| `versionOnly` | `clone` → `versionAlways` → `commit` → `merge` → `publish` | Bumps the version unconditionally, commits, merges, and publishes. |

Custom build types can be added to the `app.buildTypes` array in configuration by specifying a `tag` and an ordered list of `actions`.

## Configuration

Configuration must be set up.  This involved a couple of steps:

* Specifying the owner of the repos.
  * It is currently assuming that all repos are owned by the same owner.
* Setting the GitHub token.
* Configuring a build configuration.

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
    "builds": [ <array of build label objects> ]
}
```

#### Build Label

Each build label has the following format.

```
{
  "name": "<build label>",
  "type": "<build type tag; default is 'standard'>",
  "repos": [ <array of repo objects> ]
}
```

#### Build Label Repo

Each build label repo has the following format.

```
{
  "repo": "<repo name>",
  "branch": "<branch name; optional, overrides args branch, defaults to 'dev'>",
  "dependencyReject": [ "<package names to exclude from dependency checks; optional>" ],
  "wait": <true/false, whether to wait for the GitHub Actions workflow to complete after a merge; default is false>
}
```