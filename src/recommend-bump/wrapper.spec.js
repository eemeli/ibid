'use strict'

const assert = require('assert')
const betterThanBefore = require('better-than-before')()
const gitDummyCommit = require('git-dummy-commit')
const { describe, it } = require('mocha')
const shell = require('shelljs')
const temp = require('temp')

const wrapper = require('./wrapper')

const preparing = betterThanBefore.preparing
shell.config.silent = true

// dummy commits
/*
const break1 = {
  hash: '5c58d47f6f07e5dddd78741b506002852cfc419a',
  message: 'feat!: my first commit',
  body: null,
  footer: null,
  header: 'feat!: my first commit',
  notes: [{ title: 'BREAKING CHANGE', text: 'my first commit' }],
  revert: null,
  subject: 'my first commit',
  type: 'feat'
}

const feat2 = {
  hash: '4917f329b13b590e1c34037d883ecb6e2f95789d',
  message: 'feat: my second commit',
  body: null,
  footer: null,
  header: 'feat: my second commit',
  notes: [],
  revert: null,
  subject: 'my second commit',
  type: 'feat'
}

const revert2 = {
  hash: 'f0acd478f26d5959de5a86bbb1def202689f8ff4',
  message:
    'Revert "feat: my second commit"\n' +
    '\n' +
    'This reverts commit 4917f329b13b590e1c34037d883ecb6e2f95789d.',
  body: 'This reverts commit 4917f329b13b590e1c34037d883ecb6e2f95789d.',
  footer: null,
  header: 'Revert "feat: my second commit"',
  notes: [],
  revert: {
    header: 'feat: my second commit',
    hash: '4917f329b13b590e1c34037d883ecb6e2f95789d'
  },
  subject: null,
  type: null
}

const break2 = {
  hash: 'a55a8346f3537274068c5374b05bf41c28e175fc',
  message:
    'feat: should not be taken into account\n\nBREAKING CHANGE: I broke the API',
  body: '',
  footer: 'BREAKING CHANGE: I broke the API',
  header: 'feat: should not be taken into account',
  notes: [{ title: 'BREAKING CHANGE', text: 'I broke the API' }],
  revert: null,
  subject: 'should not be taken into account',
  type: 'feat'
}

const feat3 = {
  hash: '93192e934e7dd1660b6b726c5248803cb89f3518',
  message: 'feat: this should have been working',
  body: null,
  footer: null,
  header: 'feat: this should have been working',
  notes: [],
  revert: null,
  subject: 'this should have been working',
  type: 'feat'
}
*/

betterThanBefore.setups([
  () => {
    // 1
    const tempDirectory = temp.mkdirSync()
    shell.cd(tempDirectory)
    shell.exec('git init')
  },
  () => {
    // 2
    gitDummyCommit(['feat!: my first commit'])
  },
  () => {
    // 3
    shell.exec('git tag v1.0.0')
  },
  () => {
    // 4
    // we need non-empty commit, so we can revert it
    shell.touch('file1')
    shell.exec('git add file1')
    gitDummyCommit(['feat: my second commit'])
  },
  () => {
    // 5
    shell.exec('git revert HEAD')
  },
  () => {
    // 6
    gitDummyCommit([
      'feat: should not be taken into account',
      'BREAKING CHANGE: I broke the API'
    ])
    shell.exec('git tag ms/1.0.0')
    gitDummyCommit(['feat: this should have been working'])
  },
  () => {
    // 7
    shell.exec('git tag my-package@1.0.0')
    gitDummyCommit(['feat: this should have been working'])
  }
])

describe('recommend-bump wrapper', () => {
  describe('options object', () => {
    it("should throw an error if an 'options' object is not provided", async () => {
      await assert.rejects(wrapper())
      await assert.rejects(wrapper('invalid options object'))
    })
  })

  it('should throw an error if there are no commits in the repository', async () => {
    preparing(1)
    await assert.rejects(
      () => wrapper({ whatBump: () => {} }),
      /does not have any commits/
    )
  })

  describe('warn logging', () => {
    it("will ignore 'warn' option if it's not a function", async () => {
      preparing(3)

      await wrapper({}, { warn: 'invalid' })
    })

    it('should warn if there is no new commits since last release', async () => {
      preparing(3)

      let called = 0
      await wrapper(
        {},
        {
          warn: warning => {
            assert.strictEqual(warning, 'No commits since last release')
            ++called
          }
        }
      )
      assert.strictEqual(called, 1)
    })
  })

  describe('loading a preset package', () => {
    it('should ignore reverted commits', async () => {
      preparing(5)

      let called = 0
      await wrapper({
        whatBump: commits => {
          assert.strictEqual(commits.length, 0)
          ++called
        }
      })
      assert.strictEqual(called, 1)
    })

    it('should include reverted commits', async () => {
      preparing(5)

      let called = 0
      await wrapper({
        ignoreReverted: false,
        whatBump: commits => {
          assert.strictEqual(commits.length, 2)
          ++called
        }
      })
      assert.strictEqual(called, 1)
    })
  })

  describe('repository with custom tag prefix', () => {
    it('should recommends a minor release if appropriate', async () => {
      preparing(6)

      let called = 0
      await wrapper({
        tagPrefix: 'ms/',
        whatBump: commits => {
          assert.strictEqual(commits.length, 1)
          assert.strictEqual(commits[0].type, 'feat')
          ++called
        }
      })
      assert.strictEqual(called, 1)
    })
  })

  describe('repository with lerna tags', () => {
    it("should recommend 'major' version bump when not using lerna tags", async () => {
      preparing(7)

      let called = 0
      await wrapper({
        whatBump: commits => {
          assert.strictEqual(commits.length, 3)
          ++called
        }
      })
      assert.strictEqual(called, 1)
    })

    it("should recommend 'minor' version bump when lerna tag option is enabled", async () => {
      preparing(7)

      let called = 0
      await wrapper({
        lernaPackage: 'my-package',
        whatBump: commits => {
          assert.strictEqual(commits.length, 1)
          assert.strictEqual(commits[0].type, 'feat')
          ++called
        }
      })
      assert.strictEqual(called, 1)
    })
  })
})
