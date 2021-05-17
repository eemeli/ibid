'use strict'

const getPkgRepo = require('get-pkg-repo')
const gitRemoteOriginUrl = require('git-remote-origin-url')
const normalizePackageData = require('normalize-package-data')
const readPkg = require('read-pkg')
const readPkgUp = require('read-pkg-up')

const getHostOpts = require('./host-opts')

module.exports = async function getContext({ pkg, warn }, contextArg) {
  let pkgData = null
  if (pkg) {
    try {
      // TODO: Update these dependencies
      pkgData = pkg.path ? await readPkg(pkg.path) : (await readPkgUp()).pkg
    } catch (error) {
      warn('Error parsing package.json: ' + error)
    }
    pkgData = pkg.transform(pkgData)
  }

  if (!pkgData || !pkgData.repository || !pkgData.repository.url) {
    try {
      pkgData = pkgData || {}
      pkgData.repository = {
        ...pkgData.repository,
        url: await gitRemoteOriginUrl()
      }
      normalizePackageData(pkgData)
    } catch (_) {
      // ignore any error
    }
  }

  let context = { version: (pkgData && pkgData.version) || '' }

  if (pkgData) {
    let repo
    try {
      repo = getPkgRepo(pkgData)
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
    context.packageData = pkgData
  }

  context = { ...context, ...contextArg }
  const hostOpts = getHostOpts(context.host)
  if (hostOpts) {
    if (!context.issue) context.issue = hostOpts.writer.issue
    if (!context.commit) context.commit = hostOpts.writer.commit
  } else if (context.host)
    warn(`Host: ${JSON.stringify(context.host)} does not exist`)

  return context
}
