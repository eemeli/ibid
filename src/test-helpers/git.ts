import { execFile as execFileCb } from 'child_process'
import { promises } from 'fs'
import { EOL, tmpdir } from 'os'
import { join, relative } from 'path'
import { promisify } from 'util'

// 'fs/promises' is only available from Node.js 14.0.0
const { mkdtemp, rm, rmdir, writeFile } = promises
const execFile = promisify(execFileCb)

export async function initTmpRepo(name: string): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), `${name}-`))
  await execFile('git', ['init'], { cwd })
  return cwd
}

export async function firstCommit(cwd: string, tags: string[]): Promise<void> {
  await execFile(
    'git',
    ['commit', '--allow-empty', '--message', 'chore!: First commit'],
    { cwd }
  )
  for (const tag of tags)
    await execFile('git', ['tag', '--message', tag, tag], { cwd })
}

let seed = Math.floor(Math.random() * 1e6)
export async function updateFile(
  cwd: string,
  path: string,
  data: string | null,
  message: string | null
): Promise<void> {
  if (!data) {
    data = String(seed + Math.random()) + EOL
    seed += 2
  }
  await writeFile(join(cwd, path), data)
  await execFile('git', ['add', path], { cwd })
  if (message) await execFile('git', ['commit', '--message', message], { cwd })
}

export async function clone(srcDir: string): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'clone-'))
  await execFile('git', ['clone', srcDir, '.'], { cwd })
  return cwd
}

export async function cleanupTmpRepo(cwd: string): Promise<void> {
  const rel = relative(tmpdir(), cwd)
  if (!rel || rel[0] === '.')
    throw new Error(`Not removing ${cwd} not within tmp dir ${tmpdir()}`)
  // The recursive option was introduced for rmdir() in Node.js 12.10.0 and
  // deprecated in 16.0.0. As rm() was only introduced in 14.14.0, use that
  // when possible but fall back to rmdir().
  await (rm || rmdir)(cwd, { recursive: true })
}
