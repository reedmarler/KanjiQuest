/**
 * The Hollow Lantern — where the road is going.
 *
 * A road with nothing at the end of it is a chore list drawn as a line. This is
 * the destination, and it is deliberately visible from the very first stop:
 * fog hides the road ahead, never the thing you are walking toward.
 *
 * It also answers to the player. The lantern starts cold, holding the words it
 * has taken; each seal recovered warms it a little, so a session does not only
 * move the traveller — it visibly changes the thing at the end of the road.
 * That is the whole motivation loop, and it costs no words on screen.
 */

interface HollowLanternProps {
  /** Centre of the lantern, in the parent SVG's coordinates. */
  x: number
  y: number
  /** Body height in user units. */
  height: number
  /** 0–1. How much of the road is done, and so how warm the lantern burns. */
  warmth: number
  idPrefix: string
}

export function HollowLantern({ x, y, height, warmth, idPrefix }: HollowLanternProps) {
  const halfHeight = height / 2
  const halfWidth = height * 0.36
  const capWidth = halfWidth * 0.52
  const ribs = 4

  return (
    <g className="hollow-lantern" style={{ ['--lantern-warmth' as string]: warmth }}>
      <defs>
        <radialGradient id={`${idPrefix}-halo`}>
          <stop offset="0%" stopColor="var(--ink-lit)" stopOpacity={0.06 + warmth * 0.34} />
          <stop offset="55%" stopColor="var(--ink-lit)" stopOpacity={0.02 + warmth * 0.12} />
          <stop offset="100%" stopColor="var(--ink-lit)" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle className="lantern-halo" cx={x} cy={y} r={height * 1.15} fill={`url(#${idPrefix}-halo)`} />

      {/* Hanging cord — it is suspended over the road, not standing on it. */}
      <line className="lantern-cord" x1={x} y1={y - halfHeight - height * 0.5} x2={x} y2={y - halfHeight - capWidth * 0.3} />

      <rect className="lantern-cap" x={x - capWidth} y={y - halfHeight - capWidth * 0.34} width={capWidth * 2} height={capWidth * 0.34} rx={2} />
      <rect className="lantern-cap" x={x - capWidth} y={y + halfHeight} width={capWidth * 2} height={capWidth * 0.34} rx={2} />

      <path
        className="lantern-body"
        d={`M${x - capWidth} ${y - halfHeight}
            C${x - halfWidth} ${y - halfHeight * 0.5} ${x - halfWidth} ${y + halfHeight * 0.5} ${x - capWidth} ${y + halfHeight}
            L${x + capWidth} ${y + halfHeight}
            C${x + halfWidth} ${y + halfHeight * 0.5} ${x + halfWidth} ${y - halfHeight * 0.5} ${x + capWidth} ${y - halfHeight} Z`}
      />

      {Array.from({ length: ribs }, (_, index) => {
        const t = (index + 1) / (ribs + 1)
        const ribY = y - halfHeight + height * t
        const spread = halfWidth * Math.sin(Math.PI * t) * 0.98 + capWidth * 0.4
        return <line key={index} className="lantern-rib" x1={x - spread} y1={ribY} x2={x + spread} y2={ribY} />
      })}

      {/* The flame is the readout: cold and small at zero seals, full at nine. */}
      <path
        className="lantern-flame"
        d={`M${x} ${y + height * 0.16}
            q${-height * 0.1} ${-height * 0.1} 0 ${-height * (0.16 + warmth * 0.16)}
            q${height * 0.1} ${height * 0.1} 0 ${height * (0.16 + warmth * 0.16)} Z`}
        opacity={0.25 + warmth * 0.75}
      />
    </g>
  )
}
