import { useEffect, useReducer, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronRight, Compass, Footprints, Languages, Mail, Map, MapPin, RotateCcw, Ship, Sparkles, Stamp, Sun, X } from 'lucide-react'
import { REALM_ITEMS, REALM_LINES, REALM_LOCATIONS, REALM_REGIONS, type RealmClue, type RealmItem, type RealmLocation, type RealmTarget } from '../data/inkRealmQuest'
import { inkRealmReducer, loadInkRealmProgress, realmClues, realmInventory, realmObjective, saveInkRealmProgress } from '../lib/inkRealmQuest'
import { APP_FURIGANA_DEFAULT_KEY, loadBooleanPreference } from '../lib/displayPreferences'
import { SpeakButtons } from './SpeakButtons'
import './QuestHub.css'

const HERO = '/generated/sakura-sprint-static-v3.png'
const PHASES = ['briefing', 'searching', 'meeting', 'recovered', 'restored']

function JapaneseClue({ id, furigana }: { id: RealmClue; furigana: boolean }) {
  const line = REALM_LINES[id]!
  return (
    <div className="realm-clue">
      <p lang="ja">{line.parts.map((part, index) => <ruby key={index}>{part[0]}{furigana && part[1] && <rt>{part[1]}</rt>}</ruby>)}</p>
      <div className="realm-clue-help">
        <details><summary><Languages size={15} /> Meaning</summary><p>{line.meaning}</p></details>
        <SpeakButtons text={line.parts.map((part) => part[0]).join('')} showLearning={false} />
      </div>
    </div>
  )
}

