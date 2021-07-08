import { expect } from 'chai'
import { beforeEach, describe, it } from 'mocha'

import { CommitMessage } from './commit-message'
import { ReferenceOptions } from './commit-message-references'

describe('new CommitMessage', () => {
  it('should work', () => {
    const commit =
      'feat(ng-list): Allow custom separator\n\n' +
      'bla bla bla\n\n' +
      'Closes #123\nCloses #25\nFixes #33\n'
    const result = new CommitMessage(commit)

    expect(result.header).to.equal('feat(ng-list): Allow custom separator')
    expect(result.footer).to.eql([
      { token: 'Closes', value: '#123' },
      { token: 'Closes', value: '#25' },
      { token: 'Fixes', value: '#33' }
    ])
    expect(result.references).to.eql([
      {
        raw: 'Closes #123',
        action: 'Closes',
        scope: null,
        prefix: '#',
        issue: '123'
      },
      {
        raw: 'Closes #25',
        action: 'Closes',
        scope: null,
        prefix: '#',
        issue: '25'
      },
      {
        raw: 'Fixes #33',
        action: 'Fixes',
        scope: null,
        prefix: '#',
        issue: '33'
      }
    ])
  })

  it('should parse raw commits', () => {
    const commits = [
      'feat(ng-list): Allow custom separator\n\n' +
        'bla bla bla\n\n' +
        'Closes #123\nCloses #25\nFixes #33\n',

      'feat(scope): broadcast $destroy event on scope destruction\n\n' +
        'bla bla bla\n\n' +
        'BREAKING CHANGE: some breaking change\n',

      'fix(zzz): Very cool commit\n\n' +
        'bla bla bla\n\n' +
        'Closes #2, #3. Resolves #4. Fixes #5. Fixes #6.\n' +
        'What not ?\n',

      'chore(scope with spaces): some chore\n\n' +
        'bla bla bla\n\n' +
        'BREAKING CHANGE: some other breaking change\n',

      'Revert "throw an error if a callback is passed to animate methods"\n\n' +
        'This reverts commit 9bb4d6ccbe80b7704c6b7f53317ca8146bc103ca.\n\n' +
        '-hash-\n' +
        'd7a40a29214f37d469e57d730dfd042b639d4d1f'
    ]

    expect(new CommitMessage(commits[0]).header).to.equal(
      'feat(ng-list): Allow custom separator'
    )
    expect(new CommitMessage(commits[1]).footer).to.eql([
      { token: 'BREAKING CHANGE', value: 'some breaking change' }
    ])
    expect(new CommitMessage(commits[2]).header).to.equal(
      'fix(zzz): Very cool commit'
    )
    expect(new CommitMessage(commits[3]).header).to.equal(
      'chore(scope with spaces): some chore'
    )
    expect(new CommitMessage(commits[4]).revert).to.eql({
      header: 'throw an error if a callback is passed to animate methods',
      hash: '9bb4d6ccbe80b7704c6b7f53317ca8146bc103ca'
    })
  })

  describe('options', () => {
    it('should take options', () => {
      const commits = [
        'feat(ng-list): Allow custom separator\n\n' +
          'bla bla bla\n\n' +
          'Fix #123\nCloses #25\nfix #33\n',

        'fix(ng-list): Another custom separator\n\n' +
          'bla bla bla\n\n' +
          'BREAKING CHANGE: some breaking changes\n'
      ]

      const options = {
        referenceActions: ['fix']
      }

      let chunk = new CommitMessage(commits[0], options)
      expect(chunk.type).to.equal('feat')
      expect(chunk.scope).to.equal('ng-list')
      expect(chunk.subject).to.equal('Allow custom separator')
      expect(chunk.references).to.eql([
        {
          action: 'Fix',
          scope: null,
          issue: '123',
          raw: 'Fix #123',
          prefix: '#'
        },
        {
          action: null,
          scope: null,
          issue: '25',
          raw: '#25',
          prefix: '#'
        },
        {
          action: 'fix',
          scope: null,
          issue: '33',
          raw: 'fix #33',
          prefix: '#'
        }
      ])

      chunk = new CommitMessage(commits[1], options)
      expect(chunk.type).to.equal('fix')
      expect(chunk.scope).to.equal('ng-list')
      expect(chunk.subject).to.equal('Another custom separator')
      expect(chunk.footer[0]).to.eql({
        token: 'BREAKING CHANGE',
        value: 'some breaking changes'
      })
    })
  })

  describe('header', () => {
    it('should parse references from header', () => {
      const result = new CommitMessage('Subject #1')

      expect(result.references).to.eql([
        { action: null, issue: '1', scope: null, prefix: '#', raw: '#1' }
      ])
    })

    it('should parse slash in the header', () => {
      const result = new CommitMessage('feat(hello/world): message')

      expect(result.type).to.equal('feat')
      expect(result.scope).to.equal('hello/world')
      expect(result.subject).to.equal('message')
    })
  })
})

