import { useEffect, useMemo, useRef, useState } from 'react'
import { INK_ROAD_REGIONS, INK_ROAD_WAYPOINTS, TSUZURI_BAND, TSUZURI_JAPANESE, WAYPOINT_NAMES } from '../data/inkRoad'
import { buildRoad, pointAtLength, roadX, seededRandom, stopLengths, type RoadPoint } from '../lib/inkRoadGeometry'
import { demoProgress } from '../lib/inkRoadDemo'
import { deriveMapState, type NodeState } from '../lib/mapState'
import { AppBackButton } from './AppBackButton'
import { HollowLantern } from './HollowLantern'

const MAP_HEIGHT = 1560
const START_WALKED = 4

/** Room above the northernmost stop for the destination to hang in. */
const SKY = 210

/** Regions on the finished road; each one's shrine returns a seal. */
const TOTAL_SEALS = 9

interface Prop {
  kind: 'lantern' | 'house' | 'pine' | 'grass' | 'paddy'
  x: number
  y: number
  size: number
  /** Lanterns and houses belong to a stop and light when it clears. Terrain doesn't. */
  stop?: number
}

/**
 * Scenery hangs off the road and lights as the stop beside it clears, which is
 * how the region reports its own progress — the village goes from grey to warm
 * without a progress bar anywhere on screen. Terrain fills the ground between
 * stops so the road runs through a place rather than across a blank page.
 */
function buildScenery(points: readonly RoadPoint[], height: number): Prop[] {
  const random = seededRandom(20260823)
  const props: Prop[] = []

  points.forEach((point, index) => {
    const side = index % 2 === 0 ? -1 : 1
    props.push({ kind: 'lantern', x: point.x + side * 40, y: point.y - 2, size: 1, stop: index })

    const houses = 2 + Math.floor(random() * 2)
    for (let count = 0; count < houses; count += 1) {
      const x = point.x + side * (62 + random() * 40)
      const y = point.y + (random() * 70 - 35)
      if (x > 24 && x < 336) props.push({ kind: 'house', x, y, size: 9 + random() * 4, stop: index })
    }
  })

  // Terrain is scattered over the whole scroll, and steps around the road.
  for (let y = height - 90; y > 90; y -= 46) {
    for (let count = 0; count < 3; count += 1) {
      const x = 18 + random() * 324
      const at = y + random() * 40 - 20
      if (Math.abs(x - roadX(at)) < 34) continue
      const roll = random()
      if (roll > 0.62) props.push({ kind: 'pine', x, y: at, size: 11 + random() * 8 })
      else if (roll > 0.18) props.push({ kind: 'grass', x, y: at, size: 1 })
      else props.push({ kind: 'paddy', x, y: at, size: 15 + random() * 9 })
    }
  }

  return props
}

function propShape(prop: Prop) {
  const { x, y, size } = prop

  if (prop.kind === 'lantern') {
    return (
      <>
        <line x1={x} y1={y + 11} x2={x} y2={y - 5} />
        <rect x={x - 5} y={y - 17} width={10} height={13} rx={3} className="ink-prop-fill" />
      </>
    )
  }

  if (prop.kind === 'house') {
    return (
      <>
        <path d={`M${x - size} ${y - size * 0.75} L${x} ${y - size * 1.5} L${x + size} ${y - size * 0.75} Z`} className="ink-prop-roof" />
        <rect x={x - size * 0.72} y={y - size * 0.75} width={size * 1.44} height={size * 0.8} className="ink-prop-fill" />
      </>
    )
  }

  if (prop.kind === 'pine') {
    return (
      <>
        <line x1={x} y1={y} x2={x} y2={y - size * 1.1} />
        {[0, 1, 2].map((tier) => {
          const tierY = y - size * (0.45 + tier * 0.28)
          const width = size * (0.5 - tier * 0.11)
          return <path key={tier} d={`M${x - width} ${tierY} Q${x} ${tierY - size * 0.3} ${x + width} ${tierY}`} />
        })}
      </>
    )
  }

  if (prop.kind === 'grass') {
    return <path d={`M${x} ${y} q2 -6 4 -8 M${x + 4} ${y} q0 -7 1 -10 M${x + 8} ${y} q-1 -6 -3 -9`} />
  }

  const depth = size * 0.55
  return (
    <>
      <path
        className="ink-prop-paddy"
        d={`M${x - size} ${y} L${x + size - 8} ${y - depth} L${x + size} ${y - depth + 4} L${x - size + 8} ${y + 4} Z`}
      />
      {[0.3, 0.55, 0.8].map((row) => (
        <line
          key={row}
          x1={x - size + row * 8}
          y1={y + row * 4}
          x2={x + size - 8 + row * 8}
          y2={y - depth + row * 4}
        />
      ))}
    </>
  )
}

const NODE_LABEL: Record<NodeState, string> = {
  sealed: 'Sealed',
  fogged: 'Not started',
  open: 'In progress',
  inked: 'Cleared',
  thin: 'Needs review',
}

interface MapViewProps {
  onBack: () => void
}

