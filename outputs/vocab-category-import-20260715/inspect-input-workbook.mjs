import fs from 'node:fs/promises'
import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool'
import { createServer } from 'file:///C:/Users/Reed/kanji-quest/node_modules/vite/dist/node/index.js'

const inputPath = 'C:/Users/Reed/Desktop/Japanese vocab categories and tags.xlsx'
const outputDir = 'C:/Users/Reed/kanji-quest/outputs/vocab-category-import-20260715'
const input = await FileBlob.load(inputPath)
const workbook = await SpreadsheetFile.importXlsx(input)
const overview = await workbook.inspect({ kind: 'workbook,sheet,table', maxChars: 8000, tableMaxRows: 8, tableMaxCols: 8, tableMaxCellChars: 100 })
console.log(overview.ndjson)

const sheets = []
for (const sheet of workbook.worksheets.items) {
  const used = sheet.getUsedRange(true)
  const values = used?.values ?? []
  sheets.push({ name: sheet.name, address: used?.address ?? '', rows: values.length, cols: Math.max(0, ...values.map(row => row.length)), values })
  const previewRange = values.length > 45 ? `A1:F45` : used?.address
  const preview = await workbook.render({ sheetName: sheet.name, range: previewRange, scale: 1, format: 'png' })
  await fs.writeFile(`${outputDir}/preview-${sheet.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`, new Uint8Array(await preview.arrayBuffer()))
}
await fs.writeFile(`${outputDir}/input-workbook-values.json`, JSON.stringify(sheets, null, 2), 'utf8')

const categoryOrder = ['People & Living Things', 'Places', 'Objects', 'Food & Drink', 'Actions', 'Descriptors', 'Time & Numbers', 'Function Words']
const exactCategories = new Set(categoryOrder)
const placeAliases = new Set(['Building', 'Building, Office', 'Country', 'Park', 'Room', 'Road', 'Home', 'Hotel', 'Mountain', 'Office', 'Restaurant', 'River', 'School', 'Station', 'Town', 'Village'])
const canonicalWord = word => String(word ?? '').replace(/\s*\([^)]*\)\s*/g, '').replace(/／/g, '/').trim()
const splitTags = value => String(value ?? '').split(',').map(tag => tag.trim()).filter(Boolean)
const categoryFor = (value, tags) => {
  const category = String(value ?? '').trim()
  if (exactCategories.has(category)) return category
  if (category === 'People') return 'People & Living Things'
  if (placeAliases.has(category)) return 'Places'
  if (category === 'Event') return 'Actions'
  if (category === 'Concrete') return tags.some(tag => /^(Area|Region|Direction|Location|Garden|Outdoor|Street|Road|Transportation|City|Place|Ocean|Sea|Nature|Geography)$/.test(tag)) ? 'Places' : 'Objects'
  throw new Error(`Unmapped category: ${category}`)
}

const workbookRows = []
for (const row of sheets.find(sheet => sheet.name === 'Vocab').values.slice(1)) {
  const tags = splitTags(row[2])
  workbookRows.push({ word: canonicalWord(row[0]), category: categoryFor(row[1], tags), tags, sourceSheet: 'Vocab' })
}
for (const row of sheets.find(sheet => sheet.name === 'Function Words').values.slice(1)) {
  const hasThirdColumn = Boolean(String(row[2] ?? '').trim())
  const tags = splitTags(hasThirdColumn ? row[2] : row[1])
  workbookRows.push({ word: canonicalWord(row[0]), category: hasThirdColumn ? categoryFor(row[1], tags) : 'Function Words', tags, sourceSheet: 'Function Words' })
}

const grouped = new Map()
for (const row of workbookRows) {
  const current = grouped.get(row.word) ?? { categories: [], tags: [], sourceSheets: [] }
  if (!current.categories.includes(row.category)) current.categories.push(row.category)
  for (const tag of row.tags) if (!current.tags.some(existing => existing.toLowerCase() === tag.toLowerCase())) current.tags.push(tag)
  if (!current.sourceSheets.includes(row.sourceSheet)) current.sourceSheets.push(row.sourceSheet)
  grouped.set(row.word, current)
}

