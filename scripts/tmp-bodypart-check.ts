import { getAllCategoryWords } from '../src/lib/categorySentenceEngine'
const words = getAllCategoryWords()
const bodyParts = words.filter(w => w.tags.includes('body-part'))
for (const w of bodyParts) console.log(w.japanese, w.english, w.categories, w.tags)
