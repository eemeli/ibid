import { Commit, Revert } from './parse-commit'

export function filterReverted(commits: Commit[]): Commit[] {
  if (!Array.isArray(commits)) throw new TypeError('Expected an array')

  const reverts = new Map<string, Revert>()
  for (const commit of commits)
    if (commit.revert) reverts.set(commit.hash, commit.revert)
  const remove: string[] = []

  for (const commit of commits) {
    for (const [hash, revert] of reverts) {
      // All revert fields must match
      if (
        Object.entries(revert).every(
          ([key, value]) => value === commit[key as keyof Commit]
        )
      ) {
        // Filter out both this commit and the one that reverted it
        remove.push(commit.hash, hash)
        break
      }
    }
  }

  return commits.filter(commit => !remove.includes(commit.hash))
}