const conflictResolution = { '以上': 'Function Words', '一応': 'Descriptors' }
const metadata = Object.fromEntries([...grouped.entries()].map(([word, value]) => {
  const category = value.categories.length === 1 ? value.categories[0] : conflictResolution[word]
  if (!category) throw new Error(`Unresolved category conflict for ${word}: ${value.categories.join(', ')}`)
  return [word, { category, tags: value.tags }]
}).sort((a, b) => categoryOrder.indexOf(a[1].category) - categoryOrder.indexOf(b[1].category) || a[0].localeCompare(b[0], 'ja')))

const importedTagsByCategory = Object.fromEntries(categoryOrder.map(category => [category, [...new Set(Object.values(metadata).filter(record => record.category === category).flatMap(record => record.tags))]]))
const generatedSource = `// Generated from Japanese vocab categories and tags.xlsx on 2026-07-15.\n// Re-run the workbook import to replace this file; do not hand-edit individual records.\n\nexport const IMPORTED_VOCABULARY_METADATA = ${JSON.stringify(metadata, null, 2)} as const\n\nexport const IMPORTED_TAGS_BY_CATEGORY = ${JSON.stringify(importedTagsByCategory, null, 2)} as const\n\nexport type ImportedVocabularyCategory = keyof typeof IMPORTED_TAGS_BY_CATEGORY\n\nexport function normalizeImportedVocabularyWord(word: string) {\n  return word.replace(/\\s*\\([^)]*\\)\\s*/g, '').replace(/／/g, '/').trim()\n}\n\nexport function getImportedVocabularyMetadata(word: string) {\n  return IMPORTED_VOCABULARY_METADATA[normalizeImportedVocabularyWord(word) as keyof typeof IMPORTED_VOCABULARY_METADATA]\n}\n`
await fs.writeFile('C:/Users/Reed/kanji-quest/src/data/vocabularyMetadata.generated.ts', generatedSource, 'utf8')

process.chdir('C:/Users/Reed/kanji-quest')
const vite = await createServer({ root: 'C:/Users/Reed/kanji-quest', server: { middlewareMode: true }, appType: 'custom' })
const { allCards } = await vite.ssrLoadModule('/src/data/index.ts')
await vite.close()
const appVocabulary = allCards.filter(card => card.type === 'vocab')
const metadataWords = new Set(Object.keys(metadata))
const unmatchedWorkbookRows = workbookRows.filter(row => !appVocabulary.some(card => card.front === row.word))
const uncoveredAppRecords = appVocabulary.filter(card => !metadataWords.has(card.front))
const report = {
  workbookRows: workbookRows.length,
  explicitThreeColumnRows: workbookRows.filter(row => row.sourceSheet === 'Function Words').length - 122,
  twoColumnFunctionRows: 122,
  uniqueImportedWords: Object.keys(metadata).length,
  uniqueImportedTags: new Set(Object.values(metadata).flatMap(record => record.tags)).size,
  matchedWorkbookRows: workbookRows.length - unmatchedWorkbookRows.length,
  unmatchedWorkbookRows,
  appVocabularyRecords: appVocabulary.length,
  coveredAppRecords: appVocabulary.length - uncoveredAppRecords.length,
  uncoveredAppRecords: uncoveredAppRecords.map(card => ({ id: card.id, word: card.front, reading: card.reading ?? '', english: card.back })),
  categoryCounts: Object.fromEntries(categoryOrder.map(category => [category, Object.values(metadata).filter(record => record.category === category).length])),
}
await fs.writeFile(`${outputDir}/import-report.json`, JSON.stringify(report, null, 2), 'utf8')
console.log(JSON.stringify({ sheets: sheets.map(({ name, address, rows, cols }) => ({ name, address, rows, cols })), ...report, uncoveredAppRecords: `${uncoveredAppRecords.length} records` }, null, 2))
