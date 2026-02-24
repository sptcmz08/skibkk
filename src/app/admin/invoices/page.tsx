'use client'

import { useState, useEffect, useRef } from 'react'
import { FileText, Printer, Search, ChevronLeft, Receipt } from 'lucide-react'
import toast from 'react-hot-toast'

interface BookingItem { court: { name: string }; date: string; startTime: string; endTime: string; price: number }
interface Booking {
    id: string; bookingNumber: string; status: string; totalAmount: number; createdAt: string
    user: { name: string; email: string; phone: string }
    bookingItems: BookingItem[]
    participants: Array<{ name: string; sportType: string }>
    payments: Array<{ method: string; status: string; amount: number }>
}

type DocType = 'full' | 'short'

export default function InvoicesPage() {
    const [bookings, setBookings] = useState<Booking[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
    const [docType, setDocType] = useState<DocType>('full')
    const printRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        fetch('/api/bookings').then(r => r.json())
            .then(data => setBookings((data.bookings || []).filter((b: Booking) => b.status !== 'CANCELLED')))
            .catch(() => toast.error('โหลดข้อมูลไม่สำเร็จ'))
            .finally(() => setLoading(false))
    }, [])

    const filtered = bookings.filter(b =>
        b.bookingNumber.toLowerCase().includes(search.toLowerCase()) ||
        b.user.name.toLowerCase().includes(search.toLowerCase())
    )

    const handlePrint = () => {
        const content = printRef.current
        if (!content) return
        const win = window.open('', '_blank')
        if (!win) return
        win.document.write(`<html><head><title>${docType === 'full' ? 'ใบกำกับภาษี' : 'ใบเสร็จรับเงิน'}</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700;800&family=Inter:wght@400;600;700;800;900&display=swap');
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Sarabun', sans-serif; }
            @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        </style></head><body>${content.innerHTML}<script>window.onload=()=>{window.print();}</script></body></html>`)
        win.document.close()
    }

    const calcVAT = (totalIncVat: number) => {
        const beforeVat = totalIncVat / 1.07
        const vat = totalIncVat - beforeVat
        return { beforeVat, vat, total: totalIncVat }
    }
    const formatThaiDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })
    const genInvoiceNumber = (bookingNumber: string) => 'INV-' + bookingNumber.replace('BK', '')

    // ── Invoice/Receipt detail view ──
    if (selectedBooking) {
        const b = selectedBooking
        const { beforeVat, vat, total } = calcVAT(b.totalAmount)
        const invoiceNo = genInvoiceNumber(b.bookingNumber)
        const issueDate = formatThaiDate(b.createdAt)

        return (
            <div>
                {/* Toolbar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                    <button onClick={() => setSelectedBooking(null)} className="btn-admin-outline" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ChevronLeft size={16} /> กลับ
                    </button>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {/* Doc type toggle */}
                        <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--a-border)' }}>
                            <button onClick={() => setDocType('full')}
                                style={{
                                    padding: '8px 16px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, fontFamily: 'inherit',
                                    background: docType === 'full' ? 'var(--a-primary)' : 'white', color: docType === 'full' ? 'white' : 'var(--a-text-secondary)',
                                }}>
                                <FileText size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> ใบกำกับภาษี
                            </button>
                            <button onClick={() => setDocType('short')}
                                style={{
                                    padding: '8px 16px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, fontFamily: 'inherit',
                                    borderLeft: '1px solid var(--a-border)',
                                    background: docType === 'short' ? 'var(--a-primary)' : 'white', color: docType === 'short' ? 'white' : 'var(--a-text-secondary)',
                                }}>
                                <Receipt size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> ใบเสร็จแบบย่อ
                            </button>
                        </div>
                        <button onClick={handlePrint} className="btn-admin" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Printer size={16} /> พิมพ์ / PDF
                        </button>
                    </div>
                </div>

                <div ref={printRef}>
                    {docType === 'full' ? (
                        /* ──────── ใบกำกับภาษี/ใบเสร็จรับเงิน (เต็มรูป) ──────── */
                        <div style={{
                            background: 'white', maxWidth: '800px', margin: '0 auto', padding: '48px',
                            border: '1px solid #e5e7eb', borderRadius: '4px',
                            fontFamily: "'Sarabun', sans-serif", color: '#1a1a1a', fontSize: '14px', lineHeight: 1.6,
                        }}>
                            {/* Header */}
                            <div style={{ borderBottom: '3px solid #2563eb', paddingBottom: '24px', marginBottom: '24px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#2563eb', margin: 0 }}>SKI BKK</h1>
                                        <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>ซอยรามอินทรา 40 แขวงท่าแร้ง เขตบางเขน</p>
                                        <p style={{ fontSize: '13px', color: '#6b7280' }}>กรุงเทพมหานคร 10230</p>
                                        <p style={{ fontSize: '13px', color: '#6b7280' }}>โทร: xxx-xxx-xxxx</p>
                                        <p style={{ fontSize: '13px', color: '#6b7280' }}>เลขประจำตัวผู้เสียภาษี: x-xxxx-xxxxx-xx-x</p>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ background: '#2563eb', color: 'white', padding: '8px 20px', borderRadius: '4px', fontSize: '16px', fontWeight: 700, marginBottom: '12px' }}>
                                            ใบกำกับภาษี/ใบเสร็จรับเงิน
                                        </div>
                                        <div style={{ fontSize: '13px', color: '#6b7280' }}>
                                            <span style={{ fontWeight: 600, color: '#374151' }}>ต้นฉบับ</span> (เอกสารออกเป็นชุด)
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Invoice meta */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '28px' }}>
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontSize: '12px', color: '#6b7280', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>ลูกค้า</p>
                                    <p style={{ fontSize: '16px', fontWeight: 700, color: '#111' }}>{b.user.name}</p>
                                    <p style={{ fontSize: '13px', color: '#6b7280' }}>{b.user.email}</p>
                                    {b.user.phone && !b.user.phone.startsWith('LINE-') && !b.user.phone.startsWith('temp-') && (
                                        <p style={{ fontSize: '13px', color: '#6b7280' }}>โทร: {b.user.phone}</p>
                                    )}
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <table style={{ fontSize: '13px', borderCollapse: 'collapse' }}>
                                        <tbody>
                                            <tr><td style={{ padding: '3px 16px 3px 0', color: '#6b7280', fontWeight: 600 }}>เลขที่:</td><td style={{ padding: '3px 0', fontWeight: 700, color: '#111', fontFamily: "'Inter'" }}>{invoiceNo}</td></tr>
                                            <tr><td style={{ padding: '3px 16px 3px 0', color: '#6b7280', fontWeight: 600 }}>วันที่:</td><td style={{ padding: '3px 0' }}>{issueDate}</td></tr>
                                            <tr><td style={{ padding: '3px 16px 3px 0', color: '#6b7280', fontWeight: 600 }}>อ้างอิง:</td><td style={{ padding: '3px 0', fontFamily: "'Inter'" }}>{b.bookingNumber}</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Items table */}
                            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px' }}>
                                <thead>
                                    <tr style={{ background: '#f8fafc' }}>
                                        {['#', 'รายละเอียด', 'จำนวน', 'ราคาต่อหน่วย', 'ยอดรวม'].map((h, i) => (
                                            <th key={h} style={{
                                                padding: '10px 12px', fontSize: '12px', fontWeight: 700, color: '#374151',
                                                borderTop: '2px solid #e5e7eb', borderBottom: '2px solid #e5e7eb',
                                                textAlign: i >= 2 ? (i === 2 ? 'center' : 'right') : 'left',
                                            }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {b.bookingItems.map((item, idx) => (
                                        <tr key={idx}>
                                            <td style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0', fontSize: '13px' }}>{idx + 1}</td>
                                            <td style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0', fontSize: '13px' }}>
                                                <strong>{item.court.name}</strong><br />
                                                <span style={{ color: '#6b7280', fontSize: '12px' }}>วันที่ {formatThaiDate(item.date)} เวลา {item.startTime} - {item.endTime}</span>
                                            </td>
                                            <td style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0', fontSize: '13px', textAlign: 'center' }}>1</td>
                                            <td style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0', fontSize: '13px', textAlign: 'right', fontFamily: "'Inter'" }}>{item.price.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
                                            <td style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0', fontSize: '13px', textAlign: 'right', fontWeight: 600, fontFamily: "'Inter'" }}>{item.price.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {/* Totals */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <table style={{ width: '320px', borderCollapse: 'collapse', fontSize: '14px' }}>
                                    <tbody>
                                        <tr><td style={{ padding: '6px 12px', color: '#6b7280' }}>รวมเป็นเงิน</td><td style={{ padding: '6px 12px', textAlign: 'right', fontFamily: "'Inter'" }}>{beforeVat.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท</td></tr>
                                        <tr><td style={{ padding: '6px 12px', color: '#6b7280' }}>ภาษีมูลค่าเพิ่ม 7%</td><td style={{ padding: '6px 12px', textAlign: 'right', fontFamily: "'Inter'" }}>{vat.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท</td></tr>
                                        <tr style={{ borderTop: '2px solid #2563eb' }}>
                                            <td style={{ padding: '10px 12px', fontWeight: 800, fontSize: '16px', color: '#111' }}>จำนวนเงินรวมทั้งสิ้น</td>
                                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, fontSize: '16px', color: '#2563eb', fontFamily: "'Inter'" }}>{total.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Payment & Note */}
                            <div style={{ marginTop: '28px', padding: '16px', background: '#f8fafc', borderRadius: '4px', border: '1px solid #e5e7eb' }}>
                                <p style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>การชำระเงิน</p>
                                <p style={{ fontSize: '13px', color: '#6b7280' }}>
                                    {b.payments[0]?.method === 'PROMPTPAY' ? 'พร้อมเพย์' : 'โอนเงินผ่านธนาคาร'} • ชำระเงินเรียบร้อยแล้ว
                                </p>
                            </div>
                            <div style={{ marginTop: '20px', fontSize: '12px', color: '#9ca3af' }}>
                                <p style={{ fontWeight: 600, marginBottom: '4px' }}>หมายเหตุ</p>
                                <p>ราคาดังกล่าวรวมภาษีมูลค่าเพิ่ม 7% แล้ว</p>
                                <p>ขอบคุณที่ใช้บริการ SKI BKK</p>
                            </div>

                            {/* Signatures */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '60px', paddingTop: '20px', borderTop: '1px solid #e5e7eb' }}>
                                {['ผู้ชำระเงิน', 'ผู้รับเงิน'].map(label => (
                                    <div key={label} style={{ textAlign: 'center', width: '200px' }}>
                                        <div style={{ borderBottom: '1px dotted #9ca3af', height: '40px' }} />
                                        <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px' }}>{label}</p>
                                        <p style={{ fontSize: '11px', color: '#9ca3af' }}>วันที่ ___/___/______</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        /* ──────── ใบเสร็จรับเงิน/ใบกำกับภาษีแบบย่อ ──────── */
                        <div style={{
                            background: 'white', maxWidth: '400px', margin: '0 auto', padding: '32px 28px',
                            border: '1px solid #e5e7eb', borderRadius: '4px',
                            fontFamily: "'Sarabun', sans-serif", color: '#1a1a1a', fontSize: '13px', lineHeight: 1.6,
                        }}>
                            {/* Header */}
                            <div style={{ textAlign: 'center', marginBottom: '24px', borderBottom: '2px solid #111', paddingBottom: '16px' }}>
                                <h1 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 4px' }}>SKI BKK</h1>
                                <p style={{ fontSize: '11px', color: '#6b7280' }}>ซอยรามอินทรา 40 แขวงท่าแร้ง เขตบางเขน</p>
                                <p style={{ fontSize: '11px', color: '#6b7280' }}>กรุงเทพมหานคร 10230</p>
                                <p style={{ fontSize: '11px', color: '#6b7280' }}>เลขประจำตัวผู้เสียภาษี: x-xxxx-xxxxx-xx-x</p>
                                <div style={{ marginTop: '12px', fontWeight: 700, fontSize: '15px', borderTop: '1px solid #e5e7eb', paddingTop: '10px' }}>
                                    ใบเสร็จรับเงิน/ใบกำกับภาษีแบบย่อ
                                </div>
                            </div>

                            {/* Meta */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
                                <span>เลขที่เอกสาร:</span><span style={{ fontWeight: 700, fontFamily: "'Inter'" }}>{invoiceNo}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
                                <span>วันที่ขาย:</span><span>{issueDate}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: '12px' }}>
                                <span>พนักงานขาย:</span><span>-</span>
                            </div>

                            {/* Items */}
                            <div style={{ borderTop: '1px dashed #999', borderBottom: '1px dashed #999', padding: '10px 0', marginBottom: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '12px', marginBottom: '6px' }}>
                                    <span>รายการ</span><span style={{ display: 'flex', gap: '20px' }}><span>หน่วยละ</span><span>รวมเงิน</span></span>
                                </div>
                                {b.bookingItems.map((item, idx) => (
                                    <div key={idx} style={{ marginBottom: '6px' }}>
                                        <div style={{ fontWeight: 600 }}>{idx + 1} {item.court.name}</div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '16px', fontSize: '12px', color: '#555' }}>
                                            <span>{new Date(item.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} {item.startTime}-{item.endTime}</span>
                                            <span style={{ display: 'flex', gap: '14px' }}>
                                                <span style={{ fontFamily: "'Inter'", fontWeight: 600 }}>{item.price.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                                                <span style={{ fontFamily: "'Inter'", fontWeight: 600 }}>{item.price.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Totals */}
                            <div style={{ fontSize: '13px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                                    <span>รายการ: {b.bookingItems.length}</span><span>จำนวนชิ้น: {b.bookingItems.length}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                                    <span>รวมเป็นเงิน</span>
                                    <span style={{ fontFamily: "'Inter'", fontWeight: 600 }}>{b.totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                                    <span>ส่วนลด</span><span style={{ fontFamily: "'Inter'" }}>0.00</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '16px', borderTop: '1px solid #333', paddingTop: '6px', marginTop: '4px' }}>
                                    <span>รวมทั้งสิ้น</span>
                                    <span style={{ fontFamily: "'Inter'" }}>{b.totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                                </div>
                            </div>

                            {/* VAT breakdown */}
                            <div style={{ borderTop: '1px dashed #999', marginTop: '10px', paddingTop: '8px', fontSize: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                                    <span>รวมมูลค่าสินค้า</span>
                                    <span style={{ fontFamily: "'Inter'" }}>{beforeVat.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                                    <span>ภาษีมูลค่าเพิ่ม</span>
                                    <span style={{ fontFamily: "'Inter'" }}>{vat.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                                </div>
                            </div>

                            {/* Payment */}
                            <div style={{ borderTop: '1px dashed #999', marginTop: '10px', paddingTop: '8px', fontSize: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                                    <span>{b.payments[0]?.method === 'PROMPTPAY' ? 'พร้อมเพย์' : 'โอนเงิน'}</span>
                                    <span style={{ fontFamily: "'Inter'" }}>{b.totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                                </div>
                            </div>

                            {/* Footer */}
                            <div style={{ textAlign: 'center', marginTop: '24px', paddingTop: '12px', borderTop: '1px dashed #999', fontSize: '12px', color: '#6b7280' }}>
                                <p>ขอบคุณที่ใช้บริการ</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    // ── Main list ──
    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--a-text)' }}>ใบกำกับภาษี / ใบเสร็จรับเงิน</h2>
                    <p style={{ color: 'var(--a-text-secondary)', fontSize: '14px' }}>ออกใบกำกับภาษีและใบเสร็จรับเงินจากรายการจอง</p>
                </div>
                <div style={{ position: 'relative' }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--a-text-muted)' }} />
                    <input className="admin-input" style={{ width: '280px', paddingLeft: '36px' }} placeholder="ค้นหาเลขจอง / ชื่อลูกค้า" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
            </div>

            <div className="admin-card">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>เลขที่</th><th>หมายเลขจอง</th><th>ลูกค้า</th>
                            <th>มูลค่าก่อน VAT</th><th>VAT 7%</th><th>รวมทั้งสิ้น</th><th>วันที่</th><th>จัดการ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--a-text-muted)' }}>กำลังโหลด...</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan={8} style={{ textAlign: 'center', padding: '60px', color: 'var(--a-text-muted)' }}>
                                <FileText size={40} style={{ marginBottom: '12px', opacity: 0.4, display: 'block', margin: '0 auto 12px' }} />
                                <p style={{ fontWeight: 600 }}>ยังไม่มีรายการ</p>
                            </td></tr>
                        ) : filtered.map(b => {
                            const { beforeVat, vat, total } = calcVAT(b.totalAmount)
                            return (
                                <tr key={b.id}>
                                    <td style={{ fontWeight: 600, fontFamily: "'Inter'" }}>{genInvoiceNumber(b.bookingNumber)}</td>
                                    <td>{b.bookingNumber}</td>
                                    <td>{b.user.name}</td>
                                    <td>฿{beforeVat.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
                                    <td>฿{vat.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
                                    <td style={{ fontWeight: 700 }}>฿{total.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
                                    <td>{new Date(b.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            <button onClick={() => { setSelectedBooking(b); setDocType('full') }} className="btn-admin" style={{ padding: '6px 10px', fontSize: '12px' }} title="ใบกำกับภาษี">
                                                <FileText size={14} />
                                            </button>
                                            <button onClick={() => { setSelectedBooking(b); setDocType('short') }} className="btn-admin-outline" style={{ padding: '6px 10px', fontSize: '12px' }} title="ใบเสร็จแบบย่อ">
                                                <Receipt size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
