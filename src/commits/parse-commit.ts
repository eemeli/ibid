import { Context } from '../config/context'
import { checkRefShape } from './git'

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

export function parseCommit(ctx: Context, src: string): Commit | null {
  const headMatch = src.match(
    /^commit ([0-9a-f]+)(?: \((.*?)\))?\s+(Merge:.*\s+)?Author:\s*(.*?)\s+Date:\s*(\d+)\s+\n/
  )
  if (!headMatch) {
    if (src.trim()) throw new Error(`Malformed git commit:\n${src}`)
    return null
  }
  const [head, hash, refs, merge, author, dateSrc] = headMatch
  if (merge && !ctx.config.includeMerge) return null
  const tags = []
  if (refs)
    for (const ref of refs.split(', ')) {
      if (ref.startsWith('tag: ')) {
        const tag = ref.substring(5)
        checkRefShape(tag)
        tags.push(tag)
      }
    }
  const date = new Date(Number(dateSrc) * 1000)
  const message = src.substring(head.length).replace(/^ {4}/gm, '').trimEnd()
  return { hash, author, date, message, tags }
}
