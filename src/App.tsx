// The sheet music reader: open a score, see it as sheet music, falling keys or both, and play it.
import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import type { OpenSheetMusicDisplay } from 'opensheetmusicdisplay'
import { Engine } from './engine/audio'
import { Player } from './reader/player'
import { buildTimeline, passAt, type Timeline } from './reader/timeline'
import { isMuseScoreFile, museScoreToMusicXml } from './reader/mscz'
import { BUILT_IN, checkFile, deleteImported, importFile, listImported, loadImported, renameImported, sourceFrom, type ScoreEntry, type ScoreSource } from './reader/library'
import { ROW_CHOICES, SCORE_DEFAULTS, loadPrefs, loadScorePrefs, savePrefs, saveScorePrefs, type Prefs, type ScorePrefs, type Section, type View } from './reader/prefs'
import SheetView from './ui/SheetView'
import KeysView from './ui/KeysView'
import Library from './ui/Library'
import Scrubber, { clock } from './ui/Scrubber'
import Settings from './ui/Settings'
import Sections from './ui/Sections'
import Icon from './ui/Icons'

declare global {
  interface Window {
    /** debug handle for tests and the console */
    __piano: { engine: Engine; player: Player; timeline: Timeline | null; osmd: OpenSheetMusicDisplay | null }
  }
}

