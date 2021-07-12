import { promises } from 'fs'
import { resolve } from 'path'
import glob from 'tiny-glob'
import yargsParser from 'yargs-parser'

import { getCurrentUpdate, PackageUpdate } from '../index'

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
    alias: { preset: ['p'] },
    narg: { preset: 1 },
    string: ['preset']
  })
  const updates: PackageUpdate[] = []
  for (const root of await findPackageRoots(argv._))
    updates.push(await getCurrentUpdate(root))
  if (updates.length === 0)
    throw new Error(`No packages found in: ${argv._.join(', ')}`)
  console.dir(
    updates.map(up => ({
      cwd: up.context.cwd,
      name: up.context.package?.name,
      prev: up.context.package?.version,
      bump: up.bump,
      next: up.version,
      cl: up.commits.length
    })),
    { depth: null }
  )
})()
