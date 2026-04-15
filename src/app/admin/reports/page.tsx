'use client'

import { FadeIn } from '@/components/Motion'
import DatePickerInput from '@/components/DatePickerInput'

import { useState, useEffect } from 'react'
import { BarChart3, Calendar, TrendingUp, DollarSign, Users, Clock, Download, Search } from 'lucide-react'
import toast from 'react-hot-toast'

interface Booking {
    id: string; bookingNumber: string; status: string; totalAmount: number; createdAt: string
    bookingItems: Array<{ court: { name: string }; date: string; startTime: string; endTime: string; price: number }>
    user: { name: string }; payments: Array<{ createdAt: string; amount: number }>
}

export default function ReportsPage() {
    const [bookings, setBookings] = useState<Booking[]>([])
    const [loading, setLoading] = useState(true)
    const [dateFrom, setDateFrom] = useState(() => {
        const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]
    })
    const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0])
    const [searchBy, setSearchBy] = useState<'booking' | 'payment'>('booking')

    useEffect(() => {
        fetch('/api/bookings?take=500', { cache: 'no-store' })
            .then(r => r.json())
            .then(data => setBookings(data.bookings || []))
            .catch(() => toast.error('โหลดไม่สำเร็จ'))
            .finally(() => setLoading(false))
    }, [])

    // Filter by date range
    const filtered = bookings.filter(b => {
        if (searchBy === 'payment') {
            return b.payments.some(p => {
                const pDate = p.createdAt?.split('T')[0]
                return pDate >= dateFrom && pDate <= dateTo
            })
        }
        return b.bookingItems.some(item => {
            const iDate = item.date?.split('T')[0]
            return iDate >= dateFrom && iDate <= dateTo
        })
    })

    const confirmed = filtered.filter(b => b.status === 'CONFIRMED')
    const cancelled = filtered.filter(b => b.status === 'CANCELLED')
    const revenue = confirmed.reduce((s, b) => s + b.totalAmount, 0)
    const totalHours = confirmed.reduce((s, b) => s + b.bookingItems.length, 0)
    const customerIds = new Set(filtered.map(b => (b as { userId?: string }).userId).filter(Boolean))

    // Daily breakdown
    const dailyMap: Record<string, { bookings: number; hours: number; revenue: number }> = {}
    confirmed.forEach(b => {
        b.bookingItems.forEach(item => {
            const d = item.date?.split('T')[0]
            if (!dailyMap[d]) dailyMap[d] = { bookings: 0, hours: 0, revenue: 0 }
            dailyMap[d].bookings++
            dailyMap[d].hours++
            dailyMap[d].revenue += item.price
        })
    })
    const dailyData = Object.entries(dailyMap).sort(([a], [b]) => a.localeCompare(b))

    if (loading) return <div style={{ textAlign: 'center', padding: '60px', color: 'var(--a-text-muted)' }}>กำลังโหลด...</div>

    return (
        <FadeIn><div>
            {/* Header + Date Range */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--a-text)' }}>สรุปรายงาน</h2>
                    <p style={{ color: 'var(--a-text-secondary)', fontSize: '14px' }}>ค้นหาตามวันที่จองหรือวันที่ชำระเงิน</p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <select className="admin-input" style={{ width: '150px' }} value={searchBy} onChange={e => setSearchBy(e.target.value as 'booking' | 'payment')}>
                        <option value="booking">วันที่จองสนาม</option>
                        <option value="payment">วันที่ชำระเงิน</option>
                    </select>
                    <DatePickerInput value={dateFrom} onChange={setDateFrom} style={{ width: '150px' }} />
                    <span style={{ color: 'var(--a-text-muted)' }}>ถึง</span>
                    <DatePickerInput value={dateTo} onChange={setDateTo} style={{ width: '150px' }} />
                </div>
            </div>

            {/* Stats cards */}
            <div className="grid-4" style={{ marginBottom: '24px' }}>
                {[
                    { icon: <DollarSign size={22} />, value: `฿${revenue.toLocaleString()}`, label: 'รายได้รวม', sub: `เฉลี่ย ฿${confirmed.length > 0 ? Math.round(revenue / confirmed.length).toLocaleString() : 0}/จอง`, color: 'yellow' },
                    { icon: <Calendar size={22} />, value: filtered.length, label: 'การจองทั้งหมด', sub: `ยืนยัน ${confirmed.length} | ยกเลิก ${cancelled.length}`, color: 'blue' },
                    { icon: <Clock size={22} />, value: `${totalHours} ชม.`, label: 'จำนวนชม.สนาม', sub: `เฉลี่ย ${dailyData.length > 0 ? (totalHours / dailyData.length).toFixed(1) : 0} ชม./วัน`, color: 'green' },
                    { icon: <TrendingUp size={22} />, value: filtered.length > 0 ? `${Math.round((confirmed.length / filtered.length) * 100)}%` : '0%', label: 'อัตราสำเร็จ', sub: `ลูกค้า ${customerIds.size} คน`, color: 'red' },
                ].map(stat => (
                    <div key={stat.label} className="stat-card">
                        <div className={`stat-icon ${stat.color}`}>{stat.icon}</div>
                        <div>
                            <div className="stat-value">{stat.value}</div>
                            <div className="stat-label">{stat.label}</div>
                            <div style={{ fontSize: '11px', color: 'var(--a-text-muted)', marginTop: '2px' }}>{stat.sub}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Daily breakdown table */}
            <div className="admin-card">
                <div className="admin-card-header">
                    <h3 className="admin-card-title">สรุปรายวัน</h3>
                    <span className="badge badge-info">{dailyData.length} วัน</span>
                </div>
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>วันที่</th><th>จำนวนจอง</th><th>จำนวนชม.</th><th>รายได้</th>
                        </tr>
                    </thead>
                    <tbody>
                        {dailyData.length === 0 ? (
                            <tr><td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: 'var(--a-text-muted)' }}>ไม่มีข้อมูลในช่วงที่เลือก</td></tr>
                        ) : dailyData.map(([date, data]) => (
                            <tr key={date}>
                                <td style={{ fontWeight: 600 }}>{new Date(date).toLocaleDateString('th-TH', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                                <td>{data.bookings} จอง</td>
                                <td>{data.hours} ชม.</td>
                                <td style={{ fontWeight: 700 }}>฿{data.revenue.toLocaleString()}</td>
                            </tr>
                        ))}
                        {dailyData.length > 0 && (
                            <tr style={{ background: '#f8f9fa', fontWeight: 800 }}>
                                <td>รวม</td>
                                <td>{dailyData.reduce((s, [, d]) => s + d.bookings, 0)} จอง</td>
                                <td>{totalHours} ชม.</td>
                                <td>฿{revenue.toLocaleString()}</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div></FadeIn>
    )
}
