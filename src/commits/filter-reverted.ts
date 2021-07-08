import { Revert } from './commit-message'
import { Commit } from './parse-commit'

export function filterReverted(commits: Commit[]): Commit[] {
  if (!Array.isArray(commits)) throw new TypeError('Expected an array')

  const reverts = new Map<string, Revert>()
  for (const commit of commits) {
    const rev = commit.message.revert
    if (rev) reverts.set(commit.hash, rev)
  }
  const remove: string[] = []

  for (const commit of commits) {
    for (const [revert, { hash, header }] of reverts) {
      if (
        commit.hash.startsWith(hash) &&
        commit.message.header.includes(header)
      ) {
        // Filter out both this commit and the one that reverted it
        remove.push(commit.hash, revert)
        break
      }
    }
  }

  return commits.filter(commit => !remove.includes(commit.hash))
}
