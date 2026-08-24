import type { Projected } from '../lib/inkRoadCamera'

/**
 * What stands beside the road.
 *
 * Drawn from the reference art rather than invented: tiled roofs whose eaves
 * flick up at the corners, stone tōrō rather than a lamp on a stick, sakura
 * whose blossom reads as mass rather than outline. Each shape takes its ground
 * point and its top point already projected, so nothing here knows about the
 * camera — it only has to look right between two heights.
 */

export type PropKind = 'toro' | 'house' | 'sakura' | 'pine' | 'grass' | 'paddy' | 'torii'

export interface Prop {
  kind: PropKind
  u: number
  v: number
  size: number
  /** Tōrō and houses belong to a stop and light when it clears. */
  stop?: number
}

interface ShapeProps {
  base: Projected
  top: Projected
  /** Half the prop's width on screen. */
  width: number
}

/** A tiled roof: two curved slopes to a ridge, with the eave tips flicked up. */
function roof(x: number, eaveY: number, ridgeY: number, width: number) {
  const rise = eaveY - ridgeY
  return {
    slab: `M${x - width} ${eaveY} Q${x - width * 0.42} ${eaveY - rise * 0.86} ${x} ${ridgeY} Q${x + width * 0.42} ${eaveY - rise * 0.86} ${x + width} ${eaveY} Z`,
    eaves: `M${x - width} ${eaveY} L${x - width * 1.22} ${eaveY - rise * 0.28} M${x + width} ${eaveY} L${x + width * 1.22} ${eaveY - rise * 0.28}`,
  }
}

function House({ base, top, width }: ShapeProps) {
  const height = base.y - top.y
  const eaveY = base.y - height * 0.42
  const tiles = roof(base.x, eaveY, top.y, width)
  return (
    <>
      <rect className="ink-prop-fill" x={base.x - width * 0.66} y={eaveY - height * 0.04} width={width * 1.32} height={height * 0.46} />
      <path className="ink-prop-roof" d={tiles.slab} />
      <path className="ink-prop-eave" d={tiles.eaves} />
    </>
  )
}

/**
 * A stone lantern. The light box is a separate element so a cleared stop can
 * light the box itself rather than tinting the whole stone.
 */
function Toro({ base, top, width }: ShapeProps) {
  const height = base.y - top.y
  const boxY = top.y + height * 0.24
  const boxH = height * 0.26
  const cap = roof(base.x, boxY, top.y + height * 0.04, width * 1.15)
  return (
    <>
      <ellipse className="ink-prop-fill" cx={base.x} cy={base.y} rx={width * 0.9} ry={Math.max(0.8, width * 0.3)} />
      <rect className="ink-prop-fill" x={base.x - width * 0.28} y={boxY + boxH} width={width * 0.56} height={base.y - boxY - boxH} />
      <rect className="ink-prop-light" x={base.x - width * 0.5} y={boxY} width={width} height={boxH} />
      <path className="ink-prop-roof" d={cap.slab} />
      <path className="ink-prop-eave" d={cap.eaves} />
    </>
  )
}

/**
 * Blossom reads as mass, not outline: several overlapping crowns rather than
 * three big discs, which at close range just gave a pink blob with visible
 * circle edges.
 */
function Sakura({ base, top, width }: ShapeProps) {
  const height = base.y - top.y
  const crowns = [
    { dx: 0, dy: 0.2, r: 0.62 },
    { dx: -0.66, dy: 0.4, r: 0.5 },
    { dx: 0.62, dy: 0.36, r: 0.46 },
    { dx: -0.3, dy: 0.14, r: 0.4 },
    { dx: 0.34, dy: 0.52, r: 0.38 },
    { dx: 0.04, dy: 0.5, r: 0.44 },
  ]
  return (
    <>
      <path
        className="ink-prop-trunk"
        d={`M${base.x} ${base.y} L${base.x} ${top.y + height * 0.44} M${base.x} ${top.y + height * 0.62} l${-width * 0.42} ${-height * 0.12} M${base.x} ${top.y + height * 0.56} l${width * 0.38} ${-height * 0.14}`}
      />
      {crowns.map((crown, index) => (
        <circle
          key={index}
          className="ink-prop-blossom"
          cx={base.x + width * crown.dx}
          cy={top.y + height * crown.dy}
          r={Math.max(0.7, width * crown.r)}
        />
      ))}
    </>
  )
}

function Pine({ base, top, width }: ShapeProps) {
  const height = base.y - top.y
  return (
    <>
      <line x1={base.x} y1={base.y} x2={base.x} y2={base.y - height * 0.3} />
      {[0, 1, 2].map((tier) => {
        const spread = width * (0.9 - tier * 0.26)
        const foot = base.y - height * (0.26 + tier * 0.24)
        const peak = base.y - height * (0.58 + tier * 0.21)
        return <path key={tier} d={`M${base.x - spread} ${foot} L${base.x} ${peak} L${base.x + spread} ${foot} Z`} />
      })}
    </>
  )
}

function Grass({ base, top, width }: ShapeProps) {
  const rise = top.y - base.y
  return (
    <path
      d={`M${base.x} ${base.y} l${-width * 0.5} ${rise} M${base.x} ${base.y} l0 ${rise * 1.1} M${base.x} ${base.y} l${width * 0.5} ${rise}`}
    />
  )
}

/** A gate over the road, framing what is ahead the way the reference does. */
function Torii({ base, top, width }: ShapeProps) {
  const height = base.y - top.y
  const lintel = top.y + height * 0.22
  return (
    <>
      <line className="ink-prop-post" x1={base.x - width} y1={base.y} x2={base.x - width * 0.88} y2={lintel} />
      <line className="ink-prop-post" x1={base.x + width} y1={base.y} x2={base.x + width * 0.88} y2={lintel} />
      <line className="ink-prop-post" x1={base.x - width * 1.1} y1={lintel} x2={base.x + width * 1.1} y2={lintel} />
      <path className="ink-prop-lintel" d={`M${base.x - width * 1.32} ${top.y + height * 0.08} Q${base.x} ${top.y - height * 0.06} ${base.x + width * 1.32} ${top.y + height * 0.08}`} />
    </>
  )
}

const SHAPES: Record<Exclude<PropKind, 'paddy'>, (props: ShapeProps) => React.ReactElement> = {
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
