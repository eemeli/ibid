'use strict'

const hosts = {
  bitbucket: {
    parser: {
      referenceActions: [
        'close',
        'closes',
        'closed',
        'closing',
        'fix',
        'fixes',
        'fixed',
        'fixing',
        'resolve',
        'resolves',
        'resolved',
        'resolving'
      ],
      issuePrefixes: ['#']
    },
    writer: { issue: 'issue', commit: 'commits' }
  },

  github: {
    parser: {
      referenceActions: [
        'close',
        'closes',
        'closed',
        'fix',
        'fixes',
        'fixed',
        'resolve',
        'resolves',
        'resolved'
      ],
      issuePrefixes: ['#', 'gh-']
    },
    writer: { issue: 'issues', commit: 'commit' }
  },

  gitlab: {
    parser: {
      referenceActions: [
        'close',
        'closes',
        'closed',
        'closing',
        'fix',
        'fixes',
        'fixed',
        'fixing'
      ],
      issuePrefixes: ['#']
    },
    writer: { issue: 'issues', commit: 'commit' }
  }
}

const knownHosts = new RegExp(Object.keys(hosts).join('|'), 'i')

module.exports = function getHostOpts(host) {
  if (!host) return null
  const match = host.match(knownHosts)
  return match ? hosts[match[0].toLowerCase()] : null
}
