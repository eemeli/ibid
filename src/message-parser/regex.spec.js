'use strict'
const expect = require('chai').expect
const { describe, it } = require('mocha')
const parseMessage = require('./index')

describe('regex', function () {
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
      expect(references.length).to.equal(1)
      expect(references[0]).to.include({ action: 'closes', issue: '1' })
    })

    it('should be case insensitive', function () {
      const { references } = parseMessage('CloseS #1\n')
      expect(references.length).to.equal(1)
      expect(references[0]).to.include({ action: 'CloseS', issue: '1' })
    })

    it('should not match if keywords does not present', function () {
      const { references } = parseMessage('Closer #1\n')
      expect(references.length).to.equal(1)
      expect(references[0]).to.include({ action: null, issue: '1' })
    })

    it('should match multiple references', function () {
      const { references } = parseMessage(
        'Closes #1 resolves #2; closes bug #4'
      )
      expect(references.length).to.equal(3)
      expect(references[0]).to.include({ action: 'Closes', issue: '1' })
      expect(references[1]).to.include({ action: 'resolves', issue: '2' })
      expect(references[2]).to.include({ action: 'closes', issue: '4' })
    })

    it('should match references with mixed content, like JIRA tickets', function () {
      const { references } = parseMessage(
        'Closes #JIRA-123 fixes #MY-OTHER-PROJECT-123; closes bug #4'
      )
      expect(references.length).to.equal(3)
      expect(references[0]).to.include({ action: 'Closes', issue: 'JIRA-123' })
      expect(references[1]).to.include({
        action: 'fixes',
        issue: 'MY-OTHER-PROJECT-123'
      })
      expect(references[2]).to.include({ action: 'closes', issue: '4' })
    })

    it('should reference an issue without an action', function () {
      const { references } = parseMessage('gh-1, prefix-3, Closes gh-6')
      expect(references.length).to.equal(0)
    })

    it('should ignore whitespace', function () {
      const referenceActions = [' Closes', 'amends ', '', ' fixes ', '   ']
      const { references } = parseMessage('closes #1, amends #2, fixes #3', {
        referenceActions
      })
      expect(references.length).to.equal(3)
    })
  })

  describe('referenceParts', function () {
    it('should match simple reference parts', function () {
      const { references } = parseMessage('#1')
      expect(references.length).to.equal(1)
      expect(references[0]).to.include({ issue: '1', prefix: '#' })
    })

    it('should reference an issue in parenthesis', function () {
      const { references } = parseMessage(
        '#27), pinned shelljs to version that works with nyc (#30)'
      )
      expect(references.length).to.equal(2)
      expect(references[0]).to.include({ issue: '27', prefix: '#' })
      expect(references[1]).to.include({ issue: '30', prefix: '#' })
    })

    it('should match reference parts with a repository', function () {
      const { references } = parseMessage('repo#1')
      expect(references.length).to.equal(1)
      expect(references[0]).to.include({
        issue: '1',
        prefix: '#',
        repository: 'repo'
      })
    })

    it('should match JIRA-123 like reference parts', function () {
      const { references } = parseMessage('#JIRA-123')
      expect(references.length).to.equal(1)
      expect(references[0]).to.include({ issue: 'JIRA-123', prefix: '#' })
    })

    it('should not match MY-€#%#&-123 mixed symbol reference parts', function () {
      const { references } = parseMessage('#MY-€#%#&-123')
      expect(references.length).to.equal(0)
    })

    it('should match reference parts with multiple references', function () {
      const { references } = parseMessage('#1 #2, something #3; repo#4')
      expect(references.length).to.equal(4)
      for (let i = 0; i < 4; ++i)
        expect(references[i]).to.include({ issue: String(i + 1), prefix: '#' })
    })

    it('should match issues with customized prefix', function () {
      const { references } = parseMessage(
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

    it('should be case sensitve if set in options', function () {
      const { references } = parseMessage(
        'closes gh-1, resolves GH-2, fixes other-3',
        {
          issuePrefixes: ['GH-'],
          issuePrefixesCaseSensitive: true
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
