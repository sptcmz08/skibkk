'use client'

import { useState, useEffect } from 'react'
import { FileText, ChevronLeft, ChevronRight, Filter } from 'lucide-react'

interface AuditLog {
    id: string
    action: string
    entityType: string
    entityId: string
    details: string
    createdAt: string
    user: { name: string; email: string; role: string }
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
    BOOKING_CANCEL: { label: 'ยกเลิกจอง', color: '#d63031' },
    BOOKING_UPDATE: { label: 'แก้ไขจอง', color: '#f39c12' },
    BOOKING_CREATE: { label: 'สร้างจอง', color: '#00b894' },
    USER_CREATE: { label: 'สร้างผู้ใช้', color: '#3b82f6' },
    USER_DEACTIVATE: { label: 'ปิดการใช้งาน', color: '#e17055' },
    SETTINGS_UPDATE: { label: 'แก้ไขตั้งค่า', color: '#6c5ce7' },
}

export default function LogsPage() {
    const [logs, setLogs] = useState<AuditLog[]>([])
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [filterAction, setFilterAction] = useState('')

    useEffect(() => {
        setLoading(true)
        const params = new URLSearchParams({ page: String(page), limit: '30' })
        if (filterAction) params.set('action', filterAction)

        fetch(`/api/audit-logs?${params}`, { cache: 'no-store' })
            .then(r => r.json())
            .then(data => {
                setLogs(data.logs || [])
                setTotalPages(data.totalPages || 1)
            })
            .catch(() => { })
            .finally(() => setLoading(false))
    }, [page, filterAction])

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr)
        return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) +
            ' ' + d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
    }

    const parseDetails = (details: string) => {
        try {
            const obj = JSON.parse(details)
            if (obj.bookingNumber) return `#${obj.bookingNumber}`
            if (obj.reason) return obj.reason
            return Object.entries(obj).map(([k, v]) => `${k}: ${v}`).slice(0, 2).join(', ')
        } catch { return details || '-' }
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--a-text)' }}>บันทึกการใช้งาน (Audit Log)</h2>
                    <p style={{ color: 'var(--a-text-secondary)', fontSize: '14px' }}>ประวัติการดำเนินการของแอดมิน</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Filter size={16} style={{ color: 'var(--a-text-muted)' }} />
                    <select
                        className="admin-input"
                        style={{ width: 'auto', minWidth: '160px' }}
                        value={filterAction}
                        onChange={e => { setFilterAction(e.target.value); setPage(1) }}
                    >
                        <option value="">ทั้งหมด</option>
                        <option value="BOOKING_CANCEL">ยกเลิกจอง</option>
                        <option value="BOOKING_UPDATE">แก้ไขจอง</option>
                        <option value="BOOKING_CREATE">สร้างจอง</option>
                        <option value="USER_CREATE">สร้างผู้ใช้</option>
                        <option value="USER_DEACTIVATE">ปิดการใช้งาน</option>
                        <option value="SETTINGS_UPDATE">แก้ไขตั้งค่า</option>
                    </select>
                </div>
            </div>

            <div className="admin-card">
                {loading ? (
                    <div style={{ padding: '60px', textAlign: 'center' }}>
                        <div className="spinner" style={{ margin: '0 auto', borderTopColor: 'var(--a-primary)' }} />
                    </div>
                ) : logs.length === 0 ? (
                    <div style={{ padding: '60px', textAlign: 'center', color: 'var(--a-text-muted)' }}>
                        <FileText size={48} style={{ marginBottom: '12px', opacity: 0.3 }} />
                        <p>ยังไม่มีบันทึกการใช้งาน</p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>วันที่/เวลา</th>
                                    <th>ผู้ดำเนินการ</th>
                                    <th>การกระทำ</th>
                                    <th>ประเภท</th>
                                    <th>รายละเอียด</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map(log => {
                                    const actionInfo = ACTION_LABELS[log.action] || { label: log.action, color: '#636e72' }
                                    return (
                                        <tr key={log.id}>
                                            <td style={{ whiteSpace: 'nowrap', fontSize: '13px' }}>
                                                {formatDate(log.createdAt)}
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: 600, fontSize: '13px' }}>{log.user?.name || '-'}</div>
                                                <div style={{ fontSize: '11px', color: 'var(--a-text-muted)' }}>{log.user?.role}</div>
                                            </td>
                                            <td>
                                                <span style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                    padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                                                    background: `${actionInfo.color}15`, color: actionInfo.color,
                                                }}>
                                                    {actionInfo.label}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: '13px', color: 'var(--a-text-secondary)' }}>
                                                {log.entityType}
                                            </td>
                                            <td style={{ fontSize: '12px', color: 'var(--a-text-secondary)', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {parseDetails(log.details)}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div style={{ padding: '16px 24px', borderTop: '1px solid var(--a-border)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px' }}>
                        <button
                            disabled={page <= 1}
                            onClick={() => setPage(p => p - 1)}
                            className="btn-admin-outline"
                            style={{ padding: '6px 12px' }}
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <span style={{ fontSize: '13px', color: 'var(--a-text-secondary)' }}>
                            หน้า {page} / {totalPages}
                        </span>
                        <button
                            disabled={page >= totalPages}
                            onClick={() => setPage(p => p + 1)}
                            className="btn-admin-outline"
                            style={{ padding: '6px 12px' }}
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
