import { expect } from 'chai'
import { beforeEach, describe, it } from 'mocha'
import { Commit } from '../commits/parse-commit'
import { ParseOptions } from './parse-context'

import { parseMessage } from './parse-message'

describe('parseMessage()', () => {
  it('should work', () => {
    const commit =
      'feat(ng-list): Allow custom separator\n' +
      'bla bla bla\n\n' +
      'Closes #123\nCloses #25\nFixes #33\n'
    const result = parseMessage(commit)

    expect(result.header).to.equal('feat(ng-list): Allow custom separator')
    expect(result.footer).to.equal('Closes #123\nCloses #25\nFixes #33')
    expect(result.references).to.eql([
      {
        action: 'Closes',
        issue: '123',
        owner: null,
        prefix: '#',
        raw: '#123',
        repository: null
      },
      {
        action: 'Closes',
        issue: '25',
        owner: null,
        prefix: '#',
        raw: '#25',
        repository: null
      },
      {
        action: 'Fixes',
        issue: '33',
        owner: null,
        prefix: '#',
        raw: '#33',
        repository: null
      }
    ])
  })

  it('should parse raw commits', () => {
    const commits = [
      'feat(ng-list): Allow custom separator\n' +
        'bla bla bla\n\n' +
        'Closes #123\nCloses #25\nFixes #33\n',

      'feat(scope): broadcast $destroy event on scope destruction\n' +
        'bla bla bla\n\n' +
        'BREAKING CHANGE: some breaking change\n',

      'fix(zzz): Very cool commit\n' +
        'bla bla bla\n\n' +
        'Closes #2, #3. Resolves #4. Fixes #5. Fixes #6.\n' +
        'What not ?\n',

      'chore(scope with spaces): some chore\n' +
        'bla bla bla\n\n' +
        'BREAKING CHANGE: some other breaking change\n',

      'Revert "throw an error if a callback is passed to animate methods"\n\n' +
        'This reverts commit 9bb4d6ccbe80b7704c6b7f53317ca8146bc103ca.\n\n' +
        '-hash-\n' +
        'd7a40a29214f37d469e57d730dfd042b639d4d1f'
    ]

    expect(parseMessage(commits[0]).header).to.equal(
      'feat(ng-list): Allow custom separator'
    )
    expect(parseMessage(commits[1]).notes).to.eql([
      { title: 'BREAKING CHANGE', text: 'some breaking change' }
    ])
    expect(parseMessage(commits[2]).header).to.equal(
      'fix(zzz): Very cool commit'
    )
    expect(parseMessage(commits[3]).header).to.equal(
      'chore(scope with spaces): some chore'
    )
    expect(parseMessage(commits[4]).revert).to.eql({
      header: 'throw an error if a callback is passed to animate methods',
      hash: '9bb4d6ccbe80b7704c6b7f53317ca8146bc103ca'
    })
  })

  describe('options', () => {
    it('should take options', () => {
      const commits = [
        'feat(ng-list): Allow custom separator\n' +
          'bla bla bla\n\n' +
          'Fix #123\nCloses #25\nfix #33\n',

        'fix(ng-list): Another custom separator\n' +
          'bla bla bla\n\n' +
          'BREAKING CHANGE: some breaking changes\n'
      ]

      const options = {
        referenceActions: ['fix']
      }

      let chunk = parseMessage(commits[0], options)
      expect(chunk.type).to.equal('feat')
      expect(chunk.scope).to.equal('ng-list')
      expect(chunk.subject).to.equal('Allow custom separator')
      expect(chunk.references).to.eql([
        {
          action: 'Fix',
          owner: null,
          repository: null,
          issue: '123',
          raw: '#123',
          prefix: '#'
        },
        {
          action: null,
          owner: null,
          repository: null,
          issue: '25',
          raw: 'Closes #25',
          prefix: '#'
        },
        {
          action: 'fix',
          owner: null,
          repository: null,
          issue: '33',
          raw: '#33',
          prefix: '#'
        }
      ])

      chunk = parseMessage(commits[1], options)
      expect(chunk.type).to.equal('fix')
      expect(chunk.scope).to.equal('ng-list')
      expect(chunk.subject).to.equal('Another custom separator')
      expect(chunk.notes?.[0]).to.eql({
        title: 'BREAKING CHANGE',
        text: 'some breaking changes'
      })
    })
  })

  describe('header', () => {
    it('should parse references from header', () => {
      const result = parseMessage('Subject #1')

      expect(result.references).to.eql([
        {
          action: null,
          issue: '1',
          owner: null,
          prefix: '#',
          raw: 'Subject #1',
          repository: null
        }
      ])
    })

    it('should parse slash in the header', () => {
      const result = parseMessage('feat(hello/world): message')

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
      expect(() => parseMessage(commit)).not.to.throw()
  })
})

describe('parser', function () {
  let options: ParseOptions
  let msg: Partial<Commit>
  let simpleMsg: Partial<Commit>
  let longNoteMsg: Partial<Commit>
  let headerOnlyMsg: Partial<Commit>

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

    msg = parseMessage(
      'feat(scope): broadcast $destroy event on scope destruction\n' +
        'perf testing shows that in chrome this change adds 5-15% overhead\n' +
        'when destroying 10k nested scopes where each scope has a $destroy listener\n' +
        'BREAKING CHANGE: some breaking change\n' +
        'Kills #1, #123\n' +
        'killed #25\n' +
        'handle #33, Closes #100, Handled #3 kills repo#77\n' +
        'kills stevemao/conventional-commits-parser#1',
      options
    )

    longNoteMsg = parseMessage(
      'feat(scope): broadcast $destroy event on scope destruction\n' +
        'perf testing shows that in chrome this change adds 5-15% overhead\n' +
        'when destroying 10k nested scopes where each scope has a $destroy listener\n' +
        'BREAKING CHANGE:\n' +
        'some breaking change\n' +
        'some other breaking change\n' +
        'Kills #1, #123\n' +
        'killed #25\n' +
        'handle #33, Closes #100, Handled #3',
      options
    )

    simpleMsg = parseMessage('chore: some chore\n', options)

    headerOnlyMsg = parseMessage('header', options)
  })

  it('should trim extra newlines', function () {
    expect(
      parseMessage(
        '\n\n\n\n\n\n\nfeat(scope): broadcast $destroy event on scope destruction\n\n\n' +
          '\n\n\nperf testing shows that in chrome this change adds 5-15% overhead\n' +
          '\n\n\nwhen destroying 10k nested scopes where each scope has a $destroy listener\n\n' +
          '\n\n\n\nBREAKING CHANGE: some breaking change\n' +
          '\n\n\n\nBREAKING CHANGE: An awesome breaking change\n\n\n```\ncode here\n```' +
          '\n\nKills #1\n' +
          '\n\n\nkilled #25\n\n\n\n\n',
        options
      )
    ).to.eql({
      merge: null,
      header: 'feat(scope): broadcast $destroy event on scope destruction',
      body:
        'perf testing shows that in chrome this change adds 5-15% overhead\n\n\n\nwhen destroying 10k nested scopes where each scope has a $destroy listener',
      footer:
        'BREAKING CHANGE: some breaking change\n\n\n\n\nBREAKING CHANGE: An awesome breaking change\n\n\n```\ncode here\n```\n\nKills #1\n\n\n\nkilled #25',
      notes: [
        {
          title: 'BREAKING CHANGE',
          text: 'some breaking change'
        },
        {
          title: 'BREAKING CHANGE',
          text: 'An awesome breaking change\n\n\n```\ncode here\n```'
        }
      ],
      references: [
        {
          action: 'Kills',
          owner: null,
          repository: null,
          issue: '1',
          raw: '#1',
          prefix: '#'
        },
        {
          action: 'killed',
          owner: null,
          repository: null,
          issue: '25',
          raw: '#25',
          prefix: '#'
        }
      ],
      mentions: [],
      revert: null,
      scope: 'scope',
      subject: 'broadcast $destroy event on scope destruction',
      type: 'feat'
    })
  })

  it('should keep spaces', function () {
    expect(
      parseMessage(
        ' feat(scope): broadcast $destroy event on scope destruction \n' +
          ' perf testing shows that in chrome this change adds 5-15% overhead \n\n' +
          ' when destroying 10k nested scopes where each scope has a $destroy listener \n' +
          '         BREAKING CHANGE: some breaking change         \n\n' +
          '   BREAKING CHANGE: An awesome breaking change\n\n\n```\ncode here\n```' +
          '\n\n    Kills   #1\n',
        options
      )
    ).to.eql({
      merge: null,
      header: ' feat(scope): broadcast $destroy event on scope destruction ',
      body:
        ' perf testing shows that in chrome this change adds 5-15% overhead \n\n when destroying 10k nested scopes where each scope has a $destroy listener ',
      footer:
        '         BREAKING CHANGE: some breaking change         \n\n   BREAKING CHANGE: An awesome breaking change\n\n\n```\ncode here\n```\n\n    Kills   #1',
      notes: [
        {
          title: 'BREAKING CHANGE',
          text: 'some breaking change         '
        },
        {
          title: 'BREAKING CHANGE',
          text: 'An awesome breaking change\n\n\n```\ncode here\n```'
        }
      ],
      references: [
        {
          action: 'Kills',
          owner: null,
          repository: null,
          issue: '1',
          raw: '#1',
          prefix: '#'
        }
      ],
      mentions: [],
      revert: null,
      scope: null,
      subject: null,
      type: null
    })
  })

  it('should ignore gpg signature lines', function () {
    expect(
      parseMessage(
        'gpg: Signature made Thu Oct 22 12:19:30 2020 EDT\n' +
          'gpg:                using RSA key ABCDEF1234567890\n' +
          'gpg: Good signature from "Author <author@example.com>" [ultimate]\n' +
          'feat(scope): broadcast $destroy event on scope destruction\n' +
          'perf testing shows that in chrome this change adds 5-15% overhead\n' +
          'when destroying 10k nested scopes where each scope has a $destroy listener\n' +
          'BREAKING CHANGE: some breaking change\n' +
          'Kills #1\n',
        options
      )
    ).to.eql({
      merge: null,
      header: 'feat(scope): broadcast $destroy event on scope destruction',
      body:
        'perf testing shows that in chrome this change adds 5-15% overhead\nwhen destroying 10k nested scopes where each scope has a $destroy listener',
      footer: 'BREAKING CHANGE: some breaking change\nKills #1',
      notes: [
        {
          title: 'BREAKING CHANGE',
          text: 'some breaking change'
        }
      ],
      references: [
        {
          action: 'Kills',
          owner: null,
          repository: null,
          issue: '1',
          raw: '#1',
          prefix: '#'
        }
      ],
      mentions: ['example'],
      revert: null,
      scope: 'scope',
      subject: 'broadcast $destroy event on scope destruction',
      type: 'feat'
    })
  })

  it('should truncate from scissors line', function () {
    const msg = parseMessage(
      'this is some header before a scissors-line\n' +
        '# ------------------------ >8 ------------------------\n' +
        'this is a line that should be truncated\n',
      options
    )
    expect(msg.body).to.equal(null)
  })

  it('should keep header before scissor line', function () {
    const msg = parseMessage(
      'this is some header before a scissors-line\n' +
        '# ------------------------ >8 ------------------------\n' +
        'this is a line that should be truncated\n',
      options
    )
    expect(msg.header).to.equal('this is some header before a scissors-line')
  })

  it('should keep body before scissor line', function () {
    const msg = parseMessage(
      'this is some subject before a scissors-line\n' +
        'this is some body before a scissors-line\n' +
        '# ------------------------ >8 ------------------------\n' +
        'this is a line that should be truncated\n',
      options
    )
    expect(msg.body).to.equal('this is some body before a scissors-line')
  })

  describe('mentions', function () {
    it('should mention someone in the commit', function () {
      const msg = parseMessage(
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
      const msg = parseMessage('feat(ng:list): Allow custom separator', {})
      expect(msg.scope).to.equal('ng:list')
    })

    it('header part should be null if not captured', function () {
      expect(headerOnlyMsg.type).to.equal(null)
      expect(headerOnlyMsg.scope).to.equal(null)
      expect(headerOnlyMsg.subject).to.equal(null)
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
      const msg = parseMessage('handled angular/angular.js#1', options)
      expect(msg.references).to.eql([
        {
          action: 'handled',
          owner: 'angular',
          repository: 'angular.js',
          issue: '1',
          raw: 'angular/angular.js#1',
          prefix: '#'
        }
      ])
    })

    it('should reference an issue with a repository', function () {
      const msg = parseMessage('handled angular.js#1', options)
      expect(msg.references).to.eql([
        {
          action: 'handled',
          owner: null,
          repository: 'angular.js',
          issue: '1',
          raw: 'angular.js#1',
          prefix: '#'
        }
      ])
    })

    it('should reference an issue without both', function () {
      const msg = parseMessage('handled gh-1', options)
      expect(msg.references).to.eql([
        {
          action: 'handled',
          owner: null,
          repository: null,
          issue: '1',
          raw: 'gh-1',
          prefix: 'gh-'
        }
      ])
    })

    it('should reference an issue without an action', function () {
      const options = {
        issuePrefixes: ['#', 'gh-']
      }

      const msg = parseMessage('This is gh-1', options)
      expect(msg.references).to.eql([
        {
          action: null,
          owner: null,
          repository: null,
          issue: '1',
          raw: 'This is gh-1',
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

    it('should be null if not found', function () {
      expect(headerOnlyMsg.body).to.equal(null)
    })
  })

  describe('footer', function () {
    it('should be null if not found', function () {
      expect(headerOnlyMsg.footer).to.equal(null)
    })

    it('should parse footer', function () {
      expect(msg.footer).to.equal(
        'BREAKING CHANGE: some breaking change\n' +
          'Kills #1, #123\n' +
          'killed #25\n' +
          'handle #33, Closes #100, Handled #3 kills repo#77\n' +
          'kills stevemao/conventional-commits-parser#1'
      )
    })

    it('important notes should be an empty string if not found', function () {
      expect(simpleMsg.notes).to.eql([])
    })

    it('should parse important notes', function () {
      expect(msg.notes?.[0]).to.eql({
        title: 'BREAKING CHANGE',
        text: 'some breaking change'
      })
    })

    it('should parse important notes with more than one paragraphs', function () {
      expect(longNoteMsg.notes?.[0]).to.eql({
        title: 'BREAKING CHANGE',
        text: 'some breaking change\nsome other breaking change'
      })
    })

    it('should parse important notes that start with asterisks (for squash commits)', function () {
      const expectedText =
        'Previously multiple template bindings on one element\n' +
        "(ex. `<div *ngIf='..' *ngFor='...'>`) were allowed but most of the time\n" +
        'were leading to undesired result. It is possible that a small number\n' +
        'of applications will see template parse errors that shuld be fixed by\n' +
        'nesting elements or using `<template>` tags explicitly.'
      const text = expectedText + '\n' + 'Closes #9462'
      const msg = parseMessage(
        'fix(core): report duplicate template bindings in templates\n' +
          '\n' +
          'Fixes #7315\n' +
          '\n' +
          '* BREAKING CHANGE:\n' +
          '\n' +
          text,
        options
      )
      const expected = {
        title: 'BREAKING CHANGE',
        text: expectedText
      }
      expect(msg.references?.map(ref => ref.issue)).to.include('9462')
      expect(msg.notes?.[0]).to.eql(expected)
    })

    it('should not treat it as important notes if there are texts after `noteKeywords`', function () {
      const msg = parseMessage(
        'fix(core): report duplicate template bindings in templates\n' +
          '\n' +
          'Fixes #7315\n' +
          '\n' +
          'BREAKING CHANGES:\n' +
          '\n' +
          'Previously multiple template bindings on one element\n' +
          "(ex. `<div *ngIf='..' *ngFor='...'>`) were allowed but most of the time\n" +
          'were leading to undesired result. It is possible that a small number\n' +
          'of applications will see template parse errors that shuld be fixed by\n' +
          'nesting elements or using `<template>` tags explicitly.\n' +
          '\n' +
          'Closes #9462',
        options
      )

      expect(msg.notes).to.eql([])
    })

    it('references should be empty if not found', function () {
      expect(simpleMsg.references).to.eql([])
    })

    it('should parse references', function () {
      expect(msg.references).to.eql([
        {
          action: 'Kills',
          owner: null,
          repository: null,
          issue: '1',
          raw: '#1',
          prefix: '#'
        },
        {
          action: 'Kills',
          owner: null,
          repository: null,
          issue: '123',
          raw: ', #123',
          prefix: '#'
        },
        {
          action: 'killed',
          owner: null,
          repository: null,
          issue: '25',
          raw: '#25',
          prefix: '#'
        },
        {
          action: 'handle',
          owner: null,
          repository: null,
          issue: '33',
          raw: '#33',
          prefix: '#'
        },
        {
          action: 'handle',
          owner: null,
          repository: null,
          issue: '100',
          raw: ', Closes #100',
          prefix: '#'
        },
        {
          action: 'Handled',
          owner: null,
          repository: null,
          issue: '3',
          raw: '#3',
          prefix: '#'
        },
        {
          action: 'kills',
          owner: null,
          repository: 'repo',
          issue: '77',
          raw: 'repo#77',
          prefix: '#'
        },
        {
          action: 'kills',
          owner: 'stevemao',
          repository: 'conventional-commits-parser',
          issue: '1',
          raw: 'stevemao/conventional-commits-parser#1',
          prefix: '#'
        }
      ])
    })

    it('should reference an issue without an action', function () {
      const options = {
        issuePrefixes: ['#', 'gh-']
      }

      const msg = parseMessage(
        'feat(scope): broadcast $destroy event on scope destruction\n' +
          'perf testing shows that in chrome this change adds 5-15% overhead\n' +
          'when destroying 10k nested scopes where each scope has a $destroy listener\n' +
          'Kills #1, gh-123\n' +
          'what\n' +
          '* #25\n' +
          '* #33, maybe gh-100, not sure about #3\n',
        options
      )

      expect(msg.references).to.eql([
        {
          action: null,
          owner: null,
          repository: null,
          issue: '1',
          raw: 'Kills #1',
          prefix: '#'
        },
        {
          action: null,
          owner: null,
          repository: null,
          issue: '123',
          raw: ', gh-123',
          prefix: 'gh-'
        },
        {
          action: null,
          owner: null,
          repository: null,
          issue: '25',
          raw: '* #25',
          prefix: '#'
        },
        {
          action: null,
          owner: null,
          repository: null,
          issue: '33',
          raw: '* #33',
          prefix: '#'
        },
        {
          action: null,
          owner: null,
          repository: null,
          issue: '100',
          raw: ', maybe gh-100',
          prefix: 'gh-'
        },
        {
          action: null,
          owner: null,
          repository: null,
          issue: '3',
          raw: ', not sure about #3',
          prefix: '#'
        }
      ])
    })

    it('should put everything after references in footer', function () {
      const msg = parseMessage(
        'feat(scope): broadcast $destroy event on scope destruction\n' +
          'perf testing shows that in chrome this change adds 5-15% overhead\n' +
          'when destroying 10k nested scopes where each scope has a $destroy listener\n' +
          'Kills #1, #123\n' +
          'what\n' +
          'killed #25\n' +
          'handle #33, Closes #100, Handled #3\n' +
          'other',
        options
      )

      expect(msg.footer).to.equal(
        'Kills #1, #123\nwhat\nkilled #25\nhandle #33, Closes #100, Handled #3\nother'
      )
    })

    it('should parse properly if important notes comes after references', function () {
      const msg = parseMessage(
        'feat(scope): broadcast $destroy event on scope destruction\n' +
          'perf testing shows that in chrome this change adds 5-15% overhead\n' +
          'when destroying 10k nested scopes where each scope has a $destroy listener\n' +
          'Kills #1, #123\n' +
          'BREAKING CHANGE: some breaking change\n',
        options
      )
      expect(msg.notes?.[0]).to.eql({
        title: 'BREAKING CHANGE',
        text: 'some breaking change'
      })
      expect(msg.references).to.eql([
        {
          action: 'Kills',
          owner: null,
          repository: null,
          issue: '1',
          raw: '#1',
          prefix: '#'
        },
        {
          action: 'Kills',
          owner: null,
          repository: null,
          issue: '123',
          raw: ', #123',
          prefix: '#'
        }
      ])
      expect(msg.footer).to.equal(
        'Kills #1, #123\nBREAKING CHANGE: some breaking change'
      )
    })

    it('should parse properly if important notes comes with more than one paragraphs after references', function () {
      const msg = parseMessage(
        'feat(scope): broadcast $destroy event on scope destruction\n' +
          'perf testing shows that in chrome this change adds 5-15% overhead\n' +
          'when destroying 10k nested scopes where each scope has a $destroy listener\n' +
          'Kills #1, #123\n' +
          'BREAKING CHANGE: some breaking change\nsome other breaking change',
        options
      )
      expect(msg.notes?.[0]).to.eql({
        title: 'BREAKING CHANGE',
        text: 'some breaking change\nsome other breaking change'
      })
      expect(msg.references).to.eql([
        {
          action: 'Kills',
          owner: null,
          repository: null,
          issue: '1',
          raw: '#1',
          prefix: '#'
        },
        {
          action: 'Kills',
          owner: null,
          repository: null,
          issue: '123',
          raw: ', #123',
          prefix: '#'
        }
      ])
      expect(msg.footer).to.equal(
        'Kills #1, #123\nBREAKING CHANGE: some breaking change\nsome other breaking change'
      )
    })

    it('should parse properly if important notes comes after references', function () {
      const msg = parseMessage(
        'feat(scope): broadcast $destroy event on scope destruction\n' +
          'perf testing shows that in chrome this change adds 5-15% overhead\n' +
          'when destroying 10k nested scopes where each scope has a $destroy listener\n' +
          'Kills gh-1, #123\n' +
          'other\n' +
          'BREAKING CHANGE: some breaking change\n',
        options
      )
      expect(msg.notes?.[0]).to.eql({
        title: 'BREAKING CHANGE',
        text: 'some breaking change'
      })
      expect(msg.references).to.eql([
        {
          action: 'Kills',
          owner: null,
          repository: null,
          issue: '1',
          raw: 'gh-1',
          prefix: 'gh-'
        },
        {
          action: 'Kills',
          owner: null,
          repository: null,
          issue: '123',
          raw: ', #123',
          prefix: '#'
        }
      ])
      expect(msg.footer).to.equal(
        'Kills gh-1, #123\nother\nBREAKING CHANGE: some breaking change'
      )
    })

    it('should add the subject as note if it match breakingHeaderPattern', function () {
      const msg = parseMessage('feat!: breaking change feature', {})
      expect(msg.notes?.[0]).to.eql({
        title: 'BREAKING CHANGE',
        text: 'breaking change feature'
      })
    })

    it('should not duplicate notes if the subject match breakingHeaderPattern', function () {
      const msg = parseMessage(
        'feat!: breaking change feature\nBREAKING CHANGE: some breaking change',
        {}
      )
      expect(msg.notes?.[0]).to.eql({
        title: 'BREAKING CHANGE',
        text: 'some breaking change'
      })
      expect(msg.notes?.length).to.eql(1)
    })
  })

  describe('revert', function () {
    it('should parse revert', function () {
      msg = parseMessage(
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
      msg = parseMessage('Revert ""\n\n' + 'This reverts commit .', options)

      expect(msg.revert).to.eql({
        header: null,
        hash: null
      })
    })
  })

  describe('notes', function () {
    it('should match a simple note', function () {
      const { notes } = parseMessage(
        'header\n\nBreaking Change: This is so important.'
      )
      expect(notes).to.deep.equal([
        { title: 'Breaking Change', text: 'This is so important.' }
      ])
    })

    it('should be case insensitive', function () {
      const { notes } = parseMessage(
        'header\n\nBREAKING CHANGE: This is so important.'
      )
      expect(notes).to.deep.equal([
        { title: 'BREAKING CHANGE', text: 'This is so important.' }
      ])
    })

    it('should not accidentally match in a sentence', function () {
      const { notes } = parseMessage(
        'header\n\nThis is a breaking change: So important.'
      )
      expect(notes).to.deep.equal([])
    })

    it('should not match if there is text after `noteKeywords`', function () {
      const { notes } = parseMessage(
        'header\n\nBREAKING CHANGES: This is so not important.'
      )
      expect(notes).to.deep.equal([])
    })
  })

  describe('references', function () {
    it('should match a simple header reference', function () {
      const { references } = parseMessage('closes #1\n')
      expect(references?.length).to.equal(1)
      expect(references?.[0]).to.include({ action: 'closes', issue: '1' })
    })

    it('should be case insensitive', function () {
      const { references } = parseMessage('CloseS #1\n')
      expect(references?.length).to.equal(1)
      expect(references?.[0]).to.include({ action: 'CloseS', issue: '1' })
    })

    it('should not match if keywords does not present', function () {
      const { references } = parseMessage('Closer #1\n')
      expect(references?.length).to.equal(1)
      expect(references?.[0]).to.include({ action: null, issue: '1' })
    })

    it('should match multiple references', function () {
      const { references } = parseMessage(
        'Closes #1 resolves #2; closes bug #4'
      )
      expect(references?.length).to.equal(3)
      expect(references?.[0]).to.include({ action: 'Closes', issue: '1' })
      expect(references?.[1]).to.include({ action: 'resolves', issue: '2' })
      expect(references?.[2]).to.include({ action: 'closes', issue: '4' })
    })

    it('should match references with mixed content, like JIRA tickets', function () {
      const { references } = parseMessage(
        'Closes #JIRA-123 fixes #MY-OTHER-PROJECT-123; closes bug #4'
      )
      expect(references?.length).to.equal(3)
      expect(references?.[0]).to.include({
        action: 'Closes',
        issue: 'JIRA-123'
      })
      expect(references?.[1]).to.include({
        action: 'fixes',
        issue: 'MY-OTHER-PROJECT-123'
      })
      expect(references?.[2]).to.include({ action: 'closes', issue: '4' })
    })

    it('should reference an issue without an action', function () {
      const { references } = parseMessage('gh-1, prefix-3, Closes gh-6')
      expect(references?.length).to.equal(0)
    })

    it('should ignore whitespace', function () {
      const referenceActions = [' Closes', 'amends ', '', ' fixes ', '   ']
      const { references } = parseMessage('closes #1, amends #2, fixes #3', {
        referenceActions
      })
      expect(references?.length).to.equal(3)
    })
  })

  describe('referenceParts', function () {
    it('should match simple reference parts', function () {
      const { references } = parseMessage('#1')
      expect(references?.length).to.equal(1)
      expect(references?.[0]).to.include({ issue: '1', prefix: '#' })
    })

    it('should reference an issue in parenthesis', function () {
      const { references } = parseMessage(
        '#27), pinned shelljs to version that works with nyc (#30)'
      )
      expect(references?.length).to.equal(2)
      expect(references?.[0]).to.include({ issue: '27', prefix: '#' })
      expect(references?.[1]).to.include({ issue: '30', prefix: '#' })
    })

    it('should match reference parts with a repository', function () {
      const { references } = parseMessage('repo#1')
      expect(references?.length).to.equal(1)
      expect(references?.[0]).to.include({
        issue: '1',
        prefix: '#',
        repository: 'repo'
      })
    })

    it('should match JIRA-123 like reference parts', function () {
      const { references } = parseMessage('#JIRA-123')
      expect(references?.length).to.equal(1)
      expect(references?.[0]).to.include({ issue: 'JIRA-123', prefix: '#' })
    })

    it('should not match MY-€#%#&-123 mixed symbol reference parts', function () {
      const { references } = parseMessage('#MY-€#%#&-123')
      expect(references?.length).to.equal(0)
    })

    it('should match reference parts with multiple references', function () {
      const { references } = parseMessage('#1 #2, something #3; repo#4')
      expect(references?.length).to.equal(4)
      for (let i = 0; i < 4; ++i)
        expect(references?.[i]).to.include({
          issue: String(i + 1),
          prefix: '#'
        })
    })

    it('should match issues with customized prefix', function () {
      const { references } = parseMessage(
        'closes gh-1, resolves #2, fixes other-3',
        {
          issuePrefixes: ['gh-', 'other-']
        }
      )
      expect(references?.length).to.equal(2)
      expect(references?.[0]).to.include({
        action: 'closes',
        issue: '1',
        prefix: 'gh-'
      })
      expect(references?.[1]).to.include({
        action: 'fixes',
        issue: '3',
        prefix: 'other-'
      })
    })

    it('should be case sensitve if set in options', function () {
      const { references } = parseMessage(
        'closes gh-1, resolves GH-2, fixes other-3',
        {
          issuePrefixes: ['GH-'],
          issuePrefixesCaseSensitive: true
        }
      )
      expect(references?.length).to.equal(1)
      expect(references?.[0]).to.include({
        action: 'resolves',
        issue: '2',
        prefix: 'GH-'
      })
    })
  })

  describe('mentions', function () {
    it('should match basic mention', function () {
      const { mentions } = parseMessage('Thanks!! @someone')
      expect(mentions).to.deep.equal(['someone'])
    })

    it('should match mention with hyphen', function () {
      const { mentions } = parseMessage('Thanks!! @some-one')
      expect(mentions).to.deep.equal(['some-one'])
    })

    it('should match mention with underscore', function () {
      const { mentions } = parseMessage('Thanks!! @some_one')
      expect(mentions).to.deep.equal(['some_one'])
    })

    it('should match mention with parentheses', function () {
      const { mentions } = parseMessage('Fix feature1 (by @someone)')
      expect(mentions).to.deep.equal(['someone'])
    })

    it('should match mention with brackets', function () {
      const { mentions } = parseMessage('Fix feature1 [by @someone]')
      expect(mentions).to.deep.equal(['someone'])
    })

    it('should match mention with braces', function () {
      const { mentions } = parseMessage('Fix feature1 {by @someone}')
      expect(mentions).to.deep.equal(['someone'])
    })

    it('should match mention with angle brackets', function () {
      const { mentions } = parseMessage('Fix feature1 <by @someone>')
      expect(mentions).to.deep.equal(['someone'])
    })

    it('should match multiple mentions', function () {
      const { mentions } = parseMessage('Thanks!! @someone and @another')
      expect(mentions).to.deep.equal(['someone', 'another'])
    })
  })
})
