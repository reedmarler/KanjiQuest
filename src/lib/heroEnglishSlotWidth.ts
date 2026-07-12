/** Normalized width units for English partial swap slots */
export const HERO_ENGLISH_SLOT_MIN_UNITS = 4
export const HERO_ENGLISH_SLOT_PAD_UNITS = 2
export const HERO_ENGLISH_SLOT_SPACE_BONUS = 1
export const HERO_ENGLISH_CHAR_EM = 0.6
export const HERO_ENGLISH_SLOT_PAD_EM = 0.36

export function heroEnglishSlotWidthUnits(text: string): number {
  if (!text) return HERO_ENGLISH_SLOT_MIN_UNITS

  const chars = [...text].length
  const spaces = (text.match(/\s/g) ?? []).length
  const units = chars + HERO_ENGLISH_SLOT_PAD_UNITS + spaces * HERO_ENGLISH_SLOT_SPACE_BONUS

  return Math.max(HERO_ENGLISH_SLOT_MIN_UNITS, units)
}

export function heroEnglishSlotWidthEm(...texts: string[]): string {
  const units = Math.max(
    ...texts.map(heroEnglishSlotWidthUnits),
    HERO_ENGLISH_SLOT_MIN_UNITS,
  )
  return `calc(${units} * ${HERO_ENGLISH_CHAR_EM}em + ${HERO_ENGLISH_SLOT_PAD_EM}em)`
}

export function heroEnglishWidthEmFromUnits(units: number): string {
  const clamped = Math.max(HERO_ENGLISH_SLOT_MIN_UNITS, units)
  return `calc(${clamped} * ${HERO_ENGLISH_CHAR_EM}em + ${HERO_ENGLISH_SLOT_PAD_EM}em)`
}

/** @deprecated use heroEnglishWidthEmFromUnits */
export function heroEnglishSlotMinWidthEm(...texts: string[]): string {
  return heroEnglishSlotWidthEm(...texts)
}
