'use client'

import { FadeIn } from '@/components/Motion'
import ConfirmModal from '@/components/ConfirmModal'
import DatePickerInput from '@/components/DatePickerInput'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { Upload, Trash2, Plus, CalendarOff, FileText, Clock, UserPlus, QrCode, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { ImageIcon } from 'lucide-react'
import { DEFAULT_LINE_CONFIRMATION_NOTE, DEFAULT_LINE_UPDATE_NOTE, DEFAULT_LINE_REMINDER_NOTE, normalizeLineEditableNote } from '@/lib/line-booking-notify'

export default function AdminSettingsPage() {
    const [logo, setLogo] = useState('')
    const [uploading, setUploading] = useState<string | null>(null)
    const [closedDates, setClosedDates] = useState<Array<{ id: string; date: string; reason: string | null }>>([])
    const [newClosedDate, setNewClosedDate] = useState('')
    const [newClosedReason, setNewClosedReason] = useState('')
    const [bookingTerms, setBookingTerms] = useState('')
    const [maxBookingHours, setMaxBookingHours] = useState(0)
    const [maxParticipants, setMaxParticipants] = useState(2)
    const [invoiceCompanyName, setInvoiceCompanyName] = useState('SKI BKK')
    const [invoiceCompanyAddress1, setInvoiceCompanyAddress1] = useState('ซอยรามอินทรา 40 แขวงท่าแร้ง เขตบางเขน')
    const [invoiceCompanyAddress2, setInvoiceCompanyAddress2] = useState('กรุงเทพมหานคร 10230')
    const [invoiceCompanyPhone, setInvoiceCompanyPhone] = useState('xxx-xxx-xxxx')
    const [invoiceCompanyTaxId, setInvoiceCompanyTaxId] = useState('x-xxxx-xxxxx-xx-x')
    const [invoiceRemarkNote, setInvoiceRemarkNote] = useState('ราคาดังกล่าวรวมภาษีมูลค่าเพิ่ม 7% แล้ว\nขอบคุณที่ใช้บริการ SKI BKK')
    const [lineBookingConfirmationTemplate, setLineBookingConfirmationTemplate] = useState(DEFAULT_LINE_CONFIRMATION_NOTE)
    const [lineBookingUpdateTemplate, setLineBookingUpdateTemplate] = useState(DEFAULT_LINE_UPDATE_NOTE)
    const [lineBookingReminderTemplate, setLineBookingReminderTemplate] = useState(DEFAULT_LINE_REMINDER_NOTE)
    const logoInputRef = useRef<HTMLInputElement>(null)
    const qrInputRef = useRef<HTMLInputElement>(null)
    const [qrImage, setQrImage] = useState<string | null>(null)
    const [qrReceiver, setQrReceiver] = useState<{ name: string; account: string; learnedAt: string | null; autoLearned: boolean } | null>(null)
    const [qrReceiverName, setQrReceiverName] = useState('')
    const [qrReceiverAccount, setQrReceiverAccount] = useState('')
    const [qrStatus, setQrStatus] = useState<'ready' | 'learning' | 'no_qr'>('no_qr')
    const [qrUploading, setQrUploading] = useState(false)
    const [qrSaving, setQrSaving] = useState(false)
    const [showResetConfirm, setShowResetConfirm] = useState(false)

    useEffect(() => {
        fetch('/api/settings', { cache: 'no-store' })
            .then(r => r.json())
            .then(data => {
                if (data.logo) setLogo(data.logo)
                if (data.booking_terms) setBookingTerms(data.booking_terms)
                if (data.max_booking_hours) setMaxBookingHours(parseInt(data.max_booking_hours) || 0)
                if (data.max_participants) setMaxParticipants(parseInt(data.max_participants) || 2)
                if (data.invoice_company_name) setInvoiceCompanyName(data.invoice_company_name)
                if (data.invoice_company_address1) setInvoiceCompanyAddress1(data.invoice_company_address1)
                if (data.invoice_company_address2) setInvoiceCompanyAddress2(data.invoice_company_address2)
                if (data.invoice_company_phone) setInvoiceCompanyPhone(data.invoice_company_phone)
                if (data.invoice_company_tax_id) setInvoiceCompanyTaxId(data.invoice_company_tax_id)
                if (data.invoice_remark_note) setInvoiceRemarkNote(data.invoice_remark_note)
                if (data.line_booking_confirmation_template) setLineBookingConfirmationTemplate(normalizeLineEditableNote(data.line_booking_confirmation_template, DEFAULT_LINE_CONFIRMATION_NOTE))
                if (data.line_booking_update_template) setLineBookingUpdateTemplate(normalizeLineEditableNote(data.line_booking_update_template, DEFAULT_LINE_UPDATE_NOTE))
                if (data.line_booking_reminder_template) setLineBookingReminderTemplate(normalizeLineEditableNote(data.line_booking_reminder_template, DEFAULT_LINE_REMINDER_NOTE))
            })
            .catch(() => { })
        fetch('/api/closed-dates').then(r => r.json()).then(d => setClosedDates(d.dates || [])).catch(() => { })
        // Load QR settings
        fetch('/api/admin/qr-settings').then(r => r.json()).then(data => {
            if (data.qrImage) setQrImage(data.qrImage)
            if (data.receiver) {
                setQrReceiver(data.receiver)
                setQrReceiverName(data.receiver.name || '')
                setQrReceiverAccount(data.receiver.account || '')
            }
            if (data.status) setQrStatus(data.status)
        }).catch(() => { })
    }, [])

    const saveQrReceiver = async () => {
        const name = qrReceiverName.trim()
        const account = qrReceiverAccount.trim()
        if (!name && !account) {
            toast.error('กรุณากรอกชื่อผู้รับหรือเลขบัญชีอย่างน้อย 1 ช่อง')
            return
        }

        setQrSaving(true)
        try {
            const res = await fetch('/api/admin/qr-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ receiver: { name, account } }),
            })
            const data = await res.json()
            if (!res.ok) {
                toast.error(data.error || 'บันทึกข้อมูลผู้รับไม่สำเร็จ')
                return
            }

            setQrReceiver(data.receiver || { name, account, learnedAt: new Date().toISOString(), autoLearned: false })
            setQrReceiverName(data.receiver?.name || name)
            setQrReceiverAccount(data.receiver?.account || account)
            setQrStatus(data.status || 'ready')
            toast.success(data.message || 'บันทึกข้อมูลบัญชีผู้รับสำเร็จ')
        } catch {
            toast.error('บันทึกข้อมูลผู้รับไม่สำเร็จ')
        } finally {
            setQrSaving(false)
        }
    }

    const uploadFile = async (file: File): Promise<string | null> => {
        const formData = new FormData()
        formData.append('file', file)
        try {
            const res = await fetch('/api/upload', { method: 'POST', body: formData })
            const data = await res.json()
            if (!res.ok) { toast.error(data.error || 'อัปโหลดไม่สำเร็จ'); return null }
            return data.url
        } catch {
            toast.error('อัปโหลดไม่สำเร็จ')
            return null
        }
    }

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setUploading('logo')
        const url = await uploadFile(file)
        if (url) {
            setLogo(url)
            await saveSetting('logo', url)
            toast.success('อัปโหลด Logo สำเร็จ')
        }
        setUploading(null)
        e.target.value = ''
    }

    const saveSetting = async (key: string, value: string) => {
        try {
            await fetch('/api/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, value }),
            })
        } catch {
            toast.error('บันทึกไม่สำเร็จ')
        }
    }

    const cardStyle: React.CSSProperties = {
        background: 'white',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        marginBottom: '24px',
    }

    const sectionTitle: React.CSSProperties = {
        fontSize: '18px',
        fontWeight: 700,
        color: '#2d3436',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    }



    return (
        <FadeIn><div>
            <div style={{ marginBottom: '24px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#2d3436' }}>ตั้งค่าเว็บไซต์</h1>
                <p style={{ color: '#636e72', fontSize: '14px', marginTop: '4px' }}>
                    จัดการ Logo, เงื่อนไขการจอง และวันหยุดพิเศษ
                </p>
            </div>

            {/* Logo Section */}
            <div style={cardStyle}>
                <h2 style={sectionTitle}>
                    <ImageIcon size={20} color="#f5a623" /> Logo เว็บไซต์
                </h2>
                <p style={{ fontSize: '13px', color: '#636e72', marginBottom: '16px' }}>
                    รูปภาพ Logo จะแสดงที่ Header ทุกหน้า (แนะนำ: PNG พื้นใส, ขนาด 200x200px ขึ้นไป)
                </p>

                <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
                    {logo ? (
                        <div style={{
                            width: '120px', height: '120px', borderRadius: '12px',
                            border: '2px solid #e9ecef', overflow: 'hidden',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: '#f8f9fa',
                        }}>
                            <Image
                                src={logo}
                                alt="Logo"
                                width={120}
                                height={120}
                                unoptimized
                                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                            />
                        </div>
                    ) : (
                        <div style={{
                            width: '120px', height: '120px', borderRadius: '12px',
                            border: '2px dashed #ddd', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', color: '#ccc', fontSize: '32px',
                        }}>
                            🖼️
                        </div>
                    )}
                    <div>
                        <input ref={logoInputRef} type="file" accept="image/*" hidden onChange={handleLogoUpload} />
                        <button
                            className="btn-admin"
                            onClick={() => logoInputRef.current?.click()}
                            disabled={uploading === 'logo'}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                            <Upload size={16} />
                            {uploading === 'logo' ? 'กำลังอัปโหลด...' : logo ? 'เปลี่ยน Logo' : 'อัปโหลด Logo'}
                        </button>
                    </div>
                </div>
            </div>

            {/* QR Code Payment — เลขบัญชี */}
            <div style={cardStyle}>
                <h2 style={sectionTitle}>
                    <QrCode size={20} color="#6c5ce7" /> QR Code ชำระเงิน
                </h2>

                <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
                    {/* Left: QR Display */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '0 0 auto' }}>
                        {/* THAI QR PAYMENT Header */}
                        <div style={{
                            background: 'linear-gradient(135deg, #1a237e, #283593)',
                            color: 'white', padding: '10px 32px', borderRadius: '10px 10px 0 0',
                            width: '280px', textAlign: 'center',
                            fontSize: '13px', fontWeight: 700, letterSpacing: '1px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        }}>
                            <QrCode size={16} /> THAI QR PAYMENT
                        </div>

                        {/* QR Image with click overlay */}
                        <div
                            onClick={() => qrInputRef.current?.click()}
                            style={{
                                width: '280px', minHeight: '280px',
                                border: '2px solid #e0e0e0', borderTop: 'none',
                                background: 'white', cursor: 'pointer',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                position: 'relative', padding: '16px',
                            }}
                        >
                            {qrImage ? (
                                <Image
                                    src={qrImage}
                                    alt="QR Payment"
                                    width={240}
                                    height={240}
                                    unoptimized
                                    style={{ width: '100%', maxWidth: '240px', height: 'auto' }}
                                />
                            ) : (
                                <div style={{
                                    width: '240px', height: '240px',
                                    border: '3px dashed #ccc', borderRadius: '12px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: '#bbb', fontSize: '60px',
                                }}>
                                    📱
                                </div>
                            )}

                            {/* Red overlay button */}
                            <div style={{
                                position: 'absolute', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
                                background: '#e53935', color: 'white',
                                padding: '8px 20px', borderRadius: '6px',
                                fontSize: '12px', fontWeight: 700,
                                boxShadow: '0 2px 8px rgba(229,57,53,0.4)',
                                whiteSpace: 'nowrap',
                                opacity: qrUploading ? 0.6 : 1,
                            }}>
                                {qrUploading ? 'กำลังอัปโหลด...' : 'คลิกเพื่อเปลี่ยน QR-CODE'}
                            </div>
                        </div>

                        {/* Merchant name below QR */}
                        <div style={{
                            width: '280px', background: 'white',
                            borderRadius: '0 0 10px 10px',
                            border: '2px solid #e0e0e0', borderTop: 'none',
                            padding: '14px', textAlign: 'center',
                        }}>
                            <div style={{ fontSize: '16px', fontWeight: 800, color: '#2d3436' }}>
                                {qrReceiverName || qrReceiver?.name || 'SKI BKK รามอินทรา40'}
                            </div>
                            <div style={{ fontSize: '13px', color: '#636e72', marginTop: '2px' }}>
                                SKI BKK
                            </div>
                        </div>
                    </div>

                    {/* Right: Info Panel */}
                    <div style={{ flex: 1, minWidth: '240px' }}>
                        {/* Status indicator */}
                        <div style={{
                            padding: '14px 18px', borderRadius: '10px', marginBottom: '20px',
                            background: qrStatus === 'ready' ? '#e8f5e9' : qrStatus === 'learning' ? '#fff8e1' : '#f5f5f5',
                            border: `1px solid ${qrStatus === 'ready' ? '#a5d6a7' : qrStatus === 'learning' ? '#ffe082' : '#e0e0e0'}`,
                            display: 'flex', alignItems: 'center', gap: '10px',
                        }}>
                            <span style={{ fontSize: '20px' }}>
                                {qrStatus === 'ready' ? '🟢' : qrStatus === 'learning' ? '🟡' : '⚪'}
                            </span>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: '14px', color: '#2d3436' }}>
                                    {qrStatus === 'ready' ? 'ระบบพร้อมใช้งาน'
                                        : qrStatus === 'learning' ? 'รอเรียนรู้ผู้รับจากสลิปแรก'
                                            : 'ยังไม่ได้ตั้งค่า QR Code'}
                                </div>
                                {qrStatus === 'ready' && qrReceiver?.learnedAt && (
                                    <div style={{ fontSize: '12px', color: '#636e72', marginTop: '2px' }}>
                                        เรียนรู้เมื่อ: {new Date(qrReceiver.learnedAt).toLocaleString('th-TH')}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Info fields */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div>
                                <div style={{ fontSize: '12px', color: '#636e72', marginBottom: '4px' }}>ชื่อบัญชี / ร้านค้า</div>
                                <div style={{
                                    padding: '10px 14px', borderRadius: '8px', border: '1px solid #e9ecef',
                                    background: '#f8f9fa', fontWeight: 600, fontSize: '14px', color: '#2d3436',
                                }}>
                                    {qrReceiver?.name || 'รอเรียนรู้จากสลิป...'}
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: '12px', color: '#636e72', marginBottom: '4px' }}>เลขบัญชี / รหัสร้าน</div>
                                <div style={{
                                    padding: '10px 14px', borderRadius: '8px', border: '1px solid #e9ecef',
                                    background: '#f8f9fa', fontWeight: 600, fontSize: '14px', color: '#2d3436',
                                }}>
                                    {qrReceiver?.account || 'รอเรียนรู้จากสลิป...'}
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>
                            <div>
                                <div style={{ fontSize: '12px', color: '#636e72', marginBottom: '4px' }}>à¸à¸£à¸­à¸à¸Šà¸·à¹ˆà¸­à¸œà¸¹à¹‰à¸£à¸±à¸šà¹€à¸­à¸‡ (à¸—à¸²à¸‡à¹€à¸¥à¸·à¸­à¸)</div>
                                <input
                                    className="admin-input"
                                    placeholder="เช่น SKI BKK"
                                    value={qrReceiverName}
                                    onChange={e => setQrReceiverName(e.target.value)}
                                />
                            </div>
                            <div>
                                <div style={{ fontSize: '12px', color: '#636e72', marginBottom: '4px' }}>à¸à¸£à¸­à¸à¹€à¸¥à¸‚à¸šà¸±à¸à¸Šà¸µà¹€à¸­à¸‡ (à¸—à¸²à¸‡à¹€à¸¥à¸·à¸­à¸)</div>
                                <input
                                    className="admin-input"
                                    placeholder="เช่น 014000003712049"
                                    value={qrReceiverAccount}
                                    onChange={e => setQrReceiverAccount(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Actions */}
                        <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <button className="btn-admin" disabled={qrSaving} onClick={saveQrReceiver}>
                                {qrSaving ? 'กำลังบันทึก...' : 'บันทึกข้อมูลผู้รับ'}
                            </button>
                            {qrStatus === 'ready' && (
                                <button
                                    className="btn-admin"
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#e17055' }}
                                    onClick={() => setShowResetConfirm(true)}
                                >
                                    <RefreshCw size={16} /> รีเซ็ตผู้รับ (เรียนรู้ใหม่)
                                </button>
                            )}

                            <p style={{ fontSize: '11px', color: '#b2bec3', lineHeight: 1.6 }}>
                                💡 คลิกที่รูป QR Code เพื่อเปลี่ยน — ระบบจะเรียนรู้ข้อมูลผู้รับอัตโนมัติจากสลิปแรกที่ตรวจสำเร็จ
                            </p>
                        </div>
                    </div>
                </div>

                {/* Hidden file input */}
                <input ref={qrInputRef} type="file" accept="image/*" hidden onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    setQrUploading(true)
                    try {
                        const reader = new FileReader()
                        const base64 = await new Promise<string>((resolve) => {
                            reader.onload = (ev) => resolve(ev.target?.result as string)
                            reader.readAsDataURL(file)
                        })
                        const res = await fetch('/api/admin/qr-settings', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ qrImage: base64 }),
                        })
                        const data = await res.json()
                        if (res.ok) {
                            setQrImage(base64)
                            setQrStatus(data.status || 'learning')
                            setQrReceiver(data.receiver || null)
                            if (!data.receiver) {
                                setQrReceiverName('')
                                setQrReceiverAccount('')
                            }
                            toast.success(data.message || 'อัปโหลด QR สำเร็จ!')
                        } else {
                            toast.error(data.error || 'อัปโหลดไม่สำเร็จ')
                        }
                    } catch {
                        toast.error('อัปโหลดไม่สำเร็จ')
                    } finally {
                        setQrUploading(false)
                        e.target.value = ''
                    }
                }} />
            </div>

            <div style={cardStyle}>
                <h2 style={sectionTitle}>
                    <FileText size={20} color="#2563eb" /> ข้อมูลเอกสารใบกำกับภาษี
                </h2>
                <p style={{ fontSize: '13px', color: '#636e72', marginBottom: '16px' }}>
                    ใช้เป็นค่าเริ่มต้นในทุกใบกำกับภาษีและใบเสร็จรับเงิน
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(240px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                    <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>ชื่อบริษัท / ร้าน</div>
                        <input className="admin-input" value={invoiceCompanyName} onChange={e => setInvoiceCompanyName(e.target.value)} />
                    </div>
                    <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>เบอร์โทร</div>
                        <input className="admin-input" value={invoiceCompanyPhone} onChange={e => setInvoiceCompanyPhone(e.target.value)} />
                    </div>
                    <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>ที่อยู่บรรทัด 1</div>
                        <input className="admin-input" value={invoiceCompanyAddress1} onChange={e => setInvoiceCompanyAddress1(e.target.value)} />
                    </div>
                    <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>ที่อยู่บรรทัด 2</div>
                        <input className="admin-input" value={invoiceCompanyAddress2} onChange={e => setInvoiceCompanyAddress2(e.target.value)} />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>เลขประจำตัวผู้เสียภาษี</div>
                        <input className="admin-input" value={invoiceCompanyTaxId} onChange={e => setInvoiceCompanyTaxId(e.target.value)} />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>หมายเหตุเริ่มต้น</div>
                        <textarea
                            className="admin-input"
                            rows={4}
                            style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.7 }}
                            value={invoiceRemarkNote}
                            onChange={e => setInvoiceRemarkNote(e.target.value)}
                        />
                    </div>
                </div>

                <button className="btn-admin" onClick={async () => {
                    await Promise.all([
                        saveSetting('invoice_company_name', invoiceCompanyName),
                        saveSetting('invoice_company_address1', invoiceCompanyAddress1),
                        saveSetting('invoice_company_address2', invoiceCompanyAddress2),
                        saveSetting('invoice_company_phone', invoiceCompanyPhone),
                        saveSetting('invoice_company_tax_id', invoiceCompanyTaxId),
                        saveSetting('invoice_remark_note', invoiceRemarkNote),
                    ])
                    toast.success('บันทึกข้อมูลเอกสารสำเร็จ')
                }}>บันทึกข้อมูลเอกสาร</button>
            </div>

            {/* Booking Terms */}
            <div style={cardStyle}>
                <h2 style={sectionTitle}><FileText size={20} color="#f5a623" /> เงื่อนไขการจอง</h2>
                <p style={{ fontSize: '13px', color: '#636e72', marginBottom: '12px' }}>ข้อความจะแสดงเป็น popup ตอนลูกค้ากดจอง (เว้นว่าง = ไม่แสดง popup)</p>
                <textarea
                    className="admin-input"
                    rows={6}
                    style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.8 }}
                    placeholder="พิมพ์เงื่อนไขการจองที่นี่..."
                    value={bookingTerms}
                    onChange={e => setBookingTerms(e.target.value)}
                    onBlur={() => { saveSetting('booking_terms', bookingTerms); toast.success('บันทึกเงื่อนไขแล้ว') }}
                />
            </div>

            <div style={cardStyle}>
                <h2 style={sectionTitle}><FileText size={20} color="#00b894" /> ข้อความ LINE แจ้งเตือน</h2>
                <p style={{ fontSize: '13px', color: '#636e72', marginBottom: '16px', lineHeight: 1.7 }}>
                    ปรับแต่งข้อความที่ส่งถึงลูกค้าผ่าน LINE เมื่อมีการยืนยัน อัปเดต หรือแจ้งเตือนล่วงหน้า
                    <br />
                    <span style={{ color: 'var(--a-primary)', fontWeight: 600 }}>💡 ข้อมูลที่ระบบดึงให้อัตโนมัติ (แก้ไขไม่ได้):</span> เลขจอง, ชื่อลูกค้า, ชื่อสนาม, วันที่ และเวลา
                </p>

                <div style={{ display: 'grid', gap: '16px', marginBottom: '14px' }}>
                    <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>ข้อความยืนยันการจอง</div>
                        <textarea
                            className="admin-input"
                            rows={10}
                            style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.7 }}
                            value={lineBookingConfirmationTemplate}
                            onChange={e => setLineBookingConfirmationTemplate(e.target.value)}
                        />
                    </div>
                    <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>ข้อความแจ้งอัปเดตการจอง</div>
                        <textarea
                            className="admin-input"
                            rows={10}
                            style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.7 }}
                            value={lineBookingUpdateTemplate}
                            onChange={e => setLineBookingUpdateTemplate(e.target.value)}
                        />
                    </div>
                    <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>ข้อความแจ้งเตือนล่วงหน้า (Reminder)</div>
                        <textarea
                            className="admin-input"
                            rows={10}
                            style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.7 }}
                            value={lineBookingReminderTemplate}
                            onChange={e => setLineBookingReminderTemplate(e.target.value)}
                        />
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button className="btn-admin" onClick={async () => {
                        await Promise.all([
                            saveSetting('line_booking_confirmation_template', lineBookingConfirmationTemplate),
                            saveSetting('line_booking_update_template', lineBookingUpdateTemplate),
                            saveSetting('line_booking_reminder_template', lineBookingReminderTemplate),
                        ])
                        toast.success('บันทึกข้อความ LINE สำเร็จ')
                    }}>บันทึกข้อความ LINE</button>
                    <button className="btn-admin-outline" onClick={() => {
                        setLineBookingConfirmationTemplate(DEFAULT_LINE_CONFIRMATION_NOTE)
                        setLineBookingUpdateTemplate(DEFAULT_LINE_UPDATE_NOTE)
                        setLineBookingReminderTemplate(DEFAULT_LINE_REMINDER_NOTE)
                    }}>คืนค่าเริ่มต้น</button>
                </div>
            </div>

            {/* Holiday closures */}
            <div style={cardStyle}>
                <h2 style={sectionTitle}><CalendarOff size={20} color="#e17055" /> วันหยุดพิเศษ (ปิดสนาม)</h2>
                <p style={{ fontSize: '13px', color: '#636e72', marginBottom: '16px' }}>กำหนดวันที่ปิดสนามพิเศษ เช่น วันปีใหม่ วันสงกรานต์</p>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                    <DatePickerInput value={newClosedDate} onChange={setNewClosedDate} style={{ width: '180px' }} />
                    <input className="admin-input" style={{ flex: 1, minWidth: '200px' }} placeholder="เหตุผล เช่น วันปีใหม่" value={newClosedReason} onChange={e => setNewClosedReason(e.target.value)} />
                    <button className="btn-admin" onClick={async () => {
                        if (!newClosedDate) { toast.error('เลือกวันที่'); return }
                        const res = await fetch('/api/closed-dates', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ date: newClosedDate, reason: newClosedReason }),
                        })
                        if (res.ok) {
                            toast.success('เพิ่มวันหยุดสำเร็จ')
                            setNewClosedDate(''); setNewClosedReason('')
                            fetch('/api/closed-dates').then(r => r.json()).then(d => setClosedDates(d.dates || []))
                        } else { toast.error('เกิดข้อผิดพลาด') }
                    }}><Plus size={16} /> เพิ่ม</button>
                </div>

                {closedDates.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {closedDates.map(d => (
                            <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderRadius: '8px', border: '1px solid #e9ecef' }}>
                                <div>
                                    <span style={{ fontWeight: 700 }}>{new Date(d.date).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                                    {d.reason && <span style={{ color: '#636e72', marginLeft: '12px', fontSize: '13px' }}>{d.reason}</span>}
                                </div>
                                <button onClick={async () => {
                                    await fetch('/api/closed-dates', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: d.id }) })
                                    setClosedDates(prev => prev.filter(x => x.id !== d.id))
                                    toast.success('ลบวันหยุดแล้ว')
                                }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e17055' }}><Trash2 size={16} /></button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Max Booking Hours */}
            <div style={cardStyle}>
                <h3 style={{ fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Clock size={20} style={{ color: 'var(--a-primary)' }} /> จำกัดจำนวนชั่วโมงต่อการจอง
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--a-text-muted)', marginBottom: '16px' }}>กำหนดจำนวนสูงสุดที่ลูกค้าสามารถจองได้ต่อครั้ง (0 = ไม่จำกัด)</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <input type="number" className="admin-input" style={{ width: '120px' }}
                        value={maxBookingHours} min={0} max={24}
                        onChange={e => setMaxBookingHours(parseInt(e.target.value) || 0)} />
                    <span style={{ color: 'var(--a-text-secondary)', fontSize: '14px' }}>ชั่วโมง</span>
                    <button className="btn-admin" onClick={() => {
                        saveSetting('max_booking_hours', String(maxBookingHours))
                        toast.success('บันทึกสำเร็จ')
                    }}>บันทึก</button>
                </div>
            </div>

            {/* Max Participants */}
            <div style={cardStyle}>
                <h3 style={{ fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <UserPlus size={20} style={{ color: 'var(--a-primary)' }} /> จำกัดจำนวนผู้เรียนต่อการจอง
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--a-text-muted)', marginBottom: '16px' }}>กำหนดจำนวนผู้เรียนสูงสุดที่ลูกค้าสามารถเพิ่มได้ต่อการจอง 1 ครั้ง</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <input type="number" className="admin-input" style={{ width: '120px' }}
                        value={maxParticipants} min={1} max={20}
                        onChange={e => setMaxParticipants(parseInt(e.target.value) || 2)} />
                    <span style={{ color: 'var(--a-text-secondary)', fontSize: '14px' }}>คน</span>
                    <button className="btn-admin" onClick={() => {
                        saveSetting('max_participants', String(maxParticipants))
                        toast.success('บันทึกสำเร็จ')
                    }}>บันทึก</button>
                </div>
            </div>

            <ConfirmModal
                open={showResetConfirm}
                title="รีเซ็ตผู้รับ"
                message="รีเซ็ตผู้รับ? ระบบจะเรียนรู้ใหม่จากสลิปถัดไป"
                confirmText="รีเซ็ต"
                type="warning"
                icon="🔄"
                onConfirm={async () => {
                    const res = await fetch('/api/admin/qr-settings', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ resetReceiver: true }),
                    })
                    const data = await res.json().catch(() => null)
                    setQrStatus(data?.status || (qrImage ? 'learning' : 'no_qr'))
                    setQrReceiver(null)
                    setQrReceiverName('')
                    setQrReceiverAccount('')
                    setShowResetConfirm(false)
                    toast.success('รีเซ็ตผู้รับแล้ว — จะเรียนรู้ใหม่จากสลิปถัดไป')
                }}
                onCancel={() => setShowResetConfirm(false)}
            />
        </div></FadeIn>
    )
}
