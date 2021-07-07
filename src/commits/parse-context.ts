const matchNone = /(?!.*)/
const matchAll = /()(.+)/g

const join = (array: string[]) =>
  array
    .map(val => val.trim())
    .filter(Boolean)
    .join('|')

function getReferencePartsRegex(
  issuePrefixes: string[] | null,
  issuePrefixesCaseSensitive: boolean
) {
  if (!issuePrefixes) return matchNone
  return new RegExp(
    '(?:.*?)??\\s*([\\w-\\.\\/]*?)??(' + join(issuePrefixes) + ')([\\w-]*\\d+)',
    issuePrefixesCaseSensitive ? 'g' : 'gi'
  )
}

function getReferencesRegex(referenceActions: string[] | null) {
  if (!referenceActions) return matchAll
  const joinedKeywords = join(referenceActions)
  return new RegExp(
    '(' + joinedKeywords + ')(?:\\s+(.*?))(?=(?:' + joinedKeywords + ')|$)',
    'gi'
  )
}

export interface ParseOptions {
  commentChar?: null
  referenceActions?: string[]
  issuePrefixes?: string[]
  issuePrefixesCaseSensitive?: boolean
  mergePattern?: RegExp | null
  mergeCorrespondence?: string[]
}

export interface ParseContext {
  commentChar: string | null
  mergePattern: RegExp | null
  mergeCorrespondence: string[]
  references: RegExp
  referenceParts: RegExp
}

export function getParseContext({
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
  mergePattern = null,
  mergeCorrespondence = []
}: ParseOptions): ParseContext {
  return {
    commentChar,
    mergePattern,
    mergeCorrespondence,
    referenceParts: getReferencePartsRegex(
      issuePrefixes,
      issuePrefixesCaseSensitive
    ),
    references: getReferencesRegex(referenceActions)
  }
}
