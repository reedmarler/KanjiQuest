import type { Projected } from '../lib/inkRoadCamera'

/**
 * What stands beside the road.
 *
 * Everything here is a solid silhouette in three tones — a lit face, a body,
 * and a roof or shadow side — under one light coming from the left. Drawn as
 * outlines instead, at the same value however far away they are, the whole
 * road read as a wireframe: value separation is what makes a scene look built.
 *
 * Each shape takes its ground point and its top point already projected, so
 * nothing here knows about the camera — it only has to look right between two
 * heights.
 */

export type PropKind = 'toro' | 'house' | 'sakura' | 'pine' | 'grass' | 'paddy' | 'torii' | 'stall' | 'banner' | 'meadow'

export interface Prop {
  kind: PropKind
  u: number
  v: number
  size: number
  /** Tōrō, houses and stalls belong to a stop and light when it clears. */
  stop?: number
}

interface ShapeProps {
  base: Projected
  top: Projected
  /** Half the prop's width on screen. */
  width: number
}

/** A tiled roof: two curved slopes to a ridge, with the eave tips flicked up. */
function roofPath(x: number, eaveY: number, ridgeY: number, width: number) {
  const rise = eaveY - ridgeY
  return `M${x - width} ${eaveY} Q${x - width * 0.42} ${eaveY - rise * 0.86} ${x} ${ridgeY} Q${x + width * 0.42} ${eaveY - rise * 0.86} ${x + width} ${eaveY} L${x + width * 1.2} ${eaveY - rise * 0.24} L${x - width * 1.2} ${eaveY - rise * 0.24} Z`
}

function House({ base, top, width }: ShapeProps) {
  const height = base.y - top.y
  const eaveY = base.y - height * 0.4
  const wallTop = eaveY - height * 0.02
  return (
    <>
      <rect className="fill-mid" x={base.x - width * 0.7} y={wallTop} width={width * 1.4} height={base.y - wallTop} />
      {/* The left face catches the light; the right falls away. */}
      <rect className="fill-light" x={base.x - width * 0.7} y={wallTop} width={width * 0.5} height={base.y - wallTop} />
      <rect className="fill-lamp" x={base.x + width * 0.06} y={wallTop + height * 0.12} width={width * 0.34} height={height * 0.18} />
      <path className="fill-dark" d={roofPath(base.x, eaveY, top.y, width)} />
    </>
  )
}

/** A stone lantern; its light box is separate so a cleared stop can light it. */
function Toro({ base, top, width }: ShapeProps) {
  const height = base.y - top.y
  const boxY = top.y + height * 0.28
  const boxH = height * 0.24
  return (
    <>
      <ellipse className="fill-dark" cx={base.x} cy={base.y} rx={width * 0.95} ry={Math.max(0.8, width * 0.32)} />
      <rect className="fill-mid" x={base.x - width * 0.3} y={boxY + boxH} width={width * 0.6} height={base.y - boxY - boxH} />
      <rect className="fill-light" x={base.x - width * 0.3} y={boxY + boxH} width={width * 0.22} height={base.y - boxY - boxH} />
      <rect className="fill-mid" x={base.x - width * 0.62} y={boxY + boxH} width={width * 1.24} height={Math.max(0.8, height * 0.05)} />
      <rect className="fill-lamp" x={base.x - width * 0.46} y={boxY} width={width * 0.92} height={boxH} rx={1} />
      <path className="fill-dark" d={roofPath(base.x, boxY, top.y + height * 0.06, width * 1.05)} />
    </>
  )
}

