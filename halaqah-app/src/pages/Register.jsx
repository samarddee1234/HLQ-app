import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase.js'
import { GENDERS, GRADES, stageOf } from '../lib.js'

export default function Register({ profile, onDone }) {
  const [groups, setGroups] = useState([])
  const [form, setForm] = useState({
    requested_role: 'student', full_name: '', gender: '', grade: GRADES[0], class_room: '',
    group_id: '', phone: '', facebook: '', first_name: '', last_name: '', batch: '',
  })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase.from('groups').select('id,name,gender,stage').order('name').then(({ data }) => setGroups(data ?? []))
  }, [])

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const isMurabbi = form.requested_role === 'murabbi'
  const isAlumni = form.requested_role === 'alumni'

  // แสดงเฉพาะกลุ่มที่ตรงกับเพศ/ช่วงชั้นของนักเรียน (กลุ่มที่ไม่ได้ระบุ = ทุกคนเลือกได้)
  const options = useMemo(() => {
    if (isMurabbi) return groups
    const stage = stageOf(form.grade)
    return groups.filter((g) => (!g.gender || g.gender === form.gender) && (!g.stage || g.stage === stage))
  }, [groups, isMurabbi, form.gender, form.grade])

  async function submit(e) {
    e.preventDefault()
    setErr('')
    if (!isMurabbi && !form.gender) return setErr('กรุณาเลือกเพศ')
    const batch = Number(form.batch)
    if (isAlumni && (!Number.isInteger(batch) || batch < 1 || batch > 999)) return setErr('กรุณากรอกรุ่นที่เป็นตัวเลข เช่น 27')
    const fullName = isAlumni ? `${form.first_name.trim()} ${form.last_name.trim()}` : form.full_name.trim()
    setBusy(true)
    const { error } = await supabase.from('profiles').update({
      full_name: fullName,
      gender: form.gender || null,
      grade: isMurabbi || isAlumni ? null : form.grade,
      class_room: isMurabbi || isAlumni ? null : form.class_room.trim(),
      batch: isAlumni ? batch : null,
      group_id: isAlumni || !form.group_id ? null : Number(form.group_id),
      requested_role: form.requested_role,
      phone: isMurabbi ? form.phone.trim() || null : null,
      facebook: isMurabbi ? form.facebook.trim() || null : null,
      registered: true,
    }).eq('id', profile.id)
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
            <option value="murabbi">ครู / มูร๊อบบีย์ (ต้องรอแอดมินอนุมัติ)</option>
            <option value="alumni">ศิษย์เก่า (ต้องรอแอดมินอนุมัติ)</option>
          </select>
        </label>
        {isAlumni ? (
          <div className="row">
            <label className="field grow">ชื่อ
              <input required value={form.first_name} onChange={set('first_name')} autoComplete="given-name" />
            </label>
            <label className="field grow">นามสกุล
              <input required value={form.last_name} onChange={set('last_name')} autoComplete="family-name" />
            </label>
          </div>
        ) : (
          <label className="field">ชื่อ-นามสกุล
            <input required value={form.full_name} onChange={set('full_name')} autoComplete="name" />
          </label>
        )}
        <label className="field">เพศ
          <select required={!isMurabbi} value={form.gender} onChange={set('gender')}>
            <option value="">— เลือก —</option>
            {GENDERS.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
          </select>
        </label>

        {isAlumni && (
          <label className="field">รุ่นที่ (กรอกเฉพาะตัวเลข เช่น 1, 2, 27)
            <input required inputMode="numeric" pattern="[0-9]{1,3}" maxLength={3} value={form.batch}
              onChange={(e) => setForm({ ...form, batch: e.target.value.replace(/\D/g, '') })} placeholder="เช่น 27" />
          </label>
        )}

        {!isMurabbi && !isAlumni && (
          <div className="row">
            <label className="field grow">ระดับชั้น
              <select value={form.grade} onChange={set('grade')}>
                {GRADES.map((g) => <option key={g}>{g}</option>)}
              </select>
            </label>
            <label className="field grow">ห้อง
              <input required value={form.class_room} onChange={set('class_room')} placeholder="เช่น 1" />
            </label>
          </div>
        )}

        {!isAlumni && (
        <label className="field">{isMurabbi ? 'กลุ่มที่ดูแล (แอดมินจะยืนยันอีกครั้ง)' : 'กลุ่มฮาลาเกาะฮฺของฉัน'}
          <select required={!isMurabbi} value={form.group_id} onChange={set('group_id')}>
            <option value="">— เลือกกลุ่ม —</option>
            {options.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </label>
        )}
        {isAlumni && <p className="muted">ระบบจะจัดคุณอยู่ในกลุ่มของรุ่นที่กรอก หลังแอดมินตรวจสอบและอนุมัติแล้ว</p>}
        {!isMurabbi && !isAlumni && options.length === 0 && (
          <p className="muted">ยังไม่มีกลุ่มที่ตรงกับเพศ/ชั้นของคุณ กรุณาแจ้งแอดมินให้เพิ่มกลุ่มก่อน</p>
        )}

        {isMurabbi && (
          <>
            <label className="field">เบอร์ติดต่อ (ไม่บังคับ)
              <input value={form.phone} onChange={set('phone')} inputMode="tel" />
            </label>
            <label className="field">Facebook (ไม่บังคับ)
              <input value={form.facebook} onChange={set('facebook')} placeholder="ชื่อหรือลิงก์โปรไฟล์" />
            </label>
          </>
        )}

        <button className="btn" disabled={busy}>บันทึกและเริ่มใช้งาน</button>
        {err && <p className="msg err">{err}</p>}
        <p className="muted">หลังลงทะเบียนแล้ว การย้ายกลุ่มต้องให้แอดมินทำให้</p>
      </form>
    </div>
  )
}
