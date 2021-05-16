'use strict'

const getPkgRepo = require('get-pkg-repo')
const gitRemoteOriginUrl = require('git-remote-origin-url')
const normalizePackageData = require('normalize-package-data')
const readPkg = require('read-pkg')
const readPkgUp = require('read-pkg-up')

module.exports = async function getContext(optPkg, warn) {
  let pkg = null
  if (optPkg) {
    try {
      // TODO: Update these dependencies
      pkg = optPkg.path ? await readPkg(optPkg.path) : (await readPkgUp()).pkg
    } catch (error) {
      warn('Error parsing package.json: ' + error)
    }
    pkg = optPkg.transform(pkg)
  }

  if (!pkg || !pkg.repository || !pkg.repository.url) {
    try {
      pkg = pkg || {}
      pkg.repository = pkg.repository || {}
      pkg.repository.url = await gitRemoteOriginUrl()
      normalizePackageData(pkg)
    } catch (_) {
      // ignore any error
    }
  }

  const context = { version: (pkg && pkg.version) || '' }

  if (pkg) {
    let repo
    try {
      repo = getPkgRepo(pkg)
    } catch (_) {
      repo = {}
    }

    if (repo.browse) {
      const browse = repo.browse()
      if (!context.host && repo.domain) {
        const { origin, protocol } = new URL(browse)
        context.host =
          protocol + (origin.includes('//') ? '//' : '') + repo.domain
      }
      context.owner = context.owner || repo.user || ''
      context.repository = context.repository || repo.project
      context.repoUrl = browse
    }
    context.packageData = pkg
  }

  return context
}
