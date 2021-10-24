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

  if (out !== process.stderr && out !== process.stdout && !args.yes)
    throw new Error(
      'Always use the --yes option if output is not stderr or stdout'
    )

  const path = !args.path
    ? []
    : Array.isArray(args.path)
    ? args.path
    : [args.path]
  const packages = new Map<
    string,
    { root: string; package: Package; publish: boolean }
  >()
  let publishNone = true
  await findPackageRoots(path, async (root, pkg) => {
    const prev = await npmGetVersions(pkg.name)
    let publish = true
    if (prev.includes(pkg.version)) {
      const msg = `${pkg.name}@${pkg.version} has already been published.`
      if (!args.ignorePublished) throw new InputError(msg)
      out.write(msg + '\n')
      publish = false
    } else publishNone = false
    packages.set(pkg.name, { root, package: pkg, publish })
  })
  if (publishNone)
    throw new InputError(`No unpublished packages found in: ${path.join(', ')}`)

  /* istanbul ignore if */
  if (!args.yes) {
    out.write('Packages to publish:\n\n')
    for (const pkg of packages.values()) {
      if (!pkg.publish) continue
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
    if (!pkg.publish) continue
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
