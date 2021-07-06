'use strict'
const { describe, it } = require('mocha')
const { expect } = require('chai')

const parseMessage = require('./index')

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
      expect(chunk.notes[0]).to.eql({
        title: 'BREAKING CHANGE',
        text: 'some breaking changes'
      })
    })

    it('should take string options', () => {
      const commits = [
        'feat(ng-list): Allow custom separator\n' +
          'bla bla bla\n\n' +
          'Fix #123\nCloses #25\nfix #33\n',

        'fix(ng-list): Another custom separator\n' +
          'bla bla bla\n\n' +
          'BREAKING CHANGE: some breaking changes\n',

        'blabla\n' + '-hash-\n' + '9b1aff905b638aa274a5fc8f88662df446d374bd',

        'Revert "throw an error if a callback is passed to animate methods"\n\n' +
          'This reverts commit 9bb4d6ccbe80b7704c6b7f53317ca8146bc103ca.'
      ]

      const options = {
        fieldPattern: '^-(.*?)-$',
        issuePrefixes: '#',
        referenceActions: 'fix',
        mergePattern: '/^Merge pull request #(\\d+) from (.*)$/',
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
      expect(chunk.notes[0]).to.eql({
        title: 'BREAKING CHANGE',
        text: 'some breaking changes'
      })

      chunk = parseMessage(commits[2], options)
      expect(chunk.header).to.equal('blabla')
      expect(chunk.hash).to.equal('9b1aff905b638aa274a5fc8f88662df446d374bd')

      chunk = parseMessage(commits[3], options)
      expect(chunk.revert.header).to.equal(
        'throw an error if a callback is passed to animate methods'
      )
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
  it('should throw if nothing to parse', () => {
    expect(() => parseMessage()).to.throw('Expected a raw commit')
    expect(() => parseMessage('\n')).to.throw('Expected a raw commit')
    expect(() => parseMessage(' ')).to.throw('Expected a raw commit')
  })

  it('should ignore malformed commits', () => {
    const commits = [
      'chore(scope with spaces): some chore\n',
      'fix(zzz): Very cool commit\n' + 'bla bla bla\n\n'
    ]
    for (const commit of commits)
      expect(() => parseMessage(commit)).not.to.throw()
  })

  it('should throw error for an empty commit', () => {
    expect(() => parseMessage(' \n\n')).to.throw('Expected a raw commit')
  })
})
