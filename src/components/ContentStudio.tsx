import { useEffect, useMemo, useState } from 'react'
import type React from 'react'
import { allCards } from '../data'
import { generatePreviewSentence } from '../lib/sentenceGeneratorPreview'
import { disableContentRecord, exportContentDatabase, loadContentDatabase, subscribeToContentDatabase, upsertContentRecord, upsertContentRecords } from '../lib/contentDatabase'
import type { ContentRecord } from '../lib/contentDatabase'
import type { JlptLevel } from '../lib/types'
import { loadActiveSentencePatternIds, saveActiveSentencePatternIds, sentencePatternCatalog } from '../data/sentencePatternCatalog'
import { addTagToGroup, formatTagLabel, getTagGroupTags, getUniversalTags, getWordTagGroup, normalizeTag, normalizeTags, saveWordTagGroup, suggestedTagsForWord, TAG_GROUPS } from '../data/tagTaxonomy'
import type { TagGroupName } from '../data/tagTaxonomy'
import { getAllCategoryWords, getPendingReviewWords, getSavedCategoryWordTags, saveCategoryWordTags } from '../lib/categorySentenceEngine'
import type { CategoryWordRecord } from '../lib/categorySentenceEngine'
import { getVocabularyMetadata } from '../data/vocabularySenseOverrides'
import { inferPreferredTranslation } from '../data/preferredVocabularyTranslations'
import { FuriganaSentence } from './FuriganaText'
import { complexityDetails, complexityForPattern, GENERATION_COMPLEXITIES, patternsForComplexity, type GenerationComplexity } from '../lib/generationComplexity'

type View = 'dashboard' | 'review' | 'verbs' | 'vocab' | 'categories' | 'patterns' | 'test'
type Draft = { id: number; sourceId?: string; type: 'Verb' | 'Vocabulary' | 'Pattern'; japanese: string; reading: string; english: string; preferredTranslation?: string; detail: string }
type CategoryPanel = TagGroupName | 'reviewed'

const categories = TAG_GROUPS.map(group=>group.name)
const patterns = sentencePatternCatalog.map(pattern => pattern.slots)
const QUEUE_KEY = 'kanji-quest-content-draft-queue-v1'
const APPROVED_KEY = 'kanji-quest-content-approved-v1'
const REJECTED_KEY = 'kanji-quest-content-rejected-v1'
const QA_FEEDBACK_KEY = 'kanji-quest-content-qa-feedback-v1'
const VOCABULARY_TEMPLATE = [
  'Japanese:',
  'Reading:',
  'Dictionary meaning:',
  'Preferred sentence translation:',
  'Category:',
  'JLPT level:',
  'Tags:',
  'Notes:',
].join('\n')

const BULK_REVIEW_EXAMPLE = [
  '# word | category | tags',
  '交番 | Places | Building, Public',
  '机 | Objects | Furniture, Desk',
  '牛乳 | Food & Drink | Drink, Milk',
  '看護師 | People & Living Things | Person, Occupation, Nurse',
  '自転車 | Objects | Vehicle, Bicycle',
].join('\n')

const VOCABULARY_PHILOSOPHY = [
  ['Preferred sentence translation', 'The clean English the sentence generator should use. Keep the full dictionary meaning for study, but choose one natural sentence meaning here.'],
  ['Category', 'The slot the word is allowed to fill: person, place, object, food, time, descriptor, action, or function word.'],
  ['Tags', 'The logic inside the category. Tags keep combinations natural, such as readable, edible, destination, clock-time, student, teacher, or medical.'],
  ['Rule of thumb', 'Category decides where a word can go. Tags decide whether it actually makes sense there.'],
] as const

type TemplateVocabularyEntry = {
  japanese: string
  reading: string
  english: string
  preferredTranslation: string
  category: string
  jlpt: JlptLevel
  tags: string[]
}

type TemplateVocabularyInput = {
  index: number
  japanese: string
  reading: string
  english: string
  preferredTranslation: string
  requestedCategory: string
  requestedJlpt: string
  rawTags: string[]
  tags: string[]
}

type TemplateValidation = {
  input: TemplateVocabularyInput
  entry?: TemplateVocabularyEntry
  errors: string[]
  warnings: string[]
}

type QaFeedbackBatch = {
  id: string
  createdAt: string
  feedback: string
}

type CandidateWord = {
  japanese: string
  reading: string
  english: string
  preferredTranslation: string
  jlpt: string
  tags: string
}

/**
 * Duplicate key for a vocabulary word. Matches on the Japanese word alone: the
 * seed data stores readings inconsistently (romaji vs kana, ambiguous long
 * vowels like "byoin"/"byouin"), so a reading-based key cannot reliably catch
 * words that already exist. This mirrors the old word-gap check.
 */
function vocabDedupeKey(japanese: string): string {
  return japanese.trim()
}

function parseTemplateVocabularyInputs(value: string): TemplateVocabularyInput[] {
  const blocks = value.split(/(?=^Japanese\s*:)/im).filter(block => /^Japanese\s*:/im.test(block))
  return blocks.map((block, index) => {
    const fields = new Map<string, string>()
    block.split(/\r?\n/).forEach(line => {
      const match = /^([^:]+):\s*(.*)$/.exec(line)
      if (match) fields.set(match[1]!.trim().toLowerCase(), match[2]!.trim())
    })
    const rawTags = (fields.get('tags') ?? '').split(',').map(tag => tag.trim()).filter(Boolean)
    return {
      index: index + 1,
      japanese: fields.get('japanese') ?? '',
      reading: fields.get('reading') ?? '',
      english: fields.get('dictionary meaning') ?? '',
      preferredTranslation: fields.get('preferred sentence translation') ?? '',
      requestedCategory: fields.get('category') ?? '',
      requestedJlpt: fields.get('jlpt level') ?? '',
      rawTags,
      tags: normalizeTags(rawTags),
    }
  })
}

function validateTemplateVocabulary(value: string, knownTags: Set<string>, existingKeys: Set<string>) {
  const seenKeys = new Set<string>()
  return parseTemplateVocabularyInputs(value)
    .filter(input => [input.japanese, input.reading, input.english, input.preferredTranslation, input.requestedCategory, input.requestedJlpt, ...input.rawTags].some(Boolean))
    .map((input): TemplateValidation => {
    const errors: string[] = []
    const warnings: string[] = []
    if (!input.japanese) errors.push('Japanese is required.')
    if (!input.reading) errors.push('Reading is required.')
    if (!input.english) errors.push('Dictionary meaning is required.')

    const key = vocabDedupeKey(input.japanese)
    if (input.japanese && existingKeys.has(key)) errors.push('This word is already in the database.')
    if (input.japanese && seenKeys.has(key)) errors.push('This entry is duplicated in this paste.')
    if (input.japanese) seenKeys.add(key)

    const categoryIsKnown = (categories as readonly string[]).includes(input.requestedCategory)
    const levelIsKnown = ['N5', 'N4', 'N3', 'N2', 'N1'].includes(input.requestedJlpt)
    if (!input.requestedCategory) warnings.push(`Category will default to ${inferCategory(input.english)}.`)
    else if (!categoryIsKnown) warnings.push(`Unknown category will default to ${inferCategory(input.english)}.`)
    if (!input.requestedJlpt) warnings.push('JLPT level will default to N5.')
    else if (!levelIsKnown) warnings.push('Unknown JLPT level will default to N5.')
    if (!input.preferredTranslation) warnings.push('Preferred sentence translation will be auto-selected.')
    if (!input.tags.length) warnings.push('No tags supplied yet.')

    const normalizedRawTags = input.rawTags.map(normalizeTag).filter(Boolean)
    if (new Set(normalizedRawTags).size !== normalizedRawTags.length) warnings.push('Duplicate tags will be collapsed.')
    const levelTags = input.tags.filter(tag => /^n[1-5]$/.test(tag))
    if (levelTags.length) warnings.push(`Remove ${levelTags.join(', ')} from tags; JLPT already stores the level.`)
    const frequencyTags = input.tags.filter(tag => ['common', 'very-common', 'rare'].includes(tag))
    if (frequencyTags.length > 1) warnings.push('Choose one frequency tag: very-common, common, or rare.')
    const originTags = input.tags.filter(tag => ['loanword', 'native-japanese', 'sino-japanese'].includes(tag))
    if (originTags.length > 1) warnings.push('Choose one primary word-origin tag.')
    const registerTags = input.tags.filter(tag => ['casual', 'polite', 'formal'].includes(tag))
    if (registerTags.length > 1) warnings.push('Usually choose one register tag: casual, polite, or formal.')
    if (input.tags.includes('body') && input.tags.includes('body-part')) warnings.push('body is usually redundant when body-part is present.')
    const unknownTags = input.tags.filter(tag => !knownTags.has(tag))
    if (unknownTags.length) warnings.push(`Custom tags to review: ${unknownTags.join(', ')}.`)

    const entry = !errors.length ? {
      japanese: input.japanese,
      reading: input.reading,
      english: input.english,
      preferredTranslation: input.preferredTranslation,
      category: categoryIsKnown ? input.requestedCategory : inferCategory(input.english),
      jlpt: levelIsKnown ? input.requestedJlpt as JlptLevel : 'N5',
      tags: input.tags.filter(tag => !/^n[1-5]$/.test(tag)),
    } : undefined
    return { input, entry, errors, warnings }
    })
}

