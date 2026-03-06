'use client'

import { FadeIn } from '@/components/Motion'

import { useState, useEffect } from 'react'
import { Calendar, Users, DollarSign, Clock, TrendingUp, MapPin, ArrowUpRight, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function AdminDashboard() {
    const router = useRouter()
    const [stats, setStats] = useState({
        totalBookings: 0,
        todayBookings: 0,
        totalRevenue: 0,
        activeCourts: 0,
    })
    const [recentBookings, setRecentBookings] = useState<Array<{
        id: string; bookingNumber: string; status: string; totalAmount: number; createdAt: string
        user: { name: string; phone: string }
        bookingItems: Array<{ court: { name: string }; date: string; startTime: string; endTime: string }>
    }>>([])
    const [dailySummary, setDailySummary] = useState<Array<{ date: string; count: number; hours: number; revenue: number }>>([])

    useEffect(() => {
        fetch('/api/bookings', { cache: 'no-store' })
            .then(r => r.json())
            .then(data => {
                if (data.bookings) {
                    const bookings = data.bookings
                    const today = new Date().toISOString().split('T')[0]
                    const confirmed = bookings.filter((b: any) => b.status === 'CONFIRMED')
                    setStats({
                        totalBookings: bookings.length,
                        todayBookings: bookings.filter((b: any) => b.bookingItems.some((i: any) => i.date?.split('T')[0] === today)).length,
                        totalRevenue: confirmed.reduce((s: number, b: any) => s + b.totalAmount, 0),
                        activeCourts: 0,
                    })
                    setRecentBookings(bookings.slice(0, 10))

                    // Build daily summary from confirmed bookings
                    const dayMap: Record<string, { count: number; hours: number; revenue: number }> = {}
                    confirmed.forEach((b: any) => {
                        b.bookingItems.forEach((item: any) => {
                            const d = item.date?.split('T')[0]
                            if (!d) return
                            if (!dayMap[d]) dayMap[d] = { count: 0, hours: 0, revenue: 0 }
                            dayMap[d].hours += 1
                        })
                        // Count booking once per unique date
                        const dates = [...new Set(b.bookingItems.map((i: any) => i.date?.split('T')[0]).filter(Boolean))] as string[]
                        dates.forEach(d => {
                            if (!dayMap[d]) dayMap[d] = { count: 0, hours: 0, revenue: 0 }
                            dayMap[d].count += 1
                            dayMap[d].revenue += b.totalAmount / dates.length
                        })
                    })
                    const summary = Object.entries(dayMap)
                        .map(([date, v]) => ({ date, ...v }))
                        .sort((a, b) => a.date.localeCompare(b.date))
                    setDailySummary(summary)
                }
            })
            .catch(() => { })

        fetch('/api/courts', { cache: 'no-store' })
            .then(r => r.json())
            .then(data => {
                if (data.courts) {
                    setStats(s => ({ ...s, activeCourts: data.courts.length }))
                }
            })
            .catch(() => { })
    }, [])

    const statusBadge = (status: string) => {
        const map: Record<string, { cls: string; label: string }> = {
            PENDING: { cls: 'badge-pending', label: 'รอชำระ' },
            CONFIRMED: { cls: 'badge-success', label: 'ยืนยัน' },
            CANCELLED: { cls: 'badge-danger', label: 'ยกเลิก' },
        }
        const s = map[status] || { cls: 'badge-info', label: status }
        return <span className={`badge ${s.cls}`}>{s.label}</span>
    }

    const totalSummaryHours = dailySummary.reduce((s, d) => s + d.hours, 0)
    const totalSummaryBookings = dailySummary.reduce((s, d) => s + d.count, 0)
    const totalSummaryRevenue = dailySummary.reduce((s, d) => s + d.revenue, 0)

    const goToDate = (dateStr: string) => {
        router.push(`/admin/calendar?date=${dateStr}`)
    }

    return (
        <FadeIn><div>
            {/* Stat Cards */}
            <div className="grid-4" style={{ marginBottom: '28px' }}>
                {[
                    { icon: <DollarSign size={22} />, value: `฿${stats.totalRevenue.toLocaleString()}`, label: 'รายได้รวม', sub: `เฉลี่ย ฿${stats.totalBookings ? Math.round(stats.totalRevenue / stats.totalBookings).toLocaleString() : 0}/จอง`, color: 'green' },
                    { icon: <Calendar size={22} />, value: stats.totalBookings, label: 'การจองทั้งหมด', sub: `ยืนยัน ${recentBookings.filter(b => b.status === 'CONFIRMED').length} | ยกเลิก ${recentBookings.filter(b => b.status === 'CANCELLED').length}`, color: 'yellow' },
                    { icon: <Clock size={22} />, value: `${totalSummaryHours} ชม.`, label: 'จำนวนชม.สนาม', sub: `เฉลี่ย ${dailySummary.length ? (totalSummaryHours / dailySummary.length).toFixed(1) : 0} ชม./วัน`, color: 'blue' },
                    { icon: <TrendingUp size={22} />, value: `${stats.totalBookings ? Math.round((recentBookings.filter(b => b.status === 'CONFIRMED').length / stats.totalBookings) * 100) : 0}%`, label: 'อัตราสำเร็จ', sub: `ลูกค้า ${new Set(recentBookings.map(b => b.user?.name)).size} คน`, color: 'red' },
                ].map((stat) => (
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

            {/* Daily Summary — clickable */}
            {dailySummary.length > 0 && (
                <div className="admin-card" style={{ marginBottom: '28px' }}>
                    <div className="admin-card-header">
                        <h2 className="admin-card-title">สรุปรายวัน</h2>
                    </div>
                    <table className="admin-table">
                        <thead>
                            <tr><th>วันที่</th><th style={{ textAlign: 'center' }}>จำนวนจอง</th><th style={{ textAlign: 'center' }}>จำนวนชม.</th><th style={{ textAlign: 'right' }}>รายได้</th><th></th></tr>
                        </thead>
                        <tbody>
                            {dailySummary.map(d => (
                                <tr key={d.date} onClick={() => goToDate(d.date)} style={{ cursor: 'pointer' }}>
                                    <td style={{ fontWeight: 600 }}>{new Date(d.date).toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                                    <td style={{ textAlign: 'center' }}>{d.count} จอง</td>
                                    <td style={{ textAlign: 'center' }}>{d.hours} ชม.</td>
                                    <td style={{ textAlign: 'right', fontWeight: 600 }}>฿{Math.round(d.revenue).toLocaleString()}</td>
                                    <td style={{ width: '30px', textAlign: 'center' }}><ChevronRight size={14} style={{ color: 'var(--a-text-muted)' }} /></td>
                                </tr>
                            ))}
                            <tr style={{ fontWeight: 700, borderTop: '2px solid var(--a-border)' }}>
                                <td>รวม</td>
                                <td style={{ textAlign: 'center', color: 'var(--a-primary)' }}>{totalSummaryBookings} จอง</td>
                                <td style={{ textAlign: 'center', color: 'var(--a-primary)' }}>{totalSummaryHours} ชม.</td>
                                <td style={{ textAlign: 'right', color: 'var(--a-primary)' }}>฿{Math.round(totalSummaryRevenue).toLocaleString()}</td>
                                <td></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}

            {/* Quick Actions */}
            <div className="grid-3" style={{ marginBottom: '28px' }}>
                {[
                    { href: '/admin/calendar', icon: <Calendar size={20} />, label: 'ดูปฏิทินการจอง', desc: 'ดูการจองรายวัน' },
                    { href: '/admin/courts', icon: <MapPin size={20} />, label: 'จัดการสนาม', desc: 'เพิ่ม/แก้ไขสนาม' },
                    { href: '/admin/reports', icon: <TrendingUp size={20} />, label: 'ดูรายงาน', desc: 'สรุปยอดการจอง' },
                ].map(action => (
                    <Link key={action.href} href={action.href} style={{ textDecoration: 'none' }}>
                        <div className="admin-card" style={{ padding: '20px', cursor: 'pointer', transition: 'all 0.2s' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--a-primary-light)', color: 'var(--a-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {action.icon}
                                </div>
                                <ArrowUpRight size={16} style={{ color: 'var(--a-text-muted)' }} />
                            </div>
                            <div style={{ fontWeight: 700, color: 'var(--a-text)', fontSize: '15px' }}>{action.label}</div>
                            <div style={{ fontSize: '13px', color: 'var(--a-text-secondary)' }}>{action.desc}</div>
                        </div>
                    </Link>
                ))}
            </div>

            {/* Recent Bookings — clickable rows */}
            <div className="admin-card">
                <div className="admin-card-header">
                    <h2 className="admin-card-title">การจองล่าสุด</h2>
                    <Link href="/admin/calendar" style={{ fontSize: '13px', color: 'var(--a-primary)', textDecoration: 'none', fontWeight: 600 }}>
                        ดูทั้งหมด →
                    </Link>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>หมายเลข</th>
                                <th>ลูกค้า</th>
                                <th>สนาม</th>
                                <th>วันที่</th>
                                <th>เวลา</th>
                                <th>ยอดเงิน</th>
                                <th>สถานะ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentBookings.length === 0 ? (
                                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--a-text-muted)' }}>ยังไม่มีข้อมูลการจอง</td></tr>
                            ) : recentBookings.map(b => {
                                const bookingDate = b.bookingItems[0]?.date?.split('T')[0]
                                return (
                                    <tr key={b.id} onClick={() => bookingDate && goToDate(bookingDate)} style={{ cursor: 'pointer' }}>
                                        <td style={{ fontWeight: 600, fontFamily: "'Inter'" }}>{b.bookingNumber}</td>
                                        <td>
                                            <div style={{ fontWeight: 600 }}>{b.user?.name}</div>
                                            <div style={{ fontSize: '12px', color: 'var(--a-text-muted)' }}>{b.user?.phone}</div>
                                        </td>
                                        <td>{b.bookingItems[0]?.court?.name || '-'}</td>
                                        <td>{b.bookingItems[0]?.date ? new Date(b.bookingItems[0].date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) : '-'}</td>
                                        <td>{b.bookingItems[0] ? `${b.bookingItems[0].startTime}-${b.bookingItems[0].endTime}` : '-'}</td>
                                        <td style={{ fontWeight: 700 }}>฿{b.totalAmount.toLocaleString()}</td>
                                        <td>{statusBadge(b.status)}</td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div></FadeIn>
    )
}
