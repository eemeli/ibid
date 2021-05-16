'use strict'
const { expect } = require('chai')
const { describe, it } = require('mocha')
const gitDummyCommit = require('git-dummy-commit')
const shell = require('shelljs')
const path = require('path')
const betterThanBefore = require('better-than-before')()

const core = require('../../core/core')
const getPreset = require('../preset')

const { preparing } = betterThanBefore
const preset = getPreset()

betterThanBefore.setups([
  function () {
    shell.config.resetForTesting()
    shell.cd(__dirname)
    shell.rm('-rf', 'tmp')
    shell.mkdir('tmp')
    shell.cd('tmp')
    shell.mkdir('git-templates')
    shell.exec('git init --template=./git-templates')

    gitDummyCommit([
      'build!: first build setup',
      'BREAKING CHANGE: New build system.'
    ])
    gitDummyCommit([
      'ci(travis): add TravisCI pipeline',
      'BREAKING CHANGE: Continuously integrated.'
    ])
    gitDummyCommit([
      'Feat: amazing new module',
      'BREAKING CHANGE: Not backward compatible.'
    ])
    gitDummyCommit([
      'Fix(compile): avoid a bug',
      'BREAKING CHANGE: The Change is huge.'
    ])
    gitDummyCommit(['perf(ngOptions): make it faster', ' closes #1, #2'])
    gitDummyCommit([
      'fix(changelog): proper issue links',
      ' see #1, conventional-changelog/standard-version#358'
    ])
    gitDummyCommit('revert(ngOptions): bad commit')
    gitDummyCommit('fix(*): oops')
    gitDummyCommit(['fix(changelog): proper issue links', ' see GH-1'])
    gitDummyCommit(['feat(awesome): adress EXAMPLE-1'])
    gitDummyCommit(['chore(deps): upgrade example from 1 to 2'])
    gitDummyCommit(['chore(release): release 0.0.0'])
  },
  function () {
    gitDummyCommit(['feat(awesome): addresses the issue brought up in #133'])
  },
  function () {
    gitDummyCommit(['feat(awesome): fix #88'])
  },
  function () {
    gitDummyCommit(['feat(awesome): issue brought up by @bcoe! on Friday'])
  },
  function () {
    gitDummyCommit([
      'build(npm): edit build script',
      'BREAKING CHANGE: The Change is huge.'
    ])
    gitDummyCommit([
      'ci(travis): setup travis',
      'BREAKING CHANGE: The Change is huge.'
    ])
    gitDummyCommit([
      'docs(readme): make it clear',
      'BREAKING CHANGE: The Change is huge.'
    ])
    gitDummyCommit([
      'style(whitespace): make it easier to read',
      'BREAKING CHANGE: The Change is huge.'
    ])
    gitDummyCommit([
      'refactor(code): change a lot of code',
      'BREAKING CHANGE: The Change is huge.'
    ])
    gitDummyCommit([
      'test(*)!: more tests',
      'BREAKING CHANGE: The Change is huge.'
    ])
  },
  function () {
    shell.exec('git tag v0.1.0')
    gitDummyCommit('feat: some more feats')
  },
  function () {
    shell.exec('git tag v0.2.0')
    gitDummyCommit('feature: some more features')
  },
  function () {
    gitDummyCommit(['feat(*): implementing #5 by @dlmr', ' closes #10'])
  },
  function () {
    gitDummyCommit(['fix: use npm@5 (@username)'])
    gitDummyCommit([
      'build(deps): bump @dummy/package from 7.1.2 to 8.0.0',
      'BREAKING CHANGE: The Change is huge.'
    ])
    gitDummyCommit([
      'feat: complex new feature',
      'this is a complex new feature with many reviewers',
      'Reviewer: @hutson',
      'Fixes: #99',
      'Refs: #100',
      'BREAKING CHANGE: this completely changes the API'
    ])
    gitDummyCommit(['FEAT(foo)!: incredible new flag FIXES: #33'])
  },
  function () {
    gitDummyCommit([
      'Revert \\"feat: default revert format\\"',
      'This reverts commit 1234.'
    ])
    gitDummyCommit([
      'revert: feat: custom revert format',
      'This reverts commit 5678.'
    ])
  }
])

