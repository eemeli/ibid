import { execFile as execFileCb } from 'child_process'
import { resolve } from 'path'
import { valid } from 'semver'
import { promisify } from 'util'

const execFile = promisify(execFileCb)

export async function npmVersion(
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
