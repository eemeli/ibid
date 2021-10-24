import { expect } from 'chai'
import { describe, it } from 'mocha'
import { Writable } from 'stream'
import { version } from './version'

class MockOut extends Writable {
  calls: string[] = []
  _write(chunk: Buffer, _enc: unknown, cb: () => void) {
    this.calls.push(chunk.toString('utf8'))
    cb()
  }
}

describe('version', () => {
  it('No other options with --amend', async () => {
    const out = new MockOut()
    try {
      await version({ amend: true, init: true }, out)
      throw new Error('Expected an error')
    } catch (error) {
      if (!/other arguments/.test(error.message)) throw error
    }
    expect(out.calls).to.deep.equal([])
  })

  it('Require --yes for custom output', async () => {
    const out = new MockOut()
    try {
      await version({ path: ['.'] }, out)
      throw new Error('Expected an error')
    } catch (error) {
      if (
        error.message !==
        'Always use the --yes option if output is not stderr or stdout'
      )
        throw error
    }
    expect(out.calls).to.deep.equal([])
  })
})
