import { createPromptModule } from 'inquirer'
import type { Writable } from 'stream'
import { CmdArgs, InputError, findPackageRoots } from '../cli'
import type { Package } from '../config/context'
import { npmGetVersions, npmPublish } from '../shell/npm'
import { applyDepend } from './depend'

export const publishOptions = {
  exact: {
    alias: 'e',
    boolean: true,
    desc: 'Use exact rather than ^ dependencies'
  },
  'ignore-published': {
    alias: 'i',
    boolean: true,
    desc: 'Ignore rather than fail if a package has already been published'
  },
  yes: {
    alias: 'y',
    boolean: true,
    desc: 'Skip interactive verification'
  }
}

export async function publish(args: CmdArgs, out: Writable): Promise<void> {
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
    if (args[arg])
      throw new InputError(
        'Arguments meant for `npm publish` must be separated from ibid options by --'
      )
  }

  const path = args.path || []
  const packages = new Map<string, { root: string; package: Package }>()
  await findPackageRoots(path, async (root, pkg) => {
    const prev = await npmGetVersions(pkg.name)
    if (prev.includes(pkg.version)) {
      const msg = `${pkg.name}@${pkg.version} has already been published.`
      if (args.ignorePublished) out.write(msg + '\n')
      else throw new InputError(msg)
    } else packages.set(pkg.name, { root, package: pkg })
  })
  if (packages.size === 0)
    throw new InputError(`No unpublished packages found in: ${path.join(', ')}`)

  if (!args.yes) {
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
      args.exact ? 'exact' : 'latest',
      pkg.root,
      pkg.package,
      out
    )
    await npmPublish(pkg.root, args['--'] || [])
    if (updatedDepend)
      await applyDepend(packages, 'local', pkg.root, pkg.package, out)
  }
  out.write('Done!\n')
}
