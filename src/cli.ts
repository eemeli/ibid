#!/usr/bin/env node

import { InputError } from './cli-helpers/input-error'
import { depend } from './publish/depend'
import { publish } from './publish/publish'
import { version } from './version/version'

let command
switch (process.argv[2]) {
  case 'depend':
    command = depend
    break
  case 'publish':
    command = publish
    break
  case 'version':
    command = version
    break
  default:
    console.error(`Usage: ibid depend|publish|version [options]`)
    process.exit(1)
}

const args = process.argv.slice(3)
command(args, process.stderr).catch(error => {
  if (error instanceof InputError) {
    console.error(error.message)
    process.exit(1)
  } else {
    console.error(error)
    process.exit(2)
  }
})
