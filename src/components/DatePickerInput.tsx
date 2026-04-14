'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent } from 'react'

type DatePickerInputProps = {
    value: string
    onChange: (value: string) => void
    style?: CSSProperties
    className?: string
    placeholder?: string
    popupPlacement?: 'auto' | 'top' | 'bottom'
}

function formatDisplayDate(value: string) {
    if (!value) return ''
    const [year, month, day] = value.split('-')
    if (!year || !month || !day) return value
    return `${day}/${month}/${year}`
}

function parseDate(value: string) {
    const [year, month, day] = value.split('-').map(Number)
    if (!year || !month || !day) return null
    return new Date(year, month - 1, day)
}

function toDateInputValue(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function isSameDay(a: Date, b: Date) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

const MONTHS_TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const WEEKDAYS_TH = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']

export default function DatePickerInput({
    value,
    onChange,
    style,
    className = 'admin-input',
    placeholder = 'วัน/เดือน/ปี',
    popupPlacement = 'auto',
}: DatePickerInputProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const selectedDate = useMemo(() => parseDate(value), [value])
    const [open, setOpen] = useState(false)
    const [viewDate, setViewDate] = useState(() => selectedDate || new Date())
    const [resolvedPlacement, setResolvedPlacement] = useState<'top' | 'bottom'>('bottom')

    useEffect(() => {
        if (!open) return

        const handlePointerDown = (event: PointerEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
        }

        const handleKeyDown = (event: globalThis.KeyboardEvent) => {
            if (event.key === 'Escape') setOpen(false)
        }

        document.addEventListener('pointerdown', handlePointerDown)
        document.addEventListener('keydown', handleKeyDown)
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown)
            document.removeEventListener('keydown', handleKeyDown)
        }
    }, [open])

    useEffect(() => {
        if (!open) return

        if (popupPlacement === 'top' || popupPlacement === 'bottom') {
            setResolvedPlacement(popupPlacement)
            return
        }

        const triggerRect = containerRef.current?.getBoundingClientRect()
        if (!triggerRect) return

        const estimatedCalendarHeight = 320
        const spaceBelow = window.innerHeight - triggerRect.bottom
        const spaceAbove = triggerRect.top
        const shouldOpenTop = spaceBelow < estimatedCalendarHeight && spaceAbove > spaceBelow

        setResolvedPlacement(shouldOpenTop ? 'top' : 'bottom')
    }, [open, popupPlacement])

    const calendarDays = useMemo(() => {
        const firstOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1)
        const firstCalendarDay = new Date(firstOfMonth)
        firstCalendarDay.setDate(1 - firstOfMonth.getDay())

        return Array.from({ length: 42 }, (_, index) => {
            const day = new Date(firstCalendarDay)
            day.setDate(firstCalendarDay.getDate() + index)
            return day
        })
    }, [viewDate])

    const changeMonth = (delta: number) => {
        setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1))
    }

    const toggleCalendar = () => {
        if (!open) setViewDate(selectedDate || new Date())
        setOpen(prev => !prev)
    }

    const selectDate = (date: Date) => {
        onChange(toDateInputValue(date))
        setOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            toggleCalendar()
        }
        if (event.key === 'ArrowDown') {
            event.preventDefault()
            setViewDate(selectedDate || new Date())
            setOpen(true)
        }
    }

    const today = new Date()

    return (
        <div ref={containerRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', ...style }}>
            <input
                type="text"
                className={className}
                value={formatDisplayDate(value)}
                readOnly
                placeholder={placeholder}
                onClick={toggleCalendar}
                onKeyDown={handleKeyDown}
                aria-haspopup="dialog"
                style={{ width: '100%', paddingRight: '36px', cursor: 'pointer', background: '#fff' }}
            />
            <button
                type="button"
                onClick={toggleCalendar}
                aria-label={placeholder}
                aria-haspopup="dialog"
                aria-expanded={open}
                style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--a-text-muted)',
                    cursor: 'pointer',
                    fontSize: '14px',
                    lineHeight: 1,
                    padding: '4px',
                }}
            >
                ▼
            </button>

            {open && (
                <div
                    role="dialog"
                    aria-label={placeholder}
                    style={{
                        position: 'absolute',
                        ...(resolvedPlacement === 'top' ? { bottom: 'calc(100% + 6px)' } : { top: 'calc(100% + 6px)' }),
                        left: 0,
                        width: '280px',
                        maxWidth: 'calc(100vw - 32px)',
                        padding: '12px',
                        background: '#fff',
                        color: 'var(--a-text)',
                        border: '1px solid var(--a-border)',
                        borderRadius: '8px',
                        boxShadow: '0 14px 32px rgba(15, 23, 42, 0.18)',
                        zIndex: 300,
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <button type="button" onClick={() => changeMonth(-1)} style={calendarNavButtonStyle}>‹</button>
                        <div style={{ fontWeight: 800, fontSize: '14px' }}>
                            {MONTHS_TH[viewDate.getMonth()]} {viewDate.getFullYear()}
                        </div>
                        <button type="button" onClick={() => changeMonth(1)} style={calendarNavButtonStyle}>›</button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '4px' }}>
                        {WEEKDAYS_TH.map(day => (
                            <div key={day} style={{ textAlign: 'center', fontSize: '11px', fontWeight: 800, color: 'var(--a-text-muted)', padding: '4px 0' }}>
                                {day}
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                        {calendarDays.map(day => {
                            const isCurrentMonth = day.getMonth() === viewDate.getMonth()
                            const isSelected = selectedDate ? isSameDay(day, selectedDate) : false
                            const isToday = isSameDay(day, today)

                            return (
                                <button
                                    key={toDateInputValue(day)}
                                    type="button"
                                    onClick={() => selectDate(day)}
                                    style={{
                                        height: '34px',
                                        borderRadius: '8px',
                                        border: isSelected ? '1px solid var(--a-primary)' : isToday ? '1px solid rgba(250, 204, 21, 0.75)' : '1px solid transparent',
                                        background: isSelected ? 'var(--a-primary)' : isToday ? 'rgba(250, 204, 21, 0.14)' : 'transparent',
                                        color: isSelected ? '#2d2a00' : isCurrentMonth ? 'var(--a-text)' : 'var(--a-text-muted)',
                                        opacity: isCurrentMonth ? 1 : 0.45,
                                        fontWeight: isSelected || isToday ? 800 : 600,
                                        cursor: 'pointer',
                                        fontFamily: 'inherit',
                                    }}
                                >
                                    {day.getDate()}
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}

const calendarNavButtonStyle: CSSProperties = {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    border: '1px solid var(--a-border)',
    background: '#fff',
    color: 'var(--a-text)',
    cursor: 'pointer',
    fontWeight: 900,
    fontSize: '18px',
    lineHeight: 1,
}
