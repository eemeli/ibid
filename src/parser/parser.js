'use strict'
const trimOffNewlines = require('trim-off-newlines')

const CATCH_ALL = /()(.+)/gi
const SCISSOR = '# ------------------------ >8 ------------------------'

const append = (src, line) => (src ? src + '\n' + line : line)

const getCommentFilter = commentChar =>
  commentChar ? line => line[0] !== commentChar : () => true

function truncateToScissor(lines) {
  const scissorIndex = lines.indexOf(SCISSOR)
  return scissorIndex === -1 ? lines : lines.slice(0, scissorIndex)
}

function getReferences(input, regex) {
  const references = []

  const reApplicable =
    input.match(regex.references) !== null ? regex.references : CATCH_ALL

  let referenceSentences
  while ((referenceSentences = reApplicable.exec(input))) {
    const action = referenceSentences[1] || null
    const sentence = referenceSentences[2]

    let referenceMatch
    while ((referenceMatch = regex.referenceParts.exec(sentence))) {
      let owner = null
      let repository = referenceMatch[1] || ''
      const ownerRepo = repository.split('/')

      if (ownerRepo.length > 1) {
        owner = ownerRepo.shift()
        repository = ownerRepo.join('/')
      }

      const reference = {
        action,
        owner,
        repository: repository || null,
        issue: referenceMatch[3],
        raw: referenceMatch[0],
        prefix: referenceMatch[2]
      }

      references.push(reference)
    }
  }

  return references
}

function parser(
  raw,
  {
    breakingHeaderPattern,
    commentChar,
    headerPattern,
    headerCorrespondence,
    fieldPattern,
    revertPattern,
    revertCorrespondence,
    mergePattern,
    mergeCorrespondence
  },
  regex
) {
  let currentProcessedField
  const otherFields = {}
  const commentFilter = getCommentFilter(commentChar)
  const gpgFilter = line => !line.match(/^\s*gpg:/)

  const rawLines = trimOffNewlines(raw).split(/\r?\n/)
  const lines = truncateToScissor(rawLines)
    .filter(commentFilter)
    .filter(gpgFilter)

  if (lines.length === 0) {
    return {
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
  }

  let header = null
  let merge = lines.shift()

  // msg parts
  const mergeParts = {}
  const mergeMatch = merge.match(mergePattern)
  if (mergeMatch && mergePattern) {
    merge = mergeMatch[0]

    header = lines.shift()
    while (header !== undefined && !header.trim()) {
      header = lines.shift()
    }
    if (!header) header = ''

    for (let i = 0; i < mergeCorrespondence.length; ++i) {
      const partName = mergeCorrespondence[i]
      mergeParts[partName] = mergeMatch[i + 1] || null
    }
  } else {
    header = merge
    merge = null

    for (let i = 0; i < mergeCorrespondence.length; ++i) {
      const partName = mergeCorrespondence[i]
      mergeParts[partName] = null
    }
  }

  const headerParts = {}
  const headerMatch = header.match(headerPattern)
  for (let i = 0; i < headerCorrespondence.length; ++i) {
    const partName = headerCorrespondence[i]
    headerParts[partName] = (headerMatch && headerMatch[i + 1]) || null
  }

  const references = getReferences(header, regex)

  // body or footer
  const body = []
  const footer = []
  const notes = []

  let continueNote = false
  let isBody = true

  lines.forEach(line => {
    if (fieldPattern) {
      const fieldMatch = fieldPattern.exec(line)

      if (fieldMatch) {
        currentProcessedField = fieldMatch[1]

        return
      }

      if (currentProcessedField) {
        otherFields[currentProcessedField] = append(
          otherFields[currentProcessedField],
          line
        )

        return
      }
    }

    let referenceMatched

    // this is a new important note
    const notesMatch = line.match(regex.notes)
    if (notesMatch) {
      continueNote = true
      isBody = false
      footer.push(line)

      const note = {
        title: notesMatch[1],
        text: notesMatch[2]
      }
      notes.push(note)
      return
    }

    const lineReferences = getReferences(line, regex)
    if (lineReferences.length > 0) {
      isBody = false
      referenceMatched = true
      continueNote = false
    Array.prototype.push.apply(references, lineReferences)
    }

    if (referenceMatched) {
      footer.push(line)
      return
    }

    if (continueNote) {
      notes[notes.length - 1].text = append(notes[notes.length - 1].text, line)
      footer.push(line)
      return
    }

    if (isBody) body.push(line)
    else footer.push(line)
  })

  if (breakingHeaderPattern && notes.length === 0) {
    const breakingHeader = header.match(breakingHeaderPattern)
    if (breakingHeader) {
      const noteText = breakingHeader[3] // the description of the change.
      notes.push({
        title: 'BREAKING CHANGE',
        text: noteText
      })
    }
  }

  const mentions = []
  let mentionsMatch
  while ((mentionsMatch = regex.mentions.exec(raw))) {
    mentions.push(mentionsMatch[1])
  }

  // does this commit revert any other commit?
  let revert = null
  const revertMatch = raw.match(revertPattern)
  if (revertMatch) {
    revert = {}
    for (let i = 0; i < revertCorrespondence.length; ++i) {
      const partName = revertCorrespondence[i]
      revert[partName] = revertMatch[i + 1] || null
    }
  }

  for (const note of notes) note.text = trimOffNewlines(note.text)

  const msg = Object.assign(
    headerParts,
    mergeParts,
    {
      merge,
      header,
      body: body.length > 0 ? trimOffNewlines(body.join('\n')) : null,
      footer: footer.length > 0 ? trimOffNewlines(footer.join('\n')) : null,
      notes,
      references,
      mentions,
      revert
    },
    otherFields
  )

  return msg
}

module.exports = parser
