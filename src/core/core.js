'use strict'

const addStream = require('add-stream')
const { execFileSync } = require('child_process')
const gitRawCommits = require('git-raw-commits')
const conventionalCommitsParser = require('conventional-commits-parser')
const conventionalChangelogWriter = require('conventional-changelog-writer')
const _ = require('lodash')
const { Readable } = require('stream')
const through = require('through2')
const mergeConfig = require('./merge-config')

function conventionalChangelog(
  optionsArg,
  contextArg,
  gitRawCommitsOptsArg,
  parserOptsArg,
  writerOptsArg,
  gitRawExecOpts
) {
  const readable = new Readable({ objectMode: false })
  readable._read = function () {}

  mergeConfig(
    optionsArg,
    contextArg,
    gitRawCommitsOptsArg,
    parserOptsArg,
    writerOptsArg
  )
    .then(({ options, context, gitRawCommitsOpts, parserOpts, writerOpts }) => {
      let commitsStream = new Readable({ objectMode: true })
      commitsStream._read = function () {}

      let commitsErrorThrown = false
      function commitsRange(from, to) {
        return gitRawCommits(_.merge({}, gitRawCommitsOpts, { from, to })).on(
          'error',
          err => {
            if (!commitsErrorThrown) {
              setImmediate(commitsStream.emit.bind(commitsStream), 'error', err)
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

      commitsStream
        .on('error', function (err) {
          err.message = 'Error in git-raw-commits: ' + err.message
          setImmediate(readable.emit.bind(readable), 'error', err)
        })
        .pipe(conventionalCommitsParser(parserOpts))
        .on('error', function (err) {
          err.message = 'Error in conventional-commits-parser: ' + err.message
          setImmediate(readable.emit.bind(readable), 'error', err)
        })
        // it would be better if `gitRawCommits` could spit out better formatted data
        // so we don't need to transform here
        .pipe(
          through.obj(function (chunk, enc, cb) {
            try {
              options.transform.call(this, chunk, cb)
            } catch (err) {
              cb(err)
            }
          })
        )
        .on('error', function (err) {
          err.message = 'Error in options.transform: ' + err.message
          setImmediate(readable.emit.bind(readable), 'error', err)
        })
        .pipe(conventionalChangelogWriter(context, writerOpts))
        .on('error', function (err) {
          err.message = 'Error in conventional-changelog-writer: ' + err.message
          setImmediate(readable.emit.bind(readable), 'error', err)
        })
        .pipe(
          through(
            { objectMode: false },
            (chunk, enc, cb) => {
              try {
                readable.push(chunk)
              } catch (err) {
                setImmediate(() => {
                  throw err
                })
              }
              cb()
            },
            cb => {
              readable.push(null)
              cb()
            }
          )
        )
    })
    .catch(err => setImmediate(readable.emit.bind(readable), 'error', err))

  return readable
}

module.exports = conventionalChangelog
