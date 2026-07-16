import { HERO_SLOT_WIDTHS, type HeroSentenceFrame, type HeroStep } from '../data/heroSentences'
import { sentencePatternCatalog } from '../data/sentencePatternCatalog'
import { generateCategorySentence } from './categorySentenceEngine'
import { generatePreviewSentence, type GeneratedPreviewSentence } from './sentenceGeneratorPreview'
import type { JlptLevel } from './types'

const SAMPLE_SEEDS_PER_PATTERN = 6
const MAX_HERO_PATTERNS = 5
const MAX_NEIGHBOR_STEPS = 4

function selectedPatternIds(level: JlptLevel) {
  const ids=sentencePatternCatalog.filter(pattern=>pattern.jlpt===level&&pattern.generatorReady).map(pattern=>pattern.id)
  if (ids.length<=MAX_HERO_PATTERNS) return ids
  return Array.from({length:MAX_HERO_PATTERNS},(_,index)=>ids[Math.floor(index*ids.length/MAX_HERO_PATTERNS)]!)
}

function generatedFrame(sentence: GeneratedPreviewSentence): HeroSentenceFrame {
  const occurrences=new Map<string,number>()
  const segments=sentence.furigana.map((part,index)=>{
    if (!part.slot) return {key:`literal-${index}`,text:part.text,swappable:false}
    const occurrence=occurrences.get(part.slot)??0
    occurrences.set(part.slot,occurrence+1)
    return {
      key:occurrence===0?part.slot:`${part.slot}-${occurrence+1}`,
      text:part.text,
      reading:part.reading&&part.reading!==part.text?part.reading:undefined,
      swappable:true,
    }
  })
  return {
    segments,
    generatedEnglish:sentence.english,
    generatedPatternId:sentence.frameId,
    generatedReading:sentence.reading,
    prefix:'',subject:'',topicParticle:'',modifier:'',word:'',objectParticle:'',bridge:'',predicate:'',
  }
}

function structureKey(frame: HeroSentenceFrame) {
  return (frame.segments??[]).map(segment=>`${segment.key}:${segment.swappable?'slot':segment.text}`).join('|')
}

function changedSegments(previous: HeroSentenceFrame,current: HeroSentenceFrame) {
  if (structureKey(previous)!==structureKey(current)) return []
  const previousByKey=new Map((previous.segments??[]).map(segment=>[segment.key,segment.text]))
  return (current.segments??[]).filter(segment=>segment.swappable&&previousByKey.get(segment.key)!==segment.text).map(segment=>segment.key)
}

function isSingleSlotNeighbor(previous: HeroSentenceFrame,current: HeroSentenceFrame) {
  return changedSegments(previous,current).length===1&&previous.generatedEnglish!==current.generatedEnglish
}

function replacementLengthDelta(previous: HeroSentenceFrame,current: HeroSentenceFrame) {
  const changed=changedSegments(previous,current)
  if (changed.length!==1) return Number.POSITIVE_INFINITY
  const key=changed[0]!
  const previousText=(previous.segments??[]).find(segment=>segment.key===key)?.text??''
  const currentText=(current.segments??[]).find(segment=>segment.key===key)?.text??''
  return Math.abs([...previousText].length-[...currentText].length)
}

function heroStep(frame: HeroSentenceFrame,changed: string[],templateRefresh: boolean): HeroStep {
  return {frame,changed,templateRefresh,slotWidths:HERO_SLOT_WIDTHS}
}

function bestNeighborChain(frames: HeroSentenceFrame[]) {
  let best: HeroSentenceFrame[]=[]
  for (const start of frames) {
    const chain=[start]
    const used=new Set([start])
    const usedSentences=new Set([(start.segments??[]).map(segment=>segment.text).join('')])
    while (chain.length<MAX_NEIGHBOR_STEPS) {
      const current=chain.at(-1)!
      const next=frames
        .filter(candidate=>!used.has(candidate)&&!usedSentences.has((candidate.segments??[]).map(segment=>segment.text).join(''))&&isSingleSlotNeighbor(current,candidate))
        .sort((a,b)=>replacementLengthDelta(current,a)-replacementLengthDelta(current,b))[0]
      if (!next) break
      chain.push(next)
      used.add(next)
      usedSentences.add((next.segments??[]).map(segment=>segment.text).join(''))
    }
    if (chain.length>best.length) best=chain
  }
  return best
}

