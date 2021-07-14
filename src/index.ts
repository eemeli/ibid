import { resolve } from 'path'
import { applyBump, recommendBump, ReleaseType } from './bump/bump'
import { Commit, getCurrentCommits } from './commits'
import { Config } from './config/config'
import { Context, createContext } from './config/context'

export { applyBump, recommendBump } from './bump/bump'
export { writeChangelog } from './changelog/write'
export {
  Commit,
  CommitMessage,
  getCurrentCommits,
  parseCommit,
  Reference
} from './commits'
export { changelogFormatter, Config, getRequiredConfig } from './config/config'
export { Context, createContext, HostContext, Package } from './config/context'

export interface PackageUpdate {
  context: Context
  commits: Commit[]
  bump: ReleaseType | 'set' | null
  version: string | null
}

export async function getCurrentUpdate(
  path = '.',
  config: Config = {}
): Promise<PackageUpdate> {
  const cwd = resolve(path)
  const context = await createContext(config, cwd)
  if (!context.package) throw new Error(`Failed to read package data in ${cwd}`)

  const commits = await getCurrentCommits(context)
  const bump = recommendBump(context, commits)
  const version = applyBump(context, bump)

  return { context, commits, bump, version }
}
