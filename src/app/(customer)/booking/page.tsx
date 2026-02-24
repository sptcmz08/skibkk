'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Users, UserCheck, Plus, Trash2, ArrowRight, ArrowLeft, CreditCard, QrCode, Building2, CheckCircle, Upload, Package, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'

interface CartItem {
    courtId: string; courtName: string; date: string; startTime: string; endTime: string; price: number
}
interface Participant {
    name: string; sportType: string; age: string; shoeSize: string; weight: string; height: string; phone: string; isBooker: boolean
}

export default function BookingPage() {
    const router = useRouter()
    const [step, setStep] = useState(1) // 1=participants, 2=payment
    const [cart, setCart] = useState<CartItem[]>([])
    const [isBookerLearner, setIsBookerLearner] = useState(false)
    const [participants, setParticipants] = useState<Participant[]>([
        { name: '', sportType: '', age: '', shoeSize: '', weight: '', height: '', phone: '', isBooker: false },
    ])
    const BOOKING_DRAFT_KEY = 'skibkk-booking-draft'
    const [paymentMethod, setPaymentMethod] = useState<'PROMPTPAY' | 'BANK_TRANSFER' | 'PACKAGE'>('PROMPTPAY')
    const [loading, setLoading] = useState(false)
    const [bookingResult, setBookingResult] = useState<{ bookingNumber: string } | null>(null)
    const [user, setUser] = useState<{ name: string; phone: string; email: string } | null>(null)
    const [slipFile, setSlipFile] = useState<File | null>(null)
    const [slipPreview, setSlipPreview] = useState<string | null>(null)
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
    const [userPackages, setUserPackages] = useState<Array<{ id: string; remainingHours: number; expiresAt: string; package: { name: string } }>>([])
    const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null)
    const [showTerms, setShowTerms] = useState(false)
    const [termsText, setTermsText] = useState('')
    const [termsAccepted, setTermsAccepted] = useState(false)

    const total = cart.reduce((s, i) => s + i.price, 0)

    // Generate PromptPay QR when entering payment step
    useEffect(() => {
        if (step === 2 && paymentMethod === 'PROMPTPAY' && total > 0 && !qrDataUrl) {
            fetch('/api/payments/qr', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: total }),
            }).then(r => r.json())
                .then(data => { if (data.qrDataUrl) setQrDataUrl(data.qrDataUrl) })
                .catch(() => { })
        }
    }, [step, paymentMethod, total, qrDataUrl])

    // Fetch user packages when entering payment step
    useEffect(() => {
        if (step === 2) {
            fetch('/api/user-packages').then(r => r.json())
                .then(data => setUserPackages(data.packages || []))
                .catch(() => { })
        }
    }, [step])

    useEffect(() => {
        const stored = JSON.parse(localStorage.getItem('skibkk-cart') || '[]')
        if (stored.length === 0) { router.push('/courts'); return }
        setCart(stored)

        // Fetch booking terms from settings
        fetch('/api/settings', { cache: 'no-store' }).then(r => r.json())
            .then(data => {
                if (data.booking_terms) {
                    setTermsText(data.booking_terms)
                    setShowTerms(true)
                }
            }).catch(() => { })

        // Check auth — if not logged in, redirect back to cart (which will show auth modal)
        fetch('/api/auth/me', { cache: 'no-store' })
            .then(r => r.json())
            .then(d => {
                if (d.user) {
                    setUser(d.user)
                    // Auto-fill first participant with user profile data
                    setParticipants(prev => {
                        const updated = [...prev]
                        if (updated.length > 0 && !updated[0].name) {
                            updated[0] = {
                                ...updated[0],
                                name: d.user.name || '',
                                phone: d.user.phone || '',
                            }
                        }
                        return updated
                    })
                } else {
                    toast.error('กรุณาเข้าสู่ระบบก่อนดำเนินการจอง')
                    router.push('/cart')
                }
            })
            .catch(() => {
                toast.error('กรุณาเข้าสู่ระบบก่อนดำเนินการจอง')
                router.push('/cart')
            })

        // Restore draft from localStorage
        try {
            const draft = JSON.parse(localStorage.getItem(BOOKING_DRAFT_KEY) || 'null')
            if (draft) {
                if (draft.participants?.length) setParticipants(draft.participants)
                if (draft.isBookerLearner !== undefined) setIsBookerLearner(draft.isBookerLearner)
                if (draft.step) setStep(draft.step)
            }
        } catch { /* ignore */ }
    }, [router])

    // Auto-save draft to localStorage on every change
    useEffect(() => {
        if (!cart.length) return
        localStorage.setItem(BOOKING_DRAFT_KEY, JSON.stringify({
            participants, isBookerLearner, step,
        }))
    }, [participants, isBookerLearner, step, cart.length])

    // Max participants: 2 for customer booking
    const maxParticipants = 2

    const addParticipant = () => {
        if (participants.length >= maxParticipants) {
            toast.error(`จำนวนผู้เรียนเต็มแล้ว (สูงสุด ${maxParticipants} คน)`)
            return
        }
        setParticipants([...participants, { name: '', sportType: '', age: '', shoeSize: '', weight: '', height: '', phone: '', isBooker: false }])
    }

    const removeParticipant = (idx: number) => {
        setParticipants(participants.filter((_, i) => i !== idx))
    }

    const updateParticipant = (idx: number, field: keyof Participant, value: string) => {
        const updated = [...participants]
        updated[idx] = { ...updated[idx], [field]: value }
        // Snowboard lock: if participant 1 changes sport, force all others to match
        if (field === 'sportType' && idx === 0 && value === 'สโนว์บอร์ด') {
            for (let i = 1; i < updated.length; i++) {
                updated[i] = { ...updated[i], sportType: 'สโนว์บอร์ด' }
            }
            toast('ผู้เรียนทุกคนต้องเล่นสโนว์บอร์ดเหมือนกัน', { icon: '⚠️' })
        }
        // If not first participant and first is snowboard, force snowboard
        if (field === 'sportType' && idx > 0 && updated[0].sportType === 'สโนว์บอร์ด' && value !== 'สโนว์บอร์ด') {
            updated[idx] = { ...updated[idx], sportType: 'สโนว์บอร์ด' }
            toast.error('ผู้เรียนคนที่ 1 เลือกสโนว์บอร์ด คนอื่นต้องเลือกเหมือนกัน')
        }
        setParticipants(updated)
    }

    const handleBookerToggle = (checked: boolean) => {
        setIsBookerLearner(checked)
        if (checked && user) {
            // Auto-fill first participant with booker info
            const updated = [...participants]
            if (updated.length === 0) {
                updated.push({ name: user.name, sportType: '', age: '', shoeSize: '', weight: '', height: '', phone: user.phone || '', isBooker: true })
            } else {
                updated[0] = { ...updated[0], name: user.name, phone: user.phone || '', isBooker: true }
            }
            setParticipants(updated)
        }
    }



    const handleSubmitBooking = async () => {
        if (participants.some(p => !p.name || !p.sportType)) {
            toast.error('กรุณากรอกชื่อและประเภทกีฬาของผู้เรียนทุกคน')
            return
        }
        setLoading(true)
        try {
            const res = await fetch('/api/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: cart.map(item => ({
                        courtId: item.courtId,
                        courtName: item.courtName,
                        date: item.date,
                        startTime: item.startTime,
                        endTime: item.endTime,
                        price: item.price,
                    })),
                    totalAmount: total,
                    isBookerLearner,
                    participants: participants.map(p => ({
                        name: p.name,
                        sportType: p.sportType,
                        age: p.age ? parseInt(p.age) : null,
                        shoeSize: p.shoeSize || null,
                        weight: p.weight ? parseFloat(p.weight) : null,
                        height: p.height ? parseFloat(p.height) : null,
                        phone: p.phone || null,
                        isBooker: p.isBooker,
                    })),
                }),
            })
            const data = await res.json()
            if (!res.ok) {
                toast.error(data.error || 'ไม่สามารถจองได้')
                return
            }
            setBookingResult({ bookingNumber: data.booking.bookingNumber })

            // Handle payment based on method
            if (paymentMethod === 'PACKAGE' && selectedPackageId) {
                // Deduct from package
                const hoursToDeduct = cart.length // 1 hour per slot
                await fetch('/api/user-packages', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userPackageId: selectedPackageId, hoursToDeduct, bookingId: data.booking.id }),
                })
            } else {
                // Upload slip if attached
                let slipUrl: string | null = null
                if (slipFile) {
                    const formData = new FormData()
                    formData.append('file', slipFile)
                    const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData })
                    if (uploadRes.ok) {
                        const uploadData = await uploadRes.json()
                        slipUrl = uploadData.url
                    }
                }

                // Submit payment
                await fetch('/api/payments', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        bookingId: data.booking.id,
                        method: paymentMethod,
                        amount: total,
                        slipUrl,
                    }),
                })
            }

            // Clear cart and draft
            localStorage.setItem('skibkk-cart', '[]')
            localStorage.removeItem(BOOKING_DRAFT_KEY)
            window.dispatchEvent(new Event('cart-updated'))
            setStep(3) // success
            toast.success('จองสำเร็จ!')
        } catch {
            toast.error('เกิดข้อผิดพลาด')
        } finally {
            setLoading(false)
        }
    }

    if (cart.length === 0) return null

    return (
        <div style={{ maxWidth: '700px', margin: '0 auto', padding: '32px 24px' }}>
            {/* Back button */}
            {step < 3 && (
                <button
                    onClick={() => step === 1 ? router.back() : setStep(1)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        background: 'none', border: 'none', cursor: 'pointer', padding: '0',
                        color: 'var(--c-text-secondary)', fontSize: '14px', fontWeight: 600, marginBottom: '20px',
                    }}>
                    <ArrowLeft size={16} /> ย้อนกลับ
                </button>
            )}
            {/* Steps indicator */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '40px' }}>
                {['ข้อมูลผู้เรียน', 'ชำระเงิน', 'สำเร็จ'].map((label, i) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                            width: '32px', height: '32px', borderRadius: '50%',
                            background: step > i + 1 ? 'var(--c-gradient-success)' : step === i + 1 ? 'var(--c-gradient)' : 'var(--c-glass)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '13px', fontWeight: 700,
                            color: step >= i + 1 ? 'white' : 'var(--c-text-muted)',
                            border: step < i + 1 ? '2px solid var(--c-glass-border)' : 'none',
                        }}>
                            {step > i + 1 ? <CheckCircle size={16} /> : i + 1}
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: step === i + 1 ? 'var(--c-text)' : 'var(--c-text-muted)' }}>{label}</span>
                        {i < 2 && <div style={{ width: '40px', height: '2px', background: step > i + 1 ? 'var(--c-success)' : 'var(--c-glass-border)' }} />}
                    </div>
                ))}
            </div>

            {/* Step 1: Participants */}
            {step === 1 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                    <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Users size={24} style={{ color: 'var(--c-primary)' }} />
                        ข้อมูลผู้เรียน
                    </h2>
                    <p style={{ color: 'var(--c-text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
                        1 ชั่วโมง สามารถเพิ่มผู้เรียนได้ 2 คน (รวม {maxParticipants} คน)
                    </p>

                    {/* Booker is learner toggle */}
                    <div className="glass-card" style={{ cursor: 'default', marginBottom: '20px', padding: '16px 20px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={isBookerLearner}
                                onChange={(e) => handleBookerToggle(e.target.checked)}
                                style={{ width: '20px', height: '20px', accentColor: 'var(--c-primary)' }}
                            />
                            <div>
                                <UserCheck size={18} style={{ display: 'inline', marginRight: '8px', color: 'var(--c-primary)' }} />
                                <span style={{ fontWeight: 600 }}>ผู้จองคือผู้เรียน</span>
                                <p style={{ fontSize: '12px', color: 'var(--c-text-muted)', marginTop: '2px' }}>
                                    จะนับเป็น 1 ใน {maxParticipants} คน
                                </p>
                            </div>
                        </label>
                    </div>

                    {/* Participant forms */}
                    {participants.map((p, idx) => (
                        <motion.div key={idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}
                            className="glass-card" style={{ cursor: 'default', marginBottom: '16px' }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                                <h3 style={{ fontSize: '16px', fontWeight: 700 }}>
                                    ผู้เรียนคนที่ {idx + 1} {isBookerLearner && idx === 0 && <span style={{ color: 'var(--c-primary)', fontSize: '13px' }}>(ผู้จอง)</span>}
                                </h3>
                                {!p.isBooker && participants.length > 1 && (
                                    <button onClick={() => removeParticipant(idx)} style={{ background: 'none', border: 'none', color: 'var(--c-danger)', cursor: 'pointer', padding: '4px' }}>
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div className="input-group" style={{ gridColumn: 'span 2' }}>
                                    <label>ชื่อผู้เรียน *</label>
                                    <input className="input-field" placeholder="ชื่อ-สกุล" value={p.name} onChange={e => updateParticipant(idx, 'name', e.target.value)} required />
                                </div>
                                <div className="input-group">
                                    <label>ประเภทกีฬา *</label>
                                    <select className="input-field" value={p.sportType} onChange={e => updateParticipant(idx, 'sportType', e.target.value)} required>
                                        <option value="">เลือก</option>
                                        <option value="สกี">สกี</option>
                                        <option value="สโนว์บอร์ด">สโนว์บอร์ด</option>
                                        <option value="อื่นๆ">อื่นๆ</option>
                                    </select>
                                </div>
                                <div className="input-group">
                                    <label>อายุ</label>
                                    <input className="input-field" type="number" placeholder="ปี" value={p.age} onChange={e => updateParticipant(idx, 'age', e.target.value)} />
                                </div>
                                <div className="input-group">
                                    <label>ไซส์รองเท้า</label>
                                    <input className="input-field" placeholder="TH size" value={p.shoeSize} onChange={e => updateParticipant(idx, 'shoeSize', e.target.value)} />
                                </div>
                                <div className="input-group">
                                    <label>น้ำหนัก (kg)</label>
                                    <input className="input-field" type="number" placeholder="kg" value={p.weight} onChange={e => updateParticipant(idx, 'weight', e.target.value)} />
                                </div>
                                <div className="input-group">
                                    <label>ส่วนสูง (cm)</label>
                                    <input className="input-field" type="number" placeholder="cm" value={p.height} onChange={e => updateParticipant(idx, 'height', e.target.value)} />
                                </div>
                                <div className="input-group">
                                    <label>เบอร์โทรศัพท์</label>
                                    <input className="input-field" type="tel" placeholder="08x-xxx-xxxx" value={p.phone} onChange={e => updateParticipant(idx, 'phone', e.target.value)} />
                                </div>
                            </div>
                        </motion.div>
                    ))}

                    {participants.length < maxParticipants && (
                        <button onClick={addParticipant} className="btn btn-secondary btn-block" style={{ marginBottom: '20px' }}>
                            <Plus size={18} /> เพิ่มผู้เรียน
                        </button>
                    )}

                    <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                        <button onClick={() => router.push('/cart')} className="btn btn-secondary" style={{ flex: 1 }}>
                            <ArrowLeft size={18} /> กลับ
                        </button>
                        <button onClick={() => setStep(2)} className="btn btn-primary" style={{ flex: 2 }}>
                            ถัดไป: ชำระเงิน <ArrowRight size={18} />
                        </button>
                    </div>
                </motion.div>
            )}

            {/* Step 2: Payment */}
            {step === 2 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                    <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <CreditCard size={24} style={{ color: 'var(--c-primary)' }} />
                        ชำระเงิน
                    </h2>

                    {/* Order summary */}
                    <div className="glass-card" style={{ cursor: 'default', marginBottom: '24px' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>สรุปการจอง</h3>
                        {cart.map((item, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < cart.length - 1 ? '1px solid var(--c-border)' : 'none', fontSize: '14px' }}>
                                <span>{item.courtName} • {new Date(item.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} {item.startTime}-{item.endTime}</span>
                                <span style={{ fontWeight: 600 }}>฿{item.price.toLocaleString()}</span>
                            </div>
                        ))}
                        <div style={{ borderTop: '2px solid var(--c-border)', marginTop: '12px', paddingTop: '12px', display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '18px', fontWeight: 800 }}>ยอดรวม</span>
                            <span style={{ fontSize: '24px', fontWeight: 900, fontFamily: "'Inter'", background: 'var(--c-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>฿{total.toLocaleString()}</span>
                        </div>
                    </div>

                    {/* Payment methods */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '4px' }}>วิธีชำระเงิน</h3>
                        {[
                            { value: 'PROMPTPAY' as const, icon: <QrCode size={24} />, label: 'QR Code พร้อมเพย์', desc: 'สแกนจ่ายได้ทันที' },
                            { value: 'BANK_TRANSFER' as const, icon: <Building2 size={24} />, label: 'โอนผ่านธนาคาร', desc: 'โอนเงินและแนบสลิป' },
                            ...(userPackages.length > 0 ? [{ value: 'PACKAGE' as const, icon: <Package size={24} />, label: 'ใช้แพ็คเกจ', desc: `มี ${userPackages.length} แพ็คเกจ` }] : []),
                        ].map(method => (
                            <button
                                key={method.value}
                                onClick={() => setPaymentMethod(method.value)}
                                className="glass-card"
                                style={{
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '16px',
                                    border: paymentMethod === method.value ? '2px solid var(--c-primary)' : '1px solid var(--c-glass-border)',
                                    background: paymentMethod === method.value ? 'rgba(245,166,35,0.1)' : undefined,
                                    textAlign: 'left',
                                }}
                            >
                                <div style={{ color: paymentMethod === method.value ? 'var(--c-primary)' : 'var(--c-text-muted)' }}>
                                    {method.icon}
                                </div>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '15px' }}>{method.label}</div>
                                    <div style={{ fontSize: '13px', color: 'var(--c-text-muted)' }}>{method.desc}</div>
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* Payment info */}
                    <div className="glass-card" style={{ cursor: 'default', marginBottom: '24px' }}>
                        {paymentMethod === 'PROMPTPAY' ? (
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ width: '220px', height: '220px', background: 'white', borderRadius: '12px', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                    {qrDataUrl ? (
                                        <img src={qrDataUrl} alt="PromptPay QR" style={{ width: '200px', height: '200px' }} />
                                    ) : (
                                        <div className="spinner" style={{ width: '30px', height: '30px', borderTopColor: '#f5a623' }} />
                                    )}
                                </div>
                                <p style={{ fontWeight: 700, fontSize: '16px' }}>สแกน QR Code เพื่อชำระเงิน</p>
                                <p style={{ fontSize: '20px', fontWeight: 900, fontFamily: "'Inter'", color: 'var(--c-primary-light)', marginTop: '8px' }}>฿{total.toLocaleString()}</p>
                                <p style={{ color: 'var(--c-text-muted)', fontSize: '12px', marginTop: '4px' }}>
                                    จำนวนเงินจะแสดงอัตโนมัติเมื่อสแกน
                                </p>
                            </div>
                        ) : paymentMethod === 'PACKAGE' ? (
                            <div>
                                <p style={{ fontWeight: 700, marginBottom: '12px' }}>เลือกแพ็คเกจที่ต้องการใช้</p>
                                <p style={{ fontSize: '13px', color: 'var(--c-text-muted)', marginBottom: '12px' }}>
                                    ใช้ {cart.length} ชม. จากแพ็คเกจ (ไม่ต้องชำระเงินเพิ่ม)
                                </p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {userPackages.map(pkg => (
                                        <button
                                            key={pkg.id}
                                            onClick={() => setSelectedPackageId(pkg.id)}
                                            style={{
                                                padding: '14px 16px', borderRadius: '10px', cursor: 'pointer', textAlign: 'left',
                                                border: selectedPackageId === pkg.id ? '2px solid var(--c-primary)' : '1px solid var(--c-glass-border)',
                                                background: selectedPackageId === pkg.id ? 'rgba(245,166,35,0.15)' : 'rgba(255,255,255,0.04)',
                                                color: 'var(--c-text)', fontFamily: 'inherit',
                                            }}
                                        >
                                            <div style={{ fontWeight: 700, fontSize: '15px' }}>{pkg.package.name}</div>
                                            <div style={{ fontSize: '13px', color: 'var(--c-text-muted)', marginTop: '4px', display: 'flex', gap: '16px' }}>
                                                <span>เหลือ {pkg.remainingHours} ชม.</span>
                                                <span>หมดอายุ {new Date(pkg.expiresAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</span>
                                            </div>
                                            {pkg.remainingHours < cart.length && (
                                                <div style={{ fontSize: '12px', color: '#e17055', marginTop: '4px' }}>⚠️ ชั่วโมงไม่เพียงพอ</div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div>
                                <p style={{ fontWeight: 700, marginBottom: '12px' }}>ข้อมูลบัญชีธนาคาร</p>
                                <div style={{ background: 'rgba(245,166,35,0.08)', padding: '16px', borderRadius: '8px', fontSize: '14px', lineHeight: 2 }}>
                                    <div><strong>ธนาคาร:</strong> กสิกรไทย</div>
                                    <div><strong>เลขบัญชี:</strong> xxx-x-xxxxx-x</div>
                                    <div><strong>ชื่อบัญชี:</strong> SKIBKK Co., Ltd.</div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Slip upload */}
                    <div className="glass-card" style={{ cursor: 'default', marginBottom: '24px' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Upload size={18} /> แนบหลักฐานการชำระเงิน
                        </h3>

                        {slipPreview ? (
                            <div style={{ position: 'relative', display: 'inline-block' }}>
                                <img src={slipPreview} alt="slip" style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '12px', border: '1px solid var(--c-glass-border)' }} />
                                <button
                                    onClick={() => { setSlipFile(null); setSlipPreview(null) }}
                                    style={{
                                        position: 'absolute', top: '8px', right: '8px',
                                        width: '32px', height: '32px', borderRadius: '50%',
                                        background: 'rgba(245,87,108,0.9)', color: 'white',
                                        border: 'none', cursor: 'pointer', fontSize: '16px',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}
                                >✕</button>
                                <p style={{ fontSize: '13px', color: 'var(--c-text-secondary)', marginTop: '8px' }}>
                                    📎 {slipFile?.name}
                                </p>
                            </div>
                        ) : (
                            <label style={{ cursor: 'pointer', display: 'block' }}>
                                <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    style={{ display: 'none' }}
                                    onChange={(e) => {
                                        const file = e.target.files?.[0]
                                        if (!file) return
                                        if (file.size > 5 * 1024 * 1024) {
                                            toast.error('ไฟล์ต้องไม่เกิน 5MB')
                                            return
                                        }
                                        setSlipFile(file)
                                        setSlipPreview(URL.createObjectURL(file))
                                    }}
                                />
                                <div style={{
                                    border: '2px dashed var(--c-glass-border)',
                                    borderRadius: '12px',
                                    padding: '32px',
                                    textAlign: 'center',
                                    transition: 'all 0.2s',
                                }}>
                                    <Upload size={32} style={{ color: 'var(--c-text-muted)', marginBottom: '8px' }} />
                                    <p style={{ color: 'var(--c-text-secondary)', fontSize: '14px' }}>คลิกเพื่อเลือกไฟล์</p>
                                    <p style={{ color: 'var(--c-text-muted)', fontSize: '12px', marginTop: '4px' }}>รองรับ JPG, PNG ขนาดไม่เกิน 5MB</p>
                                </div>
                            </label>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button onClick={() => setStep(1)} className="btn btn-secondary" style={{ flex: 1 }}>
                            <ArrowLeft size={18} /> กลับ
                        </button>
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleSubmitBooking}
                            className="btn btn-success"
                            style={{ flex: 2 }}
                            disabled={loading}
                        >
                            {loading ? <div className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px' }} /> : <>ยืนยันการจอง <CheckCircle size={18} /></>}
                        </motion.button>
                    </div>
                </motion.div>
            )}

            {/* Step 3: Success */}
            {step === 3 && bookingResult && (
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} style={{ textAlign: 'center', padding: '40px 0' }}>
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                        style={{
                            width: '100px', height: '100px', borderRadius: '50%',
                            background: 'var(--c-gradient-success)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 24px',
                        }}
                    >
                        <CheckCircle size={48} style={{ color: '#0a0a1a' }} />
                    </motion.div>
                    <h2 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '8px' }}>จองสำเร็จ! 🎉</h2>
                    <p style={{ color: 'var(--c-text-secondary)', marginBottom: '24px' }}>
                        การจองของคุณได้รับการบันทึกเรียบร้อยแล้ว
                    </p>
                    <div className="glass-card" style={{ cursor: 'default', display: 'inline-block', padding: '20px 40px', marginBottom: '32px' }}>
                        <p style={{ fontSize: '13px', color: 'var(--c-text-muted)', marginBottom: '4px' }}>หมายเลขการจอง</p>
                        <p style={{ fontSize: '24px', fontWeight: 900, fontFamily: "'Inter'", letterSpacing: 1, background: 'var(--c-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                            {bookingResult.bookingNumber}
                        </p>
                    </div>
                    <p style={{ color: 'var(--c-text-muted)', fontSize: '14px', marginBottom: '32px' }}>
                        รายละเอียดการจองจะถูกส่งไปยังอีเมลของคุณ
                    </p>
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                        <button onClick={() => router.push('/profile')} className="btn btn-secondary">
                            ดูประวัติการจอง
                        </button>
                        <button onClick={() => router.push('/courts')} className="btn btn-primary">
                            จองเพิ่ม
                        </button>
                    </div>
                </motion.div>
            )}

            {/* Booking Terms Modal */}
            {showTerms && !termsAccepted && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
                }}>
                    <div style={{
                        background: 'var(--c-bg)', borderRadius: '20px', maxWidth: '500px', width: '100%',
                        padding: '32px', maxHeight: '80vh', overflow: 'auto',
                        border: '1px solid var(--c-glass-border)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                            <AlertTriangle size={24} style={{ color: '#f5a623' }} />
                            <h2 style={{ fontSize: '20px', fontWeight: 800 }}>เงื่อนไขการจอง</h2>
                        </div>
                        <div style={{
                            whiteSpace: 'pre-wrap', fontSize: '14px', lineHeight: 1.8,
                            color: 'var(--c-text-secondary)', marginBottom: '24px',
                            padding: '16px', background: 'var(--c-glass)', borderRadius: '12px',
                        }}>
                            {termsText}
                        </div>
                        <button
                            onClick={() => { setTermsAccepted(true); setShowTerms(false) }}
                            className="btn btn-primary btn-block"
                            style={{ fontWeight: 700, fontSize: '16px' }}
                        >
                            ยอมรับเงื่อนไข
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
