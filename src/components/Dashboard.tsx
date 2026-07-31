import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CardProgress, JlptLevel } from '../lib/types'
import type { WrongPool } from '../lib/wrongPool'
import { complexityDetails, GENERATION_COMPLEXITIES, heroJlptForComplexity, type GenerationComplexity } from '../lib/generationComplexity'
import { HERO_STORY_DEFINITIONS, HERO_STORY_LEVELS, getHeroStoriesForLevel } from '../data/heroStories'
import {
  HERO_PLAYBACK_RATES,
  HERO_SPEED_STORAGE_KEY,
  type HeroPlaybackRate,
} from '../lib/heroPlayback'

const RotatingHeroSentence = lazy(() => import('./RotatingHeroSentence').then((module) => ({ default: module.RotatingHeroSentence })))

function DashboardHeroSentence({
  wrongPool,
  progress,
  furiganaOn,
  englishOn,
  jlptLevel,
  storyId,
  storyLevel,
  paused,
  playbackRate,
  onRotate,
}: {
  wrongPool: WrongPool
  progress: Record<string, CardProgress>
  furiganaOn: boolean
  englishOn: boolean
  jlptLevel: ReturnType<typeof heroJlptForComplexity>
  storyId: string | null
  storyLevel: JlptLevel
  paused: boolean
  playbackRate: HeroPlaybackRate
  onRotate?: () => void
}) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Let the dashboard controls paint before the sentence data is requested.
    const timer = window.setTimeout(() => setReady(true), 900)
    return () => window.clearTimeout(timer)
  }, [])

  if (!ready) return <div className="hero-sentence-loading" aria-hidden="true" />

  return (
    <Suspense fallback={<div className="hero-sentence-loading" aria-hidden="true" />}>
      <RotatingHeroSentence
        wrongPool={wrongPool}
        progress={progress}
        displayMode="sentence"
        furiganaOn={furiganaOn}
        englishOn={englishOn}
        delayedFurigana={false}
        jlptLevel={jlptLevel}
        storyId={storyId}
        storyLevel={storyLevel}
        paused={paused}
        playbackRate={playbackRate}
        onRotate={onRotate}
      />
    </Suspense>
  )
}

const HERO_ROTATIONS_PER_SPEED_BUMP = 50

function savedPlaybackRate(): HeroPlaybackRate {
  if (typeof window === 'undefined') return 0.5
  const stored = Number(window.localStorage.getItem(HERO_SPEED_STORAGE_KEY))
  return HERO_PLAYBACK_RATES.includes(stored as HeroPlaybackRate) ? stored as HeroPlaybackRate : 0.5
}

interface DashboardProps {
  learnedCount: number
  totalCards: number
  wrongPool: WrongPool
  progress: Record<string, CardProgress>
  onOpenSentencePractice: () => void
  onOpenGrammar: () => void
  onOpenVocabList: () => void
  onOpenVocabPractice: () => void
  onOpenKanji: () => void
  onOpenContentStudio: () => void
  onOpenFavoriteSentences: () => void
  onOpenSentenceTesting: () => void
}

