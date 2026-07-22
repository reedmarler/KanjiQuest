import { grammarBuilderExercises } from './grammarBuilderExercises'
import { buildDrillExercises, DRILL_LEVELS } from '../lib/drillExercises'
import type { DrillExercise, DrillFocus, DrillJlptLevel } from '../lib/drillExercises'

/** JLPT levels that have curated grammar drills wired up. */
export type GrammarJlptLevel = DrillJlptLevel

export const GRAMMAR_LEVELS = DRILL_LEVELS

export type GrammarPracticeExercise = DrillExercise

type GrammarFocus = DrillFocus

const politeVerbEndings = ['ます。', 'ました。', 'ません。', 'ませんでした。']
const plainVerbEndings = ['む。', 'まない。', 'んだ。', 'まなかった。']
const connectorChoices = ['から、', 'ので、', 'けど、', 'そして、']
// Particle drills need particle distractors — pulling verb endings from other
// sentences would make the choice obvious without testing the grammar point.
const placeParticles = ['で', 'に', 'へ', 'を']
const companionParticles = ['と', 'に', 'で', 'を']
const topicParticles = ['も', 'は', 'が', 'を']
const rangeParticles = ['まで', 'から', 'ごろ', 'より']
const purposeChoices = ['ために', 'ように', 'ことに', 'ときに']
// N3 sets group patterns that compete for the same slot, so the English clue is
// what disambiguates them rather than the shape of the sentence.
const limitChoices = ['ばかり', 'さえ', 'だけでなく', 'ほど']
const modalChoices = ['はずです。', 'べきです。', 'ようです。', 'そうです。']
const clauseChoices = ['うちに', 'たびに', 'まま', 'とおりに']
const causeChoices = ['おかげで', 'せいで', 'ために', 'ことで']
const referenceChoices = ['によって', 'について', 'にとって', 'に対して']
const quoteChoices = ['という', 'として', 'について', 'にとって']

