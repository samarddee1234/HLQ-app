const PATHS = {
  home: 'M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  check: 'M4 12l5 5L20 6',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5',
  users: 'M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0zM4 21c0-4 4-6 8-6s8 2 8 6',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  chat: 'M4 5h16v11H9l-5 4z',
  bell: 'M6 9a6 6 0 1 1 12 0c0 5 2 6 2 7H4c0-1 2-2 2-7zM10 20a2 2 0 0 0 4 0',
  dots: 'M5 12h.01M12 12h.01M19 12h.01',
  mail: 'M3 6h18v12H3zM3 7l9 7 9-7',
  logout: 'M9 21H5V3h4M16 17l5-5-5-5M21 12H9',
  compass: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM15 9l-2 5-5 1 2-5z',
}

export default function Icon({ name, size = 20 }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={name === 'dots' ? 3 : 2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    >
      <path d={PATHS[name] ?? PATHS.home} />
    </svg>
  )
}
