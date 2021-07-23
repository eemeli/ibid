import { Context } from '../config/context'
import { gitLog, gitRefExists } from '../shell/git'
import { filterReverted } from './filter-reverted'
import { Commit, parseCommit } from './parse-commit'

export { CommitMessage } from './commit-message'
export { Reference } from './commit-message-references'
export { Commit, parseCommit }

export async function getCurrentCommits(ctx: Context): Promise<Commit[]> {
  const tag = ctx.config.tagFormat(ctx, null)
  if (!(await gitRefExists(tag)))
    throw new Error(`Current git tag not found: ${tag}`)

  const { includeMergeCommits, includeRevertedCommits } = ctx.config
  const commits: Commit[] = []
  for (const src of await gitLog(tag, null, ctx.cwd)) {
    const commit = parseCommit(src, ctx)
    if (commit && (includeMergeCommits || !commit.merge)) commits.push(commit)
  }

  return includeRevertedCommits ? commits : filterReverted(commits)
}
