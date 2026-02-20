'use client'

import { useState, useEffect } from 'react'
import { Calendar, Users, DollarSign, Clock, TrendingUp, MapPin, ArrowUpRight } from 'lucide-react'
import Link from 'next/link'

export default function AdminDashboard() {
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

    useEffect(() => {
        fetch('/api/bookings')
            .then(r => r.json())
            .then(data => {
                if (data.bookings) {
                    const bookings = data.bookings
                    const today = new Date().toISOString().split('T')[0]
                    setStats({
                        totalBookings: bookings.length,
                        todayBookings: bookings.filter((b: any) => b.bookingItems.some((i: any) => i.date?.split('T')[0] === today)).length,
                        totalRevenue: bookings.filter((b: any) => b.status === 'CONFIRMED').reduce((s: number, b: any) => s + b.totalAmount, 0),
                        activeCourts: 0,
                    })
                    setRecentBookings(bookings.slice(0, 10))
                }
            })
            .catch(() => { })

        fetch('/api/courts')
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

    return (
        <div>
            {/* Stat Cards */}
            <div className="grid-4" style={{ marginBottom: '28px' }}>
                {[
                    { icon: <Calendar size={22} />, value: stats.totalBookings, label: 'การจองทั้งหมด', color: 'yellow' },
                    { icon: <Clock size={22} />, value: stats.todayBookings, label: 'จองวันนี้', color: 'blue' },
                    { icon: <DollarSign size={22} />, value: `฿${stats.totalRevenue.toLocaleString()}`, label: 'รายได้รวม', color: 'green' },
                    { icon: <MapPin size={22} />, value: stats.activeCourts, label: 'สนามที่เปิดให้บริการ', color: 'red' },
                ].map((stat) => (
                    <div key={stat.label} className="stat-card">
                        <div className={`stat-icon ${stat.color}`}>{stat.icon}</div>
                        <div>
                            <div className="stat-value">{stat.value}</div>
                            <div className="stat-label">{stat.label}</div>
                        </div>
                    </div>
                ))}
            </div>

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

            {/* Recent Bookings */}
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
                            ) : recentBookings.map(b => (
                                <tr key={b.id}>
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
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
