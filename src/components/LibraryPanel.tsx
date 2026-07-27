import { useState } from 'react'
import type { FavoriteSentence } from '../lib/favoriteSentences'
import { FavoriteSentences } from './FavoriteSentences'
import { VocabList } from './VocabList'

export type LibraryTab = 'vocab' | 'favorites'

interface LibraryPanelProps {
  initialTab: LibraryTab
  favorites: FavoriteSentence[]
  onBack: () => void
  onRemove: (favorite: FavoriteSentence) => void
}

export function LibraryPanel({ initialTab, favorites, onBack, onRemove }: LibraryPanelProps) {
  const [tab, setTab] = useState<LibraryTab>(initialTab)

  return (
    <div className="library-panel">
      <header className="library-panel-header">
        <button type="button" className="btn btn-ghost" onClick={onBack}>← Dashboard</button>
        <div>
          <h1>Study Library</h1>
          <p>Browse your vocabulary or revisit saved sentences.</p>
        </div>
      </header>

      <div className="library-panel-tabs" role="tablist" aria-label="Study library">
        <button type="button" role="tab" aria-selected={tab === 'vocab'} className={tab === 'vocab' ? 'active' : ''} onClick={() => setTab('vocab')}>
          語 Vocab List
        </button>
        <button type="button" role="tab" aria-selected={tab === 'favorites'} className={tab === 'favorites' ? 'active' : ''} onClick={() => setTab('favorites')}>
          ★ Favorite Sentences
        </button>
      </div>

      {tab === 'vocab'
        ? <VocabList embedded />
        : <FavoriteSentences embedded favorites={favorites} onRemove={onRemove} />}
    </div>
  )
}
