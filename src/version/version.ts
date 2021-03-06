import { relative } from 'path'
import type { Writable } from 'stream'
import { writeChangelog } from '../changelog/write'
import { CmdArgs, InputError, findPackageRoots } from '../cli'
import type { Config } from '../config/config'
import { loadConfig } from '../config/load-config'
import { getCurrentUpdate, PackageUpdate } from '../index'
import {
  gitAdd,
  gitAddPackageFiles,
  gitCheckTag,
  gitCommit
} from '../shell/git'
import { npmSetVersion } from '../shell/npm'
import { amendVersion } from './amend-version'
import { filterUpdates } from './filter-updates'

export const versionOptions = {
  amend: {
    boolean: true,
    desc: 'Run after a new version to commit changelog fixes & retarget git tags'
  },
  'bump-all-changes': {
    alias: 'a',
    desc: 'Increment version for any changes, even if they are excluded from the changelog.'
  },
  config: {
    alias: 'c',
    desc: 'Load config from a custom path, rather than the default ibid.config.{js,mjs,cjs}',
    string: true
  },
  init: {
    alias: 'i',
    boolean: true,
    desc: 'Explicitly initialise (or not) a changelog file. If unset, init if required. Required for assigning a first version.'
  },
  prerelease: {
    alias: 'p',
    desc: 'If true, use the current or an empty prerelease id. If false, promote a previous prerelease. If a string, use it as the prerelease id.'
  },
  yes: {
    alias: 'y',
    boolean: true,
    desc: 'Skip interactive verification.'
  }
}

export async function version(args: CmdArgs, out: Writable): Promise<void> {
  if (args.amend) {
    if (args.bumpAllChanges || args.config || args.init || args.prerelease)
      throw new InputError('Do not use other arguments with --amend')
    await amendVersion()
    out.write('Release commit amended and tags moved.\n')
    return
  }

  if (out !== process.stderr && out !== process.stdout && !args.yes) {
    throw new Error(
      'Always use the --yes option if output is not stderr or stdout'
    )
  }

  const path = !args.path
    ? []
    : Array.isArray(args.path)
    ? args.path
    : [args.path]
  const cfgArg = args.config ? String(args.config) : null
  const config = await loadConfig('.', cfgArg, args)
  const updates: PackageUpdate[] = []
  for (const root of await findPackageRoots(path)) {
    updates.push(await getCurrentUpdate(root, config))
  }

  if (updates.length === 0)
    throw new InputError(`No packages found in: ${path.join(', ')}`)

  /* istanbul ignore if */
  if (!args.yes) {
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
      typeof args.init === 'boolean' ? args.init : null,
      version,
      commits
    )
    if (cf) await gitAdd(cf)
    else out.write(`No changelog added for ${name}.\n`)

    await npmSetVersion(context.cwd, version)
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
