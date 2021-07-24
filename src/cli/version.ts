import { promises } from 'fs'
import { relative, resolve } from 'path'
import type { Writable } from 'stream'
import glob from 'tiny-glob'
import yargsParser from 'yargs-parser'
import { writeChangelog } from '../changelog/write'
import type { Config } from '../config/config'
import { getCurrentUpdate, PackageUpdate } from '../index'
import {
  gitAdd,
  gitAddPackageFiles,
  gitCheckTag,
  gitCommit
} from '../shell/git'
import { npmVersion } from '../shell/npm'
import { filterUpdates } from './filter-updates'

// 'fs/promises' is only available from Node.js 14.0.0
const { readFile } = promises

async function findPackageRoots(patterns: string[]) {
  const roots = new Set<string>()
  for (const pat of patterns) {
    for (const root of await glob(pat, { absolute: true })) {
      if (roots.has(root)) continue
      const pkgPath = resolve(root, 'package.json')
      try {
        const pkgSrc = await readFile(pkgPath, 'utf8')
        const { name, version } = JSON.parse(pkgSrc)
        if (name && version) roots.add(root)
      } catch (error) {
        if (error.code !== 'ENOENT') throw error
      }
    }
  }
  return roots
}

export class InputError extends Error {}

export async function version(args: string[], out: Writable): Promise<void> {
  const argv = yargsParser(args, {
    alias: { 'all-commits': ['a'], init: ['i'], yes: ['y'] },
    boolean: ['all-commits', 'init', 'yes']
  })
  const updates: PackageUpdate[] = []
  for (const root of await findPackageRoots(argv._)) {
    updates.push(
      await getCurrentUpdate(root, { bumpAllChanges: !!argv.allCommits })
    )
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
      out.write('Done!\n')
      await gitCommit(msg, tags)
    }
  }
}
