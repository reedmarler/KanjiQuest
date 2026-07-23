import type { JlptLevel } from '../lib/types'

export interface VerbFirstTemplateRecord {
  id: string
  frameId: string
  level: Extract<JlptLevel, 'N5' | 'N4'>
  ending: string
  governedVerb: 'main' | 'first'
  verbIds: string[]
}

const directActionVerbs = ['taberu-basic', 'nomu-basic', 'yomu-basic', 'miru-basic']
const n4CoreVerbs = [
  'taberu-basic', 'nomu-basic', 'yomu-basic', 'miru-basic',
  'iku-ni', 'taberu-location', 'hanasu-companion', 'okiru-time', 'iku-e',
]

// A template controls word order and grammar. The selected verb controls which
// slots can be filled and which ending is valid for that sentence.
export const VERB_FIRST_TEMPLATE_CATALOG: VerbFirstTemplateRecord[] = [
  { id: 'direct-action', frameId: 'n5-01', level: 'N5', ending: 'ます', governedVerb: 'main', verbIds: directActionVerbs },
  { id: 'destination-ni', frameId: 'n5-02', level: 'N5', ending: 'ます', governedVerb: 'main', verbIds: ['iku-ni'] },
  { id: 'action-location', frameId: 'n5-03', level: 'N5', ending: 'ます', governedVerb: 'main', verbIds: ['taberu-location'] },
  { id: 'companion', frameId: 'n5-04', level: 'N5', ending: 'ます', governedVerb: 'main', verbIds: ['hanasu-companion'] },
  { id: 'specific-time', frameId: 'n5-05', level: 'N5', ending: 'ます', governedVerb: 'main', verbIds: ['okiru-time'] },
  { id: 'adverb-action', frameId: 'n5-09', level: 'N5', ending: 'ます', governedVerb: 'main', verbIds: ['yomu-adverb'] },
  { id: 'destination-e', frameId: 'n5-10', level: 'N5', ending: 'ます', governedVerb: 'main', verbIds: ['iku-e'] },
  { id: 'only-negative', frameId: 'n5-24', level: 'N5', ending: 'しか〜ない', governedVerb: 'main', verbIds: directActionVerbs },
  { id: 'ongoing', frameId: 'n4-02', level: 'N4', ending: 'ている', governedVerb: 'main', verbIds: n4CoreVerbs },
  { id: 'permission', frameId: 'n4-06', level: 'N4', ending: 'てもいい', governedVerb: 'main', verbIds: n4CoreVerbs },
  { id: 'prohibition', frameId: 'n4-07', level: 'N4', ending: 'てはいけない', governedVerb: 'main', verbIds: n4CoreVerbs },
  { id: 'sequence', frameId: 'n4-13', level: 'N4', ending: 'てから', governedVerb: 'first', verbIds: directActionVerbs },
  { id: 'before', frameId: 'n4-21', level: 'N4', ending: '前に', governedVerb: 'first', verbIds: directActionVerbs },
  { id: 'after', frameId: 'n4-22', level: 'N4', ending: 'た後で', governedVerb: 'first', verbIds: directActionVerbs },
  { id: 'examples', frameId: 'n4-23', level: 'N4', ending: 'たり〜たりする', governedVerb: 'first', verbIds: directActionVerbs },
  { id: 'ability', frameId: 'n4-24', level: 'N4', ending: 'ことができる', governedVerb: 'main', verbIds: directActionVerbs },
  { id: 'not-required', frameId: 'n4-25', level: 'N4', ending: 'なくてもいい', governedVerb: 'main', verbIds: directActionVerbs },
]
