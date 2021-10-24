import { resolve } from 'path'
import { hasErrorCode, InputError } from '../cli'
import { Config, getBaseConfig, validateConfig } from './config'

async function loadRawConfig(cwd: string, fn: string) {
  const path = resolve(cwd, fn)
  try {
    const mod = await import(path)
    const cfg = mod && mod.default
    if (cfg && typeof cfg === 'object') return cfg
    else throw new InputError(`Config file does not export an object: ${path}`)
  } catch (error) {
    if (hasErrorCode(error, 'MODULE_NOT_FOUND')) return null
    throw error
  }
}

export async function loadConfig(
  cwd: string,
  fn: string | null | undefined,
  args: Record<string, unknown>
): Promise<Required<Config>> {
  let cfg: Record<string, unknown> | null = null
  if (fn) {
    cfg = await loadRawConfig(cwd, fn)
    if (!cfg) throw new InputError(`Config file not found: ${resolve(cwd, fn)}`)
  } else {
    for (const cf of ['ibid.config.js', 'ibid.config.mjs', 'ibid.config.cjs']) {
      cfg = await loadRawConfig(cwd, cf)
      if (cfg) break
    }
  }
  return Object.assign(
    await getBaseConfig(),
    validateConfig(cfg, true),
    validateConfig(args, false)
  )
}
