'use strict'

const CATCH_ALL = /()(.+)/gi
const SCISSOR = '# ------------------------ >8 ------------------------'

const append = (src, line) => (src ? src + '\n' + line : line)

// Based on trim-off-newlines@1.0.1 by Steve Mao<maochenyan@gmail.com>
// license: MIT
const trimOffNewlines = str => str.replace(/^(\r?\n)+|(\r?\n)+$/g, '')

function getLines(raw, commentChar) {
  let lines = trimOffNewlines(raw).split(/\r?\n/)
  const scissorIndex = lines.indexOf(SCISSOR)
  if (scissorIndex !== -1) lines = lines.slice(0, scissorIndex)
  if (commentChar) lines = lines.filter(line => line[0] !== commentChar)
  return lines.filter(line => !line.match(/^\s*gpg:/))
}

function getParts(match, correspondence) {
  const res = {}
  for (let i = 0; i < correspondence.length; ++i) {
    const name = correspondence[i]
    res[name] = match[i + 1] || null
  }
  return res
}

function getReferences(input, references, referenceParts) {
  const res = []

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

function parser(
  raw,
  {
    commentChar,
    fieldPattern,
    mergePattern,
    mergeCorrespondence,
    references,
    referenceParts
  }
) {
  const commit = {
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

  const lines = getLines(raw, commentChar)
  if (lines.length === 0) return commit

  // parse header
  commit.header = lines.shift()
  const mergeMatch = commit.header.match(mergePattern)
  if (mergeMatch && mergePattern) {
    let header = lines.shift()
    while (header !== undefined && !header.trim()) header = lines.shift()
    commit.header = header || ''
    commit.merge = mergeMatch[0]
    Object.assign(commit, getParts(mergeMatch, mergeCorrespondence))
  } else {
    for (const partName of mergeCorrespondence) commit[partName] = null
  }

  const headerPattern = /^(\w*)(?:\((.*)\))?!?: (.*)$/
  const headerMatch = commit.header.match(headerPattern)
  if (headerMatch) {
    commit.type = headerMatch[1] || null
    commit.scope = headerMatch[2] || null
    commit.subject = headerMatch[3] || null
  }

  commit.references = getReferences(commit.header, references, referenceParts)

  // parse body & footer
  const body = []
  const footer = []

  let currentField = null
  let continueNote = false
  let isBody = true

  for (const line of lines) {
    if (fieldPattern) {
      const fieldMatch = fieldPattern.exec(line)
      if (fieldMatch) {
        currentField = fieldMatch[1]
        continue
      }

      if (currentField) {
        commit[currentField] = append(commit[currentField], line)
        continue
      }
    }

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
      commit.notes.push(note)
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
      const lastNote = commit.notes[commit.notes.length - 1]
      lastNote.text = append(lastNote.text, line)
      footer.push(line)
      continue
    }

    if (isBody) body.push(line)
    else footer.push(line)
  }

  if (commit.notes.length === 0) {
    const breakingHeaderPattern = /^(\w*)(?:\((.*)\))?!: (.*)$/
    const breakingHeader = commit.header.match(breakingHeaderPattern)
    if (breakingHeader) {
      commit.notes = [
        {
          title: 'BREAKING CHANGE',
          text: breakingHeader[3] // the description of the change.
        }
      ]
    }
  }

  if (body.length > 0) commit.body = trimOffNewlines(body.join('\n'))
  if (footer.length > 0) commit.footer = trimOffNewlines(footer.join('\n'))
  for (const note of commit.notes) note.text = trimOffNewlines(note.text)

  for (const [, mention] of raw.matchAll(/@([\w-]+)/g))
    commit.mentions.push(mention)

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

module.exports = parser
