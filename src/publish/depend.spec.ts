import { expect } from 'chai'
import { describe, it } from 'mocha'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import { Writable } from 'stream'

import { applyDepend } from './depend'

import { promises } from 'fs'
const { mkdtemp, readFile, rm, rmdir } = promises

class MockOut extends Writable {
  calls: string[] = []
  _write(chunk: Buffer, _enc: unknown, cb: () => void) {
    this.calls.push(chunk.toString('utf8'))
    cb()
  }
}

describe('applyDepend', () => {
  let root: string
  before(async () => {
    const prefix = join(tmpdir(), 'ibid-')
    root = await mkdtemp(prefix)
  })
  after(async () => {
    expect(root).to.satisfy((root: string) => root.startsWith(tmpdir()))
    await (rm || rmdir)(root, { recursive: true })
  })

  it('no dependencies', async () => {
    const out = new MockOut()
    const fooPkg = { name: 'foo', version: '1.0.0' }
    const packages = new Map([['foo', { root, package: fooPkg }]])
    const res = await applyDepend(packages, 'latest', root, fooPkg, out)
    expect(res).to.equal(false)
    expect(out.calls).to.deep.equal([])
  })

  it('latest -> latest', async () => {
    const out = new MockOut()
    const fooPkg = {
      name: 'foo',
      version: '1.0.0',
      dependencies: { bar: '^1.0.0' }
    }
    const packages = new Map([
      ['bar', { root: '/bar', package: { name: 'bar', version: '1.0.0' } }],
      ['foo', { root, package: fooPkg }]
    ])
    const res = await applyDepend(packages, 'latest', root, fooPkg, out)
    expect(res).to.equal(false)
    expect(out.calls).to.deep.equal([])
  })

  it('latest -> local', async () => {
    const out = new MockOut()
    const fooPkg = {
      name: 'foo',
      version: '1.0.0',
      dependencies: { bar: '^1.0.0' }
    }
    const packages = new Map([
      ['bar', { root: '/bar', package: { name: 'bar', version: '1.0.0' } }],
      ['foo', { root, package: fooPkg }]
    ])
    const res = await applyDepend(packages, 'local', root, fooPkg, out)
    expect(res).to.equal(true)
    expect(out.calls).to.deep.equal([
      'Updating foo to use local dependencies ...\n'
    ])
    const pkgSrc = await readFile(resolve(root, 'package.json'), 'utf8')
    const pkg = JSON.parse(pkgSrc)
    expect(pkg.dependencies).to.have.property('bar')
    expect(pkg.dependencies.bar).to.match(/^file:.*bar$/)
  })

  it('latest -> exact', async () => {
    const out = new MockOut()
    const fooPkg = {
      name: 'foo',
      version: '1.0.0',
      dependencies: { bar: '^1.0.0' }
    }
    const packages = new Map([
      ['bar', { root: '/bar', package: { name: 'bar', version: '1.0.0' } }],
      ['foo', { root, package: fooPkg }]
    ])
    const res = await applyDepend(packages, 'exact', root, fooPkg, out)
    expect(res).to.equal(true)
    expect(out.calls).to.deep.equal([
      'Updating foo to use exact dependencies ...\n'
    ])
    const pkgSrc = await readFile(resolve(root, 'package.json'), 'utf8')
    const pkg = JSON.parse(pkgSrc)
    expect(pkg.dependencies).to.have.property('bar')
    expect(pkg.dependencies.bar).to.equal('1.0.0')
  })

  it('local -> latest', async () => {
    const out = new MockOut()
    const fooPkg = {
      name: 'foo',
      version: '1.0.0',
      dependencies: { bar: 'file:../path/to/bar' }
    }
    const packages = new Map([
      ['bar', { root: '/bar', package: { name: 'bar', version: '1.0.0' } }],
      ['foo', { root, package: fooPkg }]
    ])
    const res = await applyDepend(packages, 'latest', root, fooPkg, out)
    expect(res).to.equal(true)
    expect(out.calls).to.deep.equal([
      'Updating foo to use latest dependencies ...\n'
    ])
    const pkgSrc = await readFile(resolve(root, 'package.json'), 'utf8')
    const pkg = JSON.parse(pkgSrc)
    expect(pkg.dependencies).to.have.property('bar')
    expect(pkg.dependencies.bar).to.equal('^1.0.0')
  })
})
