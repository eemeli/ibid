'use strict'
const { expect } = require('chai')
const { describe, it } = require('mocha')

const writer = require('./writer')

const today = new Date().toISOString().substring(0, 10)

const commits = [
  {
    hash: '9b1aff905b638aa274a5fc8f88662df446d374bd',
    header: 'feat(scope): broadcast $destroy event on scope destruction',
    body: null,
    footer: 'Closes #1',
    notes: [{ title: 'BREAKING NEWS', text: 'breaking news' }],
    references: [
      { action: 'Closes', repository: null, issue: '1', raw: '#1' },
      { action: 'Closes', repository: null, issue: '2', raw: '#2' },
      { action: 'Closes', repository: null, issue: '3', raw: '#3' }
    ]
  },
  {
    hash: '13f31602f396bc269076ab4d389cfd8ca94b20ba',
    header: 'fix(ng-list): Allow custom separator',
    body: 'bla bla bla',
    footer: 'BREAKING CHANGE: some breaking change',
    notes: [{ title: 'BREAKING CHANGE', text: 'some breaking change' }],
    references: []
  },
  {
    hash: '2064a9346c550c9b5dbd17eee7f0b7dd2cde9cf7',
    header: 'perf(template): tweak',
    body: 'My body.',
    footer: '',
    notes: [],
    references: []
  },
  {
    hash: '5f241416b79994096527d319395f654a8972591a',
    header:
      'refactor(name): rename this module to conventional-changelog-writer',
    body: '',
    footer: '',
    notes: [],
    references: []
  }
]

