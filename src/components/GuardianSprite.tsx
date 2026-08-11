import type { ReactNode } from 'react'

/**
 * Hand-drawn SVG yōkai, one per quest guardian.
 *
 * These replace the old single-kanji placeholder. Everything is inline SVG
 * rather than bitmap art so individual parts — jaws, tails, eyes, limbs —
 * can be animated separately by the battle stylesheet, and so the sprites
 * stay crisp at any size and follow the light/dark palette.
 *
 * Shared part classes the stylesheet animates:
 *   gs-float  whole-body idle drift        gs-jaw   mouth / jaw
 *   gs-eye    eyes (blink + glow)          gs-limb  arms, claws, blades
 *   gs-sway   tails, hair, cloth           gs-aura  glow behind the body
 */
export type GuardianSpriteState = 'attacking' | 'hit' | 'critical-hit' | 'ultimate-hit' | 'defeated'

const AKANAME: ReactNode = (
  <g className="gs-float">
    <ellipse className="gs-aura" cx="60" cy="72" rx="34" ry="30" />
    <path className="gs-limb gs-limb-a" d="M32 66q-13 6-16 19" />
    <path className="gs-limb gs-limb-b" d="M88 66q13 6 16 19" />
    <path className="gs-body" d="M60 34q26 0 30 26t-30 32q-30-2-30-32t30-26z" />
    <path className="gs-shade" d="M60 34q26 0 30 26t-30 32q-8 0-14-3 22-6 24-30t-10-25z" />
    <ellipse className="gs-eye" cx="47" cy="56" rx="8" ry="9" />
    <ellipse className="gs-eye" cx="70" cy="55" rx="6" ry="7" />
    <circle className="gs-pupil" cx="45" cy="57" r="3.4" />
    <circle className="gs-pupil" cx="68" cy="56" r="2.6" />
    <path className="gs-jaw" d="M44 74q16 12 32 0-16 6-32 0z" />
    <path className="gs-tongue gs-sway" d="M56 76q-4 16-16 22 14 2 20-10z" />
  </g>
)

const JIKININKI: ReactNode = (
  <g className="gs-float">
    <ellipse className="gs-aura" cx="60" cy="66" rx="30" ry="36" />
    <path className="gs-limb gs-limb-a" d="M38 62q-16 10-18 26M20 88l-6 8M20 88l2 10" />
    <path className="gs-limb gs-limb-b" d="M84 62q16 10 18 26" />
    <path className="gs-body" d="M60 30q22 2 22 26 0 30-22 44-22-14-22-44 0-24 22-26z" />
    <path className="gs-rib" d="M46 60h28M45 70h30M47 80h26" />
    <ellipse className="gs-eye" cx="51" cy="44" rx="6" ry="7" />
    <ellipse className="gs-eye" cx="69" cy="44" rx="6" ry="7" />
    <circle className="gs-pupil" cx="50" cy="45" r="2.4" />
    <circle className="gs-pupil" cx="68" cy="45" r="2.4" />
    <path className="gs-jaw" d="M48 54q12 18 24 0-12 26-24 0z" />
    <path className="gs-fang" d="M53 58l3 7 3-7zM62 58l3 7 3-7z" />
  </g>
)

const TSURUBE: ReactNode = (
  <g className="gs-float">
    <path className="gs-rope gs-sway" d="M60 0v22" />
    <ellipse className="gs-aura" cx="60" cy="64" rx="32" ry="30" />
    <path className="gs-hair gs-sway" d="M60 22q-30 4-32 34 8-14 14-16-4 16 2 24 2-18 8-22-2 20 8 26 8-6 6-26 6 4 8 22 6-8 2-24 6 2 14 16-2-30-32-34z" />
    <circle className="gs-body" cx="60" cy="58" r="26" />
    <path className="gs-shade" d="M60 32a26 26 0 0 1 0 52q-6 0-11-2a26 26 0 0 0 11-50z" />
    <ellipse className="gs-eye" cx="49" cy="52" rx="8" ry="8" />
    <ellipse className="gs-eye" cx="71" cy="52" rx="8" ry="8" />
    <circle className="gs-pupil" cx="48" cy="54" r="3.2" />
    <circle className="gs-pupil" cx="70" cy="54" r="3.2" />
    <path className="gs-jaw" d="M42 68q18 20 36 0-18 10-36 0z" />
    <path className="gs-fang" d="M50 70l3 8 3-8zM64 70l3 8 3-8z" />
  </g>
)

