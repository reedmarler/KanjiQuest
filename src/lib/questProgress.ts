export type QuestStep = 'vocab' | 'kanji' | 'grammar' | 'scene' | 'checkpoint'

export const QUEST_STEPS: readonly QuestStep[] = ['vocab', 'kanji', 'grammar', 'scene', 'checkpoint']

export type QuestProgress = Record<string, Partial<Record<QuestStep, true>>>

export interface ChapterRoadProgress {
  currentGateIndex: number
  clearedGateIds: string[]
}

export interface QuestRoadProgress {
  souls: number
  chapters: Record<string, ChapterRoadProgress>
}

const STORAGE_KEY = 'kanji-quest-progress-v1'
const ROAD_STORAGE_KEY = 'kanji-quest-road-progress-v1'

const EMPTY_ROAD_PROGRESS: QuestRoadProgress = { souls: 0, chapters: {} }

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

export function completeQuest(progress: QuestProgress, questId: string): QuestProgress {
  const completed = Object.fromEntries(QUEST_STEPS.map((step) => [step, true])) as Record<QuestStep, true>
  const next = { ...progress, [questId]: completed }
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* keep in memory */ }
  return next
}

export function completedQuestSteps(progress: QuestProgress, questId: string) {
  return QUEST_STEPS.filter((step) => progress[questId]?.[step]).length
}

export function isQuestComplete(progress: QuestProgress, questId: string) {
  return completedQuestSteps(progress, questId) === QUEST_STEPS.length
}

function saveQuestRoadProgress(progress: QuestRoadProgress) {
  try { window.localStorage.setItem(ROAD_STORAGE_KEY, JSON.stringify(progress)) } catch { /* keep in memory */ }
}

export function loadQuestRoadProgress(): QuestRoadProgress {
  try {
    const stored = window.localStorage.getItem(ROAD_STORAGE_KEY)
    if (!stored) return EMPTY_ROAD_PROGRESS

    const parsed = JSON.parse(stored) as Partial<QuestRoadProgress>
    return {
      souls: typeof parsed.souls === 'number' && parsed.souls >= 0 ? parsed.souls : 0,
      chapters: parsed.chapters && typeof parsed.chapters === 'object' ? parsed.chapters : {},
    }
  } catch {
    return EMPTY_ROAD_PROGRESS
  }
}

export function chapterRoadProgress(progress: QuestRoadProgress, chapterId: string): ChapterRoadProgress {
  const stored = progress.chapters[chapterId]
  return {
    currentGateIndex: Math.max(0, stored?.currentGateIndex ?? 0),
    clearedGateIds: Array.isArray(stored?.clearedGateIds) ? stored.clearedGateIds : [],
  }
}

export function clearRoadGate(
  progress: QuestRoadProgress,
  chapterId: string,
  gateId: string,
  gateIndex: number,
  gateCount: number,
  reward: number,
): { progress: QuestRoadProgress; firstClear: boolean } {
  const chapter = chapterRoadProgress(progress, chapterId)
  const firstClear = !chapter.clearedGateIds.includes(gateId)
  const currentGateIndex = Math.max(chapter.currentGateIndex, Math.min(gateIndex + 1, gateCount - 1))
  const next: QuestRoadProgress = {
    souls: progress.souls + (firstClear ? reward : 0),
    chapters: {
      ...progress.chapters,
      [chapterId]: {
        currentGateIndex,
        clearedGateIds: firstClear ? [...chapter.clearedGateIds, gateId] : chapter.clearedGateIds,
      },
    },
  }

  saveQuestRoadProgress(next)
  return { progress: next, firstClear }
}
