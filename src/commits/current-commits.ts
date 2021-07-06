import { Context } from '../config/context'
import { gitLog, gitRefExists } from './git'
import { Commit, parseCommit } from './parse-commit'

export async function getCurrentCommits(ctx: Context): Promise<Commit[]> {
  const tag = ctx.getTag()
  if (!(await gitRefExists(tag)))
    throw new Error(`Current git tag not found: ${tag}`)
  const commits: Commit[] = []
  for (const src of await gitLog(tag, null, ctx.cwd)) {
    const commit = parseCommit(ctx, src)
    if (commit) commits.push(commit)
  }
  return commits
}
