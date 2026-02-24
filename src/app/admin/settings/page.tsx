'use client'

import { useState, useEffect, useRef } from 'react'
import { Upload, Trash2, Image as ImageIcon, GripVertical, Plus, Save, Check, CalendarOff, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import Image from 'next/image'

export default function AdminSettingsPage() {
    const [logo, setLogo] = useState('')
    const [banners, setBanners] = useState<string[]>([])
    const [gallery, setGallery] = useState<string[]>([])
    const [saving, setSaving] = useState(false)
    const [uploading, setUploading] = useState<string | null>(null) // 'logo' | 'banner' | 'gallery'
    const [closedDates, setClosedDates] = useState<Array<{ id: string; date: string; reason: string | null }>>([])
    const [newClosedDate, setNewClosedDate] = useState('')
    const [newClosedReason, setNewClosedReason] = useState('')
    const [bookingTerms, setBookingTerms] = useState('')
    const logoInputRef = useRef<HTMLInputElement>(null)
    const bannerInputRef = useRef<HTMLInputElement>(null)
    const galleryInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        fetch('/api/settings', { cache: 'no-store' })
            .then(r => r.json())
            .then(data => {
                if (data.logo) setLogo(data.logo)
                if (data.banners) setBanners(JSON.parse(data.banners))
                if (data.gallery) setGallery(JSON.parse(data.gallery))
                if (data.booking_terms) setBookingTerms(data.booking_terms)
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

    const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files) return
        setUploading('banner')
        const newBanners = [...banners]
        for (const file of Array.from(files)) {
            const url = await uploadFile(file)
            if (url) newBanners.push(url)
        }
        setBanners(newBanners)
        await saveSetting('banners', JSON.stringify(newBanners))
        toast.success('เพิ่ม Banner สำเร็จ')
        setUploading(null)
        e.target.value = ''
    }

    const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files) return
        setUploading('gallery')
        const newGallery = [...gallery]
        for (const file of Array.from(files)) {
            const url = await uploadFile(file)
            if (url) newGallery.push(url)
        }
        setGallery(newGallery)
        await saveSetting('gallery', JSON.stringify(newGallery))
        toast.success('เพิ่มรูปแกลเลอรีสำเร็จ')
        setUploading(null)
        e.target.value = ''
    }

    const removeBanner = async (index: number) => {
        const newBanners = banners.filter((_, i) => i !== index)
        setBanners(newBanners)
        await saveSetting('banners', JSON.stringify(newBanners))
        toast.success('ลบ Banner แล้ว')
    }

    const removeGallery = async (index: number) => {
        const newGallery = gallery.filter((_, i) => i !== index)
        setGallery(newGallery)
        await saveSetting('gallery', JSON.stringify(newGallery))
        toast.success('ลบรูปแกลเลอรีแล้ว')
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

    const uploadZone: React.CSSProperties = {
        border: '2px dashed #e0e0e0',
        borderRadius: '12px',
        padding: '32px',
        textAlign: 'center',
        cursor: 'pointer',
        transition: 'all 0.2s',
        background: '#fafafa',
    }

    return (
        <div>
            <div style={{ marginBottom: '24px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#2d3436' }}>ตั้งค่าเว็บไซต์</h1>
                <p style={{ color: '#636e72', fontSize: '14px', marginTop: '4px' }}>
                    จัดการ Logo, Banner หน้าแรก, แกลเลอรีรูปภาพ
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

            {/* Banner Section */}
            <div style={cardStyle}>
                <h2 style={sectionTitle}>
                    <ImageIcon size={20} color="#f5a623" /> Banner หน้าแรก (สไลด์โชว์)
                </h2>
                <p style={{ fontSize: '13px', color: '#636e72', marginBottom: '16px' }}>
                    รูปภาพ Banner จะสไลด์อัตโนมัติที่หน้าแรก (แนะนำ: 1920x600px, อัปโหลดได้หลายรูป)
                </p>

                {banners.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                        {banners.map((url, i) => (
                            <div key={i} style={{
                                position: 'relative', borderRadius: '12px', overflow: 'hidden',
                                border: '1px solid #e9ecef', aspectRatio: '16/6',
                            }}>
                                <img src={url} alt={`Banner ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                <button
                                    onClick={() => removeBanner(i)}
                                    style={{
                                        position: 'absolute', top: '8px', right: '8px',
                                        background: 'rgba(239,68,68,0.9)', color: 'white',
                                        border: 'none', borderRadius: '8px', width: '32px', height: '32px',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        cursor: 'pointer',
                                    }}
                                >
                                    <Trash2 size={16} />
                                </button>
                                <div style={{
                                    position: 'absolute', bottom: '8px', left: '8px',
                                    background: 'rgba(0,0,0,0.6)', color: 'white',
                                    padding: '2px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600,
                                }}>
                                    #{i + 1}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <input ref={bannerInputRef} type="file" accept="image/*" multiple hidden onChange={handleBannerUpload} />
                <div
                    style={uploadZone}
                    onClick={() => bannerInputRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#f5a623' }}
                    onDragLeave={e => { e.currentTarget.style.borderColor = '#e0e0e0' }}
                >
                    {uploading === 'banner' ? (
                        <div style={{ color: '#f5a623', fontWeight: 600 }}>กำลังอัปโหลด...</div>
                    ) : (
                        <>
                            <Plus size={32} color="#ccc" style={{ marginBottom: '8px' }} />
                            <div style={{ color: '#636e72', fontWeight: 600 }}>คลิกเพื่อเพิ่ม Banner</div>
                            <div style={{ color: '#b2bec3', fontSize: '13px', marginTop: '4px' }}>รองรับ PNG, JPG, WebP (สูงสุด 5MB)</div>
                        </>
                    )}
                </div>
            </div>

            {/* Gallery Section */}
            <div style={cardStyle}>
                <h2 style={sectionTitle}>
                    <ImageIcon size={20} color="#f5a623" /> แกลเลอรี / บรรยากาศ
                </h2>
                <p style={{ fontSize: '13px', color: '#636e72', marginBottom: '16px' }}>
                    รูปภาพบรรยากาศภายในสนาม จะแสดงที่หน้าแรก (แนะนำ: ขนาดอย่างน้อย 600x400px)
                </p>

                {gallery.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                        {gallery.map((url, i) => (
                            <div key={i} style={{
                                position: 'relative', borderRadius: '10px', overflow: 'hidden',
                                border: '1px solid #e9ecef', aspectRatio: '1',
                            }}>
                                <img src={url} alt={`Gallery ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                <button
                                    onClick={() => removeGallery(i)}
                                    style={{
                                        position: 'absolute', top: '6px', right: '6px',
                                        background: 'rgba(239,68,68,0.9)', color: 'white',
                                        border: 'none', borderRadius: '8px', width: '28px', height: '28px',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        cursor: 'pointer',
                                    }}
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <input ref={galleryInputRef} type="file" accept="image/*" multiple hidden onChange={handleGalleryUpload} />
                <div
                    style={uploadZone}
                    onClick={() => galleryInputRef.current?.click()}
                >
                    {uploading === 'gallery' ? (
                        <div style={{ color: '#f5a623', fontWeight: 600 }}>กำลังอัปโหลด...</div>
                    ) : (
                        <>
                            <Plus size={32} color="#ccc" style={{ marginBottom: '8px' }} />
                            <div style={{ color: '#636e72', fontWeight: 600 }}>คลิกเพื่อเพิ่มรูปแกลเลอรี</div>
                            <div style={{ color: '#b2bec3', fontSize: '13px', marginTop: '4px' }}>รองรับ PNG, JPG, WebP (สูงสุด 5MB)</div>
                        </>
                    )}
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
        </div>
    )
}
