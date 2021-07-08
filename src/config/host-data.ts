export interface HostContext {
  issuePrefixes: string[]
  referenceActions: string[]
  writer: { issue: string; commit: string }
}

export const hostData: Record<string, HostContext> = {
  _default: {
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
    ],
    writer: { issue: 'issues', commit: 'commit' }
  },

  bitbucket: {
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
    ],
    writer: { issue: 'issue', commit: 'commits' }
  },

  github: {
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
    ],
    writer: { issue: 'issues', commit: 'commit' }
  },

  gitlab: {
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
    ],
    writer: { issue: 'issues', commit: 'commit' }
  }
}
