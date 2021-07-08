import { promisify } from 'util'
import { execFile as execFileCb } from 'child_process'
export const execFile = promisify(execFileCb)

/** Source: https://git-scm.com/docs/git-check-ref-format */
// eslint-disable-next-line no-control-regex
const invalidGitRef = /[\x00-\x20:*?[\\\x7f]|\/[/.]|@{|^@$|^[/.]|[/.]$/

export function checkRefShape(ref: string | null): void {
  if (ref && invalidGitRef.test(ref))
    throw new Error(`Invalid revision specifier: ${ref}`)
}

export async function gitRefExists(ref: string): Promise<boolean> {
  if (!ref || invalidGitRef.test(ref)) return false
  return execFile('git', ['rev-parse', ref])
    .then(() => true)
    .catch(() => false)
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
  return stdout.split(/^(?=commit )/m)
}
