import { promises } from 'fs'
import normalize, { Package } from 'normalize-package-data'
import { resolve } from 'path'

// 'fs/promises' is only available from Node.js 14.0.0
const { readFile } = promises

export interface Config {
  context?: (
    cwd: string,
    pkgData: Package | null
  ) => Package | null | Promise<Package | null>
}

export { Package }

export async function getContext(config: Config, cwd: string) {
  let pkgData: Package | null
  try {
    const path = resolve(cwd, 'package.json')
    const json = JSON.parse(await readFile(path, 'utf8'))
    normalize(json)
    pkgData = json
  } catch (error) {
    if (error instanceof Error && (error as any).code === 'ENOENT')
      pkgData = null
    else throw error
  }
  return config.context ? config.context(cwd, pkgData) : pkgData
}
