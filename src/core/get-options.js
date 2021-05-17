'use strict'

module.exports = function getOptions(optionsArg) {
  const options = Object.assign(
    {
      append: false,
      config: null,
      debug: () => {},
      lernaPackage: null,
      outputUnreleased: false,
      pkg: null,
      preset: null,
      releaseCount: 1,
      skipUnstable: false,
      tagPrefix: null,
      transform: null,
      warn: null
    },
    optionsArg
  )
  if (!options.pkg || !options.pkg.transform)
    options.pkg = { ...options.pkg, transform: pkg => pkg }
  if (!options.transform) options.transform = getTransform(options.tagPrefix)
  if (!options.warn) options.warn = options.debug
  return options
}

function getTransform(tagPrefix) {
  const rtag = tagPrefix
    ? new RegExp(`tag:\\s*[=]?${tagPrefix}(.+?)[,)]`, 'gi')
    : /tag:\s*[v=]?(.+?)[,)]/gi

  return function transform(commit, cb) {
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
  }
}
