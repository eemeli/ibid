import { Context } from '../config/context'
import { gitLog, gitRefExists } from '../shell/git'
import { filterReverted } from './filter-reverted'
import { Commit, parseCommit } from './parse-commit'

export { CommitMessage } from './commit-message'
export { Reference } from './commit-message-references'
export { Commit, parseCommit }

export async function getCurrentCommits(ctx: Context): Promise<Commit[]> {
  const { includeMergeCommits, includeRevertedCommits, init, tagFormat } =
    ctx.config

  let tag: string | null = tagFormat(ctx, null)
  if (!(await gitRefExists(tag))) {
    if (init) tag = null
    else throw new Error(`Current git tag not found: ${tag}`)
  }

  const commits: Commit[] = []
  for (const src of await gitLog(tag, null, ctx.cwd)) {
    const commit = parseCommit(src, ctx)
    if (commit && (includeMergeCommits || !commit.merge)) commits.push(commit)
  }

  return includeRevertedCommits ? commits : filterReverted(commits)
}
