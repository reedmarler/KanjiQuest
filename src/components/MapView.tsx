import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { INK_ROAD_REGIONS, INK_ROAD_WAYPOINTS, WAYPOINT_NAMES, lookFor } from '../data/inkRoad'
import {
  CAMERA_TRAIL,
  HORIZON,
  LANTERN_DISTANCE,
  LANTERN_LIFT,
  LANTERN_SIZE,
  NEAR_CULL,
  ROAD_HALF_WIDTH,
  TRAVELLER_HEIGHT,
  roadLength,
  seededRandom,
  VIEW_HEIGHT,
  VIEW_WIDTH,
  laneOffset,
  project,
  stopPositions,
} from '../lib/inkRoadCamera'
import { demoProgress } from '../lib/inkRoadDemo'
import { studyProgress, subscribeToProgress } from '../lib/studyRecord'
import { deriveMapState, type NodeState } from '../lib/mapState'
import { AppBackButton } from './AppBackButton'
import { HollowLantern } from './HollowLantern'
import { PropShape, Traveller, type Prop } from './InkRoadProps'

const START_WALKED = 4

/** Regions on the finished road; each one's shrine returns a seal. */
const TOTAL_SEALS = 9

/** Scroll pixels per world unit — how far a swipe carries you up the road. */
const SCROLL_SCALE = 1.15

/** Beyond this the ground has nothing left to draw; stop projecting it. */
const DRAW_DISTANCE = 1500

/** Nothing may sit closer to another prop than this, in world units. */
const PROP_CLEARANCE = 22

function buildScenery(stops: readonly number[], regionIds: readonly string[], end: number): Prop[] {
  const random = seededRandom(20260823)
  const props: Prop[] = []

  /*
   * Random placement put houses on top of each other: two props a few units
   * apart in depth overlap almost exactly on screen, which is what turned each
   * village into a pile of outlines. Everything goes through this.
   */
  const place = (candidate: Prop) => {
    // A market row is meant to be shoulder to shoulder; everything else needs
    // room or it renders as a pile.
    const clearance = candidate.kind === 'stall' || candidate.kind === 'banner' ? 12 : PROP_CLEARANCE
    const clash = props.some(
      (existing) =>
        Math.abs(existing.u - candidate.u) < clearance &&
        Math.abs(existing.v - candidate.v) < clearance,
    )
    if (!clash) props.push(candidate)
    return !clash
  }

  stops.forEach((u, index) => {
    const side = index % 2 === 0 ? -1 : 1
    place({ kind: 'toro', u: u + 4, v: laneOffset(u) + side * 24, size: 15, stop: index })


    /*
     * A village is buildings set back from the road; a market is stalls pressed
     * up against both sides of it, with banners between them. Density is what
     * distinguishes the two regions, so it is placement rather than palette
     * that has to carry it.
     */
    if (regionIds[index] === 'market') {
      for (let count = 0; count < 6; count += 1) {
        const at = u - 42 + count * 18
        const stallSide = count % 2 === 0 ? -1 : 1
        place({
          kind: 'stall',
          u: at,
          v: laneOffset(at) + stallSide * (26 + random() * 8),
          size: 15 + random() * 4,
          stop: index,
        })
      }
      for (let count = 0; count < 2; count += 1) {
        const at = u - 30 + count * 46
        place({
          kind: 'banner',
          u: at,
          v: laneOffset(at) + (count % 2 === 0 ? -1 : 1) * 19,
          size: 24 + random() * 6,
          stop: index,
        })
      }
      // Roofs behind the stalls, so the street has a town behind it.
      for (let count = 0; count < 3; count += 1) {
        const at = u - 30 + count * 30
        place({
          kind: 'house',
          u: at,
          v: laneOffset(at) + (count % 2 === 0 ? -1 : 1) * (62 + random() * 22),
          size: 19 + random() * 6,
          stop: index,
        })
      }
      return
    }

    // Houses line the roadside at a set-back, spaced along it rather than
    // scattered around the stop, so a village reads as a street.
    const houses = 2 + Math.floor(random() * 2)
    for (let count = 0; count < houses; count += 1) {
      const at = u - 34 + count * 34
      place({
        kind: 'house',
        u: at,
        v: laneOffset(at) + side * (46 + (count % 2) * 24 + random() * 8),
        size: 17 + random() * 6,
        stop: index,
      })
    }
  })

  /*
   * A continuous avenue down the village stretch. Planting only at the stops
   * gave clusters with bare road between them; the reference's sakura run the
   * whole way, in matched pairs, which is most of why its path reads as a road
   * through somewhere rather than a line across a field.
   */
  const villageStops = stops.filter((_, index) => regionIds[index] !== 'market')
  if (villageStops.length) {
    const from = villageStops[0]! - 60
    const to = villageStops[villageStops.length - 1]! + 40
    for (let at = from; at < to; at += 30) {
      for (const treeSide of [-1, 1]) {
        const nearest = stops.reduce((best, stop, index) => (
          Math.abs(stop - at) < Math.abs(stops[best]! - at) ? index : best
        ), 0)
        place({
          kind: 'sakura',
          u: at,
          v: laneOffset(at) + treeSide * (29 + (Math.round(at / 30) % 2) * 6),
          size: 21,
          stop: nearest,
        })
      }
    }
  }

  // A gate at the start of the road, and another wherever a region begins.
  place({ kind: 'torii', u: 26, v: laneOffset(26), size: 22 })
  regionIds.forEach((regionId, index) => {
    if (index === 0 || regionId === regionIds[index - 1]) return
    // Set back from the first stop of the new region, or the gate and that
    // stop's marker land on top of each other.
    const at = stops[index - 1]! + (stops[index]! - stops[index - 1]!) * 0.34
    place({ kind: 'torii', u: at, v: laneOffset(at), size: 24 })
  })

  // Ground cover along the whole road, stepping clear of the road surface.
  for (let u = 20; u < end; u += 18) {
    for (let count = 0; count < 3; count += 1) {
      const at = u + random() * 22 - 11
      const centre = laneOffset(at)
      const offset = (ROAD_HALF_WIDTH + 8 + random() * 84) * (random() > 0.5 ? 1 : -1)
      const roll = random()
      if (roll > 0.78) place({ kind: 'sakura', u: at, v: centre + offset, size: 15 + random() * 7 })
      else if (roll > 0.6) place({ kind: 'pine', u: at, v: centre + offset, size: 15 + random() * 8 })
      else if (roll > 0.06) place({ kind: 'grass', u: at, v: centre + offset, size: 4 + random() * 3 })
      else if (roll > 0.03) place({ kind: 'meadow', u: at, v: centre + offset * 1.3, size: 90 + random() * 70 })
      // Fields stay near the road: far out to the side there is no ground
      // detail left to read them against, and they float as bare diamonds.
      else if (Math.abs(offset) < 68) {
        place({ kind: 'paddy', u: at, v: centre + offset * 0.8, size: 26 + random() * 12 })
      }
    }
  }

  return props
}

