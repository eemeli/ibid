import { Context } from '../config/context'
import { filterReverted } from './filter-reverted'
import { gitLog, gitRefExists } from './git'
import { Commit, parseCommit } from './parse-commit'

export { CommitMessage } from './commit-message'
export { Reference } from './commit-message-references'
export { Commit, parseCommit }

export async function getCurrentCommits(ctx: Context): Promise<Commit[]> {
  if (!(await gitRefExists(ctx.tag)))
    throw new Error(`Current git tag not found: ${ctx.tag}`)

  const { includeMergeCommits, includeRevertedCommits } = ctx.config
  const commits: Commit[] = []
  for (const src of await gitLog(ctx.tag, null, ctx.cwd)) {
    const commit = parseCommit(src, ctx)
    if (commit && (includeMergeCommits || !commit.merge)) commits.push(commit)
  }

  return includeRevertedCommits ? commits : filterReverted(commits)
}