describe('conventionalcommits.org preset', () => {
  it('should work if there is no semver tag', async () => {
    preparing(1)

    const changelog = await core({ config: preset })

    expect(changelog).to.include('first build setup')
    expect(changelog).to.include('**travis:** add TravisCI pipeline')
    expect(changelog).to.include('**travis:** Continuously integrated.')
    expect(changelog).to.include('amazing new module')
    expect(changelog).to.include('**compile:** avoid a bug')
    expect(changelog).to.include('make it faster')
    expect(changelog).to.include(
      ', closes [#1](https://github.com/eemeli/version/issues/1) [#2](https://github.com/eemeli/version/issues/2)'
    )
    expect(changelog).to.include('New build system.')
    expect(changelog).to.include('Not backward compatible.')
    expect(changelog).to.include('**compile:** The Change is huge.')
    expect(changelog).to.include('Build System')
    expect(changelog).to.include('Continuous Integration')
    expect(changelog).to.include('Features')
    expect(changelog).to.include('Bug Fixes')
    expect(changelog).to.include('Performance Improvements')
    expect(changelog).to.include('Reverts')
    expect(changelog).to.include('bad commit')
    expect(changelog).to.include('BREAKING CHANGE')

    expect(changelog).to.not.include('ci')
    expect(changelog).to.not.include('feat')
    expect(changelog).to.not.include('fix')
    expect(changelog).to.not.include('perf')
    expect(changelog).to.not.include('revert')
    expect(changelog).to.not.include('***:**')
    expect(changelog).to.not.include(': Not backward compatible.')

    // CHANGELOG should group sections in order of importance:
    expect(
      changelog.indexOf('BREAKING CHANGE') < changelog.indexOf('Features') &&
        changelog.indexOf('Features') < changelog.indexOf('Bug Fixes') &&
        changelog.indexOf('Bug Fixes') <
          changelog.indexOf('Performance Improvements') &&
        changelog.indexOf('Performance Improvements') <
          changelog.indexOf('Reverts')
    ).to.equal(true)
  })

  it('should not list breaking change twice if ! is used', async () => {
    preparing(1)

    const changelog = await core({ config: preset })
    expect(changelog).to.not.match(/\* first build setup\r?\n/)
  })

  it('should allow alternative "types" configuration to be provided', async () => {
    preparing(1)
    const changelog = await core({
      config: require('../preset')({ types: [] })
    })

    expect(changelog).to.include('first build setup')
    expect(changelog).to.include('**travis:** add TravisCI pipeline')
    expect(changelog).to.include('**travis:** Continuously integrated.')
    expect(changelog).to.include('amazing new module')
    expect(changelog).to.include('**compile:** avoid a bug')
    expect(changelog).to.include('Feat')

    expect(changelog).to.not.include('make it faster')
    expect(changelog).to.not.include('Reverts')
  })

  it('should allow matching "scope" to configuration', async () => {
    preparing(1)
    const changelog = await core({
      config: require('../preset')({
        types: [{ type: 'chore', scope: 'deps', section: 'Dependencies' }]
      })
    })
    expect(changelog).to.include('### Dependencies')
    expect(changelog).to.include('**deps:** upgrade example from 1 to 2')

    expect(changelog).to.not.include('release 0.0.0')
  })

  it('should properly format external repository issues', async () => {
    preparing(1)
    const changelog = await core({ config: preset })
    expect(changelog).to.include(
      '[#1](https://github.com/eemeli/version/issues/1)'
    )
    expect(changelog).to.include(
      '[conventional-changelog/standard-version#358](https://github.com/conventional-changelog/standard-version/issues/358)'
    )
  })

  it('should properly format external repository issues given an `issueUrlFormat`', async () => {
    preparing(1)
    const changelog = await core({
      config: getPreset({
        issuePrefixes: ['#', 'GH-'],
        issueUrlFormat: 'issues://{{repository}}/issues/{{id}}'
      })
    })
    expect(changelog).to.include('[#1](issues://version/issues/1)')
    expect(changelog).to.include(
      '[conventional-changelog/standard-version#358](issues://standard-version/issues/358)'
    )
    expect(changelog).to.include('[GH-1](issues://version/issues/1)')
  })

  it('should properly format issues in external issue tracker given an `issueUrlFormat` with `prefix`', async () => {
    preparing(1)
    const changelog = await core({
      config: getPreset({
        issueUrlFormat: 'https://example.com/browse/{{prefix}}{{id}}',
        issuePrefixes: ['EXAMPLE-']
      })
    })
    expect(changelog).to.include(
      '[EXAMPLE-1](https://example.com/browse/EXAMPLE-1)'
    )
  })

  it('should replace #[0-9]+ with GitHub format issue URL by default', async () => {
    preparing(2)

    const changelog = await core({ config: preset })
    expect(changelog).to.include(
      '[#133](https://github.com/eemeli/version/issues/133)'
    )
  })

  it('should remove the issues that already appear in the subject', async () => {
    preparing(3)

    const changelog = await core({ config: preset })
    expect(changelog).to.include(
      '[#88](https://github.com/eemeli/version/issues/88)'
    )
    expect(changelog).to.not.include(
      'closes [#88](https://github.com/eemeli/version/issues/88)'
    )
  })

  it('should replace @user with configured userUrlFormat', async () => {
    preparing(4)

    const changelog = await core({
      config: require('../preset')({ userUrlFormat: 'https://foo/{{user}}' })
    })
    expect(changelog).to.include('[@bcoe](https://foo/bcoe)')
  })

  it('should not discard commit if there is BREAKING CHANGE', async () => {
    preparing(5)

    const changelog = await core({ config: preset })
    expect(changelog).to.include('Continuous Integration')
    expect(changelog).to.include('Build System')
    expect(changelog).to.include('Documentation')
    expect(changelog).to.include('Styles')
    expect(changelog).to.include('Code Refactoring')
    expect(changelog).to.include('Tests')
  })

  it('should omit optional ! in breaking commit', async () => {
    preparing(5)

    const changelog = await core({ config: preset })
    expect(changelog).to.include('### Tests')
    expect(changelog).to.include('* more tests')
  })

  it('should work if there is a semver tag', async () => {
    preparing(6)

    const changelog = await core({ config: preset, outputUnreleased: true })
    expect(changelog).to.include('some more feats')
    expect(changelog).to.not.include('BREAKING')
  })

  it('should support "feature" as alias for "feat"', async () => {
    preparing(7)
    const changelog = await core({ config: preset, outputUnreleased: true })
    expect(changelog).to.include('some more features')
    expect(changelog).to.not.include('BREAKING')
  })

  it('should work with unknown host', async () => {
    preparing(7)
    const changelog = await core({
      config: require('../preset')({
        commitUrlFormat: 'http://unknown/commit/{{hash}}',
        compareUrlFormat:
          'http://unknown/compare/{{previousTag}}...{{currentTag}}'
      }),
      pkg: { path: path.join(__dirname, 'fixtures/_unknown-host.json') }
    })
    expect(changelog).to.include('(http://unknown/compare')
    expect(changelog).to.include('](http://unknown/commit/')
  })

  it('should work specifying where to find a package.json using conventional-changelog-core', async () => {
    preparing(8)
    const changelog = await core({
      config: preset,
      pkg: { path: path.join(__dirname, 'fixtures/_known-host.json') }
    })
    expect(changelog).to.include(
      '(https://github.com/conventional-changelog/example/compare'
    )
    expect(changelog).to.include(
      '](https://github.com/conventional-changelog/example/commit/'
    )
    expect(changelog).to.include(
      '](https://github.com/conventional-changelog/example/issues/'
    )
  })

  it('should fallback to the closest package.json when not providing a location for a package.json', async () => {
    preparing(8)
    const changelog = await core({ config: preset })
    expect(changelog).to.include('(https://github.com/eemeli/version/compare')
    expect(changelog).to.include('](https://github.com/eemeli/version/commit/')
    expect(changelog).to.include('](https://github.com/eemeli/version/issues/')
  })

  it('should support non public GitHub repository locations', async () => {
    preparing(8)

    const changelog = await core({
      config: preset,
      pkg: { path: path.join(__dirname, 'fixtures/_ghe-host.json') }
    })
    expect(changelog).to.include('(https://github.internal.example.com/dlmr')
    expect(changelog).to.include(
      '(https://github.internal.example.com/conventional-changelog/internal/compare'
    )
    expect(changelog).to.include(
      '](https://github.internal.example.com/conventional-changelog/internal/commit/'
    )
    expect(changelog).to.include(
      '5](https://github.internal.example.com/conventional-changelog/internal/issues/5'
    )
    expect(changelog).to.include(
      ' closes [#10](https://github.internal.example.com/conventional-changelog/internal/issues/10)'
    )
  })

  it('should only replace with link to user if it is an username', async () => {
    preparing(9)

    const changelog = await core({ config: preset })
    expect(changelog).to.not.include('(https://github.com/5')
    expect(changelog).to.include('(https://github.com/username')

    expect(changelog).to.not.include(
      '[@dummy](https://github.com/dummy)/package'
    )
    expect(changelog).to.include('bump @dummy/package from')
  })

  it('supports multiple lines of footer information', async () => {
    preparing(9)

    const changelog = await core({ config: preset })
    expect(changelog).to.include('closes [#99]')
    expect(changelog).to.include('[#100]')
    expect(changelog).to.include('this completely changes the API')
  })

  it('does not require that types are case sensitive', async () => {
    preparing(9)

    const changelog = await core({ config: preset })
    expect(changelog).to.include('incredible new flag')
  })

  it('populates breaking change if ! is present', async () => {
    preparing(9)

    const changelog = await core({ config: preset })
    expect(changelog).to.match(/incredible new flag FIXES: #33\r?\n/)
  })

  it('parses both default (Revert "<subject>") and custom (revert: <subject>) revert commits', async () => {
    preparing(10)

    const changelog = await core({ config: preset })
    expect(changelog).to.match(/custom revert format/)
    expect(changelog).to.match(/default revert format/)
  })
})