/**
 * A flat patch on the ground plane: its outer bund, then furrows running across
 * it. The furrows are what sell it as lying flat — a bare quad at a wide angle
 * just reads as a diamond floating over the ground.
 */
function paddyPaths(prop: Prop, eye: number, eyeLateral: number): { bund: string; furrows: string } {
  const halfLength = prop.size * 0.5
  const halfWidth = prop.size * 0.62
  const at = (u: number, v: number) => {
    const point = project(Math.max(8, u - eye), v - eyeLateral)
    return `${point.x.toFixed(1)} ${point.y.toFixed(1)}`
  }

  const bund = `M${at(prop.u - halfLength, prop.v - halfWidth)}L${at(prop.u + halfLength, prop.v - halfWidth)}L${at(prop.u + halfLength, prop.v + halfWidth)}L${at(prop.u - halfLength, prop.v + halfWidth)}Z`

  const furrows = [0.28, 0.5, 0.72]
    .map((t) => {
      const u = prop.u - halfLength + t * halfLength * 2
      return `M${at(u, prop.v - halfWidth)}L${at(u, prop.v + halfWidth)}`
    })
    .join('')

  return { bund, furrows }
}

/**
 * Petals in the air.
 *
 * Deliberately in screen space: a petal drifting past the camera has no place
 * on the ground to belong to, and pinning them to world positions made them
 * jump whenever the camera moved. Seeded so the drift is the same every load.
 */
