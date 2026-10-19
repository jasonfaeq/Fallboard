import type { StageScene } from '../reader/prefs'

const SCENES: [StageScene, string][] = [['studio', 'Walnut studio'], ['hall', 'Moonlit hall'], ['velvet', 'Velvet room']]

export function StageScenePicker({ scene, onScene }: { scene: StageScene; onScene: (scene: StageScene) => void }) {
  return <div className="stage-scene-picker" role="group" aria-label="Stage scene">
    <span>Scene</span>
    {SCENES.map(([value, label]) => <button key={value} aria-pressed={scene === value} onClick={() => onScene(value)}>
      <i className={`scene-swatch ${value}`} aria-hidden="true" />{label}
    </button>)}
  </div>
}

/** Original CSS architecture behind the notes, with no images or independent animation. */
export default function StageRoom() {
  return <div className="stage-room" aria-hidden="true">
    <div className="room-panels" /><div className="room-arch"><i /></div><div className="room-sconce" />
    <div className="room-horizon" />
  </div>
}
