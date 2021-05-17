'use strict'
const { promisify } = require('util')
const gitSemverTags = promisify(require('git-semver-tags'))

const getFinalizeContext = require('./finalize-context')
const getHostOpts = require('./host-opts')

async function mergeConfig(options, config, context) {
  let tags = []
  let fromTag = null
  try {
    tags = await gitSemverTags({
      lernaTags: !!options.lernaPackage,
      package: options.lernaPackage,
      tagPrefix: options.tagPrefix,
      skipUnstable: options.skipUnstable
    })
    context.gitSemverTags = tags
    fromTag = tags[options.releaseCount - 1]
    const lastTag = tags[0]

    if (
      options.outputUnreleased &&
      (lastTag === context.version || lastTag === 'v' + context.version)
    )
      context.version = 'Unreleased'
  } catch (_) {
    // ignore any error
  }

  const gitRawCommitsOpts = {
    format: '%B%n-hash-%n%H%n-gitTags-%n%d%n-committerDate-%n%ci',
    from: context.resetChangelog ? null : fromTag,
    merges: false,
    debug: options.debug,
    ...config.gitRawCommitsOpts
  }
  if (options.append && !gitRawCommitsOpts.reverse)
    gitRawCommitsOpts.reverse = true

  const hostOpts = getHostOpts(context.host)
  const parserOpts = {
    ...(hostOpts && hostOpts.parser),
    ...config.parserOpts,
    warn: options.warn
  }

  const writerOpts = {
    debug: options.debug,
    finalizeContext: getFinalizeContext(options, tags),
    ...config.writerOpts,
    reverse: options.append
  }

  return { gitRawCommitsOpts, parserOpts, writerOpts }
}

module.exports = mergeConfig
