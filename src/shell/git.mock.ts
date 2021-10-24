import assert from 'assert'
import { resolve } from 'path'
import { setGitExecFile } from './git'

export type MockCommit = {
  hash: string
  message: string
  tags: string[]
  files: string[]
}

/** `[0-9a-f]{7}` */
export const mockHash = (): string =>
  (Math.random().toString(16) + '000000').substring(2, 9)

export const mockCommit = (
  message: string,
  files: string[] = [],
  ...tags: string[]
): MockCommit => ({ hash: mockHash(), message, tags, files })

export function mockGit(commits: MockCommit[], staged: string[]): void {
  setGitExecFile((git, [cmd, ...args], options) => {
    if (git !== 'git') throw new Error(`Invalid git command: ${git}`)
    const cwd = resolve(options?.cwd || '')
    let stdout = ''
    switch (cmd) {
      case 'add':
        // gitAdd
        // gitAddPackageFiles
        assert(args.length > 1)
        assert(args[0] === '--' || args[0] === '--update')
        for (let i = 1; i < args.length; ++i) staged.push(resolve(cwd, args[i]))
        break

      case 'check-ref-format':
        // gitCheckTag
        assert(args.length === 1)
        assert(args[0].startsWith('tags/'))
        assert(!args.includes(' '))
        break

      case 'commit': {
        // gitCommit
        // gitAmendCommit
        assert(args.length > 1)
        let message: string
        let files: string[]
        if (args.includes('--amend')) {
          const last = commits.pop()
          assert(last)
          message = last.message
          files = [...last.files, ...staged]
        } else {
          const optIdx = args.indexOf('--message')
          assert(optIdx !== -1)
          message = args[optIdx + 1]
          files = [...staged]
        }
        assert(message)
        commits.push({ hash: mockHash(), message, tags: [], files })
        staged.length = 0
        break
      }

      case 'diff':
        // gitListStagedFiles
        assert(args.length === 2)
        assert(args[0] === '--name-only')
        assert(args[1] === '--cached')
        stdout = staged.join('\n')
        break

      case 'diff-tree':
        // gitCommitContents
        assert(args.length === 4)
        assert(args[0] === '--no-commit-id')
        assert(args[1] === '--name-only')
        assert(args[2] === '-r')
        throw new Error('Not implemented: git diff-tree')

      case 'ls-files':
        // gitAddPackageFiles
        assert(args.length > 0)
        break

      case 'log': {
        // gitLog
        assert(args.length >= 5)
        assert(args[5].endsWith('..'))
        const from = args[5].slice(0, -2)
        const path = args[6] === '--' ? resolve(cwd, args[7]) : null
        const res: string[] = []
        let found = false
        for (const { hash, message, tags, files } of commits) {
          if (!found) {
            if (hash === from || tags.includes(from)) found = true
            continue
          }
          if (path && !files.some(p => p.startsWith(path))) continue
          const tagRefs =
            tags.length > 0
              ? ` (${tags.map(tag => `tag: ${tag}`).join(', ')})`
              : ''
          res.unshift(`\
commit ${hash}${tagRefs}
Author: Test Author <address@example.com>
Date:   ${Math.round(Date.now() / 1000)}

${message.replace(/^/gm, '    ')}`)
        }
        stdout = res.join('\n\n')
        break
      }

      case 'rev-parse':
        switch (args[0]) {
          case '--short':
            // gitAbbrevLength
            assert(args.length === 2)
            assert(args[1] === 'HEAD')
            stdout = '1234567'
            break

          case '--verify': {
            // gitRefExists
            assert(args.length === 2)
            const found = commits.some(({ tags }) => tags.includes(args[1]))
            if (!found) throw new Error('ref not found')
            stdout = args[1]
            break
          }

          case '--show-toplevel':
            // isGitRoot
            assert(args.length === 1)
            stdout = cwd // FIXME?
            break
          default:
            throw new Error(`Invalid rev-parse args: ${args}`)
        }
        break

      case 'tag':
        assert(args.length > 1)
        switch (args[0]) {
          case '--points-at':
            // gitReleaseTags
            assert(args[1] === 'HEAD')
            stdout = commits[commits.length - 1].tags.join('\n')
            break

          case '--list':
            // gitReleaseTags
            assert(args[1] === '--format=%(contents)')
            assert(args[2] === '--')
            stdout = commits[commits.length - 1].tags.includes(args[3])
              ? args[3]
              : ''
            break

          default: {
            // gitCommit
            // gitAmendCommit
            const argSepIdx = args.indexOf('--')
            assert(argSepIdx !== -1)
            assert(args.length === argSepIdx + 2)
            const tag = args[argSepIdx + 1]
            assert(tag)
            const prev = commits.find(({ tags }) => tags.includes(tag))
            if (prev) {
              if (!args.includes('--force'))
                throw new Error(`fatal: tag '${tag}' already exists`)
              prev.tags.splice(prev.tags.indexOf(tag), 1)
            }
            commits[commits.length - 1].tags.unshift(tag)
            break
          }
        }
        break
    }

    return Promise.resolve({ stdout: stdout + '\n' })
  })
}
