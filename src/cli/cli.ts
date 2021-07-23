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
import { filterUpdates } from './filter'

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

;(async function main() {
  const argv = yargsParser(process.argv.slice(2), {
    alias: { 'all-commits': ['a'], prerelease: ['p'] },
    boolean: ['all-commits']
  })
  const updates: PackageUpdate[] = []
  try {
    for (const root of await findPackageRoots(argv._)) {
      updates.push(
        await getCurrentUpdate(root, { bumpAllChanges: !!argv.allCommits })
      )
    }
  } catch (error) {
    console.error('Failed reading current package state, no changes applied.')
    console.error(error)
    process.exit(1)
  }

  if (updates.length === 0) {
    console.error(`No packages found in: ${argv._.join(', ')}`)
    process.exit(1)
  }

  const apply = await filterUpdates(updates)
  console.error()
  if (!apply) {
    console.error('Not applying any updates.')
    return
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
    else throw new Error(`Invalid tag: ${tag}`)

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
})()
