'use strict'

const addStream = require('add-stream')
const gitRawCommits = require('git-raw-commits')
const _ = require('lodash')
const { Readable } = require('stream')
const { promisify } = require('util')
const execFile = promisify(require('child_process').execFile)

const parseMessage = require('../message-parser/index')
const writer = require('../writer/writer')
const getConfig = require('./get-config')
const getContext = require('./get-context')
const getOptions = require('./get-options')
const mergeConfig = require('./merge-config')

async function core(optionsArg, contextArg) {
  const options = getOptions(optionsArg)

  let config
  try {
    config = await getConfig(options)
  } catch (error) {
    options.warn('getConfig: ' + error)
  }

  const context = await getContext(options, {
    ...contextArg,
    ...config.context
  })

  const {
    gitRawCommitsOpts,
    parserOpts,
    writerOpts
  } = await mergeConfig(options, config, context)

  let commitsStream = new Readable({ objectMode: true, read() {} })

  try {
    await execFile('git', ['rev-parse', '--verify', 'HEAD'], {
      stdio: 'ignore'
    })
    let reverseTags = context.gitSemverTags.slice(0).reverse()
    reverseTags.push('HEAD')

    if (gitRawCommitsOpts.from) {
      const idx = reverseTags.indexOf(gitRawCommitsOpts.from)
      reverseTags =
        idx !== -1 ? reverseTags.slice(idx) : [gitRawCommitsOpts.from, 'HEAD']
    }

    let streams = reverseTags.map((to, i) => {
      const from = i > 0 ? reverseTags[i - 1] : ''
      const opt = _.merge({}, gitRawCommitsOpts, { from, to })
      return gitRawCommits(opt).on('error', err => commitsStream.destroy(err))
    })

    if (gitRawCommitsOpts.from) streams = streams.slice(1)
    if (gitRawCommitsOpts.reverse) streams.reverse()

    streams
      .reduce((prev, next) => next.pipe(addStream(prev)))
      .on('data', data => commitsStream.push(data))
      .on('end', () => commitsStream.push(null))
  } catch (_e) {
    commitsStream = gitRawCommits(
      gitRawCommitsOpts,
      config.gitRawExecOpts || {}
    )
  }

  const commits = []
  await new Promise((resolve, reject) => {
    commitsStream
      .on('error', error => {
        error.message = 'Error in git-raw-commits: ' + error.message
        reject(error)
      })
      .on('data', chunk => {
        commits.push(chunk instanceof Buffer ? chunk.toString() : chunk)
      })
      .on('end', resolve)
  })
  if (commits.length === 0) return null

  let parsed
  try {
    parsed = commits.map(commit => parseMessage(commit, parserOpts))
  } catch (error) {
    error.message = 'Error in conventional-commits-parser: ' + error.message
    throw error
  }

  try {
    // it would be better if `gitRawCommits` could spit out better
    // formatted data so we don't need to transform here
    const tf = promisify(options.transform)
    for (const commit of parsed) await tf(commit)
  } catch (error) {
    error.message = 'Error in options.transform: ' + error.message
    throw error
  }

  try {
    return writer(parsed, context, writerOpts)
  } catch (error) {
    error.message = 'Error in conventional-changelog-writer: ' + error.message
    throw error
  }
}

module.exports = core
