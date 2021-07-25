import { promises } from 'fs'
import { fromUrl } from 'hosted-git-info'
import normalize from 'normalize-package-data'
import { resolve } from 'path'
import { isGitRoot } from '../shell/git'
import { HostContext, hostData } from './host-data'
import { Config, getBaseConfig, validateConfig } from './config'

// 'fs/promises' is only available from Node.js 14.0.0
const { readFile } = promises

export { HostContext }

export type Dependencies = Record<string, string>

export interface Package {
  name: string
  version: string
  repository?: { type: string; url: string }
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  [key: string]: unknown
}

export interface Context {
  config: Required<Config>
  cwd: string | null
  gitRoot: boolean
  package: Package | null
  get hostContext(): HostContext
  get hostInfo(): {
    browse(): string
    project: string
    type: 'bitbucket' | 'gist' | 'github' | 'gitlab' | null
    user: string
  } | null
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

export async function createContext(
  config?: Config,
  cwd: string | null = null
): Promise<Context> {
  const cache: {
    hostContext?: HostContext
    hostInfo?: Context['hostInfo']
  } = {}
  const context: Context = {
    config: Object.assign(await getBaseConfig(), validateConfig(config, true)),
    cwd,
    gitRoot: await isGitRoot(cwd || ''),
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
    }
  }

  return config?.context ? config.context(context) : context
}
