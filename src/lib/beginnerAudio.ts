type HiraganaRecording = string | string[]

const HIRAGANA_RECORDINGS: Record<string, HiraganaRecording> = {
  'あ': 'a.mp3',
  'い': 'i.mp3',
  'う': 'u-v3.mp3',
  'え': 'e.mp3',
  'お': 'o.mp3',
  'か': 'ka.mp3',
  'き': 'ki.mp3',
  'く': 'ku.mp3',
  'け': 'ke.mp3',
  'こ': 'ko.mp3',
  'さ': 'sa.mp3',
  'し': 'shi.mp3',
  'す': 'su.mp3',
  'せ': 'se.mp3',
  'そ': 'so.mp3',
  'た': 'ta.mp3',
  'ち': 'chi.mp3',
  'つ': 'tsu.mp3',
  'て': 'te.mp3',
  'と': 'to.mp3',
  'な': 'na.mp3',
  'に': 'ni.mp3',
  'ぬ': 'nu.mp3',
  'ね': 'ne.mp3',
  'の': 'no.mp3',
  'は': 'ha.mp3',
  'ひ': 'hi.mp3',
  'ふ': 'fu.mp3',
  'へ': 'he.mp3',
  'ほ': 'ho.mp3',
  'ま': 'ma.mp3',
  'み': 'mi.mp3',
  'む': 'mu.mp3',
  'め': 'me.mp3',
  'も': 'mo.mp3',
  'や': 'ya.mp3',
  'ゆ': 'yu.mp3',
  'よ': 'yo.mp3',
  'ら': 'ra.mp3',
  'り': 'ri.mp3',
  'る': 'ru.mp3',
  'れ': 're.mp3',
  'ろ': 'ro.mp3',
  'わ': 'wa.mp3',
  'を': 'wo.mp3',
  'ん': 'n.mp3',
  'が': 'ga.mp3',
  'ぎ': 'gi.mp3',
  'ぐ': 'gu.mp3',
  'げ': 'ge.mp3',
  'ご': 'go.mp3',
  'ざ': 'za.mp3',
  'じ': ['ji-01.mp3', 'ji-02.mp3', 'ji-03.mp3'],
  'ず': 'zu.mp3',
  'ぜ': 'ze.mp3',
  'ぞ': 'zo.mp3',
  'だ': 'da.mp3',
  'ぢ': 'di.mp3',
  'づ': 'du.mp3',
  'で': 'de.mp3',
  'ど': 'do.mp3',
  'ば': 'ba.mp3',
  'び': 'bi.mp3',
  'ぶ': 'bu.mp3',
  'べ': 'be.mp3',
  'ぼ': 'bo.mp3',
  'ぱ': 'pa.mp3',
  'ぴ': 'pi.mp3',
  'ぷ': 'pu.mp3',
  'ぺ': 'pe.mp3',
  'ぽ': 'po.mp3',
  'ぎゃ': ['gya.mp3', 'gya-02.mp3', 'gya-03.mp3', 'gya-04.mp3', 'gya-05.mp3', 'gya-06.mp3', 'gya-07.mp3', 'gya-08.mp3'],
  'ぎゅ': ['gyu.mp3', 'gyu-02.mp3', 'gyu-03.mp3', 'gyu-04.mp3', 'gyu-05.mp3', 'gyu-06.mp3', 'gyu-07.mp3', 'gyu-08.mp3'],
  'ぎょ': ['gyo.mp3', 'gyo-02.mp3', 'gyo-03.mp3', 'gyo-04.mp3', 'gyo-05.mp3', 'gyo-06.mp3', 'gyo-07.mp3', 'gyo-08.mp3'],
  'じゃ': ['ja.mp3', 'ja-02.mp3', 'ja-03.mp3'],
  'じゅ': ['ju.mp3', 'ju-02.mp3', 'ju-03.mp3'],
  'じょ': ['jo.mp3', 'jo-02.mp3', 'jo-03.mp3'],
  'じぇ': ['je-01.mp3', 'je-02.mp3', 'je-03.mp3'],
}

