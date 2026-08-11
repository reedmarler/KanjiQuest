import { CAMPAIGN_ARCS, QUESTS } from './questCampaign'
import { completedQuestSteps, isQuestComplete, type QuestProgress } from '../lib/questProgress'
import type { AchievementMetrics } from '../lib/achievementProgress'

export type AchievementCategory = 'Journey' | 'Knowledge' | 'Reading' | 'Battle'

export type Achievement = {
  id: string
  category: AchievementCategory
  icon: string
  title: string
  description: string
  progress: number
  target: number
  reward: string
}

export type AchievementContext = {
  learnedCards: number
  favoriteSentences: number
  questProgress: QuestProgress
  metrics: AchievementMetrics
}

export function buildAchievements(context: AchievementContext): Achievement[] {
  const { learnedCards, favoriteSentences, questProgress, metrics } = context
  const totalQuestSteps = QUESTS.reduce((total, quest) => total + completedQuestSteps(questProgress, quest.id), 0)
  const completedQuests = QUESTS.filter((quest) => isQuestComplete(questProgress, quest.id)).length
  const arcCleared = (arcId: string) =>
    QUESTS.filter((quest) => quest.arcId === arcId).every((quest) => isQuestComplete(questProgress, quest.id)) ? 1 : 0
  const inkboundQuests = QUESTS.filter((quest) => quest.arcId === CAMPAIGN_ARCS[0]!.id)
  const inkboundCleared = inkboundQuests.filter((quest) => isQuestComplete(questProgress, quest.id)).length
  // Multi-phase guardians are the campaign's real bosses.
  const bossIds = QUESTS.filter((quest) => (quest.guardian.phases?.length ?? 0) > 1).map((quest) => quest.id)
  const bossesFelled = bossIds.filter((id) => metrics.defeatedGuardianIds.includes(id)).length
  const finaleId = QUESTS[QUESTS.length - 1]!.id

  return [
    { id: 'first-footstep', category: 'Journey', icon: '足', title: 'First Footstep', description: 'Complete any quest step.', progress: totalQuestSteps, target: 1, reward: 'Traveler seal' },
    { id: 'first-quest', category: 'Journey', icon: '灯', title: 'Lantern Bearer', description: 'Complete your first full quest.', progress: completedQuests, target: 1, reward: 'Morning lantern' },
    { id: 'three-quests', category: 'Journey', icon: '道', title: 'Road Tested', description: 'Complete three quests.', progress: completedQuests, target: 3, reward: 'Bronze road seal' },
    { id: 'inkbound-road', category: 'Journey', icon: '墨', title: 'The Inkbound Road', description: 'Clear every quest in Campaign I.', progress: inkboundCleared, target: inkboundQuests.length, reward: 'Campaign torii' },
    { id: 'hollow-lantern-arc', category: 'Journey', icon: '灯', title: 'Into the Hollow', description: 'Clear every quest in Campaign II.', progress: arcCleared(CAMPAIGN_ARCS[1]!.id), target: 1, reward: 'Hollow lantern' },
    { id: 'campaign', category: 'Journey', icon: '鳥', title: 'Everyday Japan', description: 'Complete every quest on the road.', progress: completedQuests, target: QUESTS.length, reward: 'Road master seal' },
    { id: 'relic-hoard', category: 'Journey', icon: '宝', title: 'Relic Hoard', description: 'Carry six relics at once.', progress: completedQuests, target: 6, reward: 'Treasure shelf' },

    { id: 'first-card', category: 'Knowledge', icon: '一', title: 'First Character', description: 'Master your first study card.', progress: learnedCards, target: 1, reward: 'Ink drop' },
    { id: 'twenty-five-cards', category: 'Knowledge', icon: '知', title: 'Gathering Knowledge', description: 'Master 25 study cards.', progress: learnedCards, target: 25, reward: 'Scholar ribbon' },
    { id: 'hundred-cards', category: 'Knowledge', icon: '百', title: 'Hundred Marks', description: 'Master 100 study cards.', progress: learnedCards, target: 100, reward: 'Silver inkstone' },
    { id: 'five-hundred-cards', category: 'Knowledge', icon: '学', title: 'Living Lexicon', description: 'Master 500 study cards.', progress: learnedCards, target: 500, reward: 'Golden brush' },

    { id: 'first-story', category: 'Reading', icon: '文', title: 'Story Walker', description: 'Finish a Japanese quest scene.', progress: metrics.scenesRead, target: 1, reward: 'Story page' },
    { id: 'five-stories', category: 'Reading', icon: '巻', title: 'Scroll Keeper', description: 'Read five different quest scenes.', progress: metrics.readQuestIds.length, target: 5, reward: 'Personal scroll' },
    { id: 'bare-kanji', category: 'Reading', icon: '眼', title: 'Uncovered Eyes', description: 'Finish a scene without turning on furigana.', progress: metrics.furiganaFreeQuestIds.length, target: 1, reward: 'Naked kanji seal' },
    { id: 'sentence-keeper', category: 'Reading', icon: '☆', title: 'Sentence Keeper', description: 'Save a sentence you want to remember.', progress: favoriteSentences, target: 1, reward: 'Archive shelf' },
    { id: 'sentence-archive', category: 'Reading', icon: '書', title: 'Personal Corpus', description: 'Save ten meaningful sentences.', progress: favoriteSentences, target: 10, reward: 'Mastery archive' },

    { id: 'first-challenge', category: 'Battle', icon: '刀', title: 'Draw the Blade', description: 'Challenge a quest guardian.', progress: metrics.battleAttempts, target: 1, reward: 'Wooden sword' },
    { id: 'first-victory', category: 'Battle', icon: '封', title: 'Yōkai Breaker', description: 'Defeat your first quest guardian.', progress: metrics.defeatedGuardianIds.length, target: 1, reward: 'Guardian seal' },
    { id: 'perfect-victory', category: 'Battle', icon: '誉', title: 'Untouched', description: 'Win a guardian battle without taking damage.', progress: metrics.perfectGuardianIds.length, target: 1, reward: 'Flawless crest' },
    { id: 'five-victories', category: 'Battle', icon: '武', title: 'Monster Scholar', description: 'Defeat five different guardians.', progress: metrics.defeatedGuardianIds.length, target: 5, reward: 'Dojo rank: 初段' },
    { id: 'boss-slayer', category: 'Battle', icon: '鬼', title: 'Phase Breaker', description: 'Defeat a guardian that fights in phases.', progress: bossesFelled, target: 1, reward: 'Broken mask' },
    { id: 'boss-hunter', category: 'Battle', icon: '討', title: 'Yōkai Hunter', description: 'Defeat every multi-phase guardian.', progress: bossesFelled, target: bossIds.length, reward: 'Hunter’s crest' },
    { id: 'flawless-three', category: 'Battle', icon: '無', title: 'Untouchable', description: 'Win three guardian battles without taking damage.', progress: metrics.perfectGuardianIds.length, target: 3, reward: 'Dojo rank: 三段' },
    { id: 'night-parade', category: 'Battle', icon: '百', title: 'End of the Night Parade', description: 'Defeat Nurarihyon and rekindle the lantern.', progress: metrics.defeatedGuardianIds.includes(finaleId) ? 1 : 0, target: 1, reward: 'Rekindled lantern' },
  ]
}
