import { HERO_TEMPLATES, type HeroTemplate } from '../data/heroSentences'
import { findTemplatesForWord, templateFamily } from './heroWordFit'
import type { JlptLevel } from './types'

/** Families too casual for abstract upper-JLPT hero rotation */
const N3_EXCLUDED_FAMILIES = new Set(['preference', 'desire'])

/** Families too advanced for N4 hero rotation */
const N4_EXCLUDED_FAMILIES = new Set(['formal'])

/** Families too advanced for N5 hero rotation */
const N5_EXCLUDED_FAMILIES = new Set([
  'opinion',
  'wish-think',
  'become-able',
  'necessity',
  'experience',
  'conditional',
  'formal',
])

const UPPER_JLPT_PREFERRED_FAMILIES = new Set([
  'topic',
  'interest',
  'study',
  'learn',
  'think',
  'impression',
  'read',
  'skill',
  'ability',
  'opinion',
  'wish-think',
  'purpose',
  'continue',
  'transport',
  'conditional',
  'past',
  'multi-clause',
  'formal',
])

export function templateAllowedAtLevel(template: HeroTemplate, level: JlptLevel): boolean {
  const family = templateFamily(template)
  if (level === 'N5' && N5_EXCLUDED_FAMILIES.has(family)) return false
  if (level === 'N4' && N4_EXCLUDED_FAMILIES.has(family)) return false
  if (level === 'N5' || level === 'N4') return true
  if (level === 'N3') return !N3_EXCLUDED_FAMILIES.has(templateFamily(template))
  return UPPER_JLPT_PREFERRED_FAMILIES.has(templateFamily(template))
}

export function templatesForHeroLevel(level: JlptLevel): HeroTemplate[] {
  return HERO_TEMPLATES.filter((t) => templateAllowedAtLevel(t, level))
}

export function templateIndicesForHeroLevel(level: JlptLevel): number[] {
  return HERO_TEMPLATES.flatMap((t, idx) =>
    templateAllowedAtLevel(t, level) ? [idx] : [],
  )
}

/** Curated multi-clause / conditional / past scaffolds with swappable word slots */
export function isScaffoldTemplate(template: HeroTemplate): boolean {
  return Boolean(
    template.prefix
    || template.bridge
    || template.prefix?.includes('ので')
    || template.modifier?.includes('ながら')
    || template.modifier?.includes('てから')
    || template.modifier?.includes('行って')
    || template.modifier?.includes('会って')
    || template.modifier?.includes('終わって'),
  )
}

export function scaffoldTemplateIndicesForLevel(level: JlptLevel): number[] {
  return HERO_TEMPLATES.flatMap((t, idx) =>
    isScaffoldTemplate(t) && templateAllowedAtLevel(t, level) ? [idx] : [],
  )
}

const SCAFFOLD_DEFAULT_ID: Partial<Record<JlptLevel, string>> = {
  N5: 'past-tosho-yonde-karita-2',
  N4: 'multi-kyoumi-node-2',
  N3: 'multi-deari-kiso-2',
  N2: 'multi-deari-kiban-2',
  N1: 'multi-deari-mondai-2',
}

export function defaultScaffoldTemplateIndex(level: JlptLevel): number {
  const preferredId = SCAFFOLD_DEFAULT_ID[level]
  if (preferredId) {
    const idx = HERO_TEMPLATES.findIndex((t) => t.id === preferredId)
    if (idx >= 0 && templateAllowedAtLevel(HERO_TEMPLATES[idx], level)) return idx
  }

  const scaffolds = scaffoldTemplateIndicesForLevel(level)
  return scaffolds.length > 0 ? scaffolds[0] : -1
}

/** Prefer topic / study / interest templates for N2+ words */
export function rankTemplatesForWord(word: string, level: JlptLevel): HeroTemplate[] {
  const fits = findTemplatesForWord(word).filter((t) => templateAllowedAtLevel(t, level))
  if (level === 'N5' || level === 'N4') return fits

  const preferred = fits.filter((t) =>
    UPPER_JLPT_PREFERRED_FAMILIES.has(templateFamily(t)),
  )
  return preferred.length > 0 ? preferred : fits
}

export function defaultTemplateForLevel(level: JlptLevel): HeroTemplate {
  const preferredId =
    level === 'N2' || level === 'N1'
      ? 'topic-juyo-2'
      : level === 'N3'
        ? 'benkyo-nitsuite-2'
        : 'iku-2'

  return (
    HERO_TEMPLATES.find((t) => t.id === preferredId)
    ?? templatesForHeroLevel(level)[0]
    ?? HERO_TEMPLATES[0]
  )
}

export function defaultTemplateIndexForLevel(level: JlptLevel): number {
  const template = defaultTemplateForLevel(level)
  const idx = HERO_TEMPLATES.indexOf(template)
  return idx >= 0 ? idx : 0
}
