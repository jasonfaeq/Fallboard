// Line icons for the toolbar and dock, drawn on a 24-unit grid in the current text colour.
const PATHS = {
  scores: 'M4 5.5h10M4 10h10M4 14.5h6M17 4v11.2a2.3 2.3 0 1 1-1.6-2.2V4.6L20 3.5',
  restart: 'M6 5v14M19 5.5 9.5 12l9.5 6.5z',
  previous: 'M15 6l-6 6 6 6',
  next: 'M9 6l6 6-6 6',
  loop: 'M17 3.5 20 6.5l-3 3M4 11.5v-1a4 4 0 0 1 4-4h12M7 20.5 4 17.5l3-3M20 12.5v1a4 4 0 0 1-4 4H4',
  metronome: 'M9.2 3.5h5.6L19 20.5H5zM12 15.5 16.8 6M7.5 15.5h9',
  settings: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 4.5v5M9 14.5v5',
  expand: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  shrink: 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5',
  close: 'M6 6l12 12M18 6 6 18',
  search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.5 15.5 20 20',
  upload: 'M12 15.5V4M7.5 8.5 12 4l4.5 4.5M4.5 15v3.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V15',
  trash: 'M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10.5 11v5.5M13.5 11v5.5',
  volume: 'M4 9.5v5h3.5L12 19V5L7.5 9.5zM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11',
  keyboard: 'M3.5 5.5h17v13h-17zM8 5.5v8M12 5.5v8M16 5.5v8M6.5 13.5h3M10.5 13.5h3M14.5 13.5h3',
} as const

export type IconName = keyof typeof PATHS | 'play' | 'pause'

export default function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  if (name === 'play') return <svg className="ico" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M8 4.8v14.4a1 1 0 0 0 1.5.86l11.7-7.2a1 1 0 0 0 0-1.72L9.5 3.94A1 1 0 0 0 8 4.8z" fill="currentColor" /></svg>
  if (name === 'pause') return <svg className="ico" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <rect x="6" y="4.5" width="4" height="15" rx="1.2" fill="currentColor" /><rect x="14" y="4.5" width="4" height="15" rx="1.2" fill="currentColor" /></svg>
  return <svg className="ico" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={PATHS[name]} /></svg>
}
