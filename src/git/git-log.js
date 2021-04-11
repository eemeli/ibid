const { promisify } = require('util')
const execFile = promisify(require('child_process').execFile)

/** Source: https://git-scm.com/docs/git-check-ref-format */
function checkRef(ref) {
  // eslint-disable-next-line no-control-regex
  const invalid = /[\x00-\x20:*?[\\\x7f]|\/[/.]|@{|^@$|^[/.]|[/.]$/
  if (ref && invalid.test(ref))
    throw new Error(`Invalid revision specifier: ${ref}`)
}

function parseCommit(src) {
  const headMatch = src.match(
    /^([0-9a-f]+)( \(.*\))?\s+Author:\s*(.*?)\s+Date:\s*(\d+)\s+\n/
  )
  if (!headMatch) {
    if (src.trim()) throw new Error(`Malformed git commit:\ncommit ${src}`)
    return null
  }
  const [head, hash, tagSrc, author, dateSrc] = headMatch
  const tags = tagSrc
    ? tagSrc
        .slice(2, -1)
        .split(', ')
        .filter(tag => tag.startsWith('tag: '))
        .map(tag => tag.substring(5))
    : []
  const date = new Date(Number(dateSrc) * 1000)
  const message = src.substring(head.length).replace(/^ {4}/gm, '').trimEnd()
  return { hash, tags, author, date, message }
}

async function gitLog(from, to, { path } = {}) {
  checkRef(from)
  checkRef(to)
  const args = [
    'log',
    '--date=unix',
    '--decorate=short',
    '--format=medium',
    '--no-color'
  ]
  const range = from ? `${from}..${to || ''}` : to
  if (range) args.push(range)
  if (path) args.push('--', path)
  const { stdout } = await execFile('git', args)
  return stdout
    .split(/^commit /m)
    .map(parseCommit)
    .filter(Boolean)
}

module.exports = gitLog
