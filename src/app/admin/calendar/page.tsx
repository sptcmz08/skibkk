'use client'

import { FadeIn } from '@/components/Motion'
import ConfirmModal from '@/components/ConfirmModal'

import React, { useState, useEffect, useRef } from 'react'
import { Calendar, ChevronLeft, ChevronRight, Eye, MapPin, X, Clock, UserPlus, Search, Plus, ArrowLeft, ArrowRight } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'

interface Booking {
    id: string; bookingNumber: string; status: string; totalAmount: number; createdAt: string; isBookerLearner: boolean; createdByAdmin: boolean
    user: { name: string; email: string; phone: string; lineDisplayName?: string; lineAvatar?: string }
    bookingItems: Array<{ id?: string; courtId: string; court: { name: string }; date: string; startTime: string; endTime: string; price: number; teacherId?: string | null; teacher?: { id: string; name: string } }>
    participants: Array<{ name: string; sportType: string; phone: string; height?: number | null; weight?: number | null }>
    payments: Array<{ method: string; status: string; amount: number; bankName?: string | null }>
}

interface DaySummary {
    date: string
    count: number
    totalAmount: number
}

interface Court {
    id: string; name: string; sportType: string; venueId: string | null
    operatingHours?: Array<{ dayOfWeek: string; openTime: string; closeTime: string; isClosed: boolean }>
}
interface Venue { id: string; name: string }
interface Customer { id: string; name: string; email: string; phone: string }
interface Teacher { id: string; name: string; specialty: string | null; isActive: boolean; workStatus: string }

