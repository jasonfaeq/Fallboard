// The sheet music reader: open a score, see it as sheet music, falling keys or both, and play it.
import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import type { OpenSheetMusicDisplay } from 'opensheetmusicdisplay'
import { Engine } from './engine/audio'
import { Player } from './reader/player'
import { buildTimeline, passAt, type Timeline } from './reader/timeline'
import { isMuseScoreFile, museScoreToMusicXml } from './reader/mscz'
import { BUILT_IN, checkFile, deleteImported, importFile, listImported, loadImported, renameImported, sourceFrom, type ScoreEntry, type ScoreSource } from './reader/library'
import { ROW_CHOICES, loadPrefs, loadScorePrefs, savePrefs, saveScorePrefs, type Prefs, type ScorePrefs, type View } from './reader/prefs'
import SheetView from './ui/SheetView'
import KeysView from './ui/KeysView'
import Library from './ui/Library'
import Scrubber, { clock } from './ui/Scrubber'

declare global {
  interface Window {
    /** debug handle for tests and the console */
    __piano: { engine: Engine; player: Player; timeline: Timeline | null; osmd: OpenSheetMusicDisplay | null }
  }
}

const SHORTCUTS: [string, string][] = [
  ['Space', 'Play / pause'], ['Home', 'Back to the start'], ['← →', 'Previous / next bar'], ['↑ ↓', 'Faster / slower'],
  ['L', 'Loop this bar (Shift+click a bar to stretch the loop)'], ['M', 'Metronome'], ['1 – 4', 'Rows of music'],
  ['S · K · B', 'Sheet · Keys · Both'], ['N', 'Note names'], ['O', 'Scores'], ['?', 'This list'],
]
const VIEWS: [View, string][] = [['sheet', 'Sheet'], ['keys', 'Keys'], ['both', 'Both']]
const loopLabel = (first: number, last: number) => first === last ? `Loop bar ${first}` : `Loop bars ${first}–${last}`

