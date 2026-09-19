import assert from 'node:assert/strict'
import { inkRealmReducer as act, newInkRealmProgress, parseInkRealmProgress, realmClues, realmInventory, type InkRealmAction } from '../src/lib/inkRealmQuest'

let state = newInkRealmProgress()
assert.equal(act(state, { type: 'travel', location: 'pier' }), state)
assert.equal(act(state, { type: 'collect-seal' }), state)
assert.equal(act(state, { type: 'restore', now: 123 }), state)
state = act(state, { type: 'accept' })
assert.deepEqual(realmInventory(state), ['letter'])
state = act(state, { type: 'inspect', encounter: 'notice' })
assert.ok(realmClues(state).includes('description'))
assert.equal(act(state, { type: 'show-letter' }), state, 'The letter must be shown at the bridge')
state = act(state, { type: 'travel', location: 'pier' })
assert.equal(act(state, { type: 'collect-seal' }), state, 'The parcel cannot be taken before meeting its owner')
state = act(state, { type: 'inspect', encounter: 'large-boat' })
state = act(state, { type: 'travel', location: 'bridge' })
state = act(state, { type: 'inspect', encounter: 'porter' })
assert.equal(act(state, { type: 'inspect', encounter: 'porter' }), state, 'Repeated detours do not duplicate notes')
state = act(state, { type: 'show-letter' })
assert.ok(realmClues(state).includes('boat'))
state = parseInkRealmProgress(JSON.parse(JSON.stringify(state)))
assert.equal(state.phase, 'meeting', 'The middle of a quest survives a reload')
state = act(state, { type: 'travel', location: 'pier' })
state = act(state, { type: 'collect-seal' })
assert.ok(realmInventory(state).includes('seal'))
assert.equal(act(state, { type: 'restore', now: 123 }), state, 'Restoration requires returning to the gate')
state = act(state, { type: 'travel', location: 'gate' })
state = act(state, { type: 'restore', now: 123 })
assert.equal(state.phase, 'restored')
assert.deepEqual(realmInventory(state), ['stamp'])
assert.equal(act(state, { type: 'restore', now: 456 }), state, 'Rewards are idempotent')
state = act(state, { type: 'replay' })
assert.equal(state.phase, 'briefing')
assert.equal(state.completedAt, 123, 'Replay preserves the earned stamp')

for (const broken of [null, [], 42, { version: 5 }, { version: 1, phase: 'bogus', location: 'pier' }, { version: 1, phase: 'restored', location: 'gate', completedAt: null }]) {
  assert.deepEqual(parseInkRealmProgress(broken), newInkRealmProgress())
}
assert.deepEqual(parseInkRealmProgress({ version: 1, phase: 'searching', location: 'gate', encounters: ['notice', null, {}, 'notice', 'invented'] }).encounters, ['notice'])

// Explore every reachable story state, including all detour combinations.
const actions: InkRealmAction[] = [
  { type: 'accept' }, ...(['gate', 'bridge', 'pier'] as const).map((location) => ({ type: 'travel' as const, location })),
  ...(['notice', 'porter', 'large-boat'] as const).map((encounter) => ({ type: 'inspect' as const, encounter })),
  { type: 'show-letter' }, { type: 'collect-seal' }, { type: 'restore', now: 123 },
]
const seen = new Set<string>()
const queue = [newInkRealmProgress()]
while (queue.length) {
  const current = queue.shift()!
  const key = JSON.stringify({ ...current, encounters: [...current.encounters].sort() })
  if (seen.has(key)) continue
  seen.add(key)
  assert.deepEqual(parseInkRealmProgress(JSON.parse(JSON.stringify(current))), current)
  let finish = current
  const recovery: InkRealmAction[] = [
    { type: 'accept' }, { type: 'travel', location: 'bridge' }, { type: 'show-letter' },
    { type: 'travel', location: 'pier' }, { type: 'collect-seal' },
    { type: 'travel', location: 'gate' }, { type: 'restore', now: 123 },
  ]
  for (const action of recovery) finish = act(finish, action)
  assert.equal(finish.phase, 'restored', `No soft lock at ${key}`)
  for (const action of actions) queue.push(act(current, action))
}
console.log(`Ink Realm audit passed: ${seen.size} reachable states, save recovery, detours, item guards, replay, and one-time rewards.`)
