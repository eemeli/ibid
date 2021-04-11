const matchNone = /(?!.*)/
const matchAll = /()(.+)/g

const join = array =>
  array
    .map(val => val.trim())
    .filter(Boolean)
    .join('|')

function getNotesRegex(noteKeywords, notesPattern) {
  if (!noteKeywords) return matchNone
  const noteKeywordsSelection = join(noteKeywords)
  return notesPattern
    ? notesPattern(noteKeywordsSelection)
    : new RegExp('^[\\s|*]*(' + noteKeywordsSelection + ')[:\\s]+(.*)', 'i')
}

function getReferencePartsRegex(issuePrefixes, issuePrefixesCaseSensitive) {
  if (!issuePrefixes) return matchNone
  return new RegExp(
    '(?:.*?)??\\s*([\\w-\\.\\/]*?)??(' + join(issuePrefixes) + ')([\\w-]*\\d+)',
    issuePrefixesCaseSensitive ? 'g' : 'gi'
  )
}

function getReferencesRegex(referenceActions) {
  if (!referenceActions) return matchAll
  const joinedKeywords = join(referenceActions)
  return new RegExp(
    '(' + joinedKeywords + ')(?:\\s+(.*?))(?=(?:' + joinedKeywords + ')|$)',
    'gi'
  )
}

const regex = ({
  issuePrefixes,
  issuePrefixesCaseSensitive,
  noteKeywords,
  notesPattern,
  referenceActions
} = {}) => ({
  mentions: /@([\w-]+)/g,
  notes: getNotesRegex(noteKeywords, notesPattern),
  referenceParts: getReferencePartsRegex(
    issuePrefixes,
    issuePrefixesCaseSensitive
  ),
  references: getReferencesRegex(referenceActions)
})

module.exports = regex
