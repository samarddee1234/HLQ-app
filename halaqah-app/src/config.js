// ตั้งค่าทั่วไปของแอป — แก้ไขที่ไฟล์นี้ได้เลย

export const SCHOOL = {
  name: 'โรงเรียนสามารถดีวิทยา',
  program: 'สายใยสามารถดี (ฮาลาเกาะฮฺ)',
}

// เมืองสำหรับดึงเวลาละหมาด (ชื่อภาษาอังกฤษ เช่น 'Yala', 'Pattani', 'Narathiwat')
// ปล่อยว่างไว้ แล้วให้ผู้ใช้พิมพ์เองในหน้า "อิบาดะฮฺ" ก็ได้ (จำไว้ในเครื่องของแต่ละคน)
export const DEFAULT_CITY = ''
export const PRAYER_COUNTRY = 'Thailand'
// วิธีคำนวณเวลาละหมาดของ Aladhan: 3 = Muslim World League (ปรับได้ตามที่โรงเรียนใช้)
export const PRAYER_METHOD = 3

// จำนวนสัปดาห์ย้อนหลังในกราฟ
export const CHART_WEEKS = 8