/** Blossom reads as mass: overlapping crowns, lighter where the light lands. */
function Sakura({ base, top, width }: ShapeProps) {
  const height = base.y - top.y
  const crowns = [
    { dx: 0, dy: 0.22, r: 0.66, lit: false },
    { dx: -0.68, dy: 0.42, r: 0.52, lit: true },
    { dx: 0.64, dy: 0.38, r: 0.48, lit: false },
    { dx: -0.28, dy: 0.14, r: 0.44, lit: true },
    { dx: 0.3, dy: 0.54, r: 0.4, lit: false },
    { dx: 0.02, dy: 0.48, r: 0.46, lit: false },
  ]
  return (
    <>
      <path
        className="stroke-dark"
        d={`M${base.x} ${base.y} L${base.x} ${top.y + height * 0.46} M${base.x} ${top.y + height * 0.64} l${-width * 0.44} ${-height * 0.12} M${base.x} ${top.y + height * 0.58} l${width * 0.4} ${-height * 0.14}`}
        strokeWidth={Math.max(0.7, width * 0.14)}
      />
      {crowns.map((crown, index) => (
        <circle
          key={index}
          className={crown.lit ? 'fill-bloom-light' : 'fill-bloom'}
          cx={base.x + width * crown.dx}
          cy={top.y + height * crown.dy}
          r={Math.max(0.7, width * crown.r)}
        />
      ))}
      {/* Brighter flecks, so a crown is blossom rather than a disc of pink. */}
      {width > 5 && [
        { dx: -0.34, dy: 0.24 }, { dx: 0.28, dy: 0.3 }, { dx: -0.06, dy: 0.46 },
      ].map((fleck, index) => (
        <circle
          key={`fleck-${index}`}
          className="fill-bloom-fleck"
          cx={base.x + width * fleck.dx}
          cy={top.y + height * fleck.dy}
          r={Math.max(0.5, width * 0.15)}
        />
      ))}
    </>
  )
}

function Pine({ base, top, width }: ShapeProps) {
  const height = base.y - top.y
  return (
    <>
      <rect className="fill-dark" x={base.x - Math.max(0.4, width * 0.1)} y={base.y - height * 0.34} width={Math.max(0.8, width * 0.2)} height={height * 0.34} />
      {[0, 1, 2].map((tier) => {
        const spread = width * (0.95 - tier * 0.27)
        const foot = base.y - height * (0.26 + tier * 0.24)
        const peak = base.y - height * (0.6 + tier * 0.2)
        return (
          <g key={tier}>
            <path className="fill-mid" d={`M${base.x - spread} ${foot} L${base.x} ${peak} L${base.x + spread} ${foot} Z`} />
            <path className="fill-light" d={`M${base.x - spread} ${foot} L${base.x} ${peak} L${base.x} ${foot} Z`} />
          </g>
        )
      })}
    </>
  )
}

function Grass({ base, top, width }: ShapeProps) {
  const rise = top.y - base.y
  return (
    <path
      className="stroke-mid"
      strokeWidth={Math.max(0.5, width * 0.16)}
      d={`M${base.x} ${base.y} l${-width * 0.5} ${rise} M${base.x} ${base.y} l0 ${rise * 1.1} M${base.x} ${base.y} l${width * 0.5} ${rise}`}
    />
  )
}

/** A gate over the road, framing what is ahead the way the reference does. */
function Torii({ base, top, width }: ShapeProps) {
  const height = base.y - top.y
  const lintel = top.y + height * 0.26
  const leg = Math.max(0.9, width * 0.16)
  return (
    <>
      <rect className="fill-seal" x={base.x - width - leg / 2} y={lintel} width={leg} height={base.y - lintel} />
      <rect className="fill-seal" x={base.x + width - leg / 2} y={lintel} width={leg} height={base.y - lintel} />
      <rect className="fill-seal" x={base.x - width * 1.14} y={lintel} width={width * 2.28} height={Math.max(0.9, height * 0.07)} />
      <path
        className="fill-seal"
        d={`M${base.x - width * 1.38} ${top.y + height * 0.12} Q${base.x} ${top.y - height * 0.05} ${base.x + width * 1.38} ${top.y + height * 0.12} L${base.x + width * 1.38} ${top.y + height * 0.2} Q${base.x} ${top.y + height * 0.03} ${base.x - width * 1.38} ${top.y + height * 0.2} Z`}
      />
    </>
  )
}

/**
 * A market stall: awning on posts, a counter under it, and a noren hung across
 * the front. The village is buildings set back from the road; the market is
 * this, crowded up against it.
 */
function Stall({ base, top, width }: ShapeProps) {
  const height = base.y - top.y
  const awningY = top.y + height * 0.26
  const counterY = base.y - height * 0.32
  const post = Math.max(0.7, width * 0.11)
  return (
    <>
      <rect className="fill-dark" x={base.x - width - post / 2} y={awningY} width={post} height={base.y - awningY} />
      <rect className="fill-dark" x={base.x + width - post / 2} y={awningY} width={post} height={base.y - awningY} />
      <rect className="fill-noren" x={base.x - width * 0.86} y={awningY + height * 0.08} width={width * 1.72} height={Math.max(1, counterY - awningY - height * 0.08)} />
      <rect className="fill-mid" x={base.x - width * 1.04} y={counterY} width={width * 2.08} height={Math.max(1, base.y - counterY)} />
      <rect className="fill-light" x={base.x - width * 1.04} y={counterY} width={width * 2.08} height={Math.max(0.8, height * 0.05)} />
      <path
        className="fill-awning"
        d={`M${base.x - width * 1.3} ${awningY} Q${base.x} ${top.y} ${base.x + width * 1.3} ${awningY} L${base.x + width * 1.3} ${awningY + height * 0.08} Q${base.x} ${top.y + height * 0.09} ${base.x - width * 1.3} ${awningY + height * 0.08} Z`}
      />
    </>
  )
}

