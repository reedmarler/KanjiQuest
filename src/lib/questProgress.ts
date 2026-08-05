export type QuestStep = 'vocab' | 'kanji' | 'grammar' | 'scene' | 'checkpoint'

export const QUEST_STEPS: readonly QuestStep[] = ['vocab', 'kanji', 'grammar', 'scene', 'checkpoint']

export type QuestProgress = Record<string, Partial<Record<QuestStep, true>>>

const STORAGE_KEY = 'kanji-quest-progress-v1'

export function loadQuestProgress(): QuestProgress {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) as QuestProgress : {}
  } catch {
    return {}
  }
}

export function completeQuestStep(progress: QuestProgress, questId: string, step: QuestStep): QuestProgress {
  const next = { ...progress, [questId]: { ...progress[questId], [step]: true } }
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* keep in memory */ }
  return next
}

export function completedQuestSteps(progress: QuestProgress, questId: string) {
  return QUEST_STEPS.filter((step) => progress[questId]?.[step]).length
}

export function isQuestComplete(progress: QuestProgress, questId: string) {
  return completedQuestSteps(progress, questId) === QUEST_STEPS.length
}
