import fs from 'node:fs/promises'
import { createServer } from 'file:///C:/Users/Reed/kanji-quest/node_modules/vite/dist/node/index.js'
import { SpreadsheetFile, Workbook } from '@oai/artifact-tool'

const repoRoot = 'C:/Users/Reed/kanji-quest'
const outputDir = `${repoRoot}/outputs/kanji-quest-vocabulary-20260715`
const outputPath = `${outputDir}/kanji-quest-vocabulary-list.xlsx`
process.chdir(repoRoot)

const vite = await createServer({ root: repoRoot, server: { middlewareMode: true }, appType: 'custom' })
const [{ allCards }, { classifyVocabularyCard }, taxonomy] = await Promise.all([
  vite.ssrLoadModule('/src/data/index.ts'),
  vite.ssrLoadModule('/src/lib/vocabularyClassifier.ts'),
  vite.ssrLoadModule('/src/data/tagTaxonomy.ts'),
])

const levelOrder = new Map(['N5', 'N4', 'N3', 'N2', 'N1'].map((level, index) => [level, index]))
const sourceRows = allCards.filter(card => card.type === 'vocab').map((card, index) => {
  const classification = classifyVocabularyCard(card)
  const word = {
    id: `catalog-${card.id}`,
    japanese: card.front,
    reading: card.reading ?? '',
    english: card.back || card.english || '',
    categories: [classification.category],
    tags: classification.tags,
    source: 'built-in',
  }
  const category = taxonomy.getWordTagGroup(word)
  const tags = taxonomy.normalizeTags(classification.tags).map(taxonomy.formatTagLabel)
  return {
    number: index + 1,
    japanese: card.front,
    reading: card.reading ?? '',
    english: card.back || card.english || '',
    jlpt: card.jlpt ?? 'Unrated',
    category,
    tags: tags.join(', '),
    sourceId: card.id,
    hint: card.hint ?? '',
  }
})
await vite.close()

const uniqueMap = new Map()
for (const row of sourceRows) {
  const key = `${row.japanese}|${row.reading}`
  const current = uniqueMap.get(key)
  if (!current) {
    uniqueMap.set(key, {
      japanese: row.japanese,
      reading: row.reading,
      english: new Set([row.english].filter(Boolean)),
      jlpt: new Set([row.jlpt].filter(Boolean)),
      categories: new Set([row.category]),
      tags: new Set(row.tags.split(', ').filter(Boolean)),
      sourceIds: [row.sourceId],
      count: 1,
    })
  } else {
    if (row.english) current.english.add(row.english)
    if (row.jlpt) current.jlpt.add(row.jlpt)
    current.categories.add(row.category)
    for (const tag of row.tags.split(', ').filter(Boolean)) current.tags.add(tag)
    current.sourceIds.push(row.sourceId)
    current.count += 1
  }
}

const uniqueRows = [...uniqueMap.values()].map((row, index) => ({
  number: index + 1,
  japanese: row.japanese,
  reading: row.reading,
  english: [...row.english].join(' / '),
  jlpt: [...row.jlpt].sort((a, b) => (levelOrder.get(a) ?? 99) - (levelOrder.get(b) ?? 99)).join(', '),
  category: [...row.categories].join(', '),
  tags: [...row.tags].join(', '),
  sourceIds: row.sourceIds.join(', '),
  count: row.count,
}))

const workbook = Workbook.create()
const summary = workbook.worksheets.add('Summary')
const allSheet = workbook.worksheets.add('All Records')
const uniqueSheet = workbook.worksheets.add('Unique Words')
const dark = '#173D32'
const green = '#2F6B52'
const pale = '#E5F0E9'
const cream = '#F7F5EF'
const line = '#D7DED9'
const muted = '#66756D'

summary.showGridLines = false
summary.getRange('A1:F1').merge()
summary.getRange('A1').values = [['Kanji Quest Vocabulary Collection']]
summary.getRange('A1:F1').format = { fill: dark, font: { bold: true, color: '#FFFFFF', size: 18 }, rowHeight: 34, verticalAlignment: 'center' }
summary.getRange('A2:F2').merge()
summary.getRange('A2').values = [['Complete source list plus a duplicate-cleaned view · generated July 15, 2026']]
summary.getRange('A2:F2').format = { fill: pale, font: { color: green, italic: true, size: 10 }, rowHeight: 24, verticalAlignment: 'center' }

