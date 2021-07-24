import { promises } from 'fs'
import { relative, resolve } from 'path'
import glob from 'tiny-glob'
import yargsParser from 'yargs-parser'
import { writeChangelog } from '../changelog/write'
import { Config } from '../config/config'
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

export async function version(args: string[]): Promise<void> {
  const argv = yargsParser(args, {
    alias: { 'all-commits': ['a'], prerelease: ['p'], yes: ['y'] },
    boolean: ['all-commits', 'yes']
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
    const apply = await filterUpdates(updates)
    console.error()
    if (!apply) {
      console.error('Not applying any updates.')
      return
    }
  }

  let commitFormat: Config['commitFormat']
  const tags: string[] = []
  for (const { context, commits, bump, version } of updates) {
    if (!bump || !version) continue
    const name =
      context.package?.name || relative(process.cwd(), context.cwd || '') || '.'
    console.error(`Updating ${name} to ${version} ...`)
    commitFormat ??= context.config.commitFormat

    const tag = context.config.tagFormat(context, version)
    if (await gitCheckTag(tag)) tags.push(tag)
    else throw new InputError(`Invalid tag: ${tag}`)

    const cf = await writeChangelog(context, false, version, commits)
    if (cf) await gitAdd(cf)
    else console.error(`No changelog added for ${name}.`)

    await npmVersion(context.cwd, version)
    await gitAddPackageFiles(context.cwd)
  }

  if (tags.length === 0) console.error('No packages to update.')
  else {
    const msg = commitFormat && commitFormat(tags)
    if (!msg) console.error('Skipping git commit.')
    else {
      console.error('Done!')
      await gitCommit(msg, tags)
    }
  }
}
