const parser = require('./parser')
const regex = require('./regex')

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
} = {}) {
  if (typeof referenceActions === 'string')
    referenceActions = referenceActions.split(',')

  if (typeof issuePrefixes === 'string')
    issuePrefixes = issuePrefixes.split(',')

  if (typeof fieldPattern === 'string') fieldPattern = new RegExp(fieldPattern)

  if (typeof mergePattern === 'string') mergePattern = new RegExp(mergePattern)

  if (typeof mergeCorrespondence === 'string')
    mergeCorrespondence = mergeCorrespondence.split(',')
  mergeCorrespondence = mergeCorrespondence.map(part => part.trim())

  return {
    parserOpt: {
      commentChar,
      fieldPattern,
      mergePattern,
      mergeCorrespondence
    },
    regexOpt: {
      issuePrefixes,
      issuePrefixesCaseSensitive,
      referenceActions
    }
  }
}

function parseMessage(commit, options) {
  if (typeof commit !== 'string' || !commit.trim())
    throw new TypeError('Expected a raw commit')

  const { parserOpt, regexOpt } = getOptions(options)
  return parser(commit, parserOpt, regex(regexOpt))
}

module.exports = parseMessage
