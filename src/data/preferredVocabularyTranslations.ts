const CURATED_PREFERRED_TRANSLATIONS: Record<string,string> = {
  '他人': 'stranger',
  '資料': 'documents',
  '相手': 'partner',
  '仲間': 'companion',
  '家庭': 'household',
  '通り': 'street',
  'フランス': 'France',
  '私自身': 'I',
  '本人': 'the person',
  '男性': 'man',
  '少年': 'boy',
  '選手': 'player',
  '親': 'parent',
  '文字': 'characters',
  'ご飯': 'meal',
  'マンション': 'apartment building',
}

const CURATED_SENSE_TRANSLATIONS: Record<string,string> = {
  '表|hyou':'chart',
  '表|ひょう':'chart',
  '表|omote':'surface',
  '表|おもて':'surface',
}

/**
 * Creates a clean generator default while preserving the complete dictionary
 * definition elsewhere. Editors can replace this value on each saved record.
 */
export function inferPreferredTranslation(japanese: string, dictionaryEnglish: string, reading?: string) {
  const senseCurated=CURATED_SENSE_TRANSLATIONS[`${japanese.trim()}|${reading?.trim().toLowerCase() ?? ''}`]
  if (senseCurated) return senseCurated
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
