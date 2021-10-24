import type { Writable } from 'stream'
import yargs, { Argv } from 'yargs'
import { depend, dependOptions } from '../publish/depend'
import { publish, publishOptions } from '../publish/publish'
import { version, versionOptions } from '../version/version'

export interface CmdArgs {
  path?: string[]
  '--'?: string[]
  [key: string]: unknown
}

export const cliCommand = (argv: string[], out: Writable): Argv =>
  yargs(argv)
    .wrap(Math.min(100, yargs.terminalWidth()))
    .parserConfiguration({ 'populate--': true })
    .command(
      'depend [path..]',
      'Update dependency style between internal packages. Requires at least one style option.',
      dependOptions,
      args => depend(args, out)
    )
    .command(
      'publish [path..]',
      'Publish packages, fixing dependencies before & after as appropriate.',
      publishOptions,
      args => publish(args, out)
    )
    .command(
      'version [path..]',
      'Update the versions & changelogs of packages according to git history.',
      versionOptions,
      args => version(args, out)
    )