const HIRAGANA_WORD_RECORDINGS: Record<string, string> = {
  'あい': 'ai.mp3',
  'いえ': 'ie.mp3',
  'うえ': 'ue.mp3',
  'あお': 'ao.mp3',
  'あう': 'au.mp3',
  'おい': 'oi.mp3',
  'かお': 'kao.mp3',
  'いか': 'ika.mp3',
  'あか': 'aka.mp3',
  'かき': 'kaki.mp3',
  'きく': 'kiku.mp3',
  'こえ': 'koe.mp3',
  'けいこ': 'keiko.mp3',
  'さけ': 'sake.mp3',
  'あさ': 'asa.mp3',
  'くさ': 'kusa.mp3',
  'すし': 'sushi.mp3',
  'せかい': 'sekai.mp3',
  'うそ': 'uso.mp3',
  'たこ': 'tako.mp3',
  'いち': 'ichi.mp3',
  'くつ': 'kutsu.mp3',
  'て': 'te.mp3',
  'とけい': 'tokei.mp3',
  'そと': 'soto.mp3',
  'さかな': 'sakana.mp3',
  'なつ': 'natsu.mp3',
  'いぬ': 'inu.mp3',
  'ねこ': 'neko.mp3',
  'きのう': 'kinou.mp3',
  'はな': 'hana.mp3',
  'はと': 'hato.mp3',
  'ひと': 'hito.mp3',
  'ふね': 'fune.mp3',
  'へた': 'heta.mp3',
  'ほし': 'hoshi.mp3',
  'まつ': 'matsu.mp3',
  'みみ': 'mimi.mp3',
  'むし': 'mushi.mp3',
  'め': 'me.mp3',
  'くも': 'kumo.mp3',
  'もも': 'momo.mp3',
  'へや': 'heya.mp3',
  'やま': 'yama.mp3',
  'ゆき': 'yuki.mp3',
  'ふゆ': 'fuyu.mp3',
  'よむ': 'yomu.mp3',
  'そら': 'sora.mp3',
  'よる': 'yoru.mp3',
  'さくら': 'sakura.mp3',
  'とり': 'tori.mp3',
  'くるま': 'kuruma.mp3',
  'これ': 'kore.mp3',
  'こころ': 'kokoro.mp3',
  'わたし': 'watashi.mp3',
  'かわ': 'kawa.mp3',
  'ほん': 'hon.mp3',
  'かぎ': 'kagi.mp3',
  'えいが': 'eiga.mp3',
  'りんご': 'ringo.mp3',
  'げた': 'geta.mp3',
  'ごま': 'goma.mp3',
  'ぐみ': 'gumi.mp3',
  'かぜ': 'kaze.mp3',
  'ひざ': 'hiza.mp3',
  'じかん': 'jikan.mp3',
  'みず': 'mizu.mp3',
  'ぞう': 'zou.mp3',
  'ざる': 'zaru.mp3',
  'だれ': 'dare.mp3',
  'うで': 'ude.mp3',
  'まど': 'mado.mp3',
  'つづく': 'tsuzuku.mp3',
  'はなぢ': 'hanaji.mp3',
  'ちぢむ': 'chijimu.mp3',
  'ばら': 'bara.mp3',
  'くび': 'kubi.mp3',
  'ぶた': 'buta.mp3',
  'かべ': 'kabe.mp3',
  'ぼうし': 'boushi.mp3',
  'ぱぱ': 'papa.mp3',
  'ぴかぴか': 'pikapika.mp3',
  'ぷにぷに': 'punipuni.mp3',
  'ぺこぺこ': 'pekopeko.mp3',
  'ぽかぽか': 'pokapoka.mp3',
}

/*
 * A row is read as its characters in order, played straight through from the
 * per-kana takes above. There used to be one pre-concatenated file per row,
 * but those were cut before う was re-recorded, so あ、い、う、え、お still
 * carried the old take of it. Each of those files was its own kana clips
 * joined end to end with nothing between them — every row's duration matched
 * the sum of its parts exactly — so playing the parts reproduces the row it
 * replaced, and a kana re-recorded later reaches every row it belongs to.
 */

export type BeginnerAudioKind = 'kana' | 'word' | 'row'

function pickRecording(recording: HiraganaRecording | undefined): string | undefined {
  if (!recording) return undefined
  if (Array.isArray(recording)) return recording[Math.floor(Math.random() * recording.length)]
  return recording
}

function isRecordingFile(file: string | undefined): file is string {
  return Boolean(file)
}

/** Returns an approved Beginner Mode recording when one exists. */
export function findBeginnerAudio(text: string, kind: BeginnerAudioKind): string | undefined {
  const normalized = text.trim()
  if (kind === 'kana') {
    const file = pickRecording(HIRAGANA_RECORDINGS[normalized])
    return file ? `${import.meta.env.BASE_URL}audio/beginner/hiragana/${file}` : undefined
  }
  if (kind === 'word') {
    const file = HIRAGANA_WORD_RECORDINGS[normalized]
    return file ? `${import.meta.env.BASE_URL}audio/beginner/hiragana/words/${file}` : undefined
  }
  return undefined
}

/**
 * The recordings a row is read from, in order — one per character, played
 * back to back. Undefined unless every character in the row has a recording,
 * so a partial row falls through to the speech voice rather than reading
 * itself out with a gap in the middle.
 */
export function findBeginnerRowAudio(text: string): string[] | undefined {
  const characters = text.trim().split('\u3001').map((part) => part.trim()).filter(Boolean)
  if (characters.length === 0) return undefined
  const files = characters.map((character) => pickRecording(HIRAGANA_RECORDINGS[character]))
  if (!files.every(isRecordingFile)) return undefined
  return files.map((file) => `${import.meta.env.BASE_URL}audio/beginner/hiragana/${file}`)
}
