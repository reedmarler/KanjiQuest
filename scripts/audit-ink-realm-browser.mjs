import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.QUEST_PREVIEW_URL || 'http://127.0.0.1:5174'
const output = path.resolve(process.env.QUEST_SCREENSHOTS || 'outputs/ink-realm-verification')
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const saveKey = 'kanji-quest-ink-realm-v1'
const screensOnly = process.argv.includes('--screens-only')

async function checkLayout(page, label) {
  await page.locator('.realm img').evaluateAll((images) => Promise.all(images.map((img) => img.decode())))
  const defects = await page.locator('.realm').evaluate((root) => {
    const overflow = document.documentElement.scrollWidth > window.innerWidth + 2
    const missingImages = [...root.querySelectorAll('img')].filter((img) => !img.complete || !img.naturalWidth).map((img) => img.src)
    const clipped = [...root.querySelectorAll('button')].filter((button) => button.offsetWidth && button.scrollWidth > button.clientWidth + 3).map((button) => button.textContent)
    return { overflow, missingImages, clipped }
  })
  assert.deepEqual(defects, { overflow: false, missingImages: [], clipped: [] }, `${label}: layout and assets`)
}

try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 320, height: 740 }]) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce' })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    try {
      await page.goto(`${base}/#quests`)
      await page.getByRole('heading', { name: 'The Ink Realm' }).waitFor()
      await page.locator('.realm-background').evaluate((img) => img.decode())
      await page.locator('.realm-player img').evaluate((img) => img.decode())
      await page.screenshot({ path: path.join(output, `start-${viewport.width}.png`), fullPage: true })
      await checkLayout(page, `start ${viewport.width}`)
      if (screensOnly) continue
      const nav = page.getByRole('navigation', { name: 'Village locations' })
      await page.getByRole('button', { name: 'Accept the letter', exact: true }).click()
      await page.getByRole('button', { name: 'Courier note', exact: true }).click()
      await page.getByRole('tab', { name: /Clues/ }).click()
      assert.equal(await page.locator('.realm-journal article').count(), 2)
      await page.getByRole('tab', { name: /Clues/ }).press('ArrowLeft')
      assert.equal(await page.getByRole('tab', { name: 'Encounter' }).getAttribute('aria-selected'), 'true')
      await page.getByRole('tab', { name: 'Encounter' }).press('End')
      assert.equal(await page.getByRole('tab', { name: /Clues/ }).getAttribute('aria-selected'), 'true')
      await page.getByLabel('Furigana', { exact: true }).uncheck()
      assert.equal(await page.locator('.realm rt').count(), 0)
      await page.getByLabel('Furigana', { exact: true }).check()
      await nav.getByRole('button', { name: 'Ferry landing', exact: true }).click()
      await page.getByRole('button', { name: 'Small boat', exact: true }).click()
      assert.equal(await page.getByRole('button', { name: 'Receive the seal', exact: true }).count(), 0)
      await nav.getByRole('button', { name: 'Stone bridge', exact: true }).click()
      await page.getByRole('button', { name: 'Traveler with scroll', exact: true }).click()
      await page.getByRole('heading', { name: 'The traveler with the scroll', exact: true }).waitFor()
      await page.getByRole('button', { name: 'Traveler with book', exact: true }).click()
      await page.locator('.realm-inventory').getByRole('button', { name: /Keeper's letter/ }).click()
      await page.screenshot({ path: path.join(output, `bridge-${viewport.width}.png`), fullPage: true })
      await checkLayout(page, `bridge ${viewport.width}`)
      await page.getByRole('button', { name: "Show the keeper's letter", exact: true }).click()
      await page.reload()
      await page.getByRole('heading', { name: 'An agreed meeting', exact: true }).waitFor()
      assert.equal(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).phase, saveKey), 'meeting')
      await nav.getByRole('button', { name: 'Ferry landing', exact: true }).click()
      await page.getByRole('button', { name: 'Large ferry', exact: true }).click()
      await page.getByRole('heading', { name: 'The ferry captain', exact: true }).waitFor()
      await page.getByRole('button', { name: 'Small boat', exact: true }).click()
      await page.getByRole('button', { name: 'Receive the seal', exact: true }).click()
      await nav.getByRole('button', { name: 'Village gate', exact: true }).click()
      await page.getByRole('button', { name: 'Gate lantern', exact: true }).click()
      await page.locator('.realm-inventory').getByRole('button', { name: /Lantern seal/ }).click()
      await page.getByRole('button', { name: 'Press the seal into the frame', exact: true }).click()
      await page.getByRole('heading', { name: 'A light to come home to', exact: true }).waitFor()
      await checkLayout(page, `complete ${viewport.width}`)
      await page.screenshot({ path: path.join(output, `complete-${viewport.width}.png`), fullPage: true })
      const finished = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), saveKey)
      assert.ok(finished.completedAt)
      assert.deepEqual(finished.encounters, ['notice', 'porter', 'large-boat'])
      await page.getByRole('button', { name: 'See the road ahead', exact: true }).click()
      await page.getByRole('heading', { name: 'The Market Road', exact: true }).waitFor()
      await page.screenshot({ path: path.join(output, `journey-${viewport.width}.png`), fullPage: true })
      await checkLayout(page, `journey ${viewport.width}`)
      await page.getByRole('button', { name: 'Return to quest', exact: true }).click()
      await page.getByRole('button', { name: 'Replay chapter', exact: true }).click()
      assert.equal(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).completedAt, saveKey), finished.completedAt)
      await page.getByRole('button', { name: 'Accept the letter', exact: true }).waitFor()
      assert.deepEqual(errors, [], 'No uncaught browser errors')
      console.log(`PASS ${viewport.width}px: full quest, both detours, premature boat visit, reload, journal, furigana, completion, replay, layout.`)
    } catch (error) {
      await page.screenshot({ path: path.join(output, `failure-${viewport.width}.png`), fullPage: true })
      throw error
    } finally { await context.close() }
  }
  if (!screensOnly) {
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.addInitScript((key) => {
      localStorage.setItem(key, '{broken save')
      const original = Storage.prototype.setItem
      Storage.prototype.setItem = function (storageKey, value) {
        if (storageKey === key) throw new DOMException('Storage is full', 'QuotaExceededError')
        return original.call(this, storageKey, value)
      }
    }, saveKey)
    await page.goto(`${base}/#quests`)
    await page.getByRole('button', { name: 'Accept the letter', exact: true }).click()
    await page.getByText('Progress could not be saved on this device', { exact: true }).waitFor()
    assert.equal(await page.locator('.realm-inventory').getByRole('button', { name: /Keeper's letter/ }).count(), 1)
    console.log('PASS damaged save and blocked storage: playable in memory with a visible save warning.')
    await context.close()
  }
} finally { await browser.close() }
