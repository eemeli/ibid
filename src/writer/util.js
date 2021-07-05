'use strict'
const Handlebars = require('handlebars')
const semver = require('semver')
const _ = require('lodash')
const stringify = require('json-stringify-safe')

const { filterReverted } = require('../commits/filter-reverted')

function compileTemplates({
  mainTemplate,
  headerPartial,
  commitPartial,
  footerPartial,
  partials
}) {
  if (typeof headerPartial === 'string')
    Handlebars.registerPartial('header', headerPartial)
  if (typeof commitPartial === 'string')
    Handlebars.registerPartial('commit', commitPartial)
  if (typeof footerPartial === 'string')
    Handlebars.registerPartial('footer', footerPartial)
  if (partials)
    for (const [name, partial] of Object.entries(partials))
      Handlebars.registerPartial(name, partial)
  return Handlebars.compile(mainTemplate, { noEscape: true })
}

function functionify(strOrArr) {
  if (!strOrArr || typeof strOrArr === 'function') return strOrArr
  if (Array.isArray(strOrArr))
    return (a, b) => {
      let str1 = ''
      let str2 = ''
      for (const key of strOrArr) {
        str1 += a[key] || ''
        str2 += b[key] || ''
      }
      return str1.localeCompare(str2)
    }
  return (a, b) => a[strOrArr].localeCompare(b[strOrArr])
}

function getCommitGroups(groupBy, commits, groupsSort, commitsSort) {
  const commitGroupsObj = _.groupBy(commits, commit => commit[groupBy] || '')
  const commitGroups = Object.entries(commitGroupsObj).map(
    ([title, commits]) => ({
      title: title === '' ? false : title,
      commits: commitsSort ? commits.sort(commitsSort) : commits
    })
  )
  if (groupsSort) commitGroups.sort(groupsSort)
  return commitGroups
}

function getNoteGroups(notes, noteGroupsSort, notesSort) {
  const retGroups = []
  for (const note of notes) {
    const title = note.title
    let titleExists = false
    for (const group of retGroups) {
      if (group.title === title) {
        titleExists = true
        group.notes.push(note)
        break
      }
    }
    if (!titleExists) retGroups.push({ title, notes: [note] })
  }
  if (noteGroupsSort) retGroups.sort(noteGroupsSort)
  if (notesSort) for (const group of retGroups) group.notes.sort(notesSort)
  return retGroups
}

function processCommit(chunk, transform, context) {
  try {
    chunk = JSON.parse(chunk)
  } catch (e) {
    // ignore any error
  }

  const commit = _.cloneDeep(chunk)
  if (typeof transform === 'function') {
    const tc = transform(commit, context)
    if (tc) tc.raw = chunk
    return tc
  }
  if (transform)
    for (const [path, el] of Object.entries(transform)) {
      const value =
        typeof el === 'function' ? el(_.get(commit, path), path) : el
      _.set(commit, path, value)
    }
  commit.raw = chunk
  return commit
}

function getExtraContext(commits, notes, options) {
  // group `commits` by `options.groupBy`
  const commitGroups = getCommitGroups(
    options.groupBy,
    commits,
    options.commitGroupsSort,
    options.commitsSort
  )

  // group `notes` for footer
  const noteGroups = getNoteGroups(
    notes,
    options.noteGroupsSort,
    options.notesSort
  )

  return { commitGroups, noteGroups }
}

function generate(options, commits, context, keyCommit) {
  let notes = []
  const compiled = compileTemplates(options)

  const filteredCommits = options.ignoreReverted
    ? filterReverted(commits)
    : _.clone(commits)

  for (const commit of filteredCommits) {
    for (const note of commit.notes) note.commit = commit
    notes = notes.concat(commit.notes)
  }

  context = _.merge(
    {},
    context,
    keyCommit,
    getExtraContext(filteredCommits, notes, options)
  )

  if (keyCommit && keyCommit.committerDate)
    context.date = keyCommit.committerDate
  if (context.version && semver.valid(context.version))
    context.isPatch = context.isPatch || semver.patch(context.version) !== 0
  context = options.finalizeContext(
    context,
    options,
    filteredCommits,
    keyCommit,
    commits
  )
  options.debug('Your final context is:\n' + stringify(context, null, 2))
  return compiled(context)
}

module.exports = {
  functionify,
  generate,
  processCommit,

  compileTemplates,
  getCommitGroups,
  getNoteGroups,
  getExtraContext
}
