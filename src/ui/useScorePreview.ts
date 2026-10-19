import { useCallback, useEffect, useRef, useState } from 'react'
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay'
import type { Engine } from '../engine/audio'
import { Player } from '../reader/player'
import { buildTimeline } from '../reader/timeline'
import { BUILT_IN, loadImported, sourceFrom, type ScoreEntry } from '../reader/library'

/** A short, explicit audition. The main player's score, speed, loop and place are untouched. */
export function useScorePreview(engine: Engine, main: Player, enabled: boolean) {
  const player = useRef<Player>()
  player.current ??= new Player(engine)
  const request = useRef(0)
  const [state, setState] = useState({ id: '', loading: false, error: '' })
  const stop = useCallback(() => {
    request.current++
    // The two players share the engine's transport. An idle preview must not stop
    // the main score when the library closes without having auditioned anything.
    if (player.current!.timeline) player.current!.load(null)
    setState({ id: '', loading: false, error: '' })
  }, [])
  useEffect(() => { if (!enabled) stop() }, [enabled, stop])
  useEffect(() => {
    const hidden = () => { if (document.hidden) stop() }
    document.addEventListener('visibilitychange', hidden)
    return () => document.removeEventListener('visibilitychange', hidden)
  }, [stop])
  useEffect(() => () => { request.current++; player.current!.dispose() }, [])
  const start = async (entry: ScoreEntry) => {
    if (state.id === entry.id) { stop(); return }
    stop(); main.pause()
    const token = ++request.current
    setState({ id: entry.id, loading: true, error: '' })
    const osmd = new OpenSheetMusicDisplay(document.createElement('div'), { backend: 'svg', autoResize: false, drawTitle: false })
    try {
      const builtIn = BUILT_IN.find((score) => score.id === entry.id)
      const data = builtIn ? builtIn.xml : await loadImported(entry.id)
      if (!data) throw new Error('The score could not be read from this browser.')
      await osmd.load(typeof data === 'string' ? data : sourceFrom(data))
      if (token !== request.current) return
      const timeline = buildTimeline(osmd.Sheet, 0)
      const at = timeline.sounds[0]?.time ?? 0
      player.current!.load(timeline, at)
      player.current!.onEnded = () => { if (token === request.current) stop() }
      await player.current!.play(Math.min(timeline.end, at + 8))
      if (token !== request.current) return
      if (player.current!.error) throw new Error(player.current!.error)
      setState({ id: entry.id, loading: false, error: '' })
    } catch (error) {
      if (token === request.current) { player.current!.load(null); setState({ id: '', loading: false, error: `Preview unavailable: ${(error as Error).message}` }) }
    } finally { osmd.clear() }
  }
  return { ...state, start, stop }
}
