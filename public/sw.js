// Service worker แบบเบา: แคชไฟล์ของแอปเองเพื่อเปิดไวและติดตั้งได้
// ไม่แคชคำขอไปยัง Supabase/API (ข้ามโดเมน) เพื่อให้ข้อมูลสดเสมอ
// เปลี่ยนเลขเวอร์ชันด้านล่างทุกครั้งที่อยากให้เครื่องผู้ใช้ล้างแคชเก่า
const VERSION = 'v1'
const CACHE = `halaqah-${VERSION}`

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', '/manifest.webmanifest', '/icon-192.png'])).then(() => self.skipWaiting()))
})
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  )
})
self.addEventListener('fetch', (e) => {
  const req = e.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== self.location.origin) return
  // หน้าเว็บ: ลองเครือข่ายก่อน ถ้าออฟไลน์ใช้หน้าที่แคชไว้
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((res) => {
      const copy = res.clone(); caches.open(CACHE).then((c) => c.put('/', copy)); return res
    }).catch(() => caches.match('/')))
    return
  }
  // ไฟล์ของแอป (js/css/รูป): ใช้แคชก่อน แล้วอัปเดตเบื้องหลัง
  e.respondWith(caches.match(req).then((hit) => {
    const net = fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)) }
      return res
    }).catch(() => hit)
    return hit || net
  }))
})
