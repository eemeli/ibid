import { promisify } from 'util'
import { execFile as execFileCb } from 'child_process'
const execFile = promisify(execFileCb)

export interface GitLogOptions {
  includeMerge?: boolean
  path?: string
}

export interface Commit {
  hash: string
  author: string
  date: Date
  message: string
  tags: string[]
  revert?: Revert | null

  type?: string
  scope?: null
  subject?: string
  header?: string
  body?: string | null
  footer?: string | null
  notes?: never[]
  references?: never[]
}

export type Revert = Partial<
  {
    [key in keyof Commit]: unknown
  }
>

/** Source: https://git-scm.com/docs/git-check-ref-format */
function checkRef(ref: string | null) {
  // eslint-disable-next-line no-control-regex
  const invalid = /[\x00-\x20:*?[\\\x7f]|\/[/.]|@{|^@$|^[/.]|[/.]$/
  if (ref && invalid.test(ref))
    throw new Error(`Invalid revision specifier: ${ref}`)
}

function parseCommit(
  src: string,
  { includeMerge }: { includeMerge?: boolean }
): Commit | null {
  const headMatch = src.match(
    /^([0-9a-f]+)(?: \((.*?)\))?\s+(Merge:.*\s+)?Author:\s*(.*?)\s+Date:\s*(\d+)\s+\n/
  )
  if (!headMatch) {
    if (src.trim()) throw new Error(`Malformed git commit:\ncommit ${src}`)
    return null
  }
  const [head, hash, refs, merge, author, dateSrc] = headMatch
  if (merge && !includeMerge) return null
  const tags = []
  if (refs)
    for (const ref of refs.split(', ')) {
      if (ref.startsWith('tag: ')) {
        const tag = ref.substring(5)
        checkRef(tag)
        tags.push(tag)
      }
    }
  const date = new Date(Number(dateSrc) * 1000)
  const message = src.substring(head.length).replace(/^ {4}/gm, '').trimEnd()
  return { hash, author, date, message, tags }
}

export async function gitLog(
  from: string | null,
  to: string | null,
  { includeMerge = false, path }: GitLogOptions = {}
): Promise<Commit[]> {
  checkRef(from)
  checkRef(to)
  const args = [
    'log',
    '--date=unix',
    '--decorate=short',
    '--format=medium',
    '--no-color'
  ]
  const range = from ? `${from}..${to || ''}` : to
  if (range) args.push(range)
  if (path) args.push('--', path)
  const { stdout } = await execFile('git', args)
  const commits: Commit[] = []
  for (const src of stdout.split(/^commit /m)) {
    const commit = parseCommit(src, { includeMerge })
    if (commit) commits.push(commit)
  }
  return commits
}