summary.getRange('A4:B4').values = [['Collection metric', 'Count']]
summary.getRange('A5:A7').values = [['All vocabulary records'], ['Unique Japanese + reading pairs'], ['Duplicate records']]
summary.getRange('B5').formulas = [[`=COUNTA('All Records'!A2:A${sourceRows.length + 1})`]]
summary.getRange('B6').formulas = [[`=COUNTA('Unique Words'!A2:A${uniqueRows.length + 1})`]]
summary.getRange('B7').formulas = [['=B5-B6']]

summary.getRange('D4:E4').values = [['JLPT level', 'Records']]
summary.getRange('D5:D10').values = [['N5'], ['N4'], ['N3'], ['N2'], ['N1'], ['Unrated']]
summary.getRange('E5').formulas = [[`=COUNTIF('All Records'!E2:E${sourceRows.length + 1},D5)`]]
summary.getRange('E5:E10').fillDown()

summary.getRange('A10:B10').values = [['Assigned category', 'Records']]
summary.getRange('A11:A18').values = taxonomy.TAG_GROUPS.map(group => [group.name])
summary.getRange('B11').formulas = [[`=COUNTIF('All Records'!F2:F${sourceRows.length + 1},A11)`]]
summary.getRange('B11:B18').fillDown()
summary.getRange('D12:F15').merge()
summary.getRange('D12').values = [[
  'Notes\n• “All Records” preserves every source entry.\n• “Unique Words” consolidates repeated Japanese/reading pairs.\n• Categories and tags are automatic suggestions from the current Content Studio rules.\n• Device-local Reviewed Words are not embedded in the source export.',
]]
summary.getRange('D12:F15').format = { fill: cream, font: { color: muted, size: 9 }, wrapText: true, verticalAlignment: 'top', rowHeight: 24, borders: { preset: 'outside', style: 'thin', color: line } }

for (const rangeName of ['A4:B4', 'D4:E4', 'A10:B10']) {
  summary.getRange(rangeName).format = { fill: green, font: { bold: true, color: '#FFFFFF' }, rowHeight: 22 }
}
summary.getRange('A5:B7').format = { fill: '#FFFFFF', borders: { insideHorizontal: { style: 'thin', color: line }, bottom: { style: 'thin', color: line } } }
summary.getRange('D5:E10').format = { fill: '#FFFFFF', borders: { insideHorizontal: { style: 'thin', color: line }, bottom: { style: 'thin', color: line } } }
summary.getRange('A11:B18').format = { fill: '#FFFFFF', borders: { insideHorizontal: { style: 'thin', color: line }, bottom: { style: 'thin', color: line } } }
summary.getRange('B5:B7').format.numberFormat = '#,##0'
summary.getRange('E5:E10').format.numberFormat = '#,##0'
summary.getRange('B11:B18').format.numberFormat = '#,##0'
summary.getRange('A:A').format.columnWidth = 30
summary.getRange('B:B').format.columnWidth = 13
summary.getRange('C:C').format.columnWidth = 4
summary.getRange('D:D').format.columnWidth = 20
summary.getRange('E:E').format.columnWidth = 13
summary.getRange('F:F').format.columnWidth = 20

const allHeaders = ['#', 'Japanese', 'Reading', 'English', 'JLPT', 'Category', 'Automatic Tags', 'Source ID', 'Hint / Frequency']
const allValues = sourceRows.map(row => [row.number, row.japanese, row.reading, row.english, row.jlpt, row.category, row.tags, row.sourceId, row.hint])
allSheet.getRange(`A1:I${allValues.length + 1}`).values = [allHeaders, ...allValues]
const allTable = allSheet.tables.add(`A1:I${allValues.length + 1}`, true, 'AllVocabularyRecords')
allTable.style = 'TableStyleMedium4'

