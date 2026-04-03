'use client'

import { FadeIn } from '@/components/Motion'

import { useState, useEffect, useRef } from 'react'
import { FileText, Printer, Search, ChevronLeft, Receipt, Download, Edit3, Save, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'
import XLSX from 'xlsx-js-style'
import { formatInvoiceNumberFromBookingNumber } from '@/lib/document-number-format'

interface BookingItem { court: { name: string }; date: string; startTime: string; endTime: string; price: number }
interface Booking {
    id: string; bookingNumber: string; status: string; totalAmount: number; createdAt: string
    user: { name: string; email: string; phone: string }
    bookingItems: BookingItem[]
    participants: Array<{ name: string; sportType: string }>
    payments: Array<{ method: string; status: string; amount: number; bankName?: string | null }>
}

type DocType = 'full' | 'short'

interface EditableItem {
    description: string
    detail: string
    qty: number
    unitPrice: number
}

type ExcelCell = { v: string | number; s: unknown }

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
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')
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

    const filtered = bookings.filter(b => {
        const matchSearch = b.bookingNumber.toLowerCase().includes(search.toLowerCase()) ||
            b.user.name.toLowerCase().includes(search.toLowerCase())
        if (!matchSearch) return false
        if (dateFrom) {
            const bDate = new Date(b.createdAt).toISOString().slice(0, 10)
            if (bDate < dateFrom) return false
        }
        if (dateTo) {
            const bDate = new Date(b.createdAt).toISOString().slice(0, 10)
            if (bDate > dateTo) return false
        }
        return true
    })

    const formatThaiDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })
    const formatShortDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const getServiceDatesText = (bookingItems: BookingItem[]) => {
        const uniqueDates = [...new Set(bookingItems.map(item => item.date.split('T')[0]))].sort()
        return uniqueDates.length > 0 ? uniqueDates.map(formatShortDate).join(', ') : '-'
    }

    // ── Excel Export — styled to match template ──
    const handleExportExcel = () => {
        if (filtered.length === 0) return toast.error('ไม่มีข้อมูลสำหรับ Export')

        const wb = XLSX.utils.book_new()

        // Styles
        const titleStyle = { font: { bold: true, sz: 14, name: 'TH SarabunPSK', color: { rgb: '006100' } }, alignment: { horizontal: 'left' as const, vertical: 'center' as const } }
        const subtitleStyle = { font: { sz: 11, name: 'TH SarabunPSK', color: { rgb: '006100' } }, alignment: { horizontal: 'left' as const, vertical: 'center' as const } }
        const border = { top: { style: 'thin' as const, color: { rgb: 'BBBBBB' } }, bottom: { style: 'thin' as const, color: { rgb: 'BBBBBB' } }, left: { style: 'thin' as const, color: { rgb: 'BBBBBB' } }, right: { style: 'thin' as const, color: { rgb: 'BBBBBB' } } }
        const headerStyle = {
            font: { bold: true, sz: 11, name: 'TH SarabunPSK', color: { rgb: '006100' } },
            fill: { fgColor: { rgb: 'FFFFDD' } }, border,
            alignment: { horizontal: 'center' as const, vertical: 'center' as const, wrapText: true },
        }
        const cellStyle = { font: { sz: 11, name: 'TH SarabunPSK' }, border, alignment: { vertical: 'center' as const } }
        const cellCenter = { ...cellStyle, alignment: { ...cellStyle.alignment, horizontal: 'center' as const } }
        const numStyle = { ...cellStyle, alignment: { ...cellStyle.alignment, horizontal: 'right' as const }, numFmt: '#,##0.00' }
        const totalsLabel = { ...headerStyle }
        const totalsNum = { ...numStyle, fill: { fgColor: { rgb: 'FFFFDD' } }, font: { bold: true, sz: 11, name: 'TH SarabunPSK' } }

        const rows: ExcelCell[][] = []

        // Row 0: Company name
        rows.push([{ v: 'บริษัท ขีเอิน เวิดส์ จำกัด', s: titleStyle }])
        // Row 1: Report title with period
        const periodLabel = dateFrom && dateTo
            ? `ประจำเดือน ${formatShortDate(dateFrom + 'T00:00:00')} - ${formatShortDate(dateTo + 'T00:00:00')}`
            : 'ประจำเดือน..................'
        rows.push([{ v: `รายงานรับเงิน (ภาษีจ่าย) ${periodLabel} (เรียงตามวันที่ใบเสร็จสำมาคาหา)`, s: subtitleStyle }])

        // Row 2-3: Header rows
        rows.push([
            { v: 'ลำดับที่', s: headerStyle },
            { v: 'วันที่ใบเสร็จ\n(ลำดับ)', s: headerStyle },
            { v: 'เลขที่ใบ/ออเดอร์', s: headerStyle },
            { v: 'รายการ (ชื่อกิจกรรม)', s: headerStyle },
            { v: 'ชื่อลูกค้า', s: headerStyle },
            { v: 'จำนวนเงิน', s: headerStyle },
            { v: '', s: headerStyle },
            { v: '', s: headerStyle },
            { v: 'วันที่รายการ', s: headerStyle },
            { v: 'วันที่ใช้บริการ', s: headerStyle },
            { v: 'การรับชำระเงิน', s: headerStyle },
            { v: '', s: headerStyle },
            { v: '', s: headerStyle },
            { v: '', s: headerStyle },
            { v: 'หมายเหตุ', s: headerStyle },
        ])
        rows.push([
            { v: '', s: headerStyle },
            { v: '', s: headerStyle },
            { v: '', s: headerStyle },
            { v: '', s: headerStyle },
            { v: '', s: headerStyle },
            { v: 'ก่อนภาษีมูลค่าเพิ่ม', s: headerStyle },
            { v: 'ภาษีมูลค่าเพิ่ม', s: headerStyle },
            { v: 'รวม', s: headerStyle },
            { v: '', s: headerStyle },
            { v: '', s: headerStyle },
            { v: 'วันที่/เวลา', s: headerStyle },
            { v: 'ธนาคาร #', s: headerStyle },
            { v: 'จำนวนเงิน', s: headerStyle },
            { v: '', s: headerStyle },
            { v: '(เช่น เลขที่ใบกำกับภาษีเดียวกัน)', s: headerStyle },
        ])

        // Data rows
        filtered.forEach((b, idx) => {
            const beforeVat = Math.round((b.totalAmount / 1.07) * 100) / 100
            const vatAmt = Math.round((b.totalAmount - beforeVat) * 100) / 100
            const serviceDate = getServiceDatesText(b.bookingItems)
            const payMethod = b.payments[0]?.method === 'PROMPTPAY' ? 'พร้อมเพย์' : (b.payments[0]?.method || '-')
            const payAmount = b.payments[0]?.amount || b.totalAmount
            const uniqueCourts = [...new Set(b.bookingItems.map(i => i.court.name))]
            const sportType = b.participants[0]?.sportType || ''
            const courtNames = uniqueCourts.join(', ') + (sportType ? ` (${sportType})` : '')

            rows.push([
                { v: idx + 1, s: cellCenter },
                { v: formatShortDate(b.createdAt), s: cellCenter },
                { v: formatInvoiceNumberFromBookingNumber(b.bookingNumber), s: cellStyle },
                { v: courtNames, s: cellStyle },
                { v: b.user.name, s: cellStyle },
                { v: beforeVat, s: numStyle },
                { v: vatAmt, s: numStyle },
                { v: b.totalAmount, s: numStyle },
                { v: formatShortDate(b.createdAt), s: cellCenter },
                { v: serviceDate, s: cellCenter },
                { v: formatShortDate(b.createdAt), s: cellCenter },
                { v: payMethod, s: cellStyle },
                { v: payAmount, s: numStyle },
                { v: '', s: cellStyle },
                { v: '', s: cellStyle },
            ])
        })

        // Totals row
        const totalBV = filtered.reduce((s, b) => s + Math.round((b.totalAmount / 1.07) * 100) / 100, 0)
        const totalV = filtered.reduce((s, b) => { const bv = Math.round((b.totalAmount / 1.07) * 100) / 100; return s + Math.round((b.totalAmount - bv) * 100) / 100 }, 0)
        const totalAll = filtered.reduce((s, b) => s + b.totalAmount, 0)
        rows.push([
            { v: '', s: totalsLabel },
            { v: 'รวม', s: totalsLabel },
            { v: '', s: totalsLabel },
            { v: '', s: totalsLabel },
            { v: '', s: totalsLabel },
            { v: totalBV, s: totalsNum },
            { v: totalV, s: totalsNum },
            { v: totalAll, s: totalsNum },
            { v: '', s: totalsLabel },
            { v: '', s: totalsLabel },
            { v: '', s: totalsLabel },
            { v: '', s: totalsLabel },
            { v: '', s: totalsLabel },
            { v: '', s: totalsLabel },
            { v: '', s: totalsLabel },
        ])

        const ws = XLSX.utils.aoa_to_sheet(rows)

        // Column widths
        ws['!cols'] = [
            { wch: 8 },   // A - ลำดับ
            { wch: 16 },  // B - วันที่
            { wch: 22 },  // C - เลขที่
            { wch: 28 },  // D - รายการ
            { wch: 20 },  // E - ชื่อลูกค้า
            { wch: 20 },  // F - ก่อน VAT
            { wch: 18 },  // G - VAT
            { wch: 14 },  // H - รวม
            { wch: 16 },  // I - วันที่รายการ
            { wch: 24 },  // J - วันที่ใช้บริการ
            { wch: 16 },  // K - วันที่ชำระ
            { wch: 14 },  // L - ธนาคาร
            { wch: 14 },  // M - จำนวนเงิน
            { wch: 6 },   // N
            { wch: 30 },  // O - หมายเหตุ
        ]

        // Merge cells (shifted +1 for new column E)
        ws['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 14 } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: 14 } },
            { s: { r: 2, c: 5 }, e: { r: 2, c: 7 } },
            { s: { r: 2, c: 10 }, e: { r: 2, c: 13 } },
            { s: { r: 2, c: 0 }, e: { r: 3, c: 0 } },
            { s: { r: 2, c: 1 }, e: { r: 3, c: 1 } },
            { s: { r: 2, c: 2 }, e: { r: 3, c: 2 } },
            { s: { r: 2, c: 3 }, e: { r: 3, c: 3 } },
            { s: { r: 2, c: 4 }, e: { r: 3, c: 4 } },
            { s: { r: 2, c: 8 }, e: { r: 3, c: 8 } },
            { s: { r: 2, c: 9 }, e: { r: 3, c: 9 } },
            { s: { r: 2, c: 14 }, e: { r: 3, c: 14 } },
        ]

        // Row heights
        ws['!rows'] = [{ hpt: 24 }, { hpt: 20 }, { hpt: 30 }, { hpt: 30 }]

        XLSX.utils.book_append_sheet(wb, ws, 'ใบกำกับภาษี')

        const dateLabel = dateFrom && dateTo ? `${dateFrom}_${dateTo}` : new Date().toISOString().slice(0, 10)
        XLSX.writeFile(wb, `invoices_${dateLabel}.xlsx`)
        toast.success('Export Excel สำเร็จ!')
    }

    // Populate editable fields when booking is selected
    const selectBooking = (b: Booking, type: DocType) => {
        setSelectedBooking(b)
        setDocType(type)
        setEditMode(false)
        setCustomerName(b.user.name)
        setCustomerEmail(b.user.email)
        setCustomerPhone(b.user.phone && !b.user.phone.startsWith('LINE-') && !b.user.phone.startsWith('temp-') ? b.user.phone : '')
        setInvoiceNo(formatInvoiceNumberFromBookingNumber(b.bookingNumber))
        setIssueDate(formatThaiDate(b.createdAt))
        setRefNo(b.bookingNumber)
        setItems(b.bookingItems.map(item => ({
            description: item.court.name,
            detail: `วันที่ ${formatThaiDate(item.date)} เวลา ${item.startTime} - ${item.endTime}`,
            qty: 1,
            unitPrice: item.price,
        })))
        const pm = b.payments[0]
        let payNote = 'ชำระเงินเรียบร้อยแล้ว'
        if (pm) {
            if (pm.method === 'CASH') payNote = 'เงินสด • ชำระเงินเรียบร้อยแล้ว'
            else if (pm.method === 'BANK_TRANSFER') payNote = `โอนเงินผ่านธนาคาร${pm.bankName ? ' (' + pm.bankName + ')' : ''} • ชำระเงินเรียบร้อยแล้ว`
            else if (pm.method === 'CREDIT_CARD') payNote = 'บัตรเครดิต • ชำระเงินเรียบร้อยแล้ว'
            else if (pm.method === 'PROMPTPAY') payNote = 'พร้อมเพย์ • ชำระเงินเรียบร้อยแล้ว'
        }
        setPaymentNote(payNote)
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
        <FadeIn><div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--a-text)' }}>ใบกำกับภาษี / ใบเสร็จรับเงิน</h2>
                    <p style={{ color: 'var(--a-text-secondary)', fontSize: '14px' }}>ออกใบกำกับภาษีและใบเสร็จรับเงินจากรายการจอง</p>
                </div>
                <button onClick={handleExportExcel} className="btn-admin" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px', fontSize: '14px', background: '#16a34a' }}>
                    <Download size={16} /> Export Excel
                </button>
            </div>

            {/* Date range + search */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Calendar size={16} style={{ color: 'var(--a-text-muted)' }} />
                    <input type="date" className="admin-input" style={{ width: '160px' }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                    <span style={{ color: 'var(--a-text-muted)', fontSize: '13px' }}>ถึง</span>
                    <input type="date" className="admin-input" style={{ width: '160px' }} value={dateTo} onChange={e => setDateTo(e.target.value)} />
                    {(dateFrom || dateTo) && (
                        <button onClick={() => { setDateFrom(''); setDateTo('') }} className="btn-admin-outline" style={{ padding: '7px 12px', fontSize: '12px' }}>ล้าง</button>
                    )}
                </div>
                <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--a-text-muted)' }} />
                    <input className="admin-input" style={{ width: '100%', paddingLeft: '36px' }} placeholder="ค้นหาเลขจอง / ชื่อลูกค้า" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
            </div>

            <div className="admin-card">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>เลขที่</th><th>หมายเลขจอง</th><th>ลูกค้า</th>
                            <th>มูลค่าก่อน VAT</th><th>VAT 7%</th><th>รวมทั้งสิ้น</th><th>การชำระเงิน</th><th>วันที่</th><th>จัดการ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--a-text-muted)' }}>กำลังโหลด...</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan={9} style={{ textAlign: 'center', padding: '60px', color: 'var(--a-text-muted)' }}>
                                <FileText size={40} style={{ marginBottom: '12px', opacity: 0.4, display: 'block', margin: '0 auto 12px' }} />
                                <p style={{ fontWeight: 600 }}>ยังไม่มีรายการ</p>
                            </td></tr>
                        ) : filtered.map(b => {
                            const bv = b.totalAmount / 1.07
                            const v = b.totalAmount - bv
                            return (
                                <tr key={b.id}>
                                    <td style={{ fontWeight: 600, fontFamily: "'Inter'" }}>{formatInvoiceNumberFromBookingNumber(b.bookingNumber)}</td>
                                    <td>{b.bookingNumber}</td>
                                    <td>{b.user.name}</td>
                                    <td>฿{bv.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
                                    <td>฿{v.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
                                    <td style={{ fontWeight: 700 }}>฿{b.totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
                                    <td>
                                        {(() => {
                                            const pm = b.payments[0]
                                            if (!pm) return <span style={{ color: '#9ca3af' }}>-</span>
                                            const methodMap: Record<string, { label: string; color: string; bg: string }> = {
                                                BANK_TRANSFER: { label: 'โอนเงิน', color: '#2563eb', bg: '#eff6ff' },
                                                PROMPTPAY: { label: 'พร้อมเพย์', color: '#7c3aed', bg: '#f5f3ff' },
                                                CASH: { label: 'เงินสด', color: '#16a34a', bg: '#f0fdf4' },
                                                CREDIT_CARD: { label: 'บัตรเครดิต', color: '#ea580c', bg: '#fff7ed' },
                                            }
                                            const m = methodMap[pm.method] || { label: pm.method, color: '#6b7280', bg: '#f3f4f6' }
                                            return (
                                                <span style={{ padding: '3px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, background: m.bg, color: m.color, whiteSpace: 'nowrap' }}>
                                                    {m.label}
                                                </span>
                                            )
                                        })()}
                                    </td>
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
        </div></FadeIn>
    )
}
