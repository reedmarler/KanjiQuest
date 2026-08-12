import type { StudyCard } from '../lib/types'

/**
 * Words for the sentence categories the generator had almost nothing to draw
 * from. Thirty-one verbs take a Tool, and the Tool pool held one word (鍵), so
 * 使う/切る/直す and their neighbours could only ever produce the same sentence.
 * Room and Technology were wanted by 21 verbs apiece off pools of one.
 *
 * Two different gaps are closed here, and both need a card in a reviewed deck:
 *
 *   MISSING — the deck simply had no word (アニメ, はさみ, ソファ).
 *
 *   STRANDED — the word exists, classifies correctly with high confidence, and
 *   is still invisible to the generator because its only copy sits in a
 *   study-only deck that `isStudyOnlyDeck` refuses by id prefix. 台風, 椅子,
 *   紅茶, 葉 and 番組 were all in this state. Re-authoring the card here is the
 *   per-word review that admitting a study-only deck wholesale would skip —
 *   the blanket "high confidence is enough" rule was tried before and reverted
 *   after it made 交番 ("police box") a person. Deduplication in data/index.ts
 *   then keeps this copy over the study-only one, and the focus sets that own
 *   the original keep their entry, since they read their own deck directly.
 *
 * Glosses are load-bearing. `classifyVocabularyCard` reads the English to pick
 * a category for any word the imported workbook does not cover, so "saw (tool)"
 * and "cloudy weather" are phrased to be classified, not just translated.
 */
