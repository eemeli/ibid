import { promises } from 'fs'
import { resolve } from 'path'
import glob from 'tiny-glob'
import { Package } from '../config/context'

// 'fs/promises' is only available from Node.js 14.0.0
const { readFile } = promises

async function readPackage(dir: string, name = 'package.json') {
  const pkgPath = resolve(dir, name)
  try {
    const pkgSrc = await readFile(pkgPath, 'utf8')
    return JSON.parse(pkgSrc) as Package
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
}

export async function findPackageRoots(
  patterns: string[],
  onPackage?: (root: string, pkg: Package) => void
): Promise<Set<string>> {
  const roots = new Set<string>()
  if (patterns.length === 0) {
    const pkg = await readPackage('.')
    if (pkg && Array.isArray(pkg.workspaces)) patterns = pkg.workspaces
    else {
      const lerna = await readPackage('.', 'lerna.json')
      if (lerna && Array.isArray(lerna.packages)) patterns = lerna.packages
    }
  }
  for (const pat of patterns) {
    for (const root of await glob(pat, { absolute: true })) {
      if (roots.has(root)) continue
      const pkg = await readPackage(root)
      if (pkg && pkg.name && pkg.version) {
        roots.add(root)
        if (onPackage) onPackage(root, pkg)
      }
    }
  }
  return roots
}
