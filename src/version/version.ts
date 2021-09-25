import { relative } from 'path'
import type { Writable } from 'stream'
import yargsParser from 'yargs-parser'
import { writeChangelog } from '../changelog/write'
import { InputError } from '../cli-helpers/input-error'
import { findPackageRoots } from '../cli-helpers/package-roots'
import type { Config } from '../config/config'
import { loadConfig } from '../config/load-config'
import { getCurrentUpdate, PackageUpdate } from '../index'
import {
  gitAdd,
  gitAddPackageFiles,
  gitCheckTag,
  gitCommit
} from '../shell/git'
import { npmVersion } from '../shell/npm'
import { amendVersion } from './amend-version'
import { filterUpdates } from './filter-updates'

export async function version(args: string[], out: Writable): Promise<void> {
  const argv = yargsParser(args, {
    alias: {
      bumpAllChanges: ['a', 'all-commits'],
      config: ['c'],
      init: ['i'],
      prerelease: ['p'],
      yes: ['y']
    },
    boolean: ['amend', 'init', 'yes'],
    string: ['config']
  })

  if (argv.amend) {
    if (args.length > 1)
      throw new InputError('Do not use other arguments with --amend')
    await amendVersion()
    out.write('Release commit amended and tags moved.\n')
    return
  }

  const config = await loadConfig('.', argv.config, argv)
  const updates: PackageUpdate[] = []
  for (const root of await findPackageRoots(argv._)) {
    updates.push(await getCurrentUpdate(root, config))
  }

  if (updates.length === 0)
    throw new InputError(`No packages found in: ${argv._.join(', ')}`)

  if (!argv.yes) {
    if (out !== process.stderr && out !== process.stdout)
      throw new Error(
        'Always use the --yes option if output is not stderr or stdout'
      )
    const apply = await filterUpdates(updates, out as NodeJS.WriteStream)
    out.write('\n')
    if (!apply) {
      out.write('Not applying any updates.\n')
      return
    }
  }

  let commitFormat: Config['commitFormat']
  const tags: string[] = []
  for (const { context, commits, bump, version } of updates) {
    if (!bump || !version) continue
    const name =
      context.package?.name || relative(process.cwd(), context.cwd || '') || '.'
    out.write(`Updating ${name} to ${version} ...\n`)
    commitFormat ??= context.config.commitFormat

    const tag = context.config.tagFormat(context, version)
    if (await gitCheckTag(tag)) tags.push(tag)
    else throw new InputError(`Invalid tag: ${tag}`)

    const cf = await writeChangelog(
      context,
      argv.init ?? null,
      version,
      commits
    )
    if (cf) await gitAdd(cf)
    else out.write(`No changelog added for ${name}.\n`)

    await npmVersion(context.cwd, version)
    await gitAddPackageFiles(context.cwd)
  }

  if (tags.length === 0) out.write('No packages to update.\n')
  else {
    const msg = commitFormat && commitFormat(tags)
    if (!msg) out.write('Skipping git commit.\n')
    else {
      out.write('Done!\n\n')
      out.write(
        'To amend the generated changelogs, edit and git-add them, then run:\n'
      )
      out.write('    ibid version --amend\n')
      await gitCommit(msg, tags)
    }
  }
}
