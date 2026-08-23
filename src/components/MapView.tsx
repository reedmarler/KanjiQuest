import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { INK_ROAD_REGIONS, INK_ROAD_WAYPOINTS, TSUZURI_BAND, TSUZURI_JAPANESE, WAYPOINT_NAMES } from '../data/inkRoad'
import {
  CAMERA_TRAIL,
  HORIZON,
  LANTERN_DISTANCE,
  LANTERN_LIFT,
  LANTERN_SIZE,
  NEAR_CULL,
  ROAD_HALF_WIDTH,
  ROAD_LENGTH,
  seededRandom,
  VIEW_HEIGHT,
  VIEW_WIDTH,
  laneOffset,
  project,
  stopPositions,
} from '../lib/inkRoadCamera'
import { demoProgress } from '../lib/inkRoadDemo'
import { deriveMapState, type NodeState } from '../lib/mapState'
import { AppBackButton } from './AppBackButton'
import { HollowLantern } from './HollowLantern'

const START_WALKED = 4

/** Regions on the finished road; each one's shrine returns a seal. */
const TOTAL_SEALS = 9

/** Scroll pixels per world unit — how far a swipe carries you up the road. */
const SCROLL_SCALE = 1.15

/** Beyond this the ground has nothing left to draw; stop projecting it. */
const DRAW_DISTANCE = 1500

type PropKind = 'lantern' | 'house' | 'pine' | 'grass' | 'paddy'

interface Prop {
  kind: PropKind
  u: number
  v: number
  size: number
  /** Lanterns and houses belong to a stop and light when it clears. */
  stop?: number
}

function buildScenery(stops: readonly number[]): Prop[] {
  const random = seededRandom(20260823)
  const props: Prop[] = []

  stops.forEach((u, index) => {
    const side = index % 2 === 0 ? -1 : 1
    props.push({ kind: 'lantern', u: u + 4, v: laneOffset(u) + side * 26, size: 13, stop: index })

    const houses = 2 + Math.floor(random() * 2)
    for (let count = 0; count < houses; count += 1) {
      const at = u + random() * 70 - 35
      props.push({
        kind: 'house',
        u: at,
        v: laneOffset(at) + side * (40 + random() * 34),
        size: 17 + random() * 6,
        stop: index,
      })
    }
  })

  // Ground cover along the whole road, stepping clear of the road surface.
  for (let u = 20; u < ROAD_LENGTH + 400; u += 26) {
    for (let count = 0; count < 2; count += 1) {
      const at = u + random() * 22 - 11
      const v = laneOffset(at) + (random() * 190 - 95)
      if (Math.abs(v - laneOffset(at)) < ROAD_HALF_WIDTH + 6) continue
      const roll = random()
      if (roll > 0.6) props.push({ kind: 'pine', u: at, v, size: 15 + random() * 8 })
      else if (roll > 0.06) props.push({ kind: 'grass', u: at, v, size: 4 })
      else props.push({ kind: 'paddy', u: at, v, size: 24 + random() * 14 })
    }
  }

  return props
}