const NOPPERA: ReactNode = (
  <g className="gs-float">
    <ellipse className="gs-aura" cx="60" cy="66" rx="30" ry="34" />
    <path className="gs-cloth gs-sway" d="M60 52q-26 6-30 50h60q-4-44-30-50z" />
    <path className="gs-cloth-fold" d="M60 56v46M46 62l-6 40M74 62l6 40" />
    <ellipse className="gs-body gs-face" cx="60" cy="40" rx="20" ry="24" />
    <path className="gs-shade" d="M60 16a20 24 0 0 1 0 48q-5 0-9-2a20 24 0 0 0 9-46z" />
    <path className="gs-hair" d="M40 34q4-22 20-22t20 22q-6-12-20-12t-20 12z" />
  </g>
)

const TENGU: ReactNode = (
  <g className="gs-float">
    <ellipse className="gs-aura" cx="60" cy="62" rx="36" ry="32" />
    <path className="gs-wing gs-sway" d="M34 44q-26-8-30 14 12-6 16-2-14 6-14 20 12-12 20-10-8 8-6 20 12-16 22-14z" />
    <path className="gs-wing gs-sway gs-wing-b" d="M86 44q26-8 30 14-12-6-16-2 14 6 14 20-12-12-20-10 8 8 6 20-12-16-22-14z" />
    <path className="gs-body" d="M60 26q24 2 24 28t-24 38q-24-12-24-38T60 26z" />
    <path className="gs-nose gs-limb" d="M58 54q-26 4-30 14 6 14 30 4z" />
    <path className="gs-brow" d="M48 40l16 4M74 40l-8 4" />
    <ellipse className="gs-eye" cx="54" cy="48" rx="7" ry="6" />
    <ellipse className="gs-eye" cx="74" cy="47" rx="6" ry="5" />
    <circle className="gs-pupil" cx="53" cy="49" r="2.8" />
    <circle className="gs-pupil" cx="73" cy="48" r="2.4" />
    <path className="gs-jaw" d="M56 70q14 8 24-2-10 12-24 2z" />
    <path className="gs-crest" d="M48 24h24l-4-10H52z" />
  </g>
)

const AMEONNA: ReactNode = (
  <g className="gs-float">
    <ellipse className="gs-aura" cx="60" cy="64" rx="32" ry="36" />
    <path className="gs-hair gs-sway" d="M60 16q-26 4-26 34 0 34 8 54 4-30 6-40 2 26 6 40 2-30 6-40 2 26 6 40 4-24 8-54 0-30-26-34z" />
    <ellipse className="gs-body gs-face" cx="60" cy="42" rx="17" ry="21" />
    <path className="gs-shade" d="M60 21a17 21 0 0 1 0 42q-4 0-8-2a17 21 0 0 0 8-40z" />
    <ellipse className="gs-eye" cx="53" cy="42" rx="5" ry="6" />
    <ellipse className="gs-eye" cx="68" cy="42" rx="5" ry="6" />
    <circle className="gs-pupil" cx="52" cy="43" r="2.2" />
    <circle className="gs-pupil" cx="67" cy="43" r="2.2" />
    <path className="gs-tear" d="M52 50v14M67 50v12" />
    <path className="gs-jaw" d="M55 54q6 6 11 0-5 4-11 0z" />
    <g className="gs-rain gs-sway">
      <path d="M26 30v12M34 48v10M92 34v12M84 52v9M20 60v9M100 62v9" />
    </g>
  </g>
)

const KUCHISAKE: ReactNode = (
  <g className="gs-float">
    <ellipse className="gs-aura" cx="60" cy="62" rx="32" ry="36" />
    <path className="gs-hair gs-sway" d="M60 12q-28 4-28 32 0 32 6 54 2-32 6-40 0 26 4 38 2-30 6-38 2 30 6 38 2-30 4-38 2 30 6 40 6-22 6-54 0-28-26-32z" />
    <ellipse className="gs-body gs-face" cx="60" cy="40" rx="18" ry="22" />
    <path className="gs-shade" d="M60 18a18 22 0 0 1 0 44q-4 0-8-2a18 22 0 0 0 8-42z" />
    <ellipse className="gs-eye" cx="52" cy="38" rx="6" ry="6" />
    <ellipse className="gs-eye" cx="68" cy="38" rx="6" ry="6" />
    <circle className="gs-pupil" cx="51" cy="39" r="2.6" />
    <circle className="gs-pupil" cx="67" cy="39" r="2.6" />
    <path className="gs-jaw gs-slit" d="M40 52q20 22 40 0-20 8-40 0z" />
    <path className="gs-slit-line" d="M40 52l-6-6M80 52l6-6" />
    <g className="gs-limb gs-scissors">
      <path d="M92 60l16 16M108 60l-16 16" />
      <circle cx="90" cy="58" r="3.6" />
      <circle cx="110" cy="58" r="3.6" />
    </g>
  </g>
)

