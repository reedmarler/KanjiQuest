export function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export function buildOptions(correct: string, distractors: string[]): string[] {
  const seen = new Set<string>()
  const options: string[] = []
  for (const value of [correct, ...distractors]) {
    if (seen.has(value)) continue
    seen.add(value)
    options.push(value)
    if (options.length >= 4) break
  }
  while (options.length < 4) options.push(correct)
  return shuffle(options)
}

export function renderSentence(sentence: string, highlight: string): { before: string; target: string; after: string } {
  const idx = sentence.indexOf(highlight)
  if (idx === -1) return { before: sentence, target: highlight, after: '' }
  return {
    before: sentence.slice(0, idx),
    target: highlight,
    after: sentence.slice(idx + highlight.length),
  }
}
