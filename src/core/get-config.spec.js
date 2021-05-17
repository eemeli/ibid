'use strict'

const assert = require('assert')
const { describe, it } = require('mocha')
const getConfig = require('./get-config')

describe('get-config', () => {
  it('rejects if preset package is not a promise, function, or object', async () => {
    await assert.rejects(
      () => getConfig({ config: 'invalid preset package' }),
      { message: 'preset package must be a promise, function, or object' }
    )
  })

  it('resolves a promise as a promise', async () => {
    const result = await getConfig({ config: Promise.resolve(true) })
    assert.deepStrictEqual(result, {
      gitRawCommitsOpts: null,
      gitRawExecOpts: null,
      parserOpts: null,
      recommendedBumpOpts: null,
      writerOpts: null
    })
  })

  it('resolves an object as a promise', async () => {
    const result = await getConfig({ config: { answer: 42 } })
    assert.deepStrictEqual(result, {
      answer: 42,
      gitRawCommitsOpts: null,
      gitRawExecOpts: null,
      parserOpts: null,
      recommendedBumpOpts: null,
      writerOpts: null
    })
  })

  it('resolves a callback function as a promise', async () => {
    const presetPackage = cb => cb(null, { answer: 42 })
    const result = await getConfig({ config: presetPackage })
    assert.deepStrictEqual(result, {
      answer: 42,
      gitRawCommitsOpts: null,
      gitRawExecOpts: null,
      parserOpts: null,
      recommendedBumpOpts: null,
      writerOpts: null
    })
  })

  it('fails promise if callback function returns error', async () => {
    const presetPackage = cb => cb(new Error('an error happened'))
    await assert.rejects(() => getConfig({ config: presetPackage }), {
      message: 'an error happened'
    })
  })
})
