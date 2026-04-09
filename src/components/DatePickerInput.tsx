'use client'

import type { CSSProperties } from 'react'

type DatePickerInputProps = {
    value: string
    onChange: (value: string) => void
    style?: CSSProperties
    className?: string
    placeholder?: string
}

function formatDisplayDate(value: string) {
    if (!value) return ''
    const [year, month, day] = value.split('-')
    if (!year || !month || !day) return value
    return `${day}/${month}/${year}`
}

export default function DatePickerInput({
    value,
    onChange,
    style,
    className = 'admin-input',
    placeholder = 'วัน/เดือน/ปี',
}: DatePickerInputProps) {
    return (
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', ...style }}>
            <input
                type="text"
                className={className}
                value={formatDisplayDate(value)}
                readOnly
                placeholder={placeholder}
                style={{ width: '100%', paddingRight: '36px', cursor: 'pointer' }}
            />
            <input
                type="date"
                value={value}
                onChange={e => onChange(e.target.value)}
                aria-label={placeholder}
                style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%' }}
            />
        </div>
    )
}
