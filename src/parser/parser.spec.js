'use strict'
const { expect } = require('chai')
const { beforeEach, describe, it } = require('mocha')
const parse = require('./index')

describe('parser', function () {
  let options
  let msg
  let simpleMsg
  let longNoteMsg
  let headerOnlyMsg

  beforeEach(function () {
    options = {
      revertPattern: /^Revert\s"([\s\S]*)"\s*This reverts commit (.*)\.$/,
      revertCorrespondence: ['header', 'hash'],
      fieldPattern: /^-(.*?)-$/,
      headerPattern: /^(\w*)(?:\(([\w$.\-* ]*)\))?: (.*)$/,
      headerCorrespondence: ['type', 'scope', 'subject'],
      noteKeywords: ['BREAKING AMEND'],
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

    msg = parse(
      'feat(scope): broadcast $destroy event on scope destruction\n' +
        'perf testing shows that in chrome this change adds 5-15% overhead\n' +
        'when destroying 10k nested scopes where each scope has a $destroy listener\n' +
        'BREAKING AMEND: some breaking change\n' +
        'Kills #1, #123\n' +
        'killed #25\n' +
        'handle #33, Closes #100, Handled #3 kills repo#77\n' +
        'kills stevemao/conventional-commits-parser#1',
      options
    )

    longNoteMsg = parse(
      'feat(scope): broadcast $destroy event on scope destruction\n' +
        'perf testing shows that in chrome this change adds 5-15% overhead\n' +
        'when destroying 10k nested scopes where each scope has a $destroy listener\n' +
        'BREAKING AMEND:\n' +
        'some breaking change\n' +
        'some other breaking change\n' +
        'Kills #1, #123\n' +
        'killed #25\n' +
        'handle #33, Closes #100, Handled #3',
      options
    )

    simpleMsg = parse('chore: some chore\n', options)

    headerOnlyMsg = parse('header', options)
  })

  it('should trim extra newlines', function () {
    expect(
      parse(
        '\n\n\n\n\n\n\nfeat(scope): broadcast $destroy event on scope destruction\n\n\n' +
          '\n\n\nperf testing shows that in chrome this change adds 5-15% overhead\n' +
          '\n\n\nwhen destroying 10k nested scopes where each scope has a $destroy listener\n\n' +
          '\n\n\n\nBREAKING AMEND: some breaking change\n' +
          '\n\n\n\nBREAKING AMEND: An awesome breaking change\n\n\n```\ncode here\n```' +
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
        'BREAKING AMEND: some breaking change\n\n\n\n\nBREAKING AMEND: An awesome breaking change\n\n\n```\ncode here\n```\n\nKills #1\n\n\n\nkilled #25',
      notes: [
        {
          title: 'BREAKING AMEND',
          text: 'some breaking change'
        },
        {
          title: 'BREAKING AMEND',
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
      parse(
        ' feat(scope): broadcast $destroy event on scope destruction \n' +
          ' perf testing shows that in chrome this change adds 5-15% overhead \n\n' +
          ' when destroying 10k nested scopes where each scope has a $destroy listener \n' +
          '         BREAKING AMEND: some breaking change         \n\n' +
          '   BREAKING AMEND: An awesome breaking change\n\n\n```\ncode here\n```' +
          '\n\n    Kills   #1\n',
        options
      )
    ).to.eql({
      merge: null,
      header: ' feat(scope): broadcast $destroy event on scope destruction ',
      body:
        ' perf testing shows that in chrome this change adds 5-15% overhead \n\n when destroying 10k nested scopes where each scope has a $destroy listener ',
      footer:
        '         BREAKING AMEND: some breaking change         \n\n   BREAKING AMEND: An awesome breaking change\n\n\n```\ncode here\n```\n\n    Kills   #1',
      notes: [
        {
          title: 'BREAKING AMEND',
          text: 'some breaking change         '
        },
        {
          title: 'BREAKING AMEND',
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
      parse(
        'gpg: Signature made Thu Oct 22 12:19:30 2020 EDT\n' +
          'gpg:                using RSA key ABCDEF1234567890\n' +
          'gpg: Good signature from "Author <author@example.com>" [ultimate]\n' +
          'feat(scope): broadcast $destroy event on scope destruction\n' +
          'perf testing shows that in chrome this change adds 5-15% overhead\n' +
          'when destroying 10k nested scopes where each scope has a $destroy listener\n' +
          'BREAKING AMEND: some breaking change\n' +
          'Kills #1\n',
        options
      )
    ).to.eql({
      merge: null,
      header: 'feat(scope): broadcast $destroy event on scope destruction',
      body:
        'perf testing shows that in chrome this change adds 5-15% overhead\nwhen destroying 10k nested scopes where each scope has a $destroy listener',
      footer: 'BREAKING AMEND: some breaking change\nKills #1',
      notes: [
        {
          title: 'BREAKING AMEND',
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

  it('should ignore comments according to commentChar', function () {
    const commentOptions = Object.assign({}, options, { commentChar: '#' })

    expect(parse('# comment', commentOptions)).to.eql({
      merge: null,
      header: null,
      body: null,
      footer: null,
      notes: [],
      references: [],
      mentions: [],
      revert: null,
      scope: null,
      subject: null,
      type: null
    })

    expect(parse(' # non-comment', commentOptions)).to.eql({
      merge: null,
      header: ' # non-comment',
      body: null,
      footer: null,
      notes: [],
      references: [],
      mentions: [],
      revert: null,
      scope: null,
      subject: null,
      type: null
    })

    expect(parse('header\n# comment\n\nbody', commentOptions)).to.eql({
      merge: null,
      header: 'header',
      body: 'body',
      footer: null,
      notes: [],
      references: [],
      mentions: [],
      revert: null,
      scope: null,
      subject: null,
      type: null
    })
  })

  it('should respect commentChar config', function () {
    const commentOptions = Object.assign({}, options, { commentChar: '*' })

    expect(parse('* comment', commentOptions)).to.eql({
      merge: null,
      header: null,
      body: null,
      footer: null,
      notes: [],
      references: [],
      mentions: [],
      revert: null,
      scope: null,
      subject: null,
      type: null
    })

    expect(parse('# non-comment', commentOptions)).to.eql({
      merge: null,
      header: '# non-comment',
      body: null,
      footer: null,
      notes: [],
      references: [],
      mentions: [],
      revert: null,
      scope: null,
      subject: null,
      type: null
    })

    expect(parse(' * non-comment', commentOptions)).to.eql({
      merge: null,
      header: ' * non-comment',
      body: null,
      footer: null,
      notes: [],
      references: [],
      mentions: [],
      revert: null,
      scope: null,
      subject: null,
      type: null
    })

    expect(parse('header\n* comment\n\nbody', commentOptions)).to.eql({
      merge: null,
      header: 'header',
      body: 'body',
      footer: null,
      notes: [],
      references: [],
      mentions: [],
      revert: null,
      scope: null,
      subject: null,
      type: null
    })
  })

  it('should truncate from scissors line', function () {
    const msg = parse(
      'this is some header before a scissors-line\n' +
        '# ------------------------ >8 ------------------------\n' +
        'this is a line that should be truncated\n',
      options
    )
    expect(msg.body).to.equal(null)
  })

  it('should keep header before scissor line', function () {
    const msg = parse(
      'this is some header before a scissors-line\n' +
        '# ------------------------ >8 ------------------------\n' +
        'this is a line that should be truncated\n',
      options
    )
    expect(msg.header).to.equal('this is some header before a scissors-line')
  })

  it('should keep body before scissor line', function () {
    const msg = parse(
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
      const options = {
        headerPattern: /^(\w*)(?:\(([\w$.\-* ]*)\))?: (.*)$/,
        headerCorrespondence: ['type', 'scope', 'subject'],
        mergePattern: /^Merge pull request #(\d+) from (.*)$/,
        mergeCorrespondence: ['issueId', 'source']
      }

      const msg = parse(
        '@Steve\n' +
          '@conventional-changelog @someone' +
          '\n' +
          'perf testing shows that in chrome this change adds 5-15% overhead\n' +
          '@this is',
        options
      )

      expect(msg.mentions).to.eql([
        'Steve',
        'conventional-changelog',
        'someone',
        'this'
      ])
    })
  })

  describe('merge commits', function () {
    const mergeOptions = {
      headerPattern: /^(\w*)(?:\(([\w$.\-* ]*)\))?: (.*)$/,
      headerCorrespondence: ['type', 'scope', 'subject'],
      mergePattern: /^Merge branch '(\w+)'$/,
      mergeCorrespondence: ['source', 'issueId']
    }

    const mergeMsg = parse("Merge branch 'feature'\nHEADER", mergeOptions)

    it('should parse merge header in merge commit', function () {
      expect(mergeMsg.source).to.equal('feature')
      expect(mergeMsg.issueId).to.equal(null)
    })

    const githubOptions = {
      headerPattern: /^(\w*)(?:\(([\w$.\-* ]*)\))?: (.*)$/,
      headerCorrespondence: ['type', 'scope', 'subject'],
      mergePattern: /^Merge pull request #(\d+) from (.*)$/,
      mergeCorrespondence: ['issueId', 'source']
    }

    const githubMsg = parse(
      'Merge pull request #1 from user/feature/feature-name\n' +
        '\n' +
        'feat(scope): broadcast $destroy event on scope destruction\n' +
        '\n' +
        'perf testing shows that in chrome this change adds 5-15% overhead\n' +
        'when destroying 10k nested scopes where each scope has a $destroy listener',
      githubOptions
    )

    it('should parse header in GitHub like pull request', function () {
      expect(githubMsg.header).to.equal(
        'feat(scope): broadcast $destroy event on scope destruction'
      )
    })

    it('should understand header parts in GitHub like pull request', function () {
      expect(githubMsg.type).to.equal('feat')
      expect(githubMsg.scope).to.equal('scope')
      expect(githubMsg.subject).to.equal(
        'broadcast $destroy event on scope destruction'
      )
    })

    it('should understand merge parts in GitHub like pull request', function () {
      expect(githubMsg.merge).to.equal(
        'Merge pull request #1 from user/feature/feature-name'
      )
      expect(githubMsg.issueId).to.equal('1')
      expect(githubMsg.source).to.equal('user/feature/feature-name')
    })

    const gitLabOptions = {
      headerPattern: /^(\w*)(?:\(([\w$.\-* ]*)\))?: (.*)$/,
      headerCorrespondence: ['type', 'scope', 'subject'],
      mergePattern: /^Merge branch '([^']+)' into '[^']+'$/,
      mergeCorrespondence: ['source']
    }

    const gitlabMsg = parse(
      "Merge branch 'feature/feature-name' into 'master'\r\n" +
        '\r\n' +
        'feat(scope): broadcast $destroy event on scope destruction\r\n' +
        '\r\n' +
        'perf testing shows that in chrome this change adds 5-15% overhead\r\n' +
        'when destroying 10k nested scopes where each scope has a $destroy listener\r\n' +
        '\r\n' +
        'See merge request !1',
      gitLabOptions
    )

    it('should parse header in GitLab like merge request', function () {
      expect(gitlabMsg.header).to.equal(
        'feat(scope): broadcast $destroy event on scope destruction'
      )
    })

    it('should understand header parts in GitLab like merge request', function () {
      expect(gitlabMsg.type).to.equal('feat')
      expect(gitlabMsg.scope).to.equal('scope')
      expect(gitlabMsg.subject).to.equal(
        'broadcast $destroy event on scope destruction'
      )
    })

    it('should understand merge parts in GitLab like merge request', function () {
      expect(gitlabMsg.merge).to.equal(
        "Merge branch 'feature/feature-name' into 'master'"
      )
      expect(gitlabMsg.source).to.equal('feature/feature-name')
    })

    it('Should parse header if merge header is missing', function () {
      const msgWithoutmergeHeader = parse(
        'feat(scope): broadcast $destroy event on scope destruction',
        githubOptions
      )

      expect(msgWithoutmergeHeader.merge).to.equal(null)
    })

    it('merge should be null if options.mergePattern is not defined', function () {
      expect(msg.merge).to.equal(null)
    })

    it('Should not parse conventional header if pull request header present and mergePattern is not set', function () {
      const msgWithmergeHeaderWithoutmergePattern = parse(
        'Merge pull request #1 from user/feature/feature-name\n' +
          'feat(scope): broadcast $destroy event on scope destruction',
        options
      )
      expect(msgWithmergeHeaderWithoutmergePattern.type).to.equal(null)
      expect(msgWithmergeHeaderWithoutmergePattern.scope).to.equal(null)
      expect(msgWithmergeHeaderWithoutmergePattern.subject).to.equal(null)
    })

    it('does not throw if merge commit has no header', () => {
      parse("Merge branch 'feature'", mergeOptions)
    })
  })

  describe('header', function () {
    it('should allow ":" in scope', function () {
      const msg = parse('feat(ng:list): Allow custom separator', {
        headerPattern: /^(\w*)(?:\(([:\w$.\-* ]*)\))?: (.*)$/,
        headerCorrespondence: ['type', 'scope', 'subject']
      })
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

    it('should allow correspondence to be changed', function () {
      const msg = parse('scope(my subject): fix this', {
        headerPattern: /^(\w*)(?:\(([\w$.\-* ]*)\))?: (.*)$/,
        headerCorrespondence: ['scope', 'subject', 'type']
      })

      expect(msg.type).to.equal('fix this')
      expect(msg.scope).to.equal('scope')
      expect(msg.subject).to.equal('my subject')
    })

    it('should be `undefined` if it is missing in `options.headerCorrespondence`', function () {
      msg = parse('scope(my subject): fix this', {
        headerPattern: /^(\w*)(?:\(([\w$.\-* ]*)\))?: (.*)$/,
        headerCorrespondence: ['scop', 'subject']
      })

      expect(msg.scope).to.equal(undefined)
    })

    it('should reference an issue with an owner', function () {
      const msg = parse('handled angular/angular.js#1', options)
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
      const msg = parse('handled angular.js#1', options)
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
      const msg = parse('handled gh-1', options)
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
        revertPattern: /^Revert\s"([\s\S]*)"\s*This reverts commit (.*)\.$/,
        revertCorrespondence: ['header', 'hash'],
        fieldPattern: /^-(.*?)-$/,
        headerPattern: /^(\w*)(?:\(([\w$.\-* ]*)\))?: (.*)$/,
        headerCorrespondence: ['type', 'scope', 'subject'],
        noteKeywords: ['BREAKING AMEND'],
        issuePrefixes: ['#', 'gh-']
      }

      const msg = parse('This is gh-1', options)
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
        'BREAKING AMEND: some breaking change\n' +
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
      expect(msg.notes[0]).to.eql({
        title: 'BREAKING AMEND',
        text: 'some breaking change'
      })
    })

    it('should parse important notes with more than one paragraphs', function () {
      expect(longNoteMsg.notes[0]).to.eql({
        title: 'BREAKING AMEND',
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
      options.noteKeywords = ['BREAKING CHANGE']
      const msg = parse(
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
      expect(
        msg.references.map(function (ref) {
          return ref.issue
        })
      ).to.include('9462')
      expect(msg.notes[0]).to.eql(expected)
    })

    it('should not treat it as important notes if there are texts after `noteKeywords`', function () {
      options.noteKeywords = ['BREAKING CHANGE']
      const msg = parse(
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
        revertPattern: /^Revert\s"([\s\S]*)"\s*This reverts commit (.*)\.$/,
        revertCorrespondence: ['header', 'hash'],
        fieldPattern: /^-(.*?)-$/,
        headerPattern: /^(\w*)(?:\(([\w$.\-* ]*)\))?: (.*)$/,
        headerCorrespondence: ['type', 'scope', 'subject'],
        noteKeywords: ['BREAKING AMEND'],
        issuePrefixes: ['#', 'gh-']
      }

      const msg = parse(
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
      const msg = parse(
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
      const msg = parse(
        'feat(scope): broadcast $destroy event on scope destruction\n' +
          'perf testing shows that in chrome this change adds 5-15% overhead\n' +
          'when destroying 10k nested scopes where each scope has a $destroy listener\n' +
          'Kills #1, #123\n' +
          'BREAKING AMEND: some breaking change\n',
        options
      )
      expect(msg.notes[0]).to.eql({
        title: 'BREAKING AMEND',
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
        'Kills #1, #123\nBREAKING AMEND: some breaking change'
      )
    })

    it('should parse properly if important notes comes with more than one paragraphs after references', function () {
      const msg = parse(
        'feat(scope): broadcast $destroy event on scope destruction\n' +
          'perf testing shows that in chrome this change adds 5-15% overhead\n' +
          'when destroying 10k nested scopes where each scope has a $destroy listener\n' +
          'Kills #1, #123\n' +
          'BREAKING AMEND: some breaking change\nsome other breaking change',
        options
      )
      expect(msg.notes[0]).to.eql({
        title: 'BREAKING AMEND',
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
        'Kills #1, #123\nBREAKING AMEND: some breaking change\nsome other breaking change'
      )
    })

    it('should parse properly if important notes comes after references', function () {
      const msg = parse(
        'feat(scope): broadcast $destroy event on scope destruction\n' +
          'perf testing shows that in chrome this change adds 5-15% overhead\n' +
          'when destroying 10k nested scopes where each scope has a $destroy listener\n' +
          'Kills gh-1, #123\n' +
          'other\n' +
          'BREAKING AMEND: some breaking change\n',
        options
      )
      expect(msg.notes[0]).to.eql({
        title: 'BREAKING AMEND',
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
        'Kills gh-1, #123\nother\nBREAKING AMEND: some breaking change'
      )
    })

    it('should add the subject as note if it match breakingHeaderPattern', function () {
      const options = {
        headerPattern: /^(\w*)(?:\(([\w$.\-* ]*)\))?: (.*)$/,
        breakingHeaderPattern: /^(\w*)(?:\((.*)\))?!: (.*)$/,
        headerCorrespondence: ['type', 'scope', 'subject']
      }
      const msg = parse('feat!: breaking change feature', options)
      expect(msg.notes[0]).to.eql({
        title: 'BREAKING CHANGE',
        text: 'breaking change feature'
      })
    })

    it('should not duplicate notes if the subject match breakingHeaderPattern', function () {
      const options = {
        headerPattern: /^(\w*)(?:\(([\w$.\-* ]*)\))?: (.*)$/,
        breakingHeaderPattern: /^(\w*)(?:\((.*)\))?!: (.*)$/,
        headerCorrespondence: ['type', 'scope', 'subject'],
        noteKeywords: ['BREAKING AMEND']
      }
      const msg = parse(
        'feat!: breaking change feature\nBREAKING AMEND: some breaking change',
        options
      )
      expect(msg.notes[0]).to.eql({
        title: 'BREAKING AMEND',
        text: 'some breaking change'
      })
      expect(msg.notes.length).to.eql(1)
    })
  })

  describe('others', function () {
    it('should parse hash', function () {
      msg = parse(
        'My commit message\n' +
          '-hash-\n' +
          '9b1aff905b638aa274a5fc8f88662df446d374bd',
        options
      )

      expect(msg.hash).to.equal('9b1aff905b638aa274a5fc8f88662df446d374bd')
    })

    it('should parse sideNotes', function () {
      msg = parse(
        'My commit message\n' +
          '-sideNotes-\n' +
          'It should warn the correct unfound file names.\n' +
          'Also it should continue if one file cannot be found.\n' +
          'Tests are added for these',
        options
      )

      expect(msg.sideNotes).to.equal(
        'It should warn the correct unfound file names.\n' +
          'Also it should continue if one file cannot be found.\n' +
          'Tests are added for these'
      )
    })

    it('should parse committer name and email', function () {
      msg = parse(
        'My commit message\n' +
          '-committerName-\n' +
          'Steve Mao\n' +
          '- committerEmail-\n' +
          'test@github.com',
        options
      )

      expect(msg.committerName).to.equal('Steve Mao')
      expect(msg[' committerEmail']).to.equal('test@github.com')
    })
  })

  describe('revert', function () {
    it('should parse revert', function () {
      msg = parse(
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
      msg = parse('Revert ""\n\n' + 'This reverts commit .', options)

      expect(msg.revert).to.eql({
        header: null,
        hash: null
      })
    })
  })
})
