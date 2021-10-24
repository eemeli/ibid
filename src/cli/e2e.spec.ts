import { expect } from 'chai'
import { promises } from 'fs'
import { before, describe, it } from 'mocha'
import { join, resolve } from 'path'
import { Writable } from 'stream'
import { setGitExecFile } from '../shell/git'
import { mockCommit, MockCommit, mockGit } from '../shell/git.mock'
import { setNpmExecFile } from '../shell/npm'
import { mockNpm, MockNpmRegistry } from '../shell/npm.mock'
import { source } from '../test-helpers/source'
import { cleanupTmpDir, initTmpDir } from '../test-helpers/tmp-dir'
import { cliCommand } from './command'

// 'fs/promises' is only available from Node.js 14.0.0
const { mkdir, readFile, writeFile } = promises

const cli = (args: string[], out: Writable) =>
  cliCommand(args, out).fail(false).parse()

const DATE = new Date().toISOString().substring(0, 10)
const URL = 'https://github.com/eemeli/foo'

const getPackage = (name: string, version: string) =>
  JSON.stringify({
    name,
    version,
    repository: { type: 'git', url: `${URL}.git` }
  })

const normalise = (log: string) =>
  log.replace(/[0-9a-f]+]\(https?:.*\/commit\/[0-9a-f]+/g, 'ID](URL')

class MockOut extends Writable {
  calls: string[] = []
  _write(chunk: Buffer, _enc: unknown, cb: () => void) {
    this.calls.push(chunk.toString('utf8'))
    cb()
  }
}

