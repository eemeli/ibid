'use strict'
const getParserOpts = require('./parser-opts')
const getWhatBump = require('./what-bump')
const getWriterOpts = require('./writer-opts')

module.exports = async function getPreset(parameter) {
  // parameter passed can be either a config object or a callback function
  const config = parameter && typeof parameter === 'object' ? parameter : {}
  const parserOpts = getParserOpts(config)
  const writerOpts = await getWriterOpts(config)

  const preset = {
    conventionalChangelog: { parserOpts, writerOpts },
    parserOpts,
    recommendedBumpOpts: {
      parserOpts,
      whatBump: getWhatBump(config)
    },
    writerOpts
  }
  if (typeof parameter === 'function') {
    preset.gitRawCommitsOpts = { noMerges: null }
    parameter(null, preset)
  } else return preset
}
