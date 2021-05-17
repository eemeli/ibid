'use strict'

const { isAbsolute } = require('path')

module.exports = presetLoader
module.exports.resolvePreset = resolvePreset

function presetLoader(path) {
  // Rather than a string preset name, options.preset can be an object
  // with a "name" key indicating the preset to load; additinoal key/value
  // pairs are assumed to be configuration for the preset. See the documentation
  // for a given preset for configuration available.
  const name = resolvePreset(path)

  try {
    const config = require(name)
    // rather than returning a promise, presets can return a builder function
    // which accepts a config object (allowing for customization) and returns
    // a promise.
    if (typeof config === 'function' && typeof path === 'object')
      return config(path)

    // require returned a promise that resolves to a config object.
    return config
  } catch (_) {
    throw Error('does not exist')
  }
}

function resolvePreset(path) {
  let name = path && typeof path === 'object' ? path.name : path
  if (typeof name !== 'string')
    throw new Error('preset must be string or object with key name')
  if (isAbsolute(name)) return name
  let scope = ''
  if (name[0] === '@') {
    const parts = name.split('/')
    scope = parts.shift() + '/'
    name = parts.join('/')
  }
  if (!name.startsWith('conventional-changelog-'))
    name = `conventional-changelog-${name}`
  return (scope + name).toLowerCase()
}