describe('CLI end-to-end', () => {
  let dir: string
  before(() => (dir = process.cwd()))
  after(() => {
    process.chdir(dir)
    setGitExecFile(null)
    setNpmExecFile(null)
  })

  describe('single package at root', () => {
    async function setup(
      name: string,
      version: string,
      bump: 'major' | 'minor' | 'patch' | null
    ) {
      const cwd = await initTmpDir(name)
      process.chdir(cwd)

      const pkgPath = resolve(cwd, 'package.json')
      await writeFile(pkgPath, getPackage(name, version))

      const fp = resolve(cwd, 'a')
      const commits: MockCommit[] = [
        mockCommit('chore!: First commit', [pkgPath], `v${version}`),
        mockCommit('chore: Ignore 1', [fp])
      ]

      if (bump) {
        commits.push(
          mockCommit('fix: Patch 1', [fp]),
          mockCommit('fix: Patch 2', [fp])
        )
      }

      if (bump === 'minor' || bump === 'major') {
        commits.push(
          mockCommit('feat: Minor 1', [fp]),
          mockCommit('feat: Minor 2', [fp])
        )
      }

      if (bump === 'major') {
        commits.push(
          mockCommit('feat!: Major 1', [fp]),
          mockCommit('fix: Major 2\n\nBREAKING CHANGE: Break', [fp])
        )
      }

      commits.push(mockCommit('chore: Ignore 2', [fp]))

      const gitStaged: string[] = []
      mockGit(commits, gitStaged)

      const npmRegistry: MockNpmRegistry = {
        [name]: { tags: { latest: version }, versions: [version] }
      }
      mockNpm(npmRegistry)

      return { cwd, gitCommits: commits, gitStaged, npmRegistry }
    }

    it('patch release with --amend', async () => {
      const { cwd, gitCommits, gitStaged } = await setup(
        'foo',
        '1.2.3',
        'patch'
      )

      const out = new MockOut()
      try {
        await cli(['version', '--amend'], out)
        throw new Error('Expected an error')
      } catch (error) {
        if (!/does not appear/.test(error.message)) throw error
      }
      expect(out.calls).to.deep.equal([])

      await cli(['version', '--path', '.', '--yes'], out)
      expect(out.calls).to.include('Updating foo to 1.2.4 ...\n')
      expect(out.calls).to.include('Done!\n\n')

      const head1 = gitCommits[gitCommits.length - 1]
      expect(head1.tags).to.deep.equal(['v1.2.4'])

      const log = await readFile('CHANGELOG.md', 'utf8')
      expect(normalise(log)).to.equal(source`
        # Changelog

        ## [1.2.4](${URL}/compare/1.2.3...1.2.4) (${DATE})

        ### Bug Fixes

        * Patch 1 ([ID](URL))
        * Patch 2 ([ID](URL))
      `)

      out.calls = []
      try {
        await cli(['version', '--amend'], out)
        throw new Error('Expected an error')
      } catch (error) {
        if (!/first stage/.test(error.message)) throw error
      }

      gitStaged.push(resolve(cwd, 'a'))
      await cli(['version', '--amend'], out)
      const head2 = gitCommits[gitCommits.length - 1]
      expect(head2.tags).to.deep.equal(['v1.2.4'])
      expect(head2).to.not.equal(head1)
      expect(out.calls).to.deep.equal([
        'Release commit amended and tags moved.\n'
      ])

      await cleanupTmpDir(cwd)
    })

    it('minor prerelease', async () => {
      const { cwd, gitCommits } = await setup('foo', '1.2.3', 'minor')

      const out = new MockOut()
      await cli(['version', '--path', '.', '--prerelease', '--yes'], out)
      expect(out.calls).to.include('Updating foo to 1.3.0-0 ...\n')
      expect(out.calls).to.include('Done!\n\n')

      const head = gitCommits[gitCommits.length - 1]
      expect(head.tags).to.deep.equal(['v1.3.0-0'])

      const log = await readFile('CHANGELOG.md', 'utf8')
      expect(normalise(log)).to.equal(source`
        # Changelog

        ## [1.3.0-0](${URL}/compare/1.2.3...1.3.0-0) (${DATE})

        ### Features

        * Minor 1 ([ID](URL))
        * Minor 2 ([ID](URL))

        ### Bug Fixes

        * Patch 1 ([ID](URL))
        * Patch 2 ([ID](URL))
      `)
      await cleanupTmpDir(cwd)
    })

    it('major release with config file', async () => {
      const { cwd, gitCommits } = await setup('foo', '1.2.3', 'major')

      await writeFile(
        'ibid.config.cjs',
        source`
          module.exports = {
            changelogFilename: 'RELEASES',
            changelogSections: ['fix', 'feat'],
          }`
      )

      const out = new MockOut()
      await cli(['version', '--path', '.', '--yes'], out)
      expect(out.calls).to.include('Updating foo to 2.0.0 ...\n')
      expect(out.calls).to.include('Done!\n\n')

      const head = gitCommits[gitCommits.length - 1]
      expect(head.tags).to.deep.equal(['v2.0.0'])

      const log = await readFile('RELEASES', 'utf8')
      expect(normalise(log)).to.equal(source`
        # Changelog

        ## [2.0.0](${URL}/compare/1.2.3...2.0.0) (${DATE})

        ### ⚠ Breaking Changes

        * Break
        * Major 1

        ### Bug Fixes

        * Patch 1 ([ID](URL))
        * Patch 2 ([ID](URL))
        * Major 2 ([ID](URL))

        ### Features

        * Minor 1 ([ID](URL))
        * Minor 2 ([ID](URL))
        * Major 1 ([ID](URL))
      `)
      await cleanupTmpDir(cwd)
    })

    it('no release', async () => {
      const { cwd, gitCommits } = await setup('foo', '1.2.3', null)

      const out = new MockOut()
      await cli(['version', '--path', '.', '--yes'], out)
      expect(out.calls).to.deep.equal(['No packages to update.\n'])

      const head = gitCommits[gitCommits.length - 1]
      expect(head.tags).to.deep.equal([])

      try {
        await readFile('CHANGELOG.md', 'utf8')
        throw new Error('CHANGELOG.md should not exist')
      } catch (error) {
        if (error.code !== 'ENOENT') throw error
      }

      await cleanupTmpDir(cwd)
    })

    describe('bumpAllChanges', () => {
      it('patch with no changelog', async () => {
        const { cwd, gitCommits } = await setup('foo', '1.2.3', null)

        const out = new MockOut()
        await cli(
          ['version', '--path', '.', '--bump-all-changes', '--yes'],
          out
        )
        expect(out.calls).to.include('Updating foo to 1.2.4 ...\n')
        expect(out.calls).to.include('Done!\n\n')

        const head = gitCommits[gitCommits.length - 1]
        expect(head.tags).to.deep.equal(['v1.2.4'])

        const log = await readFile('CHANGELOG.md', 'utf8')
        expect(normalise(log)).to.equal(source`
          # Changelog

          ## [1.2.4](${URL}/compare/1.2.3...1.2.4) (${DATE})
        `)

        await cleanupTmpDir(cwd)
      })

      it('patch with changelog', async () => {
        const { cwd, gitCommits } = await setup('foo', '1.2.3', null)

        await writeFile('CHANGELOG.md', '# Change Log\n\n## Release 1.2.3\n')

        const out = new MockOut()
        await cli(
          ['version', '--path', '.', '--bump-all-changes', '--yes'],
          out
        )
        expect(out.calls).to.include('Updating foo to 1.2.4 ...\n')
        expect(out.calls).to.include('Done!\n\n')

        const head = gitCommits[gitCommits.length - 1]
        expect(head.tags).to.deep.equal(['v1.2.4'])

        const log = await readFile('CHANGELOG.md', 'utf8')
        expect(normalise(log)).to.equal(source`
          # Change Log

          ## [1.2.4](${URL}/compare/1.2.3...1.2.4) (${DATE})

          ## Release 1.2.3
        `)

        await cleanupTmpDir(cwd)
      })
    })
  })

  describe('multiple packages', () => {
    async function setup(
      packages: {
        name: string
        version: string
        bump: 'major' | 'minor' | 'patch' | null
      }[]
    ) {
      const root = await initTmpDir('multi')
      process.chdir(root)

      const gitCommits: MockCommit[] = [mockCommit('chore!: First commit', [])]
      const npmRegistry: MockNpmRegistry = {}
      for (const { name, version, bump } of packages) {
        const cwd = join(root, name.replace(/^.*[/\\]/, ''))
        await mkdir(cwd)

        const pkgPath = resolve(cwd, 'package.json')
        await writeFile(pkgPath, getPackage(name, version))

        npmRegistry[name] = { tags: { latest: version }, versions: [version] }

        const fp = resolve(cwd, 'a')
        gitCommits.push(
          mockCommit('chore!: Add package', [pkgPath], `${name}@${version}`),
          mockCommit(`chore: Ignore ${name} 1`, [fp])
        )

        if (bump) {
          gitCommits.push(
            mockCommit(`fix: Patch ${name} 1`, [fp]),
            mockCommit(`fix: Patch ${name} 2`, [fp])
          )
        }

        if (bump === 'minor' || bump === 'major') {
          gitCommits.push(
            mockCommit(`feat: Minor ${name} 1`, [fp]),
            mockCommit(`feat: Minor ${name} 2`, [fp])
          )
        }

        if (bump === 'major') {
          gitCommits.push(
            mockCommit(`feat!: Major ${name} 1`, [fp]),
            mockCommit(`fix: Major ${name} 2\n\nBREAKING CHANGE: Break`, [fp])
          )
        }

        gitCommits.push(mockCommit(`chore: Ignore ${name} 2`, [fp]))
      }

      const gitStaged: string[] = []
      mockGit(gitCommits, gitStaged)
      mockNpm(npmRegistry)
      return { cwd: root, gitCommits, gitStaged, npmRegistry }
    }

    it('patch + minor releases', async () => {
      const { cwd, gitCommits } = await setup([
        { name: 'foo', version: '0.1.2-3', bump: 'patch' },
        { name: 'bar', version: '1.2.3', bump: 'minor' }
      ])

      const out = new MockOut()
      await cli(['version', '--path', 'foo', 'bar', '--yes'], out)
      expect(out.calls).to.include('Updating foo to 0.1.2-4 ...\n')
      expect(out.calls).to.include('Updating bar to 1.3.0 ...\n')
      expect(out.calls).to.include('Done!\n\n')

      const head = gitCommits[gitCommits.length - 1]
      expect(head.tags).to.deep.equal(['bar@1.3.0', 'foo@0.1.2-4'])

      const logFoo = await readFile('foo/CHANGELOG.md', 'utf8')
      expect(normalise(logFoo)).to.equal(source`
        # Changelog

        ## [0.1.2-4](${URL}/compare/0.1.2-3...0.1.2-4) (${DATE})

        ### Bug Fixes

        * Patch foo 1 ([ID](URL))
        * Patch foo 2 ([ID](URL))
      `)

      const logBar = await readFile('bar/CHANGELOG.md', 'utf8')
      expect(normalise(logBar)).to.equal(source`
        # Changelog

        ## [1.3.0](${URL}/compare/1.2.3...1.3.0) (${DATE})

        ### Features

        * Minor bar 1 ([ID](URL))
        * Minor bar 2 ([ID](URL))

        ### Bug Fixes

        * Patch bar 1 ([ID](URL))
        * Patch bar 2 ([ID](URL))
      `)
      await cleanupTmpDir(cwd)
    })

    it('none + major release', async () => {
      const { cwd, gitCommits } = await setup([
        { name: 'foo', version: '0.1.2-3', bump: null },
        { name: 'bar', version: '1.2.3', bump: 'major' }
      ])

      const out = new MockOut()
      await cli(['version', '--path', 'foo', 'bar', '--yes'], out)
      expect(out.calls).to.include('Updating bar to 2.0.0 ...\n')
      expect(out.calls).to.include('Done!\n\n')

      const head = gitCommits[gitCommits.length - 1]
      expect(head.tags).to.deep.equal(['bar@2.0.0'])

      try {
        await readFile('foo/CHANGELOG.md', 'utf8')
        throw new Error('foo/CHANGELOG.md should not exist')
      } catch (error) {
        if (error.code !== 'ENOENT') throw error
      }

      const logBar = await readFile('bar/CHANGELOG.md', 'utf8')
      expect(normalise(logBar)).to.equal(source`
        # Changelog

        ## [2.0.0](${URL}/compare/1.2.3...2.0.0) (${DATE})

        ### ⚠ Breaking Changes

        * Break
        * Major bar 1

        ### Features

        * Minor bar 1 ([ID](URL))
        * Minor bar 2 ([ID](URL))
        * Major bar 1 ([ID](URL))

        ### Bug Fixes

        * Patch bar 1 ([ID](URL))
        * Patch bar 2 ([ID](URL))
        * Major bar 2 ([ID](URL))
      `)
      await cleanupTmpDir(cwd)
    })
  })
})
