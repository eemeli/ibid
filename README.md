# Ibid.

_Once again, as before, but better._

Tools to automate your releases and changelogs.
Ibid is opinionated in its expectations of your repository layout,
but flexible in what it allows you to do with it.

Together with [npm workspaces](https://docs.npmjs.com/cli/v7/using-npm/workspaces),
it offers a minimal but sufficient alternative to [Lerna](https://lerna.js.org/).

```
npm install --save-dev ibid
```

## Usage

Primarily Ibid provides a command-line interface with the following commands:

- `ibid version` — Update the versions & changelogs of packages according to git history.
- `ibid publish` — Publish packages, fixing dependencies before & after as appropriate.
- `ibid depend` — Update dependency style between packages. Used internally by `ibid publish`.

Each command requires an explicit list of directories or glob patterns to find the packages on which it'll be working.
If this is not provided on the command line,
the `"workspaces"` list of your `package.json` is checked,
and for compatibility the `"packages"` of `lerna.json` (if present).
You may use `.` for the current directory:

```sh
npx ibid version .
npx ibid publish foo bar
```

For an up-to-date list of available command-line options, use:

```sh
npx ibid --help
npx ibid version --help
npx ibid publish --help
```

### `ibid version`

This command works with the following assumptions:

- Your project uses git for source code management.
- Your commit messages follow the [Conventional Commits](https://www.conventionalcommits.org/) specification.
- The `"version"` field of your `package.json` is set to the latest published version.
  For a package's first version, use `--init` to include its whole history.
- There is a git tag set for the latest version, by default
  either `v{version}` if the package is at the root of the repo or
  `{name}@{version}` if it's in a subdirectory.

Besides the command-line options,
additional `ibid version` configuration may be included in a config file `ibid.config.{js,mjs,cjs}`,
or one specified by the `--config` option.
This allows for in-depth customization of the changelog output in particular.
See [config.ts](https://github.com/eemeli/ibid/blob/main/src/config/config.ts) for all supported config values.

When run, the command reads through your `git log`,
filtering commits for each project according to its latest release and the files touched by each commit.
Merge commits and any others with messages which do not match the Conventional Commits spec are ignored.
From these commits, the appropriate next version and its changelog are calculated.
An interactive prompt will allow for these version updates to be modified;
use `--yes` to skip this in automation.

On success, for each updated package
its `CHANGELOG.md` is written or updated and
its `package.json` as well as any lockfiles are updated.
Git tags are set as required.

### `ibid version --amend`

If all goes well, the output of `ibid version` is perfect just as it is.
For the cases when it isn't, there's `--amend`.
This is primarily intended for manually fixing the generated changelogs.

After running `ibid version`,
if any changes need to be included in the release,
apply those changes and `git add` them.
Then run:

```sh
npx ibid version --amend
```

This will amend the preceding commit and force-update its git tags as needed.
Note that the `--amend` option must not be used with any other options, including paths.

### `ibid publish`

This command is only really useful if you're working in a monorepo,
with multiple packages included in the same repository.
In such a case, it often makes sense to use `"file:../foo"` paths for your `package.json` `"dependencies"` during development,
as these ensure that internal dependencies work as intended.

For releases from such a repository, the `file:` links need to be fixed for publication.
This is what `ibid publish` does;
it'll find all the local dependencies among your packages and fix them before running `npm publish`,
and then fix them back to local/relative paths afterwards.

### `ibid depend`

Given a set of packages,
ensures that their internal dependencies are all either `--local`, `--exact` or `--latest`.

Useful if e.g. transitioning a monorepo to use relative dependencies,
or to support a custom release pipeline.
