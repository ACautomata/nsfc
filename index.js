/**
 * NSFC agent skills provider.
 *
 * Ships the four NSFC application-writing skills from
 * https://github.com/njzjz/nsfc-agent-skills as one `ctx.skills` provider.
 * Discovery parses each shipped `skills/<name>/SKILL.md` YAML frontmatter;
 * loading returns the body without frontmatter and points `resourceBase`
 * at the skill directory, so relative references, scripts, and assets
 * resolve on disk.
 *
 * @module @local/nsfc-agent-skills
 */

import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

/** Cordis plugin name. */
export const name = 'nsfc-agent-skills'
/** Service required by the skill provider. */
export const inject = ['skills']

const PROVIDER_NAME = 'nsfc-agent-skills'
const SKILLS_ROOT = fileURLToPath(new URL('./skills/', import.meta.url))
/** Standard precedence rank for packaged skill providers. */
const BUNDLED_SKILL_RANK = 600
const SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const INVOCATION = { modelInvocable: true, userInvocable: true }

/**
 * Parse the restricted YAML frontmatter this provider accepts: an opening
 * `---` line, a closing `---` line, and flat `key: value` string fields.
 * @param {string} raw - full SKILL.md text.
 * @returns {{ data: Record<string, string>, body: string } | undefined} mapping and body, or undefined without valid frontmatter.
 */
function parseFrontmatter(raw) {
  const firstLineEnd = raw.indexOf('\n')
  if (firstLineEnd < 0) return undefined
  if (raw.slice(0, firstLineEnd).replace(/\r$/, '') !== '---') return undefined
  let lineStart = firstLineEnd + 1
  while (lineStart <= raw.length) {
    const nextNewline = raw.indexOf('\n', lineStart)
    const lineEnd = nextNewline < 0 ? raw.length : nextNewline
    const line = raw.slice(lineStart, lineEnd).replace(/\r$/, '')
    if (line === '---') {
      const yaml = raw.slice(firstLineEnd + 1, lineStart)
      return { data: parseFlatMapping(yaml), body: nextNewline < 0 ? '' : raw.slice(nextNewline + 1) }
    }
    if (nextNewline < 0) return undefined
    lineStart = nextNewline + 1
  }
  return undefined
}

/**
 * Read flat `key: value` string fields; skip empty, quoted-unbalanced, and
 * structured (list/object) values this provider does not use.
 * @param {string} text - YAML mapping text between the frontmatter fences.
 * @returns {Record<string, string>} plain string fields.
 */
function parseFlatMapping(text) {
  const data = {}
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (line.length === 0 || line.startsWith('#')) continue
    const colon = line.indexOf(':')
    if (colon <= 0) continue
    const key = line.slice(0, colon).trim()
    let value = line.slice(colon + 1).trim()
    if (value.length < 2 || value.startsWith('[') || value.startsWith('{')) continue
    const first = value[0]
    if ((first === '"' || first === "'") && value.endsWith(first)) value = value.slice(1, -1)
    data[key] = value
  }
  return data
}

/**
 * Build one registry candidate from a parsed skill file.
 * @param {string} skillDirectory - absolute skill directory used as the resource base.
 * @param {{ data: Record<string, string> }} parsed - parsed frontmatter mapping.
 * @param {string} warn - prefix for validation diagnostics.
 * @param {(message: string) => void} logWarn - warning sink.
 * @returns {unknown | undefined} SkillCandidate-shaped object, or undefined when invalid.
 */
function toCandidate(skillDirectory, parsed, warn, logWarn) {
  const skillMdPath = join(skillDirectory, 'SKILL.md')
  const skillName = parsed.data.name
  const description = parsed.data.description
  if (typeof skillName !== 'string' || !SKILL_NAME_PATTERN.test(skillName)) {
    logWarn(`${warn}: invalid skill name "${skillName}"`)
    return undefined
  }
  if (typeof description !== 'string' || description.length === 0) {
    logWarn(`${warn}: skill "${skillName}" requires a description`)
    return undefined
  }
  const whenToUse = parsed.data.whenToUse
  return {
    name: skillName,
    description,
    ...(typeof whenToUse === 'string' && whenToUse.length > 0 ? { whenToUse } : {}),
    invocation: INVOCATION,
    provider: PROVIDER_NAME,
    source: 'bundled',
    resourceBase: { kind: 'directory', path: skillDirectory },
    rank: BUNDLED_SKILL_RANK,
    locator: { path: skillMdPath },
    path: skillMdPath,
  }
}

/**
 * Register the shipped-skill provider on `ctx.skills`.
 * @param {import('@deepseek-ai/cordis').Context} ctx - Cordis context with the `skills` service.
 */
export function apply(ctx) {
  const logWarn = (message) => { ctx.logger.warn(message) }

  const provider = {
    name: PROVIDER_NAME,

    /**
     * Discover the shipped skills. A missing root or unreadable file is
     * logged and omitted; the remaining skills stay available.
     */
    async list() {
      let entries
      try {
        entries = await readdir(SKILLS_ROOT, { withFileTypes: true })
      } catch (error) {
        logWarn(`skill root "${SKILLS_ROOT}" skipped: ${String(error)}`)
        return []
      }
      const candidates = []
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        const skillDirectory = join(SKILLS_ROOT, entry.name)
        let raw
        try {
          raw = await readFile(join(skillDirectory, 'SKILL.md'), 'utf8')
        } catch {
          continue
        }
        const parsed = parseFrontmatter(raw)
        if (parsed === undefined) {
          logWarn(`skill file ${join(skillDirectory, 'SKILL.md')} ignored: missing or invalid YAML frontmatter`)
          continue
        }
        const candidate = toCandidate(skillDirectory, parsed, `skill "${entry.name}"`, logWarn)
        if (candidate !== undefined) candidates.push(candidate)
      }
      return candidates
    },

    /**
     * Load one skill body without its frontmatter.
     * @param {{ locator: { path: string } }} candidate - winning candidate from list().
     * @returns {Promise<unknown | undefined>} SkillDefinition-shaped object, or undefined when the file disappeared.
     */
    async get(candidate) {
      let raw
      try {
        raw = await readFile(candidate.locator.path, 'utf8')
      } catch {
        return undefined
      }
      const parsed = parseFrontmatter(raw)
      if (parsed === undefined) return undefined
      const skillName = parsed.data.name
      const description = parsed.data.description
      if (typeof skillName !== 'string' || !SKILL_NAME_PATTERN.test(skillName)) return undefined
      if (typeof description !== 'string' || description.length === 0) return undefined
      const whenToUse = parsed.data.whenToUse
      return {
        name: skillName,
        description,
        ...(typeof whenToUse === 'string' && whenToUse.length > 0 ? { whenToUse } : {}),
        invocation: INVOCATION,
        provider: PROVIDER_NAME,
        source: 'bundled',
        resourceBase: { kind: 'directory', path: join(candidate.locator.path, '..') },
        path: candidate.locator.path,
        content: parsed.body.trim(),
      }
    },
  }

  ctx.skills.registerProvider(() => provider)
}
