// The sheet music, drawn by OpenSheetMusicDisplay (D-21). The zoom is chosen so that exactly
// `rows` lines of music fill the panel; 1 row is a single endless line that scrolls sideways.
// While playing, the current line stays at the top, the playhead glides through it and the
// sounding notes light up in their hand's colour.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { OpenSheetMusicDisplay, PointF2D, TransposeCalculator, unitInPixels, type MusicSystem, type VexFlowGraphicalNote } from 'opensheetmusicdisplay'
import { indexAt, type Timeline } from '../reader/timeline'
import type { ScoreSource } from '../reader/library'

interface Props {
  source: ScoreSource | null
  sourceKey: string
  rows: number
  theme: 'paper' | 'night'
  transpose: number
  timeline: Timeline | null
  time: number
  playing: boolean
  /** the looped passes, first and last index into timeline.passes */
  loop: [number, number] | null
  onLoaded: (osmd: OpenSheetMusicDisplay) => void
  onError: (message: string) => void
  /** a click on the music: the time of the clicked note and its pass */
  onPick: (time: number, pass: number, extend: boolean) => void
}

/** one line of music, in px inside the scrolled content */
interface Row { top: number; staffTop: number; staffBottom: number }
interface Layout {
  scale: number
  rows: Row[]
  /** per timeline step */
  anchors: { x: number; row: number }[]
  /** per measure index */
  boxes: Map<number, { x: number; width: number; row: number }>
  /** per timeline mark: the SVG group of its printed note */
  marks: (Element | null)[]
  /** how long the longest mark lasts, to bound the search for sounding notes */
  longest: number
}

const STAFF_HEIGHT = 4
/** OSMD units above the first line of music (one unit is the gap between two staff lines) */
const TOP_MARGIN = 2
// Four rows still need to fit when the desk heading and practice dock share the window.
const MIN_ZOOM = 0.25
const MAX_ZOOM = 2.4
const INK = { paper: { music: '#17140f', lines: '#4a443b' }, night: { music: '#ece6d8', lines: '#8e88a5' } }

const systemsOf = (osmd: OpenSheetMusicDisplay) => osmd.GraphicSheet.MusicPages.flatMap((p) => p.MusicSystems)
function staffExtent(system: MusicSystem) {
  const lines = system.StaffLines
  return { top: lines[0].PositionAndShape.AbsolutePosition.y, bottom: lines[lines.length - 1].PositionAndShape.AbsolutePosition.y + STAFF_HEIGHT }
}
/** the height one line of music needs, in OSMD units: the span of the first `rows` lines */
function rowPitch(osmd: OpenSheetMusicDisplay, rows: number) {
  const systems = systemsOf(osmd).map(staffExtent)
  if (!systems.length) return 20
  if (rows === 1 || systems.length < 2) return systems[0].bottom - systems[0].top + 10
  const n = Math.min(rows, systems.length - 1)
  return (systems[n].top - systems[0].top) / n
}

