'use strict'

const getConfig = require('../core/get-config')

const VERSIONS = ['major', 'minor', 'patch']

async function recommendBump(options, commits) {
  if (typeof options !== 'object')
    throw new Error("The 'options' argument must be an object.")
  if (!Array.isArray(commits))
    throw new Error("The 'commits' argument must be an array.")

  let whatBump = options.whatBump
  if (!whatBump) {
    const { recommendedBumpOpts } = await getConfig(options)
    whatBump = recommendedBumpOpts && recommendedBumpOpts.whatBump
    if (!whatBump) return {}
  }

  if (typeof whatBump !== 'function') throw Error('whatBump must be a function')
  const result = whatBump(commits, options)

  if (result == null) return {}
  if (result && result.level != null)
    result.releaseType = VERSIONS[result.level]
  return result
}

module.exports = recommendBump
