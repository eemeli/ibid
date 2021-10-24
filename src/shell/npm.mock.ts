import assert from 'assert'
import { promises } from 'fs'
import { resolve } from 'path'
import { setNpmExecFile } from './npm'

// 'fs/promises' is only available from Node.js 14.0.0
const { readFile, writeFile } = promises

const readPackage = async (cwd: string) =>
  JSON.parse(await readFile(resolve(cwd, 'package.json'), 'utf8'))

const writePackage = (cwd: string, data: unknown) =>
  writeFile(resolve(cwd, 'package.json'), JSON.stringify(data))

/** Mapping from package name to relevant registry data */
export type MockNpmRegistry = Record<
  string,
  { tags: Record<string, string>; versions: string[] }
>

export function mockNpm(reg: MockNpmRegistry): void {
  setNpmExecFile(async (npm, [cmd, ...args], options) => {
    if (npm !== 'npm') throw new Error(`Invalid npm command: ${npm}`)
    const cwd = resolve(options?.cwd || '')
    let stdout = '\n'
    switch (cmd) {
      case 'version': {
        assert(args.length === 2)
        assert(args[0])
        assert(args[1] === '--no-git-tag-version')
        const pkgData = await readPackage(cwd)
        pkgData.version = args[0]
        await writePackage(cwd, pkgData)
        break
      }
      case 'view':
        assert(args.length === 3)
        assert(args[0])
        assert(args[1] === 'versions')
        assert(args[2] === '--json')
        stdout = JSON.stringify(reg[args[0]].versions) + '\n'
        break
      case 'publish': {
        const { name, version } = await readPackage(cwd)
        let tag = 'latest'
        const optIdx = args.indexOf('--tag')
        if (optIdx !== -1) tag = args[optIdx + 1]
        reg[name].versions.push(version)
        reg[name].tags[tag] = version
        break
      }
    }
    return { stdout }
  })
}