export default function SheetView(props: Props) {
  const { source, sourceKey, rows, theme, transpose, timeline, time, playing, loop } = props
  const viewport = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const host = useRef<HTMLDivElement>(null)
  const playhead = useRef<HTMLDivElement>(null)
  const osmdRef = useRef<OpenSheetMusicDisplay | null>(null)
  const loaded = useRef('')
  /** the score whose layout is on screen; empty until the first render after a load */
  const rendered = useRef('')
  const shownTranspose = useRef(0)
  const lit = useRef(new Map<Element, string>())
  const scrolledRow = useRef(-1)
  const callbacks = useRef(props)
  callbacks.current = props
  const [layout, setLayout] = useState<Layout | null>(null)
  const [busy, setBusy] = useState('')
  const [drawn, setDrawn] = useState(0)
  const single = rows === 1

  /** Render at the zoom where `rows` lines fill the panel. Skipped while the panel is hidden. */
  const draw = () => {
    const { rows, theme } = callbacks.current
    const single = rows === 1
    const osmd = osmdRef.current
    const view = viewport.current
    if (!osmd || !loaded.current || !view || view.clientWidth < 60 || view.clientHeight < 60) return false
    const ink = INK[theme]
    const rules = osmd.EngravingRules
    rules.DefaultColorMusic = rules.DefaultColorNotehead = rules.DefaultColorStem = rules.DefaultColorRest = ink.music
    rules.DefaultColorLabel = rules.DefaultColorTitle = rules.DefaultColorLyrics = rules.DefaultColorChordSymbol = ink.music
    rules.StaffLineColor = rules.LedgerLineColorDefault = ink.lines
    osmd.setOptions({ renderSingleHorizontalStaffline: single })
    const height = view.clientHeight - 6
    osmd.render()
    for (let i = 0; i < 4; i++) {
      const want = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, height / (rows * rowPitch(osmd, rows) * unitInPixels)))
      if (Math.abs(want - osmd.zoom) / osmd.zoom < 0.015) break
      osmd.zoom = want
      osmd.render()
    }
    rendered.current = loaded.current
    lit.current.clear()
    scrolledRow.current = -1
    setDrawn((n) => n + 1)
    return true
  }

  useEffect(() => {
    const osmd = new OpenSheetMusicDisplay(host.current!, {
      backend: 'svg', autoResize: false, pageFormat: 'Endless', drawingParameters: 'compact',
      drawTitle: false, drawSubtitle: false, drawComposer: false, drawLyricist: false, drawCredits: false,
      disableCursor: true, followCursor: false, drawPartNames: false,
    })
    osmd.setLogLevel('warn')
    // Compact mode puts the first line at the very top of the SVG, and OSMD measures text a little
    // short, so a tempo mark above the first line lost its top edge. Leave room for it.
    osmd.EngravingRules.PageTopMarginNarrow = TOP_MARGIN
    osmd.TransposeCalculator = new TransposeCalculator()
    osmdRef.current = osmd
    return () => { osmd.clear(); osmdRef.current = null }
  }, [])

  // Open a new score.
  useEffect(() => {
    const osmd = osmdRef.current
    if (!osmd || !source) return
    let cancelled = false
    loaded.current = ''
    rendered.current = ''
    setLayout(null)
    setBusy('Opening the score…')
    // Let the "Opening" message paint before the synchronous layout work starts.
    const timer = setTimeout(() => {
      osmd.load(source).then(() => {
        if (cancelled) return
        if (!osmd.Sheet?.SourceMeasures.length) throw new Error('The file has no measures.')
        loaded.current = sourceKey
        osmd.setOptions({ drawPartNames: osmd.Sheet.Instruments.length > 1 })
        osmd.Sheet.Transpose = callbacks.current.transpose
        shownTranspose.current = callbacks.current.transpose
        if (callbacks.current.transpose) osmd.updateGraphic()
        callbacks.current.onLoaded(osmd)
        draw()
      }).catch((e: unknown) => {
        if (!cancelled) callbacks.current.onError(`Could not read this score: ${e instanceof Error ? e.message : String(e)}`)
      }).finally(() => { if (!cancelled) setBusy('') })
    }, 30)
    return () => { cancelled = true; clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey])

  // Transposing changes the printed notes and the pitches that sound.
  useEffect(() => {
    const osmd = osmdRef.current
    if (!osmd || !loaded.current || shownTranspose.current === transpose) return
    shownTranspose.current = transpose
    osmd.Sheet.Transpose = transpose
    osmd.updateGraphic()
    callbacks.current.onLoaded(osmd)
    draw()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transpose])

  // Rows, colours or panel size changed: lay the music out again.
  useEffect(() => { draw() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [rows, theme])
  useEffect(() => {
    // Watch the frame, not the scrolling viewport: a scrollbar appearing after a render shrinks
    // the viewport, and re-fitting to that could remove the scrollbar again, over and over.
    const frame = viewport.current!.parentElement!
    let size = `${frame.clientWidth}x${frame.clientHeight}`
    let timer: ReturnType<typeof setTimeout> | undefined
    const observer = new ResizeObserver(() => {
      const now = `${frame.clientWidth}x${frame.clientHeight}`
      if (now === size) return
      size = now
      clearTimeout(timer)
      timer = setTimeout(() => draw(), 200)
    })
    observer.observe(frame)
    return () => { observer.disconnect(); clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, theme, single])

  // Measure where everything landed: lines, note x positions per cursor step, measure boxes, note heads.
  useLayoutEffect(() => {
    const osmd = osmdRef.current
    const svg = host.current?.querySelector('svg')
    if (!osmd || !timeline || !svg || !loaded.current || rendered.current !== loaded.current) { setLayout(null); return }
    try { measureLayout(osmd, svg, timeline) } catch { setLayout(null) }
  }, [timeline, drawn])

  function measureLayout(osmd: OpenSheetMusicDisplay, svg: SVGSVGElement, timeline: Timeline) {
    const graphic = osmd.GraphicSheet
    const base = content.current!.getBoundingClientRect()
    const box = svg.getBoundingClientRect()
    const dx = box.left - base.left, dy = box.top - base.top
    const scale = unitInPixels * osmd.zoom
    const systems = systemsOf(osmd)
    const extents = systems.map(staffExtent)
    const rowsPx: Row[] = extents.map((e, i) => {
      const above = i > 0 ? (e.top - extents[i - 1].bottom) / 2 : Math.min(e.top, i + 1 < extents.length ? (extents[i + 1].top - e.bottom) / 2 : 5)
      return { top: dy + (e.top - above) * scale, staffTop: dy + e.top * scale, staffBottom: dy + e.bottom * scale }
    })
    const anchors = timeline.steps.map((step) => {
      const [x, system] = graphic.calculateXPositionFromTimestamp(step.at) ?? [0, undefined]
      return { x: dx + (x ?? 0) * scale, row: Math.max(0, system ? systems.indexOf(system) : 0) }
    })
    const boxes = new Map<number, { x: number; width: number; row: number }>()
    graphic.MeasureList.forEach((staves, index) => {
      const measure = staves?.find(Boolean)
      if (!measure?.ParentMusicSystem) return
      const shape = measure.PositionAndShape
      boxes.set(index, { x: dx + shape.AbsolutePosition.x * scale, width: shape.Size.width * scale, row: systems.indexOf(measure.ParentMusicSystem) })
    })
    const marks = timeline.marks.map((mark) => {
      try {
        const entry = graphic.findGraphicalStaffEntryFromMeasureList(mark.staff, mark.measure, mark.entry)
        const note = (entry?.findGraphicalNoteFromNote(mark.note) ?? entry?.findGraphicalNoteFromGraceNote(mark.note)) as VexFlowGraphicalNote | undefined
        return note?.getSVGGElement?.() ?? null
      } catch { return null }
    })
    const longest = timeline.marks.reduce((max, m) => Math.max(max, m.end - m.time), 0)
    lit.current.clear()
    setLayout({ scale, rows: rowsPx, anchors, boxes, marks, longest })
    const view = viewport.current!
    view.dataset.zoom = osmd.zoom.toFixed(3)
    view.dataset.systems = String(systems.length)
  }

  // Every frame: move the playhead, light the sounding notes, keep the current line in view.
  useLayoutEffect(() => {
    const view = viewport.current
    const head = playhead.current
    if (!layout || !timeline || !view || !head || !timeline.steps.length) { if (head) head.style.display = 'none'; return }
    const { steps, passes, marks } = timeline
    const i = Math.max(0, indexAt(steps, time))
    const step = steps[i], anchor = layout.anchors[i]
    const next = steps[i + 1], nextAnchor = layout.anchors[i + 1]
    let x = anchor.x
    if (time > step.time) {
      if (next && nextAnchor.row === anchor.row && nextAnchor.x > anchor.x) {
        x += (nextAnchor.x - anchor.x) * Math.min(1, (time - step.time) / (next.time - step.time))
      } else {
        const box = layout.boxes.get(step.measure)
        const end = box ? box.x + box.width - 4 : anchor.x
        const passEnd = passes[step.pass].end
        if (passEnd > step.time && end > anchor.x) x += (end - anchor.x) * Math.min(1, (time - step.time) / (passEnd - step.time))
      }
    }
    const row = layout.rows[anchor.row]
    head.style.display = 'block'
    head.style.transform = `translate(${x - 1}px, ${row.staffTop - 10}px)`
    head.style.height = `${row.staffBottom - row.staffTop + 20}px`
    view.dataset.row = String(anchor.row)

    // Light the notes that sound now (chords share one SVG group, so collect per element).
    const want = new Map<Element, string>()
    for (let m = indexAt(marks, time); m >= 0 && marks[m].time >= time - layout.longest - 1e-6; m--) {
      const mark = marks[m], el = layout.marks[m]
      if (el && mark.end > time + 1e-6 && !want.has(el)) want.set(el, `lit-${Math.min(mark.staff, 2)}`)
    }
    for (const [el, cls] of lit.current) if (want.get(el) !== cls) el.classList.remove(cls)
    for (const [el, cls] of want) if (lit.current.get(el) !== cls) el.classList.add(cls)
    lit.current = want

    if (single) {
      // One line: keep it vertically centred, and glide sideways with the playhead.
      const middle = (row.staffTop + row.staffBottom) / 2 - view.clientHeight / 2
      if (Math.abs(view.scrollTop - Math.max(0, middle)) > 2 && !playing) view.scrollTop = Math.max(0, middle)
      const target = x - view.clientWidth * 0.3
      if (playing) view.scrollLeft = target
      else if (x < view.scrollLeft + 20 || x > view.scrollLeft + view.clientWidth - 20) view.scrollTo({ left: target, behavior: 'smooth' })
    } else if (playing) {
      if (scrolledRow.current !== anchor.row) {
        scrolledRow.current = anchor.row
        view.scrollTo({ top: row.top, behavior: 'smooth' })
      }
    } else {
      scrolledRow.current = -1
      if (row.staffTop < view.scrollTop || row.staffBottom > view.scrollTop + view.clientHeight) view.scrollTo({ top: row.top, behavior: 'smooth' })
    }
  }, [time, layout, playing, single, timeline])

  const pick = (e: React.MouseEvent) => {
    const osmd = osmdRef.current
    const svg = host.current?.querySelector('svg')
    if (!osmd || !svg || !timeline || !layout) return
    const box = svg.getBoundingClientRect()
    const point = new PointF2D((e.clientX - box.left) / layout.scale, (e.clientY - box.top) / layout.scale)
    const entry = osmd.GraphicSheet.GetNearestStaffEntry(point)
    if (!entry) return
    const measure = osmd.Sheet.SourceMeasures.indexOf(entry.parentMeasure.parentSourceMeasure)
    const at = entry.getAbsoluteTimestamp().RealValue
    // A repeated measure is played more than once: pick the pass nearest to where we are.
    let best = -1
    timeline.steps.forEach((step, i) => {
      if (step.measure !== measure || Math.abs(step.at.RealValue - at) > 1e-6) return
      if (best < 0 || Math.abs(step.time - time) < Math.abs(timeline.steps[best].time - time)) best = i
    })
    if (best >= 0) props.onPick(timeline.steps[best].time, timeline.steps[best].pass, e.shiftKey)
  }

  const loopBoxes: { x: number; width: number; row: number }[] = []
  if (layout && loop && timeline) {
    const measures = new Set(timeline.passes.slice(loop[0], loop[1] + 1).map((p) => p.measure))
    for (const m of measures) { const b = layout.boxes.get(m); if (b) loopBoxes.push(b) }
  }

  return <div className={`sheet-frame sheet-${theme}`}>
    <div className={`sheet${single ? ' single' : ''}`} ref={viewport} data-testid="sheet">
    <div className="sheet-content" ref={content} onClick={pick}>
      <div className="osmd-host" ref={host} />
      {loopBoxes.map((b, i) => {
        const row = layout!.rows[b.row]
        return <div key={i} className="loop-box" style={{ left: b.x, top: row.staffTop - 14, width: b.width, height: row.staffBottom - row.staffTop + 28 }} />
      })}
      <div className="playhead" ref={playhead} aria-hidden="true" />
    </div>
    </div>
    {busy && <div className="sheet-busy" role="status">{busy}</div>}
  </div>
}
