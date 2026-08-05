export type AchievementMetrics = {
  battleAttempts: number
  bossVictories: number
  perfectVictories: number
  scenesRead: number
  furiganaFreeScenes: number
  readQuestIds: string[]
  furiganaFreeQuestIds: string[]
  defeatedGuardianIds: string[]
  perfectGuardianIds: string[]
}

const STORAGE_KEY = 'kanji-quest-achievement-metrics-v1'

const EMPTY_METRICS: AchievementMetrics = {
  battleAttempts: 0,
  bossVictories: 0,
  perfectVictories: 0,
  scenesRead: 0,
  furiganaFreeScenes: 0,
  readQuestIds: [],
  furiganaFreeQuestIds: [],
  defeatedGuardianIds: [],
  perfectGuardianIds: [],
}

export function loadAchievementMetrics(): AchievementMetrics {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored ? { ...EMPTY_METRICS, ...JSON.parse(stored) } : { ...EMPTY_METRICS }
  } catch {
    return { ...EMPTY_METRICS }
  }
}

function save(metrics: AchievementMetrics) {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(metrics)) } catch { /* keep in memory */ }
  return metrics
}

export function recordQuestScene(metrics: AchievementMetrics, questId: string, furiganaFree: boolean) {
  return save({
    ...metrics,
    scenesRead: metrics.scenesRead + 1,
    furiganaFreeScenes: metrics.furiganaFreeScenes + (furiganaFree ? 1 : 0),
    readQuestIds: [...new Set([...metrics.readQuestIds, questId])],
    furiganaFreeQuestIds: furiganaFree ? [...new Set([...metrics.furiganaFreeQuestIds, questId])] : metrics.furiganaFreeQuestIds,
  })
}

export function recordBossBattle(metrics: AchievementMetrics, questId: string, won: boolean, perfect: boolean) {
  return save({
    ...metrics,
    battleAttempts: metrics.battleAttempts + 1,
    bossVictories: metrics.bossVictories + (won ? 1 : 0),
    perfectVictories: metrics.perfectVictories + (won && perfect ? 1 : 0),
    defeatedGuardianIds: won ? [...new Set([...metrics.defeatedGuardianIds, questId])] : metrics.defeatedGuardianIds,
    perfectGuardianIds: won && perfect ? [...new Set([...metrics.perfectGuardianIds, questId])] : metrics.perfectGuardianIds,
  })
}
