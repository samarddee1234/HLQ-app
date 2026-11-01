import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'

// ตัวเลขแดงบนแท็บ: ข้อความนิรนามใหม่ (มูร๊อบบีย์ = ของกลุ่มตัวเอง, แอดมิน = ที่ส่งถึงส่วนกลาง)
export function useBadges(profile) {
  const [vent, setVent] = useState(0)
  useEffect(() => {
    if (!['murabbi', 'admin'].includes(profile.role)) return
    let alive = true
    const load = async () => {
      let q = supabase.from('anonymous_messages').select('id', { count: 'exact', head: true }).eq('status', 'new')
      if (profile.role === 'admin') q = q.eq('audience', 'admin')
      const { count } = await q
      if (alive) setVent(count ?? 0)
    }
    load()
    const t = setInterval(load, 2 * 60 * 1000)
    const vis = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', vis)
    return () => { alive = false; clearInterval(t); document.removeEventListener('visibilitychange', vis) }
  }, [profile.id, profile.role])
  return { vent }
}
