'use strict'
const { expect } = require('chai')
const { describe, it } = require('mocha')
const gitTails = require('git-tails').sync
const shell = require('shelljs')
const gitDummyCommit = require('git-dummy-commit')
const betterThanBefore = require('better-than-before')()
const mkdirp = require('mkdirp')
const { writeFileSync } = require('fs')
const { join } = require('path')
const tmp = require('tmp')

const core = require('./core')

const { preparing } = betterThanBefore

let dir = ''

betterThanBefore.setups([
  function () {
    // 1
    shell.config.resetForTesting()
    shell.cd(__dirname)
    dir = process.cwd()
    const tmpDir = tmp.dirSync().name
    shell.mkdir(tmpDir)
    shell.cd(tmpDir)
    shell.mkdir('git-templates')
    shell.exec('git init --initial-branch master --template=./git-templates')
    writeFileSync(
      'package.json',
      '{ "name": "conventional-changelog-core", "repository": { "type": "git", "url": "https://github.com/conventional-changelog/conventional-changelog-core.git" } }'
    )
    gitDummyCommit('First commit')
  },
  function () {
    // 2
    shell.exec('git tag v0.1.0')
    gitDummyCommit('Second commit')
    gitDummyCommit('Third commit closes #1')
  },
  function () {
    // 3
    shell.exec('git checkout -b feature')
    gitDummyCommit('This commit is from feature branch')
    shell.exec('git checkout master')
    gitDummyCommit('This commit is from master branch')
    shell.exec('git merge feature -m"Merge branch \'feature\'"')
  },
  function () {
    // 4
    gitDummyCommit('Custom prefix closes @42')
  },
  function () {
    // 5
    gitDummyCommit('Custom prefix closes @43')
    gitDummyCommit('Old prefix closes #71')
  },
  function () {
    // 6
    gitDummyCommit('some more features')
    shell.exec('git tag v2.0.0')
  },
  function () {
    // 7
    gitDummyCommit('test8')
  },
  function () {
    // 8
    gitDummyCommit('test8')
  },
  function () {
    // 9
    gitDummyCommit(['test9', 'BREAKING CHANGE: super release!'])
  },
  function () {
    // 10
    shell.exec('git remote add origin https://github.com/user/repo.git')
  },
  function (context) {
    // 11
    shell.exec('git tag -d v0.1.0')
    const tails = gitTails()
    context.tail = tails[tails.length - 1].substring(0, 7)
  },
  function (context) {
    // 12
    shell.exec('git tag not-semver')
    gitDummyCommit()

    const head = shell.exec('git rev-parse HEAD').stdout.trim()
    gitDummyCommit('Revert \\"test9\\" This reverts commit ' + head + '.')
    context.head = shell.exec('git rev-parse HEAD').stdout.substring(0, 7)
  },
  function (context) {
    // 13
    const tail = context.tail
    shell.exec('git tag v0.0.1 ' + tail)
  },
  function () {
    // 14
    gitDummyCommit()
    shell.exec('git tag v1.0.0')
  },
  function () {
    // 15
    gitDummyCommit()
    gitDummyCommit('something unreleased yet :)')
  },
  function () {
    // 16
    writeFileSync('./package.json', '{"version": "2.0.0"}') // required by angular preset.
    shell.exec('git tag foo@1.0.0')
    mkdirp.sync('./packages/foo')
    writeFileSync('./packages/foo/test1', '')
    shell.exec(
      'git add --all && git commit -m"feat: first lerna style commit hooray"'
    )
    mkdirp.sync('./packages/bar')
    writeFileSync('./packages/bar/test1', '')
    shell.exec(
      'git add --all && git commit -m"feat: another lerna package, this should be skipped"'
    )
  },
  function () {
    // 17
    shell.exec('git tag foo@1.1.0')
    mkdirp.sync('./packages/foo')
    writeFileSync('./packages/foo/test2', '')
    shell.exec(
      'git add --all && git commit -m"feat: second lerna style commit woo"'
    )
  },
  function () {
    // 18
    gitDummyCommit()
    shell.exec('git tag 3.0.0')
  },
  function () {
    // 19
    shell.exec('git checkout feature')
    gitDummyCommit('included in 5.0.0')
    shell.exec('git checkout -b feature2')
    gitDummyCommit('merged, unreleased')
    shell.exec('git checkout master')
    gitDummyCommit('included in 4.0.0')
    shell.exec('git tag v4.0.0')
    shell.exec('git merge feature -m"Merge branch \'feature\'"')
    writeFileSync('./package.json', '{"version": "5.0.0"}') // required by angular preset.
    shell.exec('git add --all && git commit -m"5.0.0"')
    shell.exec('git tag v5.0.0')
    shell.exec('git merge feature2 -m"Merge branch \'feature2\'"')
  }
])