const GASHADOKURO: ReactNode = (
  <g className="gs-float">
    <ellipse className="gs-aura" cx="60" cy="60" rx="40" ry="40" />
    <path className="gs-limb gs-limb-a" d="M30 58q-18 8-20 30M14 84l-8 6M14 84l0 10" />
    <path className="gs-limb gs-limb-b" d="M90 58q18 8 20 30M106 84l8 6M106 84l0 10" />
    <path className="gs-rib" d="M44 78h32M42 88h36M46 98h24M60 74v28" />
    <path className="gs-body gs-skull" d="M60 16q28 0 28 30 0 16-10 24H42q-10-8-10-24 0-30 28-30z" />
    <ellipse className="gs-socket" cx="48" cy="44" rx="9" ry="10" />
    <ellipse className="gs-socket" cx="72" cy="44" rx="9" ry="10" />
    <circle className="gs-eye gs-emberlight" cx="48" cy="45" r="3.6" />
    <circle className="gs-eye gs-emberlight" cx="72" cy="45" r="3.6" />
    <path className="gs-nasal" d="M60 52l-5 10h10z" />
    <path className="gs-jaw gs-teeth" d="M44 66h32M50 66v8M58 66v8M66 66v8" />
  </g>
)

const KITSUNE: ReactNode = (
  <g className="gs-float">
    <ellipse className="gs-aura" cx="60" cy="64" rx="36" ry="32" />
    <g className="gs-sway gs-tails">
      <path d="M84 66q26-16 30-40-6 26-24 38z" />
      <path d="M84 70q28-8 36-30-10 24-30 32z" />
      <path d="M84 74q30 0 40-18-14 20-38 22z" />
      <path d="M84 78q28 8 42-6-18 16-40 10z" />
      <path d="M84 82q24 14 40 6-20 14-40 0z" />
    </g>
    <path className="gs-body" d="M60 30q22 2 22 26t-22 36q-22-10-22-36t22-26z" />
    <path className="gs-ear" d="M40 34l-4-24 20 14zM80 34l4-24-20 14z" />
    <path className="gs-ear-inner" d="M42 30l-2-13 11 8zM78 30l2-13-11 8z" />
    <ellipse className="gs-eye" cx="50" cy="50" rx="7" ry="5" />
    <ellipse className="gs-eye" cx="70" cy="50" rx="7" ry="5" />
    <path className="gs-pupil gs-slitpupil" d="M50 46v9M70 46v9" />
    <path className="gs-snout" d="M60 60q-10 2-8 10 8 6 16 0 2-8-8-10z" />
    <circle className="gs-nose" cx="60" cy="62" r="3" />
    <path className="gs-jaw" d="M54 70q6 6 12 0-6 4-12 0z" />
    <path className="gs-mark" d="M44 40l6 4M76 40l-6 4" />
    <g className="gs-foxfire">
      <circle cx="26" cy="42" r="5" /><circle cx="18" cy="66" r="4" /><circle cx="30" cy="84" r="3.4" />
    </g>
  </g>
)

const YUREI: ReactNode = (
  <g className="gs-float">
    <ellipse className="gs-aura" cx="60" cy="58" rx="30" ry="38" />
    <path className="gs-cloth gs-sway gs-wisp" d="M60 48q-22 4-24 34-2 22 4 30 6-14 12-16-4 14 2 20 4-12 6-14 2 12 8 14-4-16 2-20 6 2 12 16 6-8 4-30-2-30-26-34z" />
    <path className="gs-cloth-fold" d="M48 60l24-6M50 74l20-6" />
    <ellipse className="gs-body gs-face" cx="60" cy="34" rx="16" ry="20" />
    <path className="gs-hair gs-sway" d="M60 12q-24 2-24 26 0 20 4 32 2-24 6-32 0 20 4 28 2-22 4-28 2 22 4 28 2-22 4-28 2 24 6 32 4-12 4-32 0-24-22-26z" />
    <path className="gs-triangle" d="M60 8l-9 12h18z" />
    <ellipse className="gs-eye gs-hollow" cx="53" cy="34" rx="5" ry="7" />
    <ellipse className="gs-eye gs-hollow" cx="67" cy="34" rx="5" ry="7" />
    <path className="gs-jaw" d="M55 46q5 8 10 0-5 5-10 0z" />
    <path className="gs-limb gs-limb-a gs-droop" d="M40 56q-14 4-16 18" />
    <path className="gs-limb gs-limb-b gs-droop" d="M80 56q14 4 16 18" />
  </g>
)