function Petals() {
  const petals = useMemo(() => {
    const random = seededRandom(9152)
    return Array.from({ length: 16 }, () => ({
      x: random() * VIEW_WIDTH,
      size: 1.6 + random() * 2.4,
      delay: -random() * 18,
      duration: 11 + random() * 9,
      drift: 12 + random() * 26,
    }))
  }, [])

  return (
    <g className="ink-petals" aria-hidden="true">
      {petals.map((petal, index) => (
        <g
          key={index}
          className="ink-petal"
          style={{
            ['--petal-x' as string]: `${petal.x}px`,
            ['--petal-drift' as string]: `${petal.drift}px`,
            animationDelay: `${petal.delay}s`,
            animationDuration: `${petal.duration}s`,
          }}
        >
          <ellipse rx={petal.size} ry={petal.size * 0.62} />
        </g>
      ))}
    </g>
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
  /** Opens the study screen that feeds this region's threads. */
  onStudy: () => void
  /** Opens the trial standing between this region and the next. */
  onShrine: (regionId: string) => void
}

export function MapView({ onBack, onStudy, onShrine }: MapViewProps) {
  const [walked, setWalked] = useState(START_WALKED)
  /*
   * The map reads the scheduler now. Demo mode stays because a learner who has
   * never studied kana would otherwise open the road and find every stop
   * fogged, which shows nothing about whether walking one is worth doing.
   */
  const [demo, setDemo] = useState(false)
  const [progress, setProgress] = useState(studyProgress)
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

  const regionIds = useMemo(() => INK_ROAD_WAYPOINTS.map((waypoint) => waypoint.regionId), [])
  const stops = useMemo(() => stopPositions(regionIds), [regionIds])
  const end = useMemo(() => roadLength(stops), [stops])
  const scenery = useMemo(() => buildScenery(stops, regionIds, end), [end, regionIds, stops])

  const state = useMemo(
    () => deriveMapState(
      demo ? demoProgress(INK_ROAD_WAYPOINTS, walked) : progress,
      INK_ROAD_WAYPOINTS,
      INK_ROAD_REGIONS,
    ),
    [demo, progress, walked],
  )

  const frontierRegionId = INK_ROAD_WAYPOINTS.find((waypoint) => waypoint.id === state.frontierId)?.regionId
    ?? INK_ROAD_REGIONS[INK_ROAD_REGIONS.length - 1]!.id
  const region = state.regions.find((entry) => entry.id === frontierRegionId) ?? state.regions[0]!
  const look = lookFor(region.id)
  const frontierIndex = Math.max(0, INK_ROAD_WAYPOINTS.findIndex((waypoint) => waypoint.id === state.frontierId))
  const finished = demo ? walked >= INK_ROAD_WAYPOINTS.length : state.frontierId === null

  // How far along the road the session actually got: everything behind the
  // frontier, plus the share of the stop being studied that is already inked.
  const behind = frontierIndex > 0 ? stops[frontierIndex - 1]! : 0
  const travelled = behind + (stops[frontierIndex]! - behind) * state.waypoints[frontierIndex]!.ink

  // The region's own light, applied as custom properties the shapes read.
  const palette = look.palette
  const light = {
    ['--ink-fog-far' as string]: palette.skyFar,
    ['--ink-fog-near' as string]: palette.skyNear,
    ['--ink-ground' as string]: palette.ground,
    ['--ink-line' as string]: palette.ink,
    ['--ink-lit' as string]: palette.lit,
    ['--sakura' as string]: palette.bloom,
    ['--prop-light' as string]: palette.propLight,
    ['--prop-mid' as string]: palette.propMid,
    ['--prop-dark' as string]: palette.propDark,
    ['--ink-mark' as string]: palette.mark,
    ['--ink-peak' as string]: palette.peak ?? palette.propLight,
  }

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

  // Every write replaces the stored object, so this hands the view a new
  // identity to render from rather than a counter to invalidate a memo with.
  useEffect(() => subscribeToProgress(() => setProgress(studyProgress())), [])

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
    for (let u = Math.max(eye + NEAR_CULL, 0); u < Math.min(eye + DRAW_DISTANCE, end); u += 8) {
      const depth = u - eye
      const centre = laneOffset(u)
      const left = view(depth, centre - ROAD_HALF_WIDTH)
      const right = view(depth, centre + ROAD_HALF_WIDTH)
      near.push(`${left.x.toFixed(1)} ${left.y.toFixed(1)}`)
      far.unshift(`${right.x.toFixed(1)} ${right.y.toFixed(1)}`)
    }
    return near.length ? `M${near.concat(far).join('L')}Z` : ''
  }, [end, eye, view])

  /*
   * The drawn part of the road is a brush stroke laid along the path, not the
   * path itself: narrower than the road, with a width that breathes along its
   * length. A full-width slab was the brightest and least interesting thing in
   * the frame, and it crowded out the village and the lantern.
   */
  const inkRibbon = useMemo(() => {
    const near: string[] = []
    const far: string[] = []
    const end = Math.min(travelled, eye + DRAW_DISTANCE)
    for (let u = Math.max(eye + NEAR_CULL, 0); u < end; u += 5) {
      const depth = u - eye
      const centre = laneOffset(u)
      const half = ROAD_HALF_WIDTH * (0.46 + 0.07 * Math.sin(u / 23) + 0.04 * Math.sin(u / 9))
      const left = view(depth, centre - half)
      const right = view(depth, centre + half)
      near.push(`${left.x.toFixed(1)} ${left.y.toFixed(1)}`)
      far.unshift(`${right.x.toFixed(1)} ${right.y.toFixed(1)}`)
    }
    return near.length ? `M${near.concat(far).join('L')}Z` : ''
  }, [eye, travelled, view])

  /** Joints across the paving, so the path reads as laid stone. */
  const slabs = useMemo(() => {
    const lines: string[] = []
    const end = Math.min(travelled, eye + 620)
    for (let u = Math.ceil((eye + NEAR_CULL) / 26) * 26; u < end; u += 26) {
      const depth = u - eye
      const centre = laneOffset(u)
      const half = ROAD_HALF_WIDTH * 0.5
      const left = view(depth, centre - half)
      const right = view(depth, centre + half)
      lines.push(`M${left.x.toFixed(1)} ${left.y.toFixed(1)}L${right.x.toFixed(1)} ${right.y.toFixed(1)}`)
    }
    return lines.join('')
  }, [eye, travelled, view])

  /** Worn patches along the walked stretch, so it reads as trodden. */
  const treads = useMemo(() => {
    const marks: { x: number; y: number; rx: number; ry: number }[] = []
    const end = Math.min(travelled, eye + 520)
    for (let u = Math.max(eye + NEAR_CULL, 0); u < end; u += 34) {
      const depth = u - eye
      const point = view(depth, laneOffset(u) + Math.sin(u / 17) * ROAD_HALF_WIDTH * 0.3)
      marks.push({ x: point.x, y: point.y, rx: 2.4 * point.scale, ry: 0.9 * point.scale })
    }
    return marks
  }, [eye, travelled, view])

  // Painter's algorithm: everything on the ground, furthest drawn first.
  /** Where the road stops being drawn because the region beyond it is sealed. */
  const sealedAt = useMemo(() => {
    const sealed = state.waypoints.find((waypoint) => waypoint.node === 'sealed')
    return sealed ? stops[state.waypoints.indexOf(sealed)]! : Infinity
  }, [state.waypoints, stops])

  const drawables = useMemo(() => {
    const items: { key: string; u: number; node: React.ReactNode }[] = []

    scenery.forEach((prop, index) => {
      if (!visible(prop.u) || prop.u > sealedAt - 40) return
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
            {prop.kind !== 'paddy' && prop.kind !== 'grass' && (
              <ellipse
                className="ink-prop-contact"
                cx={base.x}
                cy={base.y}
                rx={Math.max(1, width * 1.5)}
                ry={Math.max(0.5, width * 0.42)}
              />
            )}
            {prop.kind === 'toro' && lit && (
              <circle className="ink-prop-glow" cx={base.x} cy={(base.y + top.y) / 2} r={prop.size * base.scale} />
            )}
            {prop.kind === 'paddy' ? (
              (() => {
                const paths = paddyPaths(prop, eye, eyeLateral)
                return (
                  <>
                    <path className="ink-prop-paddy" d={paths.bund} />
                    <path className="ink-prop-furrow" d={paths.furrows} />
                  </>
                )
              })()
            ) : (
              <PropShape kind={prop.kind} base={base} top={top} width={width} />
            )}
          </g>
        ),
      })
    })

    INK_ROAD_WAYPOINTS.forEach((waypoint, index) => {
      const u = stops[index]!
      if (!visible(u) || u > sealedAt - 40) return
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
              <text className="ink-node-name" x={ground.x} y={ground.y - radius * 5.6} textAnchor="middle">
                {name}
              </text>
            )}
          </g>
        ),
      })
    })

    return items.sort((a, b) => b.u - a.u)
  }, [eye, eyeLateral, named, scenery, sealedAt, state, stops, travelled, view, visible, walked])

  /*
   * Scroll ahead of the traveller and they are behind the camera, where there
   * is no projection. Clamping the depth pinned them to the near plane instead,
   * so a huge marker sat off the road at the bottom of the frame.
   */
  const travellerDepth = travelled - eye
  const traveller = travellerDepth > 16
    ? {
        base: view(travellerDepth, laneOffset(travelled)),
        top: view(travellerDepth, laneOffset(travelled), TRAVELLER_HEIGHT),
      }
    : null
  const lantern = view(LANTERN_DISTANCE - eye, eyeLateral, LANTERN_LIFT)

  return (
    <main className="ink-road" style={light}>
      <header className="ink-road-hud">
        <AppBackButton onClick={onBack} aria-label="Back to Quests" />
        <div className="ink-road-place">
          <b lang="ja">{look.japanese}</b>
          <span>{region.title} · {look.band}</span>
        </div>
        <div className="ink-road-stats">
          <b>{Math.round(region.ink * 100)}%</b> ink · <b>{seals}</b>/{TOTAL_SEALS} seals
        </div>
      </header>

      <div className="ink-road-scroll" ref={scrollRef} onScroll={onScroll}>
        {/* A tall rail gives the scroll its range; the view itself stays put and
            re-renders from the camera, so scrolling walks rather than pans. */}
        {/*
          The rail stops at the seal. Running it the full length of the road let
          the camera scroll into a region that is deliberately not drawn, so the
          world simply ran out — the fog bank has to be the last thing ahead.
        */}
        <div
          className="ink-road-rail"
          style={{ height: Math.min(end, Number.isFinite(sealedAt) ? sealedAt - 30 : end) * SCROLL_SCALE }}
        >
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
                {/* The warm cast low in the sky is what makes it a time of day
                    rather than a background colour — spread wide, because a
                    narrow stop reads as a drawn line rather than as light. */}
                <stop offset="70%" stopColor="var(--ink-fog-near)" />
                <stop offset="100%" stopColor="color-mix(in srgb, var(--ink-fog-near) 82%, var(--ink-lit))" />
              </linearGradient>
              <radialGradient id="ink-lamp">
                <stop offset="0%" stopColor="var(--ink-lit)" stopOpacity="0.4" />
                <stop offset="55%" stopColor="var(--ink-lit)" stopOpacity="0.12" />
                <stop offset="100%" stopColor="var(--ink-lit)" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="ink-seal-fog" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--ink-fog-near)" stopOpacity="0" />
                <stop offset="45%" stopColor="var(--ink-fog-near)" stopOpacity="0.72" />
                <stop offset="100%" stopColor="var(--ink-fog-near)" stopOpacity="0.95" />
              </linearGradient>
              <linearGradient id="ink-haze" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--ink-fog-near)" stopOpacity="0.96" />
                <stop offset="12%" stopColor="var(--ink-fog-near)" stopOpacity="0.72" />
                <stop offset="34%" stopColor="var(--ink-fog-near)" stopOpacity="0.3" />
                <stop offset="62%" stopColor="var(--ink-fog-near)" stopOpacity="0.06" />
                <stop offset="100%" stopColor="var(--ink-fog-near)" stopOpacity="0" />
              </linearGradient>
            </defs>

            <rect x={0} y={0} width={VIEW_WIDTH} height={HORIZON + 2} fill="url(#ink-sky)" />
            <rect className="ink-ground" x={0} y={HORIZON} width={VIEW_WIDTH} height={VIEW_HEIGHT - HORIZON} />

            {/* Three ridgelines, each paler than the one in front, which is the
                cheapest honest depth cue a landscape has. */}
            <path className="horizon-ridge is-far" d={`M-10 ${HORIZON} L38 ${HORIZON - 46} L96 ${HORIZON - 20} L150 ${HORIZON - 52} L214 ${HORIZON - 24} L276 ${HORIZON - 44} L370 ${HORIZON - 18} L370 ${HORIZON} Z`} />
            <path className="horizon-ridge is-mid" d={`M-10 ${HORIZON} L52 ${HORIZON - 30} L118 ${HORIZON - 12} L176 ${HORIZON - 34} L244 ${HORIZON - 14} L310 ${HORIZON - 28} L370 ${HORIZON - 10} L370 ${HORIZON} Z`} />
            {/* The far peak the reference always has somewhere in frame. */}
            <path className="horizon-peak" d={`M232 ${HORIZON} L296 ${HORIZON - 74} L360 ${HORIZON} Z`} />
            <path className="horizon-snow" d={`M279 ${HORIZON - 54} L296 ${HORIZON - 74} L313 ${HORIZON - 54} Q305 ${HORIZON - 49} 296 ${HORIZON - 53} Q287 ${HORIZON - 49} 279 ${HORIZON - 54} Z`} />

            <path className="horizon-ridge is-near" d={`M-10 ${HORIZON} L70 ${HORIZON - 16} L140 ${HORIZON - 6} L206 ${HORIZON - 18} L280 ${HORIZON - 7} L370 ${HORIZON - 14} L370 ${HORIZON} Z`} />

            {/* Far away and small until the regions between here and it are done. */}
            <HollowLantern x={lantern.x} y={lantern.y} height={LANTERN_SIZE * lantern.scale} warmth={warmth} idPrefix="sky" />

            {ribbon && <path className="ink-road-surface" d={ribbon} />}
            {inkRibbon && <path className="ink-road-drawn" d={inkRibbon} />}
            {slabs && <path className="ink-road-slabs" d={slabs} />}
            <g className="ink-road-tread">
              {treads.map((mark, index) => (
                <ellipse key={index} cx={mark.x} cy={mark.y} rx={mark.rx} ry={mark.ry} />
              ))}
            </g>

            {drawables.map((item) => (
              <g key={item.key}>{item.node}</g>
            ))}

            {(() => {
              /*
               * Past a sealed region nothing is drawn, which left the road
               * running into plain darkness. Fog is what the design says is
               * there, so it has to be visible: a bank standing across the road
               * at the seal, sized by its distance like everything else.
               */
              if (!Number.isFinite(sealedAt)) return null
              const depth = sealedAt - 60 - eye
              if (depth < 20 || depth > DRAW_DISTANCE) return null
              const foot = view(depth, laneOffset(sealedAt))
              const height = Math.max(24, 150 * foot.scale)
              return (
                <rect
                  className="ink-road-seal-fog"
                  x={-20}
                  y={foot.y - height}
                  width={VIEW_WIDTH + 40}
                  height={height + 8}
                />
              )
            })()}

            <Petals />

            {traveller && (
              <Traveller
                base={traveller.base}
                top={traveller.top}
                width={Math.max(1.4, 9 * traveller.base.scale)}
              />
            )}

            {/*
              Distance is height in this projection, so one vertical wash over
              the whole scene is atmospheric perspective: far things sink into
              the sky's colour, near things are untouched.
            */}
            <rect
              x={0}
              y={HORIZON - 10}
              width={VIEW_WIDTH}
              height={VIEW_HEIGHT - HORIZON + 10}
              fill="url(#ink-haze)"
              opacity={palette.haze}
              pointerEvents="none"
            />
          </svg>
        </div>
      </div>

      <footer className="ink-road-cta">
        <button
          type="button"
          className="btn btn-primary"
          disabled={demo && finished}
          onClick={() => {
            if (demo) setWalked((count) => Math.min(INK_ROAD_WAYPOINTS.length, count + 1))
            else if (state.waypoints[frontierIndex]!.kind === 'shrine') onShrine(region.id)
            else onStudy()
          }}
        >
          {demo && finished ? 'Road complete' : <>Continue <span aria-hidden="true">·</span> {WAYPOINT_NAMES[state.frontierId ?? ''] ?? ''}</>}
        </button>
        <div className="ink-road-route">
          <span>
            {demo
              ? 'Demo history'
              : state.due > 0
                ? `${state.due} due · ${region.waypointsCleared}/${region.waypointCount} stops`
                : `${region.waypointsCleared}/${region.waypointCount} stops cleared`}
          </span>
          <button
            type="button"
            className="ink-road-demo"
            aria-pressed={demo}
            onClick={() => { setDemo((on) => !on); setWalked(START_WALKED) }}
          >
            {demo ? 'Show my progress' : 'Preview with demo data'}
          </button>
        </div>
      </footer>
    </main>
  )
}
