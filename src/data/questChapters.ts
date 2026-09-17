export interface QuestPiece {
  kanji: string
  reading: string
  meaning: string
}

export type QuestCheckKind = 'reading' | 'audio-object' | 'cloze'

export interface QuestGateCheck {
  id: string
  kind: QuestCheckKind
  prompt: string
  displayText?: string
  options: readonly string[]
  answer: string
}

export interface QuestGate {
  id: string
  placeLabel: string
  objectLabel: string
  objectText: string
  readingUsedHere: string
  gloss: string
  sceneSentence: string
  sceneSentenceReading: string
  sceneSentenceEn: string
  audioKey: string
  pictureKey: string
  pictureStillKey: string
  pictureAlt: string
  pieces: readonly QuestPiece[]
  checks: readonly QuestGateCheck[]
  nextGateId: string | null
  firstClearReward: number
  echoFrom?: string
}

export interface QuestChapter {
  id: string
  title: string
  titleJp: string
  atmosphere: string
  gates: readonly QuestGate[]
}

// TODO: Replace these shared lane stills with gate-specific clinic art when it lands.
const LANE_STILL = '/quest-mobile-landing.jpg'
const PICTURE_STILL = '/quest-mobile-challenge.jpg'

export const CLINIC_LANE_CHAPTER: QuestChapter = {
  id: 'clinic-lane',
  title: 'Clinic Lane',
  titleJp: '診療所への道',
  atmosphere: 'Night rain · lantern road',
  gates: [
    {
      id: 'lantern-oni',
      placeLabel: 'Rain lantern',
      objectLabel: 'lantern',
      objectText: '鬼',
      readingUsedHere: 'おに',
      gloss: 'demon',
      sceneSentence: '鬼の提灯があります。',
      sceneSentenceReading: 'おにのちょうちんがあります。',
      sceneSentenceEn: 'There is a demon lantern.',
      audioKey: '鬼の提灯があります。',
      pictureKey: LANE_STILL,
      pictureStillKey: PICTURE_STILL,
      pictureAlt: 'A lantern glowing beside a rainy Japanese road at night',
      pieces: [
        { kanji: '鬼', reading: 'おに', meaning: 'demon' },
      ],
      checks: [
        { id: 'oni-reading', kind: 'reading', prompt: 'Pick the reading used on this lantern.', options: ['おに', 'かみ', 'ひと'], answer: 'おに' },
        { id: 'oni-audio', kind: 'audio-object', prompt: 'Listen, then pick the object you heard.', options: ['鬼', '医者', '患者'], answer: '鬼' },
        { id: 'oni-cloze', kind: 'cloze', prompt: 'Complete the line from this place.', displayText: '＿＿の提灯があります。', options: ['鬼', '医者', '患者'], answer: '鬼' },
      ],
      nextGateId: 'noren-doctor',
      firstClearReward: 10,
    },
    {
      id: 'noren-doctor',
      placeLabel: 'Clinic noren',
      objectLabel: 'noren',
      objectText: '医者',
      readingUsedHere: 'いしゃ',
      gloss: 'doctor',
      sceneSentence: 'すみません、医者はいますか。',
      sceneSentenceReading: 'すみません、いしゃはいますか。',
      sceneSentenceEn: 'Excuse me, is the doctor here?',
      audioKey: 'すみません、医者はいますか。',
      pictureKey: LANE_STILL,
      pictureStillKey: PICTURE_STILL,
      pictureAlt: 'A clinic entrance behind a noren on a rainy lane',
      pieces: [
        { kanji: '医', reading: 'い', meaning: 'medicine' },
        { kanji: '者', reading: 'しゃ', meaning: 'person' },
      ],
      checks: [
        { id: 'doctor-reading', kind: 'reading', prompt: 'Pick the reading used on this noren.', options: ['いしゃ', 'かんじゃ', 'きゅうしん'], answer: 'いしゃ' },
        { id: 'doctor-audio', kind: 'audio-object', prompt: 'Listen, then pick the object you heard.', options: ['患者', '医者', '留守'], answer: '医者' },
        { id: 'doctor-cloze', kind: 'cloze', prompt: 'Complete the line from this place.', displayText: 'すみません、＿＿はいますか。', options: ['医者', '患者', '鬼'], answer: '医者' },
      ],
      nextGateId: 'closed-board',
      firstClearReward: 10,
    },
    {
      id: 'closed-board',
      placeLabel: 'Clinic board',
      objectLabel: 'board',
      objectText: '本日休診',
      readingUsedHere: 'ほんじつきゅうしん',
      gloss: 'closed today',
      sceneSentence: '本日は休診です。',
      sceneSentenceReading: 'ほんじつはきゅうしんです。',
      sceneSentenceEn: 'The clinic is closed today.',
      audioKey: '本日は休診です。',
      pictureKey: LANE_STILL,
      pictureStillKey: PICTURE_STILL,
      pictureAlt: 'A closed clinic board under a purple lantern',
      pieces: [
        { kanji: '本日', reading: 'ほんじつ', meaning: 'today' },
        { kanji: '休', reading: 'きゅう', meaning: 'rest' },
        { kanji: '診', reading: 'しん', meaning: 'medical visit' },
      ],
      checks: [
        { id: 'closed-reading', kind: 'reading', prompt: 'Pick the reading used on this board.', options: ['ほんじつきゅうしん', 'ほんじつびょういん', 'きょういしゃ'], answer: 'ほんじつきゅうしん' },
        { id: 'closed-audio', kind: 'audio-object', prompt: 'Listen, then pick the object you heard.', options: ['本日休診', '留守', '医者'], answer: '本日休診' },
        { id: 'closed-cloze', kind: 'cloze', prompt: 'Complete the line from this place.', displayText: '本日は＿＿です。', options: ['休診', '医者', '患者'], answer: '休診' },
      ],
      nextGateId: 'away-note',
      firstClearReward: 12,
    },
    {
      id: 'away-note',
      placeLabel: 'Side-door note',
      objectLabel: 'note',
      objectText: '留守',
      readingUsedHere: 'るす',
      gloss: 'not here / away',
      sceneSentence: '今、医者は留守です。',
      sceneSentenceReading: 'いま、いしゃはるすです。',
      sceneSentenceEn: 'The doctor is away right now.',
      audioKey: '今、医者は留守です。',
      pictureKey: LANE_STILL,
      pictureStillKey: PICTURE_STILL,
      pictureAlt: 'A handwritten note beside a clinic side door',
      pieces: [
        { kanji: '留', reading: 'る', meaning: 'stay away' },
        { kanji: '守', reading: 'す', meaning: 'keeping watch' },
      ],
      checks: [
        { id: 'away-reading', kind: 'reading', prompt: 'Pick the reading used on this note.', options: ['るす', 'やすみ', 'まもる'], answer: 'るす' },
        { id: 'away-audio', kind: 'audio-object', prompt: 'Listen, then pick the object you heard.', options: ['休診', '患者', '留守'], answer: '留守' },
        { id: 'away-cloze', kind: 'cloze', prompt: 'Complete the line from this place.', displayText: '今、医者は＿＿です。', options: ['留守', '患者', '鬼'], answer: '留守' },
      ],
      nextGateId: 'patient-window',
      firstClearReward: 12,
    },
    {
      id: 'patient-window',
      placeLabel: 'Night window',
      objectLabel: 'patient notice',
      objectText: '患者',
      readingUsedHere: 'かんじゃ',
      gloss: 'patient',
      sceneSentence: '患者はここで待ちます。',
      sceneSentenceReading: 'かんじゃはここでまちます。',
      sceneSentenceEn: 'Patients wait here.',
      audioKey: '患者はここで待ちます。',
      pictureKey: LANE_STILL,
      pictureStillKey: PICTURE_STILL,
      pictureAlt: 'A patient notice in a lit clinic window at night',
      pieces: [
        { kanji: '患', reading: 'かん', meaning: 'illness' },
        { kanji: '者', reading: 'じゃ', meaning: 'person' },
      ],
      checks: [
        { id: 'patient-reading', kind: 'reading', prompt: 'Pick the reading used on this notice.', options: ['かんじゃ', 'いしゃ', 'るす'], answer: 'かんじゃ' },
        { id: 'patient-audio', kind: 'audio-object', prompt: 'Listen, then pick the object you heard.', options: ['医者', '患者', '本日休診'], answer: '患者' },
        { id: 'patient-cloze', kind: 'cloze', prompt: 'Complete the line from this place.', displayText: '＿＿はここで待ちます。', options: ['患者', '医者', '鬼'], answer: '患者' },
      ],
      nextGateId: null,
      firstClearReward: 16,
      echoFrom: '医者 → 患者',
    },
  ],
}

export const QUEST_CHAPTERS: readonly QuestChapter[] = [CLINIC_LANE_CHAPTER]
