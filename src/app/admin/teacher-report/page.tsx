'use client'

import { FadeIn } from '@/components/Motion'
import DatePickerInput from '@/components/DatePickerInput'

import { useState, useEffect } from 'react'
import { BookOpen, Calendar, Clock, User, Download } from 'lucide-react'
import toast from 'react-hot-toast'

interface Teacher {
    id: string; name: string; sportType: string
}
interface BookingItem {
    date: string; startTime: string; endTime: string; courtName: string; teacherName: string
}

export default function TeacherReportPage() {
    const [teachers, setTeachers] = useState<Teacher[]>([])
    const [bookings, setBookings] = useState<Array<{ bookingItems: Array<{ date: string; startTime: string; endTime: string; court: { name: string }; teacher?: { id: string; name: string } }>; status: string }>>([])
    const [dateFrom, setDateFrom] = useState(() => {
        const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]
    })
    const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0])
    const [selectedTeacher, setSelectedTeacher] = useState<string>('all')
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        Promise.all([
            fetch('/api/teachers').then(r => r.json()),
            fetch('/api/bookings?take=500', { cache: 'no-store' }).then(r => r.json()),
        ]).then(([tData, bData]) => {
            setTeachers(tData.teachers || [])
            setBookings(bData.bookings || [])
        }).catch(() => toast.error('โหลดไม่สำเร็จ'))
            .finally(() => setLoading(false))
    }, [])

    // Filter confirmed bookings with teachers in date range
    const teacherItems: BookingItem[] = []
    bookings
        .filter(b => b.status === 'CONFIRMED')
        .forEach(b => {
            b.bookingItems.forEach(item => {
                if (!item.teacher) return
                const iDate = item.date?.split('T')[0]
                if (iDate >= dateFrom && iDate <= dateTo) {
                    if (selectedTeacher === 'all' || item.teacher.id === selectedTeacher) {
                        teacherItems.push({
                            date: iDate,
                            startTime: item.startTime,
                            endTime: item.endTime,
                            courtName: item.court.name,
                            teacherName: item.teacher.name,
                        })
                    }
                }
            })
        })

    // Summary per teacher
    const teacherSummary: Record<string, { hours: number; sessions: number }> = {}
    teacherItems.forEach(item => {
        if (!teacherSummary[item.teacherName]) teacherSummary[item.teacherName] = { hours: 0, sessions: 0 }
        teacherSummary[item.teacherName].hours++
        teacherSummary[item.teacherName].sessions++
    })

    // Daily breakdown
    const dailyMap: Record<string, BookingItem[]> = {}
    teacherItems.forEach(item => {
        if (!dailyMap[item.date]) dailyMap[item.date] = []
        dailyMap[item.date].push(item)
    })
    const dailyData = Object.entries(dailyMap).sort(([a], [b]) => a.localeCompare(b))

    if (loading) return <div style={{ textAlign: 'center', padding: '60px', color: 'var(--a-text-muted)' }}>กำลังโหลด...</div>

    return (
        <FadeIn><div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <BookOpen size={22} style={{ color: 'var(--a-primary)' }} /> สรุปชั่วโมงสอน
                    </h2>
                    <p style={{ color: 'var(--a-text-secondary)', fontSize: '14px' }}>ดูชั่วโมงสอนของครูแต่ละคนตามช่วงเวลา</p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <select className="admin-input" style={{ width: '160px' }} value={selectedTeacher} onChange={e => setSelectedTeacher(e.target.value)}>
                        <option value="all">ครูทุกคน</option>
                        {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <DatePickerInput value={dateFrom} onChange={setDateFrom} style={{ width: '150px' }} />
                    <span style={{ color: 'var(--a-text-muted)' }}>ถึง</span>
                    <DatePickerInput value={dateTo} onChange={setDateTo} style={{ width: '150px' }} />
                </div>
            </div>

            {/* Teacher summary cards */}
            <div className="grid-4" style={{ marginBottom: '24px' }}>
                {Object.entries(teacherSummary).map(([name, data]) => (
                    <div key={name} className="stat-card">
                        <div className="stat-icon blue"><User size={20} /></div>
                        <div>
                            <div className="stat-value">{data.hours} ชม.</div>
                            <div className="stat-label">{name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--a-text-muted)' }}>{data.sessions} คาบ</div>
                        </div>
                    </div>
                ))}
                {Object.keys(teacherSummary).length === 0 && (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: 'var(--a-text-muted)' }}>
                        ไม่มีข้อมูลการสอนในช่วงที่เลือก
                    </div>
                )}
            </div>

            {/* Daily detail table */}
            <div className="admin-card">
                <div className="admin-card-header">
                    <h3 className="admin-card-title">รายละเอียดรายวัน</h3>
                    <span className="badge badge-info">{teacherItems.length} คาบ / {dailyData.length} วัน</span>
                </div>
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>วันที่</th><th>เวลา</th><th>ครู</th><th>สนาม</th>
                        </tr>
                    </thead>
                    <tbody>
                        {dailyData.length === 0 ? (
                            <tr><td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: 'var(--a-text-muted)' }}>ไม่มีข้อมูล</td></tr>
                        ) : dailyData.map(([date, items]) => (
                            items.map((item, i) => (
                                <tr key={`${date}-${i}`}>
                                    {i === 0 && <td rowSpan={items.length} style={{ fontWeight: 600, verticalAlign: 'top' }}>{new Date(date).toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' })}</td>}
                                    <td>{item.startTime} - {item.endTime}</td>
                                    <td style={{ fontWeight: 600 }}>{item.teacherName}</td>
                                    <td>{item.courtName}</td>
                                </tr>
                            ))
                        ))}
                        {teacherItems.length > 0 && (
                            <tr style={{ background: '#f8f9fa', fontWeight: 800 }}>
                                <td colSpan={3}>รวม</td>
                                <td>{teacherItems.length} ชม.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div></FadeIn>
    )
}
