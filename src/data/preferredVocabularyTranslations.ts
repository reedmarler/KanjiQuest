const CURATED_PREFERRED_TRANSLATIONS: Record<string,string> = {
  '他人': 'stranger',
  '資料': 'documents',
  '相手': 'partner',
  '少年': 'boy',
  '選手': 'player',
  '親': 'parent',
  '文字': 'characters',
  'ご飯': 'rice',
  'マンション': 'apartment building',
}

/**
 * Creates a clean generator default while preserving the complete dictionary
 * definition elsewhere. Editors can replace this value on each saved record.
 */
export function inferPreferredTranslation(japanese: string, dictionaryEnglish: string) {
  const curated = CURATED_PREFERRED_TRANSLATIONS[japanese.trim()]
  if (curated) return curated

  return dictionaryEnglish
    .split(/\s*(?:;|\/|,)\s*/)[0]!
    .replace(/^\(\d+\)\s*/, '')
    .replace(/^\([^)]*\)\s*/, '')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .replace(/^(?:to|a|an|the)\s+/i, '')
    .replace(/[.;,]+$/, '')
    .trim()
}

