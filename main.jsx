import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

// ลงทะเบียน service worker เฉพาะตอนใช้งานจริง (npm run build) เพื่อไม่กวนตอนพัฒนา
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}))
}

createRoot(document.getElementById('root')).render(<App />)
