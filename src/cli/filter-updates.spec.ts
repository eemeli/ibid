import { expect } from 'chai'
import { beforeEach, describe, it } from 'mocha'
import { Writable } from 'stream'
import { createContext } from '../config/context'
import type { PackageUpdate } from '../index'
import { source } from '../test-helpers/source'
import { _test_internals } from './filter-updates'

const { prettyPrint, editTemplate, applyEdits } = _test_internals

class MockOut extends Writable {
  calls: string[] = []
  _write(chunk: Buffer, _enc: unknown, cb: () => void) {
    this.calls.push(chunk.toString('utf8'))
    cb()
  }
}

describe('filter-updates', () => {
  describe('one package', () => {
    let updates: PackageUpdate[]
    beforeEach(async () => {
      const context = Object.assign(await createContext(), {
        package: { name: 'foo', version: '1.2.3' }
      })
      updates = [{ context, commits: [], bump: 'patch', version: '1.2.4' }]
    })

    it('prettyPrint', () => {
      expect(prettyPrint(updates)).to.equal(source`
        Updating 1/1 package:

            foo: patch (1.2.3 -> 1.2.4, 0 commits)

      `)
    })

    it('editTemplate', () => {
      const res = editTemplate(updates).replace(/# Commands.*/s, 'END\n')
      expect(res).to.equal(source`
        patch foo (1.2.3, 0 commits)

        # Update package versions
        #
        END
      `)
    })

    it('applyEdits: keep', () => {
      const out = new MockOut()
      applyEdits(out, updates, 'keep foo\n')
      expect(updates).to.have.length(1)
      expect(updates[0]).to.deep.include({ bump: null, version: null })
    })

    it('applyEdits: minor', () => {
      const out = new MockOut()
      applyEdits(out, updates, 'minor foo\n')
      expect(updates).to.have.length(1)
      expect(updates[0]).to.deep.include({ bump: 'minor', version: '1.3.0' })
    })

    it('applyEdits: premajor', () => {
      const out = new MockOut()
      applyEdits(out, updates, 'premajor foo\n')
      expect(updates).to.have.length(1)
      expect(updates[0]).to.deep.include({
        bump: 'premajor',
        version: '2.0.0-0'
      })
    })
  })

  describe('multiple packages', () => {
    let updates: PackageUpdate[]
    beforeEach(async () => {
      updates = [
        {
          context: Object.assign(await createContext(), {
            package: { name: 'foo', version: '1.2.3' }
          }),
          commits: [],
          bump: 'patch',
          version: '1.2.4'
        },
        {
          context: Object.assign(await createContext(), {
            package: { name: 'bar', version: '0.1.2' }
          }),
          commits: [],
          bump: null,
          version: null
        },
        {
          context: Object.assign(await createContext(), {
            package: { name: 'qux', version: '1.2.3-4' }
          }),
          commits: [],
          bump: 'prerelease',
          version: '1.2.3-5'
        }
      ]
    })

    it('prettyPrint', () => {
      expect(prettyPrint(updates)).to.equal(source`
        Updating 2/3 packages:

            foo: patch (1.2.3 -> 1.2.4, 0 commits)
            qux: prerelease (1.2.3-4 -> 1.2.3-5, 0 commits)

      `)
    })

    it('editTemplate', () => {
      const res = editTemplate(updates).replace(/# Commands.*/s, 'END\n')
      expect(res).to.equal(source`
        patch foo (1.2.3, 0 commits)
        prerelease qux (1.2.3-4, 0 commits)

        keep bar (0.1.2)

        # Update package versions
        #
        END
      `)
    })

    it('applyEdits: keep foo, set bar', () => {
      const out = new MockOut()
      applyEdits(out, updates, '# keep foo\nset=2.4.6 bar\nprerelease qux\n')
      expect(updates).to.have.length(3)
      expect(updates[0]).to.deep.include({ bump: null, version: null })
      expect(updates[1]).to.deep.include({ bump: 'set', version: '2.4.6' })
      expect(updates[2]).to.deep.include({
        bump: 'prerelease',
        version: '1.2.3-5'
      })
    })

    it('applyEdits: patch all', () => {
      const out = new MockOut()
      applyEdits(out, updates, 'patch foo\npatch bar\npatch qux\n')
      expect(updates).to.have.length(3)
      expect(updates[0]).to.deep.include({ bump: 'patch', version: '1.2.4' })
      expect(updates[1]).to.deep.include({ bump: 'patch', version: '0.1.3' })
      expect(updates[2]).to.deep.include({ bump: 'patch', version: '1.2.3' })
    })

    it('applyEdits: empty string', () => {
      const out = new MockOut()
      applyEdits(out, updates, '')
      expect(updates).to.have.length(3)
      expect(updates[0]).to.deep.include({ bump: null, version: null })
      expect(updates[1]).to.deep.include({ bump: null, version: null })
      expect(updates[2]).to.deep.include({ bump: null, version: null })
    })
  })
})
