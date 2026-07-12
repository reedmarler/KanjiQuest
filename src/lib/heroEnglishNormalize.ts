/** Final pass on hero gloss lines — capitalization and common agreement fixes */
export function normalizeHeroEnglishGloss(text: string): string {
  if (!text) return text

  let out = text.trim().replace(/\.\s*$/, '')
  out = out.replace(/\s+/g, ' ')

  const temporalLeads = [
    'Yesterday',
    'This morning',
    'Last week',
    'This weekend',
    'Because it rained',
    'Because I do not have time',
    'If I have time',
    'If I had the money',
    'If the weather is nice',
    'When work is over',
  ]

  for (const lead of temporalLeads) {
    const marker = `${lead}, `
    if (out.startsWith(marker)) {
      const rest = out.slice(marker.length)
      if (rest.length > 0) {
        out = `${marker}${rest.charAt(0).toLowerCase()}${rest.slice(1)}`
      }
      break
    }
  }

  out = out
    .replace(/, (She|He|Everyone)\b/g, (_, name) => {
      if (name === 'She') return ', she'
      if (name === 'He') return ', he'
      return ', everyone'
    })
    .replace(/, My (teacher|friend|mother|older brother|older sister)\b/g, ', my $1')
    .replace(/ and (She|He|Everyone)\b/g, (_, name) => {
      if (name === 'She') return ' and she'
      if (name === 'He') return ' and he'
      return ' and everyone'
    })
    .replace(/ and My (teacher|friend|mother|older brother|older sister)\b/g, ' and my $1')

  if (out.length > 0) {
    out = out.charAt(0).toUpperCase() + out.slice(1)
  }

  return out
}

/** Strip trailing period and collapse whitespace for hero display + diffing */
export function sanitizeHeroEnglishGloss(text: string): string {
  if (!text) return text
  const collapsed = text.trim().replace(/\.\s*$/, '').replace(/\s+/g, ' ')
  return normalizeHeroEnglishGloss(collapsed)
}
