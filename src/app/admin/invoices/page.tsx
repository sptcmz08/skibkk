'use client'

import { useState } from 'react'
import { FileText, Plus, Download, Eye, X } from 'lucide-react'
import toast from 'react-hot-toast'

interface Invoice {
    id: string; invoiceNumber: string; bookingNumber: string; customerName: string
    amount: number; tax: number; total: number; issuedDate: string; status: string
}

export default function InvoicesPage() {
    const [invoices] = useState<Invoice[]>([])
    const [search, setSearch] = useState('')

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--a-text)' }}>ใบกำกับภาษี</h2>
                    <p style={{ color: 'var(--a-text-secondary)', fontSize: '14px' }}>จัดการและออกใบกำกับภาษีสำหรับการจอง</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <input className="admin-input" style={{ width: '250px' }} placeholder="ค้นหาเลขใบกำกับ / ชื่อลูกค้า" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
            </div>

            <div className="admin-card">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>เลขที่ใบกำกับ</th>
                            <th>หมายเลขจอง</th>
                            <th>ลูกค้า</th>
                            <th>ยอดเงิน</th>
                            <th>VAT 7%</th>
                            <th>รวมทั้งสิ้น</th>
                            <th>วันที่ออก</th>
                            <th>จัดการ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {invoices.length === 0 ? (
                            <tr>
                                <td colSpan={8} style={{ textAlign: 'center', padding: '60px', color: 'var(--a-text-muted)' }}>
                                    <FileText size={40} style={{ marginBottom: '12px', opacity: 0.4, display: 'block', margin: '0 auto 12px' }} />
                                    <p style={{ fontWeight: 600 }}>ยังไม่มีใบกำกับภาษี</p>
                                    <p style={{ fontSize: '13px' }}>ใบกำกับภาษีจะถูกสร้างเมื่อมีการยืนยันการจองและชำระเงิน</p>
                                </td>
                            </tr>
                        ) : invoices.map(inv => (
                            <tr key={inv.id}>
                                <td style={{ fontWeight: 600, fontFamily: "'Inter'" }}>{inv.invoiceNumber}</td>
                                <td>{inv.bookingNumber}</td>
                                <td>{inv.customerName}</td>
                                <td>฿{inv.amount.toLocaleString()}</td>
                                <td>฿{inv.tax.toLocaleString()}</td>
                                <td style={{ fontWeight: 700 }}>฿{inv.total.toLocaleString()}</td>
                                <td>{new Date(inv.issuedDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                                <td>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        <button className="btn-admin-outline" style={{ padding: '4px 10px' }}><Eye size={14} /></button>
                                        <button className="btn-admin-outline" style={{ padding: '4px 10px' }}><Download size={14} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
