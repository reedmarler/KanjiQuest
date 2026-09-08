import { useEffect, useRef } from 'react'
import { QUESTS } from '../data/questCampaign'
import { isQuestComplete, type QuestProgress } from '../lib/questProgress'

type UserProfileMenuProps = {
  open: boolean
  onClose: () => void
  learnedCount: number
  totalCards: number
  questProgress: QuestProgress
  currentLevelLabel: string
  furiganaOn: boolean
  englishOn: boolean
  speechOn: boolean
  speechSupported: boolean
  onToggleFurigana: () => void
  onToggleEnglish: () => void
  onToggleSpeech: () => void
  onOpenLearningSettings: () => void
  onOpenStudyTools: () => void
  onOpenQuests: () => void
  onOpenAchievements: () => void
}

function kanjiQuestStorageSnapshot() {
  const snapshot: Record<string, string> = {}
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index)
    if (!key) continue
    if (!key.startsWith('kanji-quest') && !key.startsWith('kq-beginner')) continue
    const value = window.localStorage.getItem(key)
    if (value !== null) snapshot[key] = value
  }
  return snapshot
}

export function UserProfileMenu({
  open,
  onClose,
  learnedCount,
  totalCards,
  questProgress,
  currentLevelLabel,
  furiganaOn,
  englishOn,
  speechOn,
  speechSupported,
  onToggleFurigana,
  onToggleEnglish,
  onToggleSpeech,
  onOpenLearningSettings,
  onOpenStudyTools,
  onOpenQuests,
  onOpenAchievements,
}: UserProfileMenuProps) {
  const importFileRef = useRef<HTMLInputElement | null>(null)
  const questsCleared = QUESTS.filter((quest) => isQuestComplete(questProgress, quest.id)).length
  const progressPct = totalCards > 0 ? Math.round((learnedCount / totalCards) * 100) : 0
  const questPct = QUESTS.length > 0 ? Math.round((questsCleared / QUESTS.length) * 100) : 0
  const dailyGoalPct = Math.min(100, Math.round((Math.min(learnedCount, 10) / 10) * 100))

  useEffect(() => {
    if (!open) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  function exportProgress() {
    const payload = {
      app: 'Kanji Quest',
      version: '0.0.0',
      exportedAt: new Date().toISOString(),
      localStorage: kanjiQuestStorageSnapshot(),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `kanji-quest-progress-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  function requestImportProgress() {
    importFileRef.current?.click()
  }

  async function importProgress(file: File | undefined) {
    if (!file) return
    const text = await file.text()
    const parsed: unknown = JSON.parse(text)
    if (
      !parsed
      || typeof parsed !== 'object'
      || !('localStorage' in parsed)
      || !parsed.localStorage
      || typeof parsed.localStorage !== 'object'
    ) {
      window.alert('That file does not look like a Kanji Quest progress export.')
      return
    }
    const entries = Object.entries(parsed.localStorage as Record<string, unknown>)
      .filter(([key, value]) => (key.startsWith('kanji-quest') || key.startsWith('kq-beginner')) && typeof value === 'string')
    if (entries.length === 0) {
      window.alert('No Kanji Quest progress data was found in that file.')
      return
    }
    const confirmed = window.confirm(`Import ${entries.length} saved Kanji Quest entries and reload the app?`)
    if (!confirmed) return
    entries.forEach(([key, value]) => window.localStorage.setItem(key, value as string))
    window.location.reload()
  }

  function resetLocalProgress() {
    const confirmed = window.confirm('Reset all local Kanji Quest progress on this device? This cannot be undone unless you exported a backup.')
    if (!confirmed) return
    Object.keys(kanjiQuestStorageSnapshot()).forEach((key) => window.localStorage.removeItem(key))
    window.location.reload()
  }

  return (
    <div className="dashboard-profile-layer">
      <button
        type="button"
        className="dashboard-profile-scrim"
        aria-label="Close user menu"
        onClick={onClose}
      />
      <aside className="dashboard-profile-menu" id="dashboard-profile-menu" aria-label="User menu">
        <header className="dashboard-profile-header">
          <span className="dashboard-profile-avatar" aria-hidden="true">R</span>
          <div>
            <small>Local profile</small>
            <h2>Reed</h2>
            <p>{learnedCount} learned · {questsCleared}/{QUESTS.length} quests</p>
          </div>
          <button type="button" className="dashboard-profile-close" onClick={onClose} aria-label="Close user menu">
            <span aria-hidden="true">&times;</span>
          </button>
        </header>

        <div className="dashboard-profile-today">
          <span>
            <small>Daily goal</small>
            <b>{Math.min(learnedCount, 10)}/10</b>
          </span>
          <i style={{ '--progress-pct': `${dailyGoalPct}%` } as React.CSSProperties} />
        </div>

        <section className="dashboard-profile-section" aria-label="Profile shortcuts">
          <button type="button" onClick={onOpenLearningSettings}>
            <span>Profile</span>
            <small>Local account</small>
          </button>
          <button type="button" onClick={onOpenLearningSettings}>
            <span>Learning settings</span>
            <small>{currentLevelLabel} · {furiganaOn ? 'Furigana' : 'No furi'} · {englishOn ? 'EN' : 'JP'}</small>
          </button>
          <button type="button" onClick={onOpenStudyTools}>
            <span>Daily goal</span>
            <small>{dailyGoalPct}%</small>
          </button>
          <button type="button" onClick={onOpenQuests}>
            <span>Progress history</span>
            <small>{progressPct}% · {questPct}%</small>
          </button>
          <button type="button" onClick={onOpenAchievements}>
            <span>Achievements</span>
            <small>Milestones</small>
          </button>
        </section>

        <section className="dashboard-profile-section dashboard-profile-preferences" aria-label="Study preferences">
          <span className="dashboard-profile-section-label">Study preferences</span>
          <button type="button" onClick={onOpenLearningSettings}>
            <span>Sentence difficulty</span>
            <small>{currentLevelLabel}</small>
          </button>
          <div className="dashboard-profile-toggle-row">
            <span>Furigana default</span>
            <button
              type="button"
              className={`dashboard-profile-switch${furiganaOn ? ' is-on' : ''}`}
              onClick={onToggleFurigana}
              aria-pressed={furiganaOn}
              aria-label={`Furigana default ${furiganaOn ? 'on' : 'off'}`}
            >
              <i />
            </button>
          </div>
          <div className="dashboard-profile-toggle-row">
            <span>English default</span>
            <button
              type="button"
              className={`dashboard-profile-switch${englishOn ? ' is-on' : ''}`}
              onClick={onToggleEnglish}
              aria-pressed={englishOn}
              aria-label={`English default ${englishOn ? 'on' : 'off'}`}
            >
              <i />
            </button>
          </div>
          <div className="dashboard-profile-toggle-row">
            <span>Voice</span>
            {!speechSupported && <small>Unavailable</small>}
            <button
              type="button"
              className={`dashboard-profile-switch${speechOn ? ' is-on' : ''}`}
              onClick={onToggleSpeech}
              disabled={!speechSupported}
              aria-pressed={speechOn}
              aria-label={`Voice ${speechOn ? 'on' : 'off'}`}
            >
              <i />
            </button>
          </div>
        </section>

        <section className="dashboard-profile-section dashboard-profile-data" aria-label="Data and account">
          <span className="dashboard-profile-section-label">Data and account</span>
          <button type="button" onClick={exportProgress}>
            <span>Export progress</span>
            <small>Backup</small>
          </button>
          <button type="button" onClick={requestImportProgress}>
            <span>Import progress</span>
            <small>Restore</small>
          </button>
          <button type="button" disabled>
            <span>Sign in / sync</span>
            <small>Local-only</small>
          </button>
          <button type="button" className="is-danger" onClick={resetLocalProgress}>
            <span>Reset local progress</span>
            <small>Clear</small>
          </button>
        </section>

        <footer className="dashboard-profile-footer">
          <span>Kanji Quest v0.0.0</span>
          <a href="mailto:feedback@kanji.quest">Feedback</a>
          <span>About Kanji Quest</span>
        </footer>

        <input
          ref={importFileRef}
          className="dashboard-profile-file"
          type="file"
          accept="application/json,.json"
          onChange={(event) => {
            void importProgress(event.currentTarget.files?.[0])
            event.currentTarget.value = ''
          }}
        />
      </aside>
    </div>
  )
}
