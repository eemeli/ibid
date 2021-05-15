'use strict'

const compareFunc = require('compare-func')
const { readFile } = require('fs').promises
const { resolve } = require('path')
const addBangNotes = require('./add-bang-notes')

module.exports = async function getWriterOpts(config) {
  config = defaultConfig(config)
  const tmplDir = resolve(__dirname, 'templates')
  const templates = await getTemplates(config, tmplDir)

  return {
    groupBy: 'type',
    // the groupings of commit messages, e.g., Features vs., Bug Fixes, are
    // sorted based on their probable importance:
    commitGroupsSort: (a, b) => {
      const commitGroupOrder = [
        'Reverts',
        'Performance Improvements',
        'Bug Fixes',
        'Features'
      ]
      const gRankA = commitGroupOrder.indexOf(a.title)
      const gRankB = commitGroupOrder.indexOf(b.title)
      if (gRankA >= gRankB) {
        return -1
      } else {
        return 1
      }
    },
    commitsSort: ['scope', 'subject'],
    noteGroupsSort: 'title',
    notesSort: compareFunc,

    mainTemplate: templates.main,
    headerPartial: templates.header,
    commitPartial: templates.commit,
    footerPartial: templates.footer,

    transform: getTransform(config)
  }
}

// merge user set configuration with default configuration.
function defaultConfig(config) {
  config = config || {}
  config.types = config.types || [
    { type: 'feat', section: 'Features' },
    { type: 'feature', section: 'Features' },
    { type: 'fix', section: 'Bug Fixes' },
    { type: 'perf', section: 'Performance Improvements' },
    { type: 'revert', section: 'Reverts' },
    { type: 'docs', section: 'Documentation', hidden: true },
    { type: 'style', section: 'Styles', hidden: true },
    { type: 'chore', section: 'Miscellaneous Chores', hidden: true },
    { type: 'refactor', section: 'Code Refactoring', hidden: true },
    { type: 'test', section: 'Tests', hidden: true },
    { type: 'build', section: 'Build System', hidden: true },
    { type: 'ci', section: 'Continuous Integration', hidden: true }
  ]
  config.issueUrlFormat =
    config.issueUrlFormat || '{{host}}/{{owner}}/{{repository}}/issues/{{id}}'
  config.commitUrlFormat =
    config.commitUrlFormat ||
    '{{host}}/{{owner}}/{{repository}}/commit/{{hash}}'
  config.compareUrlFormat =
    config.compareUrlFormat ||
    '{{host}}/{{owner}}/{{repository}}/compare/{{previousTag}}...{{currentTag}}'
  config.userUrlFormat = config.userUrlFormat || '{{host}}/{{user}}'
  config.issuePrefixes = config.issuePrefixes || ['#']

  return config
}

async function getTemplates(config, tmplDir) {
  // Handlebar partials for various property substitutions based on commit context.
  const context = {
    host: '{{~@root.host}}',
    owner: '{{#if this.owner}}{{~this.owner}}{{else}}{{~@root.owner}}{{/if}}',
    repository:
      '{{#if this.repository}}{{~this.repository}}{{else}}{{~@root.repository}}{{/if}}'
  }

  const commitUrlFormat = expandTemplate(config.commitUrlFormat, context)
  const compareUrlFormat = expandTemplate(config.compareUrlFormat, context)
  Object.assign(context, { id: '{{this.issue}}', prefix: '{{this.prefix}}' })
  const issueUrlFormat = expandTemplate(config.issueUrlFormat, context)

  const main = await readFile(resolve(tmplDir, 'template.hbs'), 'utf8')
  const header = await readFile(resolve(tmplDir, 'header.hbs'), 'utf8')
  const commit = await readFile(resolve(tmplDir, 'commit.hbs'), 'utf8')
  const footer = await readFile(resolve(tmplDir, 'footer.hbs'), 'utf8')

  return {
    main,
    header: header.replace(/{{compareUrlFormat}}/g, compareUrlFormat),
    commit: commit
      .replace(/{{commitUrlFormat}}/g, commitUrlFormat)
      .replace(/{{issueUrlFormat}}/g, issueUrlFormat),
    footer
  }
}

function getTransform(config) {
  return (commit, context) => {
    let discard = true
    const issues = []
    const entry = findTypeEntry(config.types, commit)

    // adds additional breaking change notes
    // for the special case, test(system)!: hello world, where there is
    // a '!' but no 'BREAKING CHANGE' in body:
    addBangNotes(commit)

    commit.notes.forEach(note => {
      note.title = 'BREAKING CHANGES'
      discard = false
    })

    // breaking changes attached to any type are still displayed.
    if (discard && (entry === undefined || entry.hidden)) return

    if (entry) commit.type = entry.section
    if (commit.scope === '*') commit.scope = ''
    if (typeof commit.hash === 'string')
      commit.shortHash = commit.hash.substring(0, 7)

    if (typeof commit.subject === 'string') {
      // Issue URLs.
      const re = new RegExp(`(${config.issuePrefixes.join('|')})([0-9]+)`, 'g')
      commit.subject = commit.subject.replace(re, (issue, prefix, id) => {
        issues.push(issue)
        const url = expandTemplate(config.issueUrlFormat, {
          host: context.host,
          owner: context.owner,
          repository: context.repository,
          id,
          prefix
        })
        return `[${issue}](${url})`
      })

      // User URLs.
      commit.subject = commit.subject.replace(
        /\B@([a-z0-9](?:-?[a-z0-9/]){0,38})/g,
        (_, user) => {
          // TODO: investigate why this code exists.
          if (user.includes('/')) return `@${user}`

          const usernameUrl = expandTemplate(config.userUrlFormat, {
            host: context.host,
            owner: context.owner,
            repository: context.repository,
            user
          })

          return `[@${user}](${usernameUrl})`
        }
      )
    }

    // remove references that already appear in the subject
    commit.references = commit.references.filter(
      reference => !issues.includes(reference.prefix + reference.issue)
    )

    return commit
  }
}

function findTypeEntry(types, commit) {
  const typeKey = (commit.revert ? 'revert' : commit.type || '').toLowerCase()
  return types.find(
    entry =>
      entry.type === typeKey && (!entry.scope || entry.scope === commit.scope)
  )
}

// expand on the simple mustache-style templates supported in
// configuration (we may eventually want to use handlebars for this).
function expandTemplate(template, context) {
  let expanded = template
  Object.entries(context).forEach(([key, value]) => {
    expanded = expanded.replace(new RegExp(`{{${key}}}`, 'g'), value)
  })
  return expanded
}
