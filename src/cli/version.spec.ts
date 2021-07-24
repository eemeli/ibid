import { expect } from 'chai'
import { execFile as execFileCb } from 'child_process'
import { promises } from 'fs'
import { before, describe, it } from 'mocha'
import { join } from 'path'
import { Writable } from 'stream'
import { promisify } from 'util'
import { gitCurrentTags } from '../shell/git'
import {
  cleanupTmpRepo,
  firstCommit,
  initTmpRepo,
  updateFile
} from '../test-helpers/git'
import { source } from '../test-helpers/source'
import { version } from './version'

// 'fs/promises' is only available from Node.js 14.0.0
const { mkdir, readFile, writeFile } = promises
const execFile = promisify(execFileCb)

const DATE = new Date().toISOString().substring(0, 10)
const URL = 'https://github.com/eemeli/foo'

const getPackage = (name: string, version: string) =>
  JSON.stringify({
    name,
    version,
    repository: { type: 'git', url: `${URL}.git` }
  })

const normalise = (log: string) =>
  log.replace(/https?:.*\/commit\/[0-9a-f]+]\([0-9a-f]+/g, 'URL](ID')

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
        await version(['--amend', '--yes'], out)
        throw new Error('Expected an error')
      } catch (error) {
        if (!/other arguments/.test(error.message)) throw error
      }
      try {
        await version(['--amend'], out)
        throw new Error('Expected an error')
      } catch (error) {
        if (!/does not appear/.test(error.message)) throw error
      }
      expect(out.calls).to.deep.equal([])

      await version(['.', '--yes'], out)
      expect(out.calls).to.deep.equal([
        'Updating foo to 1.2.4 ...\n',
        'Done!\n'
      ])

      expect(await gitCurrentTags()).to.deep.equal(['v1.2.4'])

      const log = await readFile('CHANGELOG.md', 'utf8')
      expect(normalise(log)).to.equal(source`
        # Changelog

        ## [${URL}/compare/1.2.3...1.2.4](1.2.4) (${DATE})

        ### Bug Fixes

        * Patch 1 ([URL](ID))
        * Patch 2 ([URL](ID))
      `)

      out.calls = []
      try {
        await version(['--amend'], out)
        throw new Error('Expected an error')
      } catch (error) {
        if (!/first stage/.test(error.message)) throw error
      }

      await updateFile(cwd, 'a', null, null)
      await version(['--amend'], out)
      expect(await gitCurrentTags()).to.deep.equal(['v1.2.4'])
      expect(out.calls).to.deep.equal([
        'Release commit amended and tags moved.\n'
      ])

      await cleanupTmpRepo(cwd)
    })

    it('minor release', async () => {
      const cwd = await setup('foo', '1.2.3', 'minor')
      process.chdir(cwd)

      const out = new MockOut()
      await version(['.', '--yes'], out)
      expect(out.calls).to.deep.equal([
        'Updating foo to 1.3.0 ...\n',
        'Done!\n'
      ])

      expect(await gitCurrentTags()).to.deep.equal(['v1.3.0'])

      const log = await readFile('CHANGELOG.md', 'utf8')
      expect(normalise(log)).to.equal(source`
        # Changelog

        ## [${URL}/compare/1.2.3...1.3.0](1.3.0) (${DATE})

        ### Features

        * Minor 1 ([URL](ID))
        * Minor 2 ([URL](ID))

        ### Bug Fixes

        * Patch 1 ([URL](ID))
        * Patch 2 ([URL](ID))
      `)
      await cleanupTmpRepo(cwd)
    })

    it('major release', async () => {
      const cwd = await setup('foo', '1.2.3', 'major')
      process.chdir(cwd)

      const out = new MockOut()
      await version(['.', '--yes'], out)
      expect(out.calls).to.deep.equal([
        'Updating foo to 2.0.0 ...\n',
        'Done!\n'
      ])

      expect(await gitCurrentTags()).to.deep.equal(['v2.0.0'])

      const log = await readFile('CHANGELOG.md', 'utf8')
      expect(normalise(log)).to.equal(source`
        # Changelog

        ## [${URL}/compare/1.2.3...2.0.0](2.0.0) (${DATE})

        ### ⚠ Breaking Changes

        * Break
        * Major 1

        ### Features

        * Minor 1 ([URL](ID))
        * Minor 2 ([URL](ID))
        * Major 1 ([URL](ID))

        ### Bug Fixes

        * Patch 1 ([URL](ID))
        * Patch 2 ([URL](ID))
        * Major 2 ([URL](ID))
      `)
      await cleanupTmpRepo(cwd)
    })

    it('no release', async () => {
      const cwd = await setup('foo', '1.2.3', null)
      process.chdir(cwd)

      const out = new MockOut()
      await version(['.', '--yes'], out)
      expect(out.calls).to.deep.equal(['No packages to update.\n'])

      expect(await gitCurrentTags()).to.deep.equal([])

      try {
        await readFile('CHANGELOG.md', 'utf8')
        throw new Error('CHANGELOG.md should not exist')
      } catch (error) {
        if (error.code !== 'ENOENT') throw error
      }

      await cleanupTmpRepo(cwd)
    })

    describe('--all-commits', () => {
      it('patch with no changelog', async () => {
        const cwd = await setup('foo', '1.2.3', null)
        process.chdir(cwd)

        const out = new MockOut()
        await version(['.', '--yes', '--all-commits'], out)
        expect(out.calls).to.deep.equal([
          'Updating foo to 1.2.4 ...\n',
          'Done!\n'
        ])

        expect(await gitCurrentTags()).to.deep.equal(['v1.2.4'])

        const log = await readFile('CHANGELOG.md', 'utf8')
        expect(normalise(log)).to.equal(source`
          # Changelog

          ## [${URL}/compare/1.2.3...1.2.4](1.2.4) (${DATE})
        `)

        await cleanupTmpRepo(cwd)
      })

      it('patch with changelog', async () => {
        const cwd = await setup('foo', '1.2.3', null)
        process.chdir(cwd)
        await writeFile('CHANGELOG.md', '# Change Log\n\n## Release 1.2.3\n')

        const out = new MockOut()
        await version(['.', '--yes', '--all-commits'], out)
        expect(out.calls).to.deep.equal([
          'Updating foo to 1.2.4 ...\n',
          'Done!\n'
        ])

        expect(await gitCurrentTags()).to.deep.equal(['v1.2.4'])

        const log = await readFile('CHANGELOG.md', 'utf8')
        expect(normalise(log)).to.equal(source`
          # Change Log

          ## [${URL}/compare/1.2.3...1.2.4](1.2.4) (${DATE})

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
      await version(['foo', 'bar', '--yes'], out)
      expect(out.calls).to.deep.equal([
        'Updating foo to 0.1.2-4 ...\n',
        'Updating bar to 1.3.0 ...\n',
        'Done!\n'
      ])

      expect(await gitCurrentTags()).to.deep.equal(['bar@1.3.0', 'foo@0.1.2-4'])

      const logFoo = await readFile('foo/CHANGELOG.md', 'utf8')
      expect(normalise(logFoo)).to.equal(source`
        # Changelog

        ## [${URL}/compare/0.1.2-3...0.1.2-4](0.1.2-4) (${DATE})

        ### Bug Fixes

        * Patch foo 1 ([URL](ID))
        * Patch foo 2 ([URL](ID))
      `)

      const logBar = await readFile('bar/CHANGELOG.md', 'utf8')
      expect(normalise(logBar)).to.equal(source`
        # Changelog

        ## [${URL}/compare/1.2.3...1.3.0](1.3.0) (${DATE})

        ### Features

        * Minor bar 1 ([URL](ID))
        * Minor bar 2 ([URL](ID))

        ### Bug Fixes

        * Patch bar 1 ([URL](ID))
        * Patch bar 2 ([URL](ID))
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
      await version(['foo', 'bar', '--yes'], out)
      expect(out.calls).to.deep.equal([
        'Updating bar to 2.0.0 ...\n',
        'Done!\n'
      ])

      expect(await gitCurrentTags()).to.deep.equal(['bar@2.0.0'])

      try {
        await readFile('foo/CHANGELOG.md', 'utf8')
        throw new Error('foo/CHANGELOG.md should not exist')
      } catch (error) {
        if (error.code !== 'ENOENT') throw error
      }

      const logBar = await readFile('bar/CHANGELOG.md', 'utf8')
      expect(normalise(logBar)).to.equal(source`
        # Changelog

        ## [${URL}/compare/1.2.3...2.0.0](2.0.0) (${DATE})

        ### ⚠ Breaking Changes

        * Break
        * Major bar 1

        ### Features

        * Minor bar 1 ([URL](ID))
        * Minor bar 2 ([URL](ID))
        * Major bar 1 ([URL](ID))

        ### Bug Fixes

        * Patch bar 1 ([URL](ID))
        * Patch bar 2 ([URL](ID))
        * Major bar 2 ([URL](ID))
      `)
      await cleanupTmpRepo(cwd)
    })
  })
})
