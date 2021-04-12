'use strict'

const assert = require('assert')
const betterThanBefore = require('better-than-before')()
const gitDummyCommit = require('git-dummy-commit')
const { describe, it } = require('mocha')
const shell = require('shelljs')
const temp = require('temp')

const conventionalRecommendedBump = require('./recommend-bump')

const preparing = betterThanBefore.preparing
shell.config.silent = true

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

describe('conventional-recommended-bump API', () => {
  describe('options object', () => {
    it("should throw an error if an 'options' object is not provided", async () => {
      await assert.rejects(() => conventionalRecommendedBump())
      await assert.rejects(() =>
        conventionalRecommendedBump('invalid options object')
      )
    })
  })

  it('should throw an error if there are no commits in the repository', async () => {
    preparing(1)
    await assert.rejects(
      () => conventionalRecommendedBump({ whatBump: () => {} }),
      /does not have any commits/
    )
  })

  describe('conventionalcommits ! in isolation', () => {
    it('recommends major if ! is used in isolation', async () => {
      preparing(2)

      const recommendation = await conventionalRecommendedBump({
        preset: { name: 'conventionalcommits' }
      })
      assert.notStrictEqual(recommendation.reason.indexOf('1 BREAKING'), -1)
      assert.strictEqual(recommendation.releaseType, 'major')
    })
  })

  describe("optional 'whatBump'", () => {
    it("should throw an error if 'whatBump' is defined but not a function", async () => {
      preparing(2)

      await assert.rejects(
        () => conventionalRecommendedBump({ whatBump: 'invalid' }, {}),
        { message: 'whatBump must be a function' }
      )
    })

    it("should return '{}' if no 'whatBump'", async () => {
      preparing(2)

      const recommendation = await conventionalRecommendedBump({}, {})
      assert.deepStrictEqual(recommendation, {})
    })

    it("should return '{}' if 'whatBump' returns 'null'", async () => {
      preparing(2)

      const recommendation = await conventionalRecommendedBump({
        whatBump: () => null
      })
      assert.deepStrictEqual(recommendation, {})
    })

    it("should return '{}' if 'whatBump' returns 'undefined'", async () => {
      preparing(2)

      const recommendation = await conventionalRecommendedBump({
        whatBump: () => undefined
      })
      assert.deepStrictEqual(recommendation, {})
    })

    it("should return what is returned by 'whatBump'", async () => {
      preparing(2)

      const recommendation = await conventionalRecommendedBump({
        whatBump: () => ({ test: 'test' })
      })
      assert.deepStrictEqual(recommendation, { test: 'test' })
    })

    it("should send options to 'whatBump'", async () => {
      preparing(2)

      const recommendation = await conventionalRecommendedBump({
        lernaPackage: 'test',
        whatBump: (commits, options) => options.lernaPackage
      })
      assert.deepStrictEqual(recommendation, 'test')
    })

    it("should return 'releaseType' as undefined if 'level' is not valid", async () => {
      preparing(2)

      const recommendation = await conventionalRecommendedBump({
        whatBump: () => ({ level: 'test' })
      })
      assert.deepStrictEqual(recommendation, {
        level: 'test',
        releaseType: undefined
      })
    })
  })

  describe('warn logging', () => {
    it("will ignore 'warn' option if it's not a function", async () => {
      preparing(3)

      await conventionalRecommendedBump({}, { warn: 'invalid' })
    })

    it('should warn if there is no new commits since last release', async () => {
      preparing(3)

      let called = 0
      await conventionalRecommendedBump(
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
    it('recommends a patch release for a feature when preMajor=true', async () => {
      preparing(4)

      const recommendation = await conventionalRecommendedBump({
        preset: { name: 'conventionalcommits', preMajor: true }
      })
      assert.notStrictEqual(recommendation.reason.indexOf('1 features'), -1)
      assert.strictEqual(recommendation.releaseType, 'patch')
    })

    it('recommends a minor release for a feature when preMajor=false', async () => {
      preparing(4)

      const recommendation = await conventionalRecommendedBump({
        preset: { name: 'conventionalcommits' }
      })
      assert.notStrictEqual(recommendation.reason.indexOf('1 features'), -1)
      assert.strictEqual(recommendation.releaseType, 'minor')
    })

    it('should ignore reverted commits', async () => {
      preparing(5)

      let called = 0
      await conventionalRecommendedBump({
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
      await conventionalRecommendedBump({
        ignoreReverted: false,
        whatBump: commits => {
          assert.strictEqual(commits.length, 2)
          ++called
        }
      })
      assert.strictEqual(called, 1)
    })

    it('throws an error if unable to load a preset package', async () => {
      preparing(6)

      await assert.rejects(
        () => conventionalRecommendedBump({ preset: 'does-not-exist' }, {}),
        {
          message:
            'Unable to load the "does-not-exist" preset package. Please make sure it\'s installed.'
        }
      )
    })

    it('recommends a minor release for a breaking change when preMajor=true', async () => {
      preparing(6)

      const recommendation = await conventionalRecommendedBump({
        preset: { name: 'conventionalcommits', preMajor: true }
      })
      assert.notStrictEqual(recommendation.reason.indexOf('1 BREAKING'), -1)
      assert.strictEqual(recommendation.releaseType, 'minor')
    })

    it('recommends a major release for a breaking change when preMajor=false', async () => {
      preparing(6)

      const recommendation = await conventionalRecommendedBump({
        preset: { name: 'conventionalcommits' }
      })
      assert.notStrictEqual(recommendation.reason.indexOf('1 BREAKING'), -1)
      assert.strictEqual(recommendation.releaseType, 'major')
    })
  })

  describe('repository with custom tag prefix', () => {
    it('should recommends a minor release if appropriate', async () => {
      preparing(6)

      let called = 0
      await conventionalRecommendedBump({
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
      await conventionalRecommendedBump({
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
      await conventionalRecommendedBump({
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
