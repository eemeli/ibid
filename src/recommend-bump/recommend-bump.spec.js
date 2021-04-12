'use strict'

const assert = require('assert')
const { describe, it } = require('mocha')

const recommendBump = require('./recommend-bump')

const featCommit = Object.freeze({
  hash: '4917f329b13b590e1c34037d883ecb6e2f95789d',
  message: 'feat: my second commit',
  body: null,
  footer: null,
  header: 'feat: my second commit',
  notes: [],
  revert: null,
  subject: 'my second commit',
  type: 'feat'
})

const breakCommit = Object.freeze({
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
})

describe('recommend-bump', () => {
  describe('arguments', () => {
    it("should throw an error if an 'options' object is not provided", async () => {
      await assert.rejects(recommendBump(), {
        message: "The 'options' argument must be an object."
      })
      await assert.rejects(recommendBump('invalid options object'), {
        message: "The 'options' argument must be an object."
      })
    })
    it("should throw an error if a 'commits' array is not provided", async () => {
      await assert.rejects(recommendBump({}), {
        message: "The 'commits' argument must be an array."
      })
      await assert.rejects(recommendBump({}, 'invalid commits'), {
        message: "The 'commits' argument must be an array."
      })
    })
  })

  describe('conventionalcommits ! in isolation', () => {
    it('recommends major if ! is used in isolation', async () => {
      const recommendation = await recommendBump(
        { preset: { name: 'conventionalcommits' } },
        [featCommit, breakCommit]
      )
      assert.notStrictEqual(recommendation.reason.indexOf('1 BREAKING'), -1)
      assert.strictEqual(recommendation.releaseType, 'major')
    })
  })

  describe("optional 'whatBump'", () => {
    it("should throw an error if 'whatBump' is defined but not a function", async () => {
      await assert.rejects(
        recommendBump({ whatBump: 'invalid' }, [breakCommit]),
        { message: 'whatBump must be a function' }
      )
    })

    it("should return '{}' if no 'whatBump'", async () => {
      const recommendation = await recommendBump({}, [breakCommit])
      assert.deepStrictEqual(recommendation, {})
    })

    it("should return '{}' if 'whatBump' returns 'null'", async () => {
      const recommendation = await recommendBump({ whatBump: () => null }, [
        breakCommit
      ])
      assert.deepStrictEqual(recommendation, {})
    })

    it("should return '{}' if 'whatBump' returns 'undefined'", async () => {
      const recommendation = await recommendBump(
        { whatBump: () => undefined },
        [breakCommit]
      )
      assert.deepStrictEqual(recommendation, {})
    })

    it("should return what is returned by 'whatBump'", async () => {
      const recommendation = await recommendBump(
        { whatBump: () => ({ test: 'test' }) },
        [breakCommit]
      )
      assert.deepStrictEqual(recommendation, { test: 'test' })
    })

    it("should send options to 'whatBump'", async () => {
      const recommendation = await recommendBump(
        {
          lernaPackage: 'test',
          whatBump: (commits, options) => options.lernaPackage
        },
        [breakCommit]
      )
      assert.deepStrictEqual(recommendation, 'test')
    })

    it("should return 'releaseType' as undefined if 'level' is not valid", async () => {
      const recommendation = await recommendBump(
        { whatBump: () => ({ level: 'test' }) },
        [breakCommit]
      )
      assert.deepStrictEqual(recommendation, {
        level: 'test',
        releaseType: undefined
      })
    })
  })

  describe('loading a preset package', () => {
    it('recommends a patch release for a feature when preMajor=true', async () => {
      const recommendation = await recommendBump(
        { preset: { name: 'conventionalcommits', preMajor: true } },
        [featCommit]
      )
      assert.notStrictEqual(recommendation.reason.indexOf('1 features'), -1)
      assert.strictEqual(recommendation.releaseType, 'patch')
    })

    it('recommends a minor release for a feature when preMajor=false', async () => {
      const recommendation = await recommendBump(
        { preset: { name: 'conventionalcommits' } },
        [featCommit]
      )
      assert.notStrictEqual(recommendation.reason.indexOf('1 features'), -1)
      assert.strictEqual(recommendation.releaseType, 'minor')
    })

    it('throws an error if unable to load a preset package', async () => {
      await assert.rejects(
        recommendBump({ preset: 'does-not-exist' }, [breakCommit]),
        {
          message:
            'Unable to load the "does-not-exist" preset package. Please make sure it\'s installed.'
        }
      )
    })

    it('recommends a minor release for a breaking change when preMajor=true', async () => {
      const recommendation = await recommendBump(
        { preset: { name: 'conventionalcommits', preMajor: true } },
        [breakCommit]
      )
      assert.notStrictEqual(recommendation.reason.indexOf('1 BREAKING'), -1)
      assert.strictEqual(recommendation.releaseType, 'minor')
    })

    it('recommends a major release for a breaking change when preMajor=false', async () => {
      const recommendation = await recommendBump(
        { preset: { name: 'conventionalcommits' } },
        [breakCommit]
      )
      assert.notStrictEqual(recommendation.reason.indexOf('1 BREAKING'), -1)
      assert.strictEqual(recommendation.releaseType, 'major')
    })
  })
})
