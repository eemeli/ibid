const parser = require('./parser')
const regex = require('./regex')

function getOptions({
  breakingHeaderPattern = null,
  commentChar = null,
  headerPattern = /^(\w*)(?:\(([\w$.\-*/ ]*)\))?: (.*)$/,
  headerCorrespondence = ['type', 'scope', 'subject'],
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
  noteKeywords = ['BREAKING CHANGE'],
  notesPattern = null,
  fieldPattern = /^-(.*?)-$/,
  revertPattern = /^Revert\s"([\s\S]*)"\s*This reverts commit (\w*)\./,
  revertCorrespondence = ['header', 'hash'],
  mergePattern = null,
  mergeCorrespondence = []
} = {}) {
  if (typeof breakingHeaderPattern === 'string')
    breakingHeaderPattern = new RegExp(breakingHeaderPattern)

  if (typeof headerPattern === 'string')
    headerPattern = new RegExp(headerPattern)

  if (typeof headerCorrespondence === 'string')
    headerCorrespondence = headerCorrespondence.split(',')
  headerCorrespondence = headerCorrespondence.map(part => part.trim())

  if (typeof referenceActions === 'string')
    referenceActions = referenceActions.split(',')

  if (typeof issuePrefixes === 'string')
    issuePrefixes = issuePrefixes.split(',')

  if (typeof noteKeywords === 'string') noteKeywords = noteKeywords.split(',')

  if (typeof fieldPattern === 'string') fieldPattern = new RegExp(fieldPattern)

  if (typeof revertPattern === 'string')
    revertPattern = new RegExp(revertPattern)

  if (typeof revertCorrespondence === 'string')
    revertCorrespondence = revertCorrespondence.split(',')
  revertCorrespondence = revertCorrespondence.map(part => part.trim())

  if (typeof mergePattern === 'string') mergePattern = new RegExp(mergePattern)

  if (typeof mergeCorrespondence === 'string')
    mergeCorrespondence = mergeCorrespondence.split(',')
  mergeCorrespondence = mergeCorrespondence.map(part => part.trim())

  return {
    parserOpt: {
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
    regexOpt: {
      issuePrefixes,
      issuePrefixesCaseSensitive,
      noteKeywords,
      notesPattern,
      referenceActions
    }
  }
}

function parse(commit, options) {
  if (typeof commit !== 'string' || !commit.trim())
    throw new TypeError('Expected a raw commit')

  const { parserOpt, regexOpt } = getOptions(options)
  return parser(commit, parserOpt, regex(regexOpt))
}

module.exports = parse
