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

--branch, --r <branch> :: name of a branch to be cloned, defaults to 'dev'
--build, --b <build label> :: name of the build specified in the configuration to be processed :: required
--dryRun, --dr :: process the build without committing, merging, or publishing anything ::
--label, --l <label> ::
--source, --src <path> :: path to the source directory to copy from ::
--major, --vma <version> :: package major version to use ::
--majorIncrement, --mai :: increment the package major version, resetting the minor and patch versions to 0 ::
--minor, --vmi <version> :: package minor version to use, minor default to 0 ::
--minorIncrement, --mi :: increment the package minor version, resetting the patch version to 0 ::
--pi :: increment the package patch version, defaults to true, use --no-pi to disable ::
--type, --t <build type tag> :: name of the build type used in processing ::
--year, --y <year> :: year to replace licensing copyright with, should be within +/-1 of current ::
--working, --w :: working path
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
library-cli-build --build <build label> --type dependencyCheck
```

##### Patch Version Increment

Increments the patch version, for example `0.18.16` becomes `0.18.17`.  This is the default when no other version option is specified.

```
library-cli-build --build <build label> --type versionOnly --label "version update"
```

##### Minor Version Increment

Increments the minor version and resets the patch version, for example `0.18.16` becomes `0.19.0`.

```
library-cli-build --build <build label> --type versionOnly --label "minor version update" --minorIncrement
```

##### Major Version Increment

Increments the major version and resets the minor and patch versions, for example `0.18.16` becomes `1.0.0`.

```
library-cli-build --build <build label> --type versionOnly --label "major version update" --majorIncrement
```

##### Explicit Version

Sets the major and/or minor version to a specific value; the patch version is left unchanged.  Cannot be combined with `--majorIncrement` or `--minorIncrement`.

```
library-cli-build --build <build label> --type versionOnly --label "version update" --major 1 --minor 0
```

##### npm Scripts

The same version builds are available as npm scripts against the `default` build.

```
npm run start-version        :: patch version increment
npm run start-version-minor  :: minor version increment
npm run start-version-major  :: major version increment
```

##### Dry Run

Adding `--dryRun` processes the build as normal - clone, dependency update, license, version, and status all run against the throwaway clones under `working/source` - but nothing leaves the machine.  The `commit`, `merge`, and `publish` actions log what they would have done instead of doing it, so the build log shows the full plan.

```
library-cli-build --build <build label> --type versionOnly --label "major version update" --majorIncrement --dryRun
```

The npm scripts take it as a passthrough argument.

```
npm run start-version-major -- --dryRun
```

| Action | Dry run behavior |
|--------|------------------|
| `clean`, `clone`, `pull`, `copy`, `status`, `dependencyCheck`, `dependencyUpdate`, `license`, `version`, `versionAlways` | Run as normal.  These only write to the throwaway clones under `working/source`, which the `clean` action removes on the next run. |
| `commit` | Logs the label and the files that would have been committed.  Nothing is staged, committed, or pushed. |
| `merge` | Logs the pull request that would have been created and merged.  No GitHub API calls are made. |
| `publish` | Logs the `<scope>/<package>@<version>` that would have been published.  No publish clone, no `npm install`, and no `npm publish`. |

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
| `version` | Updates the package version and the version date in `package.json`. Only runs when the repo is marked dirty. The segment that is bumped is determined by the version options described in [Usage](#usage); the patch version is incremented by default. |
| `versionAlways` | The same as `version`, but runs regardless of whether the repo is dirty. |

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