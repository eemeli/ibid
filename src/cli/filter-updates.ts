import { createPromptModule } from 'inquirer'
import { applyBump, ReleaseType } from '../bump/bump'

import type { PackageUpdate } from '../index'

const isBump = (bump: string): bump is ReleaseType =>
  [
    'major',
    'minor',
    'patch',
    'premajor',
    'preminor',
    'prepatch',
    'prerelease'
  ].includes(bump)

const plural = (count: number, name: string) =>
  count === 1 ? `1 ${name}` : `${count} ${name}s`

function updateStrings(updates: PackageUpdate[]): {
  print: string
  edit: string
} {
  let edit = ''
  const printChanged: string[] = []
  const unchanged: string[] = []
  for (const { context, commits, bump, version: next } of updates) {
    const { name, version } = context.package || {}
    if (bump) {
      const cs = plural(commits.length, 'commit')
      printChanged.push(`${name}: ${bump} (${version} -> ${next}, ${cs})`)

      let cmd: string = bump
      if (bump === 'set') cmd = `set=${next}`
      else {
        const { prerelease } = context.config
        if (typeof prerelease === 'string') cmd = `${bump}=${prerelease}`
      }
      edit += `${cmd} ${name} (${version}, ${cs})\n`
    } else {
      let vs = version
      if (commits.length > 0) vs += `, ${plural(commits.length, 'commit')}`
      unchanged.push(`keep ${name} (${vs})`)
    }
  }

  const print =
    `Updating ${printChanged.length}/${plural(updates.length, 'package')}` +
    (printChanged.length === 0
      ? '.'
      : ':\n\n    ' + printChanged.join('\n    ')) +
    '\n\n'

  if (unchanged.length > 0) {
    edit += '\n'
    for (const u of unchanged) edit += `${u}\n`
  }

  edit += `
# Update package versions
#
# Commands:
# keep <name> = do not update this package
# patch <name> = patch release, e.g. 1.2.3 -> 1.2.4 or 0.1.2-3 -> 0.1.2
# minor <name> = minor release, e.g. 1.2.3 -> 1.3.0 or 0.1.2-3 -> 0.2.0
# major <name> = major release, e.g. 1.2.3 -> 2.0.0 or 0.1.2-3 -> 1.0.0
# prerelease <name> = prerelease, e.g. 1.2.3 -> 1.2.3-0 or 1.2.3-foo.4 -> 1.2.3-foo.5
# preminor <name> = prerelease with minor update, e.g. 1.2.3 -> 1.3.0-0 or 1.2.3-foo.4 -> 1.3.0-foo.0
# premajor <name> = prerelease with major update, e.g. 1.2.3 -> 2.0.0-0 or 1.2.3-foo.4 -> 2.0.0-foo.0
# set=<version> <name> = set a specific version
#
# Each of the pre* commands may use a string argument to set an identifier:
#     preminor=bar <name>    # would update 1.2.3-foo.4 -> 1.3.0-bar.0
# Identifiers must contain only . - and word characters. An empty string is a valid identifier.
`

  return { print, edit }
}

export async function filterUpdates(
  updates: PackageUpdate[],
  out: NodeJS.WriteStream
): Promise<boolean> {
  const { print, edit } = updateStrings(updates)
  out.write(print)
  const prompt = createPromptModule({ output: out })
  const answers = await prompt<{
    action: 'Edit updates' | 'Yes' | 'No'
    edit?: string
  }>([
    {
      name: 'action',
      message: 'Apply these updates?',
      type: 'list',
      choices: ['Edit updates', 'Yes', 'No'],
      default: 'Yes'
    },
    {
      name: 'edit',
      type: 'editor',
      when: answers => answers.action === 'Edit updates',
      message: 'Edit list of updates',
      default: edit
    }
  ])

  if (answers.action === 'Yes') return true
  if (answers.action === 'No') return false

  const editSrc = answers.edit?.trim() || ''
  const commands = new Map<
    string,
    { bump: ReleaseType | 'set'; id?: string; line: string }
  >()
  for (const line of editSrc.split(/\s*\n\s*/)) {
    if (/^(#|keep\b)/.test(line)) continue
    const [command, name] = line.split(/\s+/)
    const [bump, id] = command.split('=')
    if (bump === 'set' || isBump(bump)) commands.set(name, { bump, id, line })
    else out.write(`Invalid bump ${bump}: ${line}\n`)
  }

  for (const up of updates) {
    if (!up.context.package) continue
    const { name } = up.context.package
    const cmd = commands.get(name)
    if (cmd) {
      const { bump, id, line } = cmd
      commands.delete(name)

      if (bump === 'set') {
        if (!id || /[^\w.-]/.test(id))
          out.write(`Ignoring invalid version ${id}: ${line}\n`)
        else {
          up.bump = bump
          up.version = id
        }
      } else {
        const { config } = up.context
        if (typeof id === 'string') {
          if (/[^\w.-]/.test(id))
            out.write(`Ignoring invalid identifier ${id}: ${line}\n`)
          if (bump.startsWith('pre')) config.prerelease = id
          else
            out.write(
              `Ignoring identifier ${id} for ${bump} release: ${line}\n`
            )
        } else if (typeof config.prerelease === 'string') {
          config.prerelease = bump.startsWith('pre')
        }
        up.bump = bump
        up.version = applyBump(up.context, bump)
      }
    } else {
      up.bump = null
      up.version = null
    }
  }

  out.write('\n')
  return filterUpdates(updates, out)
}
