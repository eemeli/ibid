import { Context } from '../config/context'
import { filterReverted } from './filter-reverted'
import { gitLog, gitRefExists } from './git'
import { Commit, parseCommit } from './parse-commit'

export { CommitMessage } from './commit-message'
export { Commit, parseCommit }

export async function getCurrentCommits(ctx: Context): Promise<Commit[]> {
  const tag = ctx.getTag()
  if (!(await gitRefExists(tag)))
    throw new Error(`Current git tag not found: ${tag}`)

  const { includeMergeCommits, includeRevertedCommits } = ctx.config
  const commits: Commit[] = []
  for (const src of await gitLog(tag, null, ctx.cwd)) {
    const commit = parseCommit(ctx, src)
    if (commit && (includeMergeCommits || !commit.merge)) commits.push(commit)
  }

  return includeRevertedCommits ? commits : filterReverted(commits)
}