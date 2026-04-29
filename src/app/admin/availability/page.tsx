'use client'

import { FadeIn } from '@/components/Motion'
import DatePickerInput from '@/components/DatePickerInput'

import { useState, useEffect, useCallback } from 'react'
import { Calendar, ChevronLeft, ChevronRight, MapPin, CheckCircle, XCircle, Copy } from 'lucide-react'
import toast from 'react-hot-toast'

interface CourtAvailability {
    courtId: string; courtName: string; closed: boolean
    slots: Array<{ startTime: string; endTime: string; price: number; status: 'available' | 'booked' }>
}

const THAI_MONTH_SHORT = ['มค.', 'กพ.', 'มีค.', 'เมย.', 'พค.', 'มิย.', 'กค.', 'สค.', 'กย.', 'ตค.', 'พย.', 'ธค.']

const addDays = (dateStr: string, days: number) => {
    const date = new Date(`${dateStr}T12:00:00Z`)
    date.setUTCDate(date.getUTCDate() + days)
    return date.toISOString().split('T')[0]
}

const formatRangeDate = (dateStr: string) => {
    return new Date(`${dateStr}T12:00:00Z`).toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    })
}

const formatShortThaiDate = (dateStr: string) => {
    const date = new Date(`${dateStr}T12:00:00Z`)
    return `วันที่ ${date.getUTCDate()} ${THAI_MONTH_SHORT[date.getUTCMonth()]}`
}

const formatCopyTime = (time: string) => time.replace(/^0/, '')

const getDateRange = (from: string, to: string) => {
    const start = from <= to ? from : to
    const end = from <= to ? to : from
    const dates: string[] = []
    let cursor = start
    while (cursor <= end && dates.length < 62) {
        dates.push(cursor)
        cursor = addDays(cursor, 1)
    }
    return dates
}

const mergeAvailableSlots = (slots: CourtAvailability['slots']) => {
    const availableSlots = [...new Map(
        slots
            .filter(slot => slot.status === 'available')
            .map(slot => [slot.startTime, slot])
    ).values()].sort((a, b) => a.startTime.localeCompare(b.startTime))

    const ranges: Array<{ startTime: string; endTime: string }> = []
    for (const slot of availableSlots) {
        const last = ranges[ranges.length - 1]
        if (last && last.endTime === slot.startTime) {
            last.endTime = slot.endTime
        } else {
            ranges.push({ startTime: slot.startTime, endTime: slot.endTime })
        }
    }
    return ranges.map(range => `${formatCopyTime(range.startTime)}-${formatCopyTime(range.endTime)}`)
}

export default function AvailabilityPage() {
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
    const [copyFromDate, setCopyFromDate] = useState(selectedDate)
    const [copyToDate, setCopyToDate] = useState(addDays(selectedDate, 14))
    const [availability, setAvailability] = useState<CourtAvailability[]>([])
    const [loading, setLoading] = useState(true)
    const [copying, setCopying] = useState(false)

    const fetchData = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/availability?date=${selectedDate}`, { cache: 'no-store' })
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

    const buildCopyText = async () => {
        const dates = getDateRange(copyFromDate, copyToDate)
        const generatedAt = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }).replace(':', '.')
        const lines = [
            `ตารางว่าง ณ วันที่ ${formatRangeDate(dates[0])} ถึง ${formatRangeDate(dates[dates.length - 1])} เวลา ${generatedAt}น.`,
        ]

        for (const date of dates) {
            const res = await fetch(`/api/availability?date=${date}`, { cache: 'no-store' })
            const data = await res.json()
            const courts = Array.isArray(data.availability) ? data.availability as CourtAvailability[] : []
            const allSlots = courts.flatMap(court => court.closed ? [] : court.slots)
            const ranges = mergeAvailableSlots(allSlots)
            lines.push('', formatShortThaiDate(date), ranges.length > 0 ? ranges.join(' ,') : 'เต็ม')
        }

        return lines.join('\n')
    }

    const copyAvailabilityText = async () => {
        setCopying(true)
        try {
            const text = await buildCopyText()
            await navigator.clipboard.writeText(text)
            toast.success('คัดลอกตารางว่างแล้ว')
        } catch {
            toast.error('คัดลอกตารางว่างไม่สำเร็จ')
        } finally {
            setCopying(false)
        }
    }

    return (
        <FadeIn><div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                <button onClick={() => changeDate(-1)} className="btn-admin-outline" style={{ padding: '8px' }}><ChevronLeft size={18} /></button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Calendar size={20} style={{ color: 'var(--a-primary)' }} />
                    <DatePickerInput value={selectedDate} onChange={setSelectedDate} style={{ width: '170px', fontWeight: 600 }} />
                    <span style={{ color: 'var(--a-text-secondary)', fontSize: '14px' }}>
                        {new Date(selectedDate).toLocaleDateString('th-TH', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </span>
                </div>
                <button onClick={() => changeDate(1)} className="btn-admin-outline" style={{ padding: '8px' }}><ChevronRight size={18} /></button>
                <button onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])} className="btn-admin" style={{ padding: '8px 16px', fontSize: '13px' }}>วันนี้</button>
            </div>

            <div className="admin-card" style={{ padding: '16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ fontWeight: 800, color: 'var(--a-text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Copy size={16} style={{ color: 'var(--a-primary)' }} /> คัดลอกตารางว่าง
                </div>
                <DatePickerInput value={copyFromDate} onChange={setCopyFromDate} style={{ width: '170px', fontWeight: 600 }} />
                <span style={{ color: 'var(--a-text-muted)', fontWeight: 700 }}>ถึง</span>
                <DatePickerInput value={copyToDate} onChange={setCopyToDate} style={{ width: '170px', fontWeight: 600 }} />
                <button onClick={copyAvailabilityText} disabled={copying} className="btn-admin" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', fontSize: '13px', opacity: copying ? 0.65 : 1 }}>
                    <Copy size={15} /> {copying ? 'กำลังคัดลอก...' : 'Copy text'}
                </button>
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
        </div></FadeIn>
    )
}
