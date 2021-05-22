const { promisify } = require('util')
const execFile = promisify(require('child_process').execFile)

/** Source: https://git-scm.com/docs/git-check-ref-format */
function checkRef(ref) {
  // eslint-disable-next-line no-control-regex
  const invalid = /[\x00-\x20:*?[\\\x7f]|\/[/.]|@{|^@$|^[/.]|[/.]$/
  if (ref && invalid.test(ref))
    throw new Error(`Invalid revision specifier: ${ref}`)
}

function parseCommit(src, { includeMerge }) {
  const headMatch = src.match(
    /^([0-9a-f]+)\s+(Merge:.*\s+)?Author:\s*(.*?)\s+Date:\s*(\d+)\s+\n/
  )
  if (!headMatch) {
    if (src.trim()) throw new Error(`Malformed git commit:\ncommit ${src}`)
    return null
  }
  const [head, hash, merge, author, dateSrc] = headMatch
  if (merge && !includeMerge) return null
  const date = new Date(Number(dateSrc) * 1000)
  const message = src.substring(head.length).replace(/^ {4}/gm, '').trimEnd()
  return { hash, author, date, message }
}

async function gitLog(from, to, { includeMerge = false, path } = {}) {
  checkRef(from)
  checkRef(to)
  const args = [
    'log',
    '--date=unix',
    '--format=medium',
    '--no-color',
    '--no-decorate'
  ]
  const range = from ? `${from}..${to || ''}` : to
  if (range) args.push(range)
  if (path) args.push('--', path)
  const { stdout } = await execFile('git', args)
  return stdout
    .split(/^commit /m)
    .map(src => parseCommit(src, { includeMerge }))
    .filter(Boolean)
}

module.exports = gitLog
