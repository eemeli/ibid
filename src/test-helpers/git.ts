import { execFile as execFileCb } from 'child_process'
import { promises } from 'fs'
import { EOL, tmpdir } from 'os'
import { join, relative } from 'path'
import { promisify } from 'util'
import { Package } from '../config/context'

// 'fs/promises' is only available from Node.js 14.0.0
const { mkdir, mkdtemp, rm, rmdir, writeFile } = promises
const execFile = promisify(execFileCb)

async function init(name: string) {
  const cwd = await mkdtemp(join(tmpdir(), `${name}-`))
  await execFile('git', ['init'], { cwd })
  return cwd
}

async function firstCommit(cwd: string, tags: string[]) {
  await execFile(
    'git',
    ['commit', '--allow-empty', '--message', 'chore!: First commit'],
    { cwd }
  )
  for (const tag of tags)
    await execFile('git', ['tag', '--message', tag, tag], { cwd })
}

let seed = Math.floor(Math.random() * 1e6)
async function updateFile(
  cwd: string,
  path: string,
  data: string | null,
  message: string | null
) {
  if (!data) {
    data = String(seed + Math.random()) + EOL
    seed += 2
  }
  await writeFile(join(cwd, path), data)
  await execFile('git', ['add', path], { cwd })
  if (message) await execFile('git', ['commit', '--message', message], { cwd })
}

function getPackage(name: string, version: string, url: string | null) {
  const pkg: Package = { name, version }
  if (url) pkg.repository = { type: 'git', url }
  return JSON.stringify(pkg)
}

export async function setupSingle(
  name: string,
  version: string,
  url: string | null,
  bump: 'major' | 'minor' | 'patch'
): Promise<string> {
  const cwd = await init(name)
  const pkg = getPackage(name, version, url)
  await updateFile(cwd, 'package.json', pkg, null)
  await firstCommit(cwd, [`v${version}`])

  await updateFile(cwd, 'a', null, 'chore: Ignore 1')

  await updateFile(cwd, 'a', null, 'fix: Patch 1')
  await updateFile(cwd, 'a', null, 'fix: Patch 2')

  if (bump !== 'patch') {
    await updateFile(cwd, 'a', null, 'feat: Minor 1')
    await updateFile(cwd, 'a', null, 'feat: Minor 2')
  }

  if (bump === 'major') {
    await updateFile(cwd, 'a', null, 'feat!: Major 1')
    await updateFile(cwd, 'a', null, 'fix: Major 2\n\nBREAKING CHANGE: Break')
  }

  await updateFile(cwd, 'a', null, 'chore: Ignore 2')

  return cwd
}

export async function setupMulti(
  packages: {
    name: string
    version: string
    url: string | null
    bump: 'major' | 'minor' | 'patch'
  }[]
): Promise<string> {
  const root = await init('multi')
  await firstCommit(root, [])
  for (const { name, version, url, bump } of packages) {
    const cwd = join(root, name.replace(/^.*[\/\\]/, ''))
    await mkdir(cwd)

    const pkg = getPackage(name, version, url)
    await updateFile(cwd, 'package.json', pkg, 'chore!: Add package')
    await execFile('git', ['tag', `${name}@${version}`], { cwd })

    await updateFile(cwd, 'a', null, 'chore: Ignore 1')

    await updateFile(cwd, 'a', null, 'fix: Patch 1')
    await updateFile(cwd, 'a', null, 'fix: Patch 2')

    if (bump !== 'patch') {
      await updateFile(cwd, 'a', null, 'feat: Minor 1')
      await updateFile(cwd, 'a', null, 'feat: Minor 2')
    }

    if (bump === 'major') {
      await updateFile(cwd, 'a', null, 'feat!: Major 1')
      await updateFile(cwd, 'a', null, 'fix: Major 2\n\nBREAKING CHANGE: Break')
    }

    await updateFile(cwd, 'a', null, 'chore: Ignore 2')
  }

  return root
}

export async function clone(srcDir: string) {
  const cwd = await mkdtemp(join(tmpdir(), 'clone-'))
  await execFile('git', ['clone', srcDir, '.'], { cwd })
  return cwd
}

export async function cleanup(cwd: string) {
  const rel = relative(tmpdir(), cwd)
  if (!rel || rel[0] === '.')
    throw new Error(`Not removing ${cwd} not within tmp dir ${tmpdir()}`)
  // The recursive option was introduced for rmdir() in Node.js 12.10.0 and
  // deprecated in 16.0.0. As rm() was only introduced in 14.14.0, use that
  // when possible but fall back to rmdir().
  await (rm || rmdir)(cwd, { recursive: true })
}
