import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'

// รายชื่อนักเรียนที่ลงทะเบียนแล้วในกลุ่มของมูร๊อบบีย์ (RLS จำกัดให้เห็นเฉพาะกลุ่มตัวเอง)
export function useStudents(groupId) {
  const [state, setState] = useState({ students: [], loading: !!groupId, error: '' })
  useEffect(() => {
    if (!groupId) return
    let alive = true
    supabase.from('profiles').select('id,full_name,grade,class_room,gender')
      .eq('group_id', groupId).eq('role', 'student').eq('registered', true).order('full_name')
      .then(({ data, error }) => {
        if (alive) setState({ students: data ?? [], loading: false, error: error?.message ?? '' })
      })
    return () => { alive = false }
  }, [groupId])
  return state
}
