'use client'

import { useState, useEffect } from 'react'
import { FileText, Calendar, Download, Printer } from 'lucide-react'
import toast from 'react-hot-toast'

interface Booking {
    id: string; bookingNumber: string; status: string; totalAmount: number; createdAt: string
    user: { name: string; email: string; phone: string }
    bookingItems: Array<{ date: string; startTime: string; endTime: string; price: number; court: { name: string } }>
    payments: Array<{ method: string; status: string; amount: number; createdAt: string }>
}

export default function InvoiceReportPage() {
    const [bookings, setBookings] = useState<Booking[]>([])
    const [loading, setLoading] = useState(true)
    const [dateFrom, setDateFrom] = useState(() => {
        const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]
    })
    const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0])

    useEffect(() => {
        fetch('/api/bookings', { cache: 'no-store' })
            .then(r => r.json())
            .then(data => setBookings(data.bookings || []))
            .catch(() => toast.error('โหลดไม่สำเร็จ'))
            .finally(() => setLoading(false))
    }, [])

    // Filter confirmed bookings with verified payments in date range
    const filtered = bookings.filter(b => {
        if (b.status !== 'CONFIRMED') return false
        return b.payments.some(p => {
            if (p.status !== 'VERIFIED') return false
            const pDate = p.createdAt?.split('T')[0]
            return pDate >= dateFrom && pDate <= dateTo
        })
    })

    const totalRevenue = filtered.reduce((s, b) => s + b.totalAmount, 0)
    const vatRate = 0.07
    const totalBeforeVat = totalRevenue / (1 + vatRate)
    const totalVat = totalRevenue - totalBeforeVat

    const handlePrint = () => window.print()

    if (loading) return <div style={{ textAlign: 'center', padding: '60px', color: 'var(--a-text-muted)' }}>กำลังโหลด...</div>

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileText size={22} style={{ color: 'var(--a-primary)' }} /> รายงานใบกำกับภาษีรวม
                    </h2>
                    <p style={{ color: 'var(--a-text-secondary)', fontSize: '14px' }}>สรุปยอดใบกำกับภาษีส่งการเงิน</p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input type="date" className="admin-input" style={{ width: '150px' }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                    <span style={{ color: 'var(--a-text-muted)' }}>ถึง</span>
                    <input type="date" className="admin-input" style={{ width: '150px' }} value={dateTo} onChange={e => setDateTo(e.target.value)} />
                    <button onClick={handlePrint} className="btn-admin" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Printer size={16} /> พิมพ์
                    </button>
                </div>
            </div>

            {/* Summary */}
            <div className="grid-4" style={{ marginBottom: '24px' }}>
                {[
                    { label: 'จำนวนใบ', value: filtered.length, color: 'blue' },
                    { label: 'ยอดก่อน VAT', value: `฿${Math.round(totalBeforeVat).toLocaleString()}`, color: 'green' },
                    { label: 'VAT 7%', value: `฿${Math.round(totalVat).toLocaleString()}`, color: 'yellow' },
                    { label: 'ยอดรวม', value: `฿${Math.round(totalRevenue).toLocaleString()}`, color: 'red' },
                ].map(s => (
                    <div key={s.label} className="stat-card">
                        <div className={`stat-icon ${s.color}`}><FileText size={20} /></div>
                        <div>
                            <div className="stat-value">{s.value}</div>
                            <div className="stat-label">{s.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Invoice list table */}
            <div className="admin-card">
                <div className="admin-card-header">
                    <h3 className="admin-card-title">รายการใบกำกับภาษี</h3>
                </div>
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>#</th><th>เลขที่</th><th>วันที่ชำระ</th><th>ลูกค้า</th><th>ก่อน VAT</th><th>VAT</th><th>รวม</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--a-text-muted)' }}>ไม่มีข้อมูลในช่วงที่เลือก</td></tr>
                        ) : filtered.map((b, i) => {
                            const bVat = b.totalAmount / (1 + vatRate)
                            const bVatAmount = b.totalAmount - bVat
                            const payDate = b.payments.find(p => p.status === 'VERIFIED')?.createdAt
                            return (
                                <tr key={b.id}>
                                    <td>{i + 1}</td>
                                    <td style={{ fontWeight: 600, fontFamily: "'Inter'" }}>{b.bookingNumber}</td>
                                    <td>{payDate ? new Date(payDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) : '-'}</td>
                                    <td>{b.user?.name}</td>
                                    <td>฿{Math.round(bVat).toLocaleString()}</td>
                                    <td>฿{Math.round(bVatAmount).toLocaleString()}</td>
                                    <td style={{ fontWeight: 700 }}>฿{b.totalAmount.toLocaleString()}</td>
                                </tr>
                            )
                        })}
                        {filtered.length > 0 && (
                            <tr style={{ background: '#f8f9fa', fontWeight: 800 }}>
                                <td colSpan={4}>รวมทั้งหมด ({filtered.length} ใบ)</td>
                                <td>฿{Math.round(totalBeforeVat).toLocaleString()}</td>
                                <td>฿{Math.round(totalVat).toLocaleString()}</td>
                                <td>฿{Math.round(totalRevenue).toLocaleString()}</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
