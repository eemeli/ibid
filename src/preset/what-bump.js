'use strict'

const addBangNotes = require('./add-bang-notes')

const getWhatBump = ({ preMajor }) =>
  function whatBump(commits) {
    let level = 2
    let breakings = 0
    let features = 0

    commits.forEach(commit => {
      // adds additional breaking change notes
      // for the special case, test(system)!: hello world, where there is
      // a '!' but no 'BREAKING CHANGE' in body:
      addBangNotes(commit)
      if (commit.notes.length > 0) {
        breakings += commit.notes.length
        level = 0
      } else if (commit.type === 'feat' || commit.type === 'feature') {
        features += 1
        if (level === 2) {
          level = 1
        }
      }
    })

    return {
      level: preMajor && level < 2 ? level + 1 : level,
      reason:
        breakings === 1
          ? `There is ${breakings} BREAKING CHANGE and ${features} features`
          : `There are ${breakings} BREAKING CHANGES and ${features} features`
    }
  }

module.exports = getWhatBump
