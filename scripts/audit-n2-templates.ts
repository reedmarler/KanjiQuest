import { HERO_TEMPLATES } from '../src/data/heroSentences.ts'
import { templateFamily } from '../src/lib/heroWordFit.ts'
import { templateIndicesForHeroLevel } from '../src/lib/heroTemplateLevel.ts'

const indices = templateIndicesForHeroLevel('N2')
const families = new Map<string, number>()

for (const idx of indices) {
  const t = HERO_TEMPLATES[idx]
  const family = templateFamily(t)
  families.set(family, (families.get(family) ?? 0) + 1)
  if (family === 'preference') {
    console.error('N2 still allows suki template:', t.id)
  }
}

console.log(`N2 template pool: ${indices.length} templates`)
console.log('Families:', Object.fromEntries(families))
console.log(
  'Sample ids:',
  indices.slice(0, 12).map((i) => HERO_TEMPLATES[i].id).join(', '),
)
