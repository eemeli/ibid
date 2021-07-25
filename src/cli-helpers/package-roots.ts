import { promises } from 'fs'
import { resolve } from 'path'
import glob from 'tiny-glob'
import { Package } from '../config/context'

// 'fs/promises' is only available from Node.js 14.0.0
const { readFile } = promises

export async function findPackageRoots(
  patterns: string[],
  onPackage?: (root: string, pkg: Package) => void
): Promise<Set<string>> {
  const roots = new Set<string>()
  for (const pat of patterns) {
    for (const root of await glob(pat, { absolute: true })) {
      if (roots.has(root)) continue
      const pkgPath = resolve(root, 'package.json')
      try {
        const pkgSrc = await readFile(pkgPath, 'utf8')
        const pkg = JSON.parse(pkgSrc)
        if (pkg.name && pkg.version) {
          roots.add(root)
          if (onPackage) onPackage(root, pkg)
        }
      } catch (error) {
        if (error.code !== 'ENOENT') throw error
      }
    }
  }
  return roots
}
