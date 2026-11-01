import { thaiDate } from '../lib.js'

const KIND = { lesson: 'เรียนรู้', exam: 'ทดสอบ / สอบ', lecture: 'บรรยาย', special: 'กิจกรรมพิเศษ' }

// แสดงหัวข้อฮาลาเกาะฮฺของหนึ่งสัปดาห์
export default function Topic({ topic, compact = false }) {
  if (!topic) {
    return <p className="muted">ยังไม่มีหัวข้อสำหรับสัปดาห์นี้</p>
  }
  return (
    <div className={`topic kind-${topic.kind}`}>
      <div className="topic-head">
        <span className="tag">{KIND[topic.kind] ?? topic.kind}</span>
        {!compact && <span className="muted">สัปดาห์ที่ {topic.week_no} · {thaiDate(topic.session_date)}</span>}
      </div>
      {topic.title && <p className="topic-title">{topic.title}</p>}
      {topic.tadabbur && <p><b>ตะดะบุรอัลกุรอาน:</b> {topic.tadabbur}</p>}
      {topic.akhlaq && <p><b>อัดลาก:</b> {topic.akhlaq}</p>}
      {topic.fiqh && <p><b>อัลฟิกฮ์:</b> {topic.fiqh}</p>}
      {topic.note && <p className="muted">{topic.note}</p>}
    </div>
  )
}
