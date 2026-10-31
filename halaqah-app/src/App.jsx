import { useEffect, useState } from 'react'
import { supabase, configured } from './supabase.js'
import Icon from './components/Icon.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Home from './pages/Home.jsx'
import Stats from './pages/Stats.jsx'
import Ibadah from './pages/Ibadah.jsx'
import Vent from './pages/Vent.jsx'
import Learn from './pages/Learn.jsx'
import Tools from './pages/Tools.jsx'
import MHome from './pages/MHome.jsx'
import PrayerCheck from './pages/PrayerCheck.jsx'
import Attendance from './pages/Attendance.jsx'
import Group from './pages/Group.jsx'
import Admin from './pages/Admin.jsx'
import { AlumniHome, AlumniKnowledge, AlumniTeachers } from './pages/Alumni.jsx'

const TABS = {
  home: { label: 'หน้าแรก', icon: 'home' },
  stats: { label: 'สถิติ', icon: 'chart' },
  ibadah: { label: 'อิบาดะฮฺ', icon: 'check' },
  learn: { label: 'ฮาลาเกาะฮฺ', icon: 'book' },
  tools: { label: 'เครื่องมือ', icon: 'compass' },
  vent: { label: 'ระบายใจ', icon: 'chat' },
  prayer: { label: 'เช็คละหมาด', icon: 'check' },
  attend: { label: 'เข้าฮาลาเกาะฮฺ', icon: 'calendar' },
  group: { label: 'กลุ่มของฉัน', icon: 'users' },
  admin: { label: 'แอดมิน', icon: 'shield' },
  knowledge: { label: 'ความรู้', icon: 'book' },
  teachers: { label: 'ติดต่อครู', icon: 'users' },
}
const NAV = {
  student: ['home', 'stats', 'ibadah', 'learn', 'tools', 'vent'],
  murabbi: ['home', 'prayer', 'attend', 'group', 'learn', 'tools'],
  admin: ['admin', 'learn', 'tools'],
  alumni: ['home', 'knowledge', 'teachers', 'learn', 'tools'],
}

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = กำลังโหลด
  const [profile, setProfile] = useState(null)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [tab, setTab] = useState('home')

  useEffect(() => {
    if (!configured) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  async function loadProfile(userId) {
    setLoadingProfile(true)
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    setProfile(data)
    setLoadingProfile(false)
  }

  useEffect(() => {
    if (session?.user) loadProfile(session.user.id)
    else setProfile(null)
  }, [session?.user?.id])

  useEffect(() => {
    document.documentElement.dataset.theme = profile?.theme || 'navy'
  }, [profile?.theme])

  if (!configured) {
    return (
      <div className="center">
        <div className="card narrow">
          <h2>ยังไม่ได้ตั้งค่า Supabase</h2>
          <p>สร้างไฟล์ <code>.env</code> ตามตัวอย่างใน <code>.env.example</code> แล้วรันใหม่</p>
        </div>
      </div>
    )
  }
  if (session === undefined || loadingProfile) return <div className="center">กำลังโหลด…</div>
  if (!session) return <Login />
  if (!profile) {
    return (
      <div className="center">
        <div className="card narrow">
          <p>กำลังเตรียมบัญชี…</p>
          <button className="btn" onClick={() => loadProfile(session.user.id)}>ลองอีกครั้ง</button>
        </div>
      </div>
    )
  }
  if (!profile.registered) {
    return <Register profile={profile} onDone={() => loadProfile(session.user.id)} />
  }

  // ศิษย์เก่าที่ยังรอแอดมินอนุมัติ: ยังไม่ให้เห็นข้อมูลใด ๆ
  if (profile.requested_role === 'alumni' && profile.role === 'student') {
    return (
      <div className="center">
        <div className="card narrow">
          <h2>รอการอนุมัติ</h2>
          <p>ลงทะเบียนศิษย์เก่า รุ่นที่ {profile.batch} เรียบร้อยแล้ว แอดมินจะตรวจสอบและอนุมัติให้เร็ว ๆ นี้</p>
          <div className="row">
            <button className="btn" onClick={() => loadProfile(session.user.id)}>ตรวจสอบสถานะ</button>
            <button className="btn ghost" onClick={() => supabase.auth.signOut()}>ออกจากระบบ</button>
          </div>
        </div>
      </div>
    )
  }

  const role = ['admin', 'murabbi', 'alumni'].includes(profile.role) ? profile.role : 'student'
  const tabs = NAV[role]
  const current = tabs.includes(tab) ? tab : tabs[0]
  const reload = () => loadProfile(session.user.id)
  const pendingMurabbi = profile.requested_role === 'murabbi' && profile.role === 'student'

  let page
  if (role === 'admin') {
    page = { admin: <Admin profile={profile} />, learn: <Learn profile={profile} />, tools: <Tools /> }[current]
  } else if (role === 'alumni') {
    page = {
      home: <AlumniHome profile={profile} go={setTab} />,
      knowledge: <AlumniKnowledge />,
      teachers: <AlumniTeachers />,
      learn: <Learn profile={profile} />,
      tools: <Tools />,
    }[current]
  } else if (role === 'murabbi') {
    page = {
      home: <MHome profile={profile} go={setTab} />,
      prayer: <PrayerCheck profile={profile} />,
      attend: <Attendance profile={profile} />,
      group: <Group profile={profile} onProfileChange={reload} />,
      learn: <Learn profile={profile} />,
      tools: <Tools />,
    }[current]
  } else {
    page = {
      home: <Home profile={profile} go={setTab} onProfileChange={reload} />,
      stats: <Stats profile={profile} />,
      ibadah: <Ibadah profile={profile} />,
      learn: <Learn profile={profile} />,
      tools: <Tools />,
      vent: <Vent />,
    }[current]
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <b>สายใยสามารถดี</b>
          <span>ฮาลาเกาะฮฺ · โรงเรียนสามารถดีวิทยา</span>
        </div>
        <div className="who">{profile.full_name}</div>
        <button className="btn light" onClick={() => supabase.auth.signOut()}>ออก</button>
      </header>
      {pendingMurabbi && (
        <div className="notice">คำขอเป็นมูร๊อบบีย์รออนุมัติจากแอดมิน ระหว่างนี้ใช้งานในฐานะนักเรียนก่อน</div>
      )}
      <nav className="tabs" aria-label="เมนูหลัก">
        {tabs.map((k) => (
          <button key={k} className={`tab ${current === k ? 'on' : ''}`} onClick={() => setTab(k)}>
            <Icon name={TABS[k].icon} size={18} />
            {TABS[k].label}
          </button>
        ))}
      </nav>
      <main className="page">{page}</main>
    </div>
  )
}
