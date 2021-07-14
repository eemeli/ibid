import { URL } from 'url'
import type { formatChangelog } from '../changelog/format'
import type { Commit, Reference } from '../commits'
import { gitAbbrevLength } from '../commits/git'
import type { Context } from './context'
import type { HostContext } from './host-data'

export type changelogFormatter = (
  ctx: Context,
  fmt: typeof formatChangelog,
  version: string | null,
  commits: Commit[]
) => string | Promise<string>

export interface Config {
  bumpAllChanges?: boolean
  changelogEntryPattern?: RegExp
  changelogFilename?: string
  changelogFormat?: changelogFormatter
  changelogIntro?: string
  changelogSections?: string[]
  changelogTitles?: Record<string, string>
  context?: (context: Context) => Context | Promise<Context>
  hostContext?: Partial<HostContext> | null
  includeMergeCommits?: boolean
  includeRevertedCommits?: boolean
  linkCommit?: ((context: Context, hash: string) => string | null) | false
  linkCompare?:
    | ((context: Context, from: string, to: string) => string | null)
    | false
  linkReference?: ((context: Context, ref: Reference) => string | null) | false
  prerelease?: boolean | string | null
  shortHashLength?: number
  tag?: (context: Context, version?: string | null) => string
}

function changelogFormat(
  ctx: Context,
  fmt: typeof formatChangelog,
  version: string | null,
  commits: Commit[]
) {
  const body = fmt.changes(ctx, commits)
  return body ? `${fmt.header(ctx, version)}\n${body}` : ''
}

function linkCommit(ctx: Context, hash: string) {
  if (!ctx.hostInfo) return null
  const base = ctx.hostInfo.browse()
  return `${base}/${ctx.hostContext.commitPath}/${hash}`
}

function linkCompare(ctx: Context, from: string, to: string) {
  if (!ctx.hostInfo) return null
  const base = ctx.hostInfo.browse()
  return `${base}/compare/${from}...${to}`
}

function linkReference(ctx: Context, ref: Reference) {
  if (!ctx.hostInfo) return null
  const url = new URL(ctx.hostInfo.browse())
  if (ref.scope) {
    const { user, project } = ctx.hostInfo
    const orig = ref.scope.includes('/') ? `${user}/${project}` : user
    url.pathname = url.pathname.replace(orig, ref.scope)
  }
  url.pathname += `/${ctx.hostContext.issuePath}/${ref.issue}`
  return String(url)
}

function tag(ctx: Context, version?: string | null) {
  if (!version) version = ctx.package?.version || '[NO_VERSION]'
  return ctx.package && !ctx.gitRoot
    ? `${ctx.package.name}@${version}`
    : `v${version}`
}

export const getRequiredConfig = async (
  config: Config
): Promise<Required<Config>> =>
  Object.assign(
    {
      bumpAllChanges: false,
      changelogEntryPattern: /^##/m,
      changelogFilename: 'CHANGELOG.md',
      changelogFormat,
      changelogIntro: `# Changelog\n`,
      changelogSections: ['feat', 'fix', 'perf', 'revert'],
      changelogTitles: {},
      context: (ctx: Context) => ctx,
      hostContext: null,
      includeMergeCommits: false,
      includeRevertedCommits: false,
      linkCommit,
      linkCompare,
      linkReference,
      prerelease: null,
      shortHashLength: await gitAbbrevLength(),
      tag
    },
    config
  )
