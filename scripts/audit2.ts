import { sentencePatternCatalog } from '../src/data/sentencePatternCatalog'
import { complexityForPattern } from '../src/lib/generationComplexity'
import fs from 'fs'

const src = fs.readFileSync('src/lib/generatedPracticeDrills.ts', 'utf-8')
const wiredFrameIds = new Set([...src.matchAll(/frameId:\s*'([^']+)'/g)].map(m => m[1]))

const advanced = sentencePatternCatalog.filter(p => p.generatorReady)
const byLevel = new Map<number, string[]>()
for (const p of advanced) {
  const level = complexityForPattern(p.id)
  if (!byLevel.has(level)) byLevel.set(level, [])
  byLevel.get(level)!.push(p.id)
}
for (const level of [1,2,4,5]) {
  const ids = byLevel.get(level) ?? []
  const unwired = ids.filter(id => !wiredFrameIds.has(id))
  console.log(`Level ${level} unwired (${unwired.length}): ${unwired.join(', ')}`)
}
