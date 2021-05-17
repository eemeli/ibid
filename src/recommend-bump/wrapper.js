'use strict'

const { promisify } = require('util')
const gitSemverTags = promisify(require('git-semver-tags'))

const filterReverted = require('../commit-filter/reverted')
const gitLog = require('../git/git-log')
const parseMessage = require('../message-parser/index')

const getConfig = require('../core/get-config')
const recommendBump = require('./recommend-bump')

async function getCommits(options, parserOpts) {
  const tags = await gitSemverTags({
    lernaTags: !!options.lernaPackage,
    package: options.lernaPackage,
    tagPrefix: options.tagPrefix,
    skipUnstable: options.skipUnstable
  })
  const commits = await gitLog(tags[0], null, { path: options.path })
  for (const commit of commits)
    Object.assign(commit, parseMessage(commit.message, parserOpts))
  return options.ignoreReverted ? filterReverted(commits) : commits
}

async function wrapper(optionsArgument, parserOptsArgument) {
  if (typeof optionsArgument !== 'object')
    throw new Error("The 'options' argument must be an object.")

  const options = Object.assign({ ignoreReverted: true }, optionsArgument)
  const config = await getConfig(options)
  const parserOpts = Object.assign({}, config.parserOpts, parserOptsArgument)

  const commits = await getCommits(options, parserOpts)
  if ((!commits || !commits.length) && typeof parserOpts.warn === 'function')
    parserOpts.warn('No commits since last release')

  return recommendBump(options, commits)
}

module.exports = wrapper
