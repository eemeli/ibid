'use strict'

function guessNextTag(previousTag, version) {
  if (previousTag) {
    if (previousTag[0] === 'v' && version[0] !== 'v') return 'v' + version
    if (previousTag[0] !== 'v' && version[0] === 'v')
      return version.replace(/^v/, '')
    return version
  }
  return version[0] === 'v' ? version : 'v' + version
}

const getFinalizeContext = (options, tags) =>
  function finalizeContext(
    context,
    writerOpts,
    filteredCommits,
    keyCommit,
    originalCommits
  ) {
    const firstCommit = originalCommits[0]
    const lastCommit = originalCommits[originalCommits.length - 1]
    const firstCommitHash = firstCommit ? firstCommit.hash : null
    const lastCommitHash = lastCommit ? lastCommit.hash : null

    if ((!context.currentTag || !context.previousTag) && keyCommit) {
      const match = /tag:\s*(.+?)[,)]/gi.exec(keyCommit.gitTags)
      const currentTag = context.currentTag
      context.currentTag = currentTag || match ? match[1] : null
      const index = tags.indexOf(context.currentTag)

      // if `keyCommit.gitTags` is not a semver
      if (index === -1) context.currentTag = currentTag || null
      else context.previousTag = tags[index + 1] || lastCommitHash
    } else {
      if (!context.previousTag) context.previousTag = tags[0]
      if (!context.currentTag) {
        if (context.version === 'Unreleased')
          context.currentTag = firstCommitHash
        else if (options.lernaPackage)
          context.currentTag = options.lernaPackage + '@' + context.version
        else if (options.tagPrefix)
          context.currentTag = options.tagPrefix + context.version
        else context.currentTag = guessNextTag(tags[0], context.version)
      }
    }

    if (
      typeof context.linkCompare !== 'boolean' &&
      context.previousTag &&
      context.currentTag
    ) {
      context.linkCompare = true
    }

    return context
  }

module.exports = getFinalizeContext
