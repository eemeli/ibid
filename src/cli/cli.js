const { readFile } = require('fs').promises
const { resolve } = require('path')
const glob = require('tiny-glob')
const yargsParser = require('yargs-parser')

const gitLog = require('../git/git-log')
const gitTagList = require('../git/git-tag-list')
const parseMessage = require('../message-parser/index')

async function findPackages(patterns) {
  const res = {}
  for (const pat of patterns) {
    for (const root of await glob(pat, { absolute: true })) {
      const pkgPath = resolve(root, 'package.json')
      try {
        const pkgSrc = await readFile(pkgPath, 'utf8')
        const { name, version } = JSON.parse(pkgSrc)
        res[root] = { name, version, root }
      } catch (error) {
        if (error.code !== 'ENOENT') throw error
      }
    }
  }
  return Object.values(res)
}

;(async function main() {
  const argv = yargsParser(process.argv.slice(2))
  const packages = await findPackages(argv._)
  if (packages.length === 0)
    throw new Error(`No packages found in: ${argv._.join(' ')}`)
  const tags = await gitTagList()
  for (const pkg of packages) {
    const tag = `${pkg.name}@${pkg.version}`
    if (tags.includes(tag)) {
      pkg.changes = await gitLog(tag, null, { path: pkg.root })
      for (const commit of pkg.changes)
        commit.parsed = parseMessage(commit.message)
    } else throw new Error(`Current version tag not found: ${tag}`)
  }
  console.dir(packages, { depth: null })
})()
