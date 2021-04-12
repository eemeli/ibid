'use strict'
const conventionalChangelogPresetLoader = require('conventional-changelog-preset-loader')
const { promisify } = require('util')

const filterReverted = require('../commit-filter/reverted')
const gitLog = require('../git/git-log')
const parseMessage = require('../message-parser/index')
const presetResolver = require('./preset-resolver')

const gitSemverTags = promisify(require('git-semver-tags'))

const VERSIONS = ['major', 'minor', 'patch']

async function conventionalRecommendedBump(
  optionsArgument,
  parserOptsArgument
) {
  if (typeof optionsArgument !== 'object')
    throw new Error("The 'options' argument must be an object.")

  const options = Object.assign({ ignoreReverted: true }, optionsArgument)

  let presetPackage = options.config || {}
  if (options.preset) {
    try {
      presetPackage = conventionalChangelogPresetLoader(options.preset)
    } catch (err) {
      if (err.message === 'does not exist') {
        const preset =
          typeof options.preset === 'object'
            ? options.preset.name
            : options.preset
        throw new Error(
          `Unable to load the "${preset}" preset package. Please make sure it's installed.`
        )
      } else throw err
    }
  }

  const config = await presetResolver(presetPackage)

  const whatBump =
    options.whatBump ||
    (config.recommendedBumpOpts && config.recommendedBumpOpts.whatBump)

  if (whatBump && typeof whatBump !== 'function')
    throw Error('whatBump must be a function')

  const tags = await gitSemverTags({
    lernaTags: !!options.lernaPackage,
    package: options.lernaPackage,
    tagPrefix: options.tagPrefix,
    skipUnstable: options.skipUnstable
  })

  const rawCommits = await gitLog(tags[0], null, { path: options.path })

  const parserOpts = Object.assign({}, config.parserOpts, parserOptsArgument)
  let commits = rawCommits.map(commit =>
    Object.assign(commit, parseMessage(commit.message, parserOpts))
  )
  if (options.ignoreReverted) commits = filterReverted(commits)

  if ((!commits || !commits.length) && typeof parserOpts.warn === 'function')
    parserOpts.warn('No commits since last release')

  if (!whatBump) return {}
  let result = whatBump(commits, options)
  if (result == null) return {}
  if (result && result.level != null)
    result.releaseType = VERSIONS[result.level]
  return result
}

module.exports = conventionalRecommendedBump
