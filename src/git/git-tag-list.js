const { promisify } = require('util')
const execFile = promisify(require('child_process').execFile)

async function gitTagList() {
  const args = [
    'tag',
    '--list',
    '--sort=-creatordate',
    '--color=never',
    '--no-column'
  ]
  const { stdout } = await execFile('git', args)
  return stdout.split('\n').filter(Boolean)
}

module.exports = gitTagList