function generatedSamples(level: JlptLevel,patternId: string,seedOffset: number) {
  return Array.from({length:SAMPLE_SEEDS_PER_PATTERN},(_,index)=>
    generatedFrame(generatePreviewSentence(level,seedOffset+index+1,undefined,patternId,true)),
  ).filter(frame=>(frame.segments??[]).some(segment=>segment.swappable))
}

function n4EndingChain() {
  const ids=['n4-01','n4-02','n4-03','n4-04']
  for (let seed=1;seed<=16;seed++) {
    const sentences=ids.map(id=>generateCategorySentence(seed,id,'N4'))
    if (sentences.some(sentence=>!sentence)) continue
    const frames=sentences.map(sentence=>generatedFrame(sentence!))
    if (frames.slice(1).every((frame,index)=>isSingleSlotNeighbor(frames[index]!,frame))) return frames
  }
  return []
}

const CATEGORY_SLOT_KEYS=new Set(['subject','object','destination','location','companion','time','adverb'])

function categorySlotChain(level: 'N5'|'N4',patternId: string,seed: number) {
  const base=generateCategorySentence(seed,patternId,level)
  if (!base) return []
  const frames=[generatedFrame(base)]
  const patternNumber=Number(patternId.split('-')[1])
  if (level==='N4'&&(patternId==='n4-09'||patternNumber>10)) return frames
  const slotSeeds: Record<string,number>={}
  const slots=Object.keys(base.slots).filter(slot=>CATEGORY_SLOT_KEYS.has(slot)).slice(0,3)
  let current=frames[0]!
  slots.forEach((slot,slotIndex)=>{
    const candidates: Array<{seed:number;frame:HeroSentenceFrame}>=[]
    for (let attempt=1;attempt<=8;attempt++) {
      const candidateSeed=seed+17+slotIndex*11+attempt
      const candidate=generateCategorySentence(seed,patternId,level,{slotSeeds:{...slotSeeds,[slot]:candidateSeed}})
      if (!candidate) continue
      const candidateFrame=generatedFrame(candidate)
      if (!isSingleSlotNeighbor(current,candidateFrame)) continue
      candidates.push({seed:candidateSeed,frame:candidateFrame})
    }
    const best=candidates.sort((a,b)=>replacementLengthDelta(current,a.frame)-replacementLengthDelta(current,b.frame))[0]
    if (!best) return
    slotSeeds[slot]=best.seed
    frames.push(best.frame)
    current=best.frame
  })
  return frames
}

/**
 * Build homepage motion from the same approved, category-aware generator used
 * by Content Studio. Neighbor steps are admitted only when exactly one visible
 * slot changes; everything else becomes an intentional full-sentence refresh.
 */
export function buildGeneratedHeroSteps(level: JlptLevel): HeroStep[] {
  const patternIds=level==='N5'
    ? ['n5-01','n5-02','n5-03','n5-04','n5-05','n5-09','n5-10']
    : level==='N4'
      ? ['n4-06','n4-09','n4-10','n4-11','n4-13','n4-14','n4-15']
      : selectedPatternIds(level)
  if (!patternIds.length) return []
  const steps: HeroStep[]=[]

  if (level==='N4') {
    const endingFrames=n4EndingChain()
    endingFrames.forEach((frame,index)=>steps.push(heroStep(frame,index===0?(frame.segments??[]).filter(segment=>segment.swappable).map(segment=>segment.key):changedSegments(endingFrames[index-1]!,frame),index===0)))
  }

  patternIds.forEach((patternId,patternIndex)=>{
    const chain=level==='N5'||level==='N4'
      ? categorySlotChain(level,patternId,1000+patternIndex*97)
      : bestNeighborChain(generatedSamples(level,patternId,1000+patternIndex*97))
    if (!chain.length) return
    chain.forEach((frame,index)=>steps.push(heroStep(
      frame,
      index===0?(frame.segments??[]).filter(segment=>segment.swappable).map(segment=>segment.key):changedSegments(chain[index-1]!,frame),
      index===0,
    )))
  })

  return steps
}
