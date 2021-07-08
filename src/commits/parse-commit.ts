import { Context } from '../config/context'
import { checkRefShape } from './git'
import { CommitMessage } from './commit-message'

export interface Commit {
  hash: string
  merge: string[] | null
  author: string
  date: Date
  tags: string[]
  message: CommitMessage
}

export function parseCommit(src: string, ctx?: Context): Commit  {
  const headMatch = src.match(
    /^commit ([0-9a-f]+)(?: \((.*?)\))?\s+(?:Merge:(.*)\s+)?Author:\s*(.*?)\s+Date:\s*(\d+)\s+\n/
  )
  if (!headMatch) throw new Error(`Malformed git commit:\n${src}`)

  const [head, hash, refs, mergeSrc, author, dateSrc] = headMatch

  const tags = []
  if (refs)
    for (const ref of refs.split(', ')) {
      if (ref.startsWith('tag: ')) {
        const tag = ref.substring(5)
        checkRefShape(tag)
        tags.push(tag)
      }
    }

  const msgSrc = src.substring(head.length).replace(/^ {4}/gm, '').trimEnd()

  return {
    hash,
    merge: mergeSrc ? mergeSrc.split(' ').filter(Boolean) : null,
    author,
    date: new Date(Number(dateSrc) * 1000),
    tags,
    message: new CommitMessage(msgSrc, ctx)
  }
}
