'use strict'

const { promisify } = require('util')
const resolvePreset = require('./resolve-preset')

module.exports = async function getConfig({ config, preset }) {
  const cfg = preset ? loadPreset(preset) : config
  switch (typeof cfg) {
    case 'function':
      return promisify(cfg)()
    case 'object':
    case 'undefined':
      return cfg || {}
    default:
      throw new Error('preset package must be a promise, function, or object')
  }
}

function loadPreset(preset) {
  try {
    const name = resolvePreset(preset)
    const presetModule = require(name)

    // rather than returning a promise, presets can return a builder function
    // which accepts a config object (allowing for customization) and returns
    // a promise.
    return typeof presetModule === 'function' && typeof preset === 'object'
      ? presetModule(preset)
      : presetModule
  } catch (error) {
    const name = typeof preset === 'object' ? preset.name : preset
    error.message = `Unable to load the "${name}" preset package. Please make sure it's installed.\n${error.message}`
    throw error
  }
}
