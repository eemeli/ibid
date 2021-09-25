import { expect } from 'chai'
import { beforeEach, describe, it } from 'mocha'
import { Commit, CommitMessage } from '../commits'
import { Context, createContext } from '../config/context'

import { formatChangelog } from './format'

describe('formatChangelog', () => {
  const date = new Date()
  const dateStr = date.toISOString().substring(0, 10)

  let ctx: Context
  beforeEach(async () => (ctx = await createContext()))

  const mockCommit = (hash: string, msg: string): Commit => ({
    hash,
    merge: null,
    author: 'Author',
    date,
    tags: [],
    message: new CommitMessage(msg, ctx)
  })
  const getCommits = () => [
    mockCommit(
      '9b1aff905b638aa274a5fc8f88662df446d374bd',
      'feat(scope): broadcast $destroy event on scope destruction\n\nCloses #1\nCloses #2\nCloses #3'
    ),
    mockCommit(
      '13f31602f396bc269076ab4d389cfd8ca94b20ba',
      'fix(ng-list): Allow custom separator\n\nbla bla bla\n\nBREAKING CHANGE: some breaking change'
    ),
    mockCommit(
      '2064a9346c550c9b5dbd17eee7f0b7dd2cde9cf7',
      'perf(template): tweak\n\nMy body.'
    ),
    mockCommit(
      '5f241416b79994096527d319395f654a8972591a',
      'refactor(name): rename this module to conventional-changelog-writer'
    )
  ]

  describe('header', () => {
    it('stringifies only version', () => {
      expect(formatChangelog.header(ctx, '1.2.3')).to.equal(
        `## 1.2.3 (${dateStr})\n`
      )
    })

    it('stringifies version with title', () => {
      expect(formatChangelog.header(ctx, '1.2.3', 'title')).to.equal(
        `## 1.2.3 "title" (${dateStr})\n`
      )
    })

    it('stringifies only title', () => {
      expect(formatChangelog.header(ctx, null, 'title')).to.equal(
        `## title (${dateStr})\n`
      )
    })

    it('uses "unreleased" as default title', () => {
      expect(formatChangelog.header(ctx, null)).to.equal(
        `## Unreleased Changes (${dateStr})\n`
      )
    })

    it('linkifies version', () => {
      ctx.package = {
        name: 'ibid',
        version: '1.0.0',
        repository: { type: 'git', url: 'https://github.com/eemeli/ibid' }
      }
      expect(formatChangelog.header(ctx, '1.2.3')).to.equal(
        `## [1.2.3](https://github.com/eemeli/ibid/compare/1.0.0...1.2.3) (${dateStr})\n`
      )
    })

    it('accepts config options', () => {
      ctx.config.changelogTitles = { UNRELEASED: 'unreleased-title' }
      expect(formatChangelog.header(ctx, null)).to.equal(
        `## unreleased-title (${dateStr})\n`
      )
    })
  })

  describe('changes', () => {
    it('stringifies empty commit list as empty string', () => {
      expect(formatChangelog.changes(ctx, [])).to.equal('')
    })

    it('stringifies various commits', () => {
      expect(formatChangelog.changes(ctx, getCommits())).to
        .equal(`### ⚠ Breaking Changes

* some breaking change

### Features

* **scope:** broadcast $destroy event on scope destruction (9b1aff9), closes #1, closes #2, closes #3

### Bug Fixes

* **ng-list:** Allow custom separator (13f3160)

### Performance Improvements

* **template:** tweak (2064a93)
`)
    })

    it('linkifies various commits', () => {
      ctx.package = {
        name: 'ibid',
        version: '1.0.0',
        repository: { type: 'git', url: 'https://github.com/eemeli/ibid' }
      }
      expect(formatChangelog.changes(ctx, getCommits())).to
        .equal(`### ⚠ Breaking Changes

* some breaking change

### Features

* **scope:** broadcast $destroy event on scope destruction ([9b1aff9](https://github.com/eemeli/ibid/commit/9b1aff905b638aa274a5fc8f88662df446d374bd)), closes [#1](https://github.com/eemeli/ibid/issues/1), closes [#2](https://github.com/eemeli/ibid/issues/2), closes [#3](https://github.com/eemeli/ibid/issues/3)

### Bug Fixes

* **ng-list:** Allow custom separator ([13f3160](https://github.com/eemeli/ibid/commit/13f31602f396bc269076ab4d389cfd8ca94b20ba))

### Performance Improvements

* **template:** tweak ([2064a93](https://github.com/eemeli/ibid/commit/2064a9346c550c9b5dbd17eee7f0b7dd2cde9cf7))
`)
    })

    it('accepts config options', () => {
      ctx.config.changelogSections = ['perf', 'feat']
      ctx.config.changelogTitles = {
        BREAKING: 'breaking-title',
        feat: 'feat-title',
        perf: 'perf-title'
      }
      expect(formatChangelog.changes(ctx, getCommits())).to
        .equal(`### breaking-title

* some breaking change

### perf-title

* **template:** tweak (2064a93)

### feat-title

* **scope:** broadcast $destroy event on scope destruction (9b1aff9), closes #1, closes #2, closes #3
`)
    })
  })
})
