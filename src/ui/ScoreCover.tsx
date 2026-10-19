import type { ScoreEntry } from '../reader/library'

/** An original, deterministic book jacket; no downloaded artwork or fonts. */
export default function ScoreCover({ entry }: { entry: ScoreEntry }) {
  let seed = 0
  for (const c of entry.title + entry.composer) seed = (seed * 31 + c.charCodeAt(0)) >>> 0
  const words = (entry.composer || entry.title).replace(/[^\p{L}\p{N} ]/gu, '').split(/\s+/).filter(Boolean)
  const initials = words.length ? words[0][0] + (words.length > 1 ? words.at(-1)![0] : '') : 'ƒ'
  return <span className={`cover score-cover pattern-${seed % 3}`} style={{ '--hue': seed % 360 } as React.CSSProperties} aria-hidden="true">
    <span className="cover-frame" /><span className="cover-initials">{initials.toUpperCase()}</span>
    <span className="cover-lines"><i /><i /><i /><i /><i /></span><span className="cover-imprint">FALLBOARD</span>
  </span>
}
