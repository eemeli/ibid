import { Commit, Reference } from '../commits/parse-commit'
import { getParseContext, ParseOptions } from './parse-context'

const CATCH_ALL = /()(.+)/gi
const SCISSOR = '# ------------------------ >8 ------------------------'

const append = (src: unknown, line: string) =>
  src ? String(src) + '\n' + line : line

// Based on trim-off-newlines@1.0.1 by Steve Mao<maochenyan@gmail.com>
// license: MIT
const trimOffNewlines = (str: string) => str.replace(/^(\r?\n)+|(\r?\n)+$/g, '')

function getLines(raw: string) {
  let lines = trimOffNewlines(raw).split(/\r?\n/)
  const scissorIndex = lines.indexOf(SCISSOR)
  if (scissorIndex !== -1) lines = lines.slice(0, scissorIndex)
  return lines.filter(line => !line.match(/^\s*gpg:/))
}

function getReferences(
  input: string,
  references: RegExp,
  referenceParts: RegExp
) {
  const res: Reference[] = []

  const reApplicable = input.match(references) ? references : CATCH_ALL

  for (const [, action, sentence] of input.matchAll(reApplicable)) {
    for (const [raw, _repository, prefix, issue] of sentence.matchAll(
      referenceParts
    )) {
      let owner = null
      let repository = _repository || ''
      const ownerRepo = repository.split('/')
      if (ownerRepo.length > 1) {
        owner = ownerRepo.shift()
        repository = ownerRepo.join('/')
      }
      res.push({
        action: action || null,
        owner,
        repository: repository || null,
        issue,
        raw,
        prefix
      })
    }
  }

  return res
}

export function parseMessage(
  raw: string,
  options: ParseOptions = {}
): Partial<Commit> {
  const { references, referenceParts } = getParseContext(options)

  const commit: Partial<Commit> = {
    body: null,
    footer: null,
    header: null,
    mentions: [],
    merge: null,
    notes: [],
    references: [],
    revert: null,
    scope: null,
    subject: null,
    type: null
  }

  const lines = getLines(raw)
  if (lines.length === 0) return commit

  // parse header
  commit.header = lines.shift()

  const headerPattern = /^(\w*)(?:\((.*)\))?!?: (.*)$/
  const headerMatch = commit.header?.match(headerPattern)
  if (headerMatch) {
    commit.type = headerMatch[1] || null
    commit.scope = headerMatch[2] || null
    commit.subject = headerMatch[3] || null
  }

  commit.references = getReferences(
    commit.header || '',
    references,
    referenceParts
  )

  // parse body & footer
  const body = []
  const footer = []
  const notes: { title: string; text: string }[] = []

  let continueNote = false
  let isBody = true

  for (const line of lines) {
    // this is a new important note
    const notesMatch = line.match(/^[\s|*]*(BREAKING CHANGE)[:\s]+(.*)/i)
    if (notesMatch) {
      continueNote = true
      isBody = false
      footer.push(line)

      const note = {
        title: notesMatch[1],
        text: notesMatch[2]
      }
      notes.push(note)
      continue
    }

    const lineReferences = getReferences(line, references, referenceParts)
    if (lineReferences.length > 0) {
      isBody = false
      continueNote = false
      Array.prototype.push.apply(commit.references, lineReferences)
      footer.push(line)
      continue
    }

    if (continueNote) {
      const lastNote = notes[notes.length - 1]
      lastNote.text = append(lastNote.text, line)
      footer.push(line)
      continue
    }

    if (isBody) body.push(line)
    else footer.push(line)
  }

  if (notes.length === 0) {
    const breakingHeaderPattern = /^(\w*)(?:\((.*)\))?!: (.*)$/
    const breakingHeader = commit.header?.match(breakingHeaderPattern)
    if (breakingHeader) {
      notes.push({
        title: 'BREAKING CHANGE',
        text: breakingHeader[3] // the description of the change.
      })
    }
  }

  if (body.length > 0) commit.body = trimOffNewlines(body.join('\n'))
  if (footer.length > 0) commit.footer = trimOffNewlines(footer.join('\n'))
  for (const note of notes) note.text = trimOffNewlines(note.text)
  commit.notes = notes

  const mentions: string[] = []
  for (const [, mention] of raw.matchAll(/@([\w-]+)/g)) mentions.push(mention)
  commit.mentions = mentions

  // does this commit revert any other commit?
  const revertPattern = /^(?:Revert|revert:)\s(?:""|"?([\s\S]+?)"?)\s*This reverts commit (\w*)\./i
  const revertMatch = raw.match(revertPattern)
  if (revertMatch)
    commit.revert = {
      header: revertMatch[1] || null,
      hash: revertMatch[2] || null
    }

  return commit
}
