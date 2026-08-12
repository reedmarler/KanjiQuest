import { auditWordReachability } from '../src/lib/categorySentenceEngine'
const rows = auditWordReachability().filter(r=>r.tags.includes('expression'))
console.log('expression-tagged:', rows.length, '| currently reachable:', rows.filter(r=>r.reachable).length)
for (const r of rows.filter(x=>x.reachable)) console.log('  REACHABLE', r.japanese, r.english, r.tags.join(','))
for (const r of rows.filter(x=>!x.reachable).slice(0,10)) console.log('  unreachable', r.japanese, r.english)
