import { expect } from 'chai'
import { execFile as execFileCb } from 'child_process'
import { promises } from 'fs'
import { before, describe, it } from 'mocha'
import { join } from 'path'
import { Writable } from 'stream'
import { promisify } from 'util'
import { gitReleaseTags } from '../shell/git'
import {
  cleanupTmpRepo,
  firstCommit,
  initTmpRepo,
  updateFile
} from '../test-helpers/git'
import { source } from '../test-helpers/source'
import { cliCommand } from './command'

// 'fs/promises' is only available from Node.js 14.0.0
const { mkdir, readFile, writeFile } = promises
const execFile = promisify(execFileCb)

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
  after(() => process.chdir(dir))

  describe('single package at root', () => {
    async function setup(
      name: string,
      version: string,
      bump: 'major' | 'minor' | 'patch' | null
    ) {
      const cwd = await initTmpRepo(name)
      await updateFile(cwd, 'package.json', getPackage(name, version), null)
      await firstCommit(cwd, [`v${version}`])

      await updateFile(cwd, 'a', null, 'chore: Ignore 1')

      if (bump) {
        await updateFile(cwd, 'a', null, 'fix: Patch 1')
        await updateFile(cwd, 'a', null, 'fix: Patch 2')
      }

      if (bump === 'minor' || bump === 'major') {
        await updateFile(cwd, 'a', null, 'feat: Minor 1')
        await updateFile(cwd, 'a', null, 'feat: Minor 2')
      }

      if (bump === 'major') {
        await updateFile(cwd, 'a', null, 'feat!: Major 1')
        const msg = 'fix: Major 2\n\nBREAKING CHANGE: Break'
        await updateFile(cwd, 'a', null, msg)
      }

      await updateFile(cwd, 'a', null, 'chore: Ignore 2')

      return cwd
    }

    it('patch release with --amend', async () => {
      const cwd = await setup('foo', '1.2.3', 'patch')
      process.chdir(cwd)

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

      expect(await gitReleaseTags('HEAD')).to.deep.equal(['v1.2.4'])

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

      await updateFile(cwd, 'a', null, null)
      await cli(['version', '--amend'], out)
      expect(await gitReleaseTags('HEAD')).to.deep.equal(['v1.2.4'])
      expect(out.calls).to.deep.equal([
        'Release commit amended and tags moved.\n'
      ])

      await cleanupTmpRepo(cwd)
    })

    it('minor prerelease', async () => {
      const cwd = await setup('foo', '1.2.3', 'minor')
      process.chdir(cwd)

      const out = new MockOut()
      await cli(['version', '--path', '.', '--prerelease', '--yes'], out)
      expect(out.calls).to.include('Updating foo to 1.3.0-0 ...\n')
      expect(out.calls).to.include('Done!\n\n')

      expect(await gitReleaseTags('HEAD')).to.deep.equal(['v1.3.0-0'])

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
      await cleanupTmpRepo(cwd)
    })

    it('major release with config file', async () => {
      const cwd = await setup('foo', '1.2.3', 'major')
      process.chdir(cwd)
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

      expect(await gitReleaseTags('HEAD')).to.deep.equal(['v2.0.0'])

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
      await cleanupTmpRepo(cwd)
    })

    it('no release', async () => {
      const cwd = await setup('foo', '1.2.3', null)
      process.chdir(cwd)

      const out = new MockOut()
      await cli(['version', '--path', '.', '--yes'], out)
      expect(out.calls).to.deep.equal(['No packages to update.\n'])

      expect(await gitReleaseTags('HEAD')).to.deep.equal([])

      try {
        await readFile('CHANGELOG.md', 'utf8')
        throw new Error('CHANGELOG.md should not exist')
      } catch (error) {
        if (error.code !== 'ENOENT') throw error
      }

      await cleanupTmpRepo(cwd)
    })

    describe('bumpAllChanges', () => {
      it('patch with no changelog', async () => {
        const cwd = await setup('foo', '1.2.3', null)
        process.chdir(cwd)

        const out = new MockOut()
        await cli(
          ['version', '--path', '.', '--bump-all-changes', '--yes'],
          out
        )
        expect(out.calls).to.include('Updating foo to 1.2.4 ...\n')
        expect(out.calls).to.include('Done!\n\n')

        expect(await gitReleaseTags('HEAD')).to.deep.equal(['v1.2.4'])

        const log = await readFile('CHANGELOG.md', 'utf8')
        expect(normalise(log)).to.equal(source`
          # Changelog

          ## [1.2.4](${URL}/compare/1.2.3...1.2.4) (${DATE})
        `)

        await cleanupTmpRepo(cwd)
      })

      it('patch with changelog', async () => {
        const cwd = await setup('foo', '1.2.3', null)
        process.chdir(cwd)
        await writeFile('CHANGELOG.md', '# Change Log\n\n## Release 1.2.3\n')

        const out = new MockOut()
        await cli(
          ['version', '--path', '.', '--bump-all-changes', '--yes'],
          out
        )
        expect(out.calls).to.include('Updating foo to 1.2.4 ...\n')
        expect(out.calls).to.include('Done!\n\n')

        expect(await gitReleaseTags('HEAD')).to.deep.equal(['v1.2.4'])

        const log = await readFile('CHANGELOG.md', 'utf8')
        expect(normalise(log)).to.equal(source`
          # Change Log

          ## [1.2.4](${URL}/compare/1.2.3...1.2.4) (${DATE})

          ## Release 1.2.3
        `)

        await cleanupTmpRepo(cwd)
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
      const root = await initTmpRepo('multi')
      await firstCommit(root, [])
      for (const { name, version, bump } of packages) {
        const cwd = join(root, name.replace(/^.*[/\\]/, ''))
        await mkdir(cwd)

        const pkg = getPackage(name, version)
        await updateFile(cwd, 'package.json', pkg, 'chore!: Add package')
        await execFile('git', ['tag', `${name}@${version}`], { cwd })

        await updateFile(cwd, 'a', null, `chore: Ignore ${name} 1`)

        if (bump) {
          await updateFile(cwd, 'a', null, `fix: Patch ${name} 1`)
          await updateFile(cwd, 'a', null, `fix: Patch ${name} 2`)
        }

        if (bump === 'minor' || bump === 'major') {
          await updateFile(cwd, 'a', null, `feat: Minor ${name} 1`)
          await updateFile(cwd, 'a', null, `feat: Minor ${name} 2`)
        }

        if (bump === 'major') {
          await updateFile(cwd, 'a', null, `feat!: Major ${name} 1`)
          await updateFile(
            cwd,
            'a',
            null,
            `fix: Major ${name} 2\n\nBREAKING CHANGE: Break`
          )
        }

        await updateFile(cwd, 'a', null, `chore: Ignore ${name} 2`)
      }

      return root
    }

    it('patch + minor releases', async () => {
      const cwd = await setup([
        { name: 'foo', version: '0.1.2-3', bump: 'patch' },
        { name: 'bar', version: '1.2.3', bump: 'minor' }
      ])
      process.chdir(cwd)

      const out = new MockOut()
      await cli(['version', '--path', 'foo', 'bar', '--yes'], out)
      expect(out.calls).to.include('Updating foo to 0.1.2-4 ...\n')
      expect(out.calls).to.include('Updating bar to 1.3.0 ...\n')
      expect(out.calls).to.include('Done!\n\n')

      expect(await gitReleaseTags('HEAD')).to.deep.equal([
        'bar@1.3.0',
        'foo@0.1.2-4'
      ])

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
      await cleanupTmpRepo(cwd)
    })

    it('none + major release', async () => {
      const cwd = await setup([
        { name: 'foo', version: '0.1.2-3', bump: null },
        { name: 'bar', version: '1.2.3', bump: 'major' }
      ])
      process.chdir(cwd)

      const out = new MockOut()
      await cli(['version', '--path', 'foo', 'bar', '--yes'], out)
      expect(out.calls).to.include('Updating bar to 2.0.0 ...\n')
      expect(out.calls).to.include('Done!\n\n')

      expect(await gitReleaseTags('HEAD')).to.deep.equal(['bar@2.0.0'])

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
      await cleanupTmpRepo(cwd)
    })
  })
})
