/*
 * Notes the learner writes against what is on screen in the Kanji Lab.
 *
 * Keyed by the card's own subject — the kanji on a kanji card, the word on a
 * word card — since that is what the thought was about. `character` records
 * the kanji the card was anchored to as well, so notes taken on compounds can
 * still be gathered under the character they belong to when there is a screen
 * to query them from.
 */

const KANJI_NOTES_KEY = 'kanji-quest-kanji-notes-v1'

export interface KanjiNote {
  /** What was on screen: 車 on a kanji card, 電車 on a word card. */
  subject: string
  /** The kanji the card was anchored to. */
  character: string
  /** The subject's reading, when the card carried one. */
  reading?: string
  text: string
  updatedAt: number
}

export type KanjiNotes = Record<string, KanjiNote>

export function loadKanjiNotes(): KanjiNotes {
  try {
    const raw = localStorage.getItem(KANJI_NOTES_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed as KanjiNotes : {}
  } catch {
    return {}
  }
}

export function saveKanjiNotes(notes: KanjiNotes): void {
  try {
    localStorage.setItem(KANJI_NOTES_KEY, JSON.stringify(notes))
  } catch {
    // A full or blocked store loses the write, not the session.
  }
}

/** Writes one note, or clears it when the text is emptied. */
export function setKanjiNote(
  notes: KanjiNotes,
  entry: Omit<KanjiNote, 'text' | 'updatedAt'>,
  text: string,
): KanjiNotes {
  const trimmed = text.trim()
  const next = { ...notes }
  if (!trimmed) {
    delete next[entry.subject]
    return next
  }
  next[entry.subject] = { ...entry, text: trimmed, updatedAt: Date.now() }
  return next
}

/** Every note, most recently written first — the shape a query screen wants. */
export function listKanjiNotes(notes: KanjiNotes): KanjiNote[] {
  return Object.values(notes).sort((a, b) => b.updatedAt - a.updatedAt)
}

/** The notes written against a character, whether on it or on a word using it. */
export function kanjiNotesForCharacter(notes: KanjiNotes, character: string): KanjiNote[] {
  return listKanjiNotes(notes).filter(
    (note) => note.character === character || note.subject.includes(character),
  )
}