const uniqueHeaders = ['#', 'Japanese', 'Reading', 'English meaning(s)', 'JLPT level(s)', 'Category', 'Automatic Tags', 'Source IDs', 'Record Count']
const uniqueValues = uniqueRows.map(row => [row.number, row.japanese, row.reading, row.english, row.jlpt, row.category, row.tags, row.sourceIds, row.count])
uniqueSheet.getRange(`A1:I${uniqueValues.length + 1}`).values = [uniqueHeaders, ...uniqueValues]
const uniqueTable = uniqueSheet.tables.add(`A1:I${uniqueValues.length + 1}`, true, 'UniqueVocabularyWords')
uniqueTable.style = 'TableStyleMedium4'

for (const [sheet, rowCount] of [[allSheet, sourceRows.length], [uniqueSheet, uniqueRows.length]]) {
  sheet.showGridLines = false
  sheet.freezePanes.freezeRows(1)
  sheet.freezePanes.freezeColumns(2)
  sheet.getRange(`A1:I${rowCount + 1}`).format.verticalAlignment = 'top'
  sheet.getRange(`B2:I${rowCount + 1}`).format.wrapText = true
  sheet.getRange('A:A').format.columnWidth = 7
  sheet.getRange('B:B').format.columnWidth = 16
  sheet.getRange('C:C').format.columnWidth = 22
  sheet.getRange('D:D').format.columnWidth = 34
  sheet.getRange('E:E').format.columnWidth = 12
  sheet.getRange('F:F').format.columnWidth = 24
  sheet.getRange('G:G').format.columnWidth = 48
  sheet.getRange('H:H').format.columnWidth = 34
  sheet.getRange('I:I').format.columnWidth = 24
  sheet.getRange(`A2:A${rowCount + 1}`).format.numberFormat = '#,##0'
  sheet.getRange(`E2:E${rowCount + 1}`).conditionalFormats.add('containsText', { text: 'N5', format: { fill: '#E3F2E8', font: { color: '#24543E' } } })
  sheet.getRange(`E2:E${rowCount + 1}`).conditionalFormats.add('containsText', { text: 'N1', format: { fill: '#F5E7E4', font: { color: '#84483E' } } })
}
uniqueSheet.getRange(`I2:I${uniqueRows.length + 1}`).format.numberFormat = '#,##0'
uniqueSheet.getRange(`A2:I${uniqueRows.length + 1}`).format.fill = '#FFFFFF'
uniqueSheet.getRange(`A2:I${uniqueRows.length + 1}`).format.font = { color: '#203229' }
uniqueSheet.getRange(`A1:I1`).format = { fill: dark, font: { bold: true, color: '#FFFFFF' }, rowHeight: 24, verticalAlignment: 'center' }
uniqueSheet.getRange(`A2:I${uniqueRows.length + 1}`).format.borders = { insideHorizontal: { style: 'thin', color: '#E3E8E5' } }

await fs.mkdir(outputDir, { recursive: true })
const summaryCheck = await workbook.inspect({ kind: 'table', range: 'Summary!A1:F18', include: 'values,formulas', tableMaxRows: 20, tableMaxCols: 8 })
const allCheck = await workbook.inspect({ kind: 'table', range: 'All Records!A1:I8', include: 'values,formulas', tableMaxRows: 8, tableMaxCols: 9 })
const errors = await workbook.inspect({ kind: 'match', searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A', options: { useRegex: true, maxResults: 100 }, summary: 'final formula error scan' })
console.log(summaryCheck.ndjson)
console.log(allCheck.ndjson)
console.log(errors.ndjson)

for (const [sheetName, range, fileName] of [
  ['Summary', 'A1:F18', 'preview-summary.png'],
  ['All Records', 'A1:I24', 'preview-all-records.png'],
  ['Unique Words', 'A1:I24', 'preview-unique-words.png'],
]) {
  const preview = await workbook.render({ sheetName, range, scale: 1, format: 'png' })
  await fs.writeFile(`${outputDir}/${fileName}`, new Uint8Array(await preview.arrayBuffer()))
}

const output = await SpreadsheetFile.exportXlsx(workbook)
await output.save(outputPath)
console.log(JSON.stringify({ outputPath, records: sourceRows.length, uniqueWords: uniqueRows.length }))
