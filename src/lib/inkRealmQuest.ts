import type { RealmClue, RealmEncounter, RealmItem, RealmLocation, RealmPhase } from '../data/inkRealmQuest'

export const INK_REALM_SAVE_KEY = 'kanji-quest-ink-realm-v1'

export interface InkRealmProgress {
  version: 1
  phase: RealmPhase
  location: RealmLocation
  encounters: RealmEncounter[]
  completedAt: number | null
}

export type InkRealmAction =
  | { type: 'accept' }
  | { type: 'travel'; location: RealmLocation }
  | { type: 'inspect'; encounter: RealmEncounter }
  | { type: 'show-letter' }
  | { type: 'collect-seal' }
  | { type: 'restore'; now: number }
  | { type: 'replay' }

export function newInkRealmProgress(): InkRealmProgress {
  return { version: 1, phase: 'briefing', location: 'gate', encounters: [], completedAt: null }
}

export function inkRealmReducer(state: InkRealmProgress, action: InkRealmAction): InkRealmProgress {
  switch (action.type) {
    case 'accept':
      return state.phase === 'briefing' ? { ...state, phase: 'searching' } : state
    case 'travel':
      return state.phase === 'briefing' || state.location === action.location ? state : { ...state, location: action.location }
    case 'inspect': {
      const locations: Record<RealmEncounter, RealmLocation> = { notice: 'gate', porter: 'bridge', 'large-boat': 'pier' }
      if (state.phase === 'briefing' || state.phase === 'restored' || state.location !== locations[action.encounter] || state.encounters.includes(action.encounter)) return state
      return { ...state, encounters: [...state.encounters, action.encounter] }
    }
    case 'show-letter':
      return state.phase === 'searching' && state.location === 'bridge' ? { ...state, phase: 'meeting' } : state
    case 'collect-seal':
      return state.phase === 'meeting' && state.location === 'pier' ? { ...state, phase: 'recovered' } : state
    case 'restore':
      return state.phase === 'recovered' && state.location === 'gate' && Number.isFinite(action.now) && action.now > 0
        ? { ...state, phase: 'restored', completedAt: state.completedAt ?? action.now }
        : state
    case 'replay':
      return state.phase === 'restored' ? { ...newInkRealmProgress(), completedAt: state.completedAt } : state
  }
}

export function realmInventory(state: InkRealmProgress): RealmItem[] {
  if (state.phase === 'briefing') return []
  if (state.phase === 'recovered') return ['letter', 'seal']
  if (state.phase === 'restored') return ['stamp']
  return ['letter']
}

export function realmClues(state: InkRealmProgress): RealmClue[] {
  const clues: RealmClue[] = state.phase === 'briefing' ? [] : ['invitation']
  if (state.encounters.includes('notice')) clues.push('description')
  if (state.encounters.includes('porter')) clues.push('porter')
  if (['meeting', 'recovered', 'restored'].includes(state.phase)) clues.push('meeting', 'boat')
  if (state.encounters.includes('large-boat')) clues.push('wrongBoat')
  if (['recovered', 'restored'].includes(state.phase)) clues.push('return')
  if (state.phase === 'restored') clues.push('restored')
  return clues
}

export function realmObjective(state: InkRealmProgress): string {
  switch (state.phase) {
    case 'briefing': return 'Meet the village keeper'
    case 'searching': return 'Find the courier'
    case 'meeting': return 'Meet the courier at their boat'
    case 'recovered': return 'Return the seal to the gate lantern'
    case 'restored': return 'The first light is restored'
  }
}

export function parseInkRealmProgress(value: unknown): InkRealmProgress {
  if (!value || typeof value !== 'object') return newInkRealmProgress()
  const candidate = value as Partial<InkRealmProgress>
  const phases: RealmPhase[] = ['briefing', 'searching', 'meeting', 'recovered', 'restored']
  const locations: RealmLocation[] = ['gate', 'bridge', 'pier']
  if (candidate.version !== 1 || !phases.includes(candidate.phase as RealmPhase) || !locations.includes(candidate.location as RealmLocation)) return newInkRealmProgress()
  const completedAt = typeof candidate.completedAt === 'number' && Number.isFinite(candidate.completedAt) && candidate.completedAt > 0 ? candidate.completedAt : null
  // A completed chapter must carry its stamp; malformed saves must not grant one.
  if (candidate.phase === 'restored' && !completedAt) return newInkRealmProgress()
  return {
    version: 1,
    phase: candidate.phase!,
    location: candidate.phase === 'briefing' ? 'gate' : candidate.location!,
    encounters: Array.isArray(candidate.encounters) ? [...new Set(candidate.encounters.filter((event) => ['notice', 'porter', 'large-boat'].includes(event)))] : [],
    completedAt,
  }
}

export function loadInkRealmProgress(): InkRealmProgress {
  try { return parseInkRealmProgress(JSON.parse(window.localStorage.getItem(INK_REALM_SAVE_KEY) ?? 'null')) }
  catch { return newInkRealmProgress() }
}

export function saveInkRealmProgress(state: InkRealmProgress): boolean {
  try { window.localStorage.setItem(INK_REALM_SAVE_KEY, JSON.stringify(state)); return true }
  catch { return false }
}
