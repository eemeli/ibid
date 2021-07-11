import { constants, promises } from 'fs'

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
  path: string,
  init: boolean | null,
  version: string | null,
  commits: Commit[]
): Promise<boolean> {
  const entry = await ctx.config.changelogFormat(
    ctx,
    formatChangelog,
    version,
    commits
  )
  if (!entry) return false

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
      if (init === null && error.code === 'ENOENT')
        prev = ctx.config.changelogIntro
      else throw error
    }
  }

  const text = mergeChangelogEntries(ctx, prev, entry)
  await writeFile(path, text)
  return true
}
