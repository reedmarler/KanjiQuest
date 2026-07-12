/**
 * LLM-vetted sentence viability cache.
 * Regenerate with: npm run vet:sentences
 * Requires OPENAI_API_KEY in environment.
 */
export const HERO_SENTENCE_VIABILITY: Record<string, boolean> = {
  // Known bad combos (also caught by heuristics)
  'お茶が早い': false,
  'お茶が遅い': false,
  'コーヒーが早い': false,
  '寿司が早い': false,
  'お茶が忙しい': false,
  'パンを聞く': false,
  'パンを聞きます': false,
  'パンを聞いた': false,
  'みんなはパンをもう聞く': false,
}
