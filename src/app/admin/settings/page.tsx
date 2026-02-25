'use client'

import { useState, useEffect, useRef } from 'react'
import { Upload, Trash2, Plus, CalendarOff, FileText, Clock, UserPlus } from 'lucide-react'
import toast from 'react-hot-toast'
import { ImageIcon } from 'lucide-react'

export default function AdminSettingsPage() {
    const [logo, setLogo] = useState('')
    const [uploading, setUploading] = useState<string | null>(null)
    const [closedDates, setClosedDates] = useState<Array<{ id: string; date: string; reason: string | null }>>([])
    const [newClosedDate, setNewClosedDate] = useState('')
    const [newClosedReason, setNewClosedReason] = useState('')
    const [bookingTerms, setBookingTerms] = useState('')
    const [maxBookingHours, setMaxBookingHours] = useState(0)
    const [maxParticipants, setMaxParticipants] = useState(2)
    const logoInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        fetch('/api/settings', { cache: 'no-store' })
            .then(r => r.json())
            .then(data => {
                if (data.logo) setLogo(data.logo)
                if (data.booking_terms) setBookingTerms(data.booking_terms)
                if (data.max_booking_hours) setMaxBookingHours(parseInt(data.max_booking_hours) || 0)
                if (data.max_participants) setMaxParticipants(parseInt(data.max_participants) || 2)
            })
            .catch(() => { })
        fetch('/api/closed-dates').then(r => r.json()).then(d => setClosedDates(d.dates || [])).catch(() => { })
    }, [])

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
        <div>
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
                            <img src={logo} alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
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

            {/* Holiday closures */}
            <div style={cardStyle}>
                <h2 style={sectionTitle}><CalendarOff size={20} color="#e17055" /> วันหยุดพิเศษ (ปิดสนาม)</h2>
                <p style={{ fontSize: '13px', color: '#636e72', marginBottom: '16px' }}>กำหนดวันที่ปิดสนามพิเศษ เช่น วันปีใหม่ วันสงกรานต์</p>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                    <input type="date" className="admin-input" style={{ width: '180px' }} value={newClosedDate} onChange={e => setNewClosedDate(e.target.value)} />
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
                                    <span style={{ fontWeight: 700 }}>{new Date(d.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
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
        </div>
    )
}
