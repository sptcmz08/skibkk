'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'

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
    const popupRef = useRef<HTMLDivElement>(null)
    const selectedDate = useMemo(() => parseDate(value), [value])
    const [open, setOpen] = useState(false)
    const [viewDate, setViewDate] = useState(() => selectedDate || new Date())
    const [resolvedPlacement, setResolvedPlacement] = useState<'top' | 'bottom'>('bottom')
    const [popupStyle, setPopupStyle] = useState<CSSProperties | null>(null)

    useEffect(() => {
        if (!open) return

        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target as Node
            if (containerRef.current?.contains(target) || popupRef.current?.contains(target)) return
            setOpen(false)
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

        const updatePopupPosition = () => {
            const triggerRect = containerRef.current?.getBoundingClientRect()
            if (!triggerRect) return

            const horizontalMargin = 16
            const popupWidth = Math.min(Math.max(triggerRect.width, 280), window.innerWidth - horizontalMargin * 2)
            const popupHeight = popupRef.current?.offsetHeight || 320
            const spaceBelow = window.innerHeight - triggerRect.bottom
            const spaceAbove = triggerRect.top

            let placement: 'top' | 'bottom'
            if (popupPlacement === 'top' || popupPlacement === 'bottom') {
                placement = popupPlacement
            } else {
                placement = spaceBelow < popupHeight && spaceAbove > spaceBelow ? 'top' : 'bottom'
            }

            setResolvedPlacement(placement)

            const left = Math.min(
                Math.max(horizontalMargin, triggerRect.left),
                window.innerWidth - popupWidth - horizontalMargin
            )
            const top = placement === 'top'
                ? Math.max(horizontalMargin, triggerRect.top - popupHeight - 6)
                : Math.min(window.innerHeight - popupHeight - horizontalMargin, triggerRect.bottom + 6)

            setPopupStyle({
                position: 'fixed',
                top,
                left,
                width: popupWidth,
                maxWidth: `calc(100vw - ${horizontalMargin * 2}px)`,
                padding: '12px',
                background: '#fff',
                color: 'var(--a-text)',
                border: '1px solid var(--a-border)',
                borderRadius: '8px',
                boxShadow: '0 14px 32px rgba(15, 23, 42, 0.18)',
                zIndex: 350,
            })
        }

        updatePopupPosition()
        const rafId = window.requestAnimationFrame(updatePopupPosition)
        window.addEventListener('resize', updatePopupPosition)
        window.addEventListener('scroll', updatePopupPosition, true)
        return () => {
            window.cancelAnimationFrame(rafId)
            window.removeEventListener('resize', updatePopupPosition)
            window.removeEventListener('scroll', updatePopupPosition, true)
        }
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

            {open && typeof document !== 'undefined' && popupStyle && createPortal(
                <div
                    ref={popupRef}
                    role="dialog"
                    aria-label={placeholder}
                    data-placement={resolvedPlacement}
                    style={popupStyle}
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
                </div>,
                document.body
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
