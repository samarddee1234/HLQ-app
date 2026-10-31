import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase.js'
import { GENDERS, GRADES } from '../lib.js'

const CATEGORIES = ['กลุ่มนำ', 'กลุ่มพัฒนา', 'กลุ่มใส่ใจ', 'กลุ่มใกล้ชิด']

export default function Register({ profile, onDone }) {
  const [groups, setGroups] = useState([])
  const [form, setForm] = useState({
    requested_role: 'student',
    full_name: '',
    gender: '',
    grade: '',
    category: '',
    batch: '',        // <--- เพิ่มบรรทัดนี้ลงไป
    group_id: '',
    phone: '',
    facebook: '',
  })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase
      .from('groups')
      .select('id, name, gender, category, grade, murabbi_1, murabbi_2, stage')
      .order('id')
      .then(({ data, error }) => {
        if (!error && data) setGroups(data)
      })
  }, [])

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const isMurabbi = form.requested_role === 'murabbi'
  const isAlumni = form.requested_role === 'alumni'

  // กรองกลุ่มตาม เพศ, ระดับชั้น และ สายกลุ่ม ที่นักเรียนเลือก
  const filteredGroups = useMemo(() => {
    if (isMurabbi) return groups
    return groups.filter((g) => {
      const matchGender = !form.gender || g.gender === form.gender
      const matchGrade = !form.grade || g.grade === form.grade
      const matchCat = !form.category || g.category === form.category
      return matchGender && matchGrade && matchCat
    })
  }, [groups, isMurabbi, form.gender, form.grade, form.category])

  async function submit(e) {
    e.preventDefault()
    setErr('')
    if (!isMurabbi && !form.gender) return setErr('กรุณาเลือกเพศ')
    if (!isMurabbi && !isAlumni && !form.grade) return setErr('กรุณาเลือกระดับชั้น')
if (!isMurabbi && !isAlumni && !form.group_id) return setErr('กรุณาเลือกกลุ่มฮาลาเกาะฮ์')
    if (isAlumni && !form.batch) return setErr('กรุณากรอกรุ่นที่')

    setBusy(true)
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: form.full_name.trim(),
        gender: form.gender || null,
        grade: isMurabbi || isAlumni ? null : form.grade,
        batch: isAlumni ? Number(form.batch) : null,
       group_id: isMurabbi || isAlumni ? null : (form.group_id ? Number(form.group_id) : null),
        requested_role: form.requested_role,
        phone: isMurabbi ? form.phone.trim() : null,
        facebook: isMurabbi ? form.facebook.trim() : null,
        registered: true,
      })
      .eq('id', profile.id)

    setBusy(false)
    if (error) return setErr(error.message)
    onDone()
  }

  return (
    <div className="center">
      <form className="card narrow" onSubmit={submit}>
        <h2>ลงทะเบียนครั้งแรก</h2>
        <p className="muted">{profile.email}</p>

        <label className="field">ฉันเป็น
          <select value={form.requested_role} onChange={set('requested_role')}>
  <option value="student">นักเรียน</option>
  <option value="murabbi">ครู / มูร็อบบีย์ (ต้องรออนุมัติ)</option>
  <option value="alumni">ศิษย์เก่า (ต้องรออนุมัติ)</option>
</select>
        </label>

        <label className="field">ชื่อ-นามสกุล
          <input required value={form.full_name} onChange={set('full_name')} />
        </label>

        <label className="field">เพศ
          <select required={!isMurabbi} value={form.gender} onChange={set('gender')}>
            <option value="">— เลือกเพศ —</option>
           <option value="มุสลิมีน">มุสลิมีน (ชาย)</option>
            <option value="มุสลิมะฮ์">มุสลิมะฮ์ (หญิง)</option>
          </select>
        </label>

         {!isMurabbi && !isAlumni && (
          <>
            <div className="row">
              <label className="field grow">ระดับชั้น
                <select required value={form.grade} onChange={set('grade')}>
                  <option value="">— เลือกระดับชั้น —</option>
                  {GRADES.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </label>

              <label className="field grow">สายกลุ่ม
                <select required value={form.category} onChange={set('category')}>
                  <option value="">— เลือกสายกลุ่ม —</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="field">กลุ่มฮาลาเกาะฮ์ (ระบุมูร๊อบบีย์)
              <select
                required
                value={form.group_id}
                onChange={set('group_id')}
                disabled={!form.gender || !form.grade}
              >
                <option value="">— เลือกกลุ่ม —</option>
                {filteredGroups.map((g) => {
                  const teachers = [g.murabbi_1, g.murabbi_2].filter(Boolean).join(' & ') || g.stage || 'ไม่มีข้อมูลผู้ดูแล'
                  return (
                    <option key={g.id} value={g.id}>
                      {g.name} (มูร๊อบบีย์: {teachers})
                    </option>
                  )
                })}
              </select>
            </label>

            {filteredGroups.length === 0 && form.gender && form.grade && (
              <p className="muted">ยังไม่มีกลุ่มที่ตรงกับข้อมูลที่เลือก</p>
            )}
          </>
        )}
        {isAlumni && (
          <label className="field">รุ่นที่ (ตัวเลข 1–999)
            <input 
              type="number" 
              min="1" 
              max="999" 
              required 
              placeholder="เช่น 15" 
              value={form.batch || ''} 
              onChange={set('batch')} 
            />
          </label>
        )}

        {isMurabbi && (
          <>
            <label className="field">เบอร์ติดต่อ (ไม่บังคับ)
              <input value={form.phone} onChange={set('phone')} />
            </label>
            <label className="field">Facebook (ไม่บังคับ)
              <input value={form.facebook} onChange={set('facebook')} />
            </label>
          </>
        )}

        <button className="btn" disabled={busy}>บันทึกและเริ่มใช้งาน</button>
        {err && <p className="msg err">{err}</p>}
        <p className="muted">หลังลงทะเบียนแล้ว การย้ายกลุ่มต้องติดต่อแอดมิน</p>
      </form>
    </div>
  )
}