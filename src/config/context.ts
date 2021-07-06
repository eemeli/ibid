import { promises } from 'fs'
import normalize, { Package } from 'normalize-package-data'
import { resolve } from 'path'

// 'fs/promises' is only available from Node.js 14.0.0
const { readFile } = promises

export { Package }

export interface Config {
  context?: (context: Context) => Context | Promise<Context>
  includeMergeCommits?: boolean
  includeRevertedCommits?: boolean
}

export interface Context {
  config: Config
  cwd: string
  getTag(): string
  package: Package | null
}

async function getPackage(cwd: string) {
  try {
    const path = resolve(cwd, 'package.json')
    const pkgData: Package = JSON.parse(await readFile(path, 'utf8'))
    normalize(pkgData)
    return pkgData
  } catch (error) {
    if (error && error.code === 'ENOENT') return null
    else throw error
  }
}

export async function getContext(
  config: Config,
  cwd: string
): Promise<Context> {
  let context: Context = {
    config: Object.assign(
      { includeMergeCommits: false, includeRevertedCommits: false },
      config
    ),
    cwd,
    getTag() {
      if (!context.package)
        throw new Error(
          `For default tag resolution, context must include a valid package`
        )
      const { name, version } = context.package
      return `${name}@${version}`
    },
    package: await getPackage(cwd)
  }
  if (config.context) context = await config.context(context)
  return context
}
