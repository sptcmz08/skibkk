'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Users, UserCheck, Plus, Trash2, ArrowRight, ArrowLeft, CreditCard, QrCode, Building2, CheckCircle, Upload } from 'lucide-react'
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
    const [paymentMethod, setPaymentMethod] = useState<'PROMPTPAY' | 'BANK_TRANSFER'>('PROMPTPAY')
    const [loading, setLoading] = useState(false)
    const [bookingResult, setBookingResult] = useState<{ bookingNumber: string } | null>(null)
    const [user, setUser] = useState<{ name: string; phone: string } | null>(null)

    useEffect(() => {
        const stored = JSON.parse(localStorage.getItem('skibkk-cart') || '[]')
        if (stored.length === 0) { router.push('/courts'); return }
        setCart(stored)
        fetch('/api/auth/me').then(r => r.json()).then(d => { if (d.user) setUser(d.user) }).catch(() => { })
    }, [router])

    // Max participants: 2 per hour total
    const maxParticipants = cart.length * 2

    const addParticipant = () => {
        const currentCount = participants.length + (isBookerLearner ? 1 : 0)
        if (currentCount >= maxParticipants) {
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

    const total = cart.reduce((sum, item) => sum + item.price, 0)

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

            // Submit payment
            await fetch('/api/payments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bookingId: data.booking.id,
                    method: paymentMethod,
                    amount: total,
                }),
            })

            // Clear cart
            localStorage.setItem('skibkk-cart', '[]')
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
                                    ผู้เรียนคนที่ {idx + 1} {p.isBooker && <span style={{ color: 'var(--c-primary)', fontSize: '13px' }}>(ผู้จอง)</span>}
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
                                    <input className="input-field" placeholder="EU size" value={p.shoeSize} onChange={e => updateParticipant(idx, 'shoeSize', e.target.value)} />
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

                    {(participants.length + (isBookerLearner ? 1 : 0)) < maxParticipants && (
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
                                    background: paymentMethod === method.value ? 'rgba(102,126,234,0.1)' : undefined,
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
                                <div style={{ width: '200px', height: '200px', background: 'white', borderRadius: '12px', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <QrCode size={120} style={{ color: '#333' }} />
                                </div>
                                <p style={{ fontWeight: 700, fontSize: '16px' }}>สแกน QR Code เพื่อชำระเงิน</p>
                                <p style={{ color: 'var(--c-text-muted)', fontSize: '13px', marginTop: '4px' }}>
                                    พร้อมเพย์: xxx-xxx-xxxx (ตั้งค่าได้ใน Admin)
                                </p>
                            </div>
                        ) : (
                            <div>
                                <p style={{ fontWeight: 700, marginBottom: '12px' }}>ข้อมูลบัญชีธนาคาร</p>
                                <div style={{ background: 'rgba(102,126,234,0.08)', padding: '16px', borderRadius: '8px', fontSize: '14px', lineHeight: 2 }}>
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
                        <div style={{
                            border: '2px dashed var(--c-glass-border)',
                            borderRadius: '12px',
                            padding: '32px',
                            textAlign: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                        }}>
                            <Upload size={32} style={{ color: 'var(--c-text-muted)', marginBottom: '8px' }} />
                            <p style={{ color: 'var(--c-text-secondary)', fontSize: '14px' }}>คลิกหรือลากไฟล์มาวาง</p>
                            <p style={{ color: 'var(--c-text-muted)', fontSize: '12px', marginTop: '4px' }}>รองรับ JPG, PNG ขนาดไม่เกิน 5MB</p>
                        </div>
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
        </div>
    )
}
