'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, MapPin, Clock, Calendar, Users, CreditCard, CheckCircle, AlertCircle, XCircle, FileText, Dumbbell, Plus, Trash2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import toast from 'react-hot-toast'

interface BookingDetail {
    id: string; bookingNumber: string; status: string; totalAmount: number; createdAt: string
    isBookerLearner: boolean; notes?: string
    user: { name: string; email: string; phone: string; lineDisplayName?: string; lineAvatar?: string }
    bookingItems: Array<{
        id: string; courtId: string; court: { name: string }; date: string
        startTime: string; endTime: string; price: number
        teacher?: { id: string; name: string } | null
    }>
    participants: Array<{
        id: string; name: string; sportType: string; age?: number | null; shoeSize?: string | null
        weight?: number | null; height?: number | null; phone?: string | null; isBooker: boolean
    }>
    payments: Array<{
        method: string; status: string; amount: number; bankName?: string | null
        slipUrl?: string | null; createdAt: string
    }>
    invoice?: { invoiceNumber: string; companyName?: string | null; taxId?: string | null } | null
}

type ParticipantDraft = {
    id?: string
    name: string
    isBooker?: boolean
}

const statusConfig: Record<string, { bg: string; color: string; label: string; icon: LucideIcon }> = {
    PENDING: { bg: 'rgba(255,193,7,0.12)', color: '#ffc107', label: 'รอชำระเงิน', icon: AlertCircle },
    CONFIRMED: { bg: 'rgba(56,239,125,0.12)', color: '#00b894', label: 'ยืนยันแล้ว', icon: CheckCircle },
    CANCELLED: { bg: 'rgba(245,87,108,0.12)', color: '#e17055', label: 'ยกเลิก', icon: XCircle },
}

const paymentMethodLabels: Record<string, string> = {
    PROMPTPAY: 'พร้อมเพย์',
    BANK_TRANSFER: 'โอนธนาคาร',
    PACKAGE: 'แพ็คเกจ',
    CASH: 'เงินสด',
    CREDIT_CARD: 'บัตรเครดิต',
    ADMIN_OVERRIDE: 'แอดมินยืนยัน',
}

const paymentStatusLabels: Record<string, { label: string; color: string }> = {
    PENDING: { label: 'รอตรวจสอบ', color: '#ffc107' },
    VERIFIED: { label: 'ยืนยันแล้ว', color: '#00b894' },
    REJECTED: { label: 'ปฏิเสธ', color: '#e17055' },
}

