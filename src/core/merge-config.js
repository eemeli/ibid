'use strict'
const getPkgRepo = require('get-pkg-repo')
const normalizePackageData = require('normalize-package-data')
const gitRemoteOriginUrl = require('git-remote-origin-url')
const _ = require('lodash')
const readPkg = require('read-pkg')
const readPkgUp = require('read-pkg-up')
const { URL } = require('url')
const { promisify } = require('util')
const gitSemverTags = promisify(require('git-semver-tags'))

const rhosts = /github|bitbucket|gitlab/i

function guessNextTag(previousTag, version) {
  if (previousTag) {
    if (previousTag[0] === 'v' && version[0] !== 'v') return 'v' + version
    if (previousTag[0] !== 'v' && version[0] === 'v')
      return version.replace(/^v/, '')
    return version
  }
  return version[0] === 'v' ? version : 'v' + version
}

async function mergeConfig(
  options,
  context,
  gitRawCommitsOpts,
  parserOpts,
  writerOpts,
  gitRawExecOpts
) {
  context = context || {}
  gitRawCommitsOpts = gitRawCommitsOpts || {}
  gitRawExecOpts = gitRawExecOpts || {}

  const rtag =
    options && options.tagPrefix
      ? new RegExp(`tag:\\s*[=]?${options.tagPrefix}(.+?)[,)]`, 'gi')
      : /tag:\s*[v=]?(.+?)[,)]/gi

  options = _.merge(
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
    options
  )

  options.warn = options.warn || options.debug

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

  let pkg = null
  if (options.pkg) {
    try {
      // TODO: Update these dependencies
      pkg = options.pkg.path
        ? await readPkg(options.pkg.path)
        : (await readPkgUp()).pkg
    } catch (error) {
      options.warn('Error parsing package.json: ' + error)
    }
    pkg = options.pkg.transform(pkg)
  }

  context = Object.assign(context, config.context)

  if (!pkg || !pkg.repository || !pkg.repository.url) {
    try {
      const url = await gitRemoteOriginUrl()
      pkg = pkg || {}
      pkg.repository = pkg.repository || {}
      pkg.repository.url = url
      normalizePackageData(pkg)
    } catch (_) {
      // ignore any error
    }
  }

  let repo = {}
  if (pkg) {
    context.version = context.version || pkg.version

    try {
      repo = getPkgRepo(pkg)
    } catch (_) {
      // ignore any error
    }

    if (repo.browse) {
      const browse = repo.browse()
      if (!context.host) {
        if (repo.domain) {
          const { origin, protocol } = new URL(browse)
          context.host =
            protocol + (origin.includes('//') ? '//' : '') + repo.domain
        } else context.host = null
      }
      context.owner = context.owner || repo.user || ''
      context.repository = context.repository || repo.project
      context.repoUrl = browse
    }
    context.packageData = pkg
  }

  context.version = context.version || ''

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

  let hostOpts = {}
  if (
    context.host &&
    (!context.issue ||
      !context.commit ||
      !parserOpts ||
      !parserOpts.referenceActions)
  ) {
    let type = null
    if (context.host) {
      const match = context.host.match(rhosts)
      if (match) type = match[0]
    } else type = repo.type

    if (type) {
      hostOpts = require('./hosts/' + type)
      context = Object.assign(
        { issue: hostOpts.issue, commit: hostOpts.commit },
        context
      )
    } else {
      options.warn(`Host: ${JSON.stringify(context.host)} does not exist`)
    }
  }

  if (context.resetChangelog) fromTag = null

  gitRawCommitsOpts = Object.assign(
    {
      format: '%B%n-hash-%n%H%n-gitTags-%n%d%n-committerDate-%n%ci',
      from: fromTag,
      merges: false,
      debug: options.debug
    },
    config.gitRawCommitsOpts,
    gitRawCommitsOpts
  )

  if (options.append)
    gitRawCommitsOpts.reverse = gitRawCommitsOpts.reverse || true

  parserOpts = Object.assign(
    {},
    config.parserOpts,
    { warn: options.warn },
    parserOpts
  )

  if (hostOpts.referenceActions)
    parserOpts.referenceActions = hostOpts.referenceActions

  if (
    (!parserOpts.issuePrefixes || parserOpts.issuePrefixes.length === 0) &&
    hostOpts.issuePrefixes
  )
    parserOpts.issuePrefixes = hostOpts.issuePrefixes

  writerOpts = Object.assign(
    {
      finalizeContext: function (
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
          if (index === -1) {
            context.currentTag = currentTag || null
          } else {
            context.previousTag =
              tags[index + 1] ||
              (options.append ? firstCommitHash : lastCommitHash)
          }
        } else {
          if (!context.previousTag) context.previousTag = tags[0]
          if (!context.currentTag) {
            if (context.version === 'Unreleased')
              context.currentTag = options.append
                ? lastCommitHash
                : firstCommitHash
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
      },
      debug: options.debug
    },
    config.writerOpts,
    { reverse: options.append, doFlush: options.outputUnreleased },
    writerOpts
  )

  return {
    options,
    context,
    gitRawCommitsOpts,
    parserOpts,
    writerOpts,
    gitRawExecOpts
  }
}

module.exports = mergeConfig
