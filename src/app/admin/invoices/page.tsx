'use client'

import { useState, useEffect, useRef } from 'react'
import { FileText, Printer, Search, ChevronLeft, Receipt, Download, Edit3, Save } from 'lucide-react'
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

interface EditableItem {
    description: string
    detail: string
    qty: number
    unitPrice: number
}

// Stable components defined outside InvoicesPage to prevent focus loss on re-render
function EditField({ value, onChange, style, multiline, inputStyle, editMode }: {
    value: string; onChange: (v: string) => void; style?: React.CSSProperties; multiline?: boolean; inputStyle?: React.CSSProperties; editMode: boolean
}) {
    if (!editMode) return <span style={style}>{multiline ? value.split('\n').map((line, i) => <span key={i}>{line}<br /></span>) : value}</span>
    const baseInput: React.CSSProperties = {
        border: '1px dashed #93c5fd', background: 'rgba(59,130,246,0.04)',
        borderRadius: '4px', padding: '2px 6px', outline: 'none',
        fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 'inherit', color: 'inherit',
        width: '100%', ...inputStyle,
    }
    if (multiline) return <textarea value={value} onChange={e => onChange(e.target.value)} style={{ ...baseInput, minHeight: '50px', resize: 'vertical' }} />
    return <input type="text" value={value} onChange={e => onChange(e.target.value)} style={baseInput} />
}

