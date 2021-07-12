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

  it('returns "major" for a breaking change', () => {
    const bump = recommendBump(ctx, [
      choreCommit,
      featCommit,
      breakCommit,
      fixCommit
    ])
    expect(bump).to.equal('major')
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
  describe('valid', () => {
    for (const { prev, bump, pr: prerelease, exp } of [
      { prev: '1.2.3', bump: 'patch', pr: null, exp: '1.2.4' },
      { prev: '1.2.3', bump: 'minor', pr: null, exp: '1.3.0' },
      { prev: '1.2.3', bump: 'major', pr: null, exp: '2.0.0' },
      { prev: '1.2.3', bump: 'patch', pr: true, exp: '1.2.4-0' },
      { prev: '1.2.3', bump: 'minor', pr: true, exp: '1.3.0-0' },
      { prev: '1.2.3', bump: 'major', pr: true, exp: '2.0.0-0' },
      { prev: '1.2.3', bump: 'patch', pr: 'foo', exp: '1.2.4-foo.0' },
      { prev: '1.2.3', bump: 'minor', pr: 'foo', exp: '1.3.0-foo.0' },
      { prev: '1.2.3', bump: 'major', pr: 'foo', exp: '2.0.0-foo.0' },

      { prev: '1.2.3-4', bump: 'patch', pr: null, exp: '1.2.3-5' },
      { prev: '1.2.3-4', bump: 'minor', pr: null, exp: '1.3.0-0' },
      { prev: '1.2.3-4', bump: 'major', pr: null, exp: '2.0.0-0' },
      { prev: '1.2.3-4', bump: 'patch', pr: true, exp: '1.2.3-5' },
      { prev: '1.2.3-4', bump: 'minor', pr: true, exp: '1.3.0-0' },
      { prev: '1.2.3-4', bump: 'major', pr: true, exp: '2.0.0-0' },
      { prev: '1.2.3-4', bump: 'patch', pr: false, exp: '1.2.3' },
      { prev: '1.2.3-4', bump: 'minor', pr: false, exp: '1.3.0' },
      { prev: '1.2.3-4', bump: 'major', pr: false, exp: '2.0.0' },
      { prev: '1.2.3-4', bump: 'patch', pr: 'foo', exp: '1.2.3-foo.0' },
      { prev: '1.2.3-4', bump: 'minor', pr: 'foo', exp: '1.3.0-foo.0' },
      { prev: '1.2.3-4', bump: 'major', pr: 'foo', exp: '2.0.0-foo.0' },

      { prev: '1.2.3-foo.4', bump: 'patch', pr: 'foo', exp: '1.2.3-foo.5' },
      { prev: '1.2.3-foo.4', bump: 'minor', pr: 'foo', exp: '1.3.0-foo.0' },
      { prev: '1.2.3-foo.4', bump: 'major', pr: 'foo', exp: '2.0.0-foo.0' },
      { prev: '1.2.3-foo.4', bump: 'patch', pr: 'bar', exp: '1.2.3-bar.0' },
      { prev: '1.2.3-foo.4', bump: 'minor', pr: 'bar', exp: '1.3.0-bar.0' },
      { prev: '1.2.3-foo.4', bump: 'major', pr: 'bar', exp: '2.0.0-bar.0' },

      { prev: '1.2.0-4', bump: 'patch', pr: null, exp: '1.2.0-5' },
      { prev: '1.2.0-4', bump: 'minor', pr: null, exp: '1.2.0-5' },
      { prev: '1.2.0-4', bump: 'major', pr: null, exp: '2.0.0-0' },
      { prev: '2.0.0-4', bump: 'patch', pr: null, exp: '2.0.0-5' },
      { prev: '2.0.0-4', bump: 'minor', pr: null, exp: '2.0.0-5' },
      { prev: '2.0.0-4', bump: 'major', pr: null, exp: '2.0.0-5' },

      { prev: '0.2.3', bump: 'patch', pr: null, exp: '0.2.4' },
      { prev: '0.2.3', bump: 'minor', pr: null, exp: '0.2.4' },
      { prev: '0.2.3', bump: 'major', pr: null, exp: '0.3.0' },
      { prev: '0.2.3', bump: 'v1', pr: null, exp: '1.0.0' },
      { prev: '0.2.3', bump: 'patch', pr: true, exp: '0.2.4-0' },
      { prev: '0.2.3', bump: 'minor', pr: true, exp: '0.2.4-0' },
      { prev: '0.2.3', bump: 'major', pr: true, exp: '0.3.0-0' },
      { prev: '0.2.3', bump: 'v1', pr: true, exp: '1.0.0-0' },
      { prev: '0.2.3', bump: 'patch', pr: 'foo', exp: '0.2.4-foo.0' },
      { prev: '0.2.3', bump: 'minor', pr: 'foo', exp: '0.2.4-foo.0' },
      { prev: '0.2.3', bump: 'major', pr: 'foo', exp: '0.3.0-foo.0' },
      { prev: '0.2.3', bump: 'v1', pr: 'foo', exp: '1.0.0-foo.0' }
    ] as const) {
      it(`${prev}/${bump}/${prerelease}`, () => {
        const res = applyBump(prev, bump, prerelease)
        expect(res).to.equal(exp)
      })
    }
  })

  describe('errors', () => {
    for (const { prev, bump } of [
      { prev: '1.2', bump: 'patch' },
      { prev: '1.2.3', bump: 'v1' },
      { prev: '1.2.3', bump: 'foo' as 'major' }
    ] as const) {
      it(`${prev}/${bump}`, () => {
        expect(() => applyBump(prev, bump, null)).to.throw()
      })
    }
  })
})
