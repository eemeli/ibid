#!/usr/bin/env node

import yargs from 'yargs'
import { InputError } from './cli-helpers/errors'
import { depend, dependOptions } from './publish/depend'
import { publish, publishOptions } from './publish/publish'
import { version, versionOptions } from './version/version'

export interface CmdArgs {
  path?: string[]
  '--'?: string[]
  [key: string]: unknown
}

export async function main(argv: string[]): Promise<void> {
  const cmd = yargs(argv)
    .parserConfiguration({ 'populate--': true })
    .command(
      'depend [path..]',
      'Update internal dependency style',
      dependOptions,
      args => depend(args, process.stderr)
    )
    .command(
      'publish [path..]',
      'Publish packages, using correct dependencies',
      publishOptions,
      args => publish(args, process.stderr)
    )
    .command(
      'version [path..]',
      'Update the versions & changelogs of packages according to git history',
      versionOptions,
      args => version(args, process.stderr)
    )

  try {
    await cmd.parse()
  } catch (error) {
    if (error instanceof InputError) {
      console.error(error.message)
      process.exit(1)
    } else {
      console.error(error)
      process.exit(2)
    }
  }
}

main(process.argv.slice(2))
