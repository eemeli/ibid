const { readFile } = require('fs').promises
const { resolve } = require('path')
const glob = require('tiny-glob')
const yargsParser = require('yargs-parser')

const { gitLog, gitRefExists } = require('../commits/git')
const { parseMessage } = require('../commits/parse-message')
const getConfig = require('../recommend-bump/get-config')
const recommendBump = require('../recommend-bump/recommend-bump')

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
  const argv = yargsParser(process.argv.slice(2), {
    alias: { preset: ['p'] },
    narg: { preset: 1 },
    string: ['preset']
  })
  const preset = argv.preset || 'conventionalcommits'
  const config = await getConfig({ preset })
  const packages = await findPackages(argv._)
  if (packages.length === 0)
    throw new Error(`No packages found in: ${argv._.join(' ')}`)
  for (const pkg of packages) {
    const tag = `${pkg.name}@${pkg.version}`
    if (!(await gitRefExists()))
      throw new Error(`Current version tag not found: ${tag}`)
    pkg.changes = await gitLog(tag, null, pkg.root)
    for (const commit of pkg.changes)
      Object.assign(commit, parseMessage(commit.message, config.parserOpts))
    const bump = await recommendBump(config.recommendedBumpOpts, pkg.changes)
    console.log(tag, bump)
  }
  //console.dir(packages, { depth: null })
})()
