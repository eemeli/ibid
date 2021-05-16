'use strict'
const expect = require('chai').expect
const mocha = require('mocha')
const describe = mocha.describe
const it = mocha.it
const before = mocha.before
const beforeEach = mocha.beforeEach
const fs = require('fs')
const path = require('path')
const Handlebars = require('handlebars')

let template
let templateContext

before(function (done) {
  fs.readFile(path.resolve(__dirname, 'footer.hbs'), function (err, data) {
    if (err) done(err)
    template = data.toString()
    done()
  })
})

beforeEach(function () {
  templateContext = {
    noteGroups: [
      {
        title: 'my title',
        notes: [
          {
            title: 'my title',
            text: 'my note 1'
          },
          {
            title: 'my title',
            text: 'my note 2'
          }
        ]
      },
      {
        title: 'my other title',
        notes: [
          {
            title: 'my other title',
            text: 'my note 3'
          },
          {
            title: 'my other title',
            text: 'my note 4'
          }
        ]
      }
    ]
  }
})

describe('partial.footer', function () {
  it('should generate footer', function () {
    const log = Handlebars.compile(template)(templateContext)

    expect(log).to.equal(
      '\n### my title\n\n* my note 1\n* my note 2\n\n### my other title\n\n* my note 3\n* my note 4\n'
    )
  })
})
