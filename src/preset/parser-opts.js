'use strict'

module.exports = function getParserOpts(config) {
  return { issuePrefixes: (config && config.issuePrefixes) || ['#'] }
}
