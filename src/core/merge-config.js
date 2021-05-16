'use strict'
const _ = require('lodash')
const { promisify } = require('util')
const gitSemverTags = promisify(require('git-semver-tags'))

const getContext = require('./get-context')
const getFinalizeContext = require('./finalize-context')
const getHostOpts = require('./host-opts')

async function mergeConfig(
  optionsArg,
  contextArg,
  gitRawCommitsOptsArg,
  parserOptsArg,
  writerOptsArg
) {
  const rtag =
    optionsArg && optionsArg.tagPrefix
      ? new RegExp(`tag:\\s*[=]?${optionsArg.tagPrefix}(.+?)[,)]`, 'gi')
      : /tag:\s*[v=]?(.+?)[,)]/gi

  const options = _.merge(
    {
      pkg: { transform: pkg => pkg },
      append: false,
      releaseCount: 1,
      skipUnstable: false,
      debug: () => {},
      transform(commit, cb) {
        if (typeof commit.gitTags === 'string') {
          const match = rtag.exec(commit.gitTags)
          rtag.lastIndex = 0
          if (match) commit.version = match[1]
        }
        if (commit.committerDate) {
          const date =
            commit.committerDate instanceof Date
              ? commit.committerDate
              : new Date(commit.committerDate)
          commit.committerDate = date.toISOString().substring(0, 10)
        }
        cb(null, commit)
      },
      lernaPackage: null
    },
    optionsArg
  )
  if (!options.warn) options.warn = options.debug

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

  let context = Object.assign(
    await getContext(options.pkg, options.warn),
    contextArg,
    config.context
  )

  let tags = []
  let fromTag
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

    if (lastTag === context.version || lastTag === 'v' + context.version) {
      if (options.outputUnreleased) context.version = 'Unreleased'
      else options.outputUnreleased = false
    }
  } catch (_) {
    // ignore any error
  }

  if (typeof options.outputUnreleased !== 'boolean')
    options.outputUnreleased = true

  const hostOpts = getHostOpts(context.host)
  if (hostOpts) context = Object.assign({}, hostOpts.writer, context)
  else if (context.host)
    options.warn(`Host: ${JSON.stringify(context.host)} does not exist`)

  const gitRawCommitsOpts = Object.assign(
    {
      format: '%B%n-hash-%n%H%n-gitTags-%n%d%n-committerDate-%n%ci',
      from: context.resetChangelog ? null : fromTag,
      merges: false,
      debug: options.debug
    },
    config.gitRawCommitsOpts,
    gitRawCommitsOptsArg
  )
  if (options.append && !gitRawCommitsOpts.reverse)
    gitRawCommitsOpts.reverse = true

  const parserOpts = Object.assign(
    {},
    hostOpts && hostOpts.parser,
    config.parserOpts,
    { warn: options.warn },
    parserOptsArg
  )

  const writerOpts = Object.assign(
    {
      finalizeContext: getFinalizeContext(options, tags),
      debug: options.debug
    },
    config.writerOpts,
    { reverse: options.append, doFlush: options.outputUnreleased },
    writerOptsArg
  )

  return {
    options,
    context,
    gitRawCommitsOpts,
    parserOpts,
    writerOpts
  }
}

module.exports = mergeConfig
