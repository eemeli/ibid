import { promises } from 'fs'
import { fromUrl } from 'hosted-git-info'
import normalize, { Package } from 'normalize-package-data'
import { resolve } from 'path'
import { HostContext, hostData } from './host-data'

// 'fs/promises' is only available from Node.js 14.0.0
const { readFile } = promises

export { HostContext, Package }

export interface Config {
  context?: (context: Context) => Context | Promise<Context>
  hostContext?: Partial<HostContext> | null
  includeMergeCommits?: boolean
  includeRevertedCommits?: boolean
  tag?: (name: string | null, version: string) => string
}

export interface Context {
  config: Required<Config>
  cwd: string | null
  package: Package | null
  get hostContext(): HostContext
  get hostInfo(): {
    type: 'bitbucket' | 'gist' | 'github' | 'gitlab' | null
  } | null
  get tag(): string
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
  config: Config = {},
  cwd: string | null = null
): Promise<Context> {
  const cache: {
    hostContext?: HostContext
    hostInfo?: Context['hostInfo']
  } = {}
  const context: Context = {
    config: Object.assign(
      {
        context: (ctx: Context) => ctx,
        hostContext: null,
        includeMergeCommits: false,
        includeRevertedCommits: false,
        tag: (name: string | null, version: string) => `${name}@${version}`
      },
      config
    ),
    cwd,
    package: typeof cwd === 'string' ? await getPackage(cwd) : null,

    get hostContext() {
      if (cache.hostContext !== undefined) return cache.hostContext
      const type = this.hostInfo?.type ?? '_default'
      return (cache.hostContext = Object.assign(
        {},
        hostData[type] || hostData._default,
        this.config.hostContext
      ))
    },

    get hostInfo() {
      if (cache.hostInfo !== undefined) return cache.hostInfo
      return (cache.hostInfo =
        this.package && this.package.repository
          ? fromUrl(this.package.repository.url) || null
          : null)
    },

    get tag() {
      if (!this.package)
        throw new Error(
          `For default tag resolution, context must include a valid package`
        )
      const { name, version } = this.package
      return this.config.tag(name, version)
    }
  }

  return config.context ? await config.context(context) : context
}