const focusById: Record<string, GrammarFocus> = {
  masu: { segmentIndex: 4, pattern: '〜ます', meaning: 'polite non-past', replacement: '食べ___', replacementReading: 'たべ', answer: 'ます。', options: politeVerbEndings },
  mashita: { segmentIndex: 3, pattern: '〜ました', meaning: 'polite past', replacement: '食べ___', replacementReading: 'たべ', answer: 'ました。', options: politeVerbEndings },
  masen: { segmentIndex: 4, pattern: '〜ません', meaning: 'polite negative', replacement: '食べ___', replacementReading: 'たべ', answer: 'ません。', options: politeVerbEndings },
  'masen-deshita': { segmentIndex: 3, pattern: '〜ませんでした', meaning: 'polite negative past', replacement: '行き___', replacementReading: 'いき', answer: 'ませんでした。', options: politeVerbEndings },
  plain: { segmentIndex: 5, pattern: 'dictionary form', meaning: 'plain non-past', replacement: '飲___', replacementReading: 'の', answer: 'む。', options: plainVerbEndings },
  'plain-negative': { segmentIndex: 3, pattern: '〜ない', meaning: 'plain negative', replacement: 'し___', replacementReading: 'し', answer: 'ない。', options: ['ない。', 'た。', 'ます。', 'ません。'] },
  'plain-past': { segmentIndex: 3, pattern: '〜た', meaning: 'plain past', replacement: '会っ___', replacementReading: 'あっ', answer: 'た。', options: ['た。', 'ない。', 'ます。', 'ません。'] },
  'plain-negative-past': { segmentIndex: 3, pattern: '〜なかった', meaning: 'plain negative past', replacement: '見___', replacementReading: 'み', answer: 'なかった。', options: ['なかった。', 'ない。', 'た。', 'ます。'] },
  arimasu: { segmentIndex: 6, pattern: '〜があります', meaning: 'there is / are (things)' },
  imasu: { segmentIndex: 3, pattern: '〜がいます', meaning: 'there is / are (people or animals)' },
  'ni-arimasu': { segmentIndex: 6, pattern: '〜にあります', meaning: 'is located at' },
  goro: { segmentIndex: 1, pattern: '〜ごろ', meaning: 'around a time' },
  suki: { segmentIndex: 4, pattern: '〜が好きです', meaning: 'like' },
  hoshii: { segmentIndex: 4, pattern: '〜がほしいです', meaning: 'want a thing' },
  tai: { segmentIndex: 4, pattern: '〜たいです', meaning: 'want to do', replacement: '飲み___', replacementReading: 'のみ', answer: 'たいです。', options: ['たいです。', 'ます。', 'ません。', 'ました。'] },
  dekiru: { segmentIndex: 5, pattern: '〜ことができます', meaning: 'can do' },
  shika: { segmentIndex: 3, pattern: '〜しか〜ない', meaning: 'only' },
  must: { segmentIndex: 4, pattern: '〜なければなりません', meaning: 'must / have to' },
  'not-have-to': { segmentIndex: 2, pattern: '〜なくてもいいです', meaning: 'do not have to' },
  may: { segmentIndex: 4, pattern: '〜てもいいですか', meaning: 'may I?' },
  comparison: { segmentIndex: 3, pattern: '〜より…のほうが', meaning: 'more than' },
  ichiban: { segmentIndex: 2, pattern: '一番', meaning: 'most' },
  give: { segmentIndex: 6, pattern: '〜をあげます', meaning: 'give' },
  receive: { segmentIndex: 6, pattern: '〜をもらいます', meaning: 'receive' },
  because: { segmentIndex: 1, pattern: '〜から', meaning: 'because', answer: 'から、', options: connectorChoices },
  but: { segmentIndex: 1, pattern: '〜けど', meaning: 'but / though', answer: 'けど、', options: connectorChoices },
  possessive: { segmentIndex: 3, pattern: '〜の', meaning: 'possession' },
  demonstrative: { segmentIndex: 0, pattern: 'この', meaning: 'this (before a noun)' },
  counter: { segmentIndex: 2, pattern: '〜つ', meaning: 'general object counter' },
  please: { segmentIndex: 4, pattern: '〜てください', meaning: 'please do' },
  'dont-please': { segmentIndex: 4, pattern: '〜ないでください', meaning: 'please do not' },
  lets: { segmentIndex: 2, pattern: '〜ましょう', meaning: "let's" },
  invitation: { segmentIndex: 1, pattern: '〜ませんか', meaning: "won't you?" },
  potential: { segmentIndex: 4, pattern: 'potential form', meaning: 'can do' },
  'to-omoimasu': { segmentIndex: 4, pattern: '〜と思います', meaning: 'I think' },
  'to-iimasu': { segmentIndex: 3, pattern: '〜と言います', meaning: 'say / call' },
  tsumori: { segmentIndex: 5, pattern: '〜つもりです', meaning: 'intend to' },
  yotei: { segmentIndex: 4, pattern: '〜予定です', meaning: 'plan to' },
  experience: { segmentIndex: 4, pattern: '〜たことがあります', meaning: 'have done before' },
  tari: { segmentIndex: 4, pattern: '〜たり〜たりする', meaning: 'do things like…' },
  nagara: { segmentIndex: 4, pattern: '〜ながら', meaning: 'while doing' },
  'mae-ni': { segmentIndex: 1, pattern: '〜前に', meaning: 'before' },
  'ato-de': { segmentIndex: 3, pattern: '〜あとで', meaning: 'after' },
  node: { segmentIndex: 3, pattern: '〜ので', meaning: 'because', answer: 'ので、', options: connectorChoices },
  'you-ni': { segmentIndex: 1, pattern: '〜ように', meaning: 'so that' },
  sugiru: { segmentIndex: 3, pattern: '〜すぎる', meaning: 'too much' },
  hajimeru: { segmentIndex: 2, pattern: '〜始める', meaning: 'begin to do' },
  owaru: { segmentIndex: 2, pattern: '〜終わる', meaning: 'finish doing' },
  tsuzukeru: { segmentIndex: 4, pattern: '〜続ける', meaning: 'continue doing' },

  'te-imasu': { segmentIndex: 5, pattern: '〜ています', meaning: 'happening now' },
  'i-adjective-negative': { segmentIndex: 3, pattern: '〜くないです', meaning: 'not (い-adjective)' },
  'na-adjective': { segmentIndex: 2, pattern: '〜な + noun', meaning: 'な-adjective before a noun' },
  'noun-past': { segmentIndex: 2, pattern: '〜でした', meaning: 'was / were' },
  'noun-negative': { segmentIndex: 3, pattern: '〜じゃありません', meaning: 'is not (noun)' },
  'kara-made': { segmentIndex: 3, pattern: '〜から〜まで', meaning: 'from … until', options: rangeParticles },
  'to-with': { segmentIndex: 3, pattern: '〜と', meaning: 'together with', options: companionParticles },
  'de-place': { segmentIndex: 3, pattern: '〜で', meaning: 'where an action happens', options: placeParticles },
  'ni-time': { segmentIndex: 3, pattern: '〜に', meaning: 'at a set time', options: placeParticles },
  'mo-also': { segmentIndex: 1, pattern: '〜も', meaning: 'too / also', options: topicParticles },

  passive: { segmentIndex: 4, pattern: 'passive form', meaning: 'was done to me' },
  causative: { segmentIndex: 6, pattern: 'causative form', meaning: 'made someone do' },
  'te-ageru': { segmentIndex: 6, pattern: '〜てあげる', meaning: 'do for someone' },
  'te-morau': { segmentIndex: 6, pattern: '〜てもらう', meaning: 'have someone do' },
  'te-kureru': { segmentIndex: 4, pattern: '〜てくれる', meaning: 'someone does for me' },
  rashii: { segmentIndex: 3, pattern: '〜らしいです', meaning: 'I hear that' },
  'sou-appearance': { segmentIndex: 3, pattern: '〜そうです', meaning: 'looks like' },
  kamoshirenai: { segmentIndex: 2, pattern: '〜かもしれません', meaning: 'might' },
  'te-oku': { segmentIndex: 5, pattern: '〜ておく', meaning: 'do in advance' },
  'te-shimau': { segmentIndex: 4, pattern: '〜てしまう', meaning: 'end up doing' },
  'tame-ni': { segmentIndex: 4, pattern: '〜のために', meaning: 'for the sake of', options: purposeChoices },
  'you-ni-naru': { segmentIndex: 4, pattern: '〜ようになる', meaning: 'become able to' },

  bakari: { segmentIndex: 3, pattern: '〜ばかり', meaning: 'nothing but', options: limitChoices },
  hazu: { segmentIndex: 4, pattern: '〜はずです', meaning: 'is expected to', replacement: '着く___', replacementReading: 'つく', answer: 'はずです。', options: modalChoices },
  beki: { segmentIndex: 1, pattern: '〜べきです', meaning: 'ought to', replacement: '休む___', replacementReading: 'やすむ', answer: 'べきです。', options: modalChoices },
  'wake-dewa-nai': { segmentIndex: 1, pattern: '〜わけではない', meaning: 'it is not that' },
  'you-ni-suru': { segmentIndex: 3, pattern: '〜ようにする', meaning: 'make an effort to' },
  'toori-ni': { segmentIndex: 2, pattern: '〜とおりに', meaning: 'just as', options: clauseChoices },
  'ni-yotte': { segmentIndex: 1, pattern: '〜によって', meaning: 'depending on', options: referenceChoices },
  'okage-de': { segmentIndex: 2, pattern: '〜おかげで', meaning: 'thanks to', options: causeChoices },
  'sei-de': { segmentIndex: 2, pattern: '〜せいで', meaning: 'because of (blame)', options: causeChoices },
  'tabi-ni': { segmentIndex: 4, pattern: '〜たびに', meaning: 'every time', options: clauseChoices },
  mama: { segmentIndex: 5, pattern: '〜まま', meaning: 'left as it is', options: clauseChoices },
  'uchi-ni': { segmentIndex: 1, pattern: '〜うちに', meaning: 'while still', options: clauseChoices },
  hodo: { segmentIndex: 3, pattern: '〜ほど〜ない', meaning: 'not as … as', options: limitChoices },
  'ba-yokatta': { segmentIndex: 2, pattern: '〜ばよかった', meaning: 'wish I had' },
  sae: { segmentIndex: 3, pattern: '〜さえ', meaning: 'not even', options: limitChoices },
  'to-iu-name': { segmentIndex: 1, pattern: '〜という', meaning: 'called / named', options: quoteChoices },
  'dake-de-naku': { segmentIndex: 3, pattern: '〜だけでなく', meaning: 'not only', options: limitChoices },
  'you-da': { segmentIndex: 3, pattern: '〜ようです', meaning: 'it seems', replacement: 'いる___', replacementReading: 'いる', answer: 'ようです。', options: modalChoices },
}

const sourceExercises = grammarBuilderExercises.map((exercise) => {
  const shortId = exercise.id.replace('sent-grammar-', '')
  const focus = focusById[shortId]
  if (!focus || !exercise.segments || !exercise.jlpt) {
    throw new Error(`Grammar practice setup is missing ${exercise.id}`)
  }

  return {
    source: {
      id: exercise.id,
      jlpt: exercise.jlpt as GrammarJlptLevel,
      english: exercise.english,
      segments: exercise.segments,
      readings: exercise.segmentReadings ?? exercise.segments,
    },
    focus,
  }
})

/** Grammar choice drills made from every curated grammar sentence in Sentence Builder. */
export const grammarPracticeExercises: GrammarPracticeExercise[] = buildDrillExercises(sourceExercises)
