'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { ReactNode } from 'react'

// ─── Page transition wrapper (fade + slide up) ───────────────────────────────
export function PageTransition({ children, className, style }: {
    children: ReactNode
    className?: string
    style?: React.CSSProperties
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
            className={className}
            style={style}
        >
            {children}
        </motion.div>
    )
}

// ─── Fade-in only (lighter, for admin pages) ─────────────────────────────────
export function FadeIn({ children, className, style, delay = 0 }: {
    children: ReactNode
    className?: string
    style?: React.CSSProperties
    delay?: number
}) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay, ease: 'easeOut' }}
            className={className}
            style={style}
        >
            {children}
        </motion.div>
    )
}

// ─── Stagger container + items ────────────────────────────────────────────────
const staggerContainer = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: { staggerChildren: 0.06 },
    },
}

const staggerItem = {
    hidden: { opacity: 0, y: 12 },
    show: {
        opacity: 1, y: 0,
        transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] },
    },
}

export function StaggerContainer({ children, className, style }: {
    children: ReactNode
    className?: string
    style?: React.CSSProperties
}) {
    return (
        <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className={className}
            style={style}
        >
            {children}
        </motion.div>
    )
}

export function StaggerItem({ children, className, style }: {
    children: ReactNode
    className?: string
    style?: React.CSSProperties
}) {
    return (
        <motion.div variants={staggerItem} className={className} style={style}>
            {children}
        </motion.div>
    )
}

// ─── Scale-in animation (for modals, cards) ──────────────────────────────────
export function ScaleIn({ children, className, style }: {
    children: ReactNode
    className?: string
    style?: React.CSSProperties
}) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={className}
            style={style}
        >
            {children}
        </motion.div>
    )
}

// ─── Slide-in from side (for sidebars, drawers) ─────────────────────────────
export function SlideIn({ children, direction = 'left', className, style }: {
    children: ReactNode
    direction?: 'left' | 'right' | 'up' | 'down'
    className?: string
    style?: React.CSSProperties
}) {
    const axis = direction === 'left' || direction === 'right' ? 'x' : 'y'
    const offset = direction === 'left' || direction === 'up' ? -20 : 20
    return (
        <motion.div
            initial={{ opacity: 0, [axis]: offset }}
            animate={{ opacity: 1, [axis]: 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            className={className}
            style={style}
        >
            {children}
        </motion.div>
    )
}

// Re-export for convenience
export { motion, AnimatePresence }
