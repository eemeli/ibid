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

  const packages: { root: string; package: Package }[] = []
  await findPackageRoots(argv._, (root, pkg) =>
    packages.push({ root, package: pkg })
  )
  if (packages.length === 0)
    throw new InputError(`No packages found in: ${argv._.join(', ')}`)

  const prefix = mode === 'exact' ? '' : '^'
  let updated = 0
  for (const pkg of packages) {
    let write = false
    for (const depsName of ['dependencies', 'optionalDependencies'] as const) {
      const deps = pkg.package[depsName]
      if (!deps) continue
      for (const [name, range] of Object.entries(deps)) {
        const match = packages.find(pkg => pkg.package.name === name)
        if (match) {
          const res =
            mode === 'local'
              ? `file:${relative(pkg.root, match.root)}`
              : prefix + match.package.version
          if (range !== res) {
            deps[name] = res
            write = true
          }
        } else if (mode !== 'local' && range.startsWith('file:')) {
          throw new InputError(
            `Local dependency ${name} (from ${depsName} of ${pkg.package.name}) not found.\n` +
              'You should include all such dependencies in your `depend --public` config.'
          )
        }
      }
    }

    if (write) {
      out.write(
        `Updating ${pkg.package.name} to use ${mode} dependencies ...\n`
      )
      const json = JSON.stringify(pkg.package, null, 2) + '\n'
      await writeFile(resolve(pkg.root, 'package.json'), json)
      updated += 1
    }
  }

  out.write(updated === 0 ? 'No packages to update.\n' : 'Done!\n')
}
