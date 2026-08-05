import { QUESTS } from './questCampaign'
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

  return [
    { id: 'first-footstep', category: 'Journey', icon: '足', title: 'First Footstep', description: 'Complete any quest step.', progress: totalQuestSteps, target: 1, reward: 'Traveler seal' },
    { id: 'first-quest', category: 'Journey', icon: '灯', title: 'Lantern Bearer', description: 'Complete your first full quest.', progress: completedQuests, target: 1, reward: 'Morning lantern' },
    { id: 'three-quests', category: 'Journey', icon: '道', title: 'Road Tested', description: 'Complete three quests.', progress: completedQuests, target: 3, reward: 'Bronze road seal' },
    { id: 'campaign', category: 'Journey', icon: '鳥', title: 'Everyday Japan', description: 'Complete the first campaign.', progress: completedQuests, target: QUESTS.length, reward: 'Campaign torii' },

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
  ]
}
