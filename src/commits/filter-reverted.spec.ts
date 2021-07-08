import { expect } from 'chai'
import { describe, it } from 'mocha'
import { CommitMessage } from './commit-message'
import { filterReverted } from './filter-reverted'
import { Commit } from './parse-commit'

describe('filterReverted()', () => {
  it('should error if `commits` is not `array`', () => {
    expect(() => filterReverted((null as unknown) as Commit[])).to.throw()
  })

  it('should filter reverted commits that exist in the commits array', () => {
    const commits: Commit[] = [
      {
        hash: '207abfa16885ef5ff88dfc6cdde694bb3fd03104',
        merge: null,
        author: 'Author',
        date: new Date(),
        tags: [],
        message: new CommitMessage(
          'revert: feat(): a very important feature\n\nThis reverts commit 048fe156c9eddbe566f040f64ca6be1f55b16a23.'
        )
      },
      {
        hash: '789d898b5f8422d7f65cc25135af2c1a95a125ac',
        merge: null,
        author: 'Author',
        date: new Date(),
        tags: [],
        message: new CommitMessage(
          'revert: feat(): amazing new module\n\nThis reverts commit 56185b7356766d2b30cfa2406b257080272e0b7a.'
        )
      },
      {
        hash: '56185b7356766d2b30cfa2406b257080272e0b7a',
        merge: null,
        author: 'Author',
        date: new Date(),
        tags: [],
        message: new CommitMessage(
          'feat(): amazing new module\n\nBREAKING CHANGE: Not backward compatible.'
        )
      },
      {
        hash: '815a3f0717bf1dfce007bd076420c609504edcf3',
        merge: null,
        author: 'Author',
        date: new Date(),
        tags: [],
        message: new CommitMessage('feat(): new feature')
      },
      {
        hash: '74a3e4d6d25dee2c0d6483a0a3887417728cbe0a',
        merge: null,
        author: 'Author',
        date: new Date(),
        tags: [],
        message: new CommitMessage('chore: first commit')
      }
    ]

    expect(filterReverted(commits).map(commit => commit.hash)).to.deep.equal([
      '207abfa16885ef5ff88dfc6cdde694bb3fd03104',
      '815a3f0717bf1dfce007bd076420c609504edcf3',
      '74a3e4d6d25dee2c0d6483a0a3887417728cbe0a'
    ])
  })
})
