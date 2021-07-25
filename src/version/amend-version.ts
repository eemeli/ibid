import { InputError } from '../cli-helpers/input-error'
import {
  gitAmendCommit,
  gitCurrentTags,
  gitListStagedFiles,
  gitTagMessage
} from '../shell/git'

export async function amendVersion(): Promise<void> {
  const tags = await gitCurrentTags()
  let ok = tags.length > 0
  for (const tag of tags) {
    const msg = await gitTagMessage(tag)
    if (msg !== tag) {
      ok = false
      break
    }
  }
  if (!ok) {
    throw new InputError(
      'The current commit does not appear to be a release commit.'
    )
  }

  const staged = await gitListStagedFiles()
  if (staged.length === 0) {
    throw new InputError(
      'To amend a release, first stage the updated files with `git add`.'
    )
  }

  await gitAmendCommit(tags)
}
