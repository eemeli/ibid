#!/usr/bin/env node

const { cliCommand, InputError } = require('./lib/cli')

async function main(argv) {
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
