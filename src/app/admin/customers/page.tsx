'use client'

import { useState, useEffect } from 'react'
import { Users, Search, Phone, Mail, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'

interface Customer {
    id: string; name: string; email: string; phone: string; role: string; isActive: boolean
    createdAt: string; _count?: { bookings: number }
}

export default function CustomersPage() {
    const [customers, setCustomers] = useState<Customer[]>([])
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetch('/api/bookings')
            .then(r => r.json())
            .then(data => {
                if (data.bookings) {
                    const usersMap = new Map<string, Customer & { bookingCount: number }>()
                    data.bookings.forEach((b: any) => {
                        if (b.user) {
                            const existing = usersMap.get(b.user.id)
                            if (existing) {
                                existing.bookingCount++
                            } else {
                                usersMap.set(b.user.id, { ...b.user, bookingCount: 1, role: 'CUSTOMER', isActive: true, createdAt: b.createdAt })
                            }
                        }
                    })
                    setCustomers(Array.from(usersMap.values()) as any)
                }
            })
            .catch(() => toast.error('โหลดข้อมูลไม่สำเร็จ'))
            .finally(() => setLoading(false))
    }, [])

    const filtered = customers.filter(c =>
        c.name?.toLowerCase().includes(search.toLowerCase()) ||
        c.email?.toLowerCase().includes(search.toLowerCase()) ||
        c.phone?.includes(search)
    )

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--a-text)' }}>ลูกค้า ({filtered.length})</h2>
                    <p style={{ color: 'var(--a-text-secondary)', fontSize: '14px' }}>รายชื่อลูกค้าทั้งหมดที่มีการจอง</p>
                </div>
                <div style={{ position: 'relative' }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--a-text-muted)' }} />
                    <input className="admin-input" style={{ paddingLeft: '36px', width: '280px' }} placeholder="ค้นหาชื่อ, อีเมล, เบอร์โทร" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
            </div>

            <div className="admin-card">
                <table className="admin-table">
                    <thead>
                        <tr><th>ลูกค้า</th><th>เบอร์โทร</th><th>จำนวนการจอง</th><th>สถานะ</th></tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={4} style={{ textAlign: 'center', padding: '60px' }}><div className="spinner" style={{ borderTopColor: 'var(--a-primary)', margin: '0 auto' }} /></td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: 'var(--a-text-muted)' }}>ไม่พบข้อมูลลูกค้า</td></tr>
                        ) : filtered.map(c => (
                            <tr key={c.id}>
                                <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--a-primary-light)', color: 'var(--a-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '14px' }}>
                                            {c.name?.charAt(0)?.toUpperCase() || '?'}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 600 }}>{c.name}</div>
                                            <div style={{ fontSize: '12px', color: 'var(--a-text-muted)' }}>{c.email}</div>
                                        </div>
                                    </div>
                                </td>
                                <td>{c.phone || '-'}</td>
                                <td><span style={{ fontWeight: 700, color: 'var(--a-primary)' }}>{(c as any).bookingCount}</span> ครั้ง</td>
                                <td><span className="badge badge-success">Active</span></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