function loadJson<T>(key: string, fallback: T): T {
  try { const value = window.localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback } catch { return fallback }
}

function inferCategory(english: string) {
  const value = english.toLowerCase()
  if (/^to\s|\b(shopping|exercise|walk|game|practice)\b/.test(value)) return 'Actions'
  if (/person|teacher|student|friend|mother|father|woman|man|boy|girl|animal|plant/.test(value)) return 'People & Living Things'
  if (/tea|coffee|water|juice|milk|drink|food|rice|bread|meat|fish|fruit/.test(value)) return 'Food & Drink'
  if (/\b(station|school|store|shop|room|house|park|place|restaurant|hotel|country|city)\b/.test(value)) return 'Places'
  if (/today|tomorrow|yesterday|morning|night|week|month|year|time|number|counter/.test(value)) return 'Time & Numbers'
  if (/particle|conjunction|pronoun|auxiliary|expression/.test(value)) return 'Function Words'
  if (/adjective|adverb|happy|sad|fast|slow|beautiful|difficult/.test(value)) return 'Descriptors'
  return 'Objects'
}

/** A deliberately small, copy-friendly format for candidate vocabulary. */
function parseCandidateWords(value: string) {
  const words: CandidateWord[] = []
  const problems: string[] = []
  value.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim()
    if (!line || line.startsWith('#')) return
    const [japanese = '', reading = '', english = '', preferredTranslation = '', jlpt = '', tags = ''] = line.split('|').map(part => part.trim())
    if (!japanese || !reading || !english) {
      problems.push(`Line ${index + 1} needs Japanese | reading | dictionary meaning.`)
      return
    }
    words.push({ japanese, reading, english, preferredTranslation, jlpt, tags })
  })
  return { words, problems }
}

function candidateWordsToTemplates(words: CandidateWord[]) {
  return words.map(word => [
    `Japanese: ${word.japanese}`,
    `Reading: ${word.reading}`,
    `Dictionary meaning: ${word.english}`,
    `Preferred sentence translation: ${word.preferredTranslation}`,
    `Category: ${inferCategory(word.english)}`,
    `JLPT level: ${['N5', 'N4', 'N3', 'N2', 'N1'].includes(word.jlpt) ? word.jlpt : 'N5'}`,
    `Tags: ${word.tags}`,
    'Notes:',
  ].join('\n')).join('\n\n')
}

function inferVerbClass(japanese: string) {
  if (japanese.endsWith('する') || japanese === '来る') return 'Irregular'
  if (japanese.endsWith('る')) return 'Ichidan candidate'
  const names: Record<string, string> = { う: 'Godan -u', く: 'Godan -ku', ぐ: 'Godan -gu', す: 'Godan -su', つ: 'Godan -tsu', ぬ: 'Godan -nu', ぶ: 'Godan -bu', む: 'Godan -mu' }
  return names[[...japanese].at(-1) ?? ''] ?? 'Needs class review'
}

function contentRecordFromDraft(draft: Draft): ContentRecord {
  const jlpt = draft.detail.match(/N[1-5]/)?.[0] as JlptLevel | undefined
  const inferred = draft.type === 'Verb' ? 'Actions' : draft.detail.split(' · ')[0]
  const now = new Date().toISOString()
  return { id: draft.sourceId ?? `generated-${draft.id}`, sourceId: draft.sourceId, kind: draft.type === 'Verb' ? 'verb' : draft.type === 'Pattern' ? 'pattern' : 'vocabulary', japanese: draft.japanese, reading: draft.reading, english: draft.english, preferredTranslation:draft.type === 'Vocabulary' ? draft.preferredTranslation?.trim() || inferPreferredTranslation(draft.japanese,draft.english,draft.reading) : undefined, jlpt, category: inferred, categories: [inferred], tags: [inferred.toLowerCase()], status: 'approved', source: draft.sourceId ? 'kanji-quest' : 'generated', verbClass: draft.type === 'Verb' ? draft.detail.split(' · ')[0] : undefined, transitivity: draft.type === 'Verb' ? 'transitive' : undefined, allowedRoles: draft.type === 'Verb' ? ['Verb'] : [inferred], approvedAt: now, updatedAt: now }
}

function wordKey(word: Pick<CategoryWordRecord, 'japanese' | 'reading'>) {
  return `${word.japanese}|${word.reading}`
}

function reviewedContentRecord(word: CategoryWordRecord, tags: string[], group: TagGroupName, database: ContentRecord[], preferredTranslation=word.preferredTranslation): ContentRecord {
  const approvedRecordId = word.id.startsWith('approved-') ? word.id.slice('approved-'.length) : undefined
  const catalogSourceId = word.id.startsWith('catalog-') ? word.id.slice('catalog-'.length) : undefined
  const existing = database.find(record => record.kind === 'vocabulary' && (
    record.id === approvedRecordId ||
    Boolean(catalogSourceId && record.sourceId === catalogSourceId) ||
    (record.japanese === word.japanese && record.reading === word.reading)
  ))
  const now = new Date().toISOString()
  const stableId = word.id.replace(/^(catalog|approved)-/, '')
  return {
    id: existing?.id ?? `reviewed-${stableId}`,
    sourceId: existing?.sourceId ?? catalogSourceId ?? `seed:${stableId}`,
    kind: 'vocabulary',
    japanese: word.japanese,
    reading: word.reading,
    english: word.english,
    preferredTranslation:preferredTranslation.trim() || existing?.preferredTranslation || inferPreferredTranslation(word.japanese,word.english,word.reading),
    jlpt: existing?.jlpt ?? word.jlpt,
    category: group,
    categories: [group],
    tags: normalizeTags(tags),
    status: 'approved',
    source: existing?.source ?? 'kanji-quest',
    allowedRoles: [group],
    approvedAt: existing?.approvedAt ?? now,
    reviewedAt: existing?.reviewedAt ?? now,
    updatedAt: now,
  }
}

const nav: { id: View; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '⌂' }, { id: 'review', label: 'Draft Review', icon: '✓' },
  { id: 'verbs', label: 'Verb Editor', icon: '動' }, { id: 'vocab', label: 'Vocabulary Editor', icon: '語' },
  { id: 'categories', label: 'Category Editor', icon: '類' }, { id: 'patterns', label: 'Sentence Patterns', icon: '文' },
  { id: 'test', label: 'Test Generator', icon: '▶' },
]

function Slots({ items }: { items: string[] }) {
  return <div className="cs-slots">{items.map((x, i) => <span className={x.length > 2 ? 'slot' : 'particle'} key={`${x}${i}`}>{x}</span>)}</div>
}
function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <label className={`cs-field${wide ? ' wide' : ''}`}><span>{label}</span>{children}</label>
}

function generateTestSentence(complexities: GenerationComplexity[], turn: number) {
  const complexity=complexities[turn % complexities.length]!
  const complexityTurn=Math.floor(turn / complexities.length)
  const allPatterns=patternsForComplexity(complexity)
  const executablePatterns=allPatterns.filter(pattern=>pattern.generatorReady)
  const patterns=executablePatterns.length ? executablePatterns : allPatterns
  const requestedFrame=patterns[complexityTurn % patterns.length]!
  return generatePreviewSentence(requestedFrame.jlpt,turn+1,undefined,requestedFrame.id,true)
}

function TestSentenceText({ sentence, showFurigana }: { sentence: ReturnType<typeof generatePreviewSentence>; showFurigana: boolean }) {
  if (!showFurigana || !sentence.furigana.length) return <>{sentence.japanese}</>
  return <FuriganaSentence segments={sentence.furigana.map(part=>part.text)} readings={sentence.furigana.map(part=>part.slot&&part.reading!==part.text?part.reading:undefined)} />
}

