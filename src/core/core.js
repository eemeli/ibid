'use strict'

const addStream = require('add-stream')
const { execFileSync } = require('child_process')
const gitRawCommits = require('git-raw-commits')
const conventionalCommitsParser = require('conventional-commits-parser')
const writer = require('../writer/writer')
const _ = require('lodash')
const { Readable } = require('stream')
const { promisify } = require('util')
const mergeConfig = require('./merge-config')

function conventionalChangelog(
  optionsArg,
  contextArg,
  gitRawCommitsOptsArg,
  parserOptsArg,
  writerOptsArg,
  gitRawExecOpts
) {
  const readable = new Readable({ objectMode: false, read() {} })

  mergeConfig(
    optionsArg,
    contextArg,
    gitRawCommitsOptsArg,
    parserOptsArg,
    writerOptsArg
  )
    .then(
      async ({
        options,
        context,
        gitRawCommitsOpts,
        parserOpts,
        writerOpts
      }) => {
        let commitsStream = new Readable({ objectMode: true })
        commitsStream._read = function () {}

        let commitsErrorThrown = false
        function commitsRange(from, to) {
          return gitRawCommits(_.merge({}, gitRawCommitsOpts, { from, to })).on(
            'error',
            err => {
              if (!commitsErrorThrown) {
                setImmediate(
                  commitsStream.emit.bind(commitsStream),
                  'error',
                  err
                )
                commitsErrorThrown = true
              }
            }
          )
        }

        try {
          execFileSync('git', ['rev-parse', '--verify', 'HEAD'], {
            stdio: 'ignore'
          })
          let reverseTags = context.gitSemverTags.slice(0).reverse()
          reverseTags.push('HEAD')

          if (gitRawCommitsOpts.from) {
            const idx = reverseTags.indexOf(gitRawCommitsOpts.from)
            reverseTags =
              idx !== -1
                ? reverseTags.slice(idx)
                : [gitRawCommitsOpts.from, 'HEAD']
          }

          let streams = reverseTags.map((to, i) => {
            const from = i > 0 ? reverseTags[i - 1] : ''
            return commitsRange(from, to)
          })

          if (gitRawCommitsOpts.from) streams = streams.splice(1)
          if (gitRawCommitsOpts.reverse) streams.reverse()

          streams
            .reduce((prev, next) => next.pipe(addStream(prev)))
            .on('data', function (data) {
              setImmediate(commitsStream.emit.bind(commitsStream), 'data', data)
            })
            .on('end', function () {
              setImmediate(commitsStream.emit.bind(commitsStream), 'end')
            })
        } catch (_e) {
          commitsStream = gitRawCommits(gitRawCommitsOpts, gitRawExecOpts || {})
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

        if (commits.length > 0) {
          let parsed
          try {
            parsed = commits.map(commit =>
              conventionalCommitsParser.sync(commit, parserOpts)
            )
          } catch (error) {
            error.message =
              'Error in conventional-commits-parser: ' + error.message
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

          let changelog
          try {
            changelog = writer(parsed, context, writerOpts)
          } catch (error) {
            error.message =
              'Error in conventional-changelog-writer: ' + error.message
            throw error
          }

          readable.push(changelog)
        }

        readable.push(null)
      }
    )
    .catch(error => readable.destroy(error))

  return readable
}

module.exports = conventionalChangelog
