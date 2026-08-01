import { lazy, Suspense, useState } from 'react'

const WordCategories = lazy(() => import('./WordCategories').then((module) => ({ default: module.WordCategories })))
const VocabList = lazy(() => import('./VocabList').then((module) => ({ default: module.VocabList })))

export type LibraryTab = 'vocab' | 'categories'

interface LibraryPanelProps {
  initialTab: LibraryTab
  onBack: () => void
}

export function LibraryPanel({ initialTab, onBack }: LibraryPanelProps) {
  const [tab, setTab] = useState<LibraryTab>(initialTab)

  return (
    <div className="library-panel">
      <header className="library-panel-header">
        <button type="button" className="btn btn-ghost" onClick={onBack}>← Dashboard</button>
        <div>
          <h1>Study Library</h1>
          <p>Browse your vocabulary by level or by part of speech.</p>
        </div>
      </header>

      <div className="library-panel-tabs" role="tablist" aria-label="Study library">
        <button type="button" role="tab" aria-selected={tab === 'vocab'} className={tab === 'vocab' ? 'active' : ''} onClick={() => setTab('vocab')}>
          語 Vocab List
        </button>
        <button type="button" role="tab" aria-selected={tab === 'categories'} className={tab === 'categories' ? 'active' : ''} onClick={() => setTab('categories')}>
          動 Word Categories
        </button>
      </div>

      <Suspense fallback={<div className="library-panel-loading" role="status">Loading</div>}>
        {tab === 'vocab'
          ? <VocabList embedded />
          : <WordCategories embedded />}
      </Suspense>
    </div>
  )
}
