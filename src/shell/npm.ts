import { execFile as execFileCb } from 'child_process'
import { resolve } from 'path'
import { valid } from 'semver'
import { promisify } from 'util'
import { InputError } from '../cli'

let execFile = promisify(execFileCb)

type NpmExecFile = (
  cmd: 'npm',
  args: string[],
  options?: { cwd: string }
) => Promise<{ stdout: string }>

// Used by tests to mock npm cli
export const setNpmExecFile = (next: NpmExecFile | null): NpmExecFile =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (execFile = next ? (next as any) : promisify(execFileCb))

function checkPkgName(pkgName: string) {
  if (!pkgName || /[^a-z._@/-]/.test(pkgName))
    throw new InputError(`Invalid package name: ${pkgName}`)
}

export async function npmSetVersion(
  dir: string | null,
  version: string
): Promise<void> {
  if (!valid(version)) throw new Error(`Invalid version specifier: ${version}`)
  await execFile(
    'npm',
    ['version', version, '--no-git-tag-version'],
    dir ? { cwd: resolve(dir) } : undefined
  )
}

export async function npmGetVersions(pkgName: string): Promise<string[]> {
  checkPkgName(pkgName)
  try {
    const { stdout } = await execFile('npm', [
      'view',
      pkgName,
      'versions',
      '--json'
    ])
    return JSON.parse(stdout)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (msg.includes('npm ERR! code E404')) return []
    throw error
  }
}

export function npmPublish(
  dir: string | null,
  args: string[]
): ReturnType<typeof execFile> {
  return execFile(
    'npm',
    ['publish', ...args],
    dir ? { cwd: resolve(dir) } : undefined
  )
}
