#!/usr/bin/env node

import { cliCommand, InputError } from './cli'

async function main(argv: string[]) {
  try {
    await cliCommand(argv, process.stderr).parse()
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
