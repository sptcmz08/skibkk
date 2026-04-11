'use client'

import { motion, AnimatePresence } from 'framer-motion'

interface ConfirmModalProps {
    open: boolean
    onConfirm: () => void
    onCancel: () => void
    title?: string
    message: string
    confirmText?: string
    cancelText?: string
    type?: 'danger' | 'warning' | 'info'
    icon?: string
}

const themeMap = {
    danger: {
        gradient: 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)',
        icon: '⚠️',
        buttonBg: 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)',
        shadow: 'rgba(231,76,60,0.3)',
    },
    warning: {
        gradient: 'linear-gradient(135deg, #FACC15 0%, #EAB308 100%)',
        icon: '⚡',
        buttonBg: 'linear-gradient(135deg, #FACC15 0%, #EAB308 100%)',
        shadow: 'rgba(250,204,21,0.3)',
    },
    info: {
        gradient: 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)',
        icon: 'ℹ️',
        buttonBg: 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)',
        shadow: 'rgba(52,152,219,0.3)',
    },
}

export default function ConfirmModal({
    open,
    onConfirm,
    onCancel,
    title = 'ยืนยันดำเนินการ',
    message,
    confirmText = 'ยืนยัน',
    cancelText = 'ยกเลิก',
    type = 'warning',
    icon,
}: ConfirmModalProps) {
    const theme = themeMap[type]

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onCancel}
                    style={{
                        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px',
                    }}>
                    <motion.div
                        onClick={e => e.stopPropagation()}
                        initial={{ scale: 0.85, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.85, opacity: 0, y: 20 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                        style={{
                            background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '400px',
                            boxShadow: '0 25px 60px rgba(0,0,0,0.25)', overflow: 'hidden',
                        }}>
                        {/* Header */}
                        <div style={{
                            background: theme.gradient, padding: '28px 28px 22px',
                            textAlign: 'center', color: '#fff',
                        }}>
                            <div style={{ fontSize: '40px', marginBottom: '10px' }}>{icon || theme.icon}</div>
                            <div style={{ fontSize: '19px', fontWeight: 800, letterSpacing: '-0.3px' }}>{title}</div>
                        </div>

                        {/* Body */}
                        <div style={{ padding: '24px 28px 8px', textAlign: 'center' }}>
                            <div style={{ fontSize: '15px', color: 'var(--a-text)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                                {message}
                            </div>
                        </div>

                        {/* Buttons */}
                        <div style={{ padding: '16px 28px 24px', display: 'flex', gap: '12px' }}>
                            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                onClick={onCancel}
                                style={{
                                    flex: 1, padding: '13px', borderRadius: '12px', fontSize: '15px', fontWeight: 700,
                                    border: '2px solid #e0e0e0', background: '#fff', color: 'var(--a-text)', cursor: 'pointer', fontFamily: 'inherit',
                                }}>
                                {cancelText}
                            </motion.button>
                            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                onClick={onConfirm}
                                style={{
                                    flex: 1.5, padding: '13px', borderRadius: '12px', fontSize: '15px', fontWeight: 700,
                                    border: 'none', background: theme.buttonBg, color: '#fff', cursor: 'pointer',
                                    fontFamily: 'inherit', boxShadow: `0 4px 12px ${theme.shadow}`,
                                }}>
                                {confirmText}
                            </motion.button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
