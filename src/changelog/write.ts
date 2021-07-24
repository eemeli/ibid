import { constants, promises } from 'fs'
import { resolve } from 'path'

import { Commit } from '../commits'
import { Context } from '../config/context'
import { formatChangelog } from './format'

// 'fs/promises' is only available from Node.js 14.0.0
const { access, readFile, writeFile } = promises

export function mergeChangelogEntries(
  ctx: Context,
  prev: string,
  entry: string
): string {
  const pos = ctx.config.changelogEntryPattern.exec(prev)
  return pos
    ? prev.substring(0, pos.index) + entry + '\n' + prev.substring(pos.index)
    : prev.trimEnd() + '\n\n' + entry
}

export async function writeChangelog(
  ctx: Context,
  init: boolean | null,
  version: string | null,
  commits: Commit[]
): Promise<string | null> {
  const entry = await ctx.config.changelogFormat(
    ctx,
    formatChangelog,
    version,
    commits
  )
  if (!entry) return null

  const path = resolve(ctx.cwd || '', ctx.config.changelogFilename)
  let prev: string
  if (init) {
    let exists: boolean
    try {
      await access(path, constants.F_OK)
      exists = true
    } catch (error) {
      if (error.code === 'ENOENT') exists = false
      else throw error
    }
    if (exists) throw new Error(`Changelog file already exists: ${path}`)
    prev = ctx.config.changelogIntro
  } else {
    try {
      prev = await readFile(path, 'utf8')
    } catch (error) {
      if (error.code === 'ENOENT') {
        if (init == null) prev = ctx.config.changelogIntro
        else
          throw Error(
            `Changelog not found at ${path}. To start a new changelog, use init: true or null.`
          )
      } else throw error
    }
  }

  const text = mergeChangelogEntries(ctx, prev, entry)
  await writeFile(path, text)
  return path
}
