/**
 * Audition provider voices before committing a library to one of them.
 *
 * Paste voice ids from the provider dashboard, then play the same line
 * through each and compare. This deliberately bypasses speakJapanese: that
 * path prefers a pre-rendered clip, which is keyed by text alone, so every
 * voice would play back as whichever one the library was built in. Here each
 * request goes straight to the service with an explicit voice_id.
 *
 * Live synthesis is billed per character, so the panel keeps a running count
 * of what the session has spent and shows it next to the play controls.
 */
import { useEffect, useRef, useState } from 'react'
import { ttsServiceUrl } from '../lib/speech'

const STORAGE_KEY = 'kanji-quest-voice-test-v1'

/** Real content, so an audition reflects what the app actually says rather
 *  than a phrase chosen to flatter the voice. The hero lines are kana-only
 *  with no word boundaries — the hardest thing the app asks of an engine, and
 *  where voices differ most. */
const SAMPLE_LINES = [
  { label: 'Vocab word', text: 'みず' },
  { label: 'Short phrase', text: 'せいとわせいこうしたいです' },
  { label: 'Hero sentence', text: 'わたしわへやをよやくしておきます' },
  { label: 'Long hero line', text: 'これからもがくせいわずつうやくをのんでいきます。' },
] as const

interface SavedVoice {
  id: string
  label: string
}

function loadVoices(): SavedVoice[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((v): v is SavedVoice =>
      typeof v === 'object' && v !== null && typeof (v as SavedVoice).id === 'string')
  } catch {
    return []
  }
}

/** Turns the service's status codes into something actionable. Each one means
 *  a different fix, and "it didn't work" hides which. */
function describeFailure(status: number) {
  if (status === 402) return 'Monthly character budget reached. Raise TTS_MONTHLY_CHARACTER_BUDGET and restart the service.'
  if (status === 409) return 'Service is in cache-only mode, so it will not synthesize anything new. Restart it with TTS_CACHE_ONLY=false.'
  if (status === 429) return 'Rate limited. The service allows a limited number of requests per minute — wait, or raise TTS_RATE_LIMIT_REQUESTS.'
  if (status === 502) return 'The provider rejected it. Usually a voice id that does not exist on the account, or an API key without text-to-speech permission.'
  if (status === 422) return 'The service rejected the request — text may be empty or longer than 400 characters.'
  return `Service returned ${status}.`
}

