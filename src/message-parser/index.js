const parser = require('./parser')

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

function getOptions({
  commentChar = null,
  referenceActions = [
    'close',
    'closes',
    'closed',
    'fix',
    'fixes',
    'fixed',
    'resolve',
    'resolves',
    'resolved'
  ],
  issuePrefixes = ['#'],
  issuePrefixesCaseSensitive = false,
  fieldPattern = /^-(.*?)-$/,
  mergePattern = null,
  mergeCorrespondence = []
}) {
  return {
    commentChar,
    fieldPattern,
    mergePattern,
    mergeCorrespondence,
    referenceParts: getReferencePartsRegex(
      issuePrefixes,
      issuePrefixesCaseSensitive
    ),
    references: getReferencesRegex(referenceActions)
  }
}

function parseMessage(commit, options = {}) {
  if (typeof commit !== 'string' || !commit.trim())
    throw new TypeError('Expected a raw commit')
  return parser(commit, getOptions(options))
}

module.exports = parseMessage