const YAMAUBA: ReactNode = (
  <g className="gs-float">
    <ellipse className="gs-aura" cx="60" cy="64" rx="34" ry="34" />
    <path className="gs-hair gs-sway" d="M60 10q-30 4-30 34 0 12 4 20 0-18 6-24-2 18 2 26 0-20 6-26-2 20 2 28 2-22 6-28 4 6 6 28 4-8 2-28 6 6 6 26 4-8 2-26 6 6 6 24 4-8 4-20 0-30-28-34z" />
    <path className="gs-body gs-hunch" d="M60 40q22 4 24 26t-24 32q-24-10-24-32t24-26z" />
    <ellipse className="gs-eye" cx="51" cy="54" rx="6" ry="5" />
    <ellipse className="gs-eye" cx="69" cy="54" rx="6" ry="5" />
    <circle className="gs-pupil" cx="50" cy="55" r="2.6" />
    <circle className="gs-pupil" cx="68" cy="55" r="2.6" />
    <path className="gs-wrinkle" d="M44 46l8 2M76 46l-8 2M46 64q6 4 12 2M74 64q-6 4-12 2" />
    <path className="gs-jaw" d="M52 70q8 8 16 0-8 5-16 0z" />
    <path className="gs-second-mouth gs-jaw2" d="M42 26q18 14 36 0-18 22-36 0z" />
    <path className="gs-fang" d="M50 28l3 7 3-7zM64 28l3 7 3-7z" />
    <path className="gs-limb gs-limb-a" d="M36 68q-16 6-18 24" />
    <path className="gs-limb gs-limb-b" d="M84 68q16 6 18 24" />
  </g>
)

const NURARIHYON: ReactNode = (
  <g className="gs-float">
    <ellipse className="gs-aura gs-boss-aura" cx="60" cy="62" rx="42" ry="42" />
    <path className="gs-cloth gs-sway" d="M60 62q-30 6-34 52h68q-4-46-34-52z" />
    <path className="gs-cloth-fold" d="M60 66v48M44 74l-8 40M76 74l8 40" />
    <path className="gs-kesa" d="M38 82l44-10 3 12-44 10z" />
    <path className="gs-body gs-gourd" d="M60 6q-16 0-22 22-8 26 6 36 8 6 16 6t16-6q14-10 6-36-6-22-22-22z" />
    <path className="gs-shade" d="M60 6q16 0 22 22 8 26-6 36-5 4-10 5 10-8 12-24 3-24-8-36-5-3-10-3z" />
    <path className="gs-brow" d="M46 44l14 3M78 44l-10 3" />
    <ellipse className="gs-eye gs-boss-eye" cx="52" cy="52" rx="7" ry="5" />
    <ellipse className="gs-eye gs-boss-eye" cx="72" cy="52" rx="6" ry="4.4" />
    <circle className="gs-pupil" cx="51" cy="52" r="2.8" />
    <circle className="gs-pupil" cx="71" cy="52" r="2.4" />
    <path className="gs-jaw" d="M54 62q10 5 16-1-8 9-16 1z" />
    <path className="gs-beard gs-sway" d="M56 66q-4 16 4 22 8-6 4-22z" />
    <g className="gs-teacup">
      <path className="gs-cup" d="M22 78h16l-2 9H24z" />
      <path className="gs-cup-handle" d="M38 80q6 1 5 5t-6 3" />
      <path className="gs-steam gs-sway" d="M27 72q3-5 0-9M34 72q3-5 0-9" />
    </g>
  </g>
)

const SPRITES: Record<string, ReactNode> = {
  'first-morning': AKANAME,
  'lunch-together': JIKININKI,
  'catch-the-train': TSURUBE,
  'lost-wallet': NOPPERA,
  'first-school-day': TENGU,
  'rainy-day': AMEONNA,
  'night-shift': KUCHISAKE,
  'hospital-visit': GASHADOKURO,
  'festival-mask': KITSUNE,
  'empty-apartment': YUREI,
  'mountain-path': YAMAUBA,
  'hollow-lantern': NURARIHYON,
}

export function hasGuardianSprite(questId: string | undefined) {
  return Boolean(questId && SPRITES[questId])
}

export function GuardianSprite({ questId, label, state, phase = 0 }: {
  questId: string
  label: string
  state?: GuardianSpriteState
  /** Later phases tint and intensify the same creature. */
  phase?: number
}) {
  const body = SPRITES[questId]
  if (!body) return null
  return (
    <div className={`guardian-sprite gs-${questId}${state ? ` is-${state}` : ''}${phase > 0 ? ` is-phase-${Math.min(phase, 2)}` : ''}`}>
      <svg viewBox="0 0 120 120" role="img" aria-label={label}>
        {body}
      </svg>
    </div>
  )
}