export const vocabCategoryFillCards: StudyCard[] = [
  // Tool — was 1 word against 31 verbs
  // はさみ is deliberately absent. It is an ordinary word, but every subject in
  // this generator is followed by は, and 社員は + はさみ produces ははさみ —
  // which the regression audit flags as a doubled particle, correctly: it is
  // genuinely hard to read. Nothing else in the deck starts with a bare は.
  { id: 'vocab-cat-houchou', type: 'vocab', front: '包丁', reading: 'houchou', back: 'carving knife', jlpt: 'N3' },
  { id: 'vocab-cat-kanazuchi', type: 'vocab', front: '金槌', reading: 'kanazuchi', back: 'hammer', jlpt: 'N2' },
  { id: 'vocab-cat-nokogiri', type: 'vocab', front: 'のこぎり', reading: 'nokogiri', back: 'saw (tool)', jlpt: 'N2' },
  { id: 'vocab-cat-doraibaa', type: 'vocab', front: 'ドライバー', reading: 'doraibaa', back: 'screwdriver (tool)', jlpt: 'N2' },
  { id: 'vocab-cat-dougu', type: 'vocab', front: '道具', reading: 'dougu', back: 'tool; implement', jlpt: 'N3' },
  { id: 'vocab-cat-kougu', type: 'vocab', front: '工具', reading: 'kougu', back: 'tool (hardware)', jlpt: 'N2' },
  { id: 'vocab-cat-gakki', type: 'vocab', front: '楽器', reading: 'gakki', back: 'musical instrument', jlpt: 'N3' },
  { id: 'vocab-cat-fude', type: 'vocab', front: '筆', reading: 'fude', back: 'writing brush', jlpt: 'N3' },
  { id: 'vocab-cat-jougi', type: 'vocab', front: '定規', reading: 'jougi', back: 'ruler (drawing tool)', jlpt: 'N2' },
  { id: 'vocab-cat-hari', type: 'vocab', front: '針', reading: 'hari', back: 'needle (sewing tool)', jlpt: 'N3' },
  { id: 'vocab-cat-dentaku', type: 'vocab', front: '電卓', reading: 'dentaku', back: 'calculator (tool)', jlpt: 'N3' },

  // Room — was 7 (5 unique) against 21 verbs
  { id: 'vocab-cat-shinshitsu', type: 'vocab', front: '寝室', reading: 'shinshitsu', back: 'bedroom', jlpt: 'N3' },
  { id: 'vocab-cat-ima', type: 'vocab', front: '居間', reading: 'ima', back: 'living room', jlpt: 'N3' },
  { id: 'vocab-cat-genkan', type: 'vocab', front: '玄関', reading: 'genkan', back: 'entrance hall', jlpt: 'N4' },
  { id: 'vocab-cat-yokushitsu', type: 'vocab', front: '浴室', reading: 'yokushitsu', back: 'bathroom', jlpt: 'N3' },
  { id: 'vocab-cat-rouka', type: 'vocab', front: '廊下', reading: 'rouka', back: 'hall; corridor', jlpt: 'N3' },
  { id: 'vocab-cat-kyakuma', type: 'vocab', front: '客間', reading: 'kyakuma', back: 'parlour room', jlpt: 'N2' },
  { id: 'vocab-cat-washitsu', type: 'vocab', front: '和室', reading: 'washitsu', back: 'Japanese-style room', jlpt: 'N3' },
  { id: 'vocab-cat-youshitsu', type: 'vocab', front: '洋室', reading: 'youshitsu', back: 'Western-style room', jlpt: 'N3' },
  { id: 'vocab-cat-kouishitsu', type: 'vocab', front: '更衣室', reading: 'kouishitsu', back: 'changing room', jlpt: 'N2' },
  { id: 'vocab-cat-machiaishitsu', type: 'vocab', front: '待合室', reading: 'machiaishitsu', back: 'waiting room', jlpt: 'N2' },

  // Media — was 1 (アニメ) against 7 verbs
  { id: 'vocab-cat-anime', type: 'vocab', front: 'アニメ', reading: 'anime', back: 'anime', jlpt: 'N4' },
  { id: 'vocab-cat-bangumi', type: 'vocab', front: '番組', reading: 'bangumi', back: 'broadcast program', jlpt: 'N3' },
  { id: 'vocab-cat-dorama', type: 'vocab', front: 'ドラマ', reading: 'dorama', back: 'drama show', jlpt: 'N3' },
  { id: 'vocab-cat-eizou', type: 'vocab', front: '映像', reading: 'eizou', back: 'video footage', jlpt: 'N2' },
  { id: 'vocab-cat-youga', type: 'vocab', front: '洋画', reading: 'youga', back: 'Western film', jlpt: 'N2' },
  { id: 'vocab-cat-namahousou', type: 'vocab', front: '生放送', reading: 'namahousou', back: 'live broadcast (program)', jlpt: 'N2' },
  { id: 'vocab-cat-yokokuhen', type: 'vocab', front: '予告編', reading: 'yokokuhen', back: 'movie trailer', jlpt: 'N1' },
  { id: 'vocab-cat-shashinshuu', type: 'vocab', front: '写真集', reading: 'shashinshuu', back: 'photo collection', jlpt: 'N2' },
  { id: 'vocab-cat-kirokueiga', type: 'vocab', front: '記録映画', reading: 'kirokueiga', back: 'documentary film', jlpt: 'N1' },
  { id: 'vocab-cat-shudaika', type: 'vocab', front: '主題歌', reading: 'shudaika', back: 'theme song', jlpt: 'N2' },
  { id: 'vocab-cat-tokushuu', type: 'vocab', front: '特集', reading: 'tokushuu', back: 'feature program', jlpt: 'N2' },

  // Technology — 21 verbs wanted it off a pool of 11
  { id: 'vocab-cat-sumaho', type: 'vocab', front: 'スマホ', reading: 'sumaho', back: 'smartphone', jlpt: 'N4' },
  { id: 'vocab-cat-nootopasokon', type: 'vocab', front: 'ノートパソコン', reading: 'nooto pasokon', back: 'laptop computer', jlpt: 'N3' },
  { id: 'vocab-cat-juudenki', type: 'vocab', front: '充電器', reading: 'juudenki', back: 'phone charger', jlpt: 'N2' },
  { id: 'vocab-cat-iyahon', type: 'vocab', front: 'イヤホン', reading: 'iyahon', back: 'earphones (electronic)', jlpt: 'N3' },
  { id: 'vocab-cat-sofuto', type: 'vocab', front: 'ソフト', reading: 'sofuto', back: 'software', jlpt: 'N3' },
  { id: 'vocab-cat-kaden', type: 'vocab', front: '家電', reading: 'kaden', back: 'electronic appliance', jlpt: 'N2' },

  // Drink — was 1 against 7 verbs
  { id: 'vocab-cat-nihonshu', type: 'vocab', front: '日本酒', reading: 'nihonshu', back: 'sake', jlpt: 'N3' },
  { id: 'vocab-cat-koucha', type: 'vocab', front: '紅茶', reading: 'koucha', back: 'black tea', jlpt: 'N4' },
  { id: 'vocab-cat-ryokucha', type: 'vocab', front: '緑茶', reading: 'ryokucha', back: 'green tea', jlpt: 'N4' },
  { id: 'vocab-cat-mugicha', type: 'vocab', front: '麦茶', reading: 'mugicha', back: 'barley tea', jlpt: 'N3' },
  { id: 'vocab-cat-miruku', type: 'vocab', front: 'ミルク', reading: 'miruku', back: 'milk', jlpt: 'N5' },
  { id: 'vocab-cat-oyu', type: 'vocab', front: 'お湯', reading: 'oyu', back: 'hot water', jlpt: 'N4' },
  { id: 'vocab-cat-tansansui', type: 'vocab', front: '炭酸水', reading: 'tansansui', back: 'sparkling water', jlpt: 'N2' },
  { id: 'vocab-cat-wain', type: 'vocab', front: 'ワイン', reading: 'wain', back: 'wine', jlpt: 'N4' },
  { id: 'vocab-cat-kokoa', type: 'vocab', front: 'ココア', reading: 'kokoa', back: 'cocoa (drink)', jlpt: 'N3' },
  { id: 'vocab-cat-shouchuu', type: 'vocab', front: '焼酎', reading: 'shouchuu', back: 'shochu (alcohol)', jlpt: 'N1' },

  // Furniture — was 4 against 7 verbs
  { id: 'vocab-cat-sofa', type: 'vocab', front: 'ソファ', reading: 'sofa', back: 'sofa', jlpt: 'N3' },
  { id: 'vocab-cat-hondana', type: 'vocab', front: '本棚', reading: 'hondana', back: 'book shelf', jlpt: 'N3' },
  { id: 'vocab-cat-kagu', type: 'vocab', front: '家具', reading: 'kagu', back: 'furniture', jlpt: 'N3' },
  { id: 'vocab-cat-hikidashi', type: 'vocab', front: '引き出し', reading: 'hikidashi', back: 'drawer', jlpt: 'N3' },
  { id: 'vocab-cat-shokutaku', type: 'vocab', front: '食卓', reading: 'shokutaku', back: 'dining table', jlpt: 'N2' },
  { id: 'vocab-cat-tansu', type: 'vocab', front: 'タンス', reading: 'tansu', back: 'drawer chest', jlpt: 'N2' },
  { id: 'vocab-cat-zabuton', type: 'vocab', front: '座布団', reading: 'zabuton', back: 'floor cushion (furniture)', jlpt: 'N2' },
  { id: 'vocab-cat-honbako', type: 'vocab', front: '本箱', reading: 'honbako', back: 'bookcase (furniture)', jlpt: 'N2' },

  // Medicine — was 2 copies of one word
  { id: 'vocab-cat-jouzai', type: 'vocab', front: '錠剤', reading: 'jouzai', back: 'tablet; pill', jlpt: 'N2' },
  { id: 'vocab-cat-kazegusuri', type: 'vocab', front: '風邪薬', reading: 'kazegusuri', back: 'cold medicine', jlpt: 'N3' },
  { id: 'vocab-cat-igusuri', type: 'vocab', front: '胃薬', reading: 'igusuri', back: 'stomach medicine', jlpt: 'N2' },
  { id: 'vocab-cat-itamidome', type: 'vocab', front: '痛み止め', reading: 'itamidome', back: 'painkiller medicine', jlpt: 'N2' },
  { id: 'vocab-cat-kanpouyaku', type: 'vocab', front: '漢方薬', reading: 'kanpouyaku', back: 'herbal medicine', jlpt: 'N1' },
  { id: 'vocab-cat-zutsuuyaku', type: 'vocab', front: '頭痛薬', reading: 'zutsuuyaku', back: 'headache medicine', jlpt: 'N2' },
  { id: 'vocab-cat-suiminyaku', type: 'vocab', front: '睡眠薬', reading: 'suiminyaku', back: 'sleeping pill', jlpt: 'N1' },
  { id: 'vocab-cat-bitaminzai', type: 'vocab', front: 'ビタミン剤', reading: 'bitaminzai', back: 'vitamin pill', jlpt: 'N2' },
  // 薬 is drunk in Japanese, so every word the Medicine category holds becomes
  // an object of 飲む. That rules out 目薬 and 軟膏, which are applied rather
  // than swallowed, and 処方箋, which is a piece of paper — all three were
  // drafted here and removed after 処方箋を飲みます turned up in testing. The
  // category has no tag separating oral medicine from topical, so the
  // separation has to happen at the door.

  // Book — was 8 (5 unique) against 6 verbs
  { id: 'vocab-cat-manga', type: 'vocab', front: '漫画', reading: 'manga', back: 'comic', jlpt: 'N4' },
  { id: 'vocab-cat-ehon', type: 'vocab', front: '絵本', reading: 'ehon', back: 'picture book', jlpt: 'N3' },
  { id: 'vocab-cat-sankousho', type: 'vocab', front: '参考書', reading: 'sankousho', back: 'reference book', jlpt: 'N2' },
  { id: 'vocab-cat-shuukanshi', type: 'vocab', front: '週刊誌', reading: 'shuukanshi', back: 'weekly magazine', jlpt: 'N2' },
  { id: 'vocab-cat-bunkobon', type: 'vocab', front: '文庫本', reading: 'bunkobon', back: 'paperback book', jlpt: 'N2' },
  { id: 'vocab-cat-zukan', type: 'vocab', front: '図鑑', reading: 'zukan', back: 'illustrated reference book', jlpt: 'N2' },
  { id: 'vocab-cat-shishuu', type: 'vocab', front: '詩集', reading: 'shishuu', back: 'poetry book', jlpt: 'N1' },

  // Money — was 5
  { id: 'vocab-cat-chokin', type: 'vocab', front: '貯金', reading: 'chokin', back: 'savings (money)', jlpt: 'N3' },
  { id: 'vocab-cat-shuunyuu', type: 'vocab', front: '収入', reading: 'shuunyuu', back: 'income', jlpt: 'N2' },
  { id: 'vocab-cat-shiharai', type: 'vocab', front: '支払い', reading: 'shiharai', back: 'payment', jlpt: 'N2' },
  { id: 'vocab-cat-yachin', type: 'vocab', front: '家賃', reading: 'yachin', back: 'rent (monthly fee)', jlpt: 'N3' },
  { id: 'vocab-cat-zeikin', type: 'vocab', front: '税金', reading: 'zeikin', back: 'tax (money)', jlpt: 'N2' },
  { id: 'vocab-cat-yosan', type: 'vocab', front: '予算', reading: 'yosan', back: 'budget (money)', jlpt: 'N2' },
  { id: 'vocab-cat-kozeni', type: 'vocab', front: '小銭', reading: 'kozeni', back: 'small change (coins, money)', jlpt: 'N3' },
  { id: 'vocab-cat-bakkin', type: 'vocab', front: '罰金', reading: 'bakkin', back: 'fine (money penalty)', jlpt: 'N2' },
  { id: 'vocab-cat-tesuuryou', type: 'vocab', front: '手数料', reading: 'tesuuryou', back: 'handling fee', jlpt: 'N2' },

  // Plant — was 6
  { id: 'vocab-cat-sakura', type: 'vocab', front: '桜', reading: 'sakura', back: 'cherry tree', jlpt: 'N4' },
  { id: 'vocab-cat-matsu', type: 'vocab', front: '松', reading: 'matsu', back: 'pine tree', jlpt: 'N2' },
  { id: 'vocab-cat-take', type: 'vocab', front: '竹', reading: 'take', back: 'bamboo', jlpt: 'N3' },
  { id: 'vocab-cat-ha', type: 'vocab', front: '葉', reading: 'ha', back: 'leaf', jlpt: 'N4' },
  { id: 'vocab-cat-tane', type: 'vocab', front: '種', reading: 'tane', back: 'seed', jlpt: 'N3' },
  { id: 'vocab-cat-shibafu', type: 'vocab', front: '芝生', reading: 'shibafu', back: 'lawn grass', jlpt: 'N2' },
  { id: 'vocab-cat-bara', type: 'vocab', front: 'バラ', reading: 'bara', back: 'rose flower', jlpt: 'N3' },
  { id: 'vocab-cat-eda', type: 'vocab', front: '枝', reading: 'eda', back: 'branch (of a tree)', jlpt: 'N3' },
  { id: 'vocab-cat-ine', type: 'vocab', front: '稲', reading: 'ine', back: 'rice plant', jlpt: 'N1' },

  // Emotion — was 1
  { id: 'vocab-cat-yorokobi', type: 'vocab', front: '喜び', reading: 'yorokobi', back: 'joy; happy feeling', jlpt: 'N3' },
  { id: 'vocab-cat-kanashimi', type: 'vocab', front: '悲しみ', reading: 'kanashimi', back: 'sadness; sad feeling', jlpt: 'N3' },
  { id: 'vocab-cat-ikari', type: 'vocab', front: '怒り', reading: 'ikari', back: 'anger; angry feeling', jlpt: 'N3' },
  { id: 'vocab-cat-kyoufu', type: 'vocab', front: '恐怖', reading: 'kyoufu', back: 'fear; feeling afraid', jlpt: 'N2' },
  { id: 'vocab-cat-aijou', type: 'vocab', front: '愛情', reading: 'aijou', back: 'love; affection', jlpt: 'N2' },
  { id: 'vocab-cat-kodoku', type: 'vocab', front: '孤独', reading: 'kodoku', back: 'loneliness; feeling lonely', jlpt: 'N2' },
  { id: 'vocab-cat-koufun', type: 'vocab', front: '興奮', reading: 'koufun', back: 'excitement; feeling excited', jlpt: 'N2' },

  // Weather — was 1
  { id: 'vocab-cat-taifuu', type: 'vocab', front: '台風', reading: 'taifuu', back: 'typhoon', jlpt: 'N4' },
  { id: 'vocab-cat-arashi', type: 'vocab', front: '嵐', reading: 'arashi', back: 'storm', jlpt: 'N3' },
  { id: 'vocab-cat-kumori', type: 'vocab', front: '曇り', reading: 'kumori', back: 'cloudy weather', jlpt: 'N5' },
  { id: 'vocab-cat-hare', type: 'vocab', front: '晴れ', reading: 'hare', back: 'sunny weather', jlpt: 'N5' },
  { id: 'vocab-cat-kion', type: 'vocab', front: '気温', reading: 'kion', back: 'air temperature', jlpt: 'N3' },
  { id: 'vocab-cat-shikke', type: 'vocab', front: '湿気', reading: 'shikke', back: 'humidity (weather)', jlpt: 'N2' },
  { id: 'vocab-cat-kaminari', type: 'vocab', front: '雷', reading: 'kaminari', back: 'thunder (weather)', jlpt: 'N3' },
  { id: 'vocab-cat-kiri', type: 'vocab', front: '霧', reading: 'kiri', back: 'fog (weather)', jlpt: 'N2' },
  { id: 'vocab-cat-tsuyu', type: 'vocab', front: '梅雨', reading: 'tsuyu', back: 'rainy weather period', jlpt: 'N2' },
]
