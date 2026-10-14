import type { Input, NoteEvent } from '../../src/engine/input'
import type { Engine } from '../../src/engine/audio'
import type { PiecePlayer } from '../../src/game/player'

declare global {
  interface Window {
    __piano: { input: Input; engine: Engine; player: PiecePlayer; send: (e: NoteEvent) => void }
  }
}
