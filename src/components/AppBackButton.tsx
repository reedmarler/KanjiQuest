import type { ButtonHTMLAttributes } from 'react'

interface AppBackButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  label?: string
}

export function AppBackButton({ label = 'Back', className = '', ...props }: AppBackButtonProps) {
  return (
    <span className="app-back-slot">
      <button
        type="button"
        className={`app-back-button${className ? ` ${className}` : ''}`}
        aria-label={props['aria-label'] ?? label}
        {...props}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <polyline points="15 5 8 12 15 19" />
        </svg>
        <span>{label}</span>
      </button>
    </span>
  )
}

type AppDashboardButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'children'>

export function AppDashboardButton({ className = '', ...props }: AppDashboardButtonProps) {
  return (
    <button
      type="button"
      className={`app-dashboard-button${className ? ` ${className}` : ''}`}
      aria-label={props['aria-label'] ?? 'Return to Dashboard'}
      title={props.title ?? 'Return to Dashboard'}
      {...props}
    >
      <span aria-hidden="true">KQ</span>
    </button>
  )
}