/** A nobori: the tall narrow banner that stands outside a shop. */
function Banner({ base, top, width }: ShapeProps) {
  const height = base.y - top.y
  return (
    <>
      <rect className="fill-dark" x={base.x - Math.max(0.4, width * 0.08)} y={top.y} width={Math.max(0.8, width * 0.16)} height={height} />
      <path
        className="fill-awning"
        d={`M${base.x} ${top.y + height * 0.04} L${base.x + width * 1.2} ${top.y + height * 0.09} L${base.x + width * 1.2} ${base.y - height * 0.22} L${base.x} ${base.y - height * 0.28} Z`}
      />
    </>
  )
}

/** A broad soft patch of ground, so a field has variation rather than one green. */
function Meadow({ base, width }: ShapeProps) {
  return <ellipse className="fill-meadow" cx={base.x} cy={base.y} rx={width} ry={Math.max(0.8, width * 0.22)} />
}

const SHAPES: Record<Exclude<PropKind, 'paddy'>, (props: ShapeProps) => React.ReactElement> = {
  meadow: Meadow,
  stall: Stall,
  banner: Banner,
  house: House,
  toro: Toro,
  sakura: Sakura,
  pine: Pine,
  grass: Grass,
  torii: Torii,
}

export function PropShape({ kind, base, top, width }: ShapeProps & { kind: Exclude<PropKind, 'paddy'> }) {
  const Shape = SHAPES[kind]
  return <Shape base={base} top={top} width={width} />
}

/**
 * The traveller, from behind — modelled on the reference character rather than
 * invented: a pink lamellar kabuto with antler kuwagata and a white blossom
 * mon, a scarf streaming to one side, flared skirt plates, and a drawn blade.
 *
 * The silhouette does the work at this size. Crest, scarf and skirt are what
 * survive at forty pixels tall; the lacing bands only read once the traveller
 * is close, which is exactly when there is room for them.
 *
 * Its colours are its own rather than the region's: the hero should look the
 * same walking out of a spring village as into an evening market.
 */
