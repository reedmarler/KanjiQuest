/**
 * Batch-vet hero rotator sentences with OpenAI.
 *
 * Usage:
 *   set OPENAI_API_KEY=sk-...
 *   npm run vet:sentences
 *
 * Writes src/data/heroSentenceViability.ts with approved/rejected map.
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildHeroSteps } from '../src/lib/heroSequence'
import { segmentsToJapanese } from '../src/lib/posSentenceEngine'
import type { JlptLevel } from '../src/lib/types'

const LEVELS: JlptLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1', 'All']
const BATCH_SIZE = 25
const MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini'
const OUT_PATH = join(process.cwd(), 'src/data/heroSentenceViability.ts')

const SYSTEM_PROMPT = `You judge Japanese example sentences for a language-learning flashcard app.

For each numbered sentence, decide if it is NATURAL and SEMANTICALLY SENSIBLE for learners.

Reject if:
- Grammar is broken
- Word pairing is nonsense (e.g. お茶が早い, 図書館を食べる, 小説を行く)
- Meaning is absurd or confusing for a study example

Approve if:
- A native speaker might naturally say it (or it's a valid learner example)
- Verb-object and adjective-noun pairings make sense

Reply with ONLY a JSON object: { "1": true, "2": false, ... } using booleans.`

async function vetBatch(sentences: string[]): Promise<boolean[]> {
  const key = process.env.OPENAI_API_KEY
  if (!key) {
    throw new Error('Set OPENAI_API_KEY environment variable')
  }

  const numbered = sentences.map((s, i) => `${i + 1}. ${s}`).join('\n')

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: numbered },
      ],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI API ${res.status}: ${err}`)
  }

  const data = await res.json() as {
    choices: { message: { content: string } }[]
  }
  const raw = data.choices[0]?.message?.content ?? '{}'
  const parsed = JSON.parse(raw) as Record<string, boolean>

  return sentences.map((_, i) => {
    const v = parsed[String(i + 1)]
    return v !== false
  })
}

function collectSentences(): string[] {
  const seen = new Set<string>()
  for (const level of LEVELS) {
    const steps = buildHeroSteps({} as import('../src/lib/wrongPool').WrongPool, {}, level)
    for (const step of steps) {
      const jp = segmentsToJapanese(step.frame.segments ?? [])
      if (jp) seen.add(jp)
    }
  }
  return [...seen]
}

function writeViabilityFile(map: Record<string, boolean>) {
  const entries = Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b, 'ja'))
    .map(([jp, ok]) => `  ${JSON.stringify(jp)}: ${ok},`)
    .join('\n')

  const content = `/**
 * LLM-vetted sentence viability cache.
 * Regenerate with: npm run vet:sentences
 * Requires OPENAI_API_KEY in environment.
 * Generated: ${new Date().toISOString()}
 */
export const HERO_SENTENCE_VIABILITY: Record<string, boolean> = {
${entries}
}
`
  writeFileSync(OUT_PATH, content, 'utf8')
}

async function main() {
  const sentences = collectSentences()
  console.log(`Collected ${sentences.length} unique sentences`)

  const viability: Record<string, boolean> = {}
  let approved = 0
  let rejected = 0

  for (let i = 0; i < sentences.length; i += BATCH_SIZE) {
    const batch = sentences.slice(i, i + BATCH_SIZE)
    console.log(`Vetting batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(sentences.length / BATCH_SIZE)}...`)
    const results = await vetBatch(batch)
    for (let j = 0; j < batch.length; j++) {
      const jp = batch[j]!
      const ok = results[j]!
      viability[jp] = ok
      if (ok) approved++
      else rejected++
    }
    await new Promise((r) => setTimeout(r, 300))
  }

  writeViabilityFile(viability)
  console.log(`Done: ${approved} approved, ${rejected} rejected`)
  console.log(`Wrote ${OUT_PATH}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
