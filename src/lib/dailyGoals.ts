import { useCallback, useEffect, useRef, useState } from 'react'
import { markStudiedToday } from './storage'

const GOALS_STORAGE_KEY = 'kanji-quest-daily-goals-v1'
const GOALS_EVENT = 'kanji-quest-daily-goals-change'

export type DailyGoalId = 'sentence' | 'kanji' | 'vocab' | 'kana' | 'quest'

export type DailyGoal = {
  id: DailyGoalId
  mark: string
  title: string
  detail: string
}

export const DAILY_GOALS: readonly DailyGoal[] = [
  { id: 'sentence', mark: '文', title: 'Read a sentence', detail: 'Home rotator' },
  { id: 'kanji', mark: '漢', title: 'Study kanji', detail: 'Readings and forms' },
  { id: 'vocab', mark: '語', title: 'Study vocab', detail: 'Focused words' },
  { id: 'kana', mark: 'あ', title: 'Practice kana', detail: 'Hiragana chart' },
  { id: 'quest', mark: '旅', title: 'Continue a quest', detail: 'Campaign path' },
]

type DailyGoalSave = {
  date: string
  done: DailyGoalId[]
}

function todayKey() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function isGoalId(value: unknown): value is DailyGoalId {
  return DAILY_GOALS.some((goal) => goal.id === value)
}

export function loadDailyGoalProgress() {
  const date = todayKey()
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(GOALS_STORAGE_KEY) ?? 'null')
    if (!parsed || typeof parsed !== 'object') return { date, done: [] as DailyGoalId[] }
    const save = parsed as Partial<DailyGoalSave>
    if (save.date !== date || !Array.isArray(save.done)) return { date, done: [] as DailyGoalId[] }
    return { date, done: save.done.filter(isGoalId) }
  } catch {
    return { date, done: [] as DailyGoalId[] }
  }
}

function saveDailyGoalProgress(done: DailyGoalId[]) {
  try {
    window.localStorage.setItem(GOALS_STORAGE_KEY, JSON.stringify({ date: todayKey(), done }))
  } catch {
    // A full store should not break ticking a goal in this session.
  }
  window.dispatchEvent(new Event(GOALS_EVENT))
}

export function dailyGoalPercent(doneCount: number) {
  return DAILY_GOALS.length > 0 ? Math.round((doneCount / DAILY_GOALS.length) * 100) : 0
}

export function useDailyGoals() {
  const [done, setDone] = useState<DailyGoalId[]>(() => loadDailyGoalProgress().done)
  // See useUserProfile: persisting dispatches a DOM event other subscribers
  // react to, so it must not run inside a render-phase setState updater.
  const doneRef = useRef(done)
  doneRef.current = done

  useEffect(() => {
    function sync() {
      setDone(loadDailyGoalProgress().done)
    }
    window.addEventListener(GOALS_EVENT, sync)
    return () => window.removeEventListener(GOALS_EVENT, sync)
  }, [])

  const commit = useCallback((next: DailyGoalId[]) => {
    doneRef.current = next
    setDone(next)
    saveDailyGoalProgress(next)
  }, [])

  const toggleGoal = useCallback((id: DailyGoalId) => {
    const current = doneRef.current
    if (current.includes(id)) {
      commit(current.filter((item) => item !== id))
    } else {
      commit([...current, id])
      markStudiedToday()
    }
  }, [commit])

  const completeGoal = useCallback((id: DailyGoalId) => {
    const current = doneRef.current
    if (current.includes(id)) return
    commit([...current, id])
    markStudiedToday()
  }, [commit])

  return {
    goals: DAILY_GOALS,
    done,
    doneCount: done.length,
    percent: dailyGoalPercent(done.length),
    toggleGoal,
    completeGoal,
    isDone: (id: DailyGoalId) => done.includes(id),
  }
}
