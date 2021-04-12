'use strict'

const conventionalChangelogPresetLoader = require('conventional-changelog-preset-loader')
const { promisify } = require('util')

async function getConfig({ config, preset }) {
  let presetPackage = config || {}
  if (preset) {
    try {
      presetPackage = conventionalChangelogPresetLoader(preset)
    } catch (err) {
      if (err.message === 'does not exist') {
        const name = typeof preset === 'object' ? preset.name : preset
        throw new Error(
          `Unable to load the "${name}" preset package. Please make sure it's installed.`
        )
      } else throw err
    }
  }

  switch (typeof presetPackage) {
    case 'function':
      return promisify(presetPackage)()
    case 'object':
      return presetPackage
    default:
      throw new Error('preset package must be a promise, function, or object')
  }
}

module.exports = getConfig
