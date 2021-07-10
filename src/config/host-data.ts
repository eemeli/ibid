export interface HostContext {
  commitPath: string
  issuePath: string
  issuePrefixes: string[]
  referenceActions: string[]
}

export const hostData: Record<string, HostContext> = {
  _default: {
    commitPath: 'commit',
    issuePath: 'issues',
    issuePrefixes: ['#'],
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
    ]
  },

  bitbucket: {
    commitPath: 'commits',
    issuePath: 'issue',
    issuePrefixes: ['#'],
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
    ]
  },

  github: {
    commitPath: 'commit',
    issuePath: 'issues',
    issuePrefixes: ['#', 'gh-'],
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
    ]
  },

  gitlab: {
    commitPath: 'commit',
    issuePath: 'issues',
    issuePrefixes: ['#'],
    referenceActions: [
      'close',
      'closes',
      'closed',
      'closing',
      'fix',
      'fixes',
      'fixed',
      'fixing'
    ]
  }
}