export function Dashboard({
  learnedCount,
  totalCards,
  onOpenSentencePractice,
  onOpenGrammar,
  onOpenVocabList,
  onOpenVocabPractice,
  onOpenKanji,
  onOpenContentStudio,
  onOpenFavoriteSentences,
  onOpenSentenceTesting,
  wrongPool,
  progress,
}: DashboardProps) {
  const [furiganaOn, setFuriganaOn] = useState(true)
  const [englishOn, setEnglishOn] = useState(true)
  const [complexity, setComplexity] = useState<GenerationComplexity>(1)
  const [storyMode, setStoryMode] = useState(false)
  const [storyId, setStoryId] = useState(HERO_STORY_DEFINITIONS[0]?.id ?? '')
  const [storyLevel, setStoryLevel] = useState<JlptLevel>(HERO_STORY_LEVELS[0] ?? 'N5')
  const storiesAtLevel = useMemo(() => getHeroStoriesForLevel(storyLevel), [storyLevel])
  const [paused, setPaused] = useState(false)
  const [playbackRate, setPlaybackRate] = useState<HeroPlaybackRate>(savedPlaybackRate)
  const [additionalOpen, setAdditionalOpen] = useState(false)

  const progressPct = totalCards > 0 ? Math.round((learnedCount / totalCards) * 100) : 0
  const furiganaActive = furiganaOn

  function toggleFurigana() {
    setFuriganaOn((on) => !on)
  }

  function toggleEnglish() {
    setEnglishOn((on) => !on)
  }

  useEffect(() => {
    window.localStorage.setItem(HERO_SPEED_STORAGE_KEY, String(playbackRate))
  }, [playbackRate])

  const speedIndex = HERO_PLAYBACK_RATES.indexOf(playbackRate)

  const rotationCountRef = useRef(0)
  const handleRotate = useCallback(() => {
    rotationCountRef.current += 1
    if (rotationCountRef.current < HERO_ROTATIONS_PER_SPEED_BUMP) return
    rotationCountRef.current = 0
    setPlaybackRate((current) => {
      const currentIndex = HERO_PLAYBACK_RATES.indexOf(current)
      const nextRate = HERO_PLAYBACK_RATES[currentIndex + 1]
      return nextRate ?? current
    })
  }, [])

  return (
    <div className="dashboard">
      <header className="hero hero-compact">
        <h1>Kanji Quest</h1>
        <DashboardHeroSentence
          wrongPool={wrongPool}
          progress={progress}
          furiganaOn={furiganaOn}
          englishOn={englishOn}
          jlptLevel={heroJlptForComplexity(complexity)}
          storyId={storyMode ? storyId : null}
          storyLevel={storyLevel}
          paused={paused}
          playbackRate={playbackRate}
          onRotate={handleRotate}
        />
      </header>

      <section className="hero-controls" aria-label="Sentence controls">
        <div className="hero-controls-row">
          <div className="control-group" role="group" aria-label="Playback">
            <button
              type="button"
              className={`control-play${paused ? ' is-paused' : ''}`}
              onClick={() => setPaused((value) => !value)}
              aria-pressed={paused}
            >
              <span className="control-play-icon" aria-hidden="true">{paused ? '▶' : '❚❚'}</span>
              {paused ? 'Play' : 'Pause'}
            </button>
            <div className="control-stepper" role="group" aria-label="Sentence speed">
              <button
                type="button"
                aria-label="Slow down sentence"
                disabled={speedIndex === 0}
                onClick={() => setPlaybackRate(HERO_PLAYBACK_RATES[speedIndex - 1]!)}
              >
                −
              </button>
              <button
                type="button"
                className="control-stepper-value"
                aria-label={`Sentence speed ${playbackRate} times, tap to reset`}
                onClick={() => setPlaybackRate(0.5)}
              >
                {playbackRate}×
              </button>
              <button
                type="button"
                aria-label="Speed up sentence"
                disabled={speedIndex === HERO_PLAYBACK_RATES.length - 1}
                onClick={() => setPlaybackRate(HERO_PLAYBACK_RATES[speedIndex + 1]!)}
              >
                +
              </button>
            </div>
          </div>

          <div className="control-group" role="group" aria-label="Display">
            <button
              type="button"
              className={`control-chip${furiganaActive ? ' is-active' : ''}`}
              onClick={toggleFurigana}
              aria-pressed={furiganaActive}
            >
              <span className="control-chip-jp" aria-hidden="true">ふり</span>
              Furigana
            </button>
            <button
              type="button"
              className={`control-chip${englishOn ? ' is-active' : ''}`}
              onClick={toggleEnglish}
              aria-pressed={englishOn}
            >
              <span className="control-chip-jp" aria-hidden="true">EN</span>
              English
            </button>
          </div>
        </div>

        <div className="hero-controls-row">
          <div className="control-group control-group-levels">
            <span className="control-group-label" id="hero-level-label">Level</span>
            <div className="control-segmented control-segmented-difficulty" role="group" aria-labelledby="hero-level-label">
              {GENERATION_COMPLEXITIES.map((level) => (
                <button
                  key={level}
                  type="button"
                  data-difficulty={level}
                  className={`control-segment${complexity === level ? ' is-active' : ''}`}
                  onClick={() => setComplexity(level)}
                  aria-pressed={complexity === level}
                  aria-label={`Generation complexity level ${level}: ${complexityDetails[level].description}`}
                  title={complexityDetails[level].description}
                >
                  <span className="control-segment-bars" aria-hidden="true">
                    {GENERATION_COMPLEXITIES.map((bar) => (
                      <span key={bar} className={`control-segment-bar${bar <= level ? ' is-filled' : ''}`} />
                    ))}
                  </span>
                  {level}
                </button>
              ))}
            </div>
          </div>

          <div className={`control-group control-group-story${storyMode ? ' is-active' : ''}`}>
            <button
              type="button"
              className={`control-chip control-chip-story${storyMode ? ' is-active' : ''}`}
              onClick={() => setStoryMode((enabled) => !enabled)}
              aria-pressed={storyMode}
            >
              <span className="control-chip-jp" aria-hidden="true">物</span>
              Story
            </button>
            {HERO_STORY_LEVELS.length > 1 && (
              <div className="control-segmented control-segmented-story" role="group" aria-label="Story level">
                {HERO_STORY_LEVELS.map((level) => (
                  <button
                    key={level}
                    type="button"
                    className={`control-segment${level === storyLevel ? ' is-active' : ''}`}
                    aria-pressed={level === storyLevel}
                    onClick={() => setStoryLevel(level)}
                  >
                    {level}
                  </button>
                ))}
              </div>
            )}
            <select
              className="control-select"
              value={storyId}
              onChange={(event) => {
                setStoryId(event.target.value)
                setStoryMode(true)
              }}
              aria-label="Choose story"
            >
              {storiesAtLevel.map((story) => (
                <option key={story.id} value={story.id}>{story.shortTitle}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="progress-section progress-compact">
        <div className="progress-header">
          <span>Progress</span>
          <span>{progressPct}%</span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
      </section>

      <section className="five-minute-study" aria-labelledby="five-minute-study-title">
        <div className="five-minute-study-heading">
          <div>
            <h2 id="five-minute-study-title">5-minute study</h2>
          </div>
          <p>Choose one quick focused session.</p>
        </div>
        <div className="practice-grid">
          <button type="button" className="practice-card" onClick={onOpenSentencePractice}>
            <span className="practice-emoji">文</span>
            <span className="practice-label">Sentences</span>
          </button>
          <button type="button" className="practice-card practice-card-grammar" onClick={onOpenGrammar}>
            <span className="practice-emoji">文法</span>
            <span className="practice-label">Grammar</span>
          </button>
          <button
            type="button"
            className="practice-card practice-card-vocab-practice"
            onClick={onOpenVocabPractice}
          >
            <span className="practice-emoji">語彙</span>
            <span className="practice-label">Vocab</span>
          </button>
          <button type="button" className="practice-card practice-card-kanji" onClick={onOpenKanji}>
            <span className="practice-emoji">漢</span>
            <span className="practice-label">Kanji</span>
          </button>
        </div>
      </section>

      <section className="dashboard-additional" aria-labelledby="dashboard-additional-title">
        <button
          type="button"
          className="dashboard-additional-toggle"
          onClick={() => setAdditionalOpen((open) => !open)}
          aria-expanded={additionalOpen}
        >
          <div className="dashboard-additional-heading">
            <h2 id="dashboard-additional-title">Additional</h2>
            <p>Browse, save, and shape your study library.</p>
          </div>
          <span className={`dashboard-additional-chevron${additionalOpen ? ' is-open' : ''}`} aria-hidden="true">▾</span>
        </button>
        {additionalOpen && (
          <div className="dashboard-additional-actions">
            <button type="button" onClick={onOpenVocabList}>
              <span className="dashboard-additional-mark" aria-hidden="true">語</span>
              <span><b>Vocab List</b><small>Browse every word by level</small></span>
            </button>
            <button type="button" onClick={onOpenFavoriteSentences}>
              <span className="dashboard-additional-mark" aria-hidden="true">★</span>
              <span><b>Favorite Sentences</b><small>Come back to saved sentences</small></span>
            </button>
            <button type="button" onClick={onOpenContentStudio}>
              <span className="dashboard-additional-mark" aria-hidden="true">編</span>
              <span><b>Content Studio</b><small>Add and organize your own content</small></span>
            </button>
            <button type="button" onClick={onOpenSentenceTesting}>
              <span className="dashboard-additional-mark" aria-hidden="true">験</span>
              <span><b>Sentence Testing</b><small>Generate 15 sentences by complexity level</small></span>
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
