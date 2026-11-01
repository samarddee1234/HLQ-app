// รหัสลับของข้อความระบายใจ เก็บเฉพาะในเครื่อง/เบราว์เซอร์นี้ ฐานข้อมูลไม่รู้ว่าเป็นของใคร
const KEY = 'vent-tokens'
export const readTokens = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] } }
export const saveTokens = (t) => { try { localStorage.setItem(KEY, JSON.stringify(t.slice(-50))) } catch { /* ไม่มี storage ก็ยังส่งได้ แต่จะดูคำตอบไม่ได้ */ } }
export function newToken() {
  const a = new Uint8Array(16)
  crypto.getRandomValues(a)
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('') // 32 ตัวอักษร
}