export function Traveller({ base, top, width }: ShapeProps) {
  const height = base.y - top.y
  /** Fractions of the figure's height, measured up from the ground. */
  const at = (fraction: number) => base.y - height * fraction
  /*
   * Every horizontal measure is a fraction of the figure's height too. The
   * reference is more than three times as tall as she is wide, and sizing the
   * armour off a separate width made her square — a pink box with antlers.
   * `width` only sets a floor, so she still reads when she is a few pixels tall.
   */
  const span = Math.max(height, width * 3.3)
  const x = (fraction: number) => base.x + span * fraction
  const thick = (fraction: number) => Math.max(0.5, span * fraction)

  return (
    <g className="ink-traveller">
      <ellipse className="hero-shadow" cx={base.x} cy={base.y} rx={span * 0.15} ry={Math.max(0.5, span * 0.04)} />

      {/* Sheathed sword, crossing behind her before the armour covers the middle. */}
      <line className="hero-saya" x1={x(-0.23)} y1={at(0.33)} x2={x(0.08)} y2={at(0.47)} strokeWidth={thick(0.026)} />

      {/* Scarf: the one loose thing on her, streaming off to the left. */}
      <path
        className="hero-scarf"
        d={`M${x(-0.02)} ${at(0.7)}
            C${x(-0.16)} ${at(0.74)} ${x(-0.29)} ${at(0.71)} ${x(-0.39)} ${at(0.63)}
            C${x(-0.28)} ${at(0.64)} ${x(-0.15)} ${at(0.63)} ${x(-0.02)} ${at(0.61)} Z`}
      />
      <path
        className="hero-scarf"
        d={`M${x(-0.04)} ${at(0.64)}
            C${x(-0.14)} ${at(0.63)} ${x(-0.22)} ${at(0.58)} ${x(-0.26)} ${at(0.5)}
            C${x(-0.19)} ${at(0.56)} ${x(-0.11)} ${at(0.58)} ${x(-0.05)} ${at(0.58)} Z`}
      />

      {/* Legs, one ahead of the other, and the boots under them. */}
      <rect className="hero-leg" x={x(-0.075)} y={at(0.32)} width={thick(0.055)} height={height * 0.22} />
      <rect className="hero-leg" x={x(0.022)} y={at(0.32)} width={thick(0.055)} height={height * 0.22} />
      <rect className="hero-boot" x={x(-0.086)} y={at(0.11)} width={thick(0.077)} height={height * 0.11} rx={0.6} />
      <rect className="hero-boot" x={x(0.012)} y={at(0.11)} width={thick(0.077)} height={height * 0.11} rx={0.6} />

      {/* Kusazuri: the flared skirt plates. */}
      <path className="hero-plate" d={`M${x(-0.075)} ${at(0.46)} L${x(0.075)} ${at(0.46)} L${x(0.1)} ${at(0.3)} L${x(-0.1)} ${at(0.3)} Z`} />
      <line className="hero-lace" x1={x(-0.092)} y1={at(0.36)} x2={x(0.092)} y2={at(0.36)} strokeWidth={thick(0.014)} />

      {/* Dō: the body, laced in rows across the back. */}
      <path className="hero-armour" d={`M${x(-0.072)} ${at(0.62)} L${x(0.072)} ${at(0.62)} L${x(0.08)} ${at(0.46)} L${x(-0.08)} ${at(0.46)} Z`} />
      <line className="hero-lace" x1={x(-0.076)} y1={at(0.57)} x2={x(0.076)} y2={at(0.57)} strokeWidth={thick(0.013)} />
      <line className="hero-lace" x1={x(-0.078)} y1={at(0.52)} x2={x(0.078)} y2={at(0.52)} strokeWidth={thick(0.013)} />

      {/* Sode: shoulder plates, angled down and out. */}
      <path className="hero-plate" d={`M${x(-0.155)} ${at(0.625)} L${x(-0.05)} ${at(0.645)} L${x(-0.056)} ${at(0.52)} L${x(-0.165)} ${at(0.475)} Z`} />
      <path className="hero-plate" d={`M${x(0.155)} ${at(0.625)} L${x(0.05)} ${at(0.645)} L${x(0.056)} ${at(0.52)} L${x(0.165)} ${at(0.475)} Z`} />

      {/* Drawn blade, out to the right where the far hand carries it. */}
      <line className="hero-saya" x1={x(0.07)} y1={at(0.44)} x2={x(0.115)} y2={at(0.48)} strokeWidth={thick(0.024)} />
      <line className="hero-blade" x1={x(0.115)} y1={at(0.48)} x2={x(0.3)} y2={at(0.68)} strokeWidth={thick(0.018)} />

      {/* Shikoro: a short flared neck guard under the bowl. */}
      <path className="hero-plate" d={`M${x(-0.078)} ${at(0.68)} L${x(0.078)} ${at(0.68)} L${x(0.095)} ${at(0.6)} L${x(-0.095)} ${at(0.6)} Z`} />

      {/* Kabuto: a deep bowl, with the blossom mon on the back of it. */}
      <path
        className="hero-armour"
        d={`M${x(-0.113)} ${at(0.68)}
            Q${x(-0.118)} ${at(0.845)} ${base.x} ${at(0.845)}
            Q${x(0.118)} ${at(0.845)} ${x(0.113)} ${at(0.68)} Z`}
      />
      {span > 12 && <circle className="hero-mon" cx={base.x} cy={at(0.76)} r={span * 0.032} />}

      {/*
        Kuwagata: what you recognise her by at any distance. Stroked with a
        branching tine they read as antlers; the reference is two tapered
        blades, wide where they meet the bowl and drawn to a point.
      */}
      <path
        className="hero-crest"
        d={`M${x(-0.025)} ${at(0.795)}
            Q${x(-0.115)} ${at(0.87)} ${x(-0.155)} ${at(1.01)}
            Q${x(-0.12)} ${at(0.89)} ${x(-0.08)} ${at(0.785)} Z
            M${x(0.025)} ${at(0.795)}
            Q${x(0.115)} ${at(0.87)} ${x(0.155)} ${at(1.01)}
            Q${x(0.12)} ${at(0.89)} ${x(0.08)} ${at(0.785)} Z`}
      />
    </g>
  )
}