export function QuestHub() {
  const [progress, dispatch] = useReducer(inkRealmReducer, undefined, loadInkRealmProgress)
  const [view, setView] = useState<'quest' | 'journey'>('quest')
  const [panel, setPanel] = useState<'scene' | 'journal'>('scene')
  const [target, setTarget] = useState<RealmTarget | null>(null)
  const [selectedItem, setSelectedItem] = useState<RealmItem | null>(null)
  const [furigana, setFurigana] = useState(() => loadBooleanPreference(APP_FURIGANA_DEFAULT_KEY, true))
  const [saved, setSaved] = useState(true)
  const [selectedRegion, setSelectedRegion] = useState(0)
  const panelHeading = useRef<HTMLHeadingElement>(null)
  const inventory = realmInventory(progress)
  const clues = realmClues(progress)
  const location = REALM_LOCATIONS[progress.location]
  const restored = progress.phase === 'restored'
  const region = REALM_REGIONS[selectedRegion]!
  const act = PHASES.indexOf(progress.phase)

  useEffect(() => { setSaved(saveInkRealmProgress(progress)) }, [progress])

  function travel(next: RealmLocation) {
    dispatch({ type: 'travel', location: next })
    setTarget(null)
    setSelectedItem(null)
    setPanel('scene')
  }

  function inspect(next: RealmTarget) {
    setTarget(next)
    setPanel('scene')
    if (next === 'notice' || next === 'porter' || next === 'large-boat') dispatch({ type: 'inspect', encounter: next })
    // Focus the newly opened conversation without moving the viewport.
    requestAnimationFrame(() => panelHeading.current?.focus({ preventScroll: true }))
  }

  function sceneContent(): { title: string; text: string; clue?: RealmClue } {
    if (restored) return { title: 'A light to come home to', text: 'The seal takes the ink. Light returns to the gate, and a path through the village becomes visible. Beyond it lies the Market Road.', clue: 'restored' }
    if (progress.phase === 'briefing') return { title: 'The village keeper', text: 'The names on our lanterns are fading. A courier is bringing a new seal, but they have not arrived. Will you take my letter and find them?' }
    if (target === 'notice') return { title: 'A note from the courier', text: 'A second message is tucked beneath the keeper\'s signature.', clue: 'description' }
    if (target === 'porter') return { title: 'The traveler with the scroll', text: 'The traveler shakes his head, then points toward the other end of the bridge.', clue: 'porter' }
    if (target === 'courier') {
      if (progress.phase === 'searching') return { title: 'The traveler with the book', text: 'She notices the village crest on your armor and waits for an introduction.', clue: 'request' }
      return { title: 'The courier', text: 'She recognizes the keeper\'s handwriting. Her parcel is still aboard her boat.', clue: 'meeting' }
    }
    if (target === 'large-boat') return { title: 'The ferry captain', text: 'No parcel for the village here. The captain nods toward the steps by the water.', clue: 'wrongBoat' }
    if (target === 'small-boat') {
      if (progress.phase === 'searching') return { title: 'A quiet mooring', text: 'A sealed parcel rests inside, but the owner has not returned. The keeper\'s letter is still waiting for its recipient.', clue: 'invitation' }
      if (progress.phase === 'recovered') return { title: 'The lantern seal', text: 'The courier unwraps a carved seal bearing the character for light. It belongs to the lantern at the village gate.', clue: 'return' }
      return { title: 'The courier\'s boat', text: 'The courier is waiting with a small wrapped parcel. She holds it out to you.', clue: 'boat' }
    }
    if (target === 'lantern') return { title: 'The gate lantern', text: progress.phase === 'recovered' ? 'The empty square on its frame matches the seal in your belongings.' : 'The lantern is cold. An empty square marks where the keeper\'s seal once held its name.' }
    if (target === 'keeper') return { title: 'The village keeper', text: 'The keeper looks toward the bridge. A folded note describes the person you are looking for.', clue: 'invitation' }
    if (progress.phase === 'recovered') return { title: 'A warm parcel', text: 'The seal is safely in your belongings. The village keeper is waiting at the gate.', clue: 'return' }
    if (progress.phase === 'meeting' && progress.location === 'pier') return { title: 'Two boats, one meeting', text: 'The courier\'s parting words are still fresh in your mind.', clue: 'boat' }
    if (progress.phase === 'meeting') return { title: 'An agreed meeting', text: 'The courier has gone ahead. Her message tells you where to find the parcel.', clue: 'meeting' }
    return { title: location.name, text: location.description, clue: 'invitation' }
  }

  const scene = sceneContent()
  const targets: Array<{ id: RealmTarget; label: string; style: string }> = restored ? [] : progress.location === 'gate'
    ? [{ id: 'keeper', label: 'Village keeper', style: 'keeper' }, { id: 'notice', label: 'Courier note', style: 'notice' }, { id: 'lantern', label: 'Gate lantern', style: 'lantern' }]
    : progress.location === 'bridge'
      ? [{ id: 'porter', label: 'Traveler with scroll', style: 'porter' }, ...(progress.phase === 'searching' ? [{ id: 'courier' as const, label: 'Traveler with book', style: 'courier' }] : [])]
      : [{ id: 'small-boat', label: 'Small boat', style: 'small-boat' }, { id: 'large-boat', label: 'Large ferry', style: 'large-boat' }]

  return (
    <main className="realm" data-noswipe>
      <header className="realm-header">
        <div className="realm-title"><span className="realm-mark" lang="ja">旅</span><div><span className="realm-eyebrow">KANJI QUEST</span><h1>The Ink Realm</h1></div></div>
        <div className="realm-header-actions">
          <span className="realm-save" role="status">{saved ? <><Check size={14} /> Saved</> : 'Progress could not be saved on this device'}</span>
          <button type="button" className="realm-icon-button" title={view === 'quest' ? 'Open world journey' : 'Return to quest'} aria-label={view === 'quest' ? 'Open world journey' : 'Return to quest'} onClick={() => setView(view === 'quest' ? 'journey' : 'quest')}>{view === 'quest' ? <Map size={22} /> : <ArrowLeft size={22} />}</button>
        </div>
      </header>

      {view === 'journey' ? (
        <section className="realm-journey">
          <div className="realm-journey-heading"><Compass size={21} /><h2>The road north</h2><span>{progress.completedAt ? '1' : '0'} restoration stamps</span></div>
          <div className="realm-journey-layout">
            <ol className="realm-region-list">{REALM_REGIONS.map((place, index) => <li key={place.name}>
              <button type="button" className={index === selectedRegion ? 'is-selected' : ''} aria-pressed={index === selectedRegion} onClick={() => setSelectedRegion(index)}>
                <span className={`realm-region-dot${index === 0 || (index === 1 && progress.completedAt) ? ' is-open' : ''}`}>{index === 0 && progress.completedAt ? <Check size={16} /> : String(index + 1).padStart(2, '0')}</span>
                <span><b>{place.name}</b><small>{place.level} · {index === 0 ? 'First Light' : index === 1 && progress.completedAt ? 'Road revealed' : 'Unexplored'}</small></span><ChevronRight size={17} />
              </button>
            </li>)}</ol>
            <div className="realm-region-detail">
              {selectedRegion === 0 && <div className="realm-region-art"><img src={progress.completedAt ? '/quest-art/tsuzuri-village-restored.png' : '/quest-art/tsuzuri-village.png'} alt="Tsuzuri Village, with its stone bridge and river landing" /><img className="realm-region-hero" src={HERO} alt="Our cherry-blossom samurai" /></div>}
              <span className="realm-eyebrow">{region.level} · <span lang="ja">{region.japanese}</span></span><h2>{region.name}</h2><p>{region.description}</p>
              {selectedRegion === 0 ? <><div className="realm-chapter-row"><Sun size={24} /><div><b>First Light</b><small>{restored ? 'The gate lantern is alight.' : realmObjective(progress)}</small></div>{progress.completedAt && <Stamp size={22} />}</div><button className="realm-primary" type="button" onClick={() => setView('quest')}>{restored ? 'Visit the village' : progress.phase === 'briefing' ? 'Enter the village' : 'Continue quest'}<ArrowRight size={18} /></button></> : <p className="realm-unavailable">{selectedRegion === 1 && progress.completedAt ? 'The road is revealed. Its next chapter is not yet available.' : 'This chapter is not yet available.'}</p>}
            </div>
          </div>
        </section>
      ) : <>
        <section className="realm-chapter-heading"><div><span className="realm-eyebrow">01 · TSUZURI VILLAGE</span><h2>First Light</h2></div><div className="realm-objective"><span>{realmObjective(progress)}</span><div className="realm-steps" aria-label={`Quest progress: ${act} of 4 stages complete`}>{[1, 2, 3, 4].map((step) => <i key={step} className={act >= step ? 'is-done' : ''} />)}</div></div></section>
        <div className="realm-play-layout">
          <section className="realm-world" aria-label={location.name}>
            <div className={`realm-scene realm-at-${progress.location}${restored ? ' is-restored' : ''}`}>
              <img className="realm-background" src="/quest-art/tsuzuri-village.png" alt="A canal village with a gate lantern, stone bridge, and moored boats" />
              {restored && <img className="realm-background realm-background-restored" src="/quest-art/tsuzuri-village-restored.png" alt="Warm light returns to the gate lantern and the village" />}
              <div className="realm-location-label"><MapPin size={15} /><span>{location.name}</span><span lang="ja">{location.japanese}</span></div>
              {restored && <div className="realm-restored-mark"><Sun size={24} /><span>The first light</span><b lang="ja">灯</b></div>}
              <div className={`realm-player${target ? ' is-approaching' : ''}`}><img src={HERO} alt="Cherry-blossom samurai, your character" /><span>You</span></div>
              {targets.map((spot) => <button type="button" key={spot.id} className={`realm-hotspot realm-hotspot-${spot.style}${target === spot.id ? ' is-selected' : ''}`} aria-label={spot.label} aria-pressed={target === spot.id} disabled={progress.phase === 'briefing' && spot.id !== 'keeper'} onClick={() => inspect(spot.id)}>
                {(spot.id === 'porter' || spot.id === 'courier' || spot.id === 'keeper') ? <span className={`realm-npc realm-npc-${spot.id}`} aria-hidden="true" /> : <span className="realm-hotspot-mark">{spot.id === 'notice' ? <Mail /> : spot.id === 'lantern' ? <Sun /> : <Ship />}</span>}
                <span className="realm-hotspot-label">{spot.label}</span>
              </button>)}
            </div>
            <nav className="realm-locations" aria-label="Village locations">{(Object.keys(REALM_LOCATIONS) as RealmLocation[]).map((place) => <button type="button" key={place} aria-current={progress.location === place ? 'location' : undefined} disabled={progress.phase === 'briefing'} onClick={() => travel(place)}><MapPin size={16} /><span>{REALM_LOCATIONS[place].name}</span>{progress.location === place && <span className="realm-here-dot" />}</button>)}</nav>
            <div className="realm-inventory"><span className="realm-inventory-title">Belongings</span><div className="realm-inventory-items">{inventory.length ? inventory.map((item) => <button type="button" key={item} className={selectedItem === item ? 'is-selected' : ''} aria-pressed={selectedItem === item} title={REALM_ITEMS[item].description} onClick={() => { setSelectedItem(selectedItem === item ? null : item); setPanel('scene') }}><span lang="ja">{REALM_ITEMS[item].mark}</span><b>{REALM_ITEMS[item].name}</b></button>) : <span className="realm-empty-inventory">Your journey begins here.</span>}</div></div>
          </section>
          <aside className="realm-notebook">
            <div className="realm-panel-tabs" role="tablist" aria-label="Quest notebook" onKeyDown={(event) => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
              event.preventDefault()
              const next = event.key === 'Home' ? 'scene' : event.key === 'End' ? 'journal' : panel === 'scene' ? 'journal' : 'scene'
              setPanel(next)
              document.getElementById(`realm-${next}-tab`)?.focus()
            }}>
              <button id="realm-scene-tab" type="button" role="tab" tabIndex={panel === 'scene' ? 0 : -1} aria-selected={panel === 'scene'} aria-controls={panel === 'scene' ? 'realm-scene-panel' : undefined} onClick={() => setPanel('scene')}><Footprints size={16} /> Encounter</button>
              <button id="realm-journal-tab" type="button" role="tab" tabIndex={panel === 'journal' ? 0 : -1} aria-selected={panel === 'journal'} aria-controls={panel === 'journal' ? 'realm-journal-panel' : undefined} onClick={() => setPanel('journal')}><BookOpen size={16} /> Clues <span>{clues.length}</span></button>
            </div>
            <label className="realm-reading-toggle"><input type="checkbox" checked={furigana} onChange={(event) => setFurigana(event.target.checked)} /> Furigana</label>
            {panel === 'scene' ? <div id="realm-scene-panel" role="tabpanel" aria-labelledby="realm-scene-tab" className="realm-panel-content">
              <span className="realm-eyebrow">{restored ? 'CHAPTER COMPLETE' : progress.phase === 'briefing' ? 'A REQUEST' : location.name.toUpperCase()}</span>
              <h3 ref={panelHeading} tabIndex={-1}>{scene.title}</h3><p className="realm-narrative">{scene.text}</p>
              {scene.clue && <JapaneseClue key={`${scene.clue}-${target}`} id={scene.clue} furigana={furigana} />}
              {selectedItem && <div className="realm-selected-item"><div><b>{REALM_ITEMS[selectedItem].name}</b><p>{REALM_ITEMS[selectedItem].description}</p></div><button type="button" className="realm-icon-button" aria-label="Put item away" title="Put item away" onClick={() => setSelectedItem(null)}><X size={17} /></button></div>}
              <div className="realm-scene-actions">
                {progress.phase === 'briefing' && <button type="button" className="realm-primary" onClick={() => { dispatch({ type: 'accept' }); setTarget('keeper') }}><Mail size={18} /> Accept the letter</button>}
                {target === 'courier' && progress.phase === 'searching' && selectedItem === 'letter' && <button type="button" className="realm-primary" onClick={() => { dispatch({ type: 'show-letter' }); setSelectedItem(null) }}><Mail size={18} /> Show the keeper's letter</button>}
                {target === 'courier' && progress.phase === 'meeting' && <button type="button" className="realm-primary" onClick={() => travel('pier')}><Footprints size={18} /> Follow to the landing</button>}
                {target === 'small-boat' && progress.phase === 'meeting' && <button type="button" className="realm-primary" onClick={() => { dispatch({ type: 'collect-seal' }); setSelectedItem('seal') }}><Stamp size={18} /> Receive the seal</button>}
                {target === 'lantern' && progress.phase === 'recovered' && selectedItem === 'seal' && <button type="button" className="realm-primary" onClick={() => { dispatch({ type: 'restore', now: Date.now() }); setSelectedItem(null) }}><Sparkles size={18} /> Press the seal into the frame</button>}
                {restored && <><div className="realm-reward"><span lang="ja">灯</span><div><b>First Light</b><p>Restoration stamp earned</p></div><Check size={20} /></div><button type="button" className="realm-primary" onClick={() => { setView('journey'); setSelectedRegion(1) }}><Compass size={18} /> See the road ahead</button><button type="button" className="realm-text-button" onClick={() => { dispatch({ type: 'replay' }); setTarget(null); setSelectedItem(null) }}><RotateCcw size={15} /> Replay chapter</button></>}
              </div>
            </div> : <div id="realm-journal-panel" role="tabpanel" aria-labelledby="realm-journal-tab" className="realm-panel-content realm-journal"><h3>Field notes</h3>{clues.length ? clues.map((clue, index) => <article key={clue}><span className="realm-eyebrow">NOTE {String(index + 1).padStart(2, '0')}</span><JapaneseClue id={clue} furigana={furigana} /></article>) : <p className="realm-narrative">No messages collected yet.</p>}</div>}
          </aside>
        </div>
        <footer className="realm-footer"><span><Compass size={15} /> The Ink Road · Chapter 01</span><button type="button" className="realm-text-button" onClick={() => setView('journey')}>World journey <ArrowRight size={15} /></button></footer>
      </>}
    </main>
  )
}
