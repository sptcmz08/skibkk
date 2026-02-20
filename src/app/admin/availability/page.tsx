'use client'

import { useState, useEffect, useCallback } from 'react'
import { Clock, Calendar, ChevronLeft, ChevronRight, MapPin, CheckCircle, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'

interface CourtAvailability {
    courtId: string; courtName: string; closed: boolean
    slots: Array<{ startTime: string; endTime: string; price: number; status: 'available' | 'booked' }>
}

export default function AvailabilityPage() {
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
    const [availability, setAvailability] = useState<CourtAvailability[]>([])
    const [loading, setLoading] = useState(true)

    const fetchData = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/availability?date=${selectedDate}`)
            const data = await res.json()
            if (data.availability) setAvailability(data.availability)
        } catch { toast.error('โหลดข้อมูลไม่สำเร็จ') }
        finally { setLoading(false) }
    }, [selectedDate])

    useEffect(() => { fetchData() }, [fetchData])

    const changeDate = (delta: number) => {
        const d = new Date(selectedDate); d.setDate(d.getDate() + delta)
        setSelectedDate(d.toISOString().split('T')[0])
    }

    const totalSlots = availability.reduce((s, c) => s + c.slots.length, 0)
    const bookedSlots = availability.reduce((s, c) => s + c.slots.filter(sl => sl.status === 'booked').length, 0)

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                <button onClick={() => changeDate(-1)} className="btn-admin-outline" style={{ padding: '8px' }}><ChevronLeft size={18} /></button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Calendar size={20} style={{ color: 'var(--a-primary)' }} />
                    <input type="date" className="admin-input" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={{ fontWeight: 600 }} />
                    <span style={{ color: 'var(--a-text-secondary)', fontSize: '14px' }}>
                        {new Date(selectedDate).toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </span>
                </div>
                <button onClick={() => changeDate(1)} className="btn-admin-outline" style={{ padding: '8px' }}><ChevronRight size={18} /></button>
                <button onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])} className="btn-admin" style={{ padding: '8px 16px', fontSize: '13px' }}>วันนี้</button>
            </div>

            {/* Summary */}
            <div className="grid-3" style={{ marginBottom: '24px' }}>
                <div className="stat-card"><div className="stat-icon blue"><MapPin size={22} /></div><div><div className="stat-value">{availability.length}</div><div className="stat-label">สนาม</div></div></div>
                <div className="stat-card"><div className="stat-icon green"><CheckCircle size={22} /></div><div><div className="stat-value">{totalSlots - bookedSlots}</div><div className="stat-label">ช่วงว่าง</div></div></div>
                <div className="stat-card"><div className="stat-icon red"><XCircle size={22} /></div><div><div className="stat-value">{bookedSlots}</div><div className="stat-label">จองแล้ว</div></div></div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '60px' }}><div className="spinner" style={{ borderTopColor: 'var(--a-primary)', margin: '0 auto' }} /></div>
            ) : (
                <div style={{ display: 'grid', gap: '16px' }}>
                    {availability.map(court => (
                        <div key={court.courtId} className="admin-card">
                            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--a-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <h3 style={{ fontWeight: 700, color: 'var(--a-text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <MapPin size={18} style={{ color: 'var(--a-primary)' }} /> {court.courtName}
                                </h3>
                                <span style={{ fontSize: '13px', color: 'var(--a-text-muted)' }}>
                                    ว่าง {court.slots.filter(s => s.status === 'available').length} / {court.slots.length} ช่วง
                                </span>
                            </div>
                            <div style={{ padding: '16px 20px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                {court.closed ? (
                                    <div style={{ textAlign: 'center', width: '100%', padding: '20px', color: 'var(--a-text-muted)' }}>ปิดให้บริการ</div>
                                ) : court.slots.map(slot => (
                                    <div key={slot.startTime} style={{
                                        padding: '8px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                                        background: slot.status === 'available' ? '#e8f5e9' : '#fde4de',
                                        color: slot.status === 'available' ? '#2e7d32' : '#c62828',
                                        border: `1px solid ${slot.status === 'available' ? '#c8e6c9' : '#ffccbc'}`,
                                        minWidth: '80px', textAlign: 'center',
                                    }}>
                                        <div style={{ fontFamily: "'Inter'", fontWeight: 700 }}>{slot.startTime}</div>
                                        <div style={{ fontSize: '11px', opacity: 0.7 }}>
                                            {slot.status === 'available' ? `฿${slot.price.toLocaleString()}` : 'จองแล้ว'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
