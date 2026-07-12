interface SessionCompleteProps {
  reviewed: number
  correct: number
  onHome: () => void
  onContinue?: () => void
  title?: string
  message?: React.ReactNode
}

export function SessionComplete({
  reviewed,
  correct,
  onHome,
  onContinue,
  title,
  message,
}: SessionCompleteProps) {
  const pct = reviewed > 0 ? Math.round((correct / reviewed) * 100) : 0

  return (
    <div className="session-complete">
      <div className="complete-icon">🎉</div>
      <h2>{title ?? 'Session complete!'}</h2>
      <p className="complete-stats">
        {message ?? (
          <>
            You reviewed <strong>{reviewed}</strong> cards with <strong>{pct}%</strong> accuracy.
          </>
        )}
      </p>
      <div className="complete-actions">
        {onContinue && (
          <button className="btn btn-primary" onClick={onContinue}>
            Keep studying
          </button>
        )}
        <button className="btn btn-secondary" onClick={onHome}>
          Back to dashboard
        </button>
      </div>
    </div>
  )
}
