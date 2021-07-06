import assert from 'assert'
import { describe, it } from 'mocha'
import { filterReverted } from './filter-reverted'
import { Commit } from './parse-commit'

describe('filterReverted()', () => {
  it('should error if `commits` is not `array`', () => {
    assert.throws(() => filterReverted((null as unknown) as Commit[]))
  })

  it('should filter reverted commits that exist in the commits array', () => {
    let commits: Commit[] = [
      {
        hash: '207abfa16885ef5ff88dfc6cdde694bb3fd03104',
        author: 'Author',
        date: new Date(),
        message: '',
        tags: [],
        type: 'revert',
        scope: null,
        subject: 'feat(): a very important feature',
        header: 'revert: feat(): a very important feature',
        body: 'This reverts commit 048fe156c9eddbe566f040f64ca6be1f55b16a23.',
        footer: null,
        notes: [],
        references: [],
        revert: {
          header: 'feat(): amazing new module',
          hash: '048fe156c9eddbe566f040f64ca6be1f55b16a23'
        }
      },
      {
        hash: '789d898b5f8422d7f65cc25135af2c1a95a125ac',
        author: 'Author',
        date: new Date(),
        message: '',
        tags: [],
        type: 'revert',
        scope: null,
        subject: 'feat(): amazing new module',
        header: 'revert: feat(): amazing new module',
        body: 'This reverts commit 56185b7356766d2b30cfa2406b257080272e0b7a.',
        footer: null,
        notes: [],
        references: [],
        revert: {
          header: 'feat(): amazing new module',
          hash: '56185b7356766d2b30cfa2406b257080272e0b7a'
        }
      },
      {
        hash: '56185b7356766d2b30cfa2406b257080272e0b7a',
        author: 'Author',
        date: new Date(),
        message: '',
        tags: [],
        type: 'feat',
        scope: null,
        subject: 'amazing new module',
        header: 'feat(): amazing new module',
        body: null,
        footer: 'BREAKING CHANGE: Not backward compatible.',
        notes: [],
        references: [],
        revert: null
      },
      {
        hash: '815a3f0717bf1dfce007bd076420c609504edcf3',
        author: 'Author',
        date: new Date(),
        message: '',
        tags: [],
        type: 'What',
        scope: null,
        subject: 'new feature',
        header: 'feat(): new feature',
        body: null,
        footer: null,
        notes: [],
        references: [],
        revert: null
      },
      {
        hash: '74a3e4d6d25dee2c0d6483a0a3887417728cbe0a',
        author: 'Author',
        date: new Date(),
        message: '',
        tags: [],
        type: 'Chores',
        scope: null,
        subject: 'first commit',
        header: 'chore: first commit',
        body: null,
        footer: null,
        notes: [],
        references: [],
        revert: null
      }
    ]

    commits = filterReverted(commits)

    assert.strictEqual(commits.length, 3)

    assert.deepStrictEqual(
      commits.map(commit => commit.hash),
      [
        '207abfa16885ef5ff88dfc6cdde694bb3fd03104',
        '815a3f0717bf1dfce007bd076420c609504edcf3',
        '74a3e4d6d25dee2c0d6483a0a3887417728cbe0a'
      ]
    )
  })
})