export function MapView({ onBack }: MapViewProps) {
  const [walked, setWalked] = useState(START_WALKED)
  const [named, setNamed] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const road = useMemo(() => buildRoad(MAP_HEIGHT, SKY), [])
  const lengths = useMemo(() => stopLengths(road, INK_ROAD_WAYPOINTS.length), [road])
  const points = useMemo(() => lengths.map((length) => pointAtLength(road, length)), [road, lengths])
  const scenery = useMemo(() => buildScenery(points, MAP_HEIGHT), [points])

  const state = useMemo(
    () => deriveMapState(demoProgress(INK_ROAD_WAYPOINTS, walked), INK_ROAD_WAYPOINTS, INK_ROAD_REGIONS),
    [walked],
  )

  const region = state.regions[0]!
  const frontierIndex = Math.max(0, INK_ROAD_WAYPOINTS.findIndex((waypoint) => waypoint.id === state.frontierId))

  /*
   * How far along the road the session actually got: everything behind the
   * frontier, plus the share of the current stop already inked. The traveller
   * stands there rather than on the next node, so opening the map mid-region
   * shows you between two places — which is most of the pull to finish.
   */
  const behind = frontierIndex > 0 ? lengths[frontierIndex - 1]! : 0
  const travelled = behind + (lengths[frontierIndex]! - behind) * state.waypoints[frontierIndex]!.ink
  const token = pointAtLength(road, travelled)
  const inked = travelled
  const finished = walked >= INK_ROAD_WAYPOINTS.length

  // One seal per region cleared. Nothing else on the map counts toward it, so
  // the number only moves when a shrine falls.
  const seals = state.regions.filter((entry) => entry.cleared).length

  /*
   * The count is exact; the glow is not. Linear warmth makes the first seal a
   * 11% change nobody can see, which quietly teaches that clearing a region
   * does nothing to the destination. A square-root curve puts the visible
   * reward early and still lands at full flame on the ninth.
   */
  const warmth = Math.sqrt(seals / TOTAL_SEALS)

  // Open on the traveller rather than the top of the scroll: the map's job is
  // to answer "where do I go today" before anything else.
  useEffect(() => {
    const scroll = scrollRef.current
    if (!scroll) return
    const rendered = scroll.scrollWidth * (MAP_HEIGHT / 360)
    scroll.scrollTo({
      top: Math.max(0, (token.y / MAP_HEIGHT) * rendered - scroll.clientHeight * 0.62),
      behavior: 'smooth',
    })
  }, [token.y])

  return (
    <main className="ink-road">
      <header className="ink-road-hud">
        <AppBackButton onClick={onBack} aria-label="Back to Quests" />
        <div className="ink-road-place">
          <b lang="ja">{TSUZURI_JAPANESE}</b>
          <span>{region.title} · {TSUZURI_BAND}</span>
        </div>
        <div className="ink-road-stats">
          <b>{Math.round(region.ink * 100)}%</b> ink · <b>{state.due}</b> due
        </div>
      </header>

      {/* Pinned so the destination never scrolls away — the road always has a
          visible end, even standing at the first stop. */}
      <button
        type="button"
        className="ink-road-horizon"
        onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
        aria-label={`The Hollow Lantern. ${seals} of ${TOTAL_SEALS} seals recovered. Scroll to the far end of the road.`}
      >
        <svg viewBox="0 0 360 74" aria-hidden="true">
          <path className="horizon-ridge" d="M-10 74 L40 44 L86 62 L140 30 L196 58 L250 36 L300 60 L370 40 L370 74 Z" />
          <HollowLantern x={180} y={34} height={40} warmth={warmth} idPrefix="horizon" />
        </svg>
        <span className="ink-road-seals"><b>{seals}</b> / {TOTAL_SEALS} seals</span>
      </button>

      <div className="ink-road-scroll" ref={scrollRef}>
        <svg
          viewBox={`0 0 ${road.width} ${MAP_HEIGHT}`}
          className="ink-road-map"
          role="img"
          aria-label={`The road through ${region.title}. ${region.waypointsCleared} of ${region.waypointCount} stops cleared.`}
        >
          <defs>
            <linearGradient id="ink-fog" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--ink-fog-far)" stopOpacity="1" />
              <stop offset="72%" stopColor="var(--ink-fog-near)" stopOpacity="0.97" />
              <stop offset="93%" stopColor="var(--ink-fog-near)" stopOpacity="0.6" />
              <stop offset="100%" stopColor="var(--ink-fog-near)" stopOpacity="0" />
            </linearGradient>
            <radialGradient id="ink-lamp">
              <stop offset="0%" stopColor="var(--ink-lit)" stopOpacity="0.34" />
              <stop offset="45%" stopColor="var(--ink-lit)" stopOpacity="0.12" />
              <stop offset="100%" stopColor="var(--ink-lit)" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="ink-token">
              <stop offset="0%" stopColor="var(--ink-seal)" stopOpacity="0.32" />
              <stop offset="100%" stopColor="var(--ink-seal)" stopOpacity="0" />
            </radialGradient>
          </defs>

          <g className="ink-road-scenery">
            {scenery.map((prop, index) => {
              const owned = prop.stop !== undefined
              const lit = owned && prop.stop! < walked
              return (
                <g
                  key={index}
                  className={`ink-prop is-${prop.kind}${lit ? ' is-lit' : ''}`}
                  opacity={!owned ? 0.55 : lit ? 1 : prop.stop === walked ? 0.8 : 0.4}
                >
                  {prop.kind === 'lantern' && <circle className="ink-prop-glow" cx={prop.x} cy={prop.y - 10} r={30} fill="url(#ink-lamp)" />}
                  {propShape(prop)}
                </g>
              )
            })}
          </g>

          <path d={road.d} className="ink-road-bleed" />
          <path d={road.d} className="ink-road-faint" />
          <path
            d={road.d}
            className="ink-road-line"
            style={{ strokeDasharray: road.total, strokeDashoffset: road.total - inked }}
          />

          <g className="ink-road-nodes">
            {INK_ROAD_WAYPOINTS.map((waypoint, index) => {
              const point = points[index]!
              const node = state.waypoints[index]!
              const name = WAYPOINT_NAMES[waypoint.id] ?? waypoint.id
              const showName = named === waypoint.id || node.id === state.frontierId
              const anchorRight = index % 2 === 0

              return (
                <g
                  key={waypoint.id}
                  className={`ink-node is-${node.node}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`${name}. ${NODE_LABEL[node.node]}, ${Math.round(node.ink * 100)} percent inked.`}
                  onClick={() => setNamed((current) => (current === waypoint.id ? null : waypoint.id))}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setNamed((current) => (current === waypoint.id ? null : waypoint.id))
                    }
                  }}
                >
                  <circle cx={point.x} cy={point.y} r={16} className="ink-node-halo" />
                  {waypoint.kind === 'shrine' ? (
                    <path
                      className="ink-node-mark"
                      d={`M${point.x - 12} ${point.y + 10} L${point.x - 12} ${point.y - 4} M${point.x + 12} ${point.y + 10} L${point.x + 12} ${point.y - 4} M${point.x - 15} ${point.y - 4} L${point.x + 15} ${point.y - 4} M${point.x - 17} ${point.y - 9} Q${point.x} ${point.y - 13} ${point.x + 17} ${point.y - 9}`}
                    />
                  ) : (
                    <>
                      <circle className="ink-node-mark" cx={point.x} cy={point.y} r={7.5} />
                      {/* Ink fills from the bottom, so a part-learned stop reads as part-drawn. */}
                      <path
                        className="ink-node-fill"
                        d={`M${point.x - 7.5} ${point.y}a7.5 7.5 0 0 0 15 0z`}
                        opacity={node.cleared ? 1 : node.ink}
                      />
                    </>
                  )}
                  {node.cleared && !node.due && <rect className="ink-node-seal" x={point.x + 9} y={point.y + 7} width={8} height={8} rx={1} />}
                  {showName && (
                    <text
                      className="ink-node-name"
                      x={point.x + (anchorRight ? 24 : -24)}
                      y={point.y + 4}
                      textAnchor={anchorRight ? 'start' : 'end'}
                    >
                      {name}
                    </text>
                  )}
                </g>
              )
            })}
          </g>

          <g className="ink-road-token">
            <circle cx={token.x} cy={token.y} r={26} fill="url(#ink-token)" />
            <line x1={token.x} y1={token.y} x2={token.x} y2={token.y + 14} />
            <circle cx={token.x} cy={token.y} r={6} />
          </g>

          <g className="ink-road-fog" style={{ transform: `translateY(${token.y - 140 - MAP_HEIGHT}px)` }}>
            <rect x={-20} y={0} width={road.width + 40} height={MAP_HEIGHT} fill="url(#ink-fog)" />
          </g>

          {/* Drawn after the fog on purpose: the road ahead is hidden, the
              place you are walking to never is. */}
          <HollowLantern x={roadX(SKY) + 8} y={SKY - 118} height={116} warmth={warmth} idPrefix="sky" />
        </svg>
      </div>

      <footer className="ink-road-cta">
        <button
          type="button"
          className="btn btn-primary"
          disabled={finished}
          onClick={() => setWalked((count) => Math.min(INK_ROAD_WAYPOINTS.length, count + 1))}
        >
          {finished ? 'Road complete' : <>Continue <span aria-hidden="true">·</span> {WAYPOINT_NAMES[state.frontierId ?? ''] ?? ''}</>}
        </button>
        <div className="ink-road-route">
          <span>
            {finished
              ? 'The fog is lifted'
              : `Route · ${state.waypoints[frontierIndex]!.kind === 'shrine' ? 'shrine trial' : '2 stops · 8 min'}`}
          </span>
          {/* The map is honest about its own data: nothing writes CardProgress
              yet, so this preview walks on a stand-in history. */}
          <button type="button" className="ink-road-demo" onClick={() => setWalked(START_WALKED)}>
            Demo data · reset
          </button>
        </div>
      </footer>
    </main>
  )
}
