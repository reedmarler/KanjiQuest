import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const USER_VOCAB_FILE = path.resolve(import.meta.dirname, 'src/data/userAddedVocab.json')

interface UserVocabRecord {
  id: string
  front: string
  reading?: string
  back: string
  jlpt?: string
}

function readBody(req: import('node:http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
      if (body.length > 1_000_000) reject(new Error('Payload too large'))
    })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

/**
 * Dev-only endpoint that persists vocabulary added in Content Studio straight to
 * src/data/userAddedVocab.json on disk. This makes "Add to database" permanent
 * (version-controlled, shared across browsers) rather than browser-only.
 * Deduplicates on the Japanese word, matching the app's in-editor dedupe.
 */
function userVocabPersistencePlugin(): Plugin {
  return {
    name: 'kanji-quest-user-vocab-persistence',
    configureServer(server) {
      server.middlewares.use('/__add-vocab', (req, res, next) => {
        if (req.method !== 'POST') return next()

        readBody(req)
          .then((raw) => {
            const incoming = JSON.parse(raw) as UserVocabRecord[]
            if (!Array.isArray(incoming)) throw new Error('Expected an array of records')

            const existing: UserVocabRecord[] = existsSync(USER_VOCAB_FILE)
              ? (JSON.parse(readFileSync(USER_VOCAB_FILE, 'utf8')) as UserVocabRecord[])
              : []

            const byWord = new Map(existing.map((record) => [record.front.trim(), record]))
            let added = 0
            for (const record of incoming) {
              const word = record.front?.trim()
              if (!word || byWord.has(word)) continue
              byWord.set(word, { ...record, front: word })
              added += 1
            }

            const merged = [...byWord.values()]
            writeFileSync(USER_VOCAB_FILE, `${JSON.stringify(merged, null, 2)}\n`)

            res.statusCode = 200
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ ok: true, added, total: merged.length }))
          })
          .catch((error: unknown) => {
            res.statusCode = 400
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ ok: false, error: String(error) }))
          })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({  }) => ({
  // GitHub Pages serves the site from /KanjiQuest/, so built asset URLs need
  // that prefix. The dev server still runs at the root.
  base: '/',
  plugins: [react(), userVocabPersistencePlugin()],
  server: {
    watch: {
      ignored: ['**/scripts/**'],
    },
  },
}))
