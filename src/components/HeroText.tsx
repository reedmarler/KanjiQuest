import { useEffect, useState } from 'react'
import { FuriganaSegment } from './FuriganaText'
import { heroReadingForDisplay } from '../lib/heroSentenceGloss'
import { splitHighlightedText } from '../lib/heroHighlightTone'

export type HeroRevealMode = 'in' | 'out' | 'held' | 'base'

interface HeroTextProps {
  text: string
  reading?: string
  highlight?: boolean
  reveal?: HeroRevealMode
  /** Animate held accent off without remounting (avoids flash at unhighlight) */
  unhighlight?: boolean
  plainSuffix?: string
  showFurigana?: boolean
  /** Hide ruby briefly, then fade readings in after this many ms (per text change) */
  delayedFuriganaMs?: number
  /** When false, ruby stays in layout but hidden until the reel settles */
  furiganaRevealReady?: boolean
}

function PlainSuffix({ suffix }: { suffix: string }) {
  if (!suffix) return null
  return <span className="hero-plain-suffix">{suffix}</span>
}

function furiganaVisibilityClass(
  layoutReading: string | undefined,
  showFurigana: boolean,
  usesDelayedFurigana: boolean,
  furiganaRevealed: boolean,
): string {
  if (!layoutReading) return ''
  if (!showFurigana) return ' is-furigana-off'
  if (!usesDelayedFurigana) return ''
  return furiganaRevealed ? ' is-furigana-revealed' : ' is-furigana-pending'
}

export function HeroText({
  text,
  reading,
  highlight = false,
  reveal,
  unhighlight = false,
  plainSuffix = '',
  showFurigana = true,
  delayedFuriganaMs,
  furiganaRevealReady = true,
}: HeroTextProps) {
  const { stem, suffix, stemReading } = splitHighlightedText(text, reading, plainSuffix)
  const layoutReading = heroReadingForDisplay(stem, stemReading)
  const usesDelayedFurigana = Boolean(delayedFuriganaMs)

  const [furiganaRevealed, setFuriganaRevealed] = useState(
    () => !usesDelayedFurigana,
  )

  useEffect(() => {
    if (!usesDelayedFurigana) {
      setFuriganaRevealed(true)
      return
    }

    if (!layoutReading || !furiganaRevealReady || !showFurigana) {
      setFuriganaRevealed(false)
      return
    }

    setFuriganaRevealed(false)
    const id = window.setTimeout(() => {
      setFuriganaRevealed(true)
    }, delayedFuriganaMs)

    return () => window.clearTimeout(id)
  }, [
    text,
    layoutReading,
    usesDelayedFurigana,
    delayedFuriganaMs,
    furiganaRevealReady,
    showFurigana,
  ])

  const furiganaClass = furiganaVisibilityClass(
    layoutReading,
    showFurigana,
    usesDelayedFurigana,
    furiganaRevealed,
  )

  if (reveal === 'base') {
    return (
      <span
        className={[
          'hero-text',
          'hero-text-reveal',
          'hero-text-reveal-ttb',
          furiganaClass.trim(),
        ].filter(Boolean).join(' ')}
      >
        <span className="hero-reveal-stem">
          <span className="hero-reveal-base">
            <FuriganaSegment
              text={stem}
              reading={layoutReading}
              className="hero-furigana"
            />
          </span>
          <span className="hero-reveal-accent hero-reveal-accent-cleared" aria-hidden>
            <FuriganaSegment
              text={stem}
              reading={layoutReading}
              className="hero-furigana"
            />
          </span>
        </span>
        <PlainSuffix suffix={suffix} />
      </span>
    )
  }

  if (reveal === 'in') {
    return (
      <span
        className={[
          'hero-text',
          'hero-text-reveal',
          'hero-text-reveal-ttb',
          unhighlight ? 'is-unhighlighting' : '',
          furiganaClass.trim(),
        ].filter(Boolean).join(' ')}
      >
        <span className="hero-reveal-stem">
          <span className="hero-reveal-base" aria-hidden>
            <FuriganaSegment
              text={stem}
              reading={layoutReading}
              className="hero-furigana"
            />
          </span>
          <span className="hero-reveal-accent hero-reveal-accent-ttb">
            <FuriganaSegment
              text={stem}
              reading={layoutReading}
              className="hero-furigana"
            />
          </span>
        </span>
        <PlainSuffix suffix={suffix} />
      </span>
    )
  }

  if (reveal === 'held') {
    return (
      <span
        className={[
          'hero-text',
          'hero-text-reveal',
          'hero-text-reveal-ttb',
          unhighlight ? 'is-unhighlighting' : '',
          furiganaClass.trim(),
        ].filter(Boolean).join(' ')}
      >
        <span className="hero-reveal-stem">
          <span className="hero-reveal-base" aria-hidden>
            <FuriganaSegment
              text={stem}
              reading={layoutReading}
              className="hero-furigana"
            />
          </span>
          <span
            className={[
              'hero-reveal-accent',
              'hero-reveal-accent-held',
              'is-held',
            ].join(' ')}
          >
            <FuriganaSegment
              text={stem}
              reading={layoutReading}
              className="hero-furigana"
            />
          </span>
        </span>
        <PlainSuffix suffix={suffix} />
      </span>
    )
  }

  if (reveal === 'out') {
    return (
      <span className={`hero-text hero-text-reveal hero-text-reveal-ttb${furiganaClass}`}>
        <span className="hero-reveal-stem">
          <span className="hero-reveal-base" aria-hidden>
            <FuriganaSegment
              text={stem}
              reading={layoutReading}
              className="hero-furigana"
            />
          </span>
          <span className="hero-reveal-accent hero-reveal-unhighlight-ttb">
            <FuriganaSegment
              text={stem}
              reading={layoutReading}
              className="hero-furigana"
            />
          </span>
        </span>
        <PlainSuffix suffix={suffix} />
      </span>
    )
  }

  const className = [
    'hero-text',
    highlight ? 'hero-text-highlight' : '',
    furiganaClass,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <span className={className}>
      <FuriganaSegment
        text={stem}
        reading={layoutReading}
        className="hero-furigana"
      />
      <PlainSuffix suffix={suffix} />
    </span>
  )
}
