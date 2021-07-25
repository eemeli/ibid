import { URL } from 'url'
import type { formatChangelog } from '../changelog/format'
import type { Commit, Reference } from '../commits'
import { gitAbbrevLength } from '../shell/git'
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
  commitFormat?: ((tags: string[]) => string) | false
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
  tagFormat?: (context: Context, version?: string | null) => string
}

const configShape = {
  bumpAllChanges: ['boolean'],
  changelogEntryPattern: [RegExp],
  changelogFilename: ['string'],
  changelogFormat: ['function'],
  changelogIntro: ['string'],
  changelogSections: [Array],
  changelogTitles: ['object'],
  commitFormat: ['function', false],
  context: ['function'],
  hostContext: ['object', null],
  includeMergeCommits: ['boolean'],
  includeRevertedCommits: ['boolean'],
  linkCommit: ['function', false],
  linkCompare: ['function', false],
  linkReference: ['function', false],
  prerelease: ['boolean', 'string', null],
  shortHashLength: ['number'],
  tagFormat: ['function']
}

function changelogFormat(
  ctx: Context,
  fmt: typeof formatChangelog,
  version: string | null,
  commits: Commit[]
) {
  const head = fmt.header(ctx, version)
  const body = fmt.changes(ctx, commits)
  return body ? `${head}\n${body}` : version ? head : ''
}

function commitFormat(tags: string[]) {
  const body = tags.map(tag => `- ${tag}`).join('\n')
  return `chore: Publish\n\n${body}`
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

function tagFormat(ctx: Context, version?: string | null) {
  if (!version) version = ctx.package?.version || '[NO_VERSION]'
  return ctx.package && !ctx.gitRoot
    ? `${ctx.package.name}@${version}`
    : `v${version}`
}

export const getBaseConfig = async (): Promise<Required<Config>> => ({
  bumpAllChanges: false,
  changelogEntryPattern: /^#(?!\s*change)/im,
  changelogFilename: 'CHANGELOG.md',
  changelogFormat,
  changelogIntro: `# Changelog\n`,
  changelogSections: ['feat', 'fix', 'perf', 'revert'],
  changelogTitles: {},
  commitFormat,
  context: (ctx: Context) => ctx,
  hostContext: null,
  includeMergeCommits: false,
  includeRevertedCommits: false,
  linkCommit,
  linkCompare,
  linkReference,
  prerelease: null,
  shortHashLength: await gitAbbrevLength(),
  tagFormat
})

export function validateConfig(
  config: Config | null | undefined,
  throwOnUnknown: boolean
): Config {
  const res: Config = {}
  if (!config) return res
  for (const key of Object.keys(config) as (keyof Config)[]) {
    const expected = configShape[key]
    if (!expected) {
      if (throwOnUnknown) throw new Error(`Unknown config key: ${key}`)
      else continue
    }

    const value = config[key]
    const ok = expected.some(shape => {
      if (typeof shape === 'string') return typeof value === shape
      if (typeof shape === 'function') return value instanceof shape
      return value === shape
    })

    if (ok) {
      // Let's trust in our runtime checks.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!throwOnUnknown) res[key] = value as any
    } else {
      // TypeScript types don't include Intl.ListFormat yet, but it is
      // supported from Node.js 12.0.0 onwards.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lf = new (Intl as any).ListFormat(undefined, {
        type: 'disjunction'
      })
      const ss = expected.map(shape =>
        typeof shape === 'function' ? shape.name : String(shape)
      )
      throw new Error(
        `Invalid type for ${key} config, expected: ${lf.format(ss)}`
      )
    }
  }
  return throwOnUnknown ? config : res
}