function CategoryWordTagRow({ word, onSave, onTaxonomyChange }: { word: CategoryWordRecord; onSave: (word: CategoryWordRecord, tags: string[], group: TagGroupName, preferredTranslation: string) => void; onTaxonomyChange: () => void }) {
  const [tagText, setTagText] = useState(word.tags.join(', '))
  const [tagGroup, setTagGroup] = useState<TagGroupName>(()=>getWordTagGroup(word))
  const [preferredTranslation,setPreferredTranslation] = useState(word.preferredTranslation)
  const [newGroupTag, setNewGroupTag] = useState('')
  const parsedTags = normalizeTags(tagText.split(','))
  const suggestions = suggestedTagsForWord(word, tagGroup)
  const universalTags = getUniversalTags()
  const toggleSuggestion = (tag: string) => setTagText(normalizeTags(parsedTags.includes(tag) ? parsedTags.filter(item=>item!==tag) : [...parsedTags,tag]).join(', '))
  const createGroupTag = () => {
    const added = addTagToGroup(tagGroup, newGroupTag)
    if (!added) return
    setTagText(normalizeTags([...parsedTags,added]).join(', '))
    setNewGroupTag('')
    onTaxonomyChange()
  }
  return <article className="category-word-row">
    <div className="category-word-main"><b>{word.japanese}</b><span>{word.reading}</span></div>
    <div className="category-word-english"><b>{word.english}</b><span>Dictionary · {tagGroup}</span><label><span>Preferred for sentences</span><input aria-label={`Preferred sentence translation for ${word.japanese}`} value={preferredTranslation} onChange={event=>setPreferredTranslation(event.target.value)} /></label></div>
    <div className="category-tag-editor"><div className="tag-category-control"><label><span>Category</span><select aria-label={`Category for ${word.japanese}`} value={tagGroup} onChange={event=>setTagGroup(event.target.value as TagGroupName)}>{TAG_GROUPS.map(group=><option key={group.name}>{group.name}</option>)}</select></label><small>Automatically assigned from the word’s meaning. Changing it affects only this word.</small></div><div className="category-suggestions"><small>Suggested tags</small>{suggestions.map(tag=><button key={tag} type="button" className={parsedTags.includes(tag)?'active':''} aria-pressed={parsedTags.includes(tag)} onClick={()=>toggleSuggestion(tag)}>+ {formatTagLabel(tag)}</button>)}</div><details className="universal-tag-picker"><summary>Universal tags</summary><div>{universalTags.map(tag=><button key={tag} type="button" className={parsedTags.includes(tag)?'active':''} aria-pressed={parsedTags.includes(tag)} onClick={()=>toggleSuggestion(tag)}>+ {formatTagLabel(tag)}</button>)}</div></details><div className="category-tag-preview">{parsedTags.length ? parsedTags.map(tag=><span key={tag}>{formatTagLabel(tag)}</span>) : <em>No tags selected</em>}</div><input aria-label={`Tags for ${word.japanese}`} value={tagText} onChange={event=>setTagText(event.target.value)} placeholder="Assigned tags, separated by commas" /><div className="category-add-tag"><input aria-label={`New ${tagGroup} tag`} value={newGroupTag} onChange={event=>setNewGroupTag(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();createGroupTag()}}} placeholder={`New tag for ${tagGroup}`} /><button type="button" onClick={createGroupTag} disabled={!newGroupTag.trim()}>Add to category</button></div><small className="tag-normalization-note">New tags become available to other words in this category. Aliases normalize automatically: friends → friend.</small></div>
    <button className="ghost" type="button" onClick={()=>onSave(word, parsedTags, tagGroup, preferredTranslation)}>Save word</button>
  </article>
}

