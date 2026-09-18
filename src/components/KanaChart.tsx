import type { BeginnerScript } from '../data/beginnerMnemonics'
import { AppBackButton, AppDashboardButton } from './AppBackButton'
import { KanaChartPanel } from './KanaChartPanel'

type ChartScript = Extract<BeginnerScript, 'hiragana' | 'katakana'>

interface KanaChartProps {
  script: ChartScript
  onBack: () => void
  onDashboard: () => void
  onOpenQuiz: () => void
  /** Jumps to the other script's chart — hiragana's heading offers カナ,
   *  katakana's offers かな. */
  onSwitchScript: () => void
  /** Any character opens the learner right there, cycling the rest of its
   *  row from that point rather than jumping to the row's own first
   *  character. */
  onSelectCharacter: (rowIndex: number, charIndex: number) => void
}

export function KanaChart({ script, onBack, onDashboard, onOpenQuiz, onSwitchScript, onSelectCharacter }: KanaChartProps) {
  return (
    <main className={`hiragana-chart-page hiragana-chart-page--${script}`}>
      <div className="app-nav-actions">
        <AppBackButton onClick={onBack} aria-label="Back to Beginner Zone" />
        <AppDashboardButton onClick={onDashboard} />
      </div>
      <KanaChartPanel
        script={script}
        onOpenQuiz={onOpenQuiz}
        onSwitchScript={onSwitchScript}
        onSelectCharacter={onSelectCharacter}
      />
    </main>
  )
}
