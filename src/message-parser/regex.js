const matchNone = /(?!.*)/
const matchAll = /()(.+)/g

const join = array =>
  array
    .map(val => val.trim())
    .filter(Boolean)
    .join('|')

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
  referenceActions
} = {}) => ({
  mentions: /@([\w-]+)/g,
  notes: /^[\s|*]*(BREAKING CHANGE)[:\s]+(.*)/i,
  referenceParts: getReferencePartsRegex(
    issuePrefixes,
    issuePrefixesCaseSensitive
  ),
  references: getReferencesRegex(referenceActions)
})

module.exports = regex
