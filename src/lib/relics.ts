import { QUESTS, type RelicPerk } from '../data/questCampaign'
import { isQuestComplete, type QuestProgress } from './questProgress'

export type EarnedRelic = {
  perk: RelicPerk
  name: string
  mark: string
  title: string
  description: string
  questId: string
}

/**
 * A relic is earned by finishing the quest that grants it, so the loadout is
 * derived from quest progress rather than stored separately — there is no way
 * for the two to drift apart.
 */
export function earnedRelics(progress: QuestProgress): EarnedRelic[] {
  return QUESTS.filter((quest) => isQuestComplete(progress, quest.id)).map((quest) => ({
    perk: quest.reward.perk,
    name: quest.reward.name,
    mark: quest.reward.mark,
    title: quest.reward.perkTitle,
    description: quest.reward.perkDescription,
    questId: quest.id,
  }))
}

export function hasRelic(progress: QuestProgress, perk: RelicPerk) {
  return earnedRelics(progress).some((relic) => relic.perk === perk)
}

/**
 * The battle screen needs plain flags rather than a list to branch on, and
 * the final relic ("Rekindled Flame") is a straight power-up on the rest of
 * the set rather than an effect of its own.
 */
export type RelicLoadout = {
  relics: EarnedRelic[]
  empowered: boolean
  dawnGuard: boolean
  secondWind: boolean
  clearPath: boolean
  trueSight: boolean
  perfectEdge: boolean
  changeFate: boolean
  ironWill: boolean
  twinStrike: boolean
  wardEcho: boolean
  kitsuneLuck: boolean
  mountainStance: boolean
}

export function buildRelicLoadout(progress: QuestProgress): RelicLoadout {
  const relics = earnedRelics(progress)
  const has = (perk: RelicPerk) => relics.some((relic) => relic.perk === perk)
  return {
    relics,
    empowered: has('lantern-flame'),
    dawnGuard: has('dawn-guard'),
    secondWind: has('second-wind'),
    clearPath: has('clear-path'),
    trueSight: has('true-sight'),
    perfectEdge: has('perfect-edge'),
    changeFate: has('change-fate'),
    ironWill: has('iron-will'),
    twinStrike: has('twin-strike'),
    wardEcho: has('ward-echo'),
    kitsuneLuck: has('kitsune-luck'),
    mountainStance: has('mountain-stance'),
  }
}

/** Streak length that triggers Perfect Edge — the finale relic sharpens it. */
export function perfectEdgeThreshold(loadout: RelicLoadout) {
  return loadout.empowered ? 2 : 3
}

/** Correct answers between Twin Strike procs. */
export function twinStrikeInterval(loadout: RelicLoadout) {
  return loadout.empowered ? 2 : 3
}

/** Chance for Fox Luck to void a mistake entirely. */
export function kitsuneLuckChance(loadout: RelicLoadout) {
  return loadout.empowered ? 0.45 : 0.25
}
