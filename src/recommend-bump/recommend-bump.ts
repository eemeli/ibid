import { Commit } from '../commits'

export function recommendBump(
  commits: Commit[]
): 'major' | 'minor' | 'patch' | null {
  let isMinor = false
  let isPatch = false
  for (const commit of commits) {
    if (commit.message.breaking) return 'major'
    if (isMinor) continue
    switch (commit.message.type) {
      case 'feat':
        isMinor = true
        break
      case 'fix':
        isPatch = true
        break
    }
  }
  return isMinor ? 'minor' : isPatch ? 'patch' : null
}