export function ContentStudio({ onBack }: { onBack: () => void }) {
  const [view, setView] = useState<View>('dashboard')
  const [drafts, setDrafts] = useState<Draft[]>(() => loadJson(QUEUE_KEY, []))
  const [approvedIds, setApprovedIds] = useState<string[]>(() => loadJson(APPROVED_KEY, []))
  const [rejectedIds, setRejectedIds] = useState<string[]>(() => loadJson(REJECTED_KEY, []))
  const [batchSize, setBatchSize] = useState(10)
  const [batchLevel, setBatchLevel] = useState('All')
  const [patternComplexities, setPatternComplexities] = useState<GenerationComplexity[]>([1, 2, 3, 4, 5])
  const [activePatternIds, setActivePatternIds] = useState<string[]>(() => loadActiveSentencePatternIds())
  const [testComplexities, setTestComplexities] = useState<GenerationComplexity[]>([1])
  const [vocabPrimaryCategory, setVocabPrimaryCategory] = useState<string>('Objects')
  const [managedTagGroup, setManagedTagGroup] = useState<CategoryPanel | null>(null)
  const [reviewedCategory, setReviewedCategory] = useState<TagGroupName | 'All'>('All')
  const [categorySearch, setCategorySearch] = useState('')
  const [tagRevision, setTagRevision] = useState(0)
  const [notice, setNotice] = useState('')
  const [furigana, setFurigana] = useState(true)
  const [english, setEnglish] = useState(true)
  const [sample, setSample] = useState(0)
  const [testBatchOpen, setTestBatchOpen] = useState(false)
  const [testBatchSeed, setTestBatchSeed] = useState(0)
  const [bulkReviewDraft, setBulkReviewDraft] = useState('')
  const [bulkReviewReport, setBulkReviewReport] = useState('')
  const [vocabTemplateDraft, setVocabTemplateDraft] = useState(VOCABULARY_TEMPLATE)
  const [vocabImportDraft, setVocabImportDraft] = useState(VOCABULARY_TEMPLATE)
  const [candidateWordDraft, setCandidateWordDraft] = useState('')
  const [qaBatchSeed, setQaBatchSeed] = useState(0)
  const [qaFeedbackDraft, setQaFeedbackDraft] = useState('')
  const [qaFeedbackBatches, setQaFeedbackBatches] = useState<QaFeedbackBatch[]>(() => loadJson(QA_FEEDBACK_KEY, []))
  const [database, setDatabase] = useState<ContentRecord[]>(() => loadContentDatabase())
  const allCategoryWords = useMemo(() => {
    // Both values invalidate this view after local vocabulary or tag storage changes.
    void database
    void tagRevision
    // Pending-review words are appended so the study-only decks can actually be
    // reviewed here. They are excluded from the generator until approved, which
    // is the point: this screen is how they get in.
    const admitted = getAllCategoryWords()
    const admittedKeys = new Set(admitted.map(wordKey))
    return [...admitted, ...getPendingReviewWords().filter(word => !admittedKeys.has(wordKey(word)))]
  }, [database, tagRevision])
  const reviewedKeys = useMemo(() => new Set(database
    .filter(record => record.kind === 'vocabulary' && Boolean(record.reviewedAt))
    .map(record => `${record.japanese}|${record.reading}`)), [database])
  const reviewedWords = useMemo(() => allCategoryWords.filter(word => reviewedKeys.has(wordKey(word))), [allCategoryWords, reviewedKeys])
  const unreviewedWords = useMemo(() => allCategoryWords.filter(word => !reviewedKeys.has(wordKey(word))), [allCategoryWords, reviewedKeys])
  const managedWords = useMemo(() => {
    const search = categorySearch.trim().toLowerCase()
    const words = managedTagGroup === 'reviewed'
      ? reviewedCategory === 'All' ? reviewedWords : reviewedWords.filter(word => getWordTagGroup(word) === reviewedCategory)
      : managedTagGroup
        ? unreviewedWords.filter(word => getWordTagGroup(word) === managedTagGroup)
        : []
    if (!search) return words
    return words.filter(word => [word.japanese, word.reading, word.english, word.preferredTranslation, ...word.tags].some(value => value.toLowerCase().includes(search)))
  }, [managedTagGroup, reviewedCategory, categorySearch, reviewedWords, unreviewedWords])
  const generatedTest = useMemo(() => {
    // The generator reads approved records from local storage; this state reference
    // invalidates the preview immediately after the database emits a change.
    void database
    return generateTestSentence(testComplexities,sample)
  }, [sample, database, testComplexities])
  const generatedTestBatch = useMemo(() => {
    void database
    const start=(testBatchSeed+1)*100
    return Array.from({length:10},(_,index)=>generateTestSentence(testComplexities,start+index))
  },[testBatchSeed,database,testComplexities])
  const qaSentences = useMemo(() => {
    void database
    const start = 5000 + qaBatchSeed * 30
    return Array.from({ length: 20 }, (_, index) => generateTestSentence([1, 2, 3, 4, 5], start + index))
  }, [qaBatchSeed, database])
  const qaPacket = useMemo(() => [
    '# Kanji Quest sentence QA batch',
    '# Check Japanese naturalness, English, semantic compatibility, and repetition.',
    '# Reply with the sentence number plus a short issue and suggested fix. Leave good sentences out.',
    '',
    ...qaSentences.flatMap((sentence, index) => [
      `${String(index + 1).padStart(2, '0')}. ${sentence.japanese}`,
      `English: ${sentence.english}`,
      `Pattern: ${sentence.frameId} · ${sentence.level}`,
      '',
    ]),
  ].join('\n'), [qaSentences])
  const allVocabularyTags = useMemo(() => {
    void tagRevision
    const grouped = TAG_GROUPS.map(group => `${group.name}: ${getTagGroupTags(group.name).join(', ')}`)
    return [...grouped, `Universal: ${getUniversalTags().join(', ')}`].join('\n')
  }, [tagRevision])
  const knownVocabularyTags = useMemo(() => {
    void tagRevision
    return new Set(normalizeTags([
      ...TAG_GROUPS.flatMap(group => getTagGroupTags(group.name)),
      ...getUniversalTags(),
    ]))
  }, [tagRevision])
  const stagedVocabulary = useMemo(() => database.filter(record => record.kind === 'vocabulary' && record.status === 'draft'), [database])
  const vocabularyValidation = useMemo(() => {
    // Duplicate detection covers both the built-in seed vocabulary and the
    // runtime content database, so this box subsumes the word-gap check.
    const existingKeys = new Set([
      ...allCards.filter(card => card.type === 'vocab').map(card => vocabDedupeKey(card.front)),
      ...database.filter(record => record.kind === 'vocabulary').map(record => vocabDedupeKey(record.japanese)),
    ])
    return validateTemplateVocabulary(vocabImportDraft, knownVocabularyTags, existingKeys)
  }, [database, knownVocabularyTags, vocabImportDraft])
  const readyToStageEntries = useMemo(() => vocabularyValidation.flatMap(result => result.entry ? [result.entry] : []), [vocabularyValidation])
  const toast = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(''), 1800) }
  const copyText = async (text: string, message: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast(message)
    } catch {
      toast('Copy failed; select the text manually')
    }
  }
  const title = nav.find(n => n.id === view)?.label
  useEffect(() => window.localStorage.setItem(QUEUE_KEY, JSON.stringify(drafts)), [drafts])
  useEffect(() => window.localStorage.setItem(APPROVED_KEY, JSON.stringify(approvedIds)), [approvedIds])
  useEffect(() => window.localStorage.setItem(REJECTED_KEY, JSON.stringify(rejectedIds)), [rejectedIds])
  useEffect(() => window.localStorage.setItem(QA_FEEDBACK_KEY, JSON.stringify(qaFeedbackBatches.slice(0, 12))), [qaFeedbackBatches])
  useEffect(() => subscribeToContentDatabase(setDatabase), [])
  useEffect(() => {
    const recordsToSave = allCategoryWords.flatMap(word => {
      if (reviewedKeys.has(wordKey(word))) return []
      const savedTags = getSavedCategoryWordTags(word.id)
      const imported = getVocabularyMetadata(word.japanese,word.reading)
      if (!savedTags && !imported) return []
      const tags = savedTags ?? word.tags
      const group = savedTags ? getWordTagGroup(word) : imported!.category
      return [reviewedContentRecord(word, tags, group, database)]
    })
    if (recordsToSave.length) upsertContentRecords(recordsToSave)
  }, [allCategoryWords, database, reviewedKeys])
  useEffect(() => {
    const storedSourceIds = new Set(database.flatMap(record => record.sourceId ? [record.sourceId] : []))
    const missing = approvedIds.filter(id => !storedSourceIds.has(id))
    for (const id of missing) {
      const card = allCards.find(item => item.id === id)
      if (!card) continue
      const isVerb = /^to\s/i.test(card.back)
      upsertContentRecord(contentRecordFromDraft({ id: Date.now(), sourceId: card.id, type: isVerb ? 'Verb' : 'Vocabulary', japanese: card.front, reading: card.reading ?? 'Reading needed', english: card.back, detail: isVerb ? `${inferVerbClass(card.front)} · ${card.jlpt ?? 'Unrated'}` : `${inferCategory(card.back)} · ${card.jlpt ?? 'Unrated'}` }))
    }
  }, [approvedIds, database])

  function approveDraft(draft: Draft) {
    upsertContentRecord(contentRecordFromDraft(draft))
    setDrafts(current => current.filter(item => item.id !== draft.id))
    if (draft.sourceId) setApprovedIds(ids => [...new Set([...ids, draft.sourceId!])])
    toast('Approved and added to sentence data ✓')
  }

  function saveReviewedWord(record: CategoryWordRecord, tags: string[], group: TagGroupName, preferredTranslation: string) {
    saveCategoryWordTags(record.id, tags)
    saveWordTagGroup(record.id, group)
    upsertContentRecord(reviewedContentRecord(record, tags, group, database, preferredTranslation))
    setTagRevision(value => value + 1)
    toast(`${record.japanese} saved to Reviewed Words ✓`)
  }

  /**
   * Bulk equivalent of reviewing words one row at a time. Reviewing 700+ words
   * through individual forms is the real barrier, so this accepts the same
   * decisions pasted as lines: `word | category | tag, tag, tag`. Everything
   * routes through saveReviewedWord, so a pasted review is indistinguishable
   * from a hand-reviewed one.
   */
  function applyBulkReview() {
    const known = new Map(allCategoryWords.map(word => [word.japanese, word]))
    const groupNames = TAG_GROUPS.map(group => group.name as TagGroupName)
    const applied: string[] = []
    const problems: string[] = []

    for (const rawLine of bulkReviewDraft.split('\n')) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) continue
      const [japanese, categoryText, tagText] = line.split('|').map(part => part.trim())
      if (!japanese || !categoryText) { problems.push(`${line} — needs "word | category | tags"`); continue }
      const word = known.get(japanese)
      if (!word) { problems.push(`${japanese} — not a word in this deck`); continue }
      const group = groupNames.find(name => name.toLowerCase() === categoryText.toLowerCase())
      if (!group) { problems.push(`${japanese} — unknown category "${categoryText}"`); continue }
      const tags = (tagText ?? '').split(',').map(tag => tag.trim()).filter(Boolean)
      if (!tags.length) { problems.push(`${japanese} — no tags given`); continue }
      saveReviewedWord(word, tags, group, word.preferredTranslation)
      applied.push(japanese)
    }

    setBulkReviewReport(
      problems.length
        ? `Saved ${applied.length}. Skipped ${problems.length}:\n${problems.join('\n')}`
        : `Saved all ${applied.length} words ✓`,
    )
    if (applied.length) setBulkReviewDraft('')
  }

  function generateBatch() {
    const queuedIds = drafts.flatMap(d => d.sourceId ? [d.sourceId] : [])
    const unavailable = new Set([...approvedIds, ...rejectedIds, ...queuedIds])
    const candidates = allCards.filter(card => card.type === 'vocab' && !unavailable.has(card.id) && (batchLevel === 'All' || card.jlpt === batchLevel))
    const offset = Math.floor(Math.random() * Math.max(1, candidates.length - batchSize))
    const selected = [...candidates.slice(offset), ...candidates.slice(0, offset)].slice(0, batchSize)
    const generated = selected.map((card, index): Draft => {
      const isVerb = /^to\s/i.test(card.back)
      return { id: Date.now() + index, sourceId: card.id, type: isVerb ? 'Verb' : 'Vocabulary', japanese: card.front, reading: card.reading ?? 'Reading needed', english: card.back, preferredTranslation:isVerb ? undefined : inferPreferredTranslation(card.front,card.back,card.reading), detail: isVerb ? `${inferVerbClass(card.front)} · ${card.jlpt ?? 'Unrated'} · class needs approval` : `${inferCategory(card.back)} · ${card.jlpt ?? 'Unrated'} · category inferred` }
    })
    if (!generated.length) { toast('No unseen records match this filter'); return }
    setDrafts(current => [...current, ...generated])
    toast(`Generated ${generated.length} real drafts`)
  }

  function togglePattern(id: string) {
    const next = activePatternIds.includes(id) ? activePatternIds.filter(patternId => patternId !== id) : [...activePatternIds, id]
    setActivePatternIds(next)
    saveActiveSentencePatternIds(next)
    toast(next.includes(id) ? 'Pattern activated ✓' : 'Pattern removed from rotation')
  }

  function togglePatternComplexity(complexity: GenerationComplexity) {
    setPatternComplexities(current => current.includes(complexity)
      ? current.length === 1 ? current : current.filter(item => item !== complexity)
      : [...current, complexity])
  }

  function toggleTestComplexity(complexity: GenerationComplexity) {
    setTestComplexities(current => current.includes(complexity)
      ? current.length === 1 ? current : current.filter(item => item !== complexity)
      : [...current, complexity])
    setSample(value => value + 1)
  }

  function prepareCandidateImport() {
    const { words, problems } = parseCandidateWords(candidateWordDraft)
    if (!words.length) {
      toast(problems[0] ?? 'Paste at least one candidate word first')
      return
    }
    setVocabImportDraft(candidateWordsToTemplates(words))
    setView('vocab')
    toast(`Prepared ${words.length} candidate ${words.length === 1 ? 'word' : 'words'} for validation${problems.length ? ` · ${problems.length} line${problems.length === 1 ? '' : 's'} skipped` : ''}`)
  }

  function saveQaFeedback() {
    const feedback = qaFeedbackDraft.trim()
    if (!feedback) { toast('Paste the correction feedback first'); return }
    setQaFeedbackBatches(current => [{ id: `${Date.now()}`, createdAt: new Date().toISOString(), feedback }, ...current].slice(0, 12))
    setQaFeedbackDraft('')
    toast('Correction batch saved in this browser')
  }

  function saveVocabulary(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const japanese = String(form.get('japanese') ?? '').trim()
    const reading = String(form.get('reading') ?? '').trim()
    const english = String(form.get('english') ?? '').trim()
    const preferredTranslation = String(form.get('preferredTranslation') ?? '').trim() || inferPreferredTranslation(japanese,english,reading)
    const jlpt = String(form.get('jlpt') ?? 'N5') as JlptLevel
    const tags = normalizeTags(String(form.get('tags') ?? '').split(','))
    if (!japanese || !reading || !english) { toast('Japanese, reading, and English are required'); return }
    const selectedCategories = [vocabPrimaryCategory]
    const now = new Date().toISOString()
    upsertContentRecord({ id:`manual-${Date.now()}`, kind:'vocabulary', japanese, reading, english, preferredTranslation, jlpt, category:vocabPrimaryCategory, categories:selectedCategories, tags, status:'draft', source:'manual', allowedRoles:selectedCategories, updatedAt:now })
    event.currentTarget.reset()
    setVocabPrimaryCategory('Objects')
    toast('Vocabulary saved to staging for review')
  }

  function exportVocabularyList() {
    const vocabulary = new Map<string, { japanese: string; reading: string; meaning: string; jlpt: string }>()
    const addWord = (japanese: string, reading: string | undefined, meaning: string, jlpt: string | undefined) => {
      const normalizedJapanese = japanese.trim()
      const normalizedReading = reading?.trim() ?? ''
      if (!normalizedJapanese) return
      const key = `${normalizedJapanese}|${normalizedReading}`
      if (!vocabulary.has(key)) vocabulary.set(key, {
        japanese: normalizedJapanese,
        reading: normalizedReading,
        meaning: meaning.trim(),
        jlpt: jlpt ?? '',
      })
    }

    allCards.filter(card => card.type === 'vocab').forEach(card => addWord(card.front, card.reading, card.back, card.jlpt))
    database.filter(record => record.kind === 'vocabulary').forEach(record => addWord(record.japanese, record.reading, record.english, record.jlpt))

    const csvCell = (value: string) => `"${value.replace(/"/g, '""')}"`
    const rows = [...vocabulary.values()]
      .sort((a, b) => a.japanese.localeCompare(b.japanese, 'ja'))
      .map(word => [word.japanese, word.reading, word.meaning, word.jlpt].map(csvCell).join(','))
    const csv = ['Japanese,Reading,Meaning,JLPT', ...rows].join('\n')
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `kanji-quest-vocabulary-list-${new Date().toISOString().slice(0, 10)}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
    toast(`Exported ${vocabulary.size} vocabulary words`)
  }

  /**
   * Writes the reviewed database out in the shape src/data/seedContentDatabase.json
   * expects. Reviewed words otherwise live only in one browser's localStorage,
   * which means they are invisible to other machines and to build scripts such
   * as generate:vocab-examples. Saving this file into the repo makes the review
   * work portable and version-controlled.
   */
  function exportSeedDatabase() {
    const records = database.filter(record => record.status === 'approved' || record.reviewedAt)
    const json = JSON.stringify({ version: 1, records }, null, 2)
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'seedContentDatabase.json'
    anchor.click()
    URL.revokeObjectURL(url)
    toast(`Exported ${records.length} records — save as src/data/seedContentDatabase.json`)
  }

  async function addTemplateVocabulary() {
    if (!readyToStageEntries.length) {
      toast('Fix the validation errors before adding entries')
      return
    }
    const entries = readyToStageEntries
    const count = entries.length
    const now = new Date().toISOString()
    const stamp = Date.now()

    // Runtime layer: keeps the sentence generator supplied with the hand-picked
    // category/tags, and gives instant feedback before the disk write reloads.
    upsertContentRecords(entries.map((entry, index) => ({
      id: `manual-${stamp}-${index}`,
      kind: 'vocabulary' as const,
      japanese: entry.japanese,
      reading: entry.reading,
      english: entry.english,
      preferredTranslation: entry.preferredTranslation || inferPreferredTranslation(entry.japanese, entry.english, entry.reading),
      jlpt: entry.jlpt,
      category: entry.category,
      categories: [entry.category],
      tags: entry.tags,
      status: 'approved' as const,
      source: 'manual' as const,
      allowedRoles: [entry.category],
      approvedAt: now,
      reviewedAt: now,
      updatedAt: now,
    })))
    setVocabImportDraft(VOCABULARY_TEMPLATE)

    const plural = count === 1 ? 'word' : 'words'

    // Permanent layer: persist to src/data/userAddedVocab.json on disk via the
    // dev-server endpoint so the words survive across browsers and reach the
    // study decks. Falls back to browser-only if the dev server isn't reachable.
    if (import.meta.env.DEV) {
      try {
        const response = await fetch('/__add-vocab', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(entries.map((entry, index) => ({
            id: `user-${stamp}-${index}`,
            front: entry.japanese,
            reading: entry.reading,
            back: entry.english,
            jlpt: entry.jlpt,
          }))),
        })
        const result = await response.json() as { ok?: boolean }
        if (result.ok) {
          toast(`Added ${count} ${plural} — saved to disk`)
          return
        }
      } catch {
        // Fall through to the browser-only notice below.
      }
      toast(`Added ${count} ${plural} (browser only — dev server unreachable)`)
      return
    }

    toast(`Added ${count} ${plural} to the database`)
  }

  function approveStagedVocabulary(record: ContentRecord) {
    const now = new Date().toISOString()
    upsertContentRecord({ ...record, status: 'approved', approvedAt: now, reviewedAt: now, updatedAt: now })
    toast(`${record.japanese} is now live in the sentence pool`)
  }

  function approveAllStagedVocabulary() {
    if (!stagedVocabulary.length) return
    const now = new Date().toISOString()
    upsertContentRecords(stagedVocabulary.map(record => ({ ...record, status: 'approved' as const, approvedAt: now, reviewedAt: now, updatedAt: now })))
    toast(`${stagedVocabulary.length} ${stagedVocabulary.length === 1 ? 'word is' : 'words are'} now live in the sentence pool`)
  }

  return <div className="cs-shell">
    <aside className="cs-side"><button className="cs-brand" onClick={onBack}><b>漢</b><span>Kanji Quest<small>Content Studio</small></span></button><nav>{nav.map(n => <button key={n.id} className={view === n.id ? 'active' : ''} onClick={() => { setView(n.id); if (n.id === 'categories') { setManagedTagGroup(null); setCategorySearch('') } }}><i>{n.icon}</i><span>{n.label}</span>{n.id === 'review' && drafts.length > 0 && <em>{drafts.length}</em>}</button>)}</nav><footer><span /> Local content workspace<small>Review before publishing</small></footer></aside>
    <main className="cs-main"><header className="cs-top"><div><small>CONTENT MANAGEMENT</small><h1>{title}</h1></div><div><span>{notice}</span><button onClick={onBack}>×</button></div></header>

      {view === 'dashboard' && <div className="cs-page"><section className="cs-hero"><div><small>REVIEW-FIRST SENTENCE DATA</small><h2>Let the system draft.<br /><em>You make it trustworthy.</em></h2><p>Generate structured content in batches, review uncertain fields, then publish only approved records to the sentence engine.</p><button onClick={() => setView('review')}>Review {drafts.length} drafts →</button></div><div className="cs-paper"><small>GENERATED DRAFT</small><b>届ける</b><span>とどける · to deliver</span><Slots items={patterns[2]} /><p><i>Confidence</i><strong>94%</strong></p></div></section>
        <section className="cs-stats">{[['動','148','Verbs'],['語','623','Vocabulary'],['文',String(sentencePatternCatalog.length),'Templates'],['✓',String(drafts.length),'To review']].map((x,i) => <button key={x[2]} onClick={() => setView((['verbs','vocab','patterns','review'] as View[])[i])}><i>{x[0]}</i><strong>{x[1]}</strong><span>{x[2]}</span></button>)}</section>
        <section className="cs-pipeline" aria-label="Content pipeline">
          <div className="cs-pipeline-heading"><small className="eyebrow">CONTENT PIPELINE</small><h3>Paste candidates. Review a batch. Keep the corrections.</h3><p>This turns your existing ChatGPT → Kanji Quest → ChatGPT review loop into three repeatable steps.</p></div>
          <div className="pipeline-grid">
            <article className="cs-card pipeline-card"><span className="pipeline-step">01</span><small className="eyebrow">CANDIDATE WORDS</small><h3>Paste a compact list</h3><p>One line: <code>Japanese | reading | meaning | preferred English | JLPT | tags</code></p><textarea value={candidateWordDraft} onChange={event=>setCandidateWordDraft(event.target.value)} placeholder={'資料 | しりょう | materials / documents | documents | N3 | document, readable\n薬局 | やっきょく | pharmacy | pharmacy | N4 | place, medical'} spellCheck={false} rows={5} /><div className="pipeline-actions"><button className="primary" type="button" onClick={prepareCandidateImport}>Prepare for validation →</button></div></article>
            <article className="cs-card pipeline-card"><span className="pipeline-step">02</span><small className="eyebrow">SENTENCE QA</small><h3>Copy a review packet</h3><p>Twenty numbered sentences with English and pattern details, ready to paste into your reviewer chat.</p><div className="pipeline-preview"><b>{qaSentences[0]?.japanese}</b><span>{qaSentences[0]?.english}</span></div><div className="pipeline-actions"><button className="ghost" type="button" onClick={()=>copyText(qaPacket,'20-sentence QA packet copied')}>Copy 20 sentences</button><button className="primary" type="button" onClick={()=>setQaBatchSeed(seed=>seed+1)}>New batch ↻</button></div></article>
            <article className="cs-card pipeline-card"><span className="pipeline-step">03</span><small className="eyebrow">CORRECTION INTAKE</small><h3>Keep reviewer feedback</h3><p>Paste the corrections back here so each batch is preserved and easy to send with the next generator update.</p><textarea value={qaFeedbackDraft} onChange={event=>setQaFeedbackDraft(event.target.value)} placeholder={'01. Japanese is fine. English: “It’s hot today.”\n07. Block driver + sake pairing.'} spellCheck={false} rows={5} /><div className="pipeline-actions"><button className="ghost" type="button" onClick={()=>copyText(qaFeedbackDraft,'Correction feedback copied')}>Copy for Codex</button><button className="primary" type="button" onClick={saveQaFeedback}>Save feedback</button></div>{qaFeedbackBatches[0]&&<div className="pipeline-saved"><span>Last saved {new Date(qaFeedbackBatches[0].createdAt).toLocaleDateString()} · {qaFeedbackBatches.length} batch{qaFeedbackBatches.length===1?'':'es'} kept locally</span><button className="ghost" type="button" onClick={()=>copyText(qaFeedbackBatches[0].feedback,'Last saved feedback copied')}>Copy last saved</button></div>}</article>
          </div>
        </section>
        <section className="cs-two"><article className="cs-card"><small className="eyebrow">RECOMMENDED WORKFLOW</small><h3>Collect once, generate many</h3><ol><li><b>Seed trusted words</b><span>Start with existing JLPT lists and your curated vocabulary.</span></li><li><b>Generate structured drafts</b><span>Pre-fill readings, verb classes, conjugations, categories, and templates.</span></li><li><b>Review exceptions</b><span>Approve, edit, or reject records with confidence and source notes.</span></li><li><b>Test combinations</b><span>Audit generated sentences before adding them to practice.</span></li></ol></article><article className="cs-card cs-ready"><small className="eyebrow">READY TO REVIEW</small><h3>{drafts.length} generated records</h3><p>{approvedIds.length} approved so far. Decisions are remembered on this device.</p><button onClick={() => setView('review')}>Open Draft Review</button></article></section>
      </div>}

      {view === 'review' && <div className="cs-page cs-narrow"><div className="cs-intro"><div><h2>Draft review queue</h2><p>Generated from Kanji Quest’s actual vocabulary collection. Decisions are saved and deduplicated.</p></div><div className="batch-controls"><label>Batch<select value={batchSize} onChange={e=>setBatchSize(Number(e.target.value))}><option>5</option><option>10</option><option>25</option><option>50</option></select></label><label>Level<select value={batchLevel} onChange={e=>setBatchLevel(e.target.value)}>{['All','N5','N4','N3','N2','N1'].map(x=><option key={x}>{x}</option>)}</select></label><button className="primary" onClick={generateBatch}>Generate batch +</button></div></div><div className="review-summary"><span><b>{drafts.length}</b> queued</span><span><b>{database.filter(record => record.status === 'approved').length}</b> approved</span><span><b>{rejectedIds.length}</b> rejected</span></div>{drafts.length === 0 ? <div className="cs-empty">Choose a batch size and JLPT level, then generate records from the existing content library.</div> : <div className="cs-review-list">{drafts.map((d, i) => <article className="cs-card cs-draft" key={d.id}><span className={`type type-${d.type.toLowerCase()}`}>{d.type}</span><div className="draft-word"><b>{d.japanese}</b><span>{d.reading}</span></div><div className="draft-meaning"><b>{d.english}</b><span>Dictionary · {d.detail}</span>{d.type==='Vocabulary'&&<label><span>Preferred for sentences</span><input value={d.preferredTranslation ?? inferPreferredTranslation(d.japanese,d.english,d.reading)} onChange={event=>setDrafts(current=>current.map(item=>item.id===d.id?{...item,preferredTranslation:event.target.value}:item))} /></label>}</div><div className="confidence"><span>Confidence</span><b>{[94,89,86,92][i % 4]}%</b></div><button className="ghost" onClick={() => toast('Draft opened for editing')}>Edit</button><button className="reject" onClick={() => { setDrafts(drafts.filter(x => x.id !== d.id)); if (d.sourceId) setRejectedIds(ids => [...new Set([...ids, d.sourceId!])]) }}>Reject</button><button className="approve" onClick={() => approveDraft(d)}>Approve</button></article>)}</div>}</div>}

      {view === 'review' && database.some(record => record.status === 'approved') && <section className="cs-page cs-narrow approved-records"><div className="cs-intro"><div><h2>Approved database</h2><p>These records are available to the sentence generator. Disable any record to remove it from rotation.</p></div><button className="ghost" onClick={exportContentDatabase}>Export JSON</button></div><div className="cs-category-list">{database.filter(record => record.status === 'approved').slice().reverse().slice(0, 20).map(record => <article key={record.id}><i>{record.kind === 'verb' ? '動' : '語'}</i><div><b>{record.japanese}</b><span>{record.reading} · Dictionary: {record.english}{record.preferredTranslation?` · Sentences: ${record.preferredTranslation}`:''}</span></div><span>{(record.categories?.length ? record.categories : [record.category]).join(', ')} · {record.jlpt ?? 'Unrated'}</span><button onClick={() => disableContentRecord(record.id)}>Disable</button></article>)}</div></section>}

      {view === 'verbs' && <div className="cs-page cs-narrow"><div className="cs-intro"><div><h2>Verb editor</h2><p>Store the rule and its exceptions—not every possible conjugated string.</p></div><span className="pill">148 verbs</span></div><form className="cs-form" onSubmit={e => { e.preventDefault(); toast('Verb saved ✓') }}><section className="cs-card numbered"><i>01</i><div><h3>Dictionary entry</h3><div className="cs-grid"><Field label="Japanese verb"><input defaultValue="読む" /></Field><Field label="Reading (hiragana)"><input defaultValue="よむ" /></Field><Field label="English meaning"><input defaultValue="to read" /></Field><Field label="JLPT level"><select defaultValue="N5">{['N5','N4','N3','N2','N1'].map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Verb class"><select defaultValue="Godan -mu"><option>Ichidan</option><option>Godan -u</option><option>Godan -ku</option><option>Godan -gu</option><option>Godan -su</option><option>Godan -tsu</option><option>Godan -nu</option><option>Godan -bu</option><option>Godan -mu</option><option>Godan -ru</option><option>Irregular</option></select></Field><Field label="Conjugation stem"><input defaultValue="読" /></Field></div></div></section>
        <section className="cs-card numbered"><i>02</i><div><h3>Generated endings & tenses</h3><p className="help">These are derived from the verb class. Override only irregular or lexicalized forms.</p><div className="tense-table"><div><b>Form</b><b>Plain</b><b>Polite</b><b>Use in sentences</b></div>{[['Non-past','読む','読みます'],['Negative','読まない','読みません'],['Past','読んだ','読みました'],['Past negative','読まなかった','読みませんでした'],['Progressive','読んでいる','読んでいます'],['Potential','読める','読めます'],['Volitional','読もう','読みましょう']].map(row => <div key={row[0]}><span>{row[0]}</span><input defaultValue={row[1]} /><input defaultValue={row[2]} /><label><input type="checkbox" defaultChecked /> enabled</label></div>)}</div><div className="cs-grid forms-extra"><Field label="Te-form"><input defaultValue="読んで" /></Field><Field label="Imperative"><input defaultValue="読め" /></Field><Field label="Conditional (ば)"><input defaultValue="読めば" /></Field><Field label="Conditional (たら)"><input defaultValue="読んだら" /></Field></div></div></section>
        <section className="cs-card numbered"><i>03</i><div><h3>Sentence compatibility</h3><p className="help">The verb chooses one pattern and its slots. Categories control grammar eligibility; semantic tags narrow each slot to sensible vocabulary.</p><div className="cs-grid"><Field label="Primary pattern"><select><option>Subject は Object を Verb</option><option>Subject は Location で Object を Verb</option><option>Subject は Recipient に Object を Verb</option></select></Field><Field label="Allowed subject categories"><div className="chip-checks category-picker">{categories.map(x=><label key={x}><input type="checkbox" defaultChecked={x==='People & Living Things'}/><span>{x}</span></label>)}</div></Field><Field label="Allowed object categories" wide><div className="chip-checks category-picker">{categories.map(x=><label key={x}><input type="checkbox" defaultChecked={x==='Objects'}/><span>{x}</span></label>)}</div></Field><Field label="Allowed object tags" wide><input defaultValue="book, document, reading, newspaper" placeholder="food, fruit, bread, edible" /></Field><Field label="Optional slots"><div className="chip-checks">{['Time','Location','Adverb','Reason','Companion'].map((x,i)=><label key={x}><input type="checkbox" defaultChecked={i<3}/><span>{x}</span></label>)}</div></Field><Field label="Supported grammar forms"><div className="chip-checks">{['Dictionary','ます'].map(x=><label key={x}><input type="checkbox" defaultChecked/><span>{x}</span></label>)}</div></Field><Field label="English template" wide><input defaultValue="{Subject} {Verb} {Object}." /></Field><Field label="Notes / exceptions" wide><textarea placeholder="Register restrictions, particle exceptions, unnatural combinations…" /></Field></div></div></section><div className="cs-actions"><button className="ghost" type="button">Save as draft</button><button className="primary">Save verb</button></div></form></div>}

      {view === 'vocab' && <div className="cs-page cs-narrow"><div className="cs-intro"><div><h2>Vocabulary editor</h2><p>Keep the complete dictionary definition for study, then choose one clean translation and logic tags for generated sentences.</p></div><div className="vocab-intro-actions"><button className="ghost" type="button" onClick={exportVocabularyList}>Export vocabulary list</button><button className="primary" onClick={() => setView('review')}>Generate from JLPT list</button></div></div><section className="cs-card vocab-guidance"><small className="eyebrow">SENTENCE DATABASE PHILOSOPHY</small><h3>Add the word once, then let rules reuse it safely</h3><p>Use the dictionary field for full study meaning. Use preferred translation, category, and tags to keep generated sentences natural.</p><div className="vocab-philosophy-grid">{VOCABULARY_PHILOSOPHY.map(item=><article key={item[0]}><b>{item[0]}</b><span>{item[1]}</span></article>)}</div></section><section className="vocab-workbench"><article className="cs-card vocab-template-card"><header><div><small className="eyebrow">PASTE TEMPLATE</small><h3>Vocabulary input template</h3></div><button className="ghost" type="button" onClick={()=>copyText(VOCABULARY_TEMPLATE,'Template copied')}>Copy template</button></header><textarea value={vocabTemplateDraft} onChange={event=>setVocabTemplateDraft(event.target.value)} spellCheck={false} /><p>Paste a filled version here while preparing entries, then move the values into the save form below.</p></article><article className="cs-card vocab-template-card"><header><div><small className="eyebrow">TAG REFERENCE</small><h3>All available tags</h3></div><button className="ghost" type="button" onClick={()=>copyText(allVocabularyTags,'All tags copied')}>Copy all tags</button></header><textarea value={allVocabularyTags} readOnly spellCheck={false} /></article></section><form className="cs-card cs-simple cs-grid vocab-entry-form" onSubmit={saveVocabulary}><Field label="Japanese"><input name="japanese" placeholder="資料" required /></Field><Field label="Reading"><input name="reading" placeholder="しりょう" required /></Field><Field label="Dictionary meaning"><input name="english" placeholder="materials / data / documents" required /></Field><Field label="Preferred sentence translation"><input name="preferredTranslation" placeholder="documents (auto-selected if blank)" /></Field><Field label="Category"><select value={vocabPrimaryCategory} onChange={event=>setVocabPrimaryCategory(event.target.value)}>{categories.map(x=><option key={x}>{x}</option>)}</select></Field><Field label="JLPT level"><select name="jlpt">{['N5','N4','N3','N2','N1'].map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Optional tags" wide><input name="tags" placeholder="document, reading, N3" /></Field><Field label="Countability / article"><select><option>Countable · a/an</option><option>Uncountable</option><option>Proper noun</option><option>Person / pronoun</option></select></Field><Field label="Notes" wide><textarea placeholder="Sentence-generator notes, restrictions, bad pairings, or preferred contexts..." /></Field><div className="cs-actions wide"><button className="primary">Save vocabulary</button></div></form></div>}

      {view === 'vocab' && <section className="cs-page cs-narrow vocab-bottom-tools"><article className="cs-card vocab-import-card"><header><div><small className="eyebrow">VALIDATE + ADD</small><h3>Paste, check, and add to the database</h3><p>Paste one or more completed templates. Duplicates against the entire database are flagged automatically. Fix errors, review warnings, then add every valid entry straight to the live database.</p></div><button className="ghost" type="button" onClick={()=>copyText(VOCABULARY_TEMPLATE,'Template copied')}>Copy template</button></header><textarea aria-label="Vocabulary templates to import" value={vocabImportDraft} onChange={event=>setVocabImportDraft(event.target.value)} spellCheck={false} /><div className="vocab-validation-summary"><b>{readyToStageEntries.length} ready to add</b><span>{vocabularyValidation.reduce((total,item)=>total+item.errors.length,0)} errors · {vocabularyValidation.reduce((total,item)=>total+item.warnings.length,0)} warnings</span></div>{vocabularyValidation.length>0&&<div className="vocab-validation-list">{vocabularyValidation.map(result=><article key={`${result.input.index}-${result.input.japanese}-${result.input.reading}`} className={result.errors.length?'has-errors':''}><b>Entry {result.input.index}{result.input.japanese?` · ${result.input.japanese}`:''}</b>{[...result.errors,...result.warnings].map(issue=><span key={issue} className={result.errors.includes(issue)?'error':'warning'}>{issue}</span>)}{!result.errors.length&&!result.warnings.length&&<span className="pass">Ready to add.</span>}</article>)}</div>}<footer><span>Errors block adding (duplicates and missing required fields). Warnings are informational: defaults, duplicate logic, and custom tags to review.</span><button className="primary" type="button" disabled={!readyToStageEntries.length} onClick={() => { void addTemplateVocabulary() }}>Add {readyToStageEntries.length || ''} {readyToStageEntries.length === 1 ? 'word' : 'words'} to database</button></footer></article><article className="cs-card vocab-staging-card"><header><div><small className="eyebrow">STAGING QUEUE</small><h3>Review before publishing</h3><p>Words saved one at a time from the entry form land here for review. Pasted templates above are added directly, so they skip this queue.</p></div><div className="vocab-staging-actions"><span>{stagedVocabulary.length} staged</span>{stagedVocabulary.length>0&&<button className="primary" type="button" onClick={approveAllStagedVocabulary}>Approve all</button>}</div></header>{stagedVocabulary.length?<div className="vocab-staging-list">{stagedVocabulary.map(record=><article key={record.id}><div><b>{record.japanese}</b><span>{record.reading} · {record.preferredTranslation || record.english}</span><small>{record.category} · {record.jlpt} · {record.tags.map(formatTagLabel).join(', ') || 'no tags'}</small></div><div><button className="ghost" type="button" onClick={()=>disableContentRecord(record.id)}>Remove</button><button className="primary" type="button" onClick={()=>approveStagedVocabulary(record)}>Approve live</button></div></article>)}</div>:<div className="vocab-staging-empty">Nothing staged yet. Words saved individually from the entry form appear here for review.</div>}</article></section>}

      {view === 'categories' && !managedTagGroup && <div className="cs-page cs-narrow"><div className="cs-intro"><div><h2>Word category editor</h2><p>Review each word once. Saving its category and tags moves the complete word record into the reviewed database.</p></div><div className="category-review-actions"><span className="pill">{unreviewedWords.length} left to review</span><button className="ghost" type="button" onClick={exportSeedDatabase}>Export database file</button><button className="primary" onClick={()=>{setManagedTagGroup('reviewed');setReviewedCategory('All');setCategorySearch('')}}>Reviewed Words ({reviewedWords.length})</button></div></div><div className="cs-category-list tag-group-list">{TAG_GROUPS.map((group,index)=>{const tags=getTagGroupTags(group.name);const wordCount=unreviewedWords.filter(word=>getWordTagGroup(word)===group.name).length;return <article key={group.name}><i>{String(index+1).padStart(2,'0')}</i><div><b>{group.name}</b><span>{tags.length} category tags · {wordCount} waiting for review</span></div><span>{tags.slice(0,3).map(formatTagLabel).join(' · ')}{tags.length>3?'…':''}</span><button onClick={()=>{setManagedTagGroup(group.name);setCategorySearch('')}}>Manage</button></article>})}</div><section className="cs-card vocab-template-card bulk-review-card"><header><div><small className="eyebrow">BULK REVIEW</small><h3>Paste many words at once</h3></div><button className="ghost" type="button" onClick={()=>copyText(BULK_REVIEW_EXAMPLE,'Example copied')}>Copy example</button></header><p>One word per line: <code>word | category | tag, tag, tag</code>. Lines starting with <code>#</code> are ignored. Categories are the eight groups above; tags decide which sentences the word may appear in.</p><textarea value={bulkReviewDraft} onChange={event=>setBulkReviewDraft(event.target.value)} placeholder={BULK_REVIEW_EXAMPLE} spellCheck={false} rows={10} /><div className="cs-actions"><button className="primary" type="button" onClick={applyBulkReview} disabled={!bulkReviewDraft.trim()}>Apply to reviewed words</button></div>{bulkReviewReport && <pre className="bulk-review-report">{bulkReviewReport}</pre>}</section></div>}

      {view === 'categories' && managedTagGroup && managedTagGroup !== 'reviewed' && <div className="cs-page cs-narrow category-detail"><button className="category-back" onClick={()=>{setManagedTagGroup(null);setCategorySearch('')}}>← All categories</button><div className="cs-intro"><div><span className="category-kicker">TO REVIEW</span><h2>{managedTagGroup}</h2><p>{getTagGroupTags(managedTagGroup).length} category tags · {unreviewedWords.filter(word=>getWordTagGroup(word)===managedTagGroup).length} words remaining. Saving a word moves its full card into Reviewed Words.</p></div><label className="category-search"><span>Search words or tags</span><input value={categorySearch} onChange={event=>setCategorySearch(event.target.value)} placeholder={`Search ${managedTagGroup.toLowerCase()}…`} /></label></div><div className="category-word-header"><span>{managedWords.length} {managedWords.length===1?'word':'words'} shown</span><span>Review category and suggested tags</span></div>{managedWords.length ? <div className="category-word-list">{managedWords.map(word=><CategoryWordTagRow key={word.id} word={word} onTaxonomyChange={()=>setTagRevision(value=>value+1)} onSave={saveReviewedWord} />)}</div> : <div className="cs-empty">This category is fully reviewed. You can edit its saved words in Reviewed Words.</div>}</div>}

      {view === 'categories' && managedTagGroup === 'reviewed' && <div className="cs-page cs-narrow category-detail reviewed-words"><button className="category-back" onClick={()=>{setManagedTagGroup(null);setCategorySearch('')}}>← All categories</button><div className="cs-intro"><div><span className="category-kicker">SAVED DATABASE</span><h2>Reviewed Words</h2><p>{reviewedWords.length} complete word records with approved categories and tags. These records are available to the sentence generator and included in database exports.</p></div><label className="category-search"><span>Search reviewed words or tags</span><input value={categorySearch} onChange={event=>setCategorySearch(event.target.value)} placeholder="Search reviewed words…" /></label></div><div className="reviewed-category-menu" role="group" aria-label="Filter reviewed words by category"><button className={reviewedCategory==='All'?'active':''} aria-pressed={reviewedCategory==='All'} onClick={()=>setReviewedCategory('All')}><b>All Words</b><span>{reviewedWords.length}</span></button>{TAG_GROUPS.map((group,index)=>{const count=reviewedWords.filter(word=>getWordTagGroup(word)===group.name).length;return <button key={group.name} className={reviewedCategory===group.name?'active':''} aria-pressed={reviewedCategory===group.name} onClick={()=>setReviewedCategory(group.name)}><i>{String(index+1).padStart(2,'0')}</i><b>{group.name}</b><span>{count}</span></button>})}</div><div className="category-word-header"><span>{managedWords.length} {managedWords.length===1?'word':'words'} shown</span><span>{reviewedCategory==='All'?'All reviewed categories':reviewedCategory} · saved category and tags</span></div>{managedWords.length ? <div className="category-word-list">{managedWords.map(word=><CategoryWordTagRow key={word.id} word={word} onTaxonomyChange={()=>setTagRevision(value=>value+1)} onSave={saveReviewedWord} />)}</div> : <div className="cs-empty">No reviewed words are saved in {reviewedCategory==='All'?'the database':reviewedCategory} yet.</div>}</div>}

      {view === 'patterns' && <div className="cs-page cs-narrow"><div className="cs-intro"><div><h2>Sentence pattern library</h2><p>{patternComplexities.length} complexity levels selected · {sentencePatternCatalog.filter(pattern=>patternComplexities.includes(complexityForPattern(pattern.id))).length} patterns shown.</p></div><button className="primary" onClick={()=>toast('New pattern draft created')}>New pattern +</button></div><div className="pattern-level-tabs" role="group" aria-label="Filter sentence patterns by generation complexity">{GENERATION_COMPLEXITIES.map(complexity=>{const selected=patternComplexities.includes(complexity);return <button key={complexity} className={selected?'active':''} aria-pressed={selected} onClick={()=>togglePatternComplexity(complexity)}>L{complexity}</button>})}</div><div className="cs-patterns">{sentencePatternCatalog.filter(pattern=>patternComplexities.includes(complexityForPattern(pattern.id))).map((pattern,i)=>{const active=activePatternIds.includes(pattern.id);const complexity=complexityForPattern(pattern.id);return <article className="cs-card" key={pattern.id}><header><i>{String(i+1).padStart(2,'0')}</i><span className={active?'active':'review-status'}>{active?'Active':pattern.generatorReady?'Inactive':'Needs rule'}</span></header><h3 className="pattern-structure">{pattern.structure}</h3><Slots items={pattern.slots}/><p><b>{pattern.example}</b><span>{pattern.meaning} · {pattern.verbForm}</span>{pattern.note&&<em>{pattern.note}</em>}</p><footer><span>{complexityDetails[complexity].shortLabel} · {active?'included in test rotation':pattern.generatorReady?'ready to activate':'saved in library'}</span><button disabled={!pattern.generatorReady} onClick={()=>togglePattern(pattern.id)}>{active?'Disable':'Activate'}</button></footer></article>})}</div></div>}

      {view === 'test' && testBatchOpen && <div className="cs-page cs-narrow test-batch-page">
        <button className="category-back" onClick={()=>setTestBatchOpen(false)}>← Single sentence generator</button>
        <div className="cs-intro"><div><span className="category-kicker">BATCH MODE</span><h2>Generate 10 sentences</h2><p>Review a full set using the selected generation-complexity levels and approved vocabulary.</p></div><div className="test-generator-actions"><button className={`ghost${english?' active':''}`} aria-pressed={english} onClick={()=>setEnglish(!english)}>EN English {english?'on':'off'}</button><button className={`ghost${furigana?' active':''}`} aria-pressed={furigana} onClick={()=>setFurigana(!furigana)}>ふ Furigana {furigana?'on':'off'}</button><button className="primary" onClick={()=>setTestBatchSeed(seed=>seed+1)}>Generate 10 more ↻</button></div></div>
        <div className="test-level-menu" role="group" aria-label="Filter batch patterns by generation complexity">{GENERATION_COMPLEXITIES.map(complexity=>{const selected=testComplexities.includes(complexity);return <button key={complexity} className={selected?'active':''} aria-pressed={selected} onClick={()=>toggleTestComplexity(complexity)}>L{complexity}</button>})}</div>
        <div className="test-batch-list">{generatedTestBatch.map((sentence,index)=><article className="cs-card test-batch-sentence" key={`${testBatchSeed}-${index}-${sentence.frameId}`}><header><i>{String(index+1).padStart(2,'0')}</i><small>{sentence.frameId.toUpperCase()} · {sentence.level}</small></header><h3><TestSentenceText sentence={sentence} showFurigana={furigana}/></h3>{furigana&&sentence.reading&&<p className="reading">{sentence.reading}</p>}{english&&<p className="translation">{sentence.english}</p>}<footer>{Object.entries(sentence.slots).map(([name,slot])=><span key={name}><b>{name}</b> {slot.dictionaryForm}</span>)}</footer></article>)}</div>
      </div>}

      {view === 'test' && !testBatchOpen && <div className="cs-page cs-narrow"><div className="cs-intro"><div><h2>Test generator</h2><p>Select one or more complexity levels to define the sentence-pattern pool.</p></div><div className="test-generator-actions"><button className={`ghost${english?' active':''}`} aria-pressed={english} onClick={()=>setEnglish(!english)}>EN English {english?'on':'off'}</button><button className={`ghost${furigana?' active':''}`} aria-pressed={furigana} onClick={()=>setFurigana(!furigana)}>ふ Furigana {furigana?'on':'off'}</button><button className="ghost" onClick={()=>setTestBatchOpen(true)}>Generate 10 sentences →</button><button className="primary" onClick={()=>setSample(sample+1)} disabled={!generatedTest}>Generate ↻</button></div></div><div className="test-level-menu" role="group" aria-label="Filter test patterns by generation complexity">{GENERATION_COMPLEXITIES.map(complexity=>{const selected=testComplexities.includes(complexity);return <button key={complexity} className={selected?'active':''} aria-pressed={selected} onClick={()=>toggleTestComplexity(complexity)}>L{complexity}</button>})}</div>{generatedTest ? <div className="cs-test"><section className="cs-card result"><small><span /> {generatedTest.frameId.toUpperCase()} · {complexityDetails[complexityForPattern(generatedTest.frameId)].shortLabel} PATTERN</small><h3><TestSentenceText sentence={generatedTest} showFurigana={furigana}/></h3>{furigana&&generatedTest.reading&&<p className="reading">{generatedTest.reading}</p>}{english&&<p className="translation">{generatedTest.english}</p>}</section><aside className="cs-card audit"><small className="eyebrow">SELECTION AUDIT</small><h3>Data used</h3>{Object.entries(generatedTest.slots).map(([name, slot],i)=>{const category=slot.tags.find(tag=>tag.startsWith('category:'))?.slice(9);const matchedTags=slot.tags.filter(tag=>tag.startsWith('matched:')).map(tag=>tag.slice(8));return <div key={name}><i>{i+1}</i><span><b>{slot.dictionaryForm}</b><small>{name}{category?` · ${category}`:''} · {slot.jlpt}{slot.id.startsWith('approved-') ? ' · approved' : ' · built-in'}</small>{matchedTags.length>0&&<small>Matched tags: {matchedTags.join(', ')}</small>}</span></div>})}<footer><small>Pattern</small><Slots items={sentencePatternCatalog.find(pattern=>pattern.id===generatedTest.frameId)?.slots ?? []} /></footer></aside></div> : <div className="cs-empty">No template is available for the selected complexity level.</div>}</div>}
    </main>
  </div>
}
