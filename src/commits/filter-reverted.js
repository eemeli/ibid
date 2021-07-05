'use strict'

function filterReverted(commits) {
  if (!Array.isArray(commits)) throw new TypeError('Expected an array')

  const revertCommits = commits.filter(commit => commit.revert)
  const remove = []

  for (const commit of commits) {
    const _commit = commit.raw || commit

    // All revert fields must match
    const revertCommit = revertCommits.find(revertCommit =>
      Object.entries(revertCommit.revert).every(([key, v0]) => {
        const v1 = _commit[key]
        return (
          typeof v0 === typeof v1 &&
          (typeof v0 === 'string' ? v0.trim() === v1.trim() : v0 === v1)
        )
      })
    )

    // Filter out both this commit and the one that reverted it
    if (revertCommit) remove.push(commit.hash, revertCommit.hash)
  }

  return commits.filter(commit => !remove.includes(commit.hash))
}

module.exports = { filterReverted }