export default function BookingDetailPage() {
    const router = useRouter()
    const params = useParams()
    const bookingId = params.id as string
    const [booking, setBooking] = useState<BookingDetail | null>(null)
    const [loading, setLoading] = useState(true)
    const [maxParticipants, setMaxParticipants] = useState(2)
    const [editingParticipants, setEditingParticipants] = useState(false)
    const [participantDrafts, setParticipantDrafts] = useState<ParticipantDraft[]>([])
    const [savingParticipants, setSavingParticipants] = useState(false)

    useEffect(() => {
        if (!bookingId) return
        fetch(`/api/bookings/${bookingId}`, { cache: 'no-store' })
            .then(r => {
                if (!r.ok) throw new Error('Not found')
                return r.json()
            })
            .then(data => {
                setBooking(data.booking)
                setParticipantDrafts(data.booking.participants.map((participant: BookingDetail['participants'][number]) => ({
                    id: participant.id,
                    name: participant.name,
                    isBooker: participant.isBooker,
                })))
            })
            .catch(() => {
                toast.error('ไม่พบข้อมูลการจอง')
                router.push('/profile')
            })
            .finally(() => setLoading(false))
    }, [bookingId, router])

    useEffect(() => {
        fetch('/api/settings', { cache: 'no-store' })
            .then(r => r.json())
            .then(data => {
                const nextMax = parseInt(data.max_participants || '2', 10)
                setMaxParticipants(Number.isFinite(nextMax) && nextMax > 0 ? nextMax : 2)
            })
            .catch(() => { })
    }, [])

    const resetParticipantDrafts = (nextBooking = booking) => {
        if (!nextBooking) return
        setParticipantDrafts(nextBooking.participants.map(participant => ({
            id: participant.id,
            name: participant.name,
            isBooker: participant.isBooker,
        })))
    }

    const addParticipantDraft = () => {
        if (participantDrafts.length >= maxParticipants) {
            toast.error(`เพิ่มผู้เรียนได้สูงสุด ${maxParticipants} คน`)
            return
        }
        setParticipantDrafts(prev => [...prev, { name: '', isBooker: false }])
    }

    const updateParticipantDraftName = (index: number, name: string) => {
        setParticipantDrafts(prev => prev.map((participant, i) => i === index ? { ...participant, name } : participant))
    }

    const removeParticipantDraft = (index: number) => {
        const participant = participantDrafts[index]
        if (participant?.isBooker) {
            toast.error('ไม่สามารถลบชื่อผู้จองออกจากรายการผู้เรียนได้')
            return
        }
        setParticipantDrafts(prev => prev.filter((_, i) => i !== index))
    }

    const saveParticipants = async () => {
        const hasEmptyName = participantDrafts.some(participant => !participant.name.trim())
        if (hasEmptyName) {
            toast.error('กรุณากรอกชื่อผู้เรียนให้ครบทุกคน')
            return
        }
        if (participantDrafts.length < 1) {
            toast.error('ต้องมีผู้เรียนอย่างน้อย 1 คน')
            return
        }
        if (participantDrafts.length > maxParticipants) {
            toast.error(`เพิ่มผู้เรียนได้สูงสุด ${maxParticipants} คน`)
            return
        }

        setSavingParticipants(true)
        try {
            const res = await fetch(`/api/bookings/${bookingId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    participants: participantDrafts.map(participant => ({
                        id: participant.id,
                        name: participant.name.trim(),
                    })),
                }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                toast.error(data.error || 'บันทึกชื่อผู้เรียนไม่สำเร็จ')
                return
            }

            setBooking(data.booking)
            resetParticipantDrafts(data.booking)
            setEditingParticipants(false)
            toast.success('บันทึกชื่อผู้เรียนแล้ว')
        } catch {
            toast.error('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
        } finally {
            setSavingParticipants(false)
        }
    }

    if (loading) return <div className="loading-page"><div className="spinner" /></div>
    if (!booking) return null

    const sc = statusConfig[booking.status] || statusConfig.PENDING
    const StatusIcon = sc.icon

    // Group booking items by date
    const itemsByDate = booking.bookingItems.reduce((acc, item) => {
        const dateKey = item.date.split('T')[0]
        if (!acc[dateKey]) acc[dateKey] = []
        acc[dateKey].push(item)
        return acc
    }, {} as Record<string, typeof booking.bookingItems>)

    return (
        <div style={{ maxWidth: '700px', margin: '0 auto', padding: '24px 24px 80px' }}>
            {/* Back button */}
            <button onClick={() => router.push('/profile')} style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: 'none', border: 'none', cursor: 'pointer', padding: '0',
                color: 'var(--c-text-secondary)', fontSize: '14px', fontWeight: 600, marginBottom: '20px',
            }}>
                <ArrowLeft size={16} /> กลับหน้าโปรไฟล์
            </button>

            {/* Header card */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                style={{
                    background: 'var(--c-glass)', border: '1px solid var(--c-glass-border)',
                    borderRadius: '20px', padding: '28px', marginBottom: '16px',
                }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                        <div style={{
                            fontWeight: 900, fontSize: '20px', fontFamily: "'Inter'",
                            background: 'var(--c-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                            marginBottom: '4px',
                        }}>
                            #{booking.bookingNumber}
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--c-text-muted)' }}>
                            จองเมื่อ {new Date(booking.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                    </div>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '8px 16px', borderRadius: '12px',
                        background: sc.bg, color: sc.color, fontWeight: 700, fontSize: '14px',
                    }}>
                        <StatusIcon size={16} />
                        {sc.label}
                    </div>
                </div>

                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '16px 20px', borderRadius: '14px',
                    background: 'rgba(250,204,21,0.08)', border: '1px solid rgba(250,204,21,0.15)',
                }}>
                    <div>
                        <div style={{ fontSize: '13px', color: 'var(--c-text-muted)', marginBottom: '2px' }}>ยอดรวม</div>
                        <div style={{ fontSize: '28px', fontWeight: 900, fontFamily: "'Inter'", background: 'var(--c-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                            ฿{booking.totalAmount.toLocaleString()}
                        </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '13px', color: 'var(--c-text-muted)', marginBottom: '2px' }}>จำนวน</div>
                        <div style={{ fontSize: '20px', fontWeight: 800 }}>{booking.bookingItems.length} ชม.</div>
                    </div>
                </div>
            </motion.div>

            {/* Booking Items */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
                style={{
                    background: 'var(--c-glass)', border: '1px solid var(--c-glass-border)',
                    borderRadius: '20px', padding: '24px', marginBottom: '16px',
                }}>
                <h3 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Calendar size={18} style={{ color: 'var(--c-primary)' }} /> รายละเอียดการจอง
                </h3>

                {Object.entries(itemsByDate).map(([dateStr, items]) => (
                    <div key={dateStr} style={{ marginBottom: '14px' }}>
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '10px 14px', borderRadius: '10px', marginBottom: '8px',
                            background: 'rgba(250,204,21,0.08)', border: '1px solid rgba(250,204,21,0.12)',
                        }}>
                            <Calendar size={14} style={{ color: 'var(--c-primary)' }} />
                            <span style={{ fontWeight: 700, fontSize: '14px' }}>
                                {new Date(dateStr).toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                            </span>
                        </div>
                        {items.map((item, j) => (
                            <div key={j} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '12px 16px', marginBottom: '6px',
                                background: 'rgba(255,255,255,0.03)', borderRadius: '12px',
                                border: '1px solid rgba(255,255,255,0.04)',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{
                                        width: '36px', height: '36px', borderRadius: '10px',
                                        background: 'var(--c-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '16px', flexShrink: 0,
                                    }}>🏟️</div>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <MapPin size={13} style={{ color: 'var(--c-primary)' }} />
                                            {item.court.name}
                                        </div>
                                        <div style={{ fontSize: '13px', color: 'var(--c-text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                            <Clock size={12} /> {item.startTime} - {item.endTime}
                                            {item.teacher && (
                                                <span style={{ marginLeft: '8px', color: 'var(--c-primary)', fontWeight: 600 }}>
                                                    👨‍🏫 {item.teacher.name}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ fontWeight: 800, fontFamily: "'Inter'", fontSize: '15px', color: 'var(--c-text)' }}>
                                    ฿{item.price.toLocaleString()}
                                </div>
                            </div>
                        ))}
                    </div>
                ))}
            </motion.div>

            {/* Participants */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                style={{
                    background: 'var(--c-glass)', border: '1px solid var(--c-glass-border)',
                    borderRadius: '20px', padding: '24px', marginBottom: '16px',
                }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Users size={18} style={{ color: 'var(--c-primary)' }} /> ผู้เรียน ({editingParticipants ? participantDrafts.length : booking.participants.length} คน)
                    </h3>
                    {editingParticipants ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                                onClick={() => {
                                    resetParticipantDrafts()
                                    setEditingParticipants(false)
                                }}
                                disabled={savingParticipants}
                                style={{
                                    padding: '7px 12px', borderRadius: '8px', border: '1px solid var(--c-border)',
                                    background: '#fff', color: 'var(--c-text-secondary)', cursor: 'pointer',
                                    fontFamily: 'inherit', fontWeight: 700, fontSize: '12px',
                                }}
                            >
                                ยกเลิก
                            </button>
                            <button
                                onClick={saveParticipants}
                                disabled={savingParticipants}
                                style={{
                                    padding: '7px 12px', borderRadius: '8px', border: 'none',
                                    background: 'var(--c-gradient)', color: '#2d2a00', cursor: savingParticipants ? 'not-allowed' : 'pointer',
                                    fontFamily: 'inherit', fontWeight: 800, fontSize: '12px', opacity: savingParticipants ? 0.65 : 1,
                                }}
                            >
                                {savingParticipants ? 'กำลังบันทึก...' : 'บันทึก'}
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => {
                                resetParticipantDrafts()
                                setEditingParticipants(true)
                            }}
                            style={{
                                padding: '7px 12px', borderRadius: '8px',
                                border: '1px solid rgba(250,204,21,0.45)', background: 'rgba(250,204,21,0.14)',
                                color: '#2d2a00', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800, fontSize: '12px',
                            }}
                        >
                            แก้ไขผู้เรียน
                        </button>
                    )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {editingParticipants ? (
                        <>
                            {participantDrafts.map((participant, i) => (
                                <div key={participant.id || `new-${i}`} style={{
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                    padding: '12px', borderRadius: '12px',
                                    background: '#fff', border: '1px solid rgba(250,204,21,0.32)',
                                }}>
                                    <div style={{
                                        width: '32px', height: '32px', borderRadius: '8px',
                                        background: participant.isBooker ? 'var(--c-gradient)' : 'rgba(250,204,21,0.16)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: '#2d2a00', fontSize: '14px', fontWeight: 900, flexShrink: 0,
                                    }}>
                                        {i + 1}
                                    </div>
                                    <input
                                        className="input-field"
                                        placeholder={`ชื่อผู้เรียนคนที่ ${i + 1}`}
                                        value={participant.name}
                                        onChange={e => updateParticipantDraftName(i, e.target.value)}
                                        style={{ flex: 1, background: '#fff' }}
                                    />
                                    {participant.isBooker && (
                                        <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '6px', background: 'rgba(250,204,21,0.18)', color: 'var(--c-primary-light)', fontWeight: 800 }}>
                                            ผู้จอง
                                        </span>
                                    )}
                                    {!participant.isBooker && participantDrafts.length > 1 && (
                                        <button
                                            onClick={() => removeParticipantDraft(i)}
                                            disabled={savingParticipants}
                                            style={{
                                                width: '36px', height: '36px', borderRadius: '8px',
                                                border: '1px solid rgba(225,112,85,0.22)', background: 'rgba(225,112,85,0.08)',
                                                color: 'var(--c-danger)', cursor: 'pointer', flexShrink: 0,
                                            }}
                                            aria-label="ลบผู้เรียน"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    )}
                                </div>
                            ))}
                            <button
                                onClick={addParticipantDraft}
                                disabled={savingParticipants || participantDrafts.length >= maxParticipants}
                                style={{
                                    padding: '10px 14px', borderRadius: '8px',
                                    border: '1px dashed rgba(250,204,21,0.72)',
                                    background: participantDrafts.length >= maxParticipants ? 'rgba(0,0,0,0.03)' : 'rgba(250,204,21,0.12)',
                                    color: participantDrafts.length >= maxParticipants ? 'var(--c-text-muted)' : '#2d2a00',
                                    cursor: participantDrafts.length >= maxParticipants ? 'not-allowed' : 'pointer',
                                    fontFamily: 'inherit', fontWeight: 800, fontSize: '13px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                }}
                            >
                                <Plus size={15} /> เพิ่มผู้เรียน ({participantDrafts.length}/{maxParticipants})
                            </button>
                            <div style={{ fontSize: '12px', color: 'var(--c-text-muted)', lineHeight: 1.6 }}>
                                เพิ่มได้สูงสุด {maxParticipants} คนตามการตั้งค่าของระบบ ผู้เรียนที่เพิ่มใหม่จะใช้ประเภทกีฬาเดียวกับรายการเดิม
                            </div>
                        </>
                    ) : (
                        booking.participants.map((p, i) => (
                            <div key={p.id} style={{
                                padding: '14px 18px', borderRadius: '14px',
                                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                    <div style={{
                                        width: '32px', height: '32px', borderRadius: '10px',
                                        background: p.isBooker ? 'var(--c-gradient)' : 'rgba(255,255,255,0.06)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: p.isBooker ? '#2d2a00' : 'var(--c-text-muted)', fontSize: '14px', fontWeight: 700,
                                    }}>
                                        {i + 1}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            {p.name}
                                            {p.isBooker && (
                                                <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '6px', background: 'rgba(250,204,21,0.15)', color: 'var(--c-primary-light)', fontWeight: 600 }}>
                                                    ผู้จอง
                                                </span>
                                            )}
                                        </div>
                                        {p.sportType && (
                                            <div style={{ fontSize: '12px', color: 'var(--c-text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                                <Dumbbell size={11} /> {p.sportType}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Extra details */}
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '12px', color: 'var(--c-text-muted)' }}>
                                    {p.age && <span>อายุ {p.age} ปี</span>}
                                    {p.height && <span>สูง {p.height} cm</span>}
                                    {p.weight && <span>หนัก {p.weight} kg</span>}
                                    {p.shoeSize && <span>เท้า {p.shoeSize}</span>}
                                    {p.phone && <span>📱 {p.phone}</span>}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </motion.div>

            {/* Payment Info */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                style={{
                    background: 'var(--c-glass)', border: '1px solid var(--c-glass-border)',
                    borderRadius: '20px', padding: '24px', marginBottom: '16px',
                }}>
                <h3 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CreditCard size={18} style={{ color: 'var(--c-primary)' }} /> การชำระเงิน
                </h3>

                {booking.payments.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: 'var(--c-text-muted)', fontSize: '14px' }}>
                        ยังไม่มีข้อมูลการชำระเงิน
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {booking.payments.map((pay, i) => {
                            const ps = paymentStatusLabels[pay.status] || { label: pay.status, color: '#888' }
                            return (
                                <div key={i} style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '14px 18px', borderRadius: '12px',
                                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)',
                                }}>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '14px' }}>
                                            {paymentMethodLabels[pay.method] || pay.method}
                                            {pay.bankName && <span style={{ color: 'var(--c-text-muted)', fontWeight: 500 }}> ({pay.bankName})</span>}
                                        </div>
                                        <div style={{ fontSize: '12px', color: 'var(--c-text-muted)', marginTop: '2px' }}>
                                            {new Date(pay.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontWeight: 800, fontFamily: "'Inter'", fontSize: '16px' }}>
                                            ฿{pay.amount.toLocaleString()}
                                        </div>
                                        <span style={{
                                            fontSize: '11px', fontWeight: 700, padding: '2px 10px', borderRadius: '8px',
                                            color: ps.color, background: `${ps.color}18`,
                                        }}>
                                            {ps.label}
                                        </span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </motion.div>

            {/* Invoice */}
            {booking.invoice && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                    style={{
                        background: 'var(--c-glass)', border: '1px solid var(--c-glass-border)',
                        borderRadius: '20px', padding: '24px',
                    }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileText size={18} style={{ color: 'var(--c-primary)' }} /> ใบเสร็จ
                    </h3>
                    <div style={{ fontSize: '14px', color: 'var(--c-text-secondary)' }}>
                        <div>เลขที่: <strong>{booking.invoice.invoiceNumber}</strong></div>
                        {booking.invoice.companyName && <div>บริษัท: {booking.invoice.companyName}</div>}
                        {booking.invoice.taxId && <div>เลขประจำตัวผู้เสียภาษี: {booking.invoice.taxId}</div>}
                    </div>
                </motion.div>
            )}
        </div>
    )
}
