import { generateCategorySentence } from '../src/lib/categorySentenceEngine'

// Warm caches first
generateCategorySentence(1, 'n5-01', 'N5')

const N = 500
const t0 = performance.now()
for (let i = 0; i < N; i++) {
  generateCategorySentence(1000 + i, 'n5-01', 'N5')
}
console.log(`n5-01 (base engine): ${((performance.now() - t0) / N).toFixed(3)}ms/call`)

const t1 = performance.now()
for (let i = 0; i < N; i++) {
  generateCategorySentence(1000 + i, 'n2-02', 'N2')
}
console.log(`n2-02 (advanced): ${((performance.now() - t1) / N).toFixed(3)}ms/call`)

const t2 = performance.now()
for (let i = 0; i < N; i++) {
  generateCategorySentence(1000 + i, 'n1-05', 'N1')
}
console.log(`n1-05 (small-scene advanced): ${((performance.now() - t2) / N).toFixed(3)}ms/call`)
