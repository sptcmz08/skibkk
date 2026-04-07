'use client'

import { FadeIn } from '@/components/Motion'

import { useState, useEffect, useRef } from 'react'
import { FileText, Calendar, Download, Printer } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatInvoiceNumberFromBookingNumber } from '@/lib/document-number-format'

const INVOICE_DEFAULTS = {
    companyName: 'SKI BKK',
    companyAddress1: 'ซอยรามอินทรา 40 แขวงท่าแร้ง เขตบางเขน',
    companyAddress2: 'กรุงเทพมหานคร 10230',
    companyPhone: 'xxx-xxx-xxxx',
    companyTaxId: 'x-xxxx-xxxxx-xx-x',
}

interface BookingItem { court: { name: string }; date: string; startTime: string; endTime: string; price: number }
interface Booking {
    id: string; bookingNumber: string; status: string; totalAmount: number; createdAt: string
    user: { name: string; email: string; phone: string }
    bookingItems: BookingItem[]
    participants: Array<{ name: string; sportType: string }>
    payments: Array<{ method: string; status: string; amount: number; createdAt: string }>
}

export default function InvoiceReportPage() {
    const [bookings, setBookings] = useState<Booking[]>([])
    const [loading, setLoading] = useState(true)
    const [exporting, setExporting] = useState(false)
    const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0])
    const printRef = useRef<HTMLDivElement>(null)

    // Company info (editable)
    const [companyName, setCompanyName] = useState(INVOICE_DEFAULTS.companyName)
    const [companyAddress1, setCompanyAddress1] = useState(INVOICE_DEFAULTS.companyAddress1)
    const [companyAddress2, setCompanyAddress2] = useState(INVOICE_DEFAULTS.companyAddress2)
    const [companyPhone, setCompanyPhone] = useState(INVOICE_DEFAULTS.companyPhone)
    const [companyTaxId, setCompanyTaxId] = useState(INVOICE_DEFAULTS.companyTaxId)

    useEffect(() => {
        Promise.all([
            fetch('/api/bookings?take=500', { cache: 'no-store' }).then(r => r.json()),
            fetch('/api/settings', { cache: 'no-store' }).then(r => r.json()).catch(() => ({})),
        ])
            .then(([bookingData, settings]) => {
                setBookings(bookingData.bookings || [])
                setCompanyName(settings.invoice_company_name || INVOICE_DEFAULTS.companyName)
                setCompanyAddress1(settings.invoice_company_address1 || INVOICE_DEFAULTS.companyAddress1)
                setCompanyAddress2(settings.invoice_company_address2 || INVOICE_DEFAULTS.companyAddress2)
                setCompanyPhone(settings.invoice_company_phone || INVOICE_DEFAULTS.companyPhone)
                setCompanyTaxId(settings.invoice_company_tax_id || INVOICE_DEFAULTS.companyTaxId)
            })
            .catch(() => toast.error('โหลดไม่สำเร็จ'))
            .finally(() => setLoading(false))
    }, [])

    const formatThaiDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })

    // Filter confirmed bookings where booking items fall on the selected date
    const filtered = bookings.filter(b => {
        if (b.status === 'CANCELLED') return false
        return b.bookingItems.some(item => item.date.split('T')[0] === selectedDate)
    })

    const totalRevenue = filtered.reduce((s, b) => s + b.totalAmount, 0)
    const vatRate = 0.07
    const totalBeforeVat = totalRevenue / (1 + vatRate)
    const totalVat = totalRevenue - totalBeforeVat

    const handleExportPDF = async () => {
        if (filtered.length === 0) { toast.error('ไม่มีรายการในวันที่เลือก'); return }
        if (!printRef.current) return

        setExporting(true)
        toast.loading('กำลังสร้าง PDF...', { id: 'pdf-export' })
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const html2pdf = (await import('html2pdf.js' as any)).default
            const dateLabel = formatThaiDate(selectedDate).replace(/ /g, '-')
            await html2pdf().set({
                margin: [8, 8, 8, 8],
                filename: `ใบกำกับภาษี-${dateLabel}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, letterRendering: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                pagebreak: { mode: ['css', 'legacy'], before: '.page-break' },
            }).from(printRef.current).save()
            toast.success(`ดาวน์โหลด PDF สำเร็จ! (${filtered.length} ใบ)`, { id: 'pdf-export' })
        } catch {
            toast.error('ไม่สามารถสร้าง PDF ได้', { id: 'pdf-export' })
        } finally {
            setExporting(false)
        }
    }

    const handlePrint = () => {
        if (!printRef.current) return
        const win = window.open('', '_blank')
        if (!win) return
        win.document.write(`<html><head><title>ใบกำกับภาษี ${formatThaiDate(selectedDate)}</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700;800&family=Inter:wght@400;600;700;800;900&display=swap');
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Sarabun', sans-serif; }
            .page-break { page-break-before: always; }
            @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        </style></head><body>${printRef.current.innerHTML}<script>window.onload=()=>{window.print();}</script></body></html>`)
        win.document.close()
    }

    // Render a single invoice for a booking
    const renderInvoice = (b: Booking) => {
        const invoiceNo = formatInvoiceNumberFromBookingNumber(b.bookingNumber)
        const items = b.bookingItems.map(item => ({
            description: item.court.name,
            detail: `วันที่ ${formatThaiDate(item.date)} เวลา ${item.startTime} - ${item.endTime}`,
            qty: 1,
            unitPrice: item.price,
        }))
        const itemTotal = items.reduce((s, item) => s + (item.qty * item.unitPrice), 0)
        const beforeVat = Math.round((itemTotal / 1.07) * 100) / 100
        const vat = Math.round((itemTotal - beforeVat) * 100) / 100
        const payMethod = b.payments[0]?.method === 'PROMPTPAY' ? 'พร้อมเพย์' : 'โอนเงินผ่านธนาคาร'
        const payStatus = b.payments.some(p => p.status === 'VERIFIED') ? 'ชำระเงินเรียบร้อยแล้ว' : 'รอชำระเงิน'

        return (
            <div style={{
                background: 'white', width: '100%', padding: '40px 48px',
                fontFamily: "'Sarabun', sans-serif", color: '#1a1a1a', fontSize: '14px', lineHeight: 1.6,
                minHeight: '1050px', display: 'flex', flexDirection: 'column',
            }}>
                {/* Header */}
                <div style={{ borderBottom: '3px solid #2563eb', paddingBottom: '20px', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#2563eb', margin: 0 }}>{companyName}</h1>
                            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>{companyAddress1}</p>
                            <p style={{ fontSize: '12px', color: '#6b7280' }}>{companyAddress2}</p>
                            <p style={{ fontSize: '12px', color: '#6b7280' }}>โทร: {companyPhone}</p>
                            <p style={{ fontSize: '12px', color: '#6b7280' }}>เลขประจำตัวผู้เสียภาษี: {companyTaxId}</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ background: '#2563eb', color: 'white', padding: '6px 16px', borderRadius: '4px', fontSize: '15px', fontWeight: 700, marginBottom: '8px' }}>
                                ใบกำกับภาษี/ใบเสร็จรับเงิน
                            </div>
                            <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                <span style={{ fontWeight: 600, color: '#374151' }}>ต้นฉบับ</span> (เอกสารออกเป็นชุด)
                            </div>
                        </div>
                    </div>
                </div>

                {/* Invoice meta */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
                    <div>
                        <p style={{ fontSize: '11px', color: '#6b7280', fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>ลูกค้า</p>
                        <p style={{ fontSize: '15px', fontWeight: 700, color: '#111' }}>{b.user.name}</p>
                        <p style={{ fontSize: '12px', color: '#6b7280' }}>{b.user.email}</p>
                        {b.user.phone && !b.user.phone.startsWith('LINE-') && !b.user.phone.startsWith('temp-') && (
                            <p style={{ fontSize: '12px', color: '#6b7280' }}>โทร: {b.user.phone}</p>
                        )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <table style={{ fontSize: '12px', borderCollapse: 'collapse' }}>
                            <tbody>
                                <tr>
                                    <td style={{ padding: '3px 12px 3px 0', color: '#6b7280', fontWeight: 600 }}>เลขที่:</td>
                                    <td style={{ padding: '3px 0', fontWeight: 700, color: '#111', fontFamily: "'Inter'" }}>{invoiceNo}</td>
                                </tr>
                                <tr>
                                    <td style={{ padding: '3px 12px 3px 0', color: '#6b7280', fontWeight: 600 }}>วันที่:</td>
                                    <td style={{ padding: '3px 0' }}>{formatThaiDate(b.createdAt)}</td>
                                </tr>
                                <tr>
                                    <td style={{ padding: '3px 12px 3px 0', color: '#6b7280', fontWeight: 600 }}>อ้างอิง:</td>
                                    <td style={{ padding: '3px 0', fontFamily: "'Inter'" }}>{b.bookingNumber}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Items table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
                    <thead>
                        <tr style={{ background: '#f8fafc' }}>
                            {['#', 'รายละเอียด', 'จำนวน', 'ราคาต่อหน่วย', 'ยอดรวม'].map((h, i) => (
                                <th key={h} style={{
                                    padding: '8px 10px', fontSize: '11px', fontWeight: 700, color: '#374151',
                                    borderTop: '2px solid #e5e7eb', borderBottom: '2px solid #e5e7eb',
                                    textAlign: i >= 2 ? (i === 2 ? 'center' : 'right') : 'left',
                                }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, idx) => (
                            <tr key={idx}>
                                <td style={{ padding: '8px 10px', borderBottom: '1px solid #f0f0f0', fontSize: '12px' }}>{idx + 1}</td>
                                <td style={{ padding: '8px 10px', borderBottom: '1px solid #f0f0f0', fontSize: '12px' }}>
                                    <strong>{item.description}</strong><br />
                                    <span style={{ color: '#6b7280', fontSize: '11px' }}>{item.detail}</span>
                                </td>
                                <td style={{ padding: '8px 10px', borderBottom: '1px solid #f0f0f0', fontSize: '12px', textAlign: 'center' }}>{item.qty}</td>
                                <td style={{ padding: '8px 10px', borderBottom: '1px solid #f0f0f0', fontSize: '12px', textAlign: 'right', fontFamily: "'Inter'" }}>{item.unitPrice.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
                                <td style={{ padding: '8px 10px', borderBottom: '1px solid #f0f0f0', fontSize: '12px', textAlign: 'right', fontWeight: 600, fontFamily: "'Inter'" }}>{(item.qty * item.unitPrice).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Totals */}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <table style={{ width: '280px', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <tbody>
                            <tr><td style={{ padding: '5px 10px', color: '#6b7280' }}>รวมเป็นเงิน</td><td style={{ padding: '5px 10px', textAlign: 'right', fontFamily: "'Inter'" }}>{beforeVat.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท</td></tr>
                            <tr><td style={{ padding: '5px 10px', color: '#6b7280' }}>ภาษีมูลค่าเพิ่ม 7%</td><td style={{ padding: '5px 10px', textAlign: 'right', fontFamily: "'Inter'" }}>{vat.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท</td></tr>
                            <tr style={{ borderTop: '2px solid #2563eb' }}>
                                <td style={{ padding: '8px 10px', fontWeight: 800, fontSize: '15px', color: '#111' }}>จำนวนเงินรวมทั้งสิ้น</td>
                                <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, fontSize: '15px', color: '#2563eb', fontFamily: "'Inter'" }}>{itemTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Payment & Note */}
                <div style={{ marginTop: '20px', padding: '12px', background: '#f8fafc', borderRadius: '4px', border: '1px solid #e5e7eb' }}>
                    <p style={{ fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '2px' }}>การชำระเงิน</p>
                    <p style={{ fontSize: '12px', color: '#6b7280' }}>{payMethod} • {payStatus}</p>
                </div>
                <div style={{ marginTop: '14px', fontSize: '11px', color: '#9ca3af' }}>
                    <p style={{ fontWeight: 600, marginBottom: '2px' }}>หมายเหตุ</p>
                    <p>ราคาดังกล่าวรวมภาษีมูลค่าเพิ่ม 7% แล้ว</p>
                    <p>ขอบคุณที่ใช้บริการ SKI BKK</p>
                </div>

                {/* Signatures */}
                <div style={{ flex: 1 }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '40px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
                    <div style={{ textAlign: 'center', width: '200px' }}>
                        <div style={{ borderBottom: '1px dotted #9ca3af', height: '36px' }} />
                        <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>ผู้ชำระเงิน</p>
                        <p style={{ fontSize: '10px', color: '#9ca3af' }}>วันที่ ___/___/______</p>
                    </div>
                    <div style={{ textAlign: 'center', width: '200px' }}>
                        <div style={{ borderBottom: '1px dotted #9ca3af', height: '36px' }} />
                        <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>ผู้รับเงิน</p>
                        <p style={{ fontSize: '10px', color: '#9ca3af' }}>วันที่ ___/___/______</p>
                    </div>
                </div>
            </div>
        )
    }

    if (loading) return <div style={{ textAlign: 'center', padding: '60px', color: 'var(--a-text-muted)' }}>กำลังโหลด...</div>

    return (
        <FadeIn><div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileText size={22} style={{ color: 'var(--a-primary)' }} /> รายใบกำกับภาษี
                    </h2>
                    <p style={{ color: 'var(--a-text-secondary)', fontSize: '14px' }}>เลือกวันที่เพื่อ Export ใบกำกับภาษีแต่ละออเดอร์เป็น PDF</p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <Calendar size={16} style={{ color: 'var(--a-text-muted)' }} />
                    <input type="date" className="admin-input" style={{ width: '160px' }} value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
                    <button onClick={handlePrint} className="btn-admin-outline" style={{ display: 'flex', alignItems: 'center', gap: '6px' }} disabled={filtered.length === 0}>
                        <Printer size={16} /> พิมพ์
                    </button>
                    <button onClick={handleExportPDF} className="btn-admin" style={{ display: 'flex', alignItems: 'center', gap: '6px' }} disabled={filtered.length === 0 || exporting}>
                        <Download size={16} /> {exporting ? 'กำลัง Export...' : `Export PDF (${filtered.length} ใบ)`}
                    </button>
                </div>
            </div>

            {/* Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px', marginBottom: '24px' }}>
                {[
                    { label: 'จำนวนใบ', value: filtered.length, color: '#2563eb' },
                    { label: 'ยอดก่อน VAT', value: `฿${Math.round(totalBeforeVat).toLocaleString()}`, color: '#27ae60' },
                    { label: 'VAT 7%', value: `฿${Math.round(totalVat).toLocaleString()}`, color: '#f5a623' },
                    { label: 'ยอดรวม', value: `฿${Math.round(totalRevenue).toLocaleString()}`, color: '#e17055' },
                ].map(s => (
                    <div key={s.label} className="admin-card" style={{ padding: '16px', textAlign: 'center' }}>
                        <div style={{ fontWeight: 800, fontSize: '22px', color: s.color, fontFamily: "'Inter', sans-serif" }}>{s.value}</div>
                        <div style={{ fontSize: '12px', color: 'var(--a-text-muted)' }}>{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Invoice list */}
            <div className="admin-card">
                <div style={{ padding: '16px', borderBottom: '1px solid var(--a-border)' }}>
                    <h3 style={{ fontWeight: 700, fontSize: '15px' }}>รายการใบกำกับภาษี — {formatThaiDate(selectedDate)}</h3>
                </div>
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>#</th><th>เลขที่</th><th>ลูกค้า</th><th>สนาม / เวลา</th><th>ก่อน VAT</th><th>VAT</th><th>รวม</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--a-text-muted)' }}>ไม่มีรายการในวันที่เลือก</td></tr>
                        ) : filtered.map((b, i) => {
                            const bVat = b.totalAmount / (1 + vatRate)
                            const bVatAmount = b.totalAmount - bVat
                            return (
                                <tr key={b.id}>
                                    <td>{i + 1}</td>
                                    <td style={{ fontWeight: 600, fontFamily: "'Inter'" }}>{formatInvoiceNumberFromBookingNumber(b.bookingNumber)}</td>
                                    <td>{b.user?.name}</td>
                                    <td style={{ fontSize: '12px' }}>
                                        {b.bookingItems.map((item, j) => (
                                            <div key={j}>{item.court.name} {item.startTime}-{item.endTime}</div>
                                        ))}
                                    </td>
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

            {/* Hidden print area — each invoice on its own page */}
            <div ref={printRef} style={{ position: 'absolute', left: '-9999px', top: 0, width: '780px' }}>
                {filtered.map((b, i) => (
                    <div key={b.id} className={i > 0 ? 'page-break' : ''}>
                        {renderInvoice(b)}
                    </div>
                ))}
            </div>
        </div></FadeIn>
    )
}
