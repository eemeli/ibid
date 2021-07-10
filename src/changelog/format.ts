import type { Commit, Reference } from '../commits'
import type { Context } from '../config/context'

const titles: Record<string, string> = {
  BREAKING: '⚠ Breaking Changes',
  UNRELEASED: 'Unreleased Changes',
  feat: 'Features',
  fix: 'Bug Fixes',
  perf: 'Performance Improvements',
  revert: 'Reverts',
  docs: 'Documentation',
  style: 'Styles',
  chore: 'Miscellaneous Chores',
  refactor: 'Code Refactoring',
  test: 'Tests',
  build: 'Build System',
  ci: 'Continuous Integration',
  other: 'Other Changes'
}

export const format = {
  changelog(ctx: Context, version: string | null, commits: Commit[]): string {
    const head = this.header(ctx, version, null)
    const body = this.changes(ctx, commits)
    return body ? `${head}\n${body}` : head
  },

  header(ctx: Context, version: string | null, title: string | null): string {
    const { linkCompare } = ctx.config
    const prev = ctx.package?.version
    const url =
      prev && version && linkCompare ? linkCompare(ctx, prev, version) : null
    let fmt = url
      ? `[${url}](${version})`
      : version ||
        title ||
        ctx.config.changelogTitles.UNRELEASED ||
        titles.UNRELEASED
    if (version && title) fmt += ` "${title}"`
    const date = new Date().toISOString().substring(0, 10)
    return `## ${fmt} (${date})\n`
  },

  changes(ctx: Context, commits: Commit[]): string {
    const sections: Record<string, Commit[]> = {}
    const notes: string[] = []
    for (const commit of commits) {
      if (commit.message.breaking) notes.push(commit.message.breaking)
      const type = commit.message.type || 'other'
      const prev = sections[type]
      if (prev) prev.unshift(commit)
      else sections[type] = [commit]
    }
    const res: string[] = []
    if (notes.length > 0) res.push(this.breaking(ctx, notes))
    for (const type of ctx.config.changelogSections) {
      const st = sections[type]
      if (st) res.push(this.section(ctx, type, st))
    }
    return res.join('\n')
  },

  breaking(ctx: Context, notes: string[]): string {
    const title = ctx.config.changelogTitles.BREAKING || titles.BREAKING
    let fmt = `### ${title}\n\n`
    for (const note of notes) {
      const nf = /\n\S/.test(note)
        ? note.replace(/\n(?![\r\n])/g, '\n  ')
        : note
      fmt += `* ${nf}\n`
    }
    return fmt
  },

  section(ctx: Context, type: string, commits: Commit[]): string {
    const title =
      ctx.config.changelogTitles[type] || titles[type] || titles.other
    let fmt = `### ${title}\n\n`
    for (const commit of commits) fmt += this.commit(ctx, commit)
    return fmt
  },

  commit(ctx: Context, commit: Commit): string {
    const { references, scope, subject } = commit.message
    const linked: string[] = []

    let fmt = this.subject(ctx, subject, references, ref =>
      linked.push(ref.ref)
    )
    if (scope) fmt = `**${scope}:** ${fmt}`
    fmt += ` (${this.hash(ctx, commit.hash)})`

    for (const ref of references) {
      if (ref.action && !linked.includes(ref.ref)) {
        linked.push(ref.ref)
        fmt += `, closes ${this.reference(ctx, ref)}`
      }
    }

    return `* ${fmt}\n`
  },

  subject(
    ctx: Context,
    subject: string,
    refs: Reference[],
    onRef: (ref: Reference) => void
  ): string {
    const re = new RegExp(refs.map(ref => ref.ref).join('|'), 'g')
    return subject.replace(re, refSrc => {
      const ref = refs.find(ref => ref.ref === refSrc)
      if (ref) {
        onRef(ref)
        return this.reference(ctx, ref)
      } else return refSrc
    })
  },

  hash(ctx: Context, hash: string): string {
    const { linkCommit, shortHashLength } = ctx.config
    const url = linkCommit ? linkCommit(ctx, hash) : null
    const text = hash.substring(0, shortHashLength)
    return url ? `[${url}](${text})` : text
  },

  reference(ctx: Context, ref: Reference): string {
    const { linkReference } = ctx.config
    const url = linkReference ? linkReference(ctx, ref) : null
    const text = (ref.scope || '') + ref.prefix + ref.issue
    return url ? `[${url}](${text})` : text
  }
}