/** A flat patch on the ground plane, corners projected individually. */
function paddyQuad(prop: Prop, eye: number, eyeLateral: number): string {
  const halfLength = prop.size * 0.7
  const halfWidth = prop.size * 0.55
  const corners = [
    [prop.u - halfLength, prop.v - halfWidth],
    [prop.u + halfLength, prop.v - halfWidth],
    [prop.u + halfLength, prop.v + halfWidth],
    [prop.u - halfLength, prop.v + halfWidth],
  ] as const
  const points = corners.map(([u, v]) => {
    const point = project(Math.max(6, u - eye), v - eyeLateral)
    return `${point.x.toFixed(1)} ${point.y.toFixed(1)}`
  })
  return `M${points.join('L')}Z`
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
  const [camera, setCamera] = useState(0)
  /*
   * The camera is sticky inside a tall scroll rail, so `height: 100%` would
   * resolve against the rail and stretch the view to the length of the road.
   * Only the scroller knows how big its own window is.
   */
  const [viewport, setViewport] = useState(560)
  const scrollRef = useRef<HTMLDivElement>(null)
  const frame = useRef(0)

  const stops = useMemo(() => stopPositions(INK_ROAD_WAYPOINTS.length), [])
  const scenery = useMemo(() => buildScenery(stops), [stops])

  const state = useMemo(
    () => deriveMapState(demoProgress(INK_ROAD_WAYPOINTS, walked), INK_ROAD_WAYPOINTS, INK_ROAD_REGIONS),
    [walked],
  )

  const region = state.regions[0]!
  const frontierIndex = Math.max(0, INK_ROAD_WAYPOINTS.findIndex((waypoint) => waypoint.id === state.frontierId))
  const finished = walked >= INK_ROAD_WAYPOINTS.length

  // How far along the road the session actually got: everything behind the
  // frontier, plus the share of the stop being studied that is already inked.
  const behind = frontierIndex > 0 ? stops[frontierIndex - 1]! : 0
  const travelled = behind + (stops[frontierIndex]! - behind) * state.waypoints[frontierIndex]!.ink

  const seals = state.regions.filter((entry) => entry.cleared).length
  // Exact count, eased glow: a linear first-of-nine is a change nobody sees.
  const warmth = Math.sqrt(seals / TOTAL_SEALS)

  // Scrolling drives the camera rather than panning a picture, so a swipe
  // forward is the same gesture as walking forward.
  const onScroll = useCallback(() => {
    if (frame.current) return
    frame.current = requestAnimationFrame(() => {
      frame.current = 0
      const scroll = scrollRef.current
      if (scroll) setCamera(scroll.scrollTop / SCROLL_SCALE)
    })
  }, [])

  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  useEffect(() => {
    const scroll = scrollRef.current
    if (!scroll) return
    const measure = () => setViewport(scroll.clientHeight)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(scroll)
    return () => observer.disconnect()
  }, [])

  // Follow the traveller when they move, but never fight a scroll in progress.
  useEffect(() => {
    const scroll = scrollRef.current
    if (!scroll) return
    scroll.scrollTo({ top: Math.max(0, (travelled - CAMERA_TRAIL) * SCROLL_SCALE), behavior: 'smooth' })
  }, [travelled])

  const eye = camera
  const eyeLateral = laneOffset(eye + CAMERA_TRAIL)

  // The camera stands on the road, so everything is projected relative to the
  // road's own lateral position — the near road stays centred and the wander
  // shows up as curve in the distance rather than a sideways slide.
  const view = useCallback(
    (depth: number, lateral: number, lift = 0) => project(depth, lateral - eyeLateral, lift),
    [eyeLateral],
  )

  const visible = useCallback((u: number) => u - eye > 46 && u - eye < DRAW_DISTANCE, [eye])

  // The road surface, as a ribbon narrowing into the distance.
  const ribbon = useMemo(() => {
    const near: string[] = []
    const far: string[] = []
    for (let u = Math.max(eye + NEAR_CULL, 0); u < Math.min(eye + DRAW_DISTANCE, ROAD_LENGTH + 260); u += 8) {
      const depth = u - eye
      const centre = laneOffset(u)
      const left = view(depth, centre - ROAD_HALF_WIDTH)
      const right = view(depth, centre + ROAD_HALF_WIDTH)
      near.push(`${left.x.toFixed(1)} ${left.y.toFixed(1)}`)
      far.unshift(`${right.x.toFixed(1)} ${right.y.toFixed(1)}`)
    }
    return near.length ? `M${near.concat(far).join('L')}Z` : ''
  }, [eye, view])

  // The drawn part of the road stops where the traveller has actually got to.
  const inkRibbon = useMemo(() => {
    const near: string[] = []
    const far: string[] = []
    const end = Math.min(travelled, eye + DRAW_DISTANCE)
    for (let u = Math.max(eye + NEAR_CULL, 0); u < end; u += 6) {
      const depth = u - eye
      const centre = laneOffset(u)
      const left = view(depth, centre - ROAD_HALF_WIDTH + 1.5)
      const right = view(depth, centre + ROAD_HALF_WIDTH - 1.5)
      near.push(`${left.x.toFixed(1)} ${left.y.toFixed(1)}`)
      far.unshift(`${right.x.toFixed(1)} ${right.y.toFixed(1)}`)
    }
    return near.length ? `M${near.concat(far).join('L')}Z` : ''
  }, [eye, travelled, view])

  // Painter's algorithm: everything on the ground, furthest drawn first.
  const drawables = useMemo(() => {
    const items: { key: string; u: number; node: React.ReactNode }[] = []

    scenery.forEach((prop, index) => {
      if (!visible(prop.u)) return
      const depth = prop.u - eye
      const base = view(depth, prop.v)
      const top = view(depth, prop.v, prop.size)
      const width = (prop.size * base.scale) / 2
      const owned = prop.stop !== undefined
      const lit = owned && prop.stop! < walked
      const beyond = prop.u > travelled + 40
      const opacity = (owned ? (lit ? 1 : 0.55) : 0.5) * (beyond ? 0.45 : 1)

      items.push({
        key: `prop-${index}`,
        u: prop.u,
        node: (
          <g className={`ink-prop is-${prop.kind}${lit ? ' is-lit' : ''}`} opacity={opacity}>
            {prop.kind === 'lantern' && lit && (
              <circle className="ink-prop-glow" cx={base.x} cy={(base.y + top.y) / 2} r={prop.size * base.scale} />
            )}
            {prop.kind === 'paddy' ? (
              <path className="ink-prop-paddy" d={paddyQuad(prop, eye, eyeLateral)} />
            ) : prop.kind === 'grass' ? (
              <path d={`M${base.x} ${base.y} l${-width * 0.5} ${top.y - base.y} M${base.x} ${base.y} l0 ${(top.y - base.y) * 1.1} M${base.x} ${base.y} l${width * 0.5} ${top.y - base.y}`} />
            ) : prop.kind === 'pine' ? (
              <path
                d={`M${base.x} ${base.y} L${base.x - width * 0.75} ${base.y - (base.y - top.y) * 0.45} L${base.x} ${top.y} L${base.x + width * 0.75} ${base.y - (base.y - top.y) * 0.45} Z`}
              />
            ) : prop.kind === 'lantern' ? (
              <>
                <line x1={base.x} y1={base.y} x2={base.x} y2={top.y} />
                <rect
                  className="ink-prop-fill"
                  x={base.x - width * 0.5}
                  y={top.y}
                  width={Math.max(1, width)}
                  height={Math.max(1, (base.y - top.y) * 0.4)}
                  rx={1}
                />
              </>
            ) : (
              <>
                <path
                  className="ink-prop-roof"
                  d={`M${base.x - width} ${base.y - (base.y - top.y) * 0.55} L${base.x} ${top.y} L${base.x + width} ${base.y - (base.y - top.y) * 0.55} Z`}
                />
                <rect
                  className="ink-prop-fill"
                  x={base.x - width * 0.75}
                  y={base.y - (base.y - top.y) * 0.55}
                  width={Math.max(1, width * 1.5)}
                  height={Math.max(1, (base.y - top.y) * 0.55)}
                />
              </>
            )}
          </g>
        ),
      })
    })

    INK_ROAD_WAYPOINTS.forEach((waypoint, index) => {
      const u = stops[index]!
      if (!visible(u)) return
      const depth = u - eye
      const centre = laneOffset(u)
      const ground = view(depth, centre)
      const node = state.waypoints[index]!
      const name = WAYPOINT_NAMES[waypoint.id] ?? waypoint.id
      const radius = Math.max(2.5, 5 * ground.scale)
      const showName = named === waypoint.id || waypoint.id === state.frontierId

      items.push({
        key: waypoint.id,
        u,
        node: (
          <g
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
            {waypoint.kind === 'shrine' ? (
              <path
                className="ink-node-mark"
                d={`M${ground.x - radius * 1.6} ${ground.y} L${ground.x - radius * 1.6} ${ground.y - radius * 2.4} M${ground.x + radius * 1.6} ${ground.y} L${ground.x + radius * 1.6} ${ground.y - radius * 2.4} M${ground.x - radius * 2.1} ${ground.y - radius * 2.4} L${ground.x + radius * 2.1} ${ground.y - radius * 2.4} M${ground.x - radius * 2.4} ${ground.y - radius * 3.1} L${ground.x + radius * 2.4} ${ground.y - radius * 3.1}`}
              />
            ) : (
              <>
                <ellipse className="ink-node-shadow" cx={ground.x} cy={ground.y + radius * 0.3} rx={radius * 1.5} ry={radius * 0.5} />
                <line className="ink-node-post" x1={ground.x} y1={ground.y} x2={ground.x} y2={ground.y - radius * 2.2} />
                <ellipse className="ink-node-mark" cx={ground.x} cy={ground.y - radius * 2.6} rx={radius * 0.9} ry={radius * 0.9} />
              </>
            )}
            {node.cleared && !node.due && (
              <rect className="ink-node-seal" x={ground.x + radius * 1.4} y={ground.y - radius * 1.1} width={Math.max(2, radius * 0.9)} height={Math.max(2, radius * 0.9)} rx={1} />
            )}
            {showName && ground.scale > 0.35 && (
              <text className="ink-node-name" x={ground.x} y={ground.y - radius * 3.6} textAnchor="middle">
                {name}
              </text>
            )}
          </g>
        ),
      })
    })

    return items.sort((a, b) => b.u - a.u)
  }, [eye, eyeLateral, named, scenery, state, stops, travelled, view, visible, walked])

  const traveller = view(Math.max(20, travelled - eye), laneOffset(travelled))
  const lantern = view(LANTERN_DISTANCE - eye, eyeLateral, LANTERN_LIFT)

  return (
    <main className="ink-road">
      <header className="ink-road-hud">
        <AppBackButton onClick={onBack} aria-label="Back to Quests" />
        <div className="ink-road-place">
          <b lang="ja">{TSUZURI_JAPANESE}</b>
          <span>{region.title} · {TSUZURI_BAND}</span>
        </div>
        <div className="ink-road-stats">
          <b>{Math.round(region.ink * 100)}%</b> ink · <b>{seals}</b>/{TOTAL_SEALS} seals
        </div>
      </header>

      <div className="ink-road-scroll" ref={scrollRef} onScroll={onScroll}>
        {/* A tall rail gives the scroll its range; the view itself stays put and
            re-renders from the camera, so scrolling walks rather than pans. */}
        <div className="ink-road-rail" style={{ height: (ROAD_LENGTH + 260) * SCROLL_SCALE }}>
          <svg
            className="ink-road-camera"
            style={{ height: viewport }}
            viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
            preserveAspectRatio="xMidYMid slice"
            role="img"
            aria-label={`Looking up the road through ${region.title}. ${region.waypointsCleared} of ${region.waypointCount} stops cleared.`}
          >
            <defs>
              <linearGradient id="ink-sky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--ink-fog-far)" />
                <stop offset="100%" stopColor="var(--ink-fog-near)" />
              </linearGradient>
              <radialGradient id="ink-lamp">
                <stop offset="0%" stopColor="var(--ink-lit)" stopOpacity="0.4" />
                <stop offset="55%" stopColor="var(--ink-lit)" stopOpacity="0.12" />
                <stop offset="100%" stopColor="var(--ink-lit)" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="ink-haze" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--ink-fog-near)" stopOpacity="0.95" />
                <stop offset="100%" stopColor="var(--ink-fog-near)" stopOpacity="0" />
              </linearGradient>
            </defs>

            <rect x={0} y={0} width={VIEW_WIDTH} height={HORIZON} fill="url(#ink-sky)" />
            <rect className="ink-ground" x={0} y={HORIZON} width={VIEW_WIDTH} height={VIEW_HEIGHT - HORIZON} />
            <path className="horizon-ridge" d={`M-10 ${HORIZON} L46 ${HORIZON - 30} L104 ${HORIZON - 12} L168 ${HORIZON - 38} L232 ${HORIZON - 16} L292 ${HORIZON - 34} L370 ${HORIZON - 14} L370 ${HORIZON} Z`} />

            {/* Far away and small until the regions between here and it are done. */}
            <HollowLantern x={lantern.x} y={lantern.y} height={LANTERN_SIZE * lantern.scale} warmth={warmth} idPrefix="sky" />

            {ribbon && <path className="ink-road-surface" d={ribbon} />}
            {inkRibbon && <path className="ink-road-drawn" d={inkRibbon} />}

            {drawables.map((item) => (
              <g key={item.key}>{item.node}</g>
            ))}

            <g className="ink-road-token">
              <ellipse className="ink-node-shadow" cx={traveller.x} cy={traveller.y} rx={Math.max(2, 6 * traveller.scale)} ry={Math.max(1, 2.4 * traveller.scale)} />
              <line x1={traveller.x} y1={traveller.y} x2={traveller.x} y2={traveller.y - 11 * traveller.scale} />
              <circle cx={traveller.x} cy={traveller.y - 13 * traveller.scale} r={Math.max(2, 3.4 * traveller.scale)} />
            </g>

            {/* Distance haze sits on the horizon, so the far road fades rather
                than ending in a hard line. */}
            <rect x={0} y={HORIZON - 6} width={VIEW_WIDTH} height={96} fill="url(#ink-haze)" pointerEvents="none" />
          </svg>
        </div>
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
          <span>{finished ? 'The fog is lifted' : `Route · ${state.waypoints[frontierIndex]!.kind === 'shrine' ? 'shrine trial' : '2 stops · 8 min'}`}</span>
          <button type="button" className="ink-road-demo" onClick={() => setWalked(START_WALKED)}>
            Demo data · reset
          </button>
        </div>
      </footer>
    </main>
  )
}
