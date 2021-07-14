import { expect } from 'chai'
import { beforeEach, describe, it } from 'mocha'

import { parseCommit } from '../commits'
import { Context, createContext } from '../config/context'
import { applyBump, recommendBump } from './bump'

const choreCommit = parseCommit(`commit 730a7ec18af253b0b73d2932980d795efb6f8bec
Author: Author
Date:   0

    chore: my first commit`)

const fixCommit = parseCommit(`commit 78891adaa27e03e3c74d5e2f5edc6d7dfafe3bd8
Author: Author
Date:   0

    fix: my second commit`)

const featCommit = parseCommit(`commit 4917f329b13b590e1c34037d883ecb6e2f95789d
Author: Author
Date:   0

    feat: my third commit`)

const breakCommit = parseCommit(`commit a55a8346f3537274068c5374b05bf41c28e175fc
Author: Author
Date:   0

    feat: should not be taken into account

    BREAKING CHANGE: I broke the API`)

describe('recommend-bump', () => {
  let ctx: Context
  beforeEach(async () => (ctx = await createContext()))

  it('returns null for a chore', () => {
    const bump = recommendBump(ctx, [choreCommit])
    expect(bump).to.equal(null)
  })

  it('returns "patch" for a fix', () => {
    const bump = recommendBump(ctx, [choreCommit, fixCommit])
    expect(bump).to.equal('patch')
  })

  it('returns "minor" for a feat', () => {
    const bump = recommendBump(ctx, [choreCommit, featCommit, fixCommit])
    expect(bump).to.equal('minor')
  })

  describe('breaking changes', () => {
    for (const [version, exp] of [
      ['1.2.3', 'major'],
      ['1.2.3-4', 'premajor'],
      ['2.0.0-4', 'prerelease'],
      ['0.1.2', 'minor'],
      ['0.1.2-3', 'preminor']
    ]) {
      it(`returns "${exp}" for a breaking change on ${version}`, () => {
        ctx.package = { name: 'foo', version }
        const bump = recommendBump(ctx, [
          choreCommit,
          featCommit,
          breakCommit,
          fixCommit
        ])
        expect(bump).to.equal(exp)
      })
    }
  })

  it('returns "patch" for a chore, if included in changelog', () => {
    ctx.config.changelogSections = ['chore']
    const bump = recommendBump(ctx, [choreCommit])
    expect(bump).to.equal('patch')
  })

  it('returns "patch" for a chore, if including all changes', () => {
    ctx.config.bumpAllChanges = true
    const bump = recommendBump(ctx, [choreCommit])
    expect(bump).to.equal('patch')
  })

  it('returns null for an empty list', () => {
    const bump = recommendBump(ctx, [])
    expect(bump).to.equal(null)
  })

  it('always returns null for an empty list', () => {
    ctx.config.bumpAllChanges = true
    const bump = recommendBump(ctx, [])
    expect(bump).to.equal(null)
  })
})

describe('apply-bump', () => {
  let ctx: Context
  beforeEach(async () => (ctx = await createContext()))

  it('returns null for no version in context', () => {
    ctx.package = null
    expect(applyBump(ctx, 'minor')).to.equal(null)
  })

  for (const [version, bump, exp] of [
    ['1.2.3', null, null],
    ['1.2.3', 'minor', '1.3.0'],
    ['1.2.3-foo.4', 'preminor', '1.3.0-foo.0']
  ] as const) {
    it(`returns ${exp} for ${bump} bump on ${version}`, () => {
      ctx.package = { name: 'foo', version }
      expect(applyBump(ctx, bump)).to.equal(exp)
    })
  }
})