export default function CalendarPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const dateParam = searchParams.get('date')
    const venueIdParam = searchParams.get('venueId')
    const now = new Date()
    const bookingGridRef = useRef<HTMLDivElement>(null)
    const initDate = dateParam ? new Date(dateParam) : null
    const [viewYear, setViewYear] = useState(initDate ? initDate.getFullYear() : now.getFullYear())
    const [viewMonth, setViewMonth] = useState(initDate ? initDate.getMonth() : now.getMonth())
    const [selectedDate, setSelectedDate] = useState<string | null>(dateParam || null)
    const [bookings, setBookings] = useState<Booking[]>([])
    const [daySummaries, setDaySummaries] = useState<Record<string, DaySummary>>({})
    const [loading, setLoading] = useState(false)
    const [viewBooking, setViewBooking] = useState<Booking | null>(null)
    const [editMode, setEditMode] = useState(false)
    const [editParticipants, setEditParticipants] = useState<Array<{ name: string; sportType: string; phone: string; height: string; weight: string }>>([])
    const [editBookingItems, setEditBookingItems] = useState<Array<{ courtId: string; date: string; startTime: string; endTime: string; price: number; teacherId?: string | null }>>([])
    const [editStatus, setEditStatus] = useState('')
    const [editAmount, setEditAmount] = useState(0)
    const [saving, setSaving] = useState(false)
    // Calendar availability data (from /api/availability/calendar)
    const [calAvail, setCalAvail] = useState<Record<string, { totalSlots: number; bookedSlots: number; status: string }>>({})

    // === New Booking Modal State ===
    const [showBookModal, setShowBookModal] = useState(false)
    const [courts, setCourts] = useState<Court[]>([])
    const [customers, setCustomers] = useState<Customer[]>([])
    const [bookSearch, setBookSearch] = useState('')
    const [bookCustomer, setBookCustomer] = useState<Customer | null>(null)
    const [bookCourt, setBookCourt] = useState('')
    const [bookDates, setBookDates] = useState<string[]>([])
    const [bookTimes, setBookTimes] = useState<string[]>([])
    const [bookSubmitting, setBookSubmitting] = useState(false)
    // Availability-based slot data (same API as customer page)
    const [availSlots, setAvailSlots] = useState<Array<{ startTime: string; endTime: string; price: number; available: boolean; status: string }>>([])
    const [loadingAvail, setLoadingAvail] = useState(false)
    // Participants (unlimited for admin)
    const [bookParticipants, setBookParticipants] = useState<Array<{ name: string; sportType: string; phone: string }>>([{ name: '', sportType: '', phone: '' }])
    // Booking status: CONFIRMED=paid, PENDING=unpaid
    const [bookStatus, setBookStatus] = useState<'CONFIRMED' | 'PENDING'>('CONFIRMED')
    const [venues, setVenues] = useState<Venue[]>([])
    const [selectedVenueId, setSelectedVenueId] = useState<string>('')
    const [teachers, setTeachers] = useState<Teacher[]>([])
    const [pendingCalendarAction, setPendingCalendarAction] = useState<{ message: string; action: () => void } | null>(null)
    const [sportTypes, setSportTypes] = useState<string[]>([])

    const openBookingModal = (booking: Booking) => {
        setViewBooking(booking)
        setEditMode(false)
        setEditParticipants(booking.participants.map(p => ({ name: p.name, sportType: p.sportType, phone: p.phone || '', height: p.height ? String(p.height) : '', weight: p.weight ? String(p.weight) : '' })))
        setEditBookingItems(booking.bookingItems.map(item => ({ courtId: item.courtId, date: item.date.split('T')[0], startTime: item.startTime, endTime: item.endTime, price: item.price, teacherId: item.teacherId || null })))
        setEditStatus(booking.status)
        setEditAmount(booking.totalAmount)
    }

    const refetchBookings = async () => {
        if (!selectedDate) return
        const fetchRes = await fetch(`/api/bookings?date=${selectedDate}`, { cache: 'no-store' })
        const data = await fetchRes.json()
        if (data.bookings) setBookings(data.bookings)
    }

    const saveChanges = async () => {
        if (!viewBooking) return
        setSaving(true)
        try {
            const res = await fetch('/api/bookings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bookingId: viewBooking.id,
                    status: editStatus,
                    totalAmount: editAmount,
                    participants: editParticipants.map(p => ({
                        name: p.name,
                        sportType: p.sportType,
                        phone: p.phone || '',
                        height: p.height ? parseFloat(p.height) : null,
                        weight: p.weight ? parseFloat(p.weight) : null,
                    })),
                    bookingItems: editBookingItems,
                }),
            })
            if (res.ok) {
                toast.success('บันทึกการแก้ไขสำเร็จ')
                setViewBooking(null)
                await refetchBookings()
            } else {
                const errData = await res.json().catch(() => ({}))
                toast.error(errData.error || 'บันทึกไม่สำเร็จ')
            }
        } catch { toast.error('เกิดข้อผิดพลาด') }
        finally { setSaving(false) }
    }

    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

    // Fetch courts for edit dropdown
    useEffect(() => {
        fetch('/api/courts?admin=1', { cache: 'no-store' }).then(r => r.json()).then(data => { if (data.courts) setCourts(data.courts) }).catch(() => { })
        fetch('/api/teachers', { cache: 'no-store' }).then(r => r.json()).then(data => { if (data.teachers) setTeachers(data.teachers) }).catch(() => { })
        fetch('/api/sport-types', { cache: 'no-store' }).then(r => r.json()).then(data => { if (data.sportTypes) setSportTypes(data.sportTypes.map((st: any) => st.name || st)) }).catch(() => { })
        fetch('/api/venues', { cache: 'no-store' }).then(r => r.json()).then(data => {
            if (data.venues) {
                const active = data.venues.filter((v: any) => v.isActive)
                setVenues(active)
                if (active.length > 0 && !selectedVenueId) setSelectedVenueId(venueIdParam || active[0].id)
            }
        }).catch(() => { })
    }, [])

    // Fetch monthly summary (booking counts)
    useEffect(() => {
        const fetchSummary = async () => {
            try {
                const res = await fetch(`/api/bookings?take=500&month=${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`, { cache: 'no-store' })
                const data = await res.json()
                if (data.bookings) {
                    // Get court IDs for the selected venue to filter
                    // Only filter by venue if courts are loaded (avoid empty Set filtering out everything)
                    const filteredCourts = selectedVenueId && courts.length > 0
                        ? courts.filter(c => c.venueId === selectedVenueId).map(c => c.id)
                        : null
                    const venueCourtIds = filteredCourts && filteredCourts.length > 0
                        ? new Set(filteredCourts)
                        : null
                    const summaries: Record<string, DaySummary> = {}
                    data.bookings.forEach((b: Booking) => {
                        if (b.status === 'CANCELLED') return
                        b.bookingItems.forEach(item => {
                            // Filter by venue if selected
                            if (venueCourtIds && !venueCourtIds.has(item.courtId)) return
                            const d = item.date.split('T')[0]
                            if (!summaries[d]) summaries[d] = { date: d, count: 0, totalAmount: 0 }
                            summaries[d].count++
                            summaries[d].totalAmount += item.price
                        })
                    })
                    setDaySummaries(summaries)
                }
            } catch { /* ignore */ }
        }
        fetchSummary()
    }, [viewYear, viewMonth, selectedVenueId, courts])

    // Fetch calendar availability for color coding (Bug 5.2)
    useEffect(() => {
        const venueParam = selectedVenueId ? `&venueId=${selectedVenueId}` : ''
        fetch(`/api/availability/calendar?year=${viewYear}&month=${viewMonth + 1}${venueParam}`, { cache: 'no-store' })
            .then(r => r.json())
            .then(data => { if (data.availability) setCalAvail(data.availability) })
            .catch(() => { })
    }, [viewYear, viewMonth, selectedVenueId])

    const knownBookingIds = useRef<Set<string>>(new Set())
    
    // Fetch and poll bookings for selected date
    useEffect(() => {
        if (!selectedDate) {
            knownBookingIds.current.clear()
            return
        }
        
        const fetchBookings = async (isPoll: boolean = false) => {
            if (!isPoll) setLoading(true)
            try {
                const res = await fetch(`/api/bookings?date=${selectedDate}`, { cache: 'no-store' })
                if (!res.ok) return
                const data = await res.json()
                if (data.bookings) {
                    if (isPoll && knownBookingIds.current.size > 0) {
                        const newBookings = data.bookings.filter((b: any) => !knownBookingIds.current.has(b.id))
                        if (newBookings.length > 0) {
                            toast.success('มีการจองใหม่เข้ามา!', { duration: 5000, icon: '🔔', style: { border: '1px solid #10b981', padding: '16px', color: '#10b981' } })
                        }
                    }
                    
                    // Update known IDs
                    knownBookingIds.current = new Set(data.bookings.map((b: any) => b.id))
                    setBookings(data.bookings)
                }
            } catch {
                if (!isPoll) toast.error('โหลดข้อมูลไม่สำเร็จ')
            } finally {
                if (!isPoll) setLoading(false)
            }
        }
        
        fetchBookings()
        
        const intervalId = setInterval(() => {
            fetchBookings(true)
        }, 15000) // Poll every 15 seconds
        
        return () => clearInterval(intervalId)
    }, [selectedDate])

    // Fetch courts for booking modal (duplicate removed - already fetched above)

    // Search customers for booking modal
    useEffect(() => {
        if (bookSearch.length < 2) { setCustomers([]); return }
        const t = setTimeout(() => {
            fetch(`/api/users?search=${encodeURIComponent(bookSearch)}`).then(r => r.json())
                .then(d => setCustomers(d.users || []))
                .catch(() => { })
        }, 300)
        return () => clearTimeout(t)
    }, [bookSearch])

    const changeMonth = (delta: number) => {
        let m = viewMonth + delta
        let y = viewYear
        if (m < 0) { m = 11; y-- }
        if (m > 11) { m = 0; y++ }
        setViewMonth(m)
        setViewYear(y)
        setSelectedDate(null)
    }

    // Calendar grid
    const firstDay = new Date(viewYear, viewMonth, 1).getDay()
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const calDays: (number | null)[] = []
    for (let i = 0; i < firstDay; i++) calDays.push(null)
    for (let i = 1; i <= daysInMonth; i++) calDays.push(i)

    const statusMap: Record<string, { cls: string; label: string; bg: string; color: string; icon: string }> = {
        PENDING: { cls: 'badge-pending', label: 'รอชำระเงิน', bg: '#fff8e1', color: '#f5a623', icon: '🟡' },
        CONFIRMED: { cls: 'badge-success', label: 'ชำระเงินแล้ว', bg: '#e8f5e9', color: '#27ae60', icon: '✅' },
        CANCELLED: { cls: 'badge-danger', label: 'ยกเลิก', bg: '#fde8e8', color: '#e74c3c', icon: '❌' },
    }

    const monthNames = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
    const dayHeaders = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']

    const timeSlots = Array.from({ length: 15 }, (_, i) => {
        const h = (i + 8).toString().padStart(2, '0')
        return `${h}:00`
    })

    // Fetch availability when court + dates selected (uses SAME API as customer page)
    useEffect(() => {
        if (!bookCourt || bookDates.length === 0) { setAvailSlots([]); return }
        // Fetch for the last selected date to show availability
        const date = bookDates[bookDates.length - 1]
        setLoadingAvail(true)
        fetch(`/api/availability?date=${date}`, { cache: 'no-store' })
            .then(r => r.json())
            .then(data => {
                const courtAvail = (data.availability || []).find((a: any) => a.courtId === bookCourt)
                setAvailSlots(courtAvail?.slots || [])
            })
            .catch(() => setAvailSlots([]))
            .finally(() => setLoadingAvail(false))
    }, [bookCourt, bookDates])

    // Toggle date for multi-date booking
    const toggleBookDate = (dateStr: string) => {
        setBookDates(prev => prev.includes(dateStr) ? prev.filter(d => d !== dateStr) : [...prev, dateStr].sort())
    }

    // Toggle time for multi-time booking — prevent selecting booked times
    const toggleBookTime = (time: string) => {
        const slot = availSlots.find(s => s.startTime === time)
        if (slot && !slot.available) { toast.error('เวลานี้ถูกจองแล้ว'); return }
        setBookTimes(prev => prev.includes(time) ? prev.filter(t => t !== time) : [...prev, time].sort())
    }

    // Participant management
    const addParticipant = () => setBookParticipants(prev => [...prev, { name: '', sportType: '', phone: '' }])
    const removeParticipant = (idx: number) => setBookParticipants(prev => prev.filter((_, i) => i !== idx))
    const updateParticipant = (idx: number, field: string, value: string) => {
        setBookParticipants(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p))
    }

    // Open new booking modal
    const openNewBooking = () => {
        setBookCustomer(null)
        setBookSearch('')
        setBookCourt('')
        setBookDates(selectedDate ? [selectedDate] : [])
        setBookTimes([])
        setAvailSlots([])
        setCustomers([])
        setBookParticipants([{ name: '', sportType: '', phone: '' }])
        setBookStatus('CONFIRMED')
        setShowBookModal(true)
    }

    // Submit new booking
    const submitBooking = async () => {
        if (!bookCustomer) { toast.error('กรุณาเลือกลูกค้า'); return }
        if (!bookCourt) { toast.error('กรุณาเลือกสนาม'); return }
        if (bookDates.length === 0) { toast.error('กรุณาเลือกวันที่'); return }
        if (bookTimes.length === 0) { toast.error('กรุณาเลือกเวลา'); return }

        setBookSubmitting(true)
        try {
            const court = courts.find(c => c.id === bookCourt)
            const items = bookDates.flatMap(date =>
                bookTimes.map(time => {
                    const endHour = (parseInt(time.split(':')[0]) + 1).toString().padStart(2, '0')
                    return {
                        courtId: bookCourt,
                        courtName: court?.name,
                        date,
                        startTime: time,
                        endTime: `${endHour}:00`,
                        price: 0,
                    }
                })
            )

            const res = await fetch('/api/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items,
                    totalAmount: items.reduce((sum: number, it: any) => sum + it.price, 0),
                    isBookerLearner: false,
                    participants: bookParticipants.filter(p => p.name.trim()).map((p, i) => ({ ...p, isBooker: i === 0 })),
                    createdByAdmin: true,
                    userId: bookCustomer.id,
                }),
            })

            if (res.ok) {
                const data = await res.json()
                // Set status based on admin selection
                await fetch('/api/bookings', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ bookingId: data.booking.id, status: bookStatus }),
                })
                toast.success(`จองสำเร็จ! (${items.length} รายการ) — ${bookStatus === 'CONFIRMED' ? 'จ่ายแล้ว' : 'รอชำระ'}`)
                setShowBookModal(false)
                // Refresh
                await refetchBookings()
                // Refresh monthly summary
                const summaryRes = await fetch(`/api/bookings?month=${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`, { cache: 'no-store' })
                const summaryData = await summaryRes.json()
                if (summaryData.bookings) {
                    const summaries: Record<string, DaySummary> = {}
                    summaryData.bookings.forEach((b: Booking) => {
                        if (b.status === 'CANCELLED') return
                        b.bookingItems.forEach(item => {
                            const d = item.date.split('T')[0]
                            if (!summaries[d]) summaries[d] = { date: d, count: 0, totalAmount: 0 }
                            summaries[d].count++
                            summaries[d].totalAmount += item.price
                        })
                    })
                    setDaySummaries(summaries)
                }
            } else {
                const err = await res.json().catch(() => ({}))
                toast.error(err.error || 'จองไม่สำเร็จ')
            }
        } catch { toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ') }
        finally { setBookSubmitting(false) }
    }

    // Mini calendar for booking modal
    const bookCalMonth = bookDates.length > 0 ? new Date(bookDates[0]) : new Date()
    const [bookCalYear, setBookCalYear] = useState(now.getFullYear())
    const [bookCalMo, setBookCalMo] = useState(now.getMonth())
    const bookCalFirst = new Date(bookCalYear, bookCalMo, 1).getDay()
    const bookCalDays = new Date(bookCalYear, bookCalMo + 1, 0).getDate()
    const bookCalCells: (number | null)[] = []
    for (let i = 0; i < bookCalFirst; i++) bookCalCells.push(null)
    for (let i = 1; i <= bookCalDays; i++) bookCalCells.push(i)

    const changeBookMonth = (delta: number) => {
        let m = bookCalMo + delta
        let y = bookCalYear
        if (m < 0) { m = 11; y-- }
        if (m > 11) { m = 0; y++ }
        setBookCalMo(m)
        setBookCalYear(y)
    }

    return (
        <FadeIn><div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--a-text)' }}>ปฏิทินการจอง</h2>
                    <p style={{ color: 'var(--a-text-secondary)', fontSize: '14px' }}>ดูภาพรวมการจองรายเดือน</p>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {venues.length > 0 && (
                        <select className="admin-input" style={{ minWidth: '180px', fontSize: '14px', fontWeight: 600 }} value={selectedVenueId} onChange={e => setSelectedVenueId(e.target.value)}>
                            <option value="">ทุกสาขา</option>
                            {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                        </select>
                    )}
                    <button onClick={() => router.push('/admin/book')} className="btn-admin" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Plus size={18} /> จองให้ลูกค้า
                    </button>
                </div>
            </div>

            {/* Monthly Calendar Grid */}
            <div className="admin-card" style={{ marginBottom: '24px' }}>
                <div className="admin-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button onClick={() => changeMonth(-1)} className="btn-admin-outline" style={{ padding: '8px' }}><ChevronLeft size={18} /></button>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontWeight: 800, fontSize: '18px', color: 'var(--a-text)' }}>
                            {monthNames[viewMonth]}
                        </div>
                        <div style={{ fontSize: '14px', color: 'var(--a-text-muted)' }}>{viewYear + 543}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => { setViewYear(now.getFullYear()); setViewMonth(now.getMonth()); setSelectedDate(todayStr) }} className="btn-admin" style={{ padding: '8px 16px', fontSize: '13px' }}>วันนี้</button>
                        <button onClick={() => changeMonth(1)} className="btn-admin-outline" style={{ padding: '8px' }}><ChevronRight size={18} /></button>
                    </div>
                </div>

                <div style={{ padding: '16px' }}>
                    {/* Venue filter for monthly view */}
                    {venues.length > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
                            <select
                                className="admin-input"
                                style={{ minWidth: '200px', fontSize: '13px', fontWeight: 600, textAlign: 'center' }}
                                value={selectedVenueId}
                                onChange={e => setSelectedVenueId(e.target.value)}
                            >
                                {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                            </select>
                        </div>
                    )}
                    {/* Day headers */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '4px' }}>
                        {dayHeaders.map(d => (
                            <div key={d} style={{ textAlign: 'center', fontSize: '12px', fontWeight: 700, color: 'var(--a-text-muted)', padding: '8px 0' }}>
                                {d}
                            </div>
                        ))}
                    </div>

                    {/* Calendar cells */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                        {calDays.map((day, idx) => {
                            if (day === null) return <div key={`empty-${idx}`} />
                            const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                            const isToday = dateStr === todayStr
                            const isSelected = dateStr === selectedDate
                            const isPast = dateStr < todayStr
                            const summary = daySummaries[dateStr]
                            const bookingCount = summary?.count || 0
                            const hasBookings = bookingCount > 0
                            const dayAvail = calAvail[dateStr]

                            let cellBg = isPast ? '#f9f9f7' : '#fdfcfa'
                            let countColor = 'var(--a-text-muted)'
                            let statusLabel = 'ว่าง'
                            if (!isPast && dayAvail && dayAvail.status !== 'past') {
                                if (dayAvail.status === 'full') {
                                    cellBg = '#fde4de'; countColor = '#d63031'; statusLabel = 'เต็ม'
                                } else if (dayAvail.status === 'almost_full') {
                                    cellBg = '#fff8e1'; countColor = '#f39c12'; statusLabel = 'ใกล้เต็ม'
                                } else if (hasBookings) {
                                    cellBg = '#e8f5e9'; countColor = '#00b894'; statusLabel = 'ว่าง'
                                }
                            } else if (hasBookings && !isPast) {
                                cellBg = '#e8f5e9'; countColor = '#00b894'; statusLabel = 'ว่าง'
                            }
                            if (isSelected) cellBg = 'var(--a-primary-light)'

                            return (
                                <div key={dateStr}
                                    onClick={() => { setSelectedDate(dateStr); setTimeout(() => bookingGridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100) }}
                                    style={{
                                        padding: '8px 4px',
                                        borderRadius: '10px',
                                        cursor: 'pointer',
                                        textAlign: 'center',
                                        minHeight: '72px',
                                        border: isSelected ? '2px solid var(--a-primary)' : isToday ? '2px solid var(--a-primary)' : '1px solid var(--a-border)',
                                        background: cellBg,
                                        opacity: isPast ? 0.6 : 1,
                                        transition: 'all 0.15s',
                                    }}>
                                    <div style={{
                                        fontWeight: isToday ? 800 : 600,
                                        fontSize: '15px',
                                        color: isToday ? 'var(--a-primary)' : 'var(--a-text)',
                                        marginBottom: '4px',
                                    }}>
                                        {day}
                                    </div>
                                    {hasBookings ? (
                                        <div>
                                            <div style={{ fontSize: '11px', fontWeight: 700, color: countColor }}>
                                                {bookingCount} ชม.การจอง
                                            </div>
                                            <div style={{ fontSize: '9px', fontWeight: 600, color: countColor, opacity: 0.8 }}>
                                                {statusLabel}
                                            </div>
                                            <div style={{ fontSize: '10px', color: 'var(--a-text-muted)' }}>
                                                ฿{summary!.totalAmount.toLocaleString()}
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ fontSize: '11px', color: 'var(--a-text-muted)' }}>
                                            ว่าง
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* Bookings Grid for selected date */}
            {selectedDate && (
                <div className="admin-card" ref={bookingGridRef}>
                    <div className="admin-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() - 1); const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; setSelectedDate(ds) }}
                                className="btn-admin-outline" style={{ padding: '4px 8px', fontSize: '12px', display: 'flex', alignItems: 'center' }}>
                                <ArrowLeft size={14} />
                            </button>
                            <button onClick={() => setSelectedDate(todayStr)}
                                className="btn-admin-outline" style={{ padding: '4px 10px', fontSize: '12px', fontWeight: 600 }}>
                                วันนี้
                            </button>
                            <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() + 1); const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; setSelectedDate(ds) }}
                                className="btn-admin-outline" style={{ padding: '4px 8px', fontSize: '12px', display: 'flex', alignItems: 'center' }}>
                                <ArrowRight size={14} />
                            </button>
                            <h3 className="admin-card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                                <Calendar size={18} style={{ color: 'var(--a-primary)' }} />
                                {new Date(selectedDate).toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                            </h3>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            {venues.length > 1 && (
                                <select className="admin-input" style={{ minWidth: '160px', fontSize: '13px' }} value={selectedVenueId} onChange={e => setSelectedVenueId(e.target.value)}>
                                    <option value="">ทุกสาขา</option>
                                    {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                </select>
                            )}
                            {(() => {
                                const venueCourtIdSet = selectedVenueId && courts.length > 0
                                    ? new Set(courts.filter(c => c.venueId === selectedVenueId).map(c => c.id))
                                    : null
                                const count = bookings.filter(b => {
                                    if (b.status === 'CANCELLED') return false
                                    if (!venueCourtIdSet) return true
                                    return b.bookingItems.some(item => venueCourtIdSet.has(item.courtId))
                                }).length
                                return <span className="badge badge-info">{count} การจอง</span>
                            })()}
                            <button onClick={() => router.push(`/admin/book?date=${selectedDate}${selectedVenueId ? `&venueId=${selectedVenueId}` : ''}`)} className="btn-admin" style={{ padding: '6px 14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Plus size={14} /> จอง
                            </button>
                        </div>
                    </div>
                    <div style={{ padding: '16px', overflowX: 'auto' }}>
                        {loading ? (
                            <div style={{ textAlign: 'center', padding: '40px' }}><div className="spinner" style={{ borderTopColor: 'var(--a-primary)', margin: '0 auto' }} /></div>
                        ) : (() => {
                            const venueCourtIdFilter = selectedVenueId && courts.length > 0
                                ? new Set(courts.filter(c => c.venueId === selectedVenueId).map(c => c.id))
                                : null
                            const activeBookings = bookings.filter(b => b.status !== 'CANCELLED').map(b => {
                                const filteredItems = b.bookingItems.filter(item => {
                                    // Filter by venue if selected
                                    if (venueCourtIdFilter && !venueCourtIdFilter.has(item.courtId)) return false
                                    const d = new Date(item.date)
                                    const y = d.getFullYear()
                                    const m = String(d.getMonth() + 1).padStart(2, '0')
                                    const dy = String(d.getDate()).padStart(2, '0')
                                    const localDateStr = `${y}-${m}-${dy}`
                                    return localDateStr === selectedDate || item.date.startsWith(selectedDate)
                                })
                                return { ...b, bookingItems: filteredItems }
                            }).filter(b => b.bookingItems.length > 0)
                            
                            // Show grid with all courts even when no bookings (empty white cells)
                            const venueCourtsCheck = selectedVenueId ? courts.filter(c => c.venueId === selectedVenueId) : courts
                            if (activeBookings.length === 0 && venueCourtsCheck.length === 0) {
                                return (
                                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--a-text-muted)' }}>
                                        <Calendar size={40} style={{ marginBottom: '12px', opacity: 0.4 }} />
                                        <p>ไม่มีสนามในสาขานี้</p>
                                    </div>
                                )
                            }

                            // Build lookup: courtId_startTime -> { booking, item, participants }
                            const slotMap: Record<string, { booking: Booking; item: Booking['bookingItems'][0] }> = {}
                            activeBookings.forEach(booking => {
                                booking.bookingItems.forEach(item => {
                                    const key = `${item.courtId}_${item.startTime}`
                                    slotMap[key] = { booking, item }
                                    // For items spanning multiple hours, also register intermediate hours
                                    const startH = parseInt(item.startTime.split(':')[0])
                                    const endH = parseInt(item.endTime.split(':')[0]) || 24
                                    for (let h = startH + 1; h < endH; h++) {
                                        const intermediateKey = `${item.courtId}_${String(h).padStart(2, '0')}:00`
                                        slotMap[intermediateKey] = { booking, item }
                                    }
                                })
                            })

                            // Build merge map — handle both:
                            // 1. Single items spanning multiple hours (e.g., 21:00-23:00)
                            // 2. Consecutive separate items from same booking
                            const mergeInfo: Record<string, { span: number; totalPrice: number; endTime: string }> = {}
                            const skipSet = new Set<string>()

                            activeBookings.forEach(booking => {
                                // Group items by courtId — only items for this date
                                const byCourtLocal: Record<string, Booking['bookingItems']> = {}
                                booking.bookingItems.forEach(item => {
                                    if (!byCourtLocal[item.courtId]) byCourtLocal[item.courtId] = []
                                    byCourtLocal[item.courtId].push(item)
                                })
                                Object.values(byCourtLocal).forEach(items => {
                                    // Sort by startTime
                                    const sorted = [...items].sort((a, b) => a.startTime.localeCompare(b.startTime))
                                    let i = 0
                                    while (i < sorted.length) {
                                        // Calculate span for THIS item (single multi-hour item)
                                        const startH = parseInt(sorted[i].startTime.split(':')[0])
                                        const endH = parseInt(sorted[i].endTime.split(':')[0]) || 24
                                        const itemSpan = endH - startH

                                        // Then check for consecutive items from the same booking
                                        let j = i + 1
                                        let totalPrice = sorted[i].price
                                        let lastEndTime = sorted[i].endTime
                                        while (j < sorted.length && sorted[j].startTime === lastEndTime) {
                                            totalPrice += sorted[j].price
                                            lastEndTime = sorted[j].endTime
                                            j++
                                        }

                                        // Total span = sum of all hours across merged items
                                        let totalSpan = itemSpan
                                        for (let k = i + 1; k < j; k++) {
                                            const kStartH = parseInt(sorted[k].startTime.split(':')[0])
                                            const kEndH = parseInt(sorted[k].endTime.split(':')[0]) || 24
                                            totalSpan += (kEndH - kStartH)
                                        }

                                        if (totalSpan > 1) {
                                            const firstKey = `${sorted[i].courtId}_${sorted[i].startTime}`
                                            mergeInfo[firstKey] = { span: totalSpan, totalPrice, endTime: lastEndTime }
                                            // Mark all intermediate slots as skip
                                            for (let h = startH + 1; h < startH + totalSpan; h++) {
                                                skipSet.add(`${sorted[i].courtId}_${String(h).padStart(2, '0')}:00`)
                                            }
                                        }
                                        i = j
                                    }
                                })
                            })

                            // Show ALL courts for the selected venue (not just those with bookings)
                            const courtIds = new Set<string>()
                            activeBookings.forEach(b => b.bookingItems.forEach(item => courtIds.add(item.courtId)))
                            // Filter courts by selected venue
                            const venueCourts = selectedVenueId ? courts.filter(c => c.venueId === selectedVenueId) : courts
                            const venueCourtIds = new Set(venueCourts.map(c => c.id))
                            // Show ALL venue courts, not just booked ones
                            const gridCourts = [...venueCourts]
                            // If courts not in master list, add from booking data (respecting venue filter)
                            activeBookings.forEach(b => b.bookingItems.forEach(item => {
                                if (!gridCourts.find(c => c.id === item.courtId) && (!selectedVenueId || venueCourtIds.has(item.courtId))) {
                                    gridCourts.push({ id: item.courtId, name: item.court.name, sportType: '', venueId: null })
                                }
                            }))

                            // Determine time range from courts' operating hours for the selected day
                            const DAYS_MAP: Record<number, string> = { 0: 'SUNDAY', 1: 'MONDAY', 2: 'TUESDAY', 3: 'WEDNESDAY', 4: 'THURSDAY', 5: 'FRIDAY', 6: 'SATURDAY' }
                            // Use explicit noon time to avoid UTC midnight timezone shift
                            const selectedDayOfWeek = selectedDate ? DAYS_MAP[new Date(selectedDate + 'T12:00:00').getDay()] : ''
                            let minHour = 24, maxHour = 0
                            // Get operating hours from grid courts for this day
                            gridCourts.forEach(c => {
                                if (!c.operatingHours) return
                                const dayHours = c.operatingHours.find(oh => oh.dayOfWeek === selectedDayOfWeek)
                                if (dayHours && !dayHours.isClosed) {
                                    const openH = parseInt(dayHours.openTime.split(':')[0])
                                    const closeH = parseInt(dayHours.closeTime.split(':')[0])
                                    const closeM = parseInt(dayHours.closeTime.split(':')[1] || '0')
                                    const effectiveClose = closeH === 0 ? 24 : (closeM > 0 ? closeH + 1 : closeH)
                                    if (openH < minHour) minHour = openH
                                    if (effectiveClose > maxHour) maxHour = effectiveClose
                                }
                            })
                            // Also include hours from any bookings that fall outside operating hours
                            activeBookings.forEach(b => b.bookingItems.forEach(item => {
                                const h = parseInt(item.startTime.split(':')[0])
                                const eh = parseInt(item.endTime.split(':')[0])
                                const effectiveEnd = eh === 0 ? 24 : eh
                                if (h < minHour) minHour = h
                                if (effectiveEnd > maxHour) maxHour = effectiveEnd
                            }))
                            // Fallback if nothing found
                            if (minHour >= maxHour) { minHour = 8; maxHour = 23 }
                            const gridTimes: string[] = []
                            for (let h = minHour; h < maxHour; h++) {
                                gridTimes.push(`${h.toString().padStart(2, '0')}:00`)
                            }

                            const sportEmoji: Record<string, string> = {
                                'ski': '⛷️', 'สกี้': '⛷️', 'สกี': '⛷️',
                                'snowboard': '🏂', 'สโนบอร์ด': '🏂', 'สโนว์บอร์ด': '🏂',
                                'ฟุตบอล': '⚽', 'แบดมินตัน': '🏸', 'บาสเกตบอล': '🏀',
                                'วอลเลย์บอล': '🏐', 'เทนนิส': '🎾',
                            }
                            const getSportEmoji = (type: string) => {
                                const key = type.toLowerCase().trim()
                                return sportEmoji[key] || '🏟️'
                            }

                            return (
                                <div style={{ minWidth: gridCourts.length > 2 ? `${gridCourts.length * 220 + 70}px` : 'auto' }}>
                                    {/* Court header row */}
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: `70px repeat(${gridCourts.length}, 1fr)`,
                                        gap: '4px', marginBottom: '4px',
                                    }}>
                                        <div />
                                        {gridCourts.map(court => (
                                            <div key={court.id} style={{
                                                textAlign: 'center', padding: '10px 8px',
                                                background: '#e74c3c', color: '#fff',
                                                borderRadius: '8px 8px 0 0',
                                                fontWeight: 800, fontSize: '15px',
                                            }}>
                                                {court.name}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Time grid — absolute positioning for proper visual spanning */}
                                    {(() => {
                                        const ROW_H = 70  // px per hour
                                        const totalH = gridTimes.length * ROW_H

                                        return (
                                            <div style={{ display: 'grid', gridTemplateColumns: `70px repeat(${gridCourts.length}, 1fr)`, gridTemplateRows: `repeat(${gridTimes.length}, ${ROW_H}px)`, gap: '0 4px' }}>
                                                {/* Time labels - in grid column 1 */}
                                                {gridTimes.map((time, idx) => (
                                                    <div key={`time-${time}`} style={{
                                                        gridColumn: 1, gridRow: idx + 1,
                                                        position: 'relative' // relative to the grid cell
                                                    }}>
                                                        {/* Center on the TOP border of the grid cell to align with block boundaries */}
                                                        <div style={{
                                                            position: 'absolute',
                                                            top: 0, left: 0, right: 0,
                                                            transform: 'translateY(-50%)',
                                                            textAlign: 'center',
                                                            fontWeight: 700, fontSize: '13px',
                                                            color: 'var(--a-text-secondary)', fontFamily: "'Inter', sans-serif",
                                                            zIndex: 10,
                                                            background: '#fff', // cover row borders slightly for cleaner look
                                                        }}>
                                                            {time}
                                                        </div>
                                                    </div>
                                                ))}

                                                {/* Court columns - each spans ALL rows, uses position:relative */}
                                                {gridCourts.map((court, colIdx) => (
                                                    <div key={court.id} style={{
                                                        gridColumn: colIdx + 2,
                                                        gridRow: `1 / ${gridTimes.length + 1}`,
                                                        position: 'relative',
                                                    }}>
                                                        {/* Empty slot backgrounds - absolute */}
                                                        {gridTimes.map((time, idx) => (
                                                            <div key={`bg-${time}`} style={{
                                                                position: 'absolute', left: 0, right: 0,
                                                                top: `${idx * ROW_H}px`, height: `${ROW_H}px`,
                                                                borderRadius: '6px',
                                                                border: '1px solid var(--a-border)',
                                                                background: '#fafafa',
                                                            }} />
                                                        ))}

                                                        {/* Booking blocks - absolute, with explicit px height */}
                                                        {(() => {
                                                            const courtBookings: Array<{ booking: Booking; startTime: string; endTime: string; totalPrice: number }> = []
                                                            const processed = new Set<string>()

                                                            activeBookings.forEach(booking => {
                                                                const courtItems = booking.bookingItems
                                                                    .filter(item => item.courtId === court.id)
                                                                    .sort((a, b) => a.startTime.localeCompare(b.startTime))

                                                                let i = 0
                                                                while (i < courtItems.length) {
                                                                    const first = courtItems[i]
                                                                    let lastEnd = first.endTime
                                                                    let totalPrice = first.price
                                                                    let j = i + 1
                                                                    while (j < courtItems.length && courtItems[j].startTime === lastEnd) {
                                                                        totalPrice += courtItems[j].price
                                                                        lastEnd = courtItems[j].endTime
                                                                        j++
                                                                    }
                                                                    const mergeKey = `${booking.id}_${court.id}_${first.startTime}`
                                                                    if (!processed.has(mergeKey)) {
                                                                        processed.add(mergeKey)
                                                                        courtBookings.push({ booking, startTime: first.startTime, endTime: lastEnd, totalPrice })
                                                                    }
                                                                    i = j
                                                                }
                                                            })

                                                            // Process overlaps to display side-by-side
                                                            const bookingBlocks: Array<{
                                                                cb: typeof courtBookings[0],
                                                                col: number,
                                                                maxCols: number
                                                            }> = []

                                                            if (courtBookings.length > 0) {
                                                                // Sort by start time, then end time
                                                                const sorted = [...courtBookings].sort((a, b) => {
                                                                    if (a.startTime !== b.startTime) return a.startTime.localeCompare(b.startTime)
                                                                    return a.endTime.localeCompare(b.endTime)
                                                                })

                                                                const columns: typeof sorted[] = []
                                                                sorted.forEach(block => {
                                                                    // Find first column where the last block ends <= this block's start
                                                                    let placed = false
                                                                    for (let i = 0; i < columns.length; i++) {
                                                                        const lastInCol = columns[i][columns[i].length - 1]
                                                                        if (lastInCol.endTime <= block.startTime) {
                                                                            columns[i].push(block)
                                                                            placed = true
                                                                            break
                                                                        }
                                                                    }
                                                                    if (!placed) {
                                                                        columns.push([block])
                                                                    }
                                                                })

                                                                // Assign col and maxCols
                                                                for (let c = 0; c < columns.length; c++) {
                                                                    columns[c].forEach(block => {
                                                                        // Count how many total columns overlap with this block
                                                                        let overlappingCols = 0
                                                                        for (let i = 0; i < columns.length; i++) {
                                                                            const over = columns[i].some(b => b.startTime < block.endTime && b.endTime > block.startTime)
                                                                            if (over) overlappingCols++
                                                                        }
                                                                        bookingBlocks.push({ cb: block, col: c, maxCols: Math.max(1, overlappingCols) })
                                                                    })
                                                                }
                                                            }

                                                            return bookingBlocks.map(({ cb, col, maxCols }) => {
                                                                const startH = parseInt(cb.startTime.split(':')[0])
                                                                const endH = parseInt(cb.endTime.split(':')[0]) || 24
                                                                const topPx = (startH - minHour) * ROW_H
                                                                // Reverted: use exact endH for correct timeline representation
                                                                const heightPx = (endH - startH) * ROW_H
                                                                const hours = endH - startH
                                                                const isPaid = cb.booking.status === 'CONFIRMED'
                                                                const sportTypes = cb.booking.participants.map(p => p.sportType).filter(Boolean)
                                                                const sportLabel = sportTypes[0] || ''
                                                                const teacherItem = cb.booking.bookingItems.find(item => item.courtId === court.id && item.teacher)

                                                                if (hours <= 0) return null

                                                                const widthPercent = 100 / maxCols
                                                                const leftPercent = col * widthPercent

                                                                const isAdminBooking = cb.booking.createdByAdmin
                                                                const bgGrad = isAdminBooking
                                                                    ? 'linear-gradient(135deg, #D4A017, #B8860B)'
                                                                    : 'linear-gradient(135deg, #2196F3, #1976D2)'
                                                                const shadow = isAdminBooking
                                                                    ? '0 2px 8px rgba(212, 160, 23, 0.3)'
                                                                    : '0 2px 8px rgba(33, 150, 243, 0.3)'
                                                                const shadowHover = isAdminBooking
                                                                    ? '0 4px 16px rgba(212, 160, 23, 0.4)'
                                                                    : '0 4px 16px rgba(33, 150, 243, 0.4)'

                                                                return (
                                                                    <div key={`${cb.booking.id}_${cb.startTime}`}
                                                                        onClick={() => openBookingModal(cb.booking)}
                                                                        style={{
                                                                            position: 'absolute',
                                                                            left: `calc(${leftPercent}% + 2px)`,
                                                                            width: `calc(${widthPercent}% - 4px)`,
                                                                            top: `${topPx}px`,
                                                                            height: `${heightPx - 3}px`,
                                                                            maxHeight: `${heightPx - 3}px`,
                                                                            borderRadius: '6px',
                                                                            padding: '6px 8px', cursor: 'pointer',
                                                                            background: bgGrad,
                                                                            color: '#fff', transition: 'all 0.15s',
                                                                            display: 'flex', flexDirection: 'column',
                                                                            gap: '1px',
                                                                            boxShadow: shadow,
                                                                            overflow: 'hidden', zIndex: 2,
                                                                            boxSizing: 'border-box',
                                                                        }}
                                                                        onMouseEnter={e => { e.currentTarget.style.boxShadow = shadowHover }}
                                                                        onMouseLeave={e => { e.currentTarget.style.boxShadow = shadow }}
                                                                    >
                                                                        <div style={{ fontWeight: 800, fontSize: hours >= 2 ? '14px' : '12px', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                            {cb.booking.user?.lineDisplayName || cb.booking.user?.name || '-'}
                                                                        </div>
                                                                        <div style={{ fontSize: '11px', fontWeight: 700, opacity: 0.9 }}>
                                                                            🕐 {cb.startTime}–{cb.endTime} ({hours} ชม.)
                                                                        </div>
                                                                        {hours >= 2 && (
                                                                            <>
                                                                                <div style={{ fontSize: '11px', fontWeight: 600, opacity: 0.85, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                                    {cb.booking.user?.phone?.startsWith('LINE-') ? '🟢 LINE' : (cb.booking.user?.phone || '-')}
                                                                                </div>
                                                                                {sportLabel && (
                                                                                    <div style={{ fontSize: '11px', fontWeight: 600, opacity: 0.9 }}>
                                                                                        {getSportEmoji(sportLabel)} {sportLabel}
                                                                                    </div>
                                                                                )}
                                                                            </>
                                                                        )}
                                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
                                                                            <span style={{ background: 'rgba(255,255,255,0.2)', padding: '1px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 800 }}>
                                                                                ฿{cb.totalPrice.toLocaleString()}
                                                                            </span>
                                                                            <span style={{ background: isPaid ? '#4caf50' : '#ff9800', padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700 }}>
                                                                                {isPaid ? 'ชำระแล้ว' : 'รอชำระ'}
                                                                            </span>
                                                                        </div>
                                                                        {hours >= 2 && teacherItem?.teacher && (
                                                                            <div style={{ fontSize: '10px', opacity: 0.8 }}>🎓 {teacherItem.teacher.name}</div>
                                                                        )}
                                                                    </div>
                                                                )
                                                            })
                                                        })()}
                                                    </div>
                                                ))}
                                            </div>
                                        )
                                    })()}
                                </div>
                            )
                        })()}
                    </div>
                </div>
            )}


            {/* Booking detail modal with edit */}
            {viewBooking && (
                <div className="modal-overlay" onClick={() => setViewBooking(null)}>
                    <div className="admin-modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h2 style={{ fontSize: '20px', fontWeight: 700 }}>รายละเอียดการจอง</h2>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <button onClick={() => setEditMode(!editMode)} className="btn-admin-outline" style={{ padding: '6px 12px', fontSize: '12px' }}>
                                    {editMode ? '🔒 ยกเลิกแก้ไข' : '✏️ แก้ไข'}
                                </button>
                            </div>
                        </div>

                        {/* Big Status Banner */}
                        <div style={{
                            padding: '14px 20px', borderRadius: '12px', marginBottom: '16px',
                            background: statusMap[viewBooking.status]?.bg || '#f3f4f6',
                            border: `2px solid ${statusMap[viewBooking.status]?.color || '#9ca3af'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                        }}>
                            <span style={{ fontSize: '22px' }}>{statusMap[viewBooking.status]?.icon}</span>
                            <span style={{ fontSize: '18px', fontWeight: 800, color: statusMap[viewBooking.status]?.color || '#374151' }}>
                                {statusMap[viewBooking.status]?.label || viewBooking.status}
                            </span>
                        </div>

                        <div style={{ background: '#f8f9fa', padding: '16px', borderRadius: '10px', marginBottom: '16px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '14px' }}>
                                <div><strong>หมายเลข:</strong> {viewBooking.bookingNumber}</div>
                                <div>
                                    <strong>ยอดเงิน:</strong>{' '}
                                    {editMode ? (
                                        <>
                                            <input type="number" value={editAmount} onChange={e => setEditAmount(parseFloat(e.target.value) || 0)}
                                                style={{ width: '100px', padding: '2px 6px', border: '1px dashed #93c5fd', borderRadius: '4px', fontFamily: "'Inter'", fontWeight: 700 }} />
                                            <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>เดิม: ฿{viewBooking.totalAmount.toLocaleString()}</div>
                                        </>
                                    ) : `฿${viewBooking.totalAmount.toLocaleString()}`}
                                </div>
                                <div><strong>ลูกค้า:</strong> {viewBooking.user?.lineDisplayName || viewBooking.user?.name}{viewBooking.user?.lineDisplayName && viewBooking.user?.name !== viewBooking.user?.lineDisplayName ? ` (${viewBooking.user?.name})` : ''}</div>
                                <div><strong>โทร:</strong> {viewBooking.user?.phone?.startsWith('LINE-') ? <span style={{ color: '#06C755', fontWeight: 600 }}>🟢 LINE User</span> : (viewBooking.user?.phone || '-')}</div>
                                <div><strong>อีเมล:</strong> {viewBooking.user?.email?.endsWith('@line.local') ? <span style={{ color: '#999' }}>ไม่มี (LINE)</span> : viewBooking.user?.email}</div>
                                <div><strong>วันที่จอง:</strong> {new Date(viewBooking.createdAt).toLocaleDateString('th-TH')}</div>
                                {viewBooking.payments[0] && (
                                    <div><strong>วิธีชำระ:</strong> {
                                        viewBooking.payments[0].method === 'CASH' ? '💵 เงินสด'
                                        : viewBooking.payments[0].method === 'BANK_TRANSFER' ? `🏦 ธนาคาร${viewBooking.payments[0].bankName ? ' (' + viewBooking.payments[0].bankName + ')' : ''}`
                                        : viewBooking.payments[0].method === 'CREDIT_CARD' ? '💳 บัตรเครดิต'
                                        : viewBooking.payments[0].method === 'PROMPTPAY' ? '📱 พร้อมเพย์' : viewBooking.payments[0].method
                                    }</div>
                                )}
                                {editMode && (
                                    <div style={{ gridColumn: '1 / -1' }}>
                                        <strong>สถานะ:</strong>{' '}
                                        <select value={editStatus} onChange={e => setEditStatus(e.target.value)}
                                            style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--a-border)', marginLeft: '8px' }}>
                                            <option value="PENDING">🟡 รอชำระเงิน</option>
                                            <option value="CONFIRMED">✅ ชำระเงินแล้ว</option>
                                            <option value="CANCELLED">❌ ยกเลิก</option>
                                        </select>
                                    </div>
                                )}
                            </div>
                        </div>

                        <h3 style={{ fontWeight: 700, marginBottom: '8px', fontSize: '15px' }}>รายการจอง</h3>
                        {(editMode ? editBookingItems : viewBooking.bookingItems).map((item, i) => (
                            <div key={i} style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--a-border)', marginBottom: '8px', fontSize: '14px', position: 'relative' }}>
                                {editMode ? (
                                    <>
                                        {editBookingItems.length > 1 && (
                                            <button onClick={() => {
                                                setPendingCalendarAction({ message: 'ต้องการลบรายการจองนี้ออกใช่ไหม?', action: () => setEditBookingItems(editBookingItems.filter((_, j) => j !== i)) })
                                            }} style={{ position: 'absolute', top: '6px', right: '8px', background: '#fde8e8', border: '1px solid #f5c6cb', borderRadius: '6px', cursor: 'pointer', color: '#e17055', padding: '4px 8px', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'inherit' }}>
                                                🗑️ ลบ
                                            </button>
                                        )}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '6px' }}>
                                            <select value={(item as any).courtId} onChange={e => {
                                                const u = [...editBookingItems]; u[i] = { ...u[i], courtId: e.target.value }; setEditBookingItems(u)
                                            }} className="admin-input" style={{ fontSize: '13px' }}>
                                                <option value="">เลือกสนาม</option>
                                                {(() => {
                                                    // Filter courts by same venue as current booking
                                                    const currentCourt = courts.find(c => c.id === (item as any).courtId)
                                                    const venueId = currentCourt?.venueId
                                                    const filtered = venueId ? courts.filter(c => c.venueId === venueId) : courts
                                                    return filtered.map(c => <option key={c.id} value={c.id}>{c.name}</option>)
                                                })()}
                                            </select>
                                            <input type="date" value={(item as any).date} onChange={e => {
                                                const u = [...editBookingItems]; u[i] = { ...u[i], date: e.target.value }; setEditBookingItems(u)
                                            }} className="admin-input" style={{ fontSize: '13px' }} />
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr 1fr', gap: '6px', alignItems: 'center' }}>
                                            <select value={(item as any).startTime} onChange={e => {
                                                const newStart = e.target.value
                                                const end = (item as any).endTime
                                                const startH = parseInt(newStart.split(':')[0])
                                                const endH = parseInt(end.split(':')[0])
                                                const hours = endH > startH ? endH - startH : 1
                                                const perHour = viewBooking.bookingItems[0]?.price || (item as any).price
                                                const u = [...editBookingItems]; u[i] = { ...u[i], startTime: newStart, price: hours * perHour }; setEditBookingItems(u)
                                            }} className="admin-input" style={{ fontSize: '13px' }}>
                                                {Array.from({ length: 15 }, (_, h) => h + 8).map(h => {
                                                    const t = `${String(h).padStart(2, '0')}:00`
                                                    return <option key={t} value={t}>{t}</option>
                                                })}
                                            </select>
                                            <div style={{ fontSize: '13px', color: 'var(--a-text-muted)', fontWeight: 600 }}>ถึง</div>
                                            <select value={(item as any).endTime} onChange={e => {
                                                const newEnd = e.target.value
                                                const start = (item as any).startTime
                                                const startH = parseInt(start.split(':')[0])
                                                const endH = parseInt(newEnd.split(':')[0])
                                                const hours = endH > startH ? endH - startH : 1
                                                const perHour = viewBooking.bookingItems[0]?.price || (item as any).price
                                                const u = [...editBookingItems]; u[i] = { ...u[i], endTime: newEnd, price: hours * perHour }; setEditBookingItems(u)
                                            }} className="admin-input" style={{ fontSize: '13px' }}>
                                                {Array.from({ length: 15 }, (_, h) => h + 9).map(h => {
                                                    const t = `${String(h).padStart(2, '0')}:00`
                                                    return <option key={t} value={t}>{t}</option>
                                                })}
                                            </select>
                                            <div style={{ position: 'relative' }}>
                                                <input type="number" value={(item as any).price} onChange={e => {
                                                    const u = [...editBookingItems]; u[i] = { ...u[i], price: parseFloat(e.target.value) || 0 }; setEditBookingItems(u)
                                                }} placeholder="ราคา" className="admin-input" style={{ fontSize: '13px' }} />
                                                {(() => {
                                                    const s = parseInt(((item as any).startTime || '09:00').split(':')[0])
                                                    const e = parseInt(((item as any).endTime || '10:00').split(':')[0])
                                                    const h = e > s ? e - s : 1
                                                    return h > 1 ? <span style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '10px', color: 'var(--a-primary)', fontWeight: 700, pointerEvents: 'none' }}>({h} ชม.)</span> : null
                                                })()}
                                            </div>
                                        </div>
                                        {/* Teacher selection */}
                                        <div style={{ marginTop: '6px' }}>
                                            <select value={(item as any).teacherId || ''} onChange={e => {
                                                const u = [...editBookingItems]; u[i] = { ...u[i], teacherId: e.target.value || null }; setEditBookingItems(u)
                                            }} className="admin-input" style={{ fontSize: '13px' }}>
                                                <option value="">🎓 ไม่มีครูผู้สอน</option>
                                                {teachers.filter(t => t.isActive && t.workStatus === 'ACTIVE').map(t => (
                                                    <option key={t.id} value={t.id}>🎓 {t.name}{t.specialty ? ` (${t.specialty})` : ''}</option>
                                                ))}
                                            </select>
                                        </div>
                                        {/* Show original data */}
                                        {viewBooking.bookingItems[i] && (
                                            <div style={{ fontSize: '11px', color: '#999', marginTop: '4px', padding: '4px 8px', background: '#fafafa', borderRadius: '4px', borderLeft: '3px solid #ddd' }}>
                                                📌 ข้อมูลเดิม: {(viewBooking.bookingItems[i] as any).court?.name || courts.find(c => c.id === viewBooking.bookingItems[i].courtId)?.name} | {new Date(viewBooking.bookingItems[i].date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} | {viewBooking.bookingItems[i].startTime}-{viewBooking.bookingItems[i].endTime} | ฿{viewBooking.bookingItems[i].price.toLocaleString()}
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <div style={{ fontWeight: 600 }}>{(item as any).court?.name || courts.find(c => c.id === (item as any).courtId)?.name}</div>
                                        <div style={{ color: 'var(--a-text-secondary)' }}>
                                            {new Date((item as any).date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} | {(item as any).startTime} - {(item as any).endTime} | ฿{(item as any).price.toLocaleString()}
                                        </div>
                                        {(item as any).teacher && (
                                            <div style={{ fontSize: '12px', color: 'var(--a-primary)', marginTop: '4px' }}>👨‍🏫 ครู: {(item as any).teacher.name}</div>
                                        )}
                                    </>
                                )}
                            </div>
                        ))}

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', marginTop: '16px' }}>
                            <h3 style={{ fontWeight: 700, fontSize: '15px' }}>ผู้เรียน</h3>
                            {editMode && (
                                <button onClick={() => setEditParticipants(prev => [...prev, { name: '', sportType: '', phone: '', height: '', weight: '' }])}
                                    style={{ fontSize: '12px', padding: '4px 12px', borderRadius: '6px', border: '1px solid var(--a-primary)', background: 'var(--a-primary-light)', color: 'var(--a-primary)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                                    + เพิ่มผู้เรียน
                                </button>
                            )}
                        </div>
                        {(editMode ? editParticipants : viewBooking.participants).map((p, i) => (
                            <div key={i} style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--a-border)', marginBottom: '8px', fontSize: '14px', position: 'relative' }}>
                                {editMode ? (
                                    <>
                                        {editParticipants.length > 1 && (
                                            <button onClick={() => {
                                                setPendingCalendarAction({ message: 'ต้องการลบผู้เรียนคนนี้ออกใช่ไหม?', action: () => setEditParticipants(editParticipants.filter((_, j) => j !== i)) })
                                            }} style={{ position: 'absolute', top: '6px', right: '8px', background: '#fde8e8', border: '1px solid #f5c6cb', borderRadius: '6px', cursor: 'pointer', color: '#e17055', padding: '4px 8px', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'inherit' }}>
                                                🗑️ ลบ
                                            </button>
                                        )}
                                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--a-text-muted)', marginBottom: '6px' }}>ผู้เรียนคนที่ {i + 1}</div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '6px' }}>
                                            <input value={p.name} onChange={e => {
                                                const u = [...editParticipants]; u[i] = { ...u[i], name: e.target.value }; setEditParticipants(u)
                                            }} placeholder="ชื่อ-นามสกุล" className="admin-input" style={{ fontSize: '13px' }} />
                                            <select value={p.sportType} onChange={e => {
                                                const u = [...editParticipants]; u[i] = { ...u[i], sportType: e.target.value }; setEditParticipants(u)
                                            }} className="admin-input" style={{ fontSize: '13px' }}>
                                                <option value="">ประเภทกีฬา</option>
                                                {sportTypes.map(st => (
                                                    <option key={st} value={st}>{st}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                                            <input value={(p as any).height || ''} onChange={e => {
                                                const u = [...editParticipants]; u[i] = { ...u[i], height: e.target.value }; setEditParticipants(u)
                                            }} placeholder="ส่วนสูง (ซม.)" className="admin-input" style={{ fontSize: '13px' }} />
                                            <input value={(p as any).weight || ''} onChange={e => {
                                                const u = [...editParticipants]; u[i] = { ...u[i], weight: e.target.value }; setEditParticipants(u)
                                            }} placeholder="น้ำหนัก (กก.)" className="admin-input" style={{ fontSize: '13px' }} />
                                            <input value={p.phone} onChange={e => {
                                                const u = [...editParticipants]; u[i] = { ...u[i], phone: e.target.value }; setEditParticipants(u)
                                            }} placeholder="เบอร์โทร" className="admin-input" style={{ fontSize: '13px' }} />
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <strong>{p.name}</strong> - {p.sportType}
                                        {(p as any).height && ` | ${(p as any).height} ซม.`}
                                        {(p as any).weight && ` | ${(p as any).weight} กก.`}
                                        {p.phone && ` | ${p.phone}`}
                                    </>
                                )}
                            </div>
                        ))}

                        <div style={{ display: 'flex', gap: '12px', marginTop: '20px', justifyContent: 'flex-end' }}>
                            {editMode ? (
                                <>
                                    <button onClick={() => setEditMode(false)} className="btn-admin-outline">ยกเลิก</button>
                                    <button onClick={saveChanges} disabled={saving} className="btn-admin">
                                        {saving ? 'กำลังบันทึก...' : '💾 บันทึกการแก้ไข'}
                                    </button>
                                </>
                            ) : (
                                <>
                                    {viewBooking.status !== 'CANCELLED' && (
                                        <button onClick={async () => {
                                            const reason = prompt('ระบุเหตุผลในการยกเลิก:')
                                            if (reason === null) return
                                            const res = await fetch('/api/bookings', {
                                                method: 'PATCH',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ bookingId: viewBooking.id, action: 'cancel', reason }),
                                            })
                                            if (res.ok) {
                                                toast.success('ยกเลิกการจองสำเร็จ')
                                                setViewBooking(null)
                                                const fetchRes = await fetch(`/api/bookings?date=${selectedDate}`, { cache: 'no-store' })
                                                const data = await fetchRes.json()
                                                if (data.bookings) setBookings(data.bookings)
                                            }
                                        }} className="btn-admin-outline" style={{ color: '#e17055', borderColor: '#e17055' }}>ยกเลิกการจอง</button>
                                    )}
                                    {viewBooking.status === 'PENDING' && (
                                        <button onClick={async () => {
                                            const res = await fetch('/api/bookings', {
                                                method: 'PATCH',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ bookingId: viewBooking.id, status: 'CONFIRMED' }),
                                            })
                                            if (res.ok) {
                                                toast.success('ยืนยันการจองสำเร็จ')
                                                setViewBooking(null)
                                                const fetchRes = await fetch(`/api/bookings?date=${selectedDate}`, { cache: 'no-store' })
                                                const data = await fetchRes.json()
                                                if (data.bookings) setBookings(data.bookings)
                                            }
                                        }} className="btn-admin">ยืนยันการจอง</button>
                                    )}
                                    <button onClick={() => setViewBooking(null)} className="btn-admin-outline">ปิด</button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ===== NEW BOOKING MODAL ===== */}
            {showBookModal && (
                <div className="modal-overlay" onClick={() => setShowBookModal(false)}>
                    <div className="admin-modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '650px', maxHeight: '90vh', overflow: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ fontSize: '20px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <UserPlus size={22} style={{ color: 'var(--a-primary)' }} /> จองให้ลูกค้า
                            </h2>
                            <button onClick={() => setShowBookModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
                        </div>

                        {/* Customer search */}
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ fontWeight: 600, fontSize: '14px', marginBottom: '6px', display: 'block' }}>ค้นหาลูกค้า</label>
                            <div style={{ position: 'relative' }}>
                                <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--a-text-muted)' }} />
                                <input className="admin-input" style={{ paddingLeft: '36px' }} placeholder="พิมพ์ชื่อ / เบอร์โทร / อีเมล" value={bookSearch} onChange={e => { setBookSearch(e.target.value); if (bookCustomer) setBookCustomer(null) }} />
                            </div>
                            {customers.length > 0 && !bookCustomer && (
                                <div style={{ border: '1px solid var(--a-border)', borderRadius: '8px', marginTop: '4px', maxHeight: '150px', overflow: 'auto' }}>
                                    {customers.map(c => (
                                        <button key={c.id} onClick={() => { setBookCustomer(c); setBookSearch(c.name); setCustomers([]) }}
                                            style={{ display: 'block', width: '100%', padding: '10px 14px', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', borderBottom: '1px solid var(--a-border)', fontSize: '14px' }}>
                                            <strong>{c.name}</strong> <span style={{ color: 'var(--a-text-muted)' }}>{c.phone}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                            {bookCustomer && (
                                <div style={{ marginTop: '6px', padding: '8px 14px', background: '#e8f5e9', borderRadius: '8px', fontSize: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span>✅ <strong>{bookCustomer.name}</strong> ({bookCustomer.phone})</span>
                                    <button onClick={() => { setBookCustomer(null); setBookSearch('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e17055', fontWeight: 600, fontSize: '13px' }}>เปลี่ยน</button>
                                </div>
                            )}
                        </div>

                        {/* Court selection */}
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ fontWeight: 600, fontSize: '14px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}><MapPin size={14} /> สนาม</label>
                            <select className="admin-input" value={bookCourt} onChange={e => { setBookCourt(e.target.value); setBookTimes([]); setAvailSlots([]) }}>
                                <option value="">เลือกสนาม</option>
                                {courts.map(c => <option key={c.id} value={c.id}>{c.name} {c.sportType ? `(${c.sportType})` : ''}</option>)}
                            </select>
                        </div>

                        {/* Date selection — mini calendar */}
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ fontWeight: 600, fontSize: '14px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Calendar size={14} /> เลือกวันที่ <span style={{ fontWeight: 400, color: 'var(--a-text-muted)', fontSize: '12px' }}>(คลิกเลือกได้หลายวัน)</span>
                            </label>
                            {bookDates.length > 0 && (
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                                    {bookDates.map(d => (
                                        <span key={d} style={{ padding: '4px 10px', borderRadius: '6px', background: 'var(--a-primary)', color: 'white', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            {new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                                            <button onClick={() => toggleBookDate(d)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'white', padding: 0, fontSize: '14px', lineHeight: 1 }}>×</button>
                                        </span>
                                    ))}
                                </div>
                            )}
                            <div style={{ border: '1px solid var(--a-border)', borderRadius: '10px', padding: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <button onClick={() => changeBookMonth(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}><ChevronLeft size={16} /></button>
                                    <span style={{ fontWeight: 700, fontSize: '14px' }}>{monthNames[bookCalMo]} {bookCalYear + 543}</span>
                                    <button onClick={() => changeBookMonth(1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}><ChevronRight size={16} /></button>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
                                    {dayHeaders.map(d => (
                                        <div key={d} style={{ textAlign: 'center', fontSize: '10px', fontWeight: 700, color: 'var(--a-text-muted)', padding: '4px 0' }}>{d}</div>
                                    ))}
                                    {bookCalCells.map((day, idx) => {
                                        if (day === null) return <div key={`be-${idx}`} />
                                        const dateStr = `${bookCalYear}-${String(bookCalMo + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                                        const isChosen = bookDates.includes(dateStr)
                                        const isPast = dateStr < todayStr
                                        return (
                                            <div key={dateStr}
                                                onClick={() => !isPast && toggleBookDate(dateStr)}
                                                style={{
                                                    textAlign: 'center', padding: '6px 2px', borderRadius: '6px', fontSize: '13px', fontWeight: 600,
                                                    cursor: isPast ? 'default' : 'pointer',
                                                    background: isChosen ? 'var(--a-primary)' : 'transparent',
                                                    color: isChosen ? 'white' : isPast ? '#ccc' : 'var(--a-text)',
                                                    transition: 'all 0.15s',
                                                }}>
                                                {day}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Time selection — color-coded like customer page */}
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ fontWeight: 600, fontSize: '14px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Clock size={14} /> เลือกเวลา <span style={{ fontWeight: 400, color: 'var(--a-text-muted)', fontSize: '12px' }}>(เลือกได้หลายชั่วโมง)</span>
                            </label>
                            {!bookCourt && <div style={{ fontSize: '13px', color: 'var(--a-text-muted)', padding: '8px 0' }}>⬆️ กรุณาเลือกสนามและวันที่ก่อน</div>}
                            {loadingAvail && <div style={{ fontSize: '12px', color: 'var(--a-text-muted)', marginBottom: '6px' }}>⏳ กำลังตรวจสอบเวลาที่ว่าง...</div>}
                            {/* Legend */}
                            {bookCourt && bookDates.length > 0 && (
                                <div style={{ display: 'flex', gap: '12px', marginBottom: '8px', fontSize: '11px', color: 'var(--a-text-muted)' }}>
                                    <span>🟢 ว่าง</span>
                                    <span>🔴 เต็ม</span>
                                    <span>⬛ ผ่านแล้ว</span>
                                    <span>🟠 เลือกแล้ว</span>
                                </div>
                            )}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
                                {availSlots.map(slot => {
                                    const chosen = bookTimes.includes(slot.startTime)
                                    const isBooked = slot.status === 'booked' || slot.status === 'locked'
                                    const isPast = slot.status === 'past'
                                    const disabled = isBooked || isPast
                                    return (
                                        <button key={slot.startTime} onClick={() => !disabled && toggleBookTime(slot.startTime)}
                                            disabled={disabled}
                                            title={isBooked ? 'ถูกจองแล้ว' : isPast ? 'เวลาผ่านแล้ว' : `฿${slot.price.toLocaleString()}`}
                                            style={{
                                                padding: '8px 4px', fontSize: '13px', fontWeight: 600, borderRadius: '8px',
                                                cursor: disabled ? 'not-allowed' : 'pointer',
                                                border: chosen ? '2px solid var(--a-primary)' : disabled ? '1px solid #e0e0e0' : '1px solid #c6f6d5',
                                                background: chosen ? 'var(--a-primary)' : isBooked ? '#fde8e8' : isPast ? '#f3f3f3' : '#f0fff4',
                                                color: chosen ? 'white' : disabled ? '#bbb' : '#27ae60',
                                                fontFamily: 'inherit', transition: 'all 0.15s',
                                                textDecoration: isBooked ? 'line-through' : 'none',
                                            }}>
                                            {slot.startTime}
                                            <span style={{ display: 'block', fontSize: '10px', fontWeight: 500, color: chosen ? 'rgba(255,255,255,0.8)' : disabled ? '#ccc' : '#999' }}>
                                                {isBooked ? 'เต็ม' : isPast ? 'ผ่าน' : `฿${slot.price.toLocaleString()}`}
                                            </span>
                                        </button>
                                    )
                                })}
                            </div>
                            {availSlots.length === 0 && bookCourt && bookDates.length > 0 && !loadingAvail && (
                                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--a-text-muted)', fontSize: '13px' }}>ไม่มีเวลาให้จองสำหรับสนามนี้</div>
                            )}
                        </div>

                        {/* Participants — unlimited for admin */}
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ fontWeight: 600, fontSize: '14px', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span>👥 ผู้เรียน ({bookParticipants.length} คน)</span>
                                <button onClick={addParticipant} type="button" style={{ fontSize: '13px', padding: '4px 12px', borderRadius: '6px', border: '1px solid var(--a-primary)', background: 'var(--a-primary-light)', color: 'var(--a-primary)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>+ เพิ่มผู้เรียน</button>
                            </label>
                            {bookParticipants.map((p, i) => (
                                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px 30px', gap: '6px', marginBottom: '6px', alignItems: 'center' }}>
                                    <input className="admin-input" placeholder="ชื่อ" value={p.name} onChange={e => updateParticipant(i, 'name', e.target.value)} style={{ fontSize: '13px' }} />
                                    <select className="admin-input" value={p.sportType} onChange={e => updateParticipant(i, 'sportType', e.target.value)} style={{ fontSize: '13px' }}>
                                        <option value="">ประเภท</option>
                                        <option value="สกี้">⛷️ สกี้</option>
                                        <option value="สโนว์บอร์ด">🏂 สโนว์บอร์ด</option>
                                    </select>
                                    <input className="admin-input" placeholder="เบอร์" value={p.phone} onChange={e => updateParticipant(i, 'phone', e.target.value)} style={{ fontSize: '13px' }} />
                                    {bookParticipants.length > 1 && (
                                        <button onClick={() => removeParticipant(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e17055', fontSize: '16px', padding: 0 }}>✕</button>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Booking Status */}
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ fontWeight: 600, fontSize: '14px', marginBottom: '6px', display: 'block' }}>สถานะการชำระ</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => setBookStatus('CONFIRMED')} style={{
                                    flex: 1, padding: '10px', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                                    border: bookStatus === 'CONFIRMED' ? '2px solid #27ae60' : '1px solid var(--a-border)',
                                    background: bookStatus === 'CONFIRMED' ? '#e8f5e9' : 'white',
                                    color: bookStatus === 'CONFIRMED' ? '#27ae60' : 'var(--a-text)',
                                }}>✅ จ่ายแล้ว</button>
                                <button onClick={() => setBookStatus('PENDING')} style={{
                                    flex: 1, padding: '10px', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                                    border: bookStatus === 'PENDING' ? '2px solid #f5a623' : '1px solid var(--a-border)',
                                    background: bookStatus === 'PENDING' ? '#fff8e1' : 'white',
                                    color: bookStatus === 'PENDING' ? '#f5a623' : 'var(--a-text)',
                                }}>🟡 ยังไม่จ่าย</button>
                            </div>
                        </div>

                        {/* Summary */}
                        {bookDates.length > 0 && bookTimes.length > 0 && (
                            <div style={{ padding: '12px 16px', background: '#f0fff4', borderRadius: '10px', border: '1px solid #c6f6d5', marginBottom: '16px', fontSize: '14px' }}>
                                <strong>📋 สรุป:</strong> {bookDates.length} วัน × {bookTimes.length} ชม. = <strong>{bookDates.length * bookTimes.length} รายการจอง</strong>
                                {(() => { const total = bookTimes.reduce((sum, t) => { const s = availSlots.find(sl => sl.startTime === t); return sum + (s?.price || 0) }, 0) * bookDates.length; return total > 0 ? <span style={{ marginLeft: '8px', fontWeight: 700, color: 'var(--a-primary)' }}>฿{total.toLocaleString()}</span> : null })()}
                            </div>
                        )}

                        {/* Submit */}
                        <button onClick={submitBooking} className="btn-admin" disabled={bookSubmitting || !bookCustomer || !bookCourt || bookDates.length === 0 || bookTimes.length === 0}
                            style={{ width: '100%', padding: '14px', fontSize: '16px', fontWeight: 700 }}>
                            {bookSubmitting ? 'กำลังจอง...' : `ยืนยันการจอง${bookDates.length > 0 && bookTimes.length > 0 ? ` (${bookDates.length * bookTimes.length} รายการ)` : ''}`}
                        </button>
                    </div>
                </div>
            )}

            <ConfirmModal
                open={!!pendingCalendarAction}
                title="ยืนยันลบ"
                message={pendingCalendarAction?.message || ''}
                confirmText="ลบ"
                type="danger"
                icon="🗑️"
                onConfirm={() => { pendingCalendarAction?.action(); setPendingCalendarAction(null) }}
                onCancel={() => setPendingCalendarAction(null)}
            />
        </div></FadeIn>
    )
}