betterThanBefore.tearsWithJoy(function () {
  shell.cd(dir)
})

describe('conventionalChangelogCore', function () {
  it('should work if there is no tag', async function () {
    preparing(1)

    const changelog = await core()

    expect(changelog.toString()).to.include('First commit')
  })

  it('should generate the changelog for the upcoming release', async function () {
    preparing(2)

    const changelog = await core()
    expect(changelog).to.include('Second commit')
    expect(changelog).to.include('Third commit')
    expect(changelog).to.not.include('First commit')
  })

  it('should generate the changelog of the last two releases', async function () {
    preparing(2)

    const changelog = await core({ releaseCount: 2 })
    expect(changelog).to.include('Second commit')
    expect(changelog).to.include('Third commit')
    expect(changelog).to.include('First commit')
  })

  it('should generate the changelog of the last two releases even if release count exceeds the limit', async function () {
    preparing(2)
    const changelog = await core({ releaseCount: 100 })
    expect(changelog).to.include('Second commit')
    expect(changelog).to.include('Third commit')
    expect(changelog).to.include('First commit')
  })

  it('should work when there is no `HEAD` ref', async function () {
    preparing(2)
    shell.rm('.git/refs/HEAD')
    const changelog = await core({ releaseCount: 100 })
    expect(changelog).to.include('Second commit')
    expect(changelog).to.include('Third commit')
    expect(changelog).to.include('First commit')
  })

  it('should honour `gitRawCommitsOpts.from`', async function () {
    preparing(2)

    const changelog = await core({
      config: {
        gitRawCommitsOpts: { from: 'HEAD~2' },
        writerOpts: { commitsSort: null }
      }
    })
    expect(changelog).to.include('Second commit')
    expect(changelog).to.include('Third commit')
    expect(changelog).to.match(/Third commit closes #1[\w\W]*?\* Second commit/)
    expect(changelog).to.not.include('First commit')
  })

  it('should ignore merge commits by default', async function () {
    preparing(3)

    const changelog = await core()
    expect(changelog).to.include('This commit is from feature branch')
    expect(changelog).to.not.include('Merge')
  })

  it('should spit out some debug info', function (done) {
    preparing(3)

    let first = true

    core({
      debug(cmd) {
        if (first) {
          first = false
          expect(cmd).to.include('Your git-log command is:')
          done()
        }
      }
    })
  })

  it('should load package.json for data', async function () {
    preparing(3)

    const changelog = await core({
      pkg: { path: join(__dirname, 'fixtures/_package.json') }
    })
    expect(changelog).to.include('## <small>0.0.17')
    expect(changelog).to.include('Second commit')
    expect(changelog).to.include(
      'closes [#1](https://github.com/ajoslin/conventional-changelog/issues/1)'
    )
  })

  it('should load package.json for data even if repository field is missing', async function () {
    preparing(3)

    const changelog = await core({
      pkg: { path: join(__dirname, 'fixtures/_version-only.json') }
    })
    expect(changelog).to.include('## <small>0.0.17')
    expect(changelog).to.include('Second commit')
  })

  it('should fallback to use repo url if repo is repository is null', async function () {
    preparing(3)

    const changelog = await core(
      { pkg: { path: join(__dirname, 'fixtures/_host-only.json') } },
      { linkReferences: true }
    )
    expect(changelog).to.include('](https://unknown-host/commits/')
    expect(changelog).to.include('closes [#1](https://unknown-host/issues/1)')
  })

  it('should fallback to use repo url if repo is repository is null', async function () {
    preparing(3)

    const changelog = await core(
      { pkg: { path: join(__dirname, 'fixtures/_unknown-host.json') } },
      { linkReferences: true }
    )
    expect(changelog).to.include(
      '](https://stash.local/scm/conventional-changelog/conventional-changelog/commits/'
    )
    expect(changelog).to.include(
      'closes [#1](https://stash.local/scm/conventional-changelog/conventional-changelog/issues/1)'
    )
  })

  it('should transform package.json data', async function () {
    preparing(3)

    const changelog = await core({
      pkg: {
        path: join(__dirname, 'fixtures/_short.json'),
        transform(pkg) {
          pkg.version = 'v' + pkg.version
          pkg.repository = 'a/b'
          return pkg
        }
      }
    })
    expect(changelog).to.include('## <small>v0.0.17')
    expect(changelog).to.include('Second commit')
    expect(changelog).to.include('closes [#1](https://github.com/a/b/issues/1)')
  })

  it('should work in append mode', async function () {
    preparing(3)

    const changelog = await core({ append: true })
    expect(changelog).to.match(/Second commit[\w\W]*?\* Third commit/)
  })

  it('should read package.json if only `context.version` is missing', async function () {
    preparing(3)

    const changelog = await core(
      { pkg: { path: join(__dirname, 'fixtures/_package.json') } },
      { host: 'github', owner: 'a', repository: 'b' }
    )
    expect(changelog).to.include('## <small>0.0.17')
    expect(changelog).to.include('closes [#1](github/a/b/issues/1)')
  })

  it('should read the closest package.json by default', async function () {
    preparing(3)

    const changelog = await core()
    expect(changelog).to.include(
      'closes [#1](https://github.com/conventional-changelog/conventional-changelog-core/issues/1)'
    )
  })

  it('should ignore other prefixes if an `issuePrefixes` option is not provided', async function () {
    preparing(4)

    const changelog = await core(null, {
      host: 'github',
      owner: 'b',
      repository: 'a'
    })
    expect(changelog).to.include('](github/b/a/commit/')
    expect(changelog).to.not.include('closes [#42](github/b/a/issues/42)')
  })

  it('should use custom prefixes if an `issuePrefixes` option is provided', async function () {
    preparing(5)

    const changelog = await core(
      { config: { parserOpts: { issuePrefixes: ['@'] } } },
      { host: 'github', owner: 'b', repository: 'a' }
    )
    expect(changelog).to.include('](github/b/a/commit/')
    expect(changelog).to.include('closes [#42](github/b/a/issues/42)')
    expect(changelog).to.not.include('closes [#71](github/b/a/issues/71)')
  })

  it('should read host configs if only `parserOpts.referenceActions` is missing', async function () {
    preparing(5)

    const changelog = await core(null, {
      host: 'github',
      owner: 'b',
      repository: 'a',
      issue: 'issue',
      commit: 'commits'
    })
    expect(changelog).to.include('](github/b/a/commits/')
    expect(changelog).to.include('closes [#1](github/b/a/issue/1)')
  })

  it("should read github's host configs", async function () {
    preparing(5)

    const changelog = await core(null, {
      host: 'github',
      owner: 'b',
      repository: 'a'
    })
    expect(changelog).to.include('](github/b/a/commit/')
    expect(changelog).to.include('closes [#1](github/b/a/issues/1)')
  })

  it("should read bitbucket's host configs", async function () {
    preparing(5)

    const changelog = await core(null, {
      host: 'bitbucket',
      owner: 'b',
      repository: 'a'
    })

    expect(changelog).to.include('](bitbucket/b/a/commits/')
    expect(changelog).to.include('closes [#1](bitbucket/b/a/issue/1)')
  })

  it("should read gitlab's host configs", async function () {
    preparing(5)

    const changelog = await core(null, {
      host: 'gitlab',
      owner: 'b',
      repository: 'a'
    })

    expect(changelog).to.include('](gitlab/b/a/commit/')
    expect(changelog).to.include('closes [#1](gitlab/b/a/issues/1)')
  })

  it('should transform the commit', async function () {
    preparing(5)

    const changelog = await core({
      transform(changelog, cb) {
        changelog.header = 'A tiny header'
        cb(null, changelog)
      }
    })

    expect(changelog).to.include('A tiny header')
    expect(changelog).to.not.include('Third')
  })

  it('should generate all log blocks', async function () {
    preparing(5)
    const changelog = await core({ releaseCount: 0 })
    expect(changelog).to.include('Second commit')
    expect(changelog).to.include('Third commit closes #1')
    expect(changelog).to.include('First commit')
  })

  it('should work if there are two semver tags', async function () {
    preparing(6)
    const changelog = await core({ releaseCount: 0 })
    expect(changelog).to.include('# 2.0.0')
    expect(changelog).to.include('# 0.1.0')
  })

  it('semverTags should be attached to the `context` object', async function () {
    preparing(6)
    const changelog = await core({
      releaseCount: 0,
      config: {
        writerOpts: {
          mainTemplate: '{{gitSemverTags}} or {{gitSemverTags.[0]}}'
        }
      }
    })
    const exp = 'v2.0.0,v0.1.0 or v2.0.0'
    expect(changelog).to.equal(exp + exp + exp)
  })

  it('should not link compare', async function () {
    preparing(6)
    const changelog = await core(
      {
        releaseCount: 0,
        append: true,
        config: {
          writerOpts: {
            mainTemplate:
              '{{#if linkCompare}}{{previousTag}}...{{currentTag}}{{else}}Not linked{{/if}}',
            transform: () => null
          }
        }
      },
      { version: '3.0.0', linkCompare: false }
    )
    expect(changelog).to.equal('Not linked' + 'Not linked' + 'Not linked')
  })

  it('should warn if host is not found', function (done) {
    preparing(6)

    core(
      {
        pkg: null,
        warn(warning) {
          expect(warning).to.equal('Host: "no" does not exist')
          done()
        }
      },
      { host: 'no' }
    )
  })

  it('should warn if package.json is not found', function (done) {
    preparing(6)

    core({
      pkg: { path: 'no' },
      warn(warning) {
        expect(warning).to.include('Error')
        done()
      }
    })
  })

  it('should warn if package.json cannot be parsed', function (done) {
    preparing(6)

    core({
      pkg: { path: join(__dirname, 'fixtures/_malformation.json') },
      warn(warning) {
        expect(warning).to.include('Error')
        done()
      }
    })
  })

  it('should error if anything throws', function () {
    preparing(6)

    return core({
      pkg: { path: join(__dirname, 'fixtures/_malformation.json') },
      warn() {
        undefined.a = 10
      }
    }).then(
      () => Promise.reject(new Error('Expected an error')),
      () => {}
    )
  })

  it('should error if there is an error in `options.pkg.transform`', function () {
    preparing(6)

    return core({
      pkg: {
        path: join(__dirname, 'fixtures/_short.json'),
        transform() {
          undefined.a = 10
        }
      }
    }).then(
      () => Promise.reject(new Error('Expected an error')),
      err => expect(err.message).to.include('undefined')
    )
  })

  it('should error if it errors in git-raw-commits', function () {
    preparing(6)

    return core({
      config: { gitRawCommitsOpts: { unknowOptions: false } }
    }).then(
      () => Promise.reject(new Error('Expected an error')),
      err => expect(err.message).to.include('Error in git-raw-commits:')
    )
  })

  it('should error if it emits an error in `options.transform`', function () {
    preparing(7)

    return core({
      transform(commit, cb) {
        cb(new Error('error'))
      }
    }).then(
      () => Promise.reject(new Error('Expected an error')),
      err => expect(err.message).to.include('Error in options.transform:')
    )
  })

  it('should error if there is an error in `options.transform`', function () {
    preparing(8)

    return core({
      transform() {
        undefined.a = 10
      }
    }).then(
      () => Promise.reject(new Error('Expected an error')),
      err => expect(err.message).to.include('Error in options.transform:')
    )
  })

  it('should error if it errors in conventional-changelog-writer', function () {
    preparing(8)

    return core({
      config: { writerOpts: { finalizeContext: () => undefined.a } }
    }).then(
      () => Promise.reject(new Error('Expected an error')),
      err =>
        expect(err.message).to.include(
          'Error in conventional-changelog-writer:'
        )
    )
  })

  it('should handle breaking changes', async function () {
    preparing(9)

    const changelog = await core({})
    expect(changelog).to.include('* test9')
    expect(changelog).to.include('### BREAKING CHANGE\n\n* super release!')
  })

  it('should read each commit range exactly once', async function () {
    preparing(9)

    const changelog = await core({
      config: {
        compareUrlFormat: '/compare/{{previousTag}}...{{currentTag}}',
        writerOpts: { headerPartial: '', commitPartial: '* {{header}}\n' }
      }
    })
    expect(changelog).to.equal('\n* test8\n* test8\n* test9\n\n\n### BREAKING CHANGE\n\n* super release!\n\n\n')
  })

  it('should recreate the changelog from scratch', async function () {
    preparing(10)

    const context = { resetChangelog: true, version: '2.0.0' }
    const changelog = await core({}, context)

    expect(changelog).to.include('## 2.0.0')
    expect(changelog).to.include('Custom prefix closes @42')
    expect(changelog).to.include('Custom prefix closes @43')
    expect(changelog).to.include('Old prefix closes #71')
    expect(changelog).to.include('Second commit')
    expect(changelog).to.include('some more features')
    expect(changelog).to.include('Third commit closes #1')
    expect(changelog).to.include('This commit is from feature branch')
    expect(changelog).to.include('This commit is from master branch')
    expect(changelog).to.include('## 0.1.0')
    expect(changelog).to.include('First commit')
  })

  it('should pass fallback to git remote origin url', async function () {
    preparing(10)

    const changelog = await core({
      pkg: { path: join(__dirname, 'fixtures/_version-only.json') }
    })

    expect(changelog).to.include('https://github.com/user/repo')
    expect(changelog).to.not.include('.git')
  })

  it('should respect merge order', async function () {
    this.timeout(5000)
    preparing(19)
    const changelog = await core({
      releaseCount: 0,
      append: true,
      outputUnreleased: true
    })
    expect(changelog).to.contain('included in 4.0.0')
    expect(changelog).to.contain('included in 5.0.0')
    expect(changelog).to.contain('merged, unreleased')
  })

  describe('finalizeContext', function () {
    it('should make `context.previousTag` default to a previous semver version of generated log (prepend)', async function () {
      const tail = preparing(11).tail
      const changelog = await core(
        {
          config: {
            writerOpts: { mainTemplate: '{{previousTag}}...{{currentTag}}' }
          },
          releaseCount: 0
        },
        { version: '3.0.0' }
      )
      expect(changelog).to.equal('v2.0.0...v3.0.0' + tail + '...v2.0.0')
    })

    it('should make `context.previousTag` default to a previous semver version of generated log (append)', async function () {
      const tail = preparing(11).tail
      const changelog = await core(
        {
          config: {
            writerOpts: { mainTemplate: '{{previousTag}}...{{currentTag}}' }
          },
          releaseCount: 0,
          append: true
        },
        { version: '3.0.0' }
      )
      expect(changelog).to.equal(tail + '...v2.0.0' + 'v2.0.0...v3.0.0')
    })

    it('`context.previousTag` and `context.currentTag` should be `null` if `keyCommit.gitTags` is not a semver', async function () {
      const tail = preparing(12).tail
      const changelog = await core(
        {
          config: {
            writerOpts: {
              mainTemplate: '{{previousTag}}...{{currentTag}}',
              generateOn: 'version'
            }
          },
          releaseCount: 0,
          append: true
        },
        { version: '3.0.0' }
      )
      expect(changelog).to.equal(tail + '...v2.0.0' + '...' + 'v2.0.0...v3.0.0')
    })

    it('should still work if first release has no commits (prepend)', async function () {
      preparing(13)
      const changelog = await core(
        {
          config: {
            writerOpts: {
              mainTemplate: '{{previousTag}}...{{currentTag}}',
              transform: () => null
            }
          },
          releaseCount: 0
        },
        { version: '3.0.0' }
      )
      expect(changelog).to.equal(
        'v2.0.0...v3.0.0' + 'v0.0.1...v2.0.0' + '...v0.0.1'
      )
    })

    it('should still work if first release has no commits (append)', async function () {
      preparing(13)
      const changelog = await core(
        {
          config: {
            writerOpts: {
              mainTemplate: '{{previousTag}}...{{currentTag}}',
              transform: () => null
            }
          },
          releaseCount: 0,
          append: true
        },
        { version: '3.0.0' }
      )
      expect(changelog).to.equal(
        '...v0.0.1' + 'v0.0.1...v2.0.0' + 'v2.0.0...v3.0.0'
      )
    })

    it('should change `context.currentTag` to last commit hash if it is unreleased', async function () {
      const head = preparing(13).head
      const changelog = await core(
        {
          config: {
            writerOpts: { mainTemplate: '{{previousTag}}...{{currentTag}}' }
          },
          outputUnreleased: true
        },
        { version: '2.0.0' }
      )
      expect(changelog).to.equal('v2.0.0...' + head)
    })

    it('should not prefix with a "v"', async function () {
      preparing(18)
      const changelog = await core(
        {
          config: {
            writerOpts: { mainTemplate: '{{previousTag}}...{{currentTag}}' }
          },
          releaseCount: 0
        },
        { version: '4.0.0' }
      )
      expect(changelog).to.include('3.0.0...4.0.0')
    })

    it('should remove the first "v"', async function () {
      preparing(18)
      const changelog = await core(
        {
          config: {
            writerOpts: { mainTemplate: '{{previousTag}}...{{currentTag}}' }
          },
          releaseCount: 0
        },
        { version: 'v4.0.0' }
      )
      expect(changelog).to.include('3.0.0...4.0.0')
    })

    it('should prefix a leading v to version if no previous tags found', async function () {
      preparing(1)

      const changelog = await core(
        {
          config: {
            writerOpts: { mainTemplate: '{{previousTag}}...{{currentTag}}' }
          }
        },
        { version: '1.0.0' }
      )
      expect(changelog).to.include('...v1.0.0')
    })

    it('should not prefix a leading v to version if there is already a leading v', async function () {
      preparing(1)

      const changelog = await core(
        {
          config: {
            writerOpts: { mainTemplate: '{{previousTag}}...{{currentTag}}' }
          }
        },
        { version: 'v1.0.0' }
      )
      expect(changelog).to.include('...v1.0.0')
    })

    it('should not link compare if previousTag is not truthy', async function () {
      this.timeout(5000)
      preparing(13)
      const changelog = await core(
        {
          config: {
            writerOpts: {
              mainTemplate:
                '{{#if linkCompare}}{{previousTag}}...{{currentTag}}{{else}}Not linked{{/if}}',
              transform: () => null
            }
          },
          releaseCount: 0,
          append: true
        },
        { version: '3.0.0' }
      )
      expect(changelog).to.equal(
        'Not linked' + 'v0.0.1...v2.0.0' + 'v2.0.0...v3.0.0'
      )
    })

    it('takes into account tagPrefix option', async function () {
      preparing(16)
      const preset = await require('conventional-changelog-angular')
      const changelog = await core({
        tagPrefix: 'foo@',
        config: {
          ...preset,
          gitRawCommitsOpts: {
            ...preset.gitRawCommitsOpts,
            path: './packages/foo'
          }
        }
      })
      // confirm that context.currentTag behaves differently when
      // tagPrefix is used
      expect(changelog).to.include('foo@1.0.0...foo@2.0.0')
    })
  })

  describe('config', function () {
    const config = { context: { version: 'v100.0.0' } }

    it('should load object config', async function () {
      const changelog = await core({
        config: config,
        pkg: {
          path: join(__dirname, 'fixtures/_package.json')
        }
      })

      expect(changelog).to.include('v100.0.0')
    })

    it('should load promise config', async function () {
      const changelog = await core({
        config: Promise.resolve(config)
      })

      expect(changelog).to.include('v100.0.0')
    })

    it('should load function config', async function () {
      const changelog = await core({
        config: cb => cb(null, config)
      })

      expect(changelog).to.include('v100.0.0')
    })

    it('should warn if config errors', function (done) {
      core({
        config: Promise.reject(new Error('config error')),
        warn(warning) {
          expect(warning).to.include('config error')
          done()
        }
      })
    })
  })

  describe('unreleased', function () {
    it('should not output unreleased', async function () {
      this.timeout(5000)
      preparing(14)

      const changelog = await core({}, { version: '1.0.0' })
      expect(changelog).to.be.a('null')
    })

    it('should output unreleased', async function () {
      preparing(15)

      const changelog = await core(
        { outputUnreleased: true },
        { version: 'v1.0.0' }
      )

      expect(changelog).to.include('something unreleased yet :)')
      expect(changelog).to.include('Unreleased')
    })
  })

  describe('lerna style repository', function () {
    it('handles upcoming release', async function () {
      preparing(16)

      const changelog = await core({
        config: { gitRawCommitsOpts: { path: './packages/foo' } },
        lernaPackage: 'foo'
      })
      expect(changelog).to.include('first lerna style commit hooray')
      expect(changelog).to.not.include('second lerna style commit woo')
      expect(changelog).to.not.include(
        'another lerna package, this should be skipped'
      )
      expect(changelog).to.not.include('something unreleased yet :)')
    })

    it('takes into account lerna tag format when generating context.currentTag', async function () {
      preparing(16)

      const preset = await require('conventional-changelog-angular')
      const changelog = await core({
        lernaPackage: 'foo',
        config: {
          ...preset,
          gitRawCommitsOpts: {
            ...preset.gitRawCommitsOpts,
            path: './packages/foo'
          }
        }
      })
      // confirm that context.currentTag behaves differently when
      // lerna style tags are applied.
      expect(changelog).to.include('foo@1.0.0...foo@2.0.0')
    })

    it('should generate the changelog of the last two releases', async function () {
      preparing(17)

      const changelog = await core({
        config: { gitRawCommitsOpts: { path: './packages/foo' } },
        lernaPackage: 'foo',
        releaseCount: 2
      })
      expect(changelog).to.include('first lerna style commit hooray')
      expect(changelog).to.include('second lerna style commit woo')
      expect(changelog).to.not.include(
        'another lerna package, this should be skipped'
      )
      expect(changelog).to.not.include('something unreleased yet :)')
    })
  })
})
