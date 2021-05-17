'use strict'

const { isAbsolute } = require('path')

/**
 * Rather than a string preset name, options.preset can be an object
 * with a "name" key indicating the preset to load; additional key/value
 * pairs are assumed to be configuration for the preset. See the documentation
 * for a given preset for configuration available.
 */
module.exports = function resolvePreset(path) {
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
