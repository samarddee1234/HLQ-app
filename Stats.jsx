import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { BarChart, LineChart, StackBar } from '../components/Charts.jsx'
import { addDays, mondayOf, pct, shortDate, todayISO, weekRange, weeklyAgg } from '../lib.js'

const WEEKS = 8

export default function Stats({ profile }) {
  const [d, setD] = useState(null)
  const weeks = weekRange(WEEKS)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const [c, a, g] = await Promise.all([
        supabase.from('prayer_checks').select('check_date,status')
          .eq('student_id', profile.id).gte('check_date', weeks[0]),
        supabase.from('halaqah_attendance').select('week_start,status')
          .eq('student_id', profile.id).gte('week_start', weeks[0]),
        profile.group_id
          ? supabase.rpc('group_week_stats', { p_group: profile.group_id, p_weeks: WEEKS })
          : Promise.resolve({ data: [] }),
      ])
      if (!alive) return
      setD({ checks: c.data ?? [], att: a.data ?? [], group: g.data ?? [], gerr: g.error })
    })()
    return () => { alive = false }
  }, [profile.id, profile.group_id])

  if (!d) return <p className="muted">กำลังโหลด…</p>

  const agg = weeklyAgg(d.checks)
  const labels = weeks.map(shortDate)
  const mine = weeks.map((w) => (agg[w] ? pct(agg[w].score, agg[w].checked) : null))
  const groupByWeek = Object.fromEntries(d.group.map((r) => [r.wk_start, r]))
  const grp = weeks.map((w) => (groupByWeek[w] ? pct(groupByWeek[w].score, groupByWeek[w].checked) : null))
  const attByWeek = Object.fromEntries(d.att.map((r) => [r.week_start, r.status]))

  const since4 = addDays(mondayOf(todayISO()), -21)
  const recent = d.checks.filter((c) => c.check_date >= since4)
  const count = (...keys) => recent.filter((c) => keys.includes(c.status)).length

  const weekNow = mondayOf(todayISO())
  const barData = weeks.map((w, i) => ({ label: labels[i], value: mine[i], current: w === weekNow }))

  return (
    <>
      <section className="card">
        <h3>คะแนนละหมาดรายสัปดาห์ของฉัน</h3>
        <p className="muted">เปอร์เซ็นต์คะแนนที่ได้ จากวักตูที่ครูเช็คในสัปดาห์นั้น (แท่งเข้มคือสัปดาห์นี้)</p>
        <BarChart data={barData} label="คะแนนละหมาดรายสัปดาห์ของฉัน" />
      </section>

      <section className="card">
        <h3>ฉันเทียบกับค่าเฉลี่ยของกลุ่ม</h3>
        {!profile.group_id && <p className="muted">ยังไม่ได้อยู่ในกลุ่ม</p>}
        {profile.group_id && d.gerr && (
          <p className="muted">ยังดึงสถิติกลุ่มไม่ได้ (แอดมินต้องรัน migration_02.sql ก่อน)</p>
        )}
        {profile.group_id && !d.gerr && (
          <>
            <LineChart
              labels={labels} label="เปรียบเทียบคะแนนของฉันกับค่าเฉลี่ยกลุ่ม"
              series={[
                { name: 'ฉัน', cls: 's1', values: mine },
                { name: 'ค่าเฉลี่ยกลุ่ม', cls: 's2', values: grp },
              ]}
            />
            <p className="muted">สถิติกลุ่มเป็นค่ารวม ไม่แสดงข้อมูลรายบุคคลของเพื่อน</p>
          </>
        )}
      </section>

      <section className="card">
        <h3>สถานะละหมาด 4 สัปดาห์ล่าสุด</h3>
        <StackBar parts={[
          { label: 'ทันเวลา', value: count('on_time'), cls: 'c-ok' },
          { label: 'สาย', value: count('late'), cls: 'c-warn' },
          { label: 'ไม่ขึ้น', value: count('absent'), cls: 'c-bad' },
          { label: 'ลา/ยกเว้น', value: count('excused', 'menstruation'), cls: 'c-info' },
        ]} />
      </section>

      <section className="card">
        <h3>การเข้าฮาลาเกาะฮฺรายสัปดาห์</h3>
        <div className="weekdots">
          {weeks.map((w, i) => (
            <div key={w} className="wd">
              <i className={attByWeek[w] ?? ''} title={attByWeek[w] ?? 'ยังไม่มีข้อมูล'} />
              {labels[i]}
            </div>
          ))}
        </div>
        <div className="legend">
          <span><i className="swatch c-ok" />เข้าร่วม</span>
          <span><i className="swatch c-info" />ลา</span>
          <span><i className="swatch c-bad" />ขาด</span>
        </div>
      </section>
    </>
  )
}
