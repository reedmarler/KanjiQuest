import { FuriganaGlossSegment, FuriganaGlossSentence } from './FuriganaText'
import type { AnswerGloss } from '../lib/answerGloss'

interface AnswerRevealProps {
  gloss: AnswerGloss
  className?: string
}

/** Standard post-answer block: English translation + furigana with glosses. */
export function AnswerReveal({ gloss, className = '' }: AnswerRevealProps) {
  const hasSentence = Boolean(gloss.segments?.length)

  return (
    <div className={`answer-reveal ${className}`.trim()}>
      {gloss.english && <p className="sentence-english">{gloss.english}</p>}
      {hasSentence ? (
        <p className="sentence-answer-gloss">
          <FuriganaGlossSentence
            segments={gloss.segments!}
            readings={gloss.readings}
            meanings={gloss.meanings}
            segmentClassName="furigana-emphasis"
          />
        </p>
      ) : gloss.text ? (
        <p className="sentence-answer-gloss">
          <FuriganaGlossSegment
            text={gloss.text}
            reading={gloss.reading}
            meaning={gloss.meaning}
            className="furigana-emphasis"
          />
        </p>
      ) : null}
      {gloss.sentenceEnglish && (
        <p className="sentence-translation">{gloss.sentenceEnglish}</p>
      )}
    </div>
  )
}
