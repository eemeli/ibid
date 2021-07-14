import { promises } from 'fs'
import { resolve } from 'path'
import glob from 'tiny-glob'
import yargsParser from 'yargs-parser'

import { getCurrentUpdate, PackageUpdate } from '../index'
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
  for (const root of await findPackageRoots(argv._))
    updates.push(
      await getCurrentUpdate(root, { bumpAllChanges: !!argv.allCommits })
    )
  if (updates.length === 0) {
    console.error(`No packages found in: ${argv._.join(', ')}`)
    process.exit(1)
  }

  const apply = await filterUpdates(updates)
  if (!apply) {
    console.error('Not applying any updates.')
    return
  }

  const bumps = updates.filter(up => up.bump)
  if (bumps.length === 0) {
    console.error(`No packages to update.`)
    return
  }
})()
