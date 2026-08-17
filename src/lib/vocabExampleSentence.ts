import type { StudyCard } from './types'
import { GENERATED_VOCAB_EXAMPLES } from '../data/vocabExamples.generated'

export interface VocabExampleSegment {
  text: string
  reading?: string
}

export interface VocabExampleSentence {
  japanese: string
  reading: string
  english: string
  segments: VocabExampleSegment[]
}

const cache = new Map<string, VocabExampleSentence | null>()

/** Contextual examples for useful words the generator cannot yet place
 * naturally. These outrank generated data so stale low-quality output never
 * shadows a reviewed sentence. */
const CURATED_CONTEXT_EXAMPLES: Readonly<Record<string, VocabExampleSentence>> = {
  禁煙: {
    japanese: 'このレストランは全席禁煙です。',
    reading: 'このれすとらんはぜんせききんえんです。',
    english: 'This restaurant is entirely non-smoking.',
    segments: [
      { text: 'このレストランは', reading: 'このれすとらんわ' },
      { text: '全席', reading: 'ぜんせき' },
      { text: '禁煙', reading: 'きんえん' },
      { text: 'です。', reading: 'です。' },
    ],
  },
  喫煙: {
    japanese: 'ここで喫煙してはいけません。',
    reading: 'ここできつえんしてはいけません。',
    english: 'You must not smoke here.',
    segments: [
      { text: 'ここで', reading: 'ここで' },
      { text: '喫煙', reading: 'きつえん' },
      { text: 'してはいけません。', reading: 'してはいけません。' },
    ],
  },
  化粧: {
    japanese: '姉は出かける前に化粧をします。',
    reading: 'あねはでかけるまえにけしょうをします。',
    english: 'My older sister puts on makeup before going out.',
    segments: [
      { text: '姉は', reading: 'あねわ' },
      { text: '出かける前に', reading: 'でかけるまえに' },
      { text: '化粧', reading: 'けしょう' },
      { text: 'をします。', reading: 'をします。' },
    ],
  },
  葉: {
    japanese: '秋になると、木の葉が赤くなります。',
    reading: 'あきになると、きのはがあかくなります。',
    english: 'When autumn comes, the leaves turn red.',
    segments: [
      { text: '秋になると、', reading: 'あきになると、' },
      { text: '木の葉', reading: 'きのは' },
      { text: 'が赤くなります。', reading: 'があかくなります。' },
    ],
  },
  理解する: {
    japanese: '先生の説明を聞いて、内容を理解しました。',
    reading: 'せんせいのせつめいをきいて、ないようをりかいしました。',
    english: 'I listened to the teacher’s explanation and understood the content.',
    segments: [
      { text: '先生の説明を聞いて、', reading: 'せんせいのせつめいをきいて、' },
      { text: '内容を', reading: 'ないようを' },
      { text: '理解しました。', reading: 'りかいしました。' },
    ],
  },
  冷凍庫: {
    japanese: '冷凍庫に肉を入れます。',
    reading: 'れいとうこににくをいれます。',
    english: 'I put meat in the freezer.',
    segments: [
      { text: '冷凍庫', reading: 'れいとうこ' },
      { text: 'に肉を入れます。', reading: 'ににくをいれます。' },
    ],
  },
}

function seedFor(id: string): number {
  let seed = 0
  for (let index = 0; index < id.length; index += 1) seed = (seed * 31 + id.charCodeAt(index)) >>> 0
  return seed
}


/**
 * Builds one example sentence that naturally uses the given vocab word, by
 * forcing it into a matching slot (noun/verb/adjective/etc.) of one of the
 * dashboard's vetted sentence templates, then reusing the same grammar
 * validator and English gloss the hero sentence rotator already relies on.
 * Returns undefined when the word's part of speech isn't one we can safely
 * slot into a template (particles, fixed expressions, etc.).
 */
export function getVocabExampleSentence(card: StudyCard): VocabExampleSentence | undefined {
  const cached = cache.get(card.id)
  if (cached !== undefined) return cached ?? undefined

  // Prefer reviewed context, then the same category engine used by the hero
  // stream. Do not fall through to the old POS-template mixer: it knew a word's
  // grammatical part of speech but not what that word could sensibly describe
  // or act on, which is how unrelated "random nonsense" pairs reached cards.
  const curated = CURATED_CONTEXT_EXAMPLES[card.front]
  const generated = GENERATED_VOCAB_EXAMPLES[card.front]
  const result = curated ? { ...curated } : generated ? { ...generated } : buildGuaranteedExample(card)
  cache.set(card.id, result ?? null)
  return result
}

/**
 * Every focused-vocabulary card should have readable context. Some fixed
 * expressions and nouns do not fit the rotator's semantic slots yet; for
 * those, use a natural meta-language sentence instead of fabricating an
 * unsafe collocation (for example, "use thunder" or "eat a receipt").
 */
function buildGuaranteedExample(card: StudyCard): VocabExampleSentence {
  const wordReading = card.reading || card.front

  const variants: Array<() => VocabExampleSentence> = [
    () => ({
      japanese: `「${card.front}」をノートに書きます。`,
      reading: `「${wordReading}」をノートにかきます。`,
      english: `I write “${card.front}” in my notebook.`,
      segments: [{ text: '「' }, { text: card.front, reading: wordReading }, { text: '」をノートに書きます。', reading: '」をノートにかきます。' }],
    }),
    () => ({
      japanese: `「${card.front}」の意味を辞書で調べます。`,
      reading: `「${wordReading}」のいみをじしょでしらべます。`,
      english: `I look up the meaning of “${card.front}.”`,
      segments: [{ text: '「' }, { text: card.front, reading: wordReading }, { text: '」の意味を辞書で調べます。', reading: '」のいみをじしょでしらべます。' }],
    }),
    () => ({
      japanese: `先生に「${card.front}」の意味を聞きます。`,
      reading: `せんせいに「${wordReading}」のいみをききます。`,
      english: `I ask my teacher what “${card.front}” means.`,
      segments: [{ text: '先生に「', reading: 'せんせいに「' }, { text: card.front, reading: wordReading }, { text: '」の意味を聞きます。', reading: '」のいみをききます。' }],
    }),
    () => ({
      japanese: `今日、「${card.front}」を覚えます。`,
      reading: `きょう、「${wordReading}」をおぼえます。`,
      english: `I’ll memorize “${card.front}” today.`,
      segments: [{ text: '今日、「', reading: 'きょう、「' }, { text: card.front, reading: wordReading }, { text: '」を覚えます。', reading: '」をおぼえます。' }],
    }),
    () => ({
      japanese: `「${card.front}」を声に出して読みます。`,
      reading: `「${wordReading}」をこえにだしてよみます。`,
      english: `I read “${card.front}” aloud.`,
      segments: [{ text: '「' }, { text: card.front, reading: wordReading }, { text: '」を声に出して読みます。', reading: '」をこえにだしてよみます。' }],
    }),
  ]

  return variants[seedFor(card.id) % variants.length]!()
}
