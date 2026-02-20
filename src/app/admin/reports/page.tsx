'use client'

import { useState, useEffect } from 'react'
import { BarChart3, Calendar, TrendingUp, DollarSign, Users, MapPin, Download } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ReportsPage() {
    const [period, setPeriod] = useState<'today' | 'week' | 'month'>('month')
    const [stats, setStats] = useState({
        totalBookings: 0, confirmedBookings: 0, cancelledBookings: 0,
        totalRevenue: 0, avgRevenue: 0, uniqueCustomers: 0,
        popularCourt: '-', popularTime: '-',
    })
    const [dailyData, setDailyData] = useState<Array<{ date: string; bookings: number; revenue: number }>>([])

    useEffect(() => {
        fetch('/api/bookings')
            .then(r => r.json())
            .then(data => {
                if (data.bookings) {
                    const bookings = data.bookings
                    const confirmed = bookings.filter((b: any) => b.status === 'CONFIRMED')
                    const cancelled = bookings.filter((b: any) => b.status === 'CANCELLED')
                    const revenue = confirmed.reduce((s: number, b: any) => s + b.totalAmount, 0)
                    const customerIds = new Set(bookings.map((b: any) => b.userId))

                    setStats({
                        totalBookings: bookings.length,
                        confirmedBookings: confirmed.length,
                        cancelledBookings: cancelled.length,
                        totalRevenue: revenue,
                        avgRevenue: confirmed.length > 0 ? Math.round(revenue / confirmed.length) : 0,
                        uniqueCustomers: customerIds.size,
                        popularCourt: bookings[0]?.bookingItems?.[0]?.court?.name || '-',
                        popularTime: '17:00 - 18:00',
                    })
                }
            })
            .catch(() => { })
    }, [period])

    return (
        <div>
            {/* Period selector */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--a-text)' }}>สรุปรายงาน</h2>
                    <p style={{ color: 'var(--a-text-secondary)', fontSize: '14px' }}>ภาพรวมการจองและรายได้</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    {[
                        { key: 'today' as const, label: 'วันนี้' },
                        { key: 'week' as const, label: 'สัปดาห์' },
                        { key: 'month' as const, label: 'เดือน' },
                    ].map(p => (
                        <button key={p.key} onClick={() => setPeriod(p.key)}
                            className={period === p.key ? 'btn-admin' : 'btn-admin-outline'}
                            style={{ padding: '6px 16px', fontSize: '13px' }}>
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Revenue cards */}
            <div className="grid-4" style={{ marginBottom: '24px' }}>
                {[
                    { icon: <DollarSign size={22} />, value: `฿${stats.totalRevenue.toLocaleString()}`, label: 'รายได้รวม', sub: `เฉลี่ย ฿${stats.avgRevenue.toLocaleString()}/จอง`, color: 'yellow' },
                    { icon: <Calendar size={22} />, value: stats.totalBookings, label: 'การจองทั้งหมด', sub: `ยืนยัน ${stats.confirmedBookings} | ยกเลิก ${stats.cancelledBookings}`, color: 'blue' },
                    { icon: <Users size={22} />, value: stats.uniqueCustomers, label: 'ลูกค้า', sub: 'จำนวนลูกค้าทั้งหมด', color: 'green' },
                    { icon: <TrendingUp size={22} />, value: stats.confirmedBookings > 0 ? `${Math.round((stats.confirmedBookings / stats.totalBookings) * 100)}%` : '0%', label: 'อัตราสำเร็จ', sub: 'Conversion Rate', color: 'red' },
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

            {/* Summary tables */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="admin-card">
                    <div className="admin-card-header">
                        <h3 className="admin-card-title">สนามยอดนิยม</h3>
                    </div>
                    <div style={{ padding: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--a-border)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <MapPin size={16} style={{ color: 'var(--a-primary)' }} /> {stats.popularCourt}
                            </div>
                            <span style={{ fontWeight: 700 }}>{stats.confirmedBookings} จอง</span>
                        </div>
                    </div>
                </div>

                <div className="admin-card">
                    <div className="admin-card-header">
                        <h3 className="admin-card-title">เวลายอดนิยม</h3>
                    </div>
                    <div style={{ padding: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--a-border)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Calendar size={16} style={{ color: 'var(--a-primary)' }} /> {stats.popularTime}
                            </div>
                            <span style={{ fontWeight: 700 }}>Peak Hour</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
