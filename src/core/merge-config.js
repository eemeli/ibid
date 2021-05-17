'use strict'
const { promisify } = require('util')
const gitSemverTags = promisify(require('git-semver-tags'))

const getContext = require('./get-context')
const getFinalizeContext = require('./finalize-context')
const getHostOpts = require('./host-opts')

async function mergeConfig(
  options,
  contextArg,
  gitRawCommitsOptsArg,
  parserOptsArg,
  writerOptsArg
) {
  let config = {}
  if (options.config) {
    try {
      config = await (typeof options.config === 'function'
        ? promisify(options.config)()
        : options.config)
    } catch (error) {
      options.warn('Error in config: ' + error)
    }
  }

  let context = await getContext(options, { ...contextArg, ...config.context })

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
    ...config.gitRawCommitsOpts,
    ...gitRawCommitsOptsArg
  }
  if (options.append && !gitRawCommitsOpts.reverse)
    gitRawCommitsOpts.reverse = true

  const hostOpts = getHostOpts(context.host)
  const parserOpts = {
    ...(hostOpts && hostOpts.parser),
    ...config.parserOpts,
    warn: options.warn,
    ...parserOptsArg
  }

  const writerOpts = {
    debug: options.debug,
    finalizeContext: getFinalizeContext(options, tags),
    ...config.writerOpts,
    reverse: options.append,
    ...writerOptsArg
  }

  return {
    context,
    gitRawCommitsOpts,
    parserOpts,
    writerOpts
  }
}

module.exports = mergeConfig
