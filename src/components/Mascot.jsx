// มาสคอตเรขาคณิตน่ารัก: ใบหน้ากลมสวมพระจันทร์เสี้ยวและดาว ใช้สีตามธีม
export default function Mascot({ size = 96, label = 'มาสคอตสายใยสามารถดี' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" role="img" aria-label={label} className="mascot">
      <circle cx="60" cy="68" r="40" fill="var(--sky-2)" stroke="var(--blue)" strokeWidth="3" />
      <path d="M30 26a15 15 0 1 0 0 26a12 12 0 1 1 0-26z" fill="var(--accent)" />
      <path d="M92 14l3.6 7.6 8.2 1-6 5.8 1.6 8.2-7.4-4-7.4 4 1.6-8.2-6-5.8 8.2-1z" fill="var(--peach)" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round" />
      <ellipse cx="46" cy="66" rx="4.2" ry="5.2" fill="var(--navy)" />
      <ellipse cx="74" cy="66" rx="4.2" ry="5.2" fill="var(--navy)" />
      <circle cx="37" cy="78" r="6" fill="#f8b9d4" opacity=".7" />
      <circle cx="83" cy="78" r="6" fill="#f8b9d4" opacity=".7" />
      <path d="M50 80q10 9 20 0" fill="none" stroke="var(--navy)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
