import { inc, parse, ReleaseType } from 'semver'
import { Commit } from '../commits'
import { Context } from '../config/context'

export function recommendBump(
  ctx: Context,
  commits: Commit[]
): 'major' | 'minor' | 'patch' | null {
  const { bumpAllChanges, changelogSections } = ctx.config
  let isMinor = false
  let isPatch = false
  for (const commit of commits) {
    const { breaking, type } = commit.message
    if (breaking) return 'major'
    if (isMinor) continue
    if (type === 'feat') isMinor = true
    else if (bumpAllChanges || changelogSections.includes(type || 'other'))
      isPatch = true
  }
  return isMinor ? 'minor' : isPatch ? 'patch' : null
}

export function applyBump(
  prev: string,
  bump: 'major' | 'minor' | 'patch' | 'v1',
  prerelease: boolean | string | null
): string {
  const version = parse(prev)
  if (!version) throw new Error(`Not a valid semver version: ${prev}`)
  const { major, minor, patch } = version

  let rt: ReleaseType
  if (major > 0) {
    if (bump === 'v1')
      throw new Error(`Invalid bump for version ${prev}: ${bump}`)
    rt = bump
  } else {
    rt = bump === 'v1' ? 'major' : bump === 'major' ? 'minor' : 'patch'
  }

  const prePrev = version.prerelease.length > 0
  if (prerelease || (prerelease === null && prePrev)) {
    if (rt === 'major')
      rt = prePrev && patch === 0 && minor === 0 ? 'prerelease' : 'premajor'
    else if (rt === 'minor')
      rt = prePrev && patch === 0 ? 'prerelease' : 'preminor'
    else rt = 'prerelease'
  }

  const id = typeof prerelease === 'string' ? prerelease : undefined
  const next = inc(version, rt, id)
  if (!next) throw new Error(`Invalid bump for version ${prev}: ${bump}`)
  return next
}
