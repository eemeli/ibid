import { expect } from 'chai'
import { describe, it } from 'mocha'

import { parseCommit } from '../commits'
import { recommendBump } from './recommend-bump'

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
  it('returns null', () => {
    const bump = recommendBump([choreCommit])
    expect(bump).to.equal(null)
  })

  it('returns "patch"', () => {
    const bump = recommendBump([choreCommit, fixCommit])
    expect(bump).to.equal('patch')
  })

  it('returns "minor"', () => {
    const bump = recommendBump([choreCommit, featCommit, fixCommit])
    expect(bump).to.equal('minor')
  })

  it('returns "major"', () => {
    const bump = recommendBump([
      choreCommit,
      featCommit,
      breakCommit,
      fixCommit
    ])
    expect(bump).to.equal('major')
  })
})
