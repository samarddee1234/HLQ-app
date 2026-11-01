import { useEffect, useState } from 'react'
import { supabase, configured } from './supabase.js'
import Icon from './components/Icon.jsx'
import Notifications from './components/Notifications.jsx'
import VentInbox from './components/VentInbox.jsx'
import { useBadges } from './components/useBadges.js'
import Login from './pages/Login.jsx'
import ResetPassword from './pages/ResetPassword.jsx'
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
// all = เมนูทั้งหมด (แถบข้างบนเดสก์ท็อป) / bottom = เมนูหลักที่แถบล่างบนมือถือ ที่เหลือเข้าผ่านปุ่ม "เพิ่มเติม"
const NAV = {
  student: { all: ['home', 'stats', 'ibadah', 'learn', 'tools', 'vent'], bottom: ['home', 'stats', 'ibadah', 'learn'] },
  murabbi: { all: ['home', 'prayer', 'attend', 'group', 'vent', 'learn', 'tools'], bottom: ['home', 'prayer', 'attend', 'group'] },
  admin: { all: ['admin', 'learn', 'tools'], bottom: ['admin', 'learn', 'tools'] },
  alumni: { all: ['home', 'knowledge', 'teachers', 'learn', 'tools'], bottom: ['home', 'knowledge', 'teachers', 'learn', 'tools'] },
}

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = กำลังโหลด
  const [profile, setProfile] = useState(null)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [tab, setTab] = useState('home')
  const [recovery, setRecovery] = useState(false)
  const [more, setMore] = useState(false)

  useEffect(() => {
    if (!configured) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      setSession(s)
    })
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
    const theme = profile?.theme || 'navy'
    document.documentElement.dataset.theme = theme
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', getComputedStyle(document.documentElement).getPropertyValue('--g1').trim() || '#2f4a8f')
  }, [profile?.theme])

  const badges = useBadges(profile ?? { id: '', role: '' })

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
  if (recovery) return <ResetPassword onDone={() => setRecovery(false)} />
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
  const nav = NAV[role]
  const current = nav.all.includes(tab) ? tab : nav.all[0]
  const reload = () => loadProfile(session.user.id)
  const pendingMurabbi = profile.requested_role === 'murabbi' && profile.role === 'student'
  const go = (k) => { setTab(k); setMore(false); window.scrollTo?.({ top: 0 }) }
  const label = (k) => (role === 'murabbi' && k === 'vent' ? 'ข้อความ' : TABS[k].label)
  const badge = (k) => (k === 'vent' && role === 'murabbi' ? badges.vent : k === 'admin' ? badges.vent : 0)
  const moreTabs = nav.all.filter((k) => !nav.bottom.includes(k))
  const moreBadge = moreTabs.reduce((n, k) => n + badge(k), 0)

  let page
  if (role === 'admin') {
    page = { admin: <Admin profile={profile} />, learn: <Learn profile={profile} />, tools: <Tools /> }[current]
  } else if (role === 'alumni') {
    page = {
      home: <AlumniHome profile={profile} go={go} onProfileChange={reload} />,
      knowledge: <AlumniKnowledge />,
      teachers: <AlumniTeachers />,
      learn: <Learn profile={profile} />,
      tools: <Tools />,
    }[current]
  } else if (role === 'murabbi') {
    page = {
      home: <MHome profile={profile} go={go} />,
      prayer: <PrayerCheck profile={profile} />,
      attend: <Attendance profile={profile} />,
      group: <Group profile={profile} onProfileChange={reload} />,
      vent: <VentInbox />,
      learn: <Learn profile={profile} />,
      tools: <Tools />,
    }[current]
  } else {
    page = {
      home: <Home profile={profile} go={go} onProfileChange={reload} />,
      stats: <Stats profile={profile} />,
      ibadah: <Ibadah profile={profile} />,
      learn: <Learn profile={profile} />,
      tools: <Tools />,
      vent: <Vent profile={profile} />,
    }[current]
  }

  const navBtn = (k, cls) => (
    <button key={k} className={`${cls} ${current === k ? 'on' : ''}`} onClick={() => go(k)} aria-current={current === k ? 'page' : undefined}>
      <span className="ico"><Icon name={TABS[k].icon} size={22} />{badge(k) > 0 && <b className="dot">{badge(k) > 9 ? '9+' : badge(k)}</b>}</span>
      <span>{label(k)}</span>
    </button>
  )

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <b>สายใยสามารถดี</b>
          <span>ฮาลาเกาะฮฺ · โรงเรียนสามารถดีวิทยา</span>
        </div>
        <div className="who">{profile.full_name}</div>
        <Notifications profile={profile} go={go} />
        <button className="btn light" onClick={() => supabase.auth.signOut()} aria-label="ออกจากระบบ">ออก</button>
      </header>
      {pendingMurabbi && (
        <div className="notice">คำขอเป็นมูร๊อบบีย์รออนุมัติจากแอดมิน ระหว่างนี้ใช้งานในฐานะนักเรียนก่อน</div>
      )}
      <div className="shell">
        <nav className="sidebar" aria-label="เมนูหลัก">
          {nav.all.map((k) => navBtn(k, 'side-item'))}
        </nav>
        <main className="page">{page}</main>
      </div>

      <nav className="bottom-nav" aria-label="เมนูหลัก">
        {nav.bottom.map((k) => navBtn(k, 'bn-item'))}
        {moreTabs.length > 0 && (
          <button className={`bn-item ${moreTabs.includes(current) ? 'on' : ''}`} onClick={() => setMore(true)} aria-haspopup="dialog">
            <span className="ico"><Icon name="dots" size={22} />{moreBadge > 0 && <b className="dot">{moreBadge}</b>}</span>
            <span>เพิ่มเติม</span>
          </button>
        )}
      </nav>

      {more && (
        <div className="sheet-back" onClick={() => setMore(false)}>
          <div className="sheet" role="dialog" aria-label="เมนูเพิ่มเติม" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-grip" />
            <div className="sheet-grid">
              {moreTabs.map((k) => navBtn(k, 'sheet-item'))}
              <button className="sheet-item" onClick={() => supabase.auth.signOut()}>
                <span className="ico"><Icon name="logout" size={22} /></span><span>ออกจากระบบ</span>
              </button>
            </div>
            <button className="btn ghost" style={{ width: '100%' }} onClick={() => setMore(false)}>ปิด</button>
          </div>
        </div>
      )}
    </div>
  )
}
