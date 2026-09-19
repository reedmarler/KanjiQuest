export type RealmLocation = 'gate' | 'bridge' | 'pier'
export type RealmPhase = 'briefing' | 'searching' | 'meeting' | 'recovered' | 'restored'
export type RealmItem = 'letter' | 'seal' | 'stamp'
export type RealmEncounter = 'notice' | 'porter' | 'large-boat'
export type RealmTarget = 'keeper' | 'notice' | 'lantern' | 'porter' | 'courier' | 'small-boat' | 'large-boat'

export interface RealmLine {
  parts: ReadonlyArray<readonly [text: string, reading?: string]>
  meaning: string
}

export const REALM_LINES: Record<string, RealmLine> = {
  invitation: { parts: [['赤', 'あか'], ['いかばんの'], ['人', 'ひと'], ['を'], ['探', 'さが'], ['してください。'], ['橋', 'はし'], ['で'], ['待', 'ま'], ['っています。']], meaning: 'Please find the person with the red bag. They are waiting at the bridge.' },
  description: { parts: [['青', 'あお'], ['い'], ['本', 'ほん'], ['を'], ['持', 'も'], ['っています。']], meaning: 'They are carrying a blue book.' },
  porter: { parts: [['私', 'わたし'], ['ではありません。'], ['青', 'あお'], ['い'], ['本', 'ほん'], ['の'], ['人', 'ひと'], ['です。']], meaning: 'It is not me. It is the person with the blue book.' },
  request: { parts: [['手紙', 'てがみ'], ['はありますか。']], meaning: 'Do you have the letter?' },
  meeting: { parts: [['印', 'いん'], ['は'], ['船', 'ふね'], ['にあります。'], ['船', 'ふね'], ['の'], ['前', 'まえ'], ['で'], ['会', 'あ'], ['いましょう。']], meaning: 'The seal is on the boat. Let us meet in front of the boat.' },
  boat: { parts: [['小', 'ちい'], ['さい'], ['船', 'ふね'], ['です。'], ['大', 'おお'], ['きい'], ['船', 'ふね'], ['ではありません。']], meaning: 'It is the small boat. Not the large boat.' },
  wrongBoat: { parts: [['この'], ['船', 'ふね'], ['ではありません。'], ['小', 'ちい'], ['さい'], ['船', 'ふね'], ['はあちらです。']], meaning: 'It is not this boat. The small boat is over there.' },
  return: { parts: [['どうぞ。'], ['村', 'むら'], ['に'], ['持', 'も'], ['って'], ['帰', 'かえ'], ['ってください。']], meaning: 'Here you are. Please take it back to the village.' },
  restored: { parts: [['村', 'むら'], ['が'], ['明', 'あか'], ['るくなりました。ありがとうございます。']], meaning: 'The village has become bright again. Thank you.' },
}

export type RealmClue = 'invitation' | 'description' | 'porter' | 'request' | 'meeting' | 'boat' | 'wrongBoat' | 'return' | 'restored'

export const REALM_LOCATIONS: Record<RealmLocation, { name: string; japanese: string; description: string }> = {
  gate: { name: 'Village gate', japanese: '村の門', description: 'The lantern at the gate has gone dark. Its seal has faded to a pale square.' },
  bridge: { name: 'Stone bridge', japanese: '橋', description: 'Two travelers wait above the canal. Both carry a red bag.' },
  pier: { name: 'Ferry landing', japanese: '船着き場', description: 'A little boat rocks beside the steps. Beyond it, a ferry is getting ready to leave.' },
}

export const REALM_ITEMS: Record<RealmItem, { name: string; mark: string; description: string }> = {
  letter: { name: "Keeper's letter", mark: '文', description: 'The village keeper has signed this letter. The courier will recognize the handwriting.' },
  seal: { name: 'Lantern seal', mark: '灯', description: 'A small carved seal, still warm with ink. It belongs at the village gate.' },
  stamp: { name: 'First Light stamp', mark: '灯', description: 'A record of the first light you returned to Tsuzuri Village.' },
}

export const REALM_REGIONS = [
  { name: 'Tsuzuri Village', japanese: '綴村', level: 'Foundations', description: 'A village of quiet canals and lanterns that have forgotten their names.' },
  { name: 'The Market Road', japanese: '市の道', level: 'N5', description: 'Beyond the gate, merchants wait beneath blank shop signs.' },
  { name: 'Kisen Station', japanese: '汽線駅', level: 'N5 / N4', description: 'A steam line whose destinations have faded from the boards.' },
  { name: 'Hakumon Academy', japanese: '白門学舎', level: 'N4', description: 'An old library with a missing index and stories still waiting inside.' },
  { name: 'Shizukudani Springs', japanese: '雫谷', level: 'N4', description: 'Rain, cedar, and messages carried between the mountain baths.' },
  { name: 'Kagero City', japanese: '陽炎市', level: 'N3', description: 'A city losing its words faster than it can print them.' },
  { name: 'Togehara Highlands', japanese: '峠原', level: 'N3 / N2', description: 'Stone markers hold the mountain road together.' },
  { name: 'Shiomi Port', japanese: '潮見港', level: 'N2', description: 'Every ship brings a promise written in the harbor ledgers.' },
  { name: 'Mikuni Archive', japanese: '三国文庫', level: 'N1', description: 'The library that remembers the names of every other region.' },
] as const
