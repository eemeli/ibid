import { execFile as execFileCb } from 'child_process'
import { resolve } from 'path'
import { promisify } from 'util'

const execFile = promisify(execFileCb)

export async function gitAbbrevLength(): Promise<number> {
  const { stdout } = await execFile('git', ['rev-parse', '--short', 'HEAD'])
  return stdout.trim().length || 7
}

/** Source: https://git-scm.com/docs/git-check-ref-format */
// eslint-disable-next-line no-control-regex
const invalidGitRef = /[\x00-\x20:*?[\\\x7f]|\/[/.]|@{|^@$|^[/.]|[/.]$/

export function checkRefShape(ref: string | null): void {
  if (ref && invalidGitRef.test(ref))
    throw new Error(`Invalid revision specifier: ${ref}`)
}

export async function gitRefExists(ref: string): Promise<boolean> {
  if (!ref || invalidGitRef.test(ref)) return false
  return execFile('git', ['rev-parse', '--verify', ref])
    .then(() => true)
    .catch(() => false)
}

export async function isGitRoot(path: string): Promise<boolean> {
  try {
    const { stdout } = await execFile('git', ['rev-parse', '--show-toplevel'])
    return stdout.trim() === resolve(path)
  } catch (_) {
    return false
  }
}

export async function gitLog(
  from: string | null,
  to: string | null,
  path?: string | null
): Promise<string[]> {
  checkRefShape(from)
  checkRefShape(to)
  const args = [
    'log',
    '--date=unix',
    '--decorate=short',
    '--format=medium',
    '--no-color',
    '--no-show-signature'
  ]
  const range = from ? `${from}..${to || ''}` : to
  if (range) args.push(range)
  if (path) args.push('--', path)
  const { stdout } = await execFile('git', args)
  return stdout ? stdout.split(/^(?=commit )/m) : []
}

export async function gitAdd(path: string): Promise<void> {
  await execFile('git', ['add', '--', path])
}

export async function gitAddPackageFiles(dir: string | null): Promise<void> {
  const cwd = resolve(dir || '')
  const args = ['add', '--update']
  for (const file of [
    'package.json',
    'package-lock.json',
    'npm-shrinkwrap.json'
  ]) {
    try {
      await execFile('git', ['ls-files', '--error-unmatch', file], { cwd })
      args.push(file)
    } catch (_) {
      // Ignore files not in repo
    }
  }
  await execFile('git', args, { cwd })
}

export async function gitCheckTag(tag: string): Promise<boolean> {
  if (!tag || tag.startsWith('-')) return false
  try {
    await execFile('git', ['check-ref-format', `tags/${tag}`])
    return true
  } catch (_) {
    return false
  }
}

export async function gitCommit(
  message: string,
  tags: string[]
): Promise<void> {
  await execFile('git', ['commit', '--message', message])
  for (const tag of tags) await execFile('git', ['tag', '--message', tag, tag])
}
