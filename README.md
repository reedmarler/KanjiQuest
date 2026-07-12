# Kanji Quest

A Japanese language learning app with spaced repetition, tuned for **JLPT N3/N2** learners. Study kanji, vocabulary, and in-context reading quizzes across all JLPT levels (N5–N1).

## Features

- **Reading Quiz** — see a sentence with highlighted kanji, pick the correct kana reading
- **Kanji** — 70+ entries from N5 through N1 (compounds like 影響, 妥協, 未曾有)
- **Vocabulary** — 60+ words weighted toward N3/N2 with JLPT tags
- **Hiragana & Katakana** — kana foundations
- **Spaced repetition** — cards resurface based on how well you know them
- **Progress tracking** — streaks, learned cards, per-deck stats (saved in browser)

## Getting started

```bash
npm install
npm run dev
```

## How to study

1. Pick a deck — **Reading Quiz** for sentence context, or Kanji/Vocab for flashcards
2. For flashcards: tap to reveal, then rate Again / Hard / Good / Easy
3. For reading: pick the correct kana, then rate or hit Continue
4. Cards you miss come back sooner; easy ones wait longer

## Tech stack

- React + TypeScript + Vite
- LocalStorage for persistence (no backend needed)