export function VoiceTest({ onBack }: { onBack: () => void }) {
  const [voices, setVoices] = useState<SavedVoice[]>(loadVoices)
  const [draftId, setDraftId] = useState('')
  const [draftLabel, setDraftLabel] = useState('')
  const [text, setText] = useState<string>(SAMPLE_LINES[2].text)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [spent, setSpent] = useState(0)
  const [service, setService] = useState<'checking' | 'up' | 'down' | 'unset'>('checking')
  const [serviceNote, setServiceNote] = useState('')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const objectUrlRef = useRef<string | null>(null)

  const serviceUrl = ttsServiceUrl()

  useEffect(() => {
    if (!serviceUrl) {
      setService('unset')
      return
    }
    let cancelled = false
    fetch(`${serviceUrl}/health`)
      .then((r) => r.ok ? r.json() : Promise.reject(new Error(String(r.status))))
      .then((health: { provider?: string; cache_only?: boolean; budget?: { remaining?: number | null } }) => {
        if (cancelled) return
        setService('up')
        const bits = [health.provider ?? 'unknown provider']
        if (health.cache_only) bits.push('cache-only — new synthesis refused')
        if (typeof health.budget?.remaining === 'number') bits.push(`${health.budget.remaining.toLocaleString()} characters left this month`)
        setServiceNote(bits.join(' · '))
      })
      .catch(() => { if (!cancelled) setService('down') })
    return () => { cancelled = true }
  }, [serviceUrl])

  // Revoke the previous blob url rather than leaking one per play.
  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
  }, [])

  function saveVoices(next: SavedVoice[]) {
    setVoices(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // A full or blocked localStorage should not stop an audition.
    }
  }

  function addVoice() {
    const id = draftId.trim()
    if (!id || voices.some((v) => v.id === id)) return
    saveVoices([...voices, { id, label: draftLabel.trim() || `Voice ${voices.length + 1}` }])
    setDraftId('')
    setDraftLabel('')
  }

  async function play(voice: SavedVoice) {
    const line = text.trim()
    if (!line || !serviceUrl) return

    setBusyId(voice.id)
    setErrors((current) => ({ ...current, [voice.id]: '' }))

    try {
      const response = await fetch(`${serviceUrl}/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: line, speed: 1, voice_id: voice.id }),
      })
      if (!response.ok) throw new Error(describeFailure(response.status))

      const blob = await response.blob()
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = URL.createObjectURL(blob)

      audioRef.current?.pause()
      const audio = new Audio(objectUrlRef.current)
      audioRef.current = audio
      await audio.play()

      // Counted after a success: a refused request is never billed, and the
      // service replays a cached clip free, so this is an upper bound.
      setSpent((total) => total + [...line].length)
    } catch (error) {
      setErrors((current) => ({ ...current, [voice.id]: (error as Error).message }))
    } finally {
      setBusyId(null)
    }
  }

  const canPlay = service === 'up' && text.trim().length > 0

  return (
    <section className="voice-test" aria-labelledby="voice-test-title">
      <header className="voice-test-top">
        <button type="button" className="btn btn-ghost" onClick={onBack}>← Back</button>
        <h2 id="voice-test-title" className="voice-test-title">Voice Test</h2>
      </header>

      <p className="voice-test-intro">
        Paste voice ids from the provider dashboard and play the same line through each.
        Every play is live synthesis billed per character — the pre-rendered library is
        skipped on purpose, since it only holds the voice it was built in.
      </p>

      <div className={`voice-test-service is-${service}`} role="status">
        {service === 'checking' && <span>Checking for the speech service…</span>}
        {service === 'up' && <span><b>Service ready</b> — {serviceNote}</span>}
        {service === 'down' && (
          <span>
            <b>No speech service at {serviceUrl}</b> — start it with{' '}
            <code>uvicorn app:app --port 8001</code> in <code>backend/tts_service</code>,
            with an API key in its environment. Auditioning needs a live provider.
          </span>
        )}
        {service === 'unset' && (
          <span>
            <b>No service configured.</b> This build has no <code>VITE_TTS_API_URL</code>,
            so there is nothing to synthesize through. Run the app with <code>npm run dev</code> to
            reach a local service.
          </span>
        )}
      </div>

      <div className="voice-test-sample">
        <span className="voice-test-label">Line to speak</span>
        <div className="voice-test-presets">
          {SAMPLE_LINES.map((sample) => (
            <button
              key={sample.label}
              type="button"
              className={`voice-test-preset${text === sample.text ? ' is-selected' : ''}`}
              onClick={() => setText(sample.text)}
            >
              {sample.label}
            </button>
          ))}
        </div>
        <textarea
          className="voice-test-text"
          value={text}
          rows={2}
          maxLength={400}
          onChange={(event) => setText(event.target.value)}
          aria-label="Text to speak"
        />
        <span className="voice-test-count">{[...text].length}/400 characters per play, per voice</span>
      </div>

      <div className="voice-test-add">
        <span className="voice-test-label">Add a voice</span>
        <div className="voice-test-add-row">
          <input
            className="voice-test-input"
            value={draftId}
            placeholder="Voice ID (e.g. EbuvaInXUGWtpYRUnKLQ)"
            onChange={(event) => setDraftId(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') addVoice() }}
            aria-label="Voice ID"
          />
          <input
            className="voice-test-input voice-test-input-label"
            value={draftLabel}
            placeholder="Name (optional)"
            onChange={(event) => setDraftLabel(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') addVoice() }}
            aria-label="Voice name"
          />
          <button type="button" className="btn btn-secondary" onClick={addVoice} disabled={!draftId.trim()}>Add</button>
        </div>
      </div>

      {voices.length === 0 ? (
        <p className="voice-test-empty">No voices yet. Paste an id above to start comparing.</p>
      ) : (
        <ul className="voice-test-list">
          {voices.map((voice) => (
            <li key={voice.id} className="voice-test-item">
              <div className="voice-test-item-main">
                <strong className="voice-test-item-label">{voice.label}</strong>
                <code className="voice-test-item-id">{voice.id}</code>
                {errors[voice.id] && <span className="voice-test-error">{errors[voice.id]}</span>}
              </div>
              <div className="voice-test-item-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!canPlay || busyId !== null}
                  onClick={() => play(voice)}
                >
                  {busyId === voice.id ? 'Speaking…' : 'Play'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  aria-label={`Remove ${voice.label}`}
                  onClick={() => saveVoices(voices.filter((v) => v.id !== voice.id))}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="voice-test-spend">
        Spent this session: <b>{spent.toLocaleString()} characters</b>
        {spent > 0 && <span> — roughly {Math.round(spent / 2).toLocaleString()} credits on a flash model, {spent.toLocaleString()} on multilingual.</span>}
      </p>

      <p className="voice-test-footnote">
        Settled on one? Build the library in it with{' '}
        <code>TTS_DEFAULT_VOICE=&lt;id&gt; npm run build:voice</code>. The clips are keyed by
        text alone, so a library already on disk will not re-render in a new voice — clear{' '}
        <code>public/audio/</code> first.
      </p>
    </section>
  )
}
