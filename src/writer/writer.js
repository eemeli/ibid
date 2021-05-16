'use strict'

const { resolve } = require('path')
const { readFileSync } = require('fs')
const semverValid = require('semver').valid

const { functionify, generate, processCommit } = require('./util')

function getUTCDate(date) {
  if (!(date instanceof Date)) date = new Date(date)
  return date.toISOString().substring(0, 10)
}

function init(contextArg, optionsArg) {
  const context = Object.assign(
    { commit: 'commits', issue: 'issues', date: getUTCDate(new Date()) },
    contextArg
  )

  if (
    typeof context.linkReferences !== 'boolean' &&
    (context.repository || context.repoUrl) &&
    context.commit &&
    context.issue
  ) {
    context.linkReferences = true
  }

  const tmplDir = resolve(__dirname, 'templates')
  const options = Object.assign(
    {
      groupBy: 'type',
      commitsSort: 'header',
      noteGroupsSort: 'title',
      notesSort: 'text',
      generateOn: commit => semverValid(commit.version),
      finalizeContext: context => context,
      debug: () => {},
      reverse: false,
      ignoreReverted: true,
      mainTemplate: readFileSync(resolve(tmplDir, 'template.hbs'), 'utf-8'),
      headerPartial: readFileSync(resolve(tmplDir, 'header.hbs'), 'utf-8'),
      commitPartial: readFileSync(resolve(tmplDir, 'commit.hbs'), 'utf-8'),
      footerPartial: readFileSync(resolve(tmplDir, 'footer.hbs'), 'utf-8'),
      transform: undefined
    },
    optionsArg
  )

  if (
    typeof options.transform === 'object' ||
    options.transform === undefined
  ) {
    options.transform = Object.assign(
      {
        hash: hash =>
          typeof hash === 'string' ? hash.substring(0, 7) : undefined,
        header: header => header.substring(0, 100),
        committerDate: date => (date ? getUTCDate(date) : undefined)
      },
      options.transform
    )
  }

  let { generateOn } = options
  if (typeof generateOn === 'string')
    generateOn = commit => commit[options.generateOn] !== undefined
  else if (typeof generateOn !== 'function') generateOn = () => false

  options.commitGroupsSort = functionify(options.commitGroupsSort)
  options.commitsSort = functionify(options.commitsSort)
  options.noteGroupsSort = functionify(options.noteGroupsSort)
  options.notesSort = functionify(options.notesSort)

  return { context, options, generateOn }
}

/**
 * Given an array of commits, returns a string representing a CHANGELOG entry.
 */
module.exports = function writer(rawCommits, contextArg, optionsArg) {
  const { context, options, generateOn } = init(contextArg, optionsArg)
  let commits = []
  let savedKeyCommit
  const entries = []
  if (options.reverse) rawCommits = rawCommits.slice().reverse()
  for (const rawCommit of rawCommits) {
    const commit = processCommit(rawCommit, options.transform, context)
    const keyCommit = commit || rawCommit
    if (generateOn(keyCommit, commits, context, options)) {
      entries.push(generate(options, commits, context, savedKeyCommit))
      savedKeyCommit = keyCommit
      commits = []
    }
    if (commit) commits.push(commit)
  }

  const res = generate(options, commits, context, savedKeyCommit)
  if (options.reverse) return res + entries.reverse().join('')
  return entries.join('') + res
}
