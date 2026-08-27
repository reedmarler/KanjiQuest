import type { StudyCard } from '../lib/types'

/**
 * Adjectives not already covered elsewhere in the deck, added from a
 * user-curated priority list (general descriptors, personality, emotion,
 * quality/evaluation, and food words). Most of these are also wired into
 * categorySentenceEngine.ts's adjectiveRules so they can appear in generated
 * sentences, not just flashcards — see that file for the category/tag rules.
 */
export const vocabAdjectiveCards: StudyCard[] = [
  { id: 'vocab-adj-hayai', type: 'vocab', front: '速い', reading: 'hayai', back: 'fast', jlpt: 'N4' },
  { id: 'vocab-adj-atatakai', type: 'vocab', front: '温かい', reading: 'atatakai', back: 'warm (to touch/feel)', jlpt: 'N4' },
  { id: 'vocab-adj-suzushii', type: 'vocab', front: '涼しい', reading: 'suzushii', back: 'cool (weather)', jlpt: 'N5' },
  { id: 'vocab-adj-tsumetai', type: 'vocab', front: '冷たい', reading: 'tsumetai', back: 'cold (to touch)', jlpt: 'N5' },
  { id: 'vocab-adj-atsui-touch', type: 'vocab', front: '熱い', reading: 'atsui', back: 'hot (object/liquid)', jlpt: 'N5' },
  { id: 'vocab-adj-yawarakai', type: 'vocab', front: '柔らかい', reading: 'yawarakai', back: 'soft', jlpt: 'N3' },
  { id: 'vocab-adj-katai', type: 'vocab', front: '硬い', reading: 'katai', back: 'hard', jlpt: 'N3' },
  { id: 'vocab-adj-atsui-thick', type: 'vocab', front: '厚い', reading: 'atsui', back: 'thick', jlpt: 'N3' },
  { id: 'vocab-adj-usui', type: 'vocab', front: '薄い', reading: 'usui', back: 'thin', jlpt: 'N3' },
  { id: 'vocab-adj-marui', type: 'vocab', front: '丸い', reading: 'marui', back: 'round', jlpt: 'N4' },
  { id: 'vocab-adj-kitanai', type: 'vocab', front: '汚い', reading: 'kitanai', back: 'dirty', jlpt: 'N5' },
  { id: 'vocab-adj-mezurashii', type: 'vocab', front: '珍しい', reading: 'mezurashii', back: 'rare; unusual', jlpt: 'N3' },
  { id: 'vocab-adj-shinsen', type: 'vocab', front: '新鮮', reading: 'shinsen', back: 'fresh', jlpt: 'N3' },

  { id: 'vocab-adj-shinsetsu', type: 'vocab', front: '親切', reading: 'shinsetsu', back: 'kind; helpful', jlpt: 'N5' },
  { id: 'vocab-adj-majime', type: 'vocab', front: '真面目', reading: 'majime', back: 'serious; diligent', jlpt: 'N4' },
  { id: 'vocab-adj-shoujiki', type: 'vocab', front: '正直', reading: 'shoujiki', back: 'honest', jlpt: 'N3' },
  { id: 'vocab-adj-teinei', type: 'vocab', front: '丁寧', reading: 'teinei', back: 'polite; careful', jlpt: 'N4' },
  { id: 'vocab-adj-kashikoi', type: 'vocab', front: '賢い', reading: 'kashikoi', back: 'clever; wise', jlpt: 'N3' },
  { id: 'vocab-adj-sunao', type: 'vocab', front: '素直', reading: 'sunao', back: 'honest; obedient', jlpt: 'N2' },
  { id: 'vocab-adj-ganko', type: 'vocab', front: '頑固', reading: 'ganko', back: 'stubborn', jlpt: 'N2' },
  { id: 'vocab-adj-reisei', type: 'vocab', front: '冷静', reading: 'reisei', back: 'calm; level-headed', jlpt: 'N2' },
  { id: 'vocab-adj-shinchou', type: 'vocab', front: '慎重', reading: 'shinchou', back: 'cautious', jlpt: 'N2' },

  { id: 'vocab-adj-fukou', type: 'vocab', front: '不幸', reading: 'fukou', back: 'unhappy', jlpt: 'N3' },
  { id: 'vocab-adj-fuan', type: 'vocab', front: '不安', reading: 'fuan', back: 'anxious', jlpt: 'N3' },
  { id: 'vocab-adj-manzoku', type: 'vocab', front: '満足', reading: 'manzoku', back: 'satisfied', jlpt: 'N3' },
  { id: 'vocab-adj-fuman', type: 'vocab', front: '不満', reading: 'fuman', back: 'dissatisfied', jlpt: 'N2' },

  { id: 'vocab-adj-tekisetsu', type: 'vocab', front: '適切', reading: 'tekisetsu', back: 'appropriate', jlpt: 'N2' },
  { id: 'vocab-adj-futekisetsu', type: 'vocab', front: '不適切', reading: 'futekisetsu', back: 'inappropriate', jlpt: 'N2' },
  { id: 'vocab-adj-koukateki', type: 'vocab', front: '効果的', reading: 'koukateki', back: 'effective', jlpt: 'N2' },
  { id: 'vocab-adj-seikaku', type: 'vocab', front: '正確', reading: 'seikaku', back: 'accurate', jlpt: 'N2' },
  { id: 'vocab-adj-gutaiteki', type: 'vocab', front: '具体的', reading: 'gutaiteki', back: 'concrete; specific', jlpt: 'N2' },
  { id: 'vocab-adj-genjitsuteki', type: 'vocab', front: '現実的', reading: 'genjitsuteki', back: 'realistic', jlpt: 'N2' },
  { id: 'vocab-adj-ippanteki', type: 'vocab', front: '一般的', reading: 'ippanteki', back: 'general; common', jlpt: 'N2' },
  { id: 'vocab-adj-shinkoku', type: 'vocab', front: '深刻', reading: 'shinkoku', back: 'serious; severe', jlpt: 'N2' },
  { id: 'vocab-adj-kanou', type: 'vocab', front: '可能', reading: 'kanou', back: 'possible', jlpt: 'N3' },
  { id: 'vocab-adj-fukanou', type: 'vocab', front: '不可能', reading: 'fukanou', back: 'impossible', jlpt: 'N2' },

  { id: 'vocab-adj-yutaka', type: 'vocab', front: '豊か', reading: 'yutaka', back: 'rich; abundant', jlpt: 'N2' },
  { id: 'vocab-adj-mazushii', type: 'vocab', front: '貧しい', reading: 'mazushii', back: 'poor', jlpt: 'N2' },

  // The N2 とはいえ concession frame concedes this one, and it was the only
  // adjective in that pool the deck did not already carry.
  { id: 'vocab-adj-jimi', type: 'vocab', front: '地味', reading: 'jimi', back: 'plain; subdued', jlpt: 'N3' },
]