const SHORTCUTS: [string, string][] = [
  ['Space', 'Play / pause'], ['Home', 'Back to the start'], ['← →', 'Previous / next bar'], ['↑ ↓', 'Faster / slower'],
  ['L', 'Loop this bar (Shift+click a bar to stretch the loop)'], ['[ · ]', 'Loop the previous / next saved section'], ['M', 'Metronome'], ['1 – 4', 'Rows of music'],
  ['S · K · B', 'Sheet · Keys · Both'], ['N', 'Note names'], ['F', 'Full screen'], ['O', 'Scores'], ['?', 'This list'],
]
const VIEWS: [View, string][] = [['sheet', 'Sheet'], ['keys', 'Keys'], ['both', 'Both']]
const loopLabel = (first: number, last: number) => first === last ? `Loop bar ${first}` : `Loop bars ${first}–${last}`
const countInText = ({ countInLength: n, countInUnit: unit }: Prefs) => `${n === 1 ? 'one' : n} ${n === 1 ? unit.slice(0, -1) : unit}`
const barsLabel = (t: Timeline, first: number, last: number) => {
  const a = t.passes[first]?.number, b = t.passes[last]?.number
  return a === undefined || b === undefined ? '—' : a === b ? `Bar ${a}` : `Bars ${a}–${b}`
}

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
  const [scorePrefs, setScorePrefs] = useState<ScorePrefs>(SCORE_DEFAULTS)
  const [timeline, setTimeline] = useState<Timeline | null>(null)
  const [loop, setLoopPasses] = useState<[number, number] | null>(null)
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [help, setHelp] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [sectionsOpen, setSectionsOpen] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [dropping, setDropping] = useState(false)
  const [pressed, setPressed] = useState<ReadonlySet<number>>(new Set())
  const anchor = useRef(0)
  const latest = useRef({ entry, scorePrefs, timeline, prefs, loop })
  latest.current = { entry, scorePrefs, timeline, prefs, loop }

  const updatePrefs = (patch: Partial<Prefs>) => setPrefs((old) => { const next = { ...old, ...patch }; savePrefs(next); return next })
  // Saved at once (not in a state updater), so a page that is closing still keeps it.
  const updateScorePrefs = (patch: Partial<ScorePrefs>) => {
    const next = { ...latest.current.scorePrefs, ...patch }
    latest.current.scorePrefs = next
    const id = latest.current.entry?.id
    if (id) saveScorePrefs(id, next)
    setScorePrefs(next)
  }
  // Where we are in the score is remembered whenever playback stops or moves, when another
  // score opens and when the page goes away.
  const rememberPosition = useRef(() => {})
  rememberPosition.current = () => {
    if (!p.timeline || !latest.current.entry) return
    const position = Math.round(p.time * 1000) / 1000
    if (Math.abs(position - latest.current.scorePrefs.position) > 1e-3) updateScorePrefs({ position })
  }

  const openSource = useCallback((next: ScoreEntry, data: ScoreSource, closeLibrary = true) => {
    rememberPosition.current()
    p.load(null)
    const saved = loadScorePrefs(next.id)
    latest.current = { ...latest.current, entry: next, scorePrefs: saved }
    setScorePrefs(saved)
    p.speed = saved.speed
    p.setVolumes(saved.volumes)
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
    const { entry: current, scorePrefs: sp, timeline: before, loop: kept } = latest.current
    const built = buildTimeline(sheet.Sheet, sp.transpose)
    // A newly opened score goes back to where it was left; a transposed one stays where it is.
    const range = before !== null ? kept : sp.loop
    p.load(built, before !== null ? p.time : sp.position)
    setTimeline(built)
    if (range) anchor.current = range[0]
    setLoop(range && range[1] < built.passes.length ? range : null, built)
    if (current && !current.builtIn) {
      const title = sheet.Sheet.TitleString?.trim(), composer = sheet.Sheet.ComposerString?.trim() ?? ''
      if ((title && title !== current.title) || composer !== current.composer) {
        const named = { ...current, title: title || current.title, composer }
        setEntry(named)
        void renameImported(named).then(listImported).then(setImported)
      }
    }
  }, [p])

  const setLoop = (range: [number, number] | null, t = latest.current.timeline) => {
    setLoopPasses(range)
    p.setLoop(range && t ? { start: t.passes[range[0]].time, end: t.passes[range[1]].end } : null)
    if (String(range) !== String(latest.current.scorePrefs.loop)) updateScorePrefs({ loop: range })
  }
  /** a loop the player chose: with Speed up loops from a set speed, it starts there */
  const startLoop = (range: [number, number]) => {
    setLoop(range)
    const { speedUp, speedUpFrom } = latest.current.prefs
    if (speedUp && speedUpFrom > 0) setSpeed(speedUpFrom)
  }
  const onPick = (time: number, pass: number, extend: boolean) => {
    if (extend) { startLoop([Math.min(anchor.current, pass), Math.max(anchor.current, pass)]); return }
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
    startLoop([i, i])
  }

  // Saved sections: named loops, kept per score in the order they come in the piece.
  const sections = scorePrefs.sections
  const activeSection = loop ? sections.findIndex((s) => s.first === loop[0] && s.last === loop[1]) : -1
  const saveSection = (name: string) => {
    if (!loop) return
    const kept = sections.filter((s) => s.first !== loop[0] || s.last !== loop[1])
    const next: Section[] = [...kept, { name, first: loop[0], last: loop[1] }]
    updateScorePrefs({ sections: next.sort((a, b) => a.first - b.first || a.last - b.last) })
  }
  const pickSection = (index: number) => {
    const s = sections[index]
    if (!s || !timeline || s.last >= timeline.passes.length) return
    anchor.current = s.first
    startLoop([s.first, s.last])
    p.seek(timeline.passes[s.first].time)
  }
  const stepSection = (direction: 1 | -1) => {
    if (!sections.length || !timeline) return
    const n = sections.length
    if (activeSection >= 0) { pickSection((activeSection + direction + n) % n); return }
    const here = passAt(timeline, p.time)
    const before = sections.filter((s) => s.first < here).length
    // ] the first section from this bar on, [ the last one before it; both wrap round.
    pickSection(direction > 0 ? (before < n ? before : 0) : (before > 0 ? before - 1 : n - 1))
  }
  const closeSections = useCallback(() => setSectionsOpen(false), [])

  const setSpeed = (speed: number) => { p.setSpeed(speed); updateScorePrefs({ speed: p.speed }) }
  // Speed up loops: each time round a step faster until the target; a faster speed is left alone.
  p.onLoop = () => {
    const { speedUp, speedUpStep, speedUpTo } = latest.current.prefs
    if (speedUp && p.speed < speedUpTo - 1e-6) setSpeed(Math.min(speedUpTo, p.speed + speedUpStep))
  }
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen?.().catch(() => {})
  }
  useEffect(() => {
    const changed = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', changed)
    return () => document.removeEventListener('fullscreenchange', changed)
  }, [])
  const closeSettings = useCallback(() => setSettingsOpen(false), [])

  // Drag the line between the sheet and the keys.
  const stage = useRef<HTMLElement>(null)
  const dragSplit = (e: React.PointerEvent) => {
    if (!(e.buttons & 1)) return
    const box = stage.current!.getBoundingClientRect()
    updatePrefs({ split: Math.max(0.2, Math.min(0.75, (box.bottom - e.clientY) / box.height)) })
  }
  const setHandVolume = (staff: number, volume: number) => {
    p.setVolume(staff, volume)
    updateScorePrefs({ volumes: Object.fromEntries(p.volumes) })
  }
  // The hand chips mute, and unmute back to the volume the hand had.
  const unmuted = useRef(new Map<number, number>())
  const toggleMute = (staff: number) => {
    const volume = p.volumeOf(staff)
    if (volume > 0) unmuted.current.set(staff, volume)
    setHandVolume(staff, volume > 0 ? 0 : unmuted.current.get(staff) ?? 1)
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
    p.onChange = () => { redraw(); if (!p.playing) rememberPosition.current() }
    engine.current!.onChange = redraw
    engine.current!.volume = latest.current.prefs.volume
    engine.current!.room = latest.current.prefs.room
    let frame = 0
    const tick = () => { if (p.playing) redraw(); frame = requestAnimationFrame(tick) }
    frame = requestAnimationFrame(tick)
    const hidden = () => { if (document.hidden) p.pause() }
    const leaving = () => rememberPosition.current()
    document.addEventListener('visibilitychange', hidden)
    window.addEventListener('pagehide', leaving)
    return () => { cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', hidden); window.removeEventListener('pagehide', leaving) }
  }, [p])
  useEffect(() => () => { p.dispose(); engine.current!.dispose() }, [p])
  useEffect(() => {
    p.metronome = prefs.metronome
    p.countIn = prefs.countIn
    p.countInLength = prefs.countInLength
    p.countInUnit = prefs.countInUnit
    p.countInLoops = prefs.countInLoops
  }, [p, prefs.metronome, prefs.countIn, prefs.countInLength, prefs.countInUnit, prefs.countInLoops])

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
      l: loopHere, '[': () => stepSection(-1), ']': () => stepSection(1), m: () => updatePrefs({ metronome: !prefs.metronome }), n: () => updatePrefs({ noteNames: !prefs.noteNames }),
      s: () => updatePrefs({ view: 'sheet' }), k: () => updatePrefs({ view: 'keys' }), b: () => updatePrefs({ view: 'both' }),
      f: toggleFullscreen, o: () => setLibraryOpen((v) => !v), '?': () => setHelp((v) => !v),
      Escape: () => { setHelp(false); setLibraryOpen(false); setSettingsOpen(false); setSectionsOpen(false) },
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
  const speed = Math.round(p.speed * 100)

  return <div className="app"
    onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDropping(true) } }}
    onDragLeave={(e) => { if (e.currentTarget === e.target) setDropping(false) }}
    onDrop={(e) => { e.preventDefault(); setDropping(false); void importFiles(e.dataTransfer.files) }}>
    <header className="topbar">
      <div className="brand" aria-hidden="true">
        <svg viewBox="0 0 32 32"><rect width="32" height="32" rx="8" /><path d="M7 9h18v14H7z" /><path d="M11.5 9h3v8h-3zM18 9h3v8h-3z" /></svg>
      </div>
      <button className="scores-button" onClick={() => setLibraryOpen(true)} title="Scores (O)">
        <Icon name="scores" /> Scores
      </button>
      <div className="score-title">
        <h1>{entry?.title ?? 'Fallboard'}</h1>
        <p>{entry?.composer || (entry?.file ?? '')}</p>
      </div>
      <div className="segmented" role="group" aria-label="View">
        {VIEWS.map(([value, label]) => <button key={value} className={prefs.view === value ? 'on' : ''} aria-pressed={prefs.view === value}
          title={`${label} (${label[0]})`} onClick={() => updatePrefs({ view: value })}>{label}</button>)}
      </div>
      <div className="segmented rows" role="group" aria-label="Rows" title="Rows of music (1–4)">
        <span className="label">Rows</span>
        {ROW_CHOICES.map((n) => <button key={n} className={prefs.rows === n ? 'on' : ''} aria-pressed={prefs.rows === n} disabled={prefs.view === 'keys'}
          aria-label={`${n} row${n > 1 ? 's' : ''}`} onClick={() => updatePrefs({ rows: n })}>{n}</button>)}
      </div>
      <div className="topbar-end">
        <button className="icon-button" onClick={toggleFullscreen} aria-label={fullscreen ? 'Leave full screen' : 'Full screen'} title="Full screen (F)">
          <Icon name={fullscreen ? 'shrink' : 'expand'} /></button>
        <button className="icon-button help-button" onClick={() => setHelp(true)} aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)">?</button>
      </div>
    </header>

    <main ref={stage} className={`stage view-${prefs.view}`} style={{ '--keys': `${prefs.split * 100}%` } as React.CSSProperties}>
      <section className="sheet-pane" aria-label="Sheet music" hidden={prefs.view === 'keys'}>
        <SheetView source={source?.data ?? null} sourceKey={source?.key ?? ''} rows={prefs.rows} theme={prefs.theme}
          transpose={scorePrefs.transpose} timeline={timeline} time={time} playing={p.playing} loop={loop}
          onLoaded={onLoaded} onError={(text) => setMessage({ text, error: true })} onPick={onPick} />
      </section>
      {prefs.view === 'both' && <div className="divider" role="separator" aria-orientation="horizontal" aria-label="Drag to resize the keys"
        title="Drag to resize · double-click to reset"
        onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)} onPointerMove={dragSplit}
        onDoubleClick={() => updatePrefs({ split: 0.42 })}><span /></div>}
      {prefs.view !== 'sheet' && <section className="keys-pane" aria-label="Keys">
        <KeysView timeline={timeline} time={time} names={prefs.noteNames} muted={muted} pressed={pressed} onPress={(n) => void press(n)} onRelease={release} />
      </section>}

      {(message || status) && <div className={`message${message?.error || p.error ? ' error' : ''}`} role="status" data-testid="message">
        <span>{message?.text || status}</span>
        {message && <button className="icon-button" aria-label="Dismiss" onClick={() => setMessage(null)}><Icon name="close" size={16} /></button>}
      </div>}
      {p.state === 'countIn' && <div className="count-overlay" aria-hidden="true" key={p.countRemaining}>{p.countRemaining}</div>}
    </main>

    <footer className="dock">
      <Scrubber timeline={timeline} time={time} loop={loopTimes} onSeek={(t) => { if (loopTimes && (t < loopTimes.start || t >= loopTimes.end)) setLoop(null); p.seek(t) }} />
      <div className="dock-row">
        <div className="dock-start">
          <div className="position" data-testid="position">
            <strong>{pass ? (pass.number === 0 ? 'Pickup' : `Bar ${pass.number}`) : '—'}</strong>
            <span>{lastBar ? `of ${lastBar}` : ''}{pass ? ` · ${Math.round(pass.bpm * p.speed)} BPM` : ''}</span>
          </div>
          {timeline && timeline.staves.length > 1 && <div className="hands" role="group" aria-label="Staves to hear">
            {timeline.staves.map((s) => {
              const volume = Math.round(p.volumeOf(s.index) * 100)
              return <button key={s.index} className={`hand staff-${Math.min(s.index, 2)}${muted.has(s.index) ? ' muted' : ' on'}`}
                aria-pressed={!muted.has(s.index)} title={muted.has(s.index) ? 'Muted: click to hear it' : 'Click to mute (the volume is in Settings)'}
                onClick={() => toggleMute(s.index)}><i aria-hidden="true" />{s.name}{volume > 0 && volume < 100 && <small aria-hidden="true">{volume}%</small>}</button>
            })}
          </div>}
        </div>

        <div className="transport">
          <button className="icon-button" onClick={() => p.stop()} title="Back to the start (Home)" aria-label="Back to the start"><Icon name="restart" /></button>
          <button className="icon-button" onClick={() => stepBar(-1)} disabled={!timeline} title="Previous bar (←)" aria-label="Previous bar"><Icon name="previous" /></button>
          <button className={`play${p.playing ? ' playing' : ''}`} onClick={() => p.toggle()} disabled={!timeline} title="Play / pause (Space)" aria-label={p.playing ? 'Pause' : 'Play'}>
            <Icon name={p.playing ? 'pause' : 'play'} size={26} />
          </button>
          <button className="icon-button" onClick={() => stepBar(1)} disabled={!timeline} title="Next bar (→)" aria-label="Next bar"><Icon name="next" /></button>
          <button className={`loop-button${loop ? ' on' : ''}`} aria-pressed={!!loop} onClick={loopHere} title="Loop this bar (L). Shift+click another bar to stretch the loop.">
            <Icon name="loop" />
            <span>{activeSection >= 0 ? sections[activeSection].name : loop && timeline ? loopLabel(timeline.passes[loop[0]].number, timeline.passes[loop[1]].number) : 'Loop'}</span>
            {loop && p.repeats > 0 && <em aria-hidden="true">×{p.repeats + 1}</em>}
          </button>
          <div className="settings-anchor">
            <button className={`icon-button${sectionsOpen ? ' on' : ''}`} data-sections-toggle aria-expanded={sectionsOpen} aria-label="Sections"
              title="Saved sections ([ ])" disabled={!timeline} onClick={() => setSectionsOpen((v) => !v)}><Icon name="sections" /></button>
            {sectionsOpen && timeline && <Sections sections={sections} active={activeSection} label={(s) => barsLabel(timeline, s.first, s.last)}
              loop={loop ? { name: barsLabel(timeline, loop[0], loop[1]), first: loop[0], last: loop[1] } : null}
              onSave={saveSection} onPick={pickSection} onClose={closeSections}
              onRename={(i, name) => updateScorePrefs({ sections: sections.map((s, j) => j === i ? { ...s, name } : s) })}
              onDelete={(i) => updateScorePrefs({ sections: sections.filter((_, j) => j !== i) })} />}
          </div>
        </div>

        <div className="dock-end">
          <label className="speed" title="Speed (↑ ↓)">
            <span className="label">Speed</span>
            <input type="range" min={25} max={200} step={5} value={speed} aria-label="Speed"
              style={{ '--fill': `${((speed - 25) / 175) * 100}%` } as React.CSSProperties}
              onChange={(e) => setSpeed(Number(e.target.value) / 100)} />
            <output className={speed !== 100 ? 'changed' : ''}>{speed}%</output>
          </label>
          <button className={`chip${prefs.metronome ? ' on' : ''}`} aria-pressed={prefs.metronome} onClick={() => updatePrefs({ metronome: !prefs.metronome })} title="Metronome (M)">
            <Icon name="metronome" size={16} />Metronome</button>
          <button className={`chip${prefs.countIn ? ' on' : ''}`} aria-pressed={prefs.countIn} onClick={() => updatePrefs({ countIn: !prefs.countIn })} title={`Count ${countInText(prefs)} in before playing (the length is in Settings)`}>Count-in</button>
          <div className="settings-anchor">
            <button className={`icon-button${settingsOpen ? ' on' : ''}`} data-settings-toggle aria-expanded={settingsOpen} aria-label="Settings" title="Settings"
              onClick={() => setSettingsOpen((v) => !v)}><Icon name="settings" /></button>
            {settingsOpen && <Settings prefs={prefs} transpose={scorePrefs.transpose} speed={p.speed} onPrefs={updatePrefs} onClose={closeSettings}
              staves={timeline && timeline.staves.length > 1 ? timeline.staves : []} handVolume={(staff) => p.volumeOf(staff)} onHandVolume={setHandVolume}
              onTranspose={(transpose) => updateScorePrefs({ transpose })} onSpeed={setSpeed}
              onVolume={(v) => { engine.current!.volume = v; updatePrefs({ volume: v }) }}
              onRoom={(room) => { engine.current!.room = room; updatePrefs({ room }) }} />}
          </div>
        </div>
      </div>
    </footer>

    {libraryOpen && <Library current={entry?.id ?? ''} builtIn={BUILT_IN} imported={imported} onOpen={(e) => void open(e)}
      onImport={(files) => void importFiles(files)} onClose={() => setLibraryOpen(false)}
      onDelete={(e) => void deleteImported(e.id).then(listImported).then((list) => {
        setImported(list)
        if (entry?.id === e.id) void open(BUILT_IN[0], false)
      })} />}

    {help && <div className="backdrop center" onClick={() => setHelp(false)}>
      <div className="help" role="dialog" aria-label="Keyboard shortcuts" onClick={(e) => e.stopPropagation()}>
        <header><h2>Keyboard shortcuts</h2><button className="icon-button" aria-label="Close shortcuts" onClick={() => setHelp(false)}><Icon name="close" /></button></header>
        <dl>{SHORTCUTS.map(([k, v]) => <div key={k}><dt>{k.split(' · ').map((part) => <kbd key={part}>{part}</kbd>)}</dt><dd>{v}</dd></div>)}</dl>
        <p className="hint">Click a note in the music to jump there. Click the keys to hear them. Drag the line above the keys to resize them.
          Sound: Salamander Grand Piano by Alexander Holm (<a href="https://creativecommons.org/licenses/by/3.0/">CC BY 3.0</a>).
          {' '}{timeline ? `This piece lasts ${clock(timeline.end)} at 100 %.` : ''}</p>
      </div>
    </div>}

    {dropping && <div className="drop-overlay" aria-hidden="true">
      <Icon name="upload" size={40} /><span>Drop a score to open it</span><small>MusicXML · .mxl · MuseScore .mscz</small>
    </div>}
  </div>
}
