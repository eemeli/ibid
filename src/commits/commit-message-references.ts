import { HostContext } from '../config/host-data'

export interface Reference {
  raw: string
  ref: string
  action: string | null
  scope: string | null
  prefix: string
  issue: string
}

function getReferencesRegexp({
  issuePrefixes,
  referenceActions
}: HostContext): RegExp {
  const ra = referenceActions
    .map(act => {
      const lc = act.toLowerCase()
      const tc = lc[0].toUpperCase() + lc.substring(1)
      return `${lc}|${tc}`
    })
    .join('|')
  const ip = issuePrefixes.join('|')
  return new RegExp(
    `(?:\\b(${ra})\\s+)?([\\w./-]+(?![\\w./-]))?(${ip})([\\w-]*\\d+)`,
    'g'
  )
}

export function getReferences(
  src: string,
  hostContext: HostContext
): Reference[] {
  return Array.from(
    src.matchAll(getReferencesRegexp(hostContext)),
    ([raw, action, scope, prefix, issue]) => ({
      raw,
      ref: (scope || '') + prefix + issue,
      action: action || null,
      scope: scope || null,
      prefix,
      issue
    })
  )
}
