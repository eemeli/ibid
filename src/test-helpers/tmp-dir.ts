import { promises } from 'fs'
import { tmpdir } from 'os'
import { join, relative } from 'path'

// 'fs/promises' is only available from Node.js 14.0.0
const { mkdtemp, realpath, rm, rmdir } = promises

export async function initTmpDir(name: string): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), `${name}-`))
  return realpath(cwd)
}

export async function cleanupTmpDir(cwd: string): Promise<void> {
  const root = await realpath(tmpdir())
  const rel = relative(root, await realpath(cwd))
  if (!rel || rel[0] === '.')
    throw new Error(`Not removing ${cwd} not within tmp dir ${tmpdir()}`)
  // The recursive option was introduced for rmdir() in Node.js 12.10.0 and
  // deprecated in 16.0.0. As rm() was only introduced in 14.14.0, use that
  // when possible but fall back to rmdir().
  try {
    await(rm || rmdir)(cwd, { recursive: true })
  } catch (error) {
    if (error.code === 'EBUSY') {
      // On Windows, the current directory is locked and cannot be removed.
      // So let's try to move elsewhere and try again.
      process.chdir(root)
      await(rm || rmdir)(cwd, { recursive: true })
    }
  }
}
