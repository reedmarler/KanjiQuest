import { allCards } from '../src/data/index.ts'
import { buildHeroWordDrill } from '../src/lib/heroWordDrill.ts'
import { findTemplatesForWord } from '../src/lib/heroWordFit.ts'
import { buildHeroStudyPool } from '../src/lib/heroStudyPool.ts'
import type { JlptLevel } from '../src/lib/types.ts'

const emptyPool = { ids: [], byDeck: {} }

for (const level of ['N5', 'N4', 'N3', 'N2'] as JlptLevel[]) {
  const cards = allCards.filter(
    (c) => c.jlpt === level && (c.type === 'vocab' || c.type === 'kanji'),
  )
  const vocabWords = cards.filter((c) => c.type === 'vocab').map((c) => c.front)
  const withTemplate = vocabWords.filter((w) => findTemplatesForWord(w).length > 0)
  const study = buildHeroStudyPool(emptyPool, {}, level)
  const drill = buildHeroWordDrill(emptyPool, {}, level)

  console.log(
    [
      level,
      `cards=${cards.length}`,
      `vocab=${vocabWords.length}`,
      `sentenceFit=${withTemplate.length}`,
      `studyPool=${study.cardIds.length}`,
      `drill=${drill.length}`,
    ].join(' '),
  )

  if (level === 'N2') {
    console.log('  drill sample:', drill.slice(0, 10).map((d) => d.word).join(', '))
    console.log(
      '  no sentence template:',
      vocabWords.filter((w) => findTemplatesForWord(w).length === 0).slice(0, 12).join(', '),
    )
  }
}