function EditNumber({ value, onChange, style, editMode }: { value: number; onChange: (v: number) => void; style?: React.CSSProperties; editMode: boolean }) {
    if (!editMode) return <span style={style}>{value.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
    return <input type="number" step="0.01" value={value} onChange={e => onChange(parseFloat(e.target.value) || 0)}
        style={{
            border: '1px dashed #93c5fd', background: 'rgba(59,130,246,0.04)',
            borderRadius: '4px', padding: '2px 6px', outline: 'none',
            fontFamily: "'Inter'", fontSize: 'inherit', fontWeight: 'inherit', color: 'inherit',
            width: '100px', textAlign: 'right', ...style,
        }} />
}

export default function InvoicesPage() {
    const [bookings, setBookings] = useState<Booking[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
    const [docType, setDocType] = useState<DocType>('full')
    const [editMode, setEditMode] = useState(false)
    const printRef = useRef<HTMLDivElement>(null)

    // Editable fields
    const [companyName, setCompanyName] = useState('SKI BKK')
    const [companyAddress1, setCompanyAddress1] = useState('ซอยรามอินทรา 40 แขวงท่าแร้ง เขตบางเขน')
    const [companyAddress2, setCompanyAddress2] = useState('กรุงเทพมหานคร 10230')
    const [companyPhone, setCompanyPhone] = useState('xxx-xxx-xxxx')
    const [companyTaxId, setCompanyTaxId] = useState('x-xxxx-xxxxx-xx-x')
    const [customerName, setCustomerName] = useState('')
    const [customerEmail, setCustomerEmail] = useState('')
    const [customerPhone, setCustomerPhone] = useState('')
    const [invoiceNo, setInvoiceNo] = useState('')
    const [issueDate, setIssueDate] = useState('')
    const [refNo, setRefNo] = useState('')
    const [items, setItems] = useState<EditableItem[]>([])
    const [paymentNote, setPaymentNote] = useState('')
    const [remarkNote, setRemarkNote] = useState('ราคาดังกล่าวรวมภาษีมูลค่าเพิ่ม 7% แล้ว\nขอบคุณที่ใช้บริการ SKI BKK')
    const [payerName, setPayerName] = useState('')
    const [payerDate, setPayerDate] = useState('')
    const [receiverName, setReceiverName] = useState('')
    const [receiverDate, setReceiverDate] = useState('')

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

    const formatThaiDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })
    const genInvoiceNumber = (bookingNumber: string) => 'INV-' + bookingNumber.replace('BK', '')

    // Populate editable fields when booking is selected
    const selectBooking = (b: Booking, type: DocType) => {
        setSelectedBooking(b)
        setDocType(type)
        setEditMode(false)
        setCustomerName(b.user.name)
        setCustomerEmail(b.user.email)
        setCustomerPhone(b.user.phone && !b.user.phone.startsWith('LINE-') && !b.user.phone.startsWith('temp-') ? b.user.phone : '')
        setInvoiceNo(genInvoiceNumber(b.bookingNumber))
        setIssueDate(formatThaiDate(b.createdAt))
        setRefNo(b.bookingNumber)
        setItems(b.bookingItems.map(item => ({
            description: item.court.name,
            detail: `วันที่ ${formatThaiDate(item.date)} เวลา ${item.startTime} - ${item.endTime}`,
            qty: 1,
            unitPrice: item.price,
        })))
        setPaymentNote(b.payments[0]?.method === 'PROMPTPAY' ? 'พร้อมเพย์ • ชำระเงินเรียบร้อยแล้ว' : 'โอนเงินผ่านธนาคาร • ชำระเงินเรียบร้อยแล้ว')
        setPayerName('')
        setPayerDate('')
        setReceiverName('')
        setReceiverDate('')
    }

    // Calculate totals from editable items
    const itemTotal = items.reduce((s, item) => s + (item.qty * item.unitPrice), 0)
    const beforeVat = Math.round((itemTotal / 1.07) * 100) / 100
    const vat = Math.round((itemTotal - beforeVat) * 100) / 100

    const updateItem = (idx: number, field: keyof EditableItem, value: string | number) => {
        const updated = [...items]
        if (field === 'qty' || field === 'unitPrice') {
            updated[idx][field] = typeof value === 'string' ? parseFloat(value) || 0 : value
        } else {
            updated[idx][field as 'description' | 'detail'] = value as string
        }
        setItems(updated)
    }

    const addItem = () => {
        setItems([...items, { description: 'รายการใหม่', detail: '', qty: 1, unitPrice: 0 }])
    }

    const removeItem = (idx: number) => {
        if (items.length <= 1) return
        setItems(items.filter((_, i) => i !== idx))
    }

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

    const handleDownloadPDF = async () => {
        const content = printRef.current
        if (!content) return
        toast.loading('กำลังสร้าง PDF...', { id: 'pdf' })
        try {
            const html2pdf = (await import('html2pdf.js')).default
            await html2pdf().set({
                margin: [10, 10, 10, 10],
                filename: `${invoiceNo}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, letterRendering: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            }).from(content).save()
            toast.success('ดาวน์โหลด PDF สำเร็จ!', { id: 'pdf' })
        } catch (err) {
            console.error('PDF error:', err)
            toast.error('ไม่สามารถสร้าง PDF ได้', { id: 'pdf' })
        }
    }

    // EditField and EditNumber are defined outside the component to prevent focus loss

    // ── Invoice/Receipt detail view ──
    if (selectedBooking) {
        return (
            <div>
                {/* Toolbar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                    <button onClick={() => { setSelectedBooking(null); setEditMode(false) }} className="btn-admin-outline" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ChevronLeft size={16} /> กลับ
                    </button>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
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
                        {/* Edit toggle */}
                        <button onClick={() => setEditMode(!editMode)}
                            className={editMode ? 'btn-admin' : 'btn-admin-outline'}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {editMode ? <><Save size={16} /> บันทึก</> : <><Edit3 size={16} /> แก้ไข</>}
                        </button>
                        <button onClick={handlePrint} className="btn-admin-outline" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Printer size={16} /> พิมพ์
                        </button>
                        <button onClick={handleDownloadPDF} className="btn-admin" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Download size={16} /> ดาวน์โหลด PDF
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
                                        <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#2563eb', margin: 0 }}>
                                            <EditField editMode={editMode} value={companyName} onChange={setCompanyName} />
                                        </h1>
                                        <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
                                            <EditField editMode={editMode} value={companyAddress1} onChange={setCompanyAddress1} />
                                        </p>
                                        <p style={{ fontSize: '13px', color: '#6b7280' }}>
                                            <EditField editMode={editMode} value={companyAddress2} onChange={setCompanyAddress2} />
                                        </p>
                                        <p style={{ fontSize: '13px', color: '#6b7280' }}>
                                            โทร: <EditField editMode={editMode} value={companyPhone} onChange={setCompanyPhone} />
                                        </p>
                                        <p style={{ fontSize: '13px', color: '#6b7280' }}>
                                            เลขประจำตัวผู้เสียภาษี: <EditField editMode={editMode} value={companyTaxId} onChange={setCompanyTaxId} />
                                        </p>
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
                                    <p style={{ fontSize: '16px', fontWeight: 700, color: '#111' }}>
                                        <EditField editMode={editMode} value={customerName} onChange={setCustomerName} />
                                    </p>
                                    <p style={{ fontSize: '13px', color: '#6b7280' }}>
                                        <EditField editMode={editMode} value={customerEmail} onChange={setCustomerEmail} />
                                    </p>
                                    {(customerPhone || editMode) && (
                                        <p style={{ fontSize: '13px', color: '#6b7280' }}>
                                            โทร: <EditField editMode={editMode} value={customerPhone} onChange={setCustomerPhone} />
                                        </p>
                                    )}
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <table style={{ fontSize: '13px', borderCollapse: 'collapse' }}>
                                        <tbody>
                                            <tr>
                                                <td style={{ padding: '3px 16px 3px 0', color: '#6b7280', fontWeight: 600 }}>เลขที่:</td>
                                                <td style={{ padding: '3px 0', fontWeight: 700, color: '#111', fontFamily: "'Inter'" }}>
                                                    <EditField editMode={editMode} value={invoiceNo} onChange={setInvoiceNo} />
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style={{ padding: '3px 16px 3px 0', color: '#6b7280', fontWeight: 600 }}>วันที่:</td>
                                                <td style={{ padding: '3px 0' }}>
                                                    <EditField editMode={editMode} value={issueDate} onChange={setIssueDate} />
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style={{ padding: '3px 16px 3px 0', color: '#6b7280', fontWeight: 600 }}>อ้างอิง:</td>
                                                <td style={{ padding: '3px 0', fontFamily: "'Inter'" }}>
                                                    <EditField editMode={editMode} value={refNo} onChange={setRefNo} />
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Items table */}
                            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px' }}>
                                <thead>
                                    <tr style={{ background: '#f8fafc' }}>
                                        {['#', 'รายละเอียด', 'จำนวน', 'ราคาต่อหน่วย', 'ยอดรวม', ...(editMode ? [''] : [])].map((h, i) => (
                                            <th key={h + i} style={{
                                                padding: '10px 12px', fontSize: '12px', fontWeight: 700, color: '#374151',
                                                borderTop: '2px solid #e5e7eb', borderBottom: '2px solid #e5e7eb',
                                                textAlign: i >= 2 ? (i === 2 ? 'center' : 'right') : 'left',
                                                width: i === 5 ? '40px' : undefined,
                                            }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((item, idx) => (
                                        <tr key={idx}>
                                            <td style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0', fontSize: '13px' }}>{idx + 1}</td>
                                            <td style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0', fontSize: '13px' }}>
                                                <strong><EditField editMode={editMode} value={item.description} onChange={v => updateItem(idx, 'description', v)} /></strong><br />
                                                <span style={{ color: '#6b7280', fontSize: '12px' }}>
                                                    <EditField editMode={editMode} value={item.detail} onChange={v => updateItem(idx, 'detail', v)} />
                                                </span>
                                            </td>
                                            <td style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0', fontSize: '13px', textAlign: 'center' }}>
                                                <EditNumber editMode={editMode} value={item.qty} onChange={v => updateItem(idx, 'qty', v)} style={{ width: '60px', textAlign: 'center' }} />
                                            </td>
                                            <td style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0', fontSize: '13px', textAlign: 'right', fontFamily: "'Inter'" }}>
                                                <EditNumber editMode={editMode} value={item.unitPrice} onChange={v => updateItem(idx, 'unitPrice', v)} />
                                            </td>
                                            <td style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0', fontSize: '13px', textAlign: 'right', fontWeight: 600, fontFamily: "'Inter'" }}>
                                                {(item.qty * item.unitPrice).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                                            </td>
                                            {editMode && (
                                                <td style={{ padding: '10px 4px', borderBottom: '1px solid #f0f0f0', textAlign: 'center' }}>
                                                    <button onClick={() => removeItem(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '16px' }} title="ลบรายการ">✕</button>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {editMode && (
                                <button onClick={addItem} style={{
                                    marginBottom: '20px', padding: '6px 14px', fontSize: '12px', fontWeight: 600,
                                    border: '1px dashed #93c5fd', borderRadius: '6px', background: 'rgba(59,130,246,0.05)',
                                    color: '#2563eb', cursor: 'pointer', fontFamily: 'inherit',
                                }}>+ เพิ่มรายการ</button>
                            )}

                            {/* Totals */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <table style={{ width: '320px', borderCollapse: 'collapse', fontSize: '14px' }}>
                                    <tbody>
                                        <tr><td style={{ padding: '6px 12px', color: '#6b7280' }}>รวมเป็นเงิน</td><td style={{ padding: '6px 12px', textAlign: 'right', fontFamily: "'Inter'" }}>{beforeVat.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท</td></tr>
                                        <tr><td style={{ padding: '6px 12px', color: '#6b7280' }}>ภาษีมูลค่าเพิ่ม 7%</td><td style={{ padding: '6px 12px', textAlign: 'right', fontFamily: "'Inter'" }}>{vat.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท</td></tr>
                                        <tr style={{ borderTop: '2px solid #2563eb' }}>
                                            <td style={{ padding: '10px 12px', fontWeight: 800, fontSize: '16px', color: '#111' }}>จำนวนเงินรวมทั้งสิ้น</td>
                                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, fontSize: '16px', color: '#2563eb', fontFamily: "'Inter'" }}>{itemTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Payment & Note */}
                            <div style={{ marginTop: '28px', padding: '16px', background: '#f8fafc', borderRadius: '4px', border: '1px solid #e5e7eb' }}>
                                <p style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>การชำระเงิน</p>
                                <p style={{ fontSize: '13px', color: '#6b7280' }}>
                                    <EditField editMode={editMode} value={paymentNote} onChange={setPaymentNote} />
                                </p>
                            </div>
                            <div style={{ marginTop: '20px', fontSize: '12px', color: '#9ca3af' }}>
                                <p style={{ fontWeight: 600, marginBottom: '4px' }}>หมายเหตุ</p>
                                <EditField editMode={editMode} value={remarkNote} onChange={setRemarkNote} multiline />
                            </div>

                            {/* Signatures */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '60px', paddingTop: '20px', borderTop: '1px solid #e5e7eb' }}>
                                <div style={{ textAlign: 'center', width: '220px' }}>
                                    {editMode ? (
                                        <input type="text" value={payerName} onChange={e => setPayerName(e.target.value)} placeholder="พิมพ์ชื่อผู้ชำระเงิน"
                                            style={{ border: '1px dashed #93c5fd', background: 'rgba(59,130,246,0.04)', borderRadius: '4px', padding: '6px', outline: 'none', fontFamily: 'inherit', fontSize: '13px', width: '100%', textAlign: 'center', marginBottom: '4px' }} />
                                    ) : payerName ? (
                                        <p style={{ fontSize: '14px', fontWeight: 600, color: '#111', marginBottom: '4px' }}>{payerName}</p>
                                    ) : (
                                        <div style={{ borderBottom: '1px dotted #9ca3af', height: '40px' }} />
                                    )}
                                    <p style={{ fontSize: '12px', color: '#6b7280', marginTop: payerName && !editMode ? '0' : '6px' }}>ผู้ชำระเงิน</p>
                                    {editMode ? (
                                        <input type="text" value={payerDate} onChange={e => setPayerDate(e.target.value)} placeholder="วันที่"
                                            style={{ border: '1px dashed #93c5fd', background: 'rgba(59,130,246,0.04)', borderRadius: '4px', padding: '3px 6px', outline: 'none', fontFamily: 'inherit', fontSize: '11px', width: '120px', textAlign: 'center' }} />
                                    ) : (
                                        <p style={{ fontSize: '11px', color: '#9ca3af' }}>{payerDate || 'วันที่ ___/___/______'}</p>
                                    )}
                                </div>
                                <div style={{ textAlign: 'center', width: '220px' }}>
                                    {editMode ? (
                                        <input type="text" value={receiverName} onChange={e => setReceiverName(e.target.value)} placeholder="พิมพ์ชื่อผู้รับเงิน"
                                            style={{ border: '1px dashed #93c5fd', background: 'rgba(59,130,246,0.04)', borderRadius: '4px', padding: '6px', outline: 'none', fontFamily: 'inherit', fontSize: '13px', width: '100%', textAlign: 'center', marginBottom: '4px' }} />
                                    ) : receiverName ? (
                                        <p style={{ fontSize: '14px', fontWeight: 600, color: '#111', marginBottom: '4px' }}>{receiverName}</p>
                                    ) : (
                                        <div style={{ borderBottom: '1px dotted #9ca3af', height: '40px' }} />
                                    )}
                                    <p style={{ fontSize: '12px', color: '#6b7280', marginTop: receiverName && !editMode ? '0' : '6px' }}>ผู้รับเงิน</p>
                                    {editMode ? (
                                        <input type="text" value={receiverDate} onChange={e => setReceiverDate(e.target.value)} placeholder="วันที่"
                                            style={{ border: '1px dashed #93c5fd', background: 'rgba(59,130,246,0.04)', borderRadius: '4px', padding: '3px 6px', outline: 'none', fontFamily: 'inherit', fontSize: '11px', width: '120px', textAlign: 'center' }} />
                                    ) : (
                                        <p style={{ fontSize: '11px', color: '#9ca3af' }}>{receiverDate || 'วันที่ ___/___/______'}</p>
                                    )}
                                </div>
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
                                <h1 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 4px' }}>
                                    <EditField editMode={editMode} value={companyName} onChange={setCompanyName} />
                                </h1>
                                <p style={{ fontSize: '11px', color: '#6b7280' }}>
                                    <EditField editMode={editMode} value={companyAddress1} onChange={setCompanyAddress1} />
                                </p>
                                <p style={{ fontSize: '11px', color: '#6b7280' }}>
                                    <EditField editMode={editMode} value={companyAddress2} onChange={setCompanyAddress2} />
                                </p>
                                <p style={{ fontSize: '11px', color: '#6b7280' }}>
                                    เลขประจำตัวผู้เสียภาษี: <EditField editMode={editMode} value={companyTaxId} onChange={setCompanyTaxId} />
                                </p>
                                <div style={{ marginTop: '12px', fontWeight: 700, fontSize: '15px', borderTop: '1px solid #e5e7eb', paddingTop: '10px' }}>
                                    ใบเสร็จรับเงิน/ใบกำกับภาษีแบบย่อ
                                </div>
                            </div>

                            {/* Meta */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
                                <span>เลขที่เอกสาร:</span><span style={{ fontWeight: 700, fontFamily: "'Inter'" }}><EditField editMode={editMode} value={invoiceNo} onChange={setInvoiceNo} /></span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
                                <span>วันที่ขาย:</span><span><EditField editMode={editMode} value={issueDate} onChange={setIssueDate} /></span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: '12px' }}>
                                <span>พนักงานขาย:</span><span>-</span>
                            </div>

                            {/* Items */}
                            <div style={{ borderTop: '1px dashed #999', borderBottom: '1px dashed #999', padding: '10px 0', marginBottom: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '12px', marginBottom: '6px' }}>
                                    <span>รายการ</span><span style={{ display: 'flex', gap: '20px' }}><span>หน่วยละ</span><span>รวมเงิน</span></span>
                                </div>
                                {items.map((item, idx) => (
                                    <div key={idx} style={{ marginBottom: '6px' }}>
                                        <div style={{ fontWeight: 600 }}>{idx + 1} <EditField editMode={editMode} value={item.description} onChange={v => updateItem(idx, 'description', v)} /></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '16px', fontSize: '12px', color: '#555' }}>
                                            <span><EditField editMode={editMode} value={item.detail} onChange={v => updateItem(idx, 'detail', v)} /></span>
                                            <span style={{ display: 'flex', gap: '14px' }}>
                                                <span style={{ fontFamily: "'Inter'", fontWeight: 600 }}>{item.unitPrice.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                                                <span style={{ fontFamily: "'Inter'", fontWeight: 600 }}>{(item.qty * item.unitPrice).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Totals */}
                            <div style={{ fontSize: '13px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                                    <span>รายการ: {items.length}</span><span>จำนวนชิ้น: {items.reduce((s, i) => s + i.qty, 0)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                                    <span>รวมเป็นเงิน</span>
                                    <span style={{ fontFamily: "'Inter'", fontWeight: 600 }}>{itemTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                                    <span>ส่วนลด</span><span style={{ fontFamily: "'Inter'" }}>0.00</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '16px', borderTop: '1px solid #333', paddingTop: '6px', marginTop: '4px' }}>
                                    <span>รวมทั้งสิ้น</span>
                                    <span style={{ fontFamily: "'Inter'" }}>{itemTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
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
                                    <span><EditField editMode={editMode} value={paymentNote} onChange={setPaymentNote} /></span>
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
                            const bv = b.totalAmount / 1.07
                            const v = b.totalAmount - bv
                            return (
                                <tr key={b.id}>
                                    <td style={{ fontWeight: 600, fontFamily: "'Inter'" }}>{genInvoiceNumber(b.bookingNumber)}</td>
                                    <td>{b.bookingNumber}</td>
                                    <td>{b.user.name}</td>
                                    <td>฿{bv.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
                                    <td>฿{v.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
                                    <td style={{ fontWeight: 700 }}>฿{b.totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
                                    <td>{new Date(b.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            <button onClick={() => selectBooking(b, 'full')} className="btn-admin" style={{ padding: '6px 10px', fontSize: '12px' }} title="ใบกำกับภาษี">
                                                <FileText size={14} />
                                            </button>
                                            <button onClick={() => selectBooking(b, 'short')} className="btn-admin-outline" style={{ padding: '6px 10px', fontSize: '12px' }} title="ใบเสร็จแบบย่อ">
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
