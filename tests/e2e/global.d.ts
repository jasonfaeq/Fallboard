import type { OpenSheetMusicDisplay } from 'opensheetmusicdisplay'
import type { Engine } from '../../src/engine/audio'
import type { Player } from '../../src/reader/player'
import type { Timeline } from '../../src/reader/timeline'

declare global {
  interface Window {
    __piano: { engine: Engine; player: Player; timeline: Timeline | null; osmd: OpenSheetMusicDisplay | null }
  }
}
