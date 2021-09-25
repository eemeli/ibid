import { createPromptModule } from 'inquirer'
import type { Writable } from 'stream'
import yargsParser from 'yargs-parser'
import { InputError } from '../cli-helpers/input-error'
import { findPackageRoots } from '../cli-helpers/package-roots'
import { Package } from '../config/context'
import { npmGetVersions, npmPublish } from '../shell/npm'
import { applyDepend } from './depend'

export async function publish(args: string[], out: Writable): Promise<void> {
  const argv = yargsParser(args, {
    alias: { exact: ['e'], ignorePublished: ['i'], yes: ['y'] },
    boolean: ['exact', 'ignore-published', 'yes'],
    configuration: { 'populate--': true }
  })

  for (const arg of [
    'access',
    'dry-run',
    'otp',
    'registry',
    'reg',
    'tag',
    'workspace',
    'w',
    'workspaces'
  ]) {
    if (argv[arg])
      throw new InputError(
        'Arguments meant for `npm publish` must be separated from ibid options by --'
      )
  }

  const packages = new Map<string, { root: string; package: Package }>()
  await findPackageRoots(argv._, async (root, pkg) => {
    const prev = await npmGetVersions(pkg.name)
    if (prev.includes(pkg.version)) {
      const msg = `${pkg.name}@${pkg.version} has already been published.`
      if (argv.ignorePublished) out.write(msg + '\n')
      else throw new InputError(msg)
    } else packages.set(pkg.name, { root, package: pkg })
  })
  if (packages.size === 0)
    throw new InputError(
      `No unpublished packages found in: ${argv._.join(', ')}`
    )

  if (!argv.yes) {
    if (out !== process.stderr && out !== process.stdout)
      throw new Error(
        'Always use the --yes option if output is not stderr or stdout'
      )

    out.write('Packages to publish:\n\n')
    for (const pkg of packages.values()) {
      const { name, version } = pkg.package
      out.write(`    ${name} @ ${version}\n`)
    }
    out.write('\n')

    const message = 'Publish these packages?'
    const prompt = createPromptModule({ output: out as NodeJS.WriteStream })
    const { publish } = await prompt<{ publish: boolean }>([
      { type: 'confirm', name: 'publish', message, default: true }
    ])
    if (!publish) {
      out.write('Not publishing any packages.\n')
      return
    }
  }

  for (const pkg of packages.values()) {
    const updatedDepend = await applyDepend(
      packages,
      argv.exact ? 'exact' : 'latest',
      pkg.root,
      pkg.package,
      out
    )
    await npmPublish(pkg.root, argv['--'] || [])
    if (updatedDepend)
      await applyDepend(packages, 'local', pkg.root, pkg.package, out)
  }
  out.write('Done!\n')
}
