import { allCards } from '../src/data'

const byFront = new Map<string, typeof allCards>()
for (const card of allCards) {
  if (card.type !== 'vocab') continue
  const list = byFront.get(card.front)
  if (list) list.push(card)
  else byFront.set(card.front, [card])
}

const dupes = [...byFront.entries()].filter(([, cards]) => cards.length > 1)
console.log(`Total vocab words: ${[...byFront.keys()].length}`)
console.log(`Words with duplicate entries: ${dupes.length}\n`)
for (const [front, cards] of dupes) {
  console.log(front, '->', cards.map((c) => `${c.id} [${c.jlpt ?? '?'}] "${c.back}"`).join(' | '))
}
