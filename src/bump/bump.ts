import { inc, parse } from 'semver'
import { Commit } from '../commits'
import { Context } from '../config/context'

// Copied from @types/semver to avoid runtime dependency
export type ReleaseType =
  | 'major'
  | 'premajor'
  | 'minor'
  | 'preminor'
  | 'patch'
  | 'prepatch'
  | 'prerelease'

export function recommendBump(
  ctx: Context,
  commits: Commit[]
): ReleaseType | null {
  const { bumpAllChanges, changelogSections, prerelease } = ctx.config

  let major = false
  let minor = false
  let patch = false
  for (const commit of commits) {
    const { breaking, type } = commit.message
    if (breaking) {
      major = true
      break
    } else if (type === 'feat') minor = true
    else if (bumpAllChanges || changelogSections.includes(type || 'other'))
      patch = true
  }
  if (!major && !minor && !patch) return null

  const version = ctx.package ? parse(ctx.package.version) : null
  const prePrev = version ? version.prerelease.length > 0 : false

  if (version?.major === 0) {
    if (major) {
      major = false
      minor = true
    } else if (minor) {
      minor = false
      patch = true
    }
  }

  if (prerelease === false || (prerelease == null && !prePrev))
    return major ? 'major' : minor ? 'minor' : 'patch'
  if (prePrev && version?.patch === 0)
    return major && version.minor !== 0 ? 'premajor' : 'prerelease'
  return major ? 'premajor' : minor ? 'preminor' : 'prerelease'
}

export function applyBump(
  ctx: Context,
  bump: ReleaseType | null
): string | null {
  const { version } = ctx.package || {}
  if (!bump || !version) return null
  const { prerelease } = ctx.config
  const identifier =
    typeof prerelease === 'string'
      ? prerelease
      : parse(version)?.prerelease.slice(0, -1).join('.') || undefined
  return inc(version, bump, identifier)
}
