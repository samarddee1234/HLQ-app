import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import Mascot from '../components/Mascot.jsx'

// แปลข้อความ error ของ Supabase เป็นภาษาที่เข้าใจง่าย
function thaiError(e) {
  const m = (e?.message || '').toLowerCase()
  if (m.includes('invalid login')) return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'
  if (m.includes('not confirmed')) return 'ยังไม่ได้ยืนยันอีเมล'
  if (m.includes('already registered')) return 'อีเมลนี้มีบัญชีแล้ว ให้เข้าสู่ระบบแทน'
  if (m.includes('rate limit') || m.includes('too many') || m.includes('seconds')) return 'ขอบ่อยเกินไป รอสักครู่แล้วลองใหม่'
  if (m.includes('expired') || m.includes('invalid') && m.includes('token')) return 'รหัสไม่ถูกต้องหรือหมดอายุ ลองขอรหัสใหม่'
  if (m.includes('password')) return 'รหัสผ่านไม่ผ่านเงื่อนไข (อย่างน้อย 8 ตัว)'
  return 'ทำรายการไม่สำเร็จ ลองใหม่อีกครั้ง'
}

export default function Login() {
  const [mode, setMode] = useState('signin') // signin | signup | verify | forgot | forgot-sent
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState('')
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState(false)
  const [cool, setCool] = useState(0)

  useEffect(() => {
    if (cool <= 0) return
    const t = setTimeout(() => setCool(cool - 1), 1000)
    return () => clearTimeout(t)
  }, [cool])

  const go = (m) => { setMode(m); setMsg(''); setOk('') }

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setMsg(''); setOk('')
    const mail = email.trim()
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email: mail, password })
        if (error) {
          if (/not confirmed/i.test(error.message)) { setMode('verify'); setMsg('ยังไม่ได้ยืนยันอีเมล กรอกรหัส 6 หลักที่ส่งไปทางอีเมล หรือกดส่งใหม่') }
          else setMsg(thaiError(error))
        }
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email: mail, password, options: { emailRedirectTo: window.location.origin } })
        if (error) setMsg(thaiError(error))
        else if (data.user && data.user.identities && data.user.identities.length === 0) setMsg('อีเมลนี้มีบัญชีแล้ว ให้เข้าสู่ระบบแทน')
        else if (!data.session) { setMode('verify'); setCool(60); setOk('ส่งรหัสยืนยันไปที่อีเมลแล้ว (ดูในกล่องสแปมด้วย)') }
        // ถ้าได้ session ทันที แปลว่าปิดการยืนยันอีเมลไว้ ระบบจะพาเข้าแอปเอง
      } else if (mode === 'verify') {
        const { error } = await supabase.auth.verifyOtp({ email: mail, token: code.trim(), type: 'signup' })
        if (error) setMsg(thaiError(error))
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(mail, { redirectTo: window.location.origin })
        if (error) setMsg(thaiError(error)); else { setMode('forgot-sent'); setCool(60) }
      }
    } finally { setBusy(false) }
  }

  async function resend() {
    if (cool > 0 || !email.trim()) return
    setMsg(''); setOk('')
    const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: window.location.origin } })
    if (error) setMsg(thaiError(error)); else { setOk('ส่งอีเมลใหม่แล้ว'); setCool(60) }
  }

  const title = { signin: 'เข้าสู่ระบบ', signup: 'สมัครบัญชีใหม่', verify: 'ยืนยันอีเมล', forgot: 'ลืมรหัสผ่าน', 'forgot-sent': 'ตรวจอีเมลของคุณ' }[mode]

  return (
    <div className="center auth">
      <form className="card narrow auth-card" onSubmit={submit} noValidate={false}>
        <Mascot size={92} />
        <h1>สายใยสามารถดี</h1>
        <p className="muted">ระบบฮาลาเกาะฮฺ โรงเรียนสามารถดีวิทยา</p>
        <h3 className="auth-title">{title}</h3>

        {mode === 'forgot-sent' ? (
          <>
            <p>ถ้าอีเมลนี้มีบัญชีอยู่ เราส่งลิงก์ตั้งรหัสผ่านใหม่ไปให้แล้ว กดลิงก์ในอีเมลเพื่อตั้งรหัสใหม่</p>
            <button type="button" className="btn ghost" onClick={() => go('signin')}>กลับไปเข้าสู่ระบบ</button>
          </>
        ) : (
          <>
            <label className="field">อีเมล
              <input type="email" required autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} readOnly={mode === 'verify'} />
            </label>
            {(mode === 'signin' || mode === 'signup') && (
              <label className="field">รหัสผ่าน (อย่างน้อย 8 ตัว)
                <input type="password" required minLength={8} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  value={password} onChange={(e) => setPassword(e.target.value)} />
              </label>
            )}
            {mode === 'verify' && (
              <>
                <p className="muted">กรอกรหัสจากอีเมล หรือกดลิงก์ในอีเมลก็ได้</p>
                <label className="field">รหัสยืนยัน
                  <input className="otp" required inputMode="numeric" autoComplete="one-time-code" maxLength={10} value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
                </label>
              </>
            )}
            <button className="btn" disabled={busy}>
              {busy ? 'กำลังดำเนินการ…' : { signin: 'เข้าสู่ระบบ', signup: 'สมัคร', verify: 'ยืนยัน', forgot: 'ส่งลิงก์ตั้งรหัสใหม่' }[mode]}
            </button>
            {ok && <p className="msg" role="status">{ok}</p>}
            {msg && <p className="msg err" role="alert">{msg}</p>}

            {mode === 'verify' && (
              <button type="button" className="btn link" onClick={resend} disabled={cool > 0}>
                {cool > 0 ? `ส่งอีเมลใหม่ได้ใน ${cool} วินาที` : 'ส่งอีเมลยืนยันใหม่'}
              </button>
            )}
            {mode === 'signin' && <button type="button" className="btn link" onClick={() => go('forgot')}>ลืมรหัสผ่าน?</button>}
            <button type="button" className="btn link" onClick={() => go(mode === 'signup' ? 'signin' : mode === 'signin' ? 'signup' : 'signin')}>
              {mode === 'signin' ? 'ยังไม่มีบัญชี? สมัครใหม่' : 'กลับไปเข้าสู่ระบบ'}
            </button>
          </>
        )}
      </form>
    </div>
  )
}
