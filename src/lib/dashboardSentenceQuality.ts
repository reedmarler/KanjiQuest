import type { GeneratedPreviewSentence } from './sentenceGeneratorPreview'

const studySubjects = new Set(['日本語', '英語', '中国語', '外国語', '漢字', '単語', '語彙', '文法', '発音', '数学', '歴史', '科学'])
const sendableItems = new Set(['手紙', 'はがき', '小包', '荷物', '箱', '書類', '資料', 'メール'])
const findableLostItems = new Set(['鍵', '財布', '手紙', '切符', 'チケット', '携帯電話', '電話', 'かばん', '傘'])

/**
 * The dashboard is read as an example of ordinary Japanese, so it has a
 * slightly higher naturalness bar than the wider sentence workbench.  This
 * rejects only context-dependent defaults; it does not limit the underlying
 * vocabulary or grammar available elsewhere in the app.
 */
export function isDashboardSentenceNatural(sentence: GeneratedPreviewSentence): boolean {
  // A bare catalog reference example (generatePreviewSentence's last-resort
  // fallback when the real generator fails for a seed) skips furigana/reading
  // entirely and carries no slots — it's meant for a "browse grammar
  // patterns" list, not for display as a live generated sentence. Every real
  // generator path always computes a non-empty reading, so this is a safe,
  // general way to catch that fallback wherever it leaks in (e.g. through the
  // linked-form feature) without special-casing each caller.
  if (!sentence.reading) return false

  const verb = sentence.slots.verb?.dictionaryForm
  const object = sentence.slots.object?.dictionaryForm

  if (verb === '勉強する' && object && !studySubjects.has(object)) return false
  if (verb === '送る' && object && !sendableItems.has(object)) return false
  if (verb === '見つける' && object && !findableLostItems.has(object)) return false
  if (verb === '亡くなる') return false

  if (/\bgo(?:es)? to the inside\b/i.test(sentence.english)) return false
  if (/^(?:Everyone|Everybody) knows it\.$/i.test(sentence.english)) return false
  if (/^(?:Oil|A cake) is not that I dislike/i.test(sentence.english)) return false

  return true
}