describe('writer', function () {
  describe('no commits', function () {
    it('should still work if there is no commits', function () {
      const changelog = writer([])
      expect(changelog).to.equal('##  (' + today + ')\n\n\n\n\n')
    })
  })

  describe('link', function () {
    it('should auto link if `context.repository`, `context.commit` and `context.issue` are truthy', function () {
      const context = {
        version: '0.5.0',
        title: 'this is a title',
        host: 'https://github.com',
        repository: 'a/b'
      }
      const changelog = writer(commits, context)
      expect(changelog).to.include('https://github.com/a/b/commits/13f3160')
    })

    it('should auto link if `context.repoUrl`, `context.commit` and `context.issue` are truthy', function () {
      const context = {
        version: '0.5.0',
        title: 'this is a title',
        repoUrl: 'https://github.com/a/b'
      }
      const changelog = writer(commits, context)
      expect(changelog).to.include('https://github.com/a/b/commits/13f3160')
    })

    it('should not auto link', function () {
      const changelog = writer(commits, {})
      expect(changelog).to.not.include('https://github.com/a/b/commits/13f3160')
    })

    it('should not link references', function () {
      const context = {
        version: '0.5.0',
        title: 'this is a title',
        host: 'https://github.com',
        repository: 'a/b',
        linkReferences: false
      }
      const changelog = writer(commits, context)
      expect(changelog).to.not.include('https://github.com/a/b/commits/13f3160')
    })
  })

  describe('transform', function () {
    it('should transform the commit with context', function () {
      let called = false
      writer(
        commits,
        {},
        {
          transform(commit, context) {
            expect(context).to.eql({
              commit: 'commits',
              issue: 'issues',
              date: today
            })
            called = true
            return commit
          }
        }
      )
      expect(called).to.equal(true)
    })

    it('should merge with the provided transform object', function () {
      const changelog = writer(
        commits,
        {},
        {
          transform: {
            notes(notes) {
              for (const note of notes)
                if (note.title === 'BREAKING CHANGE')
                  note.title = 'BREAKING CHANGES'
              return notes
            }
          }
        }
      )
      expect(changelog).to.include('13f3160')
      expect(changelog).to.include('BREAKING CHANGES')
      expect(changelog).to.not.include(
        '13f31602f396bc269076ab4d389cfd8ca94b20ba'
      )
    })

    it('should ignore the commit if tranform returns `null`', function () {
      const changelog = writer(commits, {}, { transform: () => false })
      expect(changelog).to.equal('##  (' + today + ')\n\n\n\n\n')
    })
  })

  describe('generate', function () {
    const commits = [
      {
        header: 'feat(scope): broadcast $destroy event on scope destruction',
        body: null,
        footer: null,
        notes: [],
        references: [],
        committerDate: '2015-04-07 14:17:05 +1000'
      },
      {
        header: 'fix(ng-list): Allow custom separator',
        body: 'bla bla bla',
        footer: null,
        notes: [],
        references: [],
        version: '1.0.1',
        committerDate: '2015-04-07 15:00:44 +1000'
      },
      {
        header: 'perf(template): tweak',
        body: 'My body.',
        footer: null,
        notes: [],
        references: [],
        committerDate: '2015-04-07 15:01:30 +1000'
      },
      {
        header:
          'refactor(name): rename this module to conventional-changelog-writer',
        body: null,
        footer: null,
        notes: [],
        references: [],
        committerDate: '2015-04-08 09:43:59 +1000'
      }
    ]

    it('should generate on the transformed commit', function () {
      const changelog = writer(
        commits,
        { version: '1.0.0' },
        {
          transform(commit) {
            commit.version = '1.0.0'
            return commit
          }
        }
      )
      expect(changelog).to.contain('# 1.0.0 ')
    })

    describe('when commits are not reversed', function () {
      it("should generate on `'version'` if it's a valid semver", function () {
        const changelog = writer(commits)
        expect(changelog).to.include('##  (' + today)
        expect(changelog).to.include('feat(scope): ')
        expect(changelog).to.include('## <small>1.0.1 (2015-04-07)</small>')
        expect(changelog).to.include('fix(ng-list): ')
        expect(changelog).to.include('perf(template): ')
        expect(changelog).to.include('refactor(name): ')
      })

      it('`generateOn` could be a string', function () {
        const commits = [
          {
            header:
              'feat(scope): broadcast $destroy event on scope destruction',
            body: null,
            footer: null,
            notes: [],
            references: [],
            version: '1.0.1',
            committerDate: '2015-04-07 14:17:05 +1000'
          },
          {
            header: 'fix(ng-list): Allow custom separator',
            body: 'bla bla bla',
            footer: null,
            notes: [],
            references: [],
            version: '2.0.1',
            committerDate: '2015-04-07 15:00:44 +1000'
          },
          {
            header: 'perf(template): tweak',
            body: 'My body.',
            footer: null,
            notes: [],
            references: [],
            committerDate: '2015-04-07 15:01:30 +1000'
          },
          {
            header:
              'refactor(name): rename this module to conventional-changelog-writer',
            body: null,
            footer: null,
            notes: [],
            references: [],
            version: '4.0.1',
            committerDate: '2015-04-08 09:43:59 +1000'
          }
        ]
        const changelog = writer(commits, {}, { generateOn: 'version' })
        expect(changelog).to.include('##  (' + today)
        expect(changelog).to.include(
          'feat(scope): broadcast $destroy event on scope destruction'
        )
        expect(changelog).to.not.include('<a name=""></a>')
        expect(changelog).to.include('fix(ng-list): Allow custom separator')
        expect(changelog).to.include('perf(template): tweak')
        expect(changelog).to.include(
          'refactor(name): rename this module to conventional-changelog-writer'
        )
        expect(changelog).to.include('perf(template): tweak')
      })

      it('`generateOn` could be a function', function () {
        const changelog = writer(
          commits,
          {},
          {
            generateOn(commit, commits, context, options) {
              expect(commits.length).to.be.a('number')
              expect(context.commit).to.equal('commits')
              expect(options.groupBy).to.equal('type')
              return commit.version
            }
          }
        )
        expect(changelog).to.include('##  (' + today)
        expect(changelog).to.not.include('## 1.0.1 (2015-04-07)')
      })

      it('`generateOn` could be a null', function () {
        const changelog = writer(commits, {}, { generateOn: null })
        expect(changelog).to.include('##  (' + today)
      })

      it('version should fall back on `context.version` and `context.date`', function () {
        const changelog = writer(commits, {
          version: '0.0.1',
          date: '2015-01-01'
        })
        expect(changelog).to.include('## <small>0.0.1 (2015-01-01)</small>')
        expect(changelog).to.include('## <small>1.0.1 (2015-04-07)</small>')
      })

      it('should still generate a block even if the commit is ignored', function () {
        const changelog = writer(commits, {}, { transform: () => false })
        expect(changelog).to.include('##  (' + today + ')\n\n\n\n\n')
        expect(changelog).to.include(
          '## <small>1.0.1 (2015-04-07 15:00:44 +1000)</small>\n\n\n\n\n'
        )
      })
    })

    describe('when commits are reversed', function () {
      it("should generate on `'version'` if it's a valid semver", function () {
        const commits = [
          {
            header:
              'feat(scope): broadcast $destroy event on scope destruction',
            body: null,
            footer: null,
            notes: [],
            references: [],
            version: '1.0.1',
            committerDate: '2015-04-07 14:17:05 +1000'
          },
          {
            header: 'fix(ng-list): Allow custom separator',
            body: 'bla bla bla',
            footer: null,
            notes: [],
            references: [],
            version: '2.0.1',
            committerDate: '2015-04-07 15:00:44 +1000'
          },
          {
            header: 'perf(template): tweak',
            body: 'My body.',
            footer: null,
            notes: [],
            references: [],
            committerDate: '2015-04-07 15:01:30 +1000'
          },
          {
            header:
              'refactor(name): rename this module to conventional-changelog-writer',
            body: null,
            footer: null,
            notes: [],
            references: [],
            version: '4.0.1',
            committerDate: '2015-04-08 09:43:59 +1000'
          }
        ]
        const changelog = writer(commits, {}, { reverse: true })
        expect(changelog.trim()).to.equal(
          `## <small>1.0.1 (2015-04-07)</small>

* feat(scope): broadcast $destroy event on scope destruction·



## <small>2.0.1 (2015-04-07)</small>

* fix(ng-list): Allow custom separator·



## <small>4.0.1 (2015-04-07)</small>

* perf(template): tweak·
* refactor(name): rename this module to conventional-changelog-writer·



##  (xxxx-xx-xx)`
            .replace(/·/g, ' ')
            .replace('xxxx-xx-xx', today)
        )
      })

      it('should still generate a block even if the commit is ignored', function () {
        const changelog = writer(
          commits,
          {},
          { reverse: true, transform: () => false }
        )
        expect(changelog).to.include(
          '## <small>1.0.1 (2015-04-07 15:00:44 +1000)</small>\n\n\n\n\n'
        )
        expect(changelog).to.include('##  (' + today + ')\n\n\n\n\n')
      })
    })
  })

  it("should ignore the field if it doesn't exist", function () {
    const commits = [{ header: 'bla', body: null, footer: null, notes: [] }]
    const changelog = writer(commits)
    expect(changelog).to.equal('##  (' + today + ')\n\n* bla \n\n\n\n')
  })

  it('should sort notes on `text` by default', function () {
    const commits = [
      {
        header: 'feat(scope): broadcast $destroy event on scope destruction',
        body: null,
        footer: null,
        notes: [
          { title: 'BREAKING CHANGE', text: 'No backward compatibility.' }
        ],
        references: [],
        committerDate: '2015-04-07 14:17:05 +1000'
      },
      {
        header: 'fix(ng-list): Allow custom separator',
        body: 'bla bla bla',
        footer: null,
        notes: [
          { title: 'BREAKING CHANGE', text: 'Another change.' },
          { title: 'BREAKING CHANGE', text: 'Some breaking change.' }
        ],
        references: [],
        committerDate: '2015-04-07 15:00:44 +1000'
      }
    ]
    const changelog = writer(commits)
    expect(changelog).to.match(
      /Another change.[\w\W]*No backward compatibility.[\w\W]*Some breaking change./
    )
  })

  it('should not error if version is not semver', function () {
    const changelog = writer(commits, { version: 'a.b.c' })
    expect(changelog).to.include('a.b.c')
  })

  it('should callback with error on transform', function () {
    expect(() =>
      writer(commits, {}, { transform: () => undefined.a })
    ).to.throw()
  })

  it('should callback with error on flush', function () {
    expect(() =>
      writer(commits, {}, { finalizeContext: () => undefined.a })
    ).to.throw()
  })

  it('should show your final context', function (done) {
    const debug = ctx => {
      expect(ctx).to.include('Your final context is:\n')
      done()
    }
    writer(commits, {}, { debug })
  })
})
