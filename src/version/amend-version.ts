import { InputError } from '../cli'
import {
  gitAmendCommit,
  gitReleaseTags,
  gitListStagedFiles
} from '../shell/git'

export async function amendVersion(): Promise<void> {
  const tags = await gitReleaseTags('HEAD')
  if (tags.length === 0) {
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