export default function App() {
  const [, redraw] = useReducer((n: number) => n + 1, 0)
  const engine = useRef<Engine>()
  engine.current ??= new Engine()
  const player = useRef<Player>()
  player.current ??= new Player(engine.current)
  const p = player.current
  const osmd = useRef<OpenSheetMusicDisplay | null>(null)

  const [prefs, setPrefs] = useState<Prefs>(loadPrefs)
  const [imported, setImported] = useState<ScoreEntry[]>([])
  const [entry, setEntry] = useState<ScoreEntry | null>(null)
  const [source, setSource] = useState<{ key: string; data: ScoreSource } | null>(null)
  const [scorePrefs, setScorePrefs] = useState<ScorePrefs>({ speed: 1, transpose: 0, muted: [] })
  const [timeline, setTimeline] = useState<Timeline | null>(null)
  const [loop, setLoopPasses] = useState<[number, number] | null>(null)
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [help, setHelp] = useState(false)
  const [dropping, setDropping] = useState(false)
  const [pressed, setPressed] = useState<ReadonlySet<number>>(new Set())
  const anchor = useRef(0)
  const latest = useRef({ entry, scorePrefs, timeline, prefs })
  latest.current = { entry, scorePrefs, timeline, prefs }

  const updatePrefs = (patch: Partial<Prefs>) => setPrefs((old) => { const next = { ...old, ...patch }; savePrefs(next); return next })
  const updateScorePrefs = (patch: Partial<ScorePrefs>) => setScorePrefs((old) => {
    const next = { ...old, ...patch }
    const id = latest.current.entry?.id
    if (id) saveScorePrefs(id, next)
    return next
  })

  const openSource = useCallback((next: ScoreEntry, data: ScoreSource, closeLibrary = true) => {
    p.load(null)
    const saved = loadScorePrefs(next.id)
    setScorePrefs(saved)
    p.speed = saved.speed
    p.muted = new Set(saved.muted)
    setEntry(next)
    setTimeline(null)
    setLoopPasses(null)
    setSource({ key: `${next.id}:${Date.now()}`, data })
    if (closeLibrary) setLibraryOpen(false)
    setPrefs((old) => { const n = { ...old, lastScore: next.id }; savePrefs(n); return n })
  }, [p])

  const open = useCallback(async (next: ScoreEntry, closeLibrary = true) => {
    setMessage(null)
    const builtIn = BUILT_IN.find((b) => b.id === next.id)
    if (builtIn) { openSource(builtIn, builtIn.xml, closeLibrary); return }
    const data = await loadImported(next.id)
    if (!data) { setMessage({ text: 'That score could not be read from this browser’s storage.', error: true }); return }
    openSource(next, sourceFrom(data), closeLibrary)
  }, [openSource])

  const importFiles = async (files: FileList | File[]) => {
    const file = files[0]
    if (!file) return
    let data = await file.arrayBuffer()
    const problem = checkFile(file.name, data)
    if (problem) { setMessage({ text: problem, error: true }); return }
    if (isMuseScoreFile(file.name)) {
      try {
        data = new TextEncoder().encode(await museScoreToMusicXml(data)).buffer as ArrayBuffer
      } catch (e) {
        setMessage({ text: `This MuseScore file could not be read: ${(e as Error).message}. In MuseScore Studio, use File → Export → MusicXML and import that instead.`, error: true })
        return
      }
    }
    const { entry: added, saved } = await importFile(file.name, data)
    setMessage(saved ? null : { text: 'Opened, but this browser would not keep a copy for next time.', error: false })
    setImported(await listImported())
    openSource(added, sourceFrom(data))
  }

  // First visit: the last score, or the first built-in piece.
  useEffect(() => {
    void listImported().then((list) => {
      setImported(list)
      const last = [...BUILT_IN, ...list].find((e) => e.id === loadPrefs().lastScore) ?? BUILT_IN[0]
      void open(last)
    })
  }, [open])

  // The sheet parsed the score (or transposed it): build what plays.
  const onLoaded = useCallback((sheet: OpenSheetMusicDisplay) => {
    osmd.current = sheet
    const { entry: current, scorePrefs: sp, timeline: before } = latest.current
    const built = buildTimeline(sheet.Sheet, sp.transpose)
    p.load(built, before !== null)
    setTimeline(built)
    setLoopPasses(null)
    if (current && !current.builtIn) {
      const title = sheet.Sheet.TitleString?.trim(), composer = sheet.Sheet.ComposerString?.trim() ?? ''
      if ((title && title !== current.title) || composer !== current.composer) {
        const named = { ...current, title: title || current.title, composer }
        setEntry(named)
        void renameImported(named).then(listImported).then(setImported)
      }
    }
  }, [p])

  const setLoop = (range: [number, number] | null) => {
    setLoopPasses(range)
    const t = latest.current.timeline
    p.setLoop(range && t ? { start: t.passes[range[0]].time, end: t.passes[range[1]].end } : null)
  }
  const onPick = (time: number, pass: number, extend: boolean) => {
    if (extend) { setLoop([Math.min(anchor.current, pass), Math.max(anchor.current, pass)]); return }
    anchor.current = pass
    if (loop && (pass < loop[0] || pass > loop[1])) setLoop(null)
    p.seek(time)
  }
  const stepBar = (direction: 1 | -1) => {
    if (!timeline) return
    const now = p.time
    let i = passAt(timeline, now)
    if (direction < 0 && now - timeline.passes[i].time < 0.4) i--
    if (direction > 0) i++
    i = Math.max(0, Math.min(timeline.passes.length - 1, i))
    anchor.current = i
    p.seek(timeline.passes[i].time)
  }
  const loopHere = () => {
    if (loop) { setLoop(null); return }
    if (!timeline) return
    const i = passAt(timeline, p.time)
    anchor.current = i
    setLoop([i, i])
  }
  const setSpeed = (speed: number) => { p.setSpeed(speed); updateScorePrefs({ speed: p.speed }) }
  const toggleMute = (staff: number) => {
    const muted = !p.muted.has(staff)
    p.setMuted(staff, muted)
    updateScorePrefs({ muted: [...p.muted] })
  }

  const held = useRef(new Set<number>())
  const press = async (note: number) => {
    held.current.add(note)
    setPressed(new Set(held.current))
    await engine.current!.start()
    // The first press waits for the piano to load; the key may be up again by then.
    if (held.current.has(note)) engine.current!.piano?.noteOn(note, 90, 'touch')
  }
  const release = (note: number) => {
    held.current.delete(note)
    setPressed(new Set(held.current))
    engine.current!.piano?.noteOff(note, 'touch')
  }

  // Redraw every frame while playing; otherwise only when something changes.
  useEffect(() => {
    p.onChange = redraw
    engine.current!.onChange = redraw
    engine.current!.volume = latest.current.prefs.volume
    let frame = 0
    const tick = () => { if (p.playing) redraw(); frame = requestAnimationFrame(tick) }
    frame = requestAnimationFrame(tick)
    const hidden = () => { if (document.hidden) p.pause() }
    document.addEventListener('visibilitychange', hidden)
    return () => { cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', hidden) }
  }, [p])
  useEffect(() => () => { p.dispose(); engine.current!.dispose() }, [p])
  useEffect(() => { p.metronome = prefs.metronome; p.countIn = prefs.countIn }, [p, prefs.metronome, prefs.countIn])

  useEffect(() => {
    window.__piano = { engine: engine.current!, player: p, timeline, osmd: osmd.current }
  }, [p, timeline])

  // Keyboard shortcuts.
  const keys = useRef<(e: KeyboardEvent) => void>()
  keys.current = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement
    // Sliders keep their arrow keys; Space and letters still work on them.
    const slider = target instanceof HTMLInputElement && target.type === 'range'
    if ((target?.tagName === 'INPUT' && !slider) || ['SELECT', 'TEXTAREA'].includes(target?.tagName) || e.ctrlKey || e.metaKey || e.altKey) return
    const key = e.key
    if (slider && /^(Arrow|Home|End|Page)/.test(key)) return
    const actions: Record<string, () => void> = {
      ' ': () => p.toggle(), Home: () => p.stop(), ArrowLeft: () => stepBar(-1), ArrowRight: () => stepBar(1),
      ArrowUp: () => setSpeed(p.speed + 0.05), ArrowDown: () => setSpeed(p.speed - 0.05),
      l: loopHere, m: () => updatePrefs({ metronome: !prefs.metronome }), n: () => updatePrefs({ noteNames: !prefs.noteNames }),
      s: () => updatePrefs({ view: 'sheet' }), k: () => updatePrefs({ view: 'keys' }), b: () => updatePrefs({ view: 'both' }),
      o: () => setLibraryOpen((v) => !v), '?': () => setHelp((v) => !v), Escape: () => { setHelp(false); setLibraryOpen(false) },
      '1': () => updatePrefs({ rows: 1 }), '2': () => updatePrefs({ rows: 2 }), '3': () => updatePrefs({ rows: 3 }), '4': () => updatePrefs({ rows: 4 }),
    }
    const action = actions[key.length === 1 ? key.toLowerCase() : key]
    if (!action) return
    e.preventDefault()
    action()
  }
  useEffect(() => {
    const handler = (e: KeyboardEvent) => keys.current!(e)
    // Space is play/pause everywhere: it must not also press the button that has focus.
    const up = (e: KeyboardEvent) => { if (e.key === ' ' && (e.target as HTMLElement)?.tagName === 'BUTTON') e.preventDefault() }
    window.addEventListener('keydown', handler)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', handler); window.removeEventListener('keyup', up) }
  }, [])

  const time = p.time
  const pass = timeline?.passes[passAt(timeline, time)]
  const lastBar = timeline?.passes.reduce((max, x) => Math.max(max, x.number), 0) ?? 0
  const loopTimes = loop && timeline ? { start: timeline.passes[loop[0]].time, end: timeline.passes[loop[1]].end } : null
  const status = p.error || (engine.current.status === 'loading' ? 'Loading the piano…' :
    p.state === 'countIn' ? `Count-in · ${p.countRemaining}` : '')
  const muted = p.muted

  return <div className="app"
    onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDropping(true) } }}
    onDragLeave={(e) => { if (e.currentTarget === e.target) setDropping(false) }}
    onDrop={(e) => { e.preventDefault(); setDropping(false); void importFiles(e.dataTransfer.files) }}>
    <header className="topbar">
      <button className="scores-button" onClick={() => setLibraryOpen(true)} title="Scores (O)">
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 4h14M3 10h14M3 16h14" /></svg> Scores
      </button>
      <div className="score-title">
        <h1>{entry?.title ?? 'Fallboard'}</h1>
        <p>{entry?.composer || (entry?.file ?? '')}</p>
      </div>
      <div className="transport">
        <button className="icon" onClick={() => p.stop()} title="Back to the start (Home)" aria-label="Back to the start">
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 4v12M16 4 7 10l9 6z" /></svg>
        </button>
        <button className="play" onClick={() => p.toggle()} disabled={!timeline} title="Play / pause (Space)" aria-label={p.playing ? 'Pause' : 'Play'}>
          {p.playing ? <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 4h3v12H6zM11 4h3v12h-3z" /></svg>
            : <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 3.5 16.5 10 6 16.5z" /></svg>}
        </button>
        <div className="position" data-testid="position">
          <strong>{pass ? (pass.number === 0 ? 'Pickup' : `Bar ${pass.number}`) : '—'}</strong>
          <span>{lastBar ? `of ${lastBar}` : ''} · {pass ? `${Math.round(pass.bpm * p.speed)} BPM` : ''}</span>
        </div>
      </div>
      <button className="quiet help-button" onClick={() => setHelp(true)} aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)">?</button>
    </header>

    <nav className="controls" aria-label="Reader settings">
      <div className="group" role="group" aria-label="View">
        {VIEWS.map(([value, label]) => <button key={value} className={prefs.view === value ? 'on' : ''} aria-pressed={prefs.view === value}
          onClick={() => updatePrefs({ view: value })}>{label}</button>)}
      </div>
      <div className="group" role="group" aria-label="Rows">
        <span className="label">Rows</span>
        {ROW_CHOICES.map((n) => <button key={n} className={prefs.rows === n ? 'on' : ''} aria-pressed={prefs.rows === n} disabled={prefs.view === 'keys'}
          aria-label={`${n} row${n > 1 ? 's' : ''}`} onClick={() => updatePrefs({ rows: n })}>{n}</button>)}
      </div>
      <label className="group speed">
        <span className="label">Speed</span>
        <input type="range" min={25} max={200} step={5} value={Math.round(p.speed * 100)} aria-label="Speed"
          onChange={(e) => setSpeed(Number(e.target.value) / 100)} />
        <output>{Math.round(p.speed * 100)}%</output>
      </label>
      <div className="group" role="group" aria-label="Loop">
        <button className={loop ? 'on' : ''} aria-pressed={!!loop} onClick={loopHere} title="Loop this bar (L). Shift+click another bar to stretch the loop.">
          {loop && timeline ? loopLabel(timeline.passes[loop[0]].number, timeline.passes[loop[1]].number) : 'Loop'}
        </button>
      </div>
      <div className="group" role="group" aria-label="Transpose">
        <span className="label">Transpose</span>
        <button aria-label="Transpose down" disabled={scorePrefs.transpose <= -12} onClick={() => updateScorePrefs({ transpose: scorePrefs.transpose - 1 })}>−</button>
        <output data-testid="transpose">{scorePrefs.transpose > 0 ? `+${scorePrefs.transpose}` : scorePrefs.transpose}</output>
        <button aria-label="Transpose up" disabled={scorePrefs.transpose >= 12} onClick={() => updateScorePrefs({ transpose: scorePrefs.transpose + 1 })}>+</button>
      </div>
      {timeline && timeline.staves.length > 1 && <div className="group hands" role="group" aria-label="Staves to hear">
        {timeline.staves.map((s) => <button key={s.index} className={`staff-${Math.min(s.index, 2)}${muted.has(s.index) ? ' muted' : ' on'}`}
          aria-pressed={!muted.has(s.index)} title={muted.has(s.index) ? 'Muted: click to hear it' : 'Click to mute'}
          onClick={() => toggleMute(s.index)}>{s.name}</button>)}
      </div>}
      <div className="group" role="group" aria-label="Options">
        <button className={prefs.metronome ? 'on' : ''} aria-pressed={prefs.metronome} onClick={() => updatePrefs({ metronome: !prefs.metronome })}>Metronome</button>
        <button className={prefs.countIn ? 'on' : ''} aria-pressed={prefs.countIn} onClick={() => updatePrefs({ countIn: !prefs.countIn })}>Count-in</button>
        <button className={prefs.noteNames ? 'on' : ''} aria-pressed={prefs.noteNames} onClick={() => updatePrefs({ noteNames: !prefs.noteNames })}>Note names</button>
        <button onClick={() => updatePrefs({ theme: prefs.theme === 'paper' ? 'night' : 'paper' })} aria-label="Sheet colours">
          {prefs.theme === 'paper' ? 'Night sheet' : 'Paper sheet'}</button>
      </div>
      <label className="group volume">
        <span className="label">Volume</span>
        <input type="range" min={0} max={100} value={Math.round(prefs.volume * 100)} aria-label="Volume"
          onChange={(e) => { const v = Number(e.target.value) / 100; engine.current!.volume = v; updatePrefs({ volume: v }) }} />
      </label>
    </nav>

    {(message || status) && <div className={`message${message?.error || p.error ? ' error' : ''}`} role="status" data-testid="message">
      {message?.text || status}
      {message && <button className="quiet" aria-label="Dismiss" onClick={() => setMessage(null)}>✕</button>}
    </div>}

    <main className={`stage view-${prefs.view}`}>
      <section className="sheet-pane" aria-label="Sheet music" hidden={prefs.view === 'keys'}>
        <SheetView source={source?.data ?? null} sourceKey={source?.key ?? ''} rows={prefs.rows} theme={prefs.theme}
          transpose={scorePrefs.transpose} timeline={timeline} time={time} playing={p.playing} loop={loop}
          onLoaded={onLoaded} onError={(text) => setMessage({ text, error: true })} onPick={onPick} />
      </section>
      {prefs.view !== 'sheet' && <section className="keys-pane" aria-label="Keys">
        <KeysView timeline={timeline} time={time} names={prefs.noteNames} muted={muted} pressed={pressed} onPress={(n) => void press(n)} onRelease={release} />
      </section>}
    </main>

    <Scrubber timeline={timeline} time={time} loop={loopTimes} onSeek={(t) => { if (loopTimes && (t < loopTimes.start || t >= loopTimes.end)) setLoop(null); p.seek(t) }} />

    {libraryOpen && <Library current={entry?.id ?? ''} builtIn={BUILT_IN} imported={imported} onOpen={(e) => void open(e)}
      onImport={(files) => void importFiles(files)} onClose={() => setLibraryOpen(false)}
      onDelete={(e) => void deleteImported(e.id).then(listImported).then((list) => {
        setImported(list)
        if (entry?.id === e.id) void open(BUILT_IN[0], false)
      })} />}

    {help && <div className="drawer-backdrop center" onClick={() => setHelp(false)}>
      <div className="help" role="dialog" aria-label="Keyboard shortcuts" onClick={(e) => e.stopPropagation()}>
        <header><h2>Keyboard shortcuts</h2><button className="quiet" aria-label="Close shortcuts" onClick={() => setHelp(false)}>✕</button></header>
        <dl>{SHORTCUTS.map(([k, v]) => <div key={k}><dt><kbd>{k}</kbd></dt><dd>{v}</dd></div>)}</dl>
        <p className="hint">Click a note in the music to jump there. Click the keys to hear them.
          Sound: Salamander Grand Piano by Alexander Holm (<a href="https://creativecommons.org/licenses/by/3.0/">CC BY 3.0</a>).
          {' '}{timeline ? `This piece lasts ${clock(timeline.end)} at 100 %.` : ''}</p>
      </div>
    </div>}

    {dropping && <div className="drop-overlay" aria-hidden="true">Drop a score file to open it</div>}
  </div>
}
