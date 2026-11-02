import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase.js'
import { GENDERS, GRADES, GROUP_TYPES, groupGenderKey, groupMatchesGrade, murabbiNames } from '../lib.js'

export default function Register({ profile, onDone }) {
  const [groups, setGroups] = useState([])
  const [form, setForm] = useState({
    requested_role: 'student', full_name: '', gender: '', grade: GRADES[0],
    group_type: '', group_id: '', phone: '', facebook: '', first_name: '', last_name: '', batch: '',
  })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    // groups อ่านได้ทุกคนที่ล็อกอิน ชื่อมูร๊อบบีย์อยู่ในตารางนี้เอง (murabbi_1, murabbi_2) จึงไม่ต้องอ่านตาราง profiles
    supabase.from('groups').select('*').order('name').then(({ data }) => setGroups(data ?? []))
  }, [])

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  // เปลี่ยนเพศ/ชั้น แล้วต้องเลือกกลุ่มใหม่ (กลุ่มที่เลือกไว้อาจไม่ตรงแล้ว)
  const setFilter = (k) => (e) => setForm({ ...form, [k]: e.target.value, group_type: '', group_id: '' })
  const isMurabbi = form.requested_role === 'murabbi'
  const isAlumni = form.requested_role === 'alumni'

  // กลุ่มที่ตรงกับเพศ/ชั้นของนักเรียน (กลุ่มที่ไม่ระบุเพศ/ชั้น = ทุกคนเลือกได้)
  const matching = useMemo(() => {
    if (isMurabbi) return groups
    return groups.filter((g) => {
      const gk = groupGenderKey(g.gender)
      return (!gk || gk === form.gender) && groupMatchesGrade(g, form.grade)
    })
  }, [groups, isMurabbi, form.gender, form.grade])

  // ประเภทกลุ่มที่มีให้เลือก เรียงตามลำดับ นำ > พัฒนา > ใส่ใจ > ใกล้ชิด
  const types = useMemo(() => {
    const found = [...new Set(matching.map((g) => g.category).filter(Boolean))]
    const rank = (t) => { const i = GROUP_TYPES.indexOf(t); return i < 0 ? 99 : i }
    return found.sort((a, b) => rank(a) - rank(b))
  }, [matching])

  const options = useMemo(() => {
    if (isMurabbi || types.length === 0) return matching
    if (!form.group_type) return []
    return matching.filter((g) => g.category === form.group_type || !g.category)
  }, [matching, types, form.group_type, isMurabbi])

  const selected = groups.find((g) => String(g.id) === String(form.group_id))
  const label = (g) => {
    const m = murabbiNames(g)
    return m.length ? `${g.name} · ${m.join(', ')}` : g.name
  }

  async function submit(e) {
    e.preventDefault()
    setErr('')
    if (!isMurabbi && !form.gender) return setErr('กรุณาเลือกเพศ')
    if (!isMurabbi && !isAlumni && !form.group_id) return setErr('กรุณาเลือกกลุ่มฮาลาเกาะฮฺ')
    const batch = Number(form.batch)
    if (isAlumni && (!Number.isInteger(batch) || batch < 1 || batch > 999)) return setErr('กรุณากรอกรุ่นที่เป็นตัวเลข เช่น 27')
    const fullName = isAlumni ? `${form.first_name.trim()} ${form.last_name.trim()}` : form.full_name.trim()
    setBusy(true)
    const { error } = await supabase.from('profiles').update({
      full_name: fullName,
      gender: form.gender || null,
      grade: isMurabbi || isAlumni ? null : form.grade,
      class_room: null, // ไม่เก็บห้องแล้ว
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
          <select required={!isMurabbi} value={form.gender} onChange={setFilter('gender')}>
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
          <label className="field">ระดับชั้น
            <select value={form.grade} onChange={setFilter('grade')}>
              {GRADES.map((g) => <option key={g}>{g}</option>)}
            </select>
          </label>
        )}

        {!isMurabbi && !isAlumni && types.length > 0 && (
          <label className="field">ประเภทกลุ่มฮาลาเกาะฮฺ
            <select required value={form.group_type} onChange={(e) => setForm({ ...form, group_type: e.target.value, group_id: '' })}>
              <option value="">— เลือกประเภทกลุ่ม —</option>
              {types.map((t) => <option key={t}>{t}</option>)}
            </select>
          </label>
        )}

        {!isAlumni && (
          <label className="field">{isMurabbi ? 'กลุ่มที่ดูแล (แอดมินจะยืนยันอีกครั้ง)' : 'กลุ่มฮาลาเกาะฮฺของฉัน'}
            <select required={!isMurabbi} value={form.group_id} onChange={set('group_id')}
              disabled={!isMurabbi && types.length > 0 && !form.group_type}>
              <option value="">{!isMurabbi && types.length > 0 && !form.group_type ? '— เลือกประเภทกลุ่มก่อน —' : '— เลือกกลุ่ม —'}</option>
              {options.map((g) => <option key={g.id} value={g.id}>{label(g)}</option>)}
            </select>
          </label>
        )}

        {!isMurabbi && !isAlumni && selected && (
          <div className="murabbi-card" role="status">
            <b>{selected.name}</b>
            {murabbiNames(selected).length > 0
              ? <div>มูร๊อบบีย์ประจำกลุ่ม: {murabbiNames(selected).join(' · ')}</div>
              : <div className="muted">ยังไม่ได้ระบุมูร๊อบบีย์ของกลุ่มนี้ กรุณาแจ้งแอดมิน</div>}
            <small className="muted">ถ้าชื่อครูไม่ตรงกับครูของคุณ ให้เปลี่ยนกลุ่มก่อนกดบันทึก เพราะลงทะเบียนแล้วย้ายกลุ่มเองไม่ได้</small>
          </div>
        )}

        {isAlumni && <p className="muted">ระบบจะจัดคุณอยู่ในกลุ่มของรุ่นที่กรอก หลังแอดมินตรวจสอบและอนุมัติแล้ว</p>}
        {!isMurabbi && !isAlumni && form.gender && matching.length === 0 && (
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
        {err && <p className="msg err" role="alert">{err}</p>}
        <p className="muted">หลังลงทะเบียนแล้ว การย้ายกลุ่มต้องให้แอดมินทำให้</p>
      </form>
    </div>
  )
}
