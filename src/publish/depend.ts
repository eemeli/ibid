import { promises } from 'fs'
import { relative, resolve } from 'path'
import { Writable } from 'stream'
import yargsParser from 'yargs-parser'
import { InputError } from '../cli-helpers/input-error'
import { findPackageRoots } from '../cli-helpers/package-roots'
import { Package } from '../config/context'

// 'fs/promises' is only available from Node.js 14.0.0
const { writeFile } = promises

export async function depend(args: string[], out: Writable): Promise<void> {
  const argv = yargsParser(args, { boolean: ['exact', 'latest', 'local'] })

  let mode: 'exact' | 'latest' | 'local' | 'error' | null = null
  if (argv.exact) mode = 'exact'
  if (argv.latest) mode = mode ? 'error' : 'latest'
  if (argv.local) mode = mode ? 'error' : 'local'
  if (mode === null || mode === 'error')
    throw new InputError(
      'Exactly one of --exact, --latest or --local must be set.'
    )

  const packages = new Map<string, { root: string; package: Package }>()
  await findPackageRoots(argv._, (root, pkg) =>
    packages.set(pkg.name, { root, package: pkg })
  )
  if (packages.size === 0)
    throw new InputError(`No packages found in: ${argv._.join(', ')}`)

  let updated = false
  for (const pkg of packages.values()) {
    updated ||= await applyDepend(packages, mode, pkg.root, pkg.package, out)
  }
  out.write(updated ? 'No packages to update.\n' : 'Done!\n')
}

export async function applyDepend(
  packages: Map<string, { root: string; package: Package }>,
  mode: 'exact' | 'latest' | 'local',
  root: string,
  pkg: Package,
  out: Writable
): Promise<boolean> {
  let write = false
  const prefix = mode === 'exact' ? '' : '^'
  for (const depsName of ['dependencies', 'optionalDependencies'] as const) {
    const deps = pkg[depsName]
    if (!deps) continue
    for (const [name, range] of Object.entries(deps)) {
      const match = packages.get(name)
      if (match) {
        const res =
          mode === 'local'
            ? `file:${relative(root, match.root)}`
            : prefix + match.package.version
        if (range !== res) {
          deps[name] = res
          write = true
        }
      } else if (mode !== 'local' && range.startsWith('file:')) {
        throw new InputError(
          `Local dependency ${name} (from ${depsName} of ${pkg.name}) not found.\n` +
            `You should include all such dependencies in your command arguments or workspace config.`
        )
      }
    }
  }

  if (write) {
    out.write(`Updating ${pkg.name} to use ${mode} dependencies ...\n`)
    const json = JSON.stringify(pkg, null, 2) + '\n'
    await writeFile(resolve(root, 'package.json'), json)
  }

  return write
}
