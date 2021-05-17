'use strict'

const { expect } = require('chai')
const { describe, it } = require('mocha')
const { resolvePreset } = require('./preset-loader')

describe('presetLoader', () => {
  it('resolves unscoped package', () => {
    const res = resolvePreset('angular')
    expect(res).to.equal('conventional-changelog-angular')
  })

  it('resolves unscoped package containing path', () => {
    const res = resolvePreset('angular/preset/path')
    expect(res).to.equal('conventional-changelog-angular/preset/path')
  })

  it('resolves unscoped package with full package name', () => {
    const res = resolvePreset('conventional-changelog-angular')
    expect(res).to.equal('conventional-changelog-angular')
  })

  it('resolves unscoped package with full package name containing path', () => {
    const res = resolvePreset('conventional-changelog-angular/preset/path')
    expect(res).to.equal('conventional-changelog-angular/preset/path')
  })

  it('resolves scoped package', () => {
    const res = resolvePreset('@scope/angular')
    expect(res).to.equal('@scope/conventional-changelog-angular')
  })

  it('resolves scoped package containing path', () => {
    const res = resolvePreset('@scope/angular/preset/path')
    expect(res).to.equal('@scope/conventional-changelog-angular/preset/path')
  })

  it('resolves scoped package with full package name', () => {
    const res = resolvePreset('@scope/conventional-changelog-angular')
    expect(res).to.equal('@scope/conventional-changelog-angular')
  })

  it('resolves scoped package with full package name containing path', () => {
    const res = resolvePreset(
      '@scope/conventional-changelog-angular/preset/path'
    )
    expect(res).to.equal('@scope/conventional-changelog-angular/preset/path')
  })

  it('resolves package with an absolute file path', () => {
    const filePath = require.resolve('conventional-changelog-angular')
    const res = resolvePreset(filePath)
    expect(res).to.equal(filePath)
  })

  it('resolves package with an absolute file path name', () => {
    const filePath = require.resolve('conventional-changelog-angular')
    const res = resolvePreset({ name: filePath })
    expect(res).to.equal(filePath)
  })
})
