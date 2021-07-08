import {
  getReferences,
  ReferenceOptions,
  Reference
} from './commit-message-references'

export interface Revert {
  hash: string
  header: string
}

export class CommitMessage {
  options: ReferenceOptions

  raw: string
  header: string
  body: string
  footer: { token: string; value: string }[] = []

  type: string | null = null
  scope: string | null = null
  subject: string
  breaking: string | null = null

  constructor(raw: string, options: ReferenceOptions = {}) {
    const parts = raw
      .replace(/[ \t]+$/gm, '')
      .trimStart()
      .split(/(?:\r?\n){2,}/)

    this.options = options
    this.raw = raw
    this.header = parts.shift() || ''

    const fe = /^[ \t*]*(BREAKING CHANGE|[\w-]+)(:\s|[ \t]+(?=#))/
    const footerStart = parts.findIndex(para => fe.test(para))
    if (footerStart !== -1) {
      const src = parts.splice(footerStart).join('\n\n')
      let token = ''
      let valueStart = -1
      for (const res of src.matchAll(new RegExp(fe, 'gm'))) {
        if (token) {
          const value = src.substring(valueStart, res.index).trim()
          this.footer.push({ token, value })
        }
        token = res[1]
        valueStart = (res.index || 0) + res[0].length
      }
      if (token) {
        const value = src.substring(valueStart).trim()
        this.footer.push({ token, value })
      }
    }

    this.body = parts.join('\n\n').trim()

    const bf = this.footer.find(
      ft => ft.token === 'BREAKING CHANGE' || ft.token === 'BREAKING-CHANGE'
    )
    if (bf) this.breaking = bf.value

    this.subject = this.header.replace(/\s+/g, ' ')
    const hm = this.subject.match(/^(\w+)(?:\((.*)\))?(!?): (.+)$/)
    if (hm) {
      this.type = hm[1]
      this.scope = hm[2] || null
      if (hm[3] && !this.breaking) this.breaking = this.body || hm[4]
      this.subject = hm[4]
    }
  }

  get mentions(): string[] {
    const mentions: string[] = []
    for (const [, mention] of this.raw.matchAll(/@([\w-]+)/g))
      mentions.push(mention)
    return mentions
  }

  get references(): Reference[] {
    return getReferences(this.raw, this.options)
  }

  get revert(): Revert | null {
    const re = /^(?:Revert|revert:)\s(?:""|"?([\s\S]+?)"?)\s*This reverts commit (\w+)\./i
    const [, header, hash] = this.raw.match(re) || []
    return hash && header ? { hash, header } : null
  }
}