describe('errors', () => {
  it('should ignore malformed commits', () => {
    const commits = [
      'chore(scope with spaces): some chore\n',
      'fix(zzz): Very cool commit\n' + 'bla bla bla\n\n'
    ]
    for (const commit of commits)
      expect(() => new CommitMessage(commit)).not.to.throw()
  })
})

describe('parser', function () {
  let options: ReferenceOptions
  let msg: CommitMessage
  let simpleMsg: CommitMessage
  let headerOnlyMsg: CommitMessage

  beforeEach(function () {
    options = {
      issuePrefixes: ['#', 'gh-'],
      referenceActions: [
        'kill',
        'kills',
        'killed',
        'handle',
        'handles',
        'handled'
      ]
    }

    msg = new CommitMessage(
      'feat(scope): broadcast $destroy event on scope destruction\n\n' +
        'perf testing shows that in chrome this change adds 5-15% overhead\n' +
        'when destroying 10k nested scopes where each scope has a $destroy listener\n\n' +
        'BREAKING CHANGE: some breaking change\n' +
        'Kills #1, #123\n' +
        'killed #25\n' +
        'handle #33, Closes #100, Handled #3 kills repo#77\n' +
        'kills stevemao/conventional-commits-parser#1',
      options
    )

    simpleMsg = new CommitMessage('chore: some chore\n', options)

    headerOnlyMsg = new CommitMessage('header', options)
  })

  it('should trim extra newlines', function () {
    const msg = new CommitMessage(
      '\n\n\n\n\n\n\nfeat(scope): broadcast $destroy event on scope destruction\n\n\n' +
        '\n\n\nperf testing shows that in chrome this change adds 5-15% overhead\n' +
        '\n\n\nwhen destroying 10k nested scopes where each scope has a $destroy listener\n\n' +
        '\n\n\n\nBREAKING CHANGE: some breaking change\n' +
        '\n\n\n\nBREAKING CHANGE: An awesome breaking change\n\n\n```\ncode here\n```' +
        '\n\nKills #1\n' +
        '\n\n\nkilled #25\n\n\n\n\n',
      options
    )

    expect(msg).to.deep.include({
      header: 'feat(scope): broadcast $destroy event on scope destruction',
      body:
        'perf testing shows that in chrome this change adds 5-15% overhead\n\nwhen destroying 10k nested scopes where each scope has a $destroy listener',
      footer: [
        { token: 'BREAKING CHANGE', value: 'some breaking change' },
        {
          token: 'BREAKING CHANGE',
          value: 'An awesome breaking change\n\n```\ncode here\n```'
        },
        { token: 'Kills', value: '#1' },
        { token: 'killed', value: '#25' }
      ],
      scope: 'scope',
      subject: 'broadcast $destroy event on scope destruction',
      type: 'feat',
      breaking: 'some breaking change'
    })
    expect(msg.mentions).to.eql([])
    expect(msg.references).to.eql([
      {
        action: 'Kills',
        scope: null,
        issue: '1',
        raw: 'Kills #1',
        prefix: '#'
      },
      {
        action: 'killed',
        scope: null,
        issue: '25',
        raw: 'killed #25',
        prefix: '#'
      }
    ])
  })

  it('should trim spaces when appropriate', function () {
    const msg = new CommitMessage(
      ' feat(scope): broadcast $destroy event on scope destruction \n\n' +
        ' perf testing shows that in chrome this change adds 5-15% overhead \n\n' +
        ' when destroying 10k nested scopes where each scope has a $destroy listener \n\n' +
        '         BREAKING CHANGE: some breaking change         \n\n' +
        '   BREAKING CHANGE: An awesome breaking change\n\n\n```\ncode here\n```' +
        '\n\n    Kills   #1\n',
      options
    )

    expect(msg).to.deep.include({
      header: 'feat(scope): broadcast $destroy event on scope destruction',
      body:
        'perf testing shows that in chrome this change adds 5-15% overhead\n\n when destroying 10k nested scopes where each scope has a $destroy listener',
      footer: [
        { token: 'BREAKING CHANGE', value: 'some breaking change' },
        {
          token: 'BREAKING CHANGE',
          value: 'An awesome breaking change\n\n```\ncode here\n```'
        },
        { token: 'Kills', value: '#1' }
      ],
      scope: 'scope',
      subject: 'broadcast $destroy event on scope destruction',
      type: 'feat'
    })
    expect(msg.references).to.eql([
      {
        action: 'Kills',
        scope: null,
        issue: '1',
        raw: 'Kills   #1',
        prefix: '#'
      }
    ])
  })

  describe('mentions', function () {
    it('should mention someone in the commit', function () {
      const msg = new CommitMessage(
        '@Steve\n' +
          '@conventional-changelog @someone' +
          '\n' +
          'perf testing shows that in chrome this change adds 5-15% overhead\n' +
          '@this is'
      )

      expect(msg.mentions).to.eql([
        'Steve',
        'conventional-changelog',
        'someone',
        'this'
      ])
    })
  })

  describe('header', function () {
    it('should allow ":" in scope', function () {
      const msg = new CommitMessage('feat(ng:list): Allow custom separator', {})
      expect(msg.scope).to.equal('ng:list')
    })

    it('type & scope should be null if not captured', function () {
      expect(headerOnlyMsg.type).to.equal(null)
      expect(headerOnlyMsg.scope).to.equal(null)
    })

    it('subject should be header if type & scope not captured', function () {
      expect(headerOnlyMsg.subject).to.equal(headerOnlyMsg.header)
    })

    it('should parse header', function () {
      expect(msg.header).to.equal(
        'feat(scope): broadcast $destroy event on scope destruction'
      )
    })

    it('should understand header parts', function () {
      expect(msg.type).to.equal('feat')
      expect(msg.scope).to.equal('scope')
      expect(msg.subject).to.equal(
        'broadcast $destroy event on scope destruction'
      )
    })

    it('should reference an issue with an owner', function () {
      const msg = new CommitMessage('handled angular/angular.js#1', options)
      expect(msg.references).to.eql([
        {
          action: 'handled',
          scope: 'angular/angular.js',
          issue: '1',
          raw: 'handled angular/angular.js#1',
          prefix: '#'
        }
      ])
    })

    it('should reference an issue with a repository', function () {
      const msg = new CommitMessage('handled angular.js#1', options)
      expect(msg.references).to.eql([
        {
          action: 'handled',
          scope: 'angular.js',
          issue: '1',
          raw: 'handled angular.js#1',
          prefix: '#'
        }
      ])
    })

    it('should reference an issue without both', function () {
      const msg = new CommitMessage('handled gh-1', options)
      expect(msg.references).to.eql([
        {
          action: 'handled',
          scope: null,
          issue: '1',
          raw: 'handled gh-1',
          prefix: 'gh-'
        }
      ])
    })

    it('should reference an issue without an action', function () {
      const options = {
        issuePrefixes: ['#', 'gh-']
      }

      const msg = new CommitMessage('This is gh-1', options)
      expect(msg.references).to.eql([
        {
          action: null,
          scope: null,
          issue: '1',
          raw: 'gh-1',
          prefix: 'gh-'
        }
      ])
    })
  })

  describe('body', function () {
    it('should parse body', function () {
      expect(msg.body).to.equal(
        'perf testing shows that in chrome this change adds 5-15% overhead\n' +
          'when destroying 10k nested scopes where each scope has a $destroy listener'
      )
    })

    it('should be empty string if not found', function () {
      expect(headerOnlyMsg.body).to.equal('')
    })
  })

  describe('footer', function () {
    it('should be empty array if not found', function () {
      expect(headerOnlyMsg.footer).to.eql([])
    })

    it('should parse footer', function () {
      expect(msg.footer).to.eql([
        { token: 'BREAKING CHANGE', value: 'some breaking change' },
        { token: 'Kills', value: '#1, #123' },
        { token: 'killed', value: '#25' },
        {
          token: 'handle',
          value:
            '#33, Closes #100, Handled #3 kills repo#77\nkills stevemao/conventional-commits-parser#1'
        }
      ])
    })

    it('important notes should be an empty string if not found', function () {
      expect(simpleMsg.footer).to.eql([])
      expect(simpleMsg.breaking).to.eql(null)
    })

    it('should parse important notes', function () {
      expect(msg.breaking).to.eql('some breaking change')
    })

    it('should parse important notes with more than one paragraphs', function () {
      const longNoteMsg = new CommitMessage(
        'feat(scope): broadcast $destroy event on scope destruction\n\n' +
          'perf testing shows that in chrome this change adds 5-15% overhead\n' +
          'when destroying 10k nested scopes where each scope has a $destroy listener\n\n' +
          'BREAKING CHANGE:\n' +
          'some breaking change\n' +
          'some other breaking change\n' +
          'Kills #1, #123\n' +
          'killed #25\n' +
          'handle #33, Closes #100, Handled #3',
        options
      )

      expect(longNoteMsg.breaking).to.eql(
        'some breaking change\nsome other breaking change'
      )
    })

    it('should parse important notes that start with asterisks (for squash commits)', function () {
      const expectedText =
        'Previously multiple template bindings on one element\n' +
        "(ex. `<div *ngIf='..' *ngFor='...'>`) were allowed but most of the time\n" +
        'were leading to undesired result. It is possible that a small number\n' +
        'of applications will see template parse errors that shuld be fixed by\n' +
        'nesting elements or using `<template>` tags explicitly.'
      const text = expectedText + '\n' + 'Closes #9462'
      const msg = new CommitMessage(
        'fix(core): report duplicate template bindings in templates\n' +
          '\n' +
          'Fixes #7315\n' +
          '\n' +
          '* BREAKING CHANGE: \n' +
          '\n' +
          text,
        options
      )
      expect(msg.references.map(ref => ref.issue)).to.eql(['7315', '9462'])
      expect(msg.footer.map(ft => `${ft.token}: ${ft.value}`)).to.eql([
        'Fixes: #7315',
        `BREAKING CHANGE: ${expectedText}`,
        'Closes: #9462'
      ])
    })

    it('references should be empty if not found', function () {
      expect(simpleMsg.references).to.eql([])
    })

    it('should parse references', function () {
      expect(msg.references).to.eql([
        {
          action: 'Kills',
          scope: null,
          issue: '1',
          raw: 'Kills #1',
          prefix: '#'
        },
        {
          action: null,
          scope: null,
          issue: '123',
          raw: '#123',
          prefix: '#'
        },
        {
          action: 'killed',
          scope: null,
          issue: '25',
          raw: 'killed #25',
          prefix: '#'
        },
        {
          action: 'handle',
          scope: null,
          issue: '33',
          raw: 'handle #33',
          prefix: '#'
        },
        {
          action: null,
          scope: null,
          issue: '100',
          raw: '#100',
          prefix: '#'
        },
        {
          action: 'Handled',
          scope: null,
          issue: '3',
          raw: 'Handled #3',
          prefix: '#'
        },
        {
          action: 'kills',
          scope: 'repo',
          issue: '77',
          raw: 'kills repo#77',
          prefix: '#'
        },
        {
          action: 'kills',
          scope: 'stevemao/conventional-commits-parser',
          issue: '1',
          raw: 'kills stevemao/conventional-commits-parser#1',
          prefix: '#'
        }
      ])
    })

    it('should reference an issue without an action', function () {
      const options = {
        issuePrefixes: ['#', 'gh-']
      }

      const msg = new CommitMessage(
        'feat(scope): broadcast $destroy event on scope destruction\n\n' +
          'perf testing shows that in chrome this change adds 5-15% overhead\n' +
          'when destroying 10k nested scopes where each scope has a $destroy listener\n\n' +
          'Kills #1, gh-123\n' +
          'what\n' +
          '* #25\n' +
          '* #33, maybe gh-100, not sure about #3\n',
        options
      )

      expect(msg.references).to.eql([
        { action: null, scope: null, issue: '1', raw: '#1', prefix: '#' },
        {
          action: null,
          scope: null,
          issue: '123',
          raw: 'gh-123',
          prefix: 'gh-'
        },
        { action: null, scope: null, issue: '25', raw: '#25', prefix: '#' },
        { action: null, scope: null, issue: '33', raw: '#33', prefix: '#' },
        {
          action: null,
          scope: null,
          issue: '100',
          raw: 'gh-100',
          prefix: 'gh-'
        },
        { action: null, scope: null, issue: '3', raw: '#3', prefix: '#' }
      ])
    })

    it('should put everything after references in footer', function () {
      const msg = new CommitMessage(
        'feat(scope): broadcast $destroy event on scope destruction\n\n' +
          'perf testing shows that in chrome this change adds 5-15% overhead\n' +
          'when destroying 10k nested scopes where each scope has a $destroy listener\n\n' +
          'Kills #1, #123\n' +
          'what\n' +
          'killed #25\n' +
          'handle #33, Closes #100, Handled #3\n' +
          'other',
        options
      )

      expect(msg.footer).to.eql([
        { token: 'Kills', value: '#1, #123\nwhat' },
        { token: 'killed', value: '#25' },
        { token: 'handle', value: '#33, Closes #100, Handled #3\nother' }
      ])
    })

    it('should parse properly if important notes comes after references', function () {
      const msg = new CommitMessage(
        'feat(scope): broadcast $destroy event on scope destruction\n\n' +
          'perf testing shows that in chrome this change adds 5-15% overhead\n' +
          'when destroying 10k nested scopes where each scope has a $destroy listener\n\n' +
          'Kills #1, #123\n' +
          'BREAKING CHANGE: some breaking change\n',
        options
      )
      expect(msg.footer).to.eql([
        { token: 'Kills', value: '#1, #123' },
        { token: 'BREAKING CHANGE', value: 'some breaking change' }
      ])
      expect(msg.references).to.eql([
        {
          action: 'Kills',
          scope: null,
          issue: '1',
          raw: 'Kills #1',
          prefix: '#'
        },
        { action: null, scope: null, issue: '123', raw: '#123', prefix: '#' }
      ])
      expect(msg.breaking).to.equal('some breaking change')
    })

    it('should parse properly if important notes comes with more than one paragraphs after references', function () {
      const msg = new CommitMessage(
        'feat(scope): broadcast $destroy event on scope destruction\n\n' +
          'perf testing shows that in chrome this change adds 5-15% overhead\n' +
          'when destroying 10k nested scopes where each scope has a $destroy listener\n\n' +
          'Kills #1, #123\n' +
          'BREAKING CHANGE: some breaking change\nsome other breaking change',
        options
      )
      expect(msg.breaking).to.eql(
        'some breaking change\nsome other breaking change'
      )
    })

    it('should add the subject as note if it match breakingHeaderPattern', function () {
      const msg = new CommitMessage('feat!: breaking change feature', {})
      expect(msg.breaking).to.eql('breaking change feature')
      expect(msg.footer.length).to.eql(0)
    })

    it('should not duplicate notes if the subject match breakingHeaderPattern', function () {
      const msg = new CommitMessage(
        'feat!: breaking change feature\n\nBREAKING CHANGE: some breaking change',
        {}
      )
      expect(msg.breaking).to.eql('some breaking change')
      expect(msg.footer.length).to.eql(1)
    })
  })

  describe('revert', function () {
    it('should parse revert', function () {
      msg = new CommitMessage(
        'Revert "throw an error if a callback is passed to animate methods"\n\n' +
          'This reverts commit 9bb4d6ccbe80b7704c6b7f53317ca8146bc103ca.',
        options
      )

      expect(msg.revert).to.eql({
        header: 'throw an error if a callback is passed to animate methods',
        hash: '9bb4d6ccbe80b7704c6b7f53317ca8146bc103ca'
      })
    })

    it('should parse revert even if a field is missing', function () {
      msg = new CommitMessage(
        'Revert ""\n\n' + 'This reverts commit .',
        options
      )

      expect(msg.revert).to.eql({ header: null, hash: null })
    })
  })

  describe('footer', function () {
    it('should match a simple note', function () {
      const msg = new CommitMessage(
        'header\n\nBREAKING CHANGE: This is so important.'
      )
      expect(msg.footer).to.deep.equal([
        { token: 'BREAKING CHANGE', value: 'This is so important.' }
      ])
      expect(msg.breaking).to.equal('This is so important.')
    })

    it('should accept - instead of space', function () {
      const msg = new CommitMessage(
        'header\n\nBREAKING-CHANGE: This is so important.'
      )
      expect(msg.footer).to.deep.equal([
        { token: 'BREAKING-CHANGE', value: 'This is so important.' }
      ])
      expect(msg.breaking).to.equal('This is so important.')
    })

    it('should be case sensitive', function () {
      const msg = new CommitMessage(
        'header\n\nBreaking Change: This is so important.'
      )
      expect(msg.footer).to.deep.equal([])
      expect(msg.breaking).to.equal(null)
    })

    it('should not accidentally match in a sentence', function () {
      const msg = new CommitMessage(
        'header\n\nThis is a breaking change: So important.'
      )
      expect(msg.footer).to.deep.equal([])
      expect(msg.breaking).to.equal(null)
    })

    it('should not match if there is text after `noteKeywords`', function () {
      const msg = new CommitMessage(
        'header\n\nBREAKING CHANGES: This is so not important.'
      )
      expect(msg.footer).to.deep.equal([])
      expect(msg.breaking).to.equal(null)
    })
  })

  describe('references', function () {
    it('should match a simple header reference', function () {
      const { references } = new CommitMessage('closes #1\n')
      expect(references.length).to.equal(1)
      expect(references[0]).to.include({ action: 'closes', issue: '1' })
    })

    it('should be case insensitive', function () {
      const { references } = new CommitMessage('Closes #1\n')
      expect(references.length).to.equal(1)
      expect(references[0]).to.include({ action: 'Closes', issue: '1' })
    })

    it('should not match if keywords does not present', function () {
      const { references } = new CommitMessage('Closer #1\n')
      expect(references.length).to.equal(1)
      expect(references[0]).to.include({ action: null, issue: '1' })
    })

    it('should match multiple references', function () {
      const { references } = new CommitMessage(
        'Closes #1 resolves #2; closes bug #4'
      )
      expect(
        references.map(ref => `${ref.action} ${ref.issue}`)
      ).to.deep.equal(['Closes 1', 'resolves 2', 'null 4'])
    })

    it('should match references with mixed content, like JIRA tickets', function () {
      const { references } = new CommitMessage(
        'Closes #JIRA-123 fixes #MY-OTHER-PROJECT-123; closes bug #4'
      )
      expect(
        references.map(ref => `${ref.action} ${ref.issue}`)
      ).to.deep.equal([
        'Closes JIRA-123',
        'fixes MY-OTHER-PROJECT-123',
        'null 4'
      ])
    })

    it('should reference an issue without an action', function () {
      const { references } = new CommitMessage('gh-1, prefix-3, Closes gh-6')
      expect(references.length).to.equal(0)
    })

    it('should accept custom referenceActions', function () {
      const referenceActions = ['Closes', 'amends', 'fixes']
      const msg = new CommitMessage('closes #1, amends #2, Fixes #3', {
        referenceActions
      })
      expect(msg.references.map(ref => ref.raw)).to.eql([
        'closes #1',
        'amends #2',
        'Fixes #3'
      ])
    })
  })

  describe('referenceParts', function () {
    it('should match simple reference parts', function () {
      const { references } = new CommitMessage('#1')
      expect(references.length).to.equal(1)
      expect(references[0]).to.include({ issue: '1', prefix: '#' })
    })

    it('should reference an issue in parenthesis', function () {
      const { references } = new CommitMessage(
        '#27), pinned shelljs to version that works with nyc (#30)'
      )
      expect(references.length).to.equal(2)
      expect(references[0]).to.include({ issue: '27', prefix: '#' })
      expect(references[1]).to.include({ issue: '30', prefix: '#' })
    })

    it('should match reference parts with a repository', function () {
      const { references } = new CommitMessage('repo#1')
      expect(references.length).to.equal(1)
      expect(references[0]).to.include({
        issue: '1',
        prefix: '#',
        scope: 'repo'
      })
    })

    it('should match JIRA-123 like reference parts', function () {
      const { references } = new CommitMessage('#JIRA-123')
      expect(references.length).to.equal(1)
      expect(references[0]).to.include({ issue: 'JIRA-123', prefix: '#' })
    })

    it('should not match MY-€#%#&-123 mixed symbol reference parts', function () {
      const { references } = new CommitMessage('#MY-€#%#&-123')
      expect(references.length).to.equal(0)
    })

    it('should match reference parts with multiple references', function () {
      const { references } = new CommitMessage('#1 #2, something #3; repo#4')
      expect(references.length).to.equal(4)
      for (let i = 0; i < 4; ++i)
        expect(references[i]).to.include({
          issue: String(i + 1),
          prefix: '#'
        })
    })

    it('should match issues with customized prefix', function () {
      const { references } = new CommitMessage(
        'closes gh-1, resolves #2, fixes other-3',
        {
          issuePrefixes: ['gh-', 'other-']
        }
      )
      expect(references.length).to.equal(2)
      expect(references[0]).to.include({
        action: 'closes',
        issue: '1',
        prefix: 'gh-'
      })
      expect(references[1]).to.include({
        action: 'fixes',
        issue: '3',
        prefix: 'other-'
      })
    })

    it('should be case sensitive', function () {
      const { references } = new CommitMessage(
        'closes gh-1, resolves GH-2, fixes other-3',
        {
          issuePrefixes: ['GH-']
        }
      )
      expect(references.length).to.equal(1)
      expect(references[0]).to.include({
        action: 'resolves',
        issue: '2',
        prefix: 'GH-'
      })
    })
  })

  describe('mentions', function () {
    it('should match basic mention', function () {
      const { mentions } = new CommitMessage('Thanks!! @someone')
      expect(mentions).to.deep.equal(['someone'])
    })

    it('should match mention with hyphen', function () {
      const { mentions } = new CommitMessage('Thanks!! @some-one')
      expect(mentions).to.deep.equal(['some-one'])
    })

    it('should match mention with underscore', function () {
      const { mentions } = new CommitMessage('Thanks!! @some_one')
      expect(mentions).to.deep.equal(['some_one'])
    })

    it('should match mention with parentheses', function () {
      const { mentions } = new CommitMessage('Fix feature1 (by @someone)')
      expect(mentions).to.deep.equal(['someone'])
    })

    it('should match mention with brackets', function () {
      const { mentions } = new CommitMessage('Fix feature1 [by @someone]')
      expect(mentions).to.deep.equal(['someone'])
    })

    it('should match mention with braces', function () {
      const { mentions } = new CommitMessage('Fix feature1 {by @someone}')
      expect(mentions).to.deep.equal(['someone'])
    })

    it('should match mention with angle brackets', function () {
      const { mentions } = new CommitMessage('Fix feature1 <by @someone>')
      expect(mentions).to.deep.equal(['someone'])
    })

    it('should match multiple mentions', function () {
      const { mentions } = new CommitMessage('Thanks!! @someone and @another')
      expect(mentions).to.deep.equal(['someone', 'another'])
    })
  })
})
