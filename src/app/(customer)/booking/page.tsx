'use client'

import { formatPackageBookingWindow, formatPackageDate, resolvePackageBookingWindow } from '@/lib/package-window'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Users, UserCheck, Plus, Trash2, ArrowRight, ArrowLeft, CreditCard, QrCode, CheckCircle, Upload, Package, AlertTriangle, Timer, Copy } from 'lucide-react'
import toast from 'react-hot-toast'
import { clearStoredCart, readStoredCart, syncCartWithServerLocks } from '@/lib/cart'
import { getBankBrand } from '@/lib/bank-brand'

import type { CartItem } from '@/lib/cart'
interface Participant {
    name: string; sportType: string; age: string; shoeSize: string; weight: string; height: string; phone: string; isBooker: boolean
}

type ParticipantDraft = Partial<Participant>

type SportTypeResponseItem = {
    name: string
    icon: string
    isActive: boolean
}

const cleanProfileEmail = (email?: string | null) => {
    if (!email || email.endsWith('@line.local') || email.endsWith('@skibkk.local')) return ''
    return email
}

const cleanProfilePhone = (phone?: string | null) => {
    if (!phone || phone.startsWith('LINE-') || phone.startsWith('guest-') || phone.startsWith('temp-')) return ''
    return phone
}

const cleanParticipantDraft = (participant: Participant): Participant => ({
    ...participant,
    phone: cleanProfilePhone(participant.phone),
})

const normalizeParticipantDraft = (participant: ParticipantDraft): Participant => cleanParticipantDraft({
    name: participant.name || '',
    sportType: participant.sportType || '',
    age: participant.age || '',
    shoeSize: participant.shoeSize || '',
    weight: participant.weight || '',
    height: participant.height || '',
    phone: participant.phone || '',
    isBooker: Boolean(participant.isBooker),
})

const readResponseError = async (response: Response, fallback: string) => {
    const data = await response.json().catch(() => null)
    return typeof data?.error === 'string' && data.error.trim() ? data.error : fallback
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const PAYMENT_TOLERANCE = 0.01

const dateOnlyUTC = (value: string | Date) => new Date(value).toISOString().split('T')[0]

const formatCartDate = (dateStr: string) => {
    return new Date(`${dateStr}T12:00:00Z`).toLocaleDateString('th-TH', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    })
}

export default function BookingPage() {
    const BANGKOK_BANK_WAIT_MS = 5 * 60 * 1000
    const BANGKOK_BANK_RETRY_MS = 15000
    const router = useRouter()
    const [step, setStep] = useState(1) // 1=participants, 2=payment
    const [cart, setCart] = useState<CartItem[]>([])
    const [isBookerLearner, setIsBookerLearner] = useState(false)
    const [participants, setParticipants] = useState<Participant[]>([
        { name: '', sportType: '', age: '', shoeSize: '', weight: '', height: '', phone: '', isBooker: false },
    ])
    const [recentParticipants, setRecentParticipants] = useState<Participant[]>([])
    const [loadingRecentParticipants, setLoadingRecentParticipants] = useState(false)
    const BOOKING_DRAFT_KEY = 'skibkk-booking-draft'
    const [paymentMethod, setPaymentMethod] = useState<'PROMPTPAY' | 'BANK_TRANSFER' | 'PACKAGE'>('PROMPTPAY')
    const [loading, setLoading] = useState(false)
    const [booker, setBooker] = useState<{ name: string; phone: string; email: string }>({ name: '', phone: '', email: '' })
    const [sportTypes, setSportTypes] = useState<Array<{ name: string; icon: string }>>([])
    const [slipFile, setSlipFile] = useState<File | null>(null)
    const [slipPreview, setSlipPreview] = useState<string | null>(null)
    const [userPackages, setUserPackages] = useState<Array<{ id: string; remainingHours: number; expiresAt: string; package: { name: string; validFrom?: string | null; validTo?: string | null } }>>([])
    const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null)
    const [showTerms, setShowTerms] = useState(false)
    const [termsText, setTermsText] = useState('')
    const [termsAccepted, setTermsAccepted] = useState(false)
    const [slipVerifying, setSlipVerifying] = useState(false)
    const [slipVerifyState, setSlipVerifyState] = useState<{ phase: 'idle' | 'checking' | 'pending' | 'success' | 'error'; message: string }>({
        phase: 'idle',
        message: '',
    })
    const [verifiedSlips, setVerifiedSlips] = useState<Array<{ amount: number; transRef: string; sender: string; token: string; file?: File | null }>>([])
    const [qrImage, setQrImage] = useState<string | null>(null)
    const [qrReceiver, setQrReceiver] = useState<{ name?: string; account?: string; bankName?: string } | null>(null)
    const [paymentDisplayConfig, setPaymentDisplayConfig] = useState({ enableQrCode: false, enableBankDetails: true })

    const total = cart.reduce((s, i) => s + i.price, 0)
    const payableTotal = paymentMethod === 'PACKAGE' ? 0 : total
    const paidTotal = verifiedSlips.reduce((s, slip) => s + slip.amount, 0)
    const remaining = total - paidTotal
    const hasCompleteReceiver = Boolean(qrReceiver?.name && qrReceiver?.account && qrReceiver?.bankName)
    const hasVisibleBankDetails = paymentDisplayConfig.enableBankDetails && hasCompleteReceiver
    const showPaymentImage = paymentDisplayConfig.enableQrCode && Boolean(qrImage) && hasCompleteReceiver
    const hasTransferChannel = showPaymentImage || hasVisibleBankDetails
    const bankBrand = getBankBrand(qrReceiver?.bankName)
    const copyPaymentText = async (value: string | undefined, label: string) => {
        if (!value) return
        try {
            await navigator.clipboard.writeText(value)
            toast.success(`คัดลอก${label}แล้ว`)
        } catch {
            toast.error(`คัดลอก${label}ไม่สำเร็จ`)
        }
    }

    // Lock countdown timer for payment step
    const [lockSecondsLeft, setLockSecondsLeft] = useState<number | null>(null)
    const lockExpiredRef = useRef(false)
    const bookingCompleteRef = useRef(false)
    useEffect(() => {
        if (step !== 2) return
        lockExpiredRef.current = false
        let expiresAt: Date | null = null
        const check = async () => {
            try {
                const { getSessionId } = await import('@/lib/session')
                const sessionId = getSessionId()
                const result = await syncCartWithServerLocks(sessionId)
                setCart(result.cart)
                if (result.active && result.expiresAt) {
                    expiresAt = result.expiresAt
                } else {
                    expiresAt = null
                    setLockSecondsLeft(null)
                    if (result.changed) {
                        toast.error('รายการในตะกร้าหมดเวลา 20 นาทีแล้ว กรุณาเลือกใหม่')
                        router.push('/cart')
                    }
                }
            } catch { /* ignore */ }
        }
        check()
        const pollId = setInterval(check, 5000)
        const tickId = setInterval(async () => {
            if (expiresAt) {
                const s = Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 1000))
                setLockSecondsLeft(s)
                // Auto-clear cart when lock expires
                if (s <= 0 && !lockExpiredRef.current) {
                    lockExpiredRef.current = true
                    // Clear cart and release locks
                    clearStoredCart({ clearDraft: true })
                    try {
                        const { getSessionId } = await import('@/lib/session')
                        await fetch('/api/locks', {
                            method: 'DELETE',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ sessionId: getSessionId() }),
                        })
                    } catch { /* ignore */ }
                    toast.error('หมดเวลาแล้ว ระบบล้างตะกร้าอัตโนมัติ กรุณาเลือกใหม่', { duration: 5000 })
                    setTimeout(() => router.push('/courts'), 2000)
                }
            }
        }, 1000)
        return () => { clearInterval(pollId); clearInterval(tickId) }
    }, [step, router])

    useEffect(() => {
        if (!slipVerifying || slipVerifyState.phase !== 'pending') return

        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault()
            event.returnValue = ''
        }

        window.addEventListener('beforeunload', handleBeforeUnload)
        return () => window.removeEventListener('beforeunload', handleBeforeUnload)
    }, [slipVerifying, slipVerifyState.phase])


    // Compress image for better EasySlip verification
    const compressImage = (file: File): Promise<File> => {
        return new Promise((resolve) => {
            // EasySlip v2 accepts uploaded images up to 4MB.
            if (file.size < 3.8 * 1024 * 1024) { resolve(file); return }

            const img = new window.Image()
            const canvas = document.createElement('canvas')
            const reader = new FileReader()

            reader.onload = (e) => {
                img.onload = () => {
                    // Keep resolution relatively high for OCR/QR extraction.
                    const maxDim = 2200
                    let { width, height } = img
                    if (width > maxDim || height > maxDim) {
                        if (width > height) { height = Math.round(height * maxDim / width); width = maxDim }
                        else { width = Math.round(width * maxDim / height); height = maxDim }
                    }
                    canvas.width = width
                    canvas.height = height
                    const ctx = canvas.getContext('2d')!
                    ctx.drawImage(img, 0, 0, width, height)

                    const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
                    canvas.toBlob((blob) => {
                        if (blob) {
                            const nextName = outputType === 'image/png'
                                ? file.name.replace(/\.\w+$/, '.png')
                                : file.name.replace(/\.\w+$/, '.jpg')
                            const compressed = new File([blob], nextName, { type: outputType })
                            console.log(`Slip compressed: ${(file.size / 1024).toFixed(0)}KB → ${(compressed.size / 1024).toFixed(0)}KB`)
                            resolve(compressed.size < file.size ? compressed : file)
                        } else { resolve(file) }
                    }, outputType, outputType === 'image/png' ? undefined : 0.92)
                }
                img.src = e.target?.result as string
            }
            reader.readAsDataURL(file)
        })
    }

    // Handle slip file selection
    const handleSlipSelect = async (file: File) => {
        if (file.size > 10 * 1024 * 1024) {
            toast.error('ไฟล์ใหญ่เกินไป (สูงสุด 10MB)')
            return
        }
        const compressed = await compressImage(file)
        setSlipFile(compressed)
        setSlipVerifyState({ phase: 'idle', message: '' })
        const reader = new FileReader()
        reader.onload = (e) => setSlipPreview(e.target?.result as string)
        reader.readAsDataURL(compressed)
    }

    // Verify slip via EasySlip API (supports multiple slips — accumulates amounts)
    const handleVerifySlip = async () => {
        if (!slipFile) { toast.error('กรุณาอัปโหลดรูปสลิป'); return }
        setSlipVerifying(true)
        setSlipVerifyState({ phase: 'checking', message: 'กำลังตรวจสอบสลิป...' })
        try {
            const currentFile = slipFile
            const startedAt = Date.now()
            let attempt = 0

            while (true) {
                attempt += 1
                const verifyFormData = new FormData()
                verifyFormData.append('image', currentFile)

                const res = await fetch('/api/payments/verify-slip', {
                    method: 'POST',
                    body: verifyFormData,
                })
                const data = await res.json()

                if (!data.verified) {
                    const errMsg: string = data.error || 'สลิปไม่ถูกต้อง'
                    const isBangkokPending = data?.debug?.code === 'SLIP_PENDING'

                    if (isBangkokPending && Date.now() - startedAt < BANGKOK_BANK_WAIT_MS) {
                        setSlipVerifyState({
                            phase: 'pending',
                            message: `กำลังตรวจสอบสลิปธนาคารกรุงเทพ อาจใช้เวลา 1-5 นาที โปรดอย่าออกจากหน้านี้ (รอบที่ ${attempt})`,
                        })
                        await delay(BANGKOK_BANK_RETRY_MS)
                        continue
                    }

                    setSlipVerifyState({ phase: 'error', message: errMsg })
                    toast.error(errMsg, { duration: 6000 })
                    return
                }

                if (!data.verificationToken) {
                    const fallbackMessage = 'ระบบยืนยันสลิปไม่สมบูรณ์ กรุณาลองใหม่อีกครั้ง'
                    setSlipVerifyState({ phase: 'error', message: fallbackMessage })
                    toast.error(fallbackMessage)
                    return
                }

                // Check for duplicate transRef
                if (data.transRef && verifiedSlips.some(s => s.transRef === data.transRef)) {
                    const duplicateMessage = 'สลิปนี้ถูกตรวจสอบแล้ว กรุณาอัปโหลดสลิปใบใหม่'
                    setSlipVerifyState({ phase: 'error', message: duplicateMessage })
                    toast.error(duplicateMessage)
                    return
                }

                // Add this slip to the list
                const newSlip = {
                    amount: parseFloat(data.amount),
                    transRef: data.transRef || '',
                    sender: data.sender || '',
                    token: data.verificationToken || '',
                    file: currentFile,
                }
                const updatedSlips = [...verifiedSlips, newSlip]
                setVerifiedSlips(updatedSlips)

                const newPaidTotal = updatedSlips.reduce((s, slip) => s + slip.amount, 0)
                const newRemaining = total - newPaidTotal
                const overpaid = newPaidTotal - total

                // Clear current slip for next upload
                setSlipFile(null)
                setSlipPreview(null)
                setSlipVerifyState({
                    phase: 'success',
                    message: newRemaining <= PAYMENT_TOLERANCE
                        ? 'ตรวจสอบสลิปสำเร็จแล้ว สามารถกดยืนยันการจองได้'
                        : 'ตรวจสอบสลิปสำเร็จแล้ว สามารถแนบสลิปเพิ่มได้หากยอดยังไม่ครบ',
                })

                if (newRemaining > PAYMENT_TOLERANCE) {
                    // Still short — tell customer to transfer more
                    toast(`ตรวจสลิปสำเร็จ ✅ ยอดค้างจ่าย ฿${newPaidTotal.toLocaleString()} / ฿${total.toLocaleString()} — โอนเพิ่มอีก ฿${newRemaining.toLocaleString()}`, { icon: '💰', duration: 8000 })
                } else if (overpaid > PAYMENT_TOLERANCE) {
                    // Overpaid
                    toast.success(`ยอดครบแล้ว! ✅ (โอนเกิน ฿${overpaid.toLocaleString()} กรุณา Add Line: @skibkk เพื่อรับเงินคืน)`, { duration: 8000 })
                } else {
                    toast.success('ยอดครบแล้ว! ตรวจสอบสลิปสำเร็จ ✅')
                }
                return
            }
        } catch {
            setSlipVerifyState({ phase: 'error', message: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' })
            toast.error('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
        } finally {
            setSlipVerifying(false)
        }
    }

    // Fetch user packages + QR image when entering payment step
    useEffect(() => {
        if (step === 2) {
            fetch('/api/user-packages').then(r => r.json())
                .then(data => setUserPackages(data.packages || []))
                .catch(() => { })

            const loadQrImage = async () => {
                try {
                    const settingsRes = await fetch('/api/admin/qr-settings')
                    const settingsData = await settingsRes.json()
                    setQrReceiver(settingsData.receiver || null)
                    setPaymentDisplayConfig({
                        enableQrCode: false,
                        enableBankDetails: settingsData.displayConfig?.enableBankDetails !== false,
                    })
                } catch { /* ignore */ }

                setQrImage(null)
            }

            loadQrImage().catch(() => setQrImage(null))
        }
    }, [step, total])

    // Fetch sport types for participant dropdown
    useEffect(() => {
        fetch('/api/sport-types', { cache: 'no-store' })
            .then(r => r.json())
            .then(data => {
                if (data.sportTypes) {
                    setSportTypes((data.sportTypes as SportTypeResponseItem[]).filter(s => s.isActive).map(s => ({ name: s.name, icon: s.icon })))
                }
            })
            .catch(() => { })
    }, [])

    useEffect(() => {
        let cancelled = false

        const loadCart = async () => {
            const { getSessionId } = await import('@/lib/session')
            const result = await syncCartWithServerLocks(getSessionId())
            if (cancelled) return
            if (result.cart.length === 0) {
                if (result.changed) {
                    toast.error('รายการในตะกร้าหมดเวลา 20 นาทีแล้ว กรุณาเลือกใหม่')
                }
                router.push('/courts')
                return
            }
            setCart(result.cart)
        }

        loadCart().catch(() => {
            const stored = readStoredCart()
            if (cancelled) return
            if (stored.length === 0) {
                router.push('/courts')
                return
            }
            setCart(stored)
        })

        const handleCartUpdate = () => {
            if (bookingCompleteRef.current) return
            const updatedCart = readStoredCart()
            if (cancelled) return
            if (updatedCart.length === 0) {
                router.push('/courts')
                return
            }
            setCart(updatedCart)
        }
        window.addEventListener('cart-updated', handleCartUpdate)

        // Fetch booking terms from settings
        fetch('/api/settings', { cache: 'no-store' }).then(r => r.json())
            .then(data => {
                if (data.booking_terms) {
                    setTermsText(data.booking_terms)
                    setShowTerms(true)
                }
                if (data.max_participants) setMaxParticipants(parseInt(data.max_participants) || 2)
            }).catch(() => { })

        // Check auth — if not logged in, redirect back to cart (which will show auth modal)
        fetch('/api/auth/me', { cache: 'no-store' })
            .then(r => r.json())
            .then(d => {
                if (d.user) {
                    const cleanPhone = cleanProfilePhone(d.user.phone)
                    setBooker({
                        name: d.user.name || '',
                        phone: cleanPhone,
                        email: cleanProfileEmail(d.user.email),
                    })
                    // Auto-fill first participant with user profile data
                    setParticipants(prev => {
                        const updated = [...prev]
                        if (updated.length > 0 && !updated[0].name) {
                            updated[0] = {
                                ...updated[0],
                                name: d.user.name || '',
                                phone: cleanPhone,
                            }
                        }
                        return updated
                    })
                    setLoadingRecentParticipants(true)
                    fetch('/api/participants/recent', { cache: 'no-store' })
                        .then(r => r.ok ? r.json() : null)
                        .then(data => {
                            const savedParticipants = Array.isArray(data?.participants) ? data.participants : []
                            setRecentParticipants(savedParticipants.map(normalizeParticipantDraft))
                        })
                        .catch(() => setRecentParticipants([]))
                        .finally(() => setLoadingRecentParticipants(false))
                } else {
                    toast.error('กรุณาเข้าสู่ระบบก่อนดำเนินการจอง')
                    router.push('/cart')
                }
            })
            .catch(() => {
                toast.error('กรุณาเข้าสู่ระบบก่อนดำเนินการจอง')
                router.push('/cart')
            })

        // Restore draft from localStorage (don't restore step — always start at step 1)
        try {
            const draft = JSON.parse(localStorage.getItem(BOOKING_DRAFT_KEY) || 'null')
            if (draft) {
                if (draft.participants?.length) setParticipants(draft.participants.map(cleanParticipantDraft))
                if (draft.isBookerLearner !== undefined) setIsBookerLearner(draft.isBookerLearner)
            }
        } catch { /* ignore */ }

        return () => {
            cancelled = true
            window.removeEventListener('cart-updated', handleCartUpdate)
        }
    }, [router])

    // Auto-save draft to localStorage on every change
    useEffect(() => {
        if (!cart.length) return
        localStorage.setItem(BOOKING_DRAFT_KEY, JSON.stringify({
            participants, isBookerLearner, step,
        }))
    }, [participants, isBookerLearner, step, cart.length])

    // Max participants: configurable from admin settings (default 2)
    const [maxParticipants, setMaxParticipants] = useState(2)

    const addParticipant = () => {
        if (participants.length >= maxParticipants) {
            toast.error(`จำนวนผู้เรียนเต็มแล้ว (สูงสุด ${maxParticipants} คน)`)
            return
        }
        setParticipants([...participants, { name: '', sportType: participants[0]?.sportType || '', age: '', shoeSize: '', weight: '', height: '', phone: '', isBooker: false }])
    }

    const removeParticipant = (idx: number) => {
        setParticipants(participants.filter((_, i) => i !== idx))
    }

    const updateParticipant = (idx: number, field: keyof Participant, value: string) => {
        const updated = [...participants]
        updated[idx] = { ...updated[idx], [field]: value }
        // When first participant changes sport type, force all others to match
        if (field === 'sportType' && idx === 0) {
            for (let i = 1; i < updated.length; i++) {
                updated[i] = { ...updated[i], sportType: value }
            }
            if (updated.length > 1) {
                toast('ผู้เรียนทุกคนต้องเล่นประเภทเดียวกัน', { icon: '⚠️' })
            }
        }
        // If not first participant, force same sport as first
        if (field === 'sportType' && idx > 0 && updated[0].sportType && value !== updated[0].sportType) {
            updated[idx] = { ...updated[idx], sportType: updated[0].sportType }
            toast.error('ผู้เรียนทุกคนต้องเลือกประเภทกีฬาเดียวกับคนแรก')
        }
        setParticipants(updated)
    }

    const applyRecentParticipant = (idx: number, recentParticipant: Participant) => {
        setParticipants(prev => {
            const updated = [...prev]
            const current = updated[idx]
            if (!current) return prev

            const sportType = idx > 0 && updated[0]?.sportType
                ? updated[0].sportType
                : recentParticipant.sportType || current.sportType

            updated[idx] = {
                ...current,
                ...recentParticipant,
                sportType,
                isBooker: current.isBooker,
            }

            if (idx === 0 && sportType) {
                for (let i = 1; i < updated.length; i++) {
                    updated[i] = { ...updated[i], sportType }
                }
            }

            return updated
        })
        toast.success('ดึงข้อมูลผู้เรียนแล้ว')
    }

    const handleBookerToggle = (checked: boolean) => {
        setIsBookerLearner(checked)
        if (checked) {
            // Auto-fill first participant with booker info
            const updated = [...participants]
            if (updated.length === 0) {
                updated.push({ name: booker.name, sportType: '', age: '', shoeSize: '', weight: '', height: '', phone: booker.phone || '', isBooker: true })
            } else {
                updated[0] = { ...updated[0], name: booker.name, phone: booker.phone || '', isBooker: true }
            }
            setParticipants(updated)
        }
    }

    const syncBookerToFirstParticipant = (nextBooker: { name: string; phone: string; email: string }) => {
        if (!isBookerLearner) return
        setParticipants(prev => {
            const updated = [...prev]
            if (updated.length === 0) {
                updated.push({ name: nextBooker.name, sportType: '', age: '', shoeSize: '', weight: '', height: '', phone: nextBooker.phone || '', isBooker: true })
            } else {
                updated[0] = { ...updated[0], name: nextBooker.name, phone: nextBooker.phone || '', isBooker: true }
            }
            return updated
        })
    }



    const canSubmit = paymentMethod === 'PACKAGE'
        || (hasTransferChannel && remaining <= PAYMENT_TOLERANCE && verifiedSlips.length > 0)

    const handleSubmitBooking = async (options?: {
        verifiedSlipsOverride?: Array<{ amount: number; transRef: string; sender: string; token: string; file?: File | null }>
    }) => {
        const effectiveVerifiedSlips = options?.verifiedSlipsOverride ?? verifiedSlips
        const effectivePaidTotal = effectiveVerifiedSlips.reduce((sum, slip) => sum + slip.amount, 0)
        const effectiveRemaining = total - effectivePaidTotal

        if (!booker.name.trim() || !booker.email.trim() || !booker.phone.trim()) {
            toast.error('กรุณากรอกข้อมูลผู้จองให้ครบ')
            return
        }
        if (participants.some(p => !p.name || !p.sportType)) {
            toast.error('กรุณากรอกชื่อและประเภทกีฬาของผู้เรียนทุกคน')
            return
        }
        if (paymentMethod === 'PROMPTPAY' && !hasTransferChannel) {
            toast.error('ช่องทางชำระเงินผ่านการโอนถูกปิดชั่วคราว กรุณาติดต่อแอดมิน')
            return
        }
        // Require slip verification for PromptPay
        if (paymentMethod === 'PROMPTPAY' && effectiveVerifiedSlips.length === 0) {
            toast.error('กรุณาอัปโหลดและตรวจสอบสลิปก่อนยืนยันการจอง')
            return
        }
        if (paymentMethod === 'PROMPTPAY' && effectiveRemaining > PAYMENT_TOLERANCE) {
            toast.error('ยอดโอนยังไม่ครบ กรุณาโอนเพิ่มและแนบสลิป')
            return
        }
        if (paymentMethod === 'PACKAGE') {
            if (!selectedPackageId) {
                toast.error('กรุณาเลือกแพ็คเกจก่อนยืนยันการจอง')
                return
            }

            const selectedPackage = userPackages.find(pkg => pkg.id === selectedPackageId)
            if (!selectedPackage) {
                toast.error('ไม่พบแพ็คเกจที่เลือก กรุณาเลือกแพ็คเกจใหม่')
                return
            }

            if (selectedPackage.remainingHours < cart.length) {
                toast.error(`ชั่วโมงในแพ็คเกจไม่เพียงพอ เหลือ ${selectedPackage.remainingHours} ชม. แต่เลือก ${cart.length} ชม.`)
                return
            }

            const bookingWindow = resolvePackageBookingWindow(
                selectedPackage.package.validFrom,
                selectedPackage.package.validTo,
                null,
                selectedPackage.expiresAt
            )
            const packageStart = bookingWindow.start ? dateOnlyUTC(bookingWindow.start) : null
            const packageEnd = bookingWindow.end ? dateOnlyUTC(bookingWindow.end) : null
            const outOfRangeItem = cart.find(item => {
                const itemDate = item.date.split('T')[0]
                return (packageStart && itemDate < packageStart) || (packageEnd && itemDate > packageEnd)
            })

            if (outOfRangeItem) {
                const windowText = [
                    packageStart ? formatCartDate(packageStart) : null,
                    packageEnd ? formatCartDate(packageEnd) : null,
                ].filter(Boolean).join(' - ')
                toast.error(`จองไม่ได้: วันที่ ${formatCartDate(outOfRangeItem.date.split('T')[0])} อยู่นอกช่วงใช้แพ็คเกจ${windowText ? ` (${windowText})` : ''}`, { duration: 6000 })
                return
            }
        }
        setLoading(true)
        let createdBookingId: string | null = null
        try {
            const profileRes = await fetch('/api/auth/me', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(booker),
            })
            if (!profileRes.ok) {
                const profileData = await profileRes.json().catch(() => ({}))
                toast.error(profileData.error || 'บันทึกข้อมูลผู้จองไม่สำเร็จ')
                return
            }

            // Step 1: Create booking
            const res = await fetch('/api/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: cart.map(item => ({
                        courtId: item.courtId,
                        courtName: item.courtName,
                        date: item.date,
                        startTime: item.startTime,
                        endTime: item.endTime,
                        price: item.price,
                    })),
                    totalAmount: total,
                    isBookerLearner,
                    participants: participants.map(p => ({
                        name: p.name,
                        sportType: p.sportType,
                        age: p.age ? parseInt(p.age) : null,
                        shoeSize: p.shoeSize || null,
                        weight: p.weight ? parseFloat(p.weight) : null,
                        height: p.height ? parseFloat(p.height) : null,
                        phone: p.phone || null,
                        isBooker: p.isBooker,
                    })),
                }),
            })
            const data = await res.json().catch(() => null)
            if (!res.ok) {
                toast.error(typeof data?.error === 'string' ? data.error : 'ไม่สามารถจองได้')
                return
            }
            if (!data?.booking?.id) {
                throw new Error('ไม่พบข้อมูลการจองที่สร้าง กรุณาลองใหม่อีกครั้ง')
            }
            createdBookingId = data.booking.id

            // Step 2: Handle payment
            if (paymentMethod === 'PACKAGE' && selectedPackageId) {
                const hoursToDeduct = cart.length
                const pkgRes = await fetch('/api/user-packages', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userPackageId: selectedPackageId, hoursToDeduct, bookingId: data.booking.id }),
                })
                if (!pkgRes.ok) {
                    throw new Error(await readResponseError(pkgRes, 'ใช้แพ็คเกจไม่สำเร็จ'))
                }
            } else {
                // Create payment only after slip verification succeeds.
                const paymentMethodForRecord = paymentMethod === 'PROMPTPAY' ? 'BANK_TRANSFER' : paymentMethod
                let slipUrl: string | undefined

                const fileForUpload = effectiveVerifiedSlips.length === 1 ? effectiveVerifiedSlips[0]?.file || null : null

                if (fileForUpload) {
                    const formData = new FormData()
                    formData.append('file', fileForUpload)

                    const uploadRes = await fetch('/api/upload', {
                        method: 'POST',
                        body: formData,
                    })

                    if (!uploadRes.ok) {
                        throw new Error(await readResponseError(uploadRes, 'อัปโหลดรูปสลิปไม่สำเร็จ'))
                    }

                    const uploadData = await uploadRes.json().catch(() => null)
                    if (typeof uploadData?.url === 'string' && uploadData.url.trim()) {
                        slipUrl = uploadData.url
                    }
                }

                const paymentRes = await fetch('/api/payments', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        bookingId: data.booking.id,
                        method: paymentMethodForRecord,
                        amount: total,
                        slipTokens: effectiveVerifiedSlips.map(s => s.token).filter(Boolean),
                        slipUrl,
                    }),
                })
                if (!paymentRes.ok) {
                    throw new Error(await readResponseError(paymentRes, 'สร้างข้อมูลการชำระเงินไม่สำเร็จ'))
                }
            }

            // Step 3: Success — release locks, clear cart
            const sessionId = (await import('@/lib/session')).getSessionId()
            await fetch('/api/locks', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId }),
            }).catch(() => { })

            bookingCompleteRef.current = true
            clearStoredCart({ clearDraft: true })
            toast.success('จองสำเร็จ!')
            router.push('/profile')
        } catch (err) {
            // Transaction safety: rollback booking if payment failed
            if (createdBookingId) {
                await fetch(`/api/bookings/${createdBookingId}`, { method: 'DELETE' }).catch(() => { })
            }
            const message = err instanceof Error && err.message ? err.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง'
            toast.error(message, { duration: 6000 })
        } finally {
            setLoading(false)
        }
    }

    if (cart.length === 0 && !bookingCompleteRef.current) return null

    return (
        <div style={{ maxWidth: '700px', margin: '0 auto', padding: '32px 24px' }}>
            {/* Back button */}
            {step < 3 && (
                <button
                    onClick={() => step === 1 ? router.back() : setStep(1)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        background: 'none', border: 'none', cursor: 'pointer', padding: '0',
                        color: 'var(--c-text-secondary)', fontSize: '14px', fontWeight: 600, marginBottom: '20px',
                    }}>
                    <ArrowLeft size={16} /> ย้อนกลับ
                </button>
            )}
            {/* Steps indicator */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '40px' }}>
                {['ข้อมูลผู้เรียน', 'ชำระเงิน', 'สำเร็จ'].map((label, i) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                            width: '32px', height: '32px', borderRadius: '50%',
                            background: step > i + 1 ? 'var(--c-gradient-success)' : step === i + 1 ? 'var(--c-gradient)' : 'var(--c-glass)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '13px', fontWeight: 700,
                            color: step >= i + 1 ? 'white' : 'var(--c-text-muted)',
                            border: step < i + 1 ? '2px solid var(--c-glass-border)' : 'none',
                        }}>
                            {step > i + 1 ? <CheckCircle size={16} /> : i + 1}
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: step === i + 1 ? 'var(--c-text)' : 'var(--c-text-muted)' }}>{label}</span>
                        {i < 2 && <div style={{ width: '40px', height: '2px', background: step > i + 1 ? 'var(--c-success)' : 'var(--c-glass-border)' }} />}
                    </div>
                ))}
            </div>

            {/* Step 1: Participants */}
            {step === 1 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                    <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Users size={24} style={{ color: 'var(--c-primary)' }} />
                        ข้อมูลผู้เรียน
                    </h2>
                    <p style={{ color: 'var(--c-text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
                        1 ชั่วโมง สามารถเพิ่มผู้เรียนได้ 2 คน (รวม {maxParticipants} คน)
                    </p>

                    <div className="glass-card" style={{ cursor: 'default', marginBottom: '20px' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '14px' }}>ข้อมูลผู้จอง</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div className="input-group" style={{ gridColumn: 'span 2' }}>
                                <label>ชื่อผู้จอง *</label>
                                <input
                                    className="input-field"
                                    placeholder="ชื่อ-สกุล"
                                    value={booker.name}
                                    onChange={e => {
                                        const nextBooker = { ...booker, name: e.target.value }
                                        setBooker(nextBooker)
                                        syncBookerToFirstParticipant(nextBooker)
                                    }}
                                />
                            </div>
                            <div className="input-group">
                                <label>อีเมลผู้จอง *</label>
                                <input
                                    className="input-field"
                                    type="email"
                                    placeholder="name@email.com"
                                    value={booker.email}
                                    onChange={e => setBooker(prev => ({ ...prev, email: e.target.value }))}
                                />
                            </div>
                            <div className="input-group">
                                <label>เบอร์โทรผู้จอง *</label>
                                <input
                                    className="input-field"
                                    type="tel"
                                    placeholder="08x-xxx-xxxx"
                                    value={booker.phone}
                                    onChange={e => {
                                        const nextBooker = { ...booker, phone: e.target.value }
                                        setBooker(nextBooker)
                                        syncBookerToFirstParticipant(nextBooker)
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Booker is learner toggle */}
                    <div className="glass-card" style={{ cursor: 'default', marginBottom: '20px', padding: '16px 20px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={isBookerLearner}
                                onChange={(e) => handleBookerToggle(e.target.checked)}
                                style={{ width: '20px', height: '20px', accentColor: 'var(--c-primary)' }}
                            />
                            <div>
                                <UserCheck size={18} style={{ display: 'inline', marginRight: '8px', color: 'var(--c-primary)' }} />
                                <span style={{ fontWeight: 600 }}>ผู้จองคือผู้เรียน</span>
                                <p style={{ fontSize: '12px', color: 'var(--c-text-muted)', marginTop: '2px' }}>
                                    จะนับเป็น 1 ใน {maxParticipants} คน
                                </p>
                            </div>
                        </label>
                    </div>

                    {/* Participant forms */}
                    {participants.map((p, idx) => (
                        <motion.div key={idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}
                            className="glass-card" style={{ cursor: 'default', marginBottom: '16px' }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                                <h3 style={{ fontSize: '16px', fontWeight: 700 }}>
                                    ผู้เรียนคนที่ {idx + 1} {isBookerLearner && idx === 0 && <span style={{ color: 'var(--c-primary)', fontSize: '13px' }}>(ผู้จอง)</span>}
                                </h3>
                                {!p.isBooker && participants.length > 1 && (
                                    <button onClick={() => removeParticipant(idx)} style={{ background: 'none', border: 'none', color: 'var(--c-danger)', cursor: 'pointer', padding: '4px' }}>
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                            {(loadingRecentParticipants || recentParticipants.length > 0) && (
                                <div className="input-group" style={{ marginBottom: '12px' }}>
                                    <label>ดึงข้อมูลผู้เรียนที่เคยกรอก</label>
                                    <select
                                        className="input-field"
                                        value=""
                                        disabled={loadingRecentParticipants || recentParticipants.length === 0}
                                        onChange={e => {
                                            const selected = recentParticipants[Number(e.target.value)]
                                            if (selected) applyRecentParticipant(idx, selected)
                                        }}
                                    >
                                        <option value="">
                                            {loadingRecentParticipants ? 'กำลังโหลดข้อมูลเดิม...' : 'เลือกข้อมูลเดิมมาเติม'}
                                        </option>
                                        {recentParticipants.map((recentParticipant, recentIdx) => (
                                            <option key={`${recentParticipant.name}-${recentParticipant.phone}-${recentIdx}`} value={recentIdx}>
                                                {recentParticipant.name}
                                                {recentParticipant.sportType ? ` - ${recentParticipant.sportType}` : ''}
                                                {recentParticipant.phone ? ` (${recentParticipant.phone})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div className="input-group" style={{ gridColumn: 'span 2' }}>
                                    <label>ชื่อผู้เรียน *</label>
                                    <input className="input-field" placeholder="ชื่อ-สกุล" value={p.name} onChange={e => updateParticipant(idx, 'name', e.target.value)} required />
                                </div>
                                <div className="input-group">
                                    <label>ประเภทกีฬา *</label>
                                    <select className="input-field" value={p.sportType} onChange={e => updateParticipant(idx, 'sportType', e.target.value)} required disabled={idx > 0 && !!participants[0]?.sportType}>
                                        <option value="">เลือก</option>
                                        {sportTypes.map(st => (
                                            <option key={st.name} value={st.name}>{st.icon} {st.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="input-group">
                                    <label>อายุ</label>
                                    <input className="input-field" type="number" placeholder="ปี" value={p.age} onChange={e => updateParticipant(idx, 'age', e.target.value)} />
                                </div>
                                <div className="input-group">
                                    <label>ไซส์รองเท้า</label>
                                    <input className="input-field" placeholder="EU SIZE" value={p.shoeSize} onChange={e => updateParticipant(idx, 'shoeSize', e.target.value)} />
                                </div>
                                <div className="input-group">
                                    <label>น้ำหนัก (kg)</label>
                                    <input className="input-field" type="number" placeholder="kg" value={p.weight} onChange={e => updateParticipant(idx, 'weight', e.target.value)} />
                                </div>
                                <div className="input-group">
                                    <label>ส่วนสูง (cm)</label>
                                    <input className="input-field" type="number" placeholder="cm" value={p.height} onChange={e => updateParticipant(idx, 'height', e.target.value)} />
                                </div>
                                <div className="input-group">
                                    <label>เบอร์โทรศัพท์</label>
                                    <input className="input-field" type="tel" placeholder="08x-xxx-xxxx" value={p.phone} onChange={e => updateParticipant(idx, 'phone', e.target.value)} />
                                </div>
                            </div>
                        </motion.div>
                    ))}

                    {participants.length < maxParticipants && (
                        <button onClick={addParticipant} className="btn btn-secondary btn-block" style={{ marginBottom: '20px' }}>
                            <Plus size={18} /> เพิ่มผู้เรียน
                        </button>
                    )}

                    <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                        <button onClick={() => router.push('/cart')} className="btn btn-secondary" style={{ flex: 1 }}>
                            <ArrowLeft size={18} /> กลับ
                        </button>
                        <button onClick={() => {
                            if (showTerms && !termsAccepted) {
                                toast.error('กรุณายอมรับข้อกำหนดและเงื่อนไขก่อนดำเนินการต่อ')
                                return
                            }
                            // Validate required fields before proceeding
                            const missingName = participants.some(p => !p.name.trim())
                            const missingSport = participants.some(p => !p.sportType)
                            if (missingName) {
                                toast.error('กรุณากรอกชื่อผู้เรียนให้ครบทุกคน')
                                return
                            }
                            if (missingSport) {
                                toast.error('กรุณาเลือกประเภทกีฬาให้ครบทุกคน')
                                return
                            }
                            setStep(2)
                        }} className="btn btn-primary" style={{ flex: 2 }}>
                            ถัดไป: ชำระเงิน <ArrowRight size={18} />
                        </button>
                    </div>
                </motion.div>
            )}

            {/* Step 2: Payment */}
            {step === 2 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                    <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <CreditCard size={24} style={{ color: 'var(--c-primary)' }} />
                        ชำระเงิน
                    </h2>

                    {/* Payment countdown timer */}
                    {lockSecondsLeft !== null && lockSecondsLeft > 0 && (
                        <div style={{
                            marginBottom: '20px', padding: '14px 18px', borderRadius: '14px',
                            background: lockSecondsLeft < 120 ? 'rgba(239,68,68,0.12)' : 'rgba(250,204,21,0.12)',
                            border: `1px solid ${lockSecondsLeft < 120 ? 'rgba(239,68,68,0.35)' : 'rgba(250,204,21,0.35)'}`,
                            display: 'flex', alignItems: 'center', gap: '12px',
                            animation: lockSecondsLeft < 120 ? 'timerPulse 1s infinite' : 'none',
                        }}>
                            <Timer size={20} style={{ color: lockSecondsLeft < 120 ? '#ef4444' : '#EAB308', flexShrink: 0 }} />
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 700, fontSize: '14px', color: lockSecondsLeft < 120 ? '#ef4444' : '#EAB308' }}>
                                    กรุณาชำระเงินภายในเวลาที่กำหนด
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--c-text-secondary)', marginTop: '2px' }}>
                                    หากเกินเวลา ระบบจะล้างตะกร้าอัตโนมัติ
                                </div>
                            </div>
                            <div style={{
                                fontFamily: "'Inter', monospace", fontSize: '22px', fontWeight: 900,
                                color: lockSecondsLeft < 120 ? '#ef4444' : '#EAB308',
                                letterSpacing: '1px', minWidth: '60px', textAlign: 'center',
                            }}>
                                {`${String(Math.floor(lockSecondsLeft / 60)).padStart(2, '0')}:${String(lockSecondsLeft % 60).padStart(2, '0')}`}
                            </div>
                        </div>
                    )}
                    {lockSecondsLeft !== null && lockSecondsLeft <= 0 && (
                        <div style={{
                            marginBottom: '20px', padding: '14px 18px', borderRadius: '14px',
                            background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
                            display: 'flex', alignItems: 'center', gap: '10px',
                        }}>
                            <AlertTriangle size={20} style={{ color: '#ef4444' }} />
                            <span style={{ fontWeight: 700, color: '#ef4444', fontSize: '14px' }}>
                                หมดเวลาแล้ว — กรุณากลับไปเลือกสนามใหม่
                            </span>
                        </div>
                    )}
                    <style>{`@keyframes timerPulse { 0%,100%{opacity:1} 50%{opacity:0.55} }`}</style>

                    {/* Order summary */}
                    <div className="glass-card" style={{ cursor: 'default', marginBottom: '24px', padding: '20px' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>สรุปการจอง</h3>
                        {[...cart].sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)).map((item, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '14px 16px', borderRadius: '16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', fontSize: '14px', marginBottom: i < cart.length - 1 ? '10px' : '0' }}>
                                <span style={{ flex: 1, minWidth: 0, color: 'var(--c-text-secondary)', lineHeight: 1.6 }}>{item.courtName} • {new Date(item.date).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })} {item.startTime}-{item.endTime}</span>
                                <span style={{ flexShrink: 0, padding: '8px 12px', borderRadius: '999px', background: 'rgba(250,204,21,0.12)', color: '#B38600', fontSize: '14px', fontWeight: 800 }}>฿{item.price.toLocaleString()}</span>
                            </div>
                        ))}
                        <div style={{ marginTop: '16px', padding: '16px 18px', borderRadius: '18px', background: 'linear-gradient(135deg, rgba(250,204,21,0.16), rgba(255,255,255,0.04))', border: '1px solid rgba(250,204,21,0.24)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '18px', fontWeight: 800 }}>ยอดรวม</span>
                            <span style={{ fontSize: '30px', fontWeight: 900, fontFamily: "'Inter'", color: '#B38600', letterSpacing: '-0.02em' }}>฿{payableTotal.toLocaleString()}</span>
                        </div>
                    </div>

                    {/* Package option (only if user has packages) */}
                    {userPackages.length > 0 && (
                        <div className="glass-card" style={{ cursor: 'default', marginBottom: '24px', padding: '20px' }}>
                            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Package size={18} /> เลือกวิธีชำระเงิน
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <button
                                    onClick={() => { setPaymentMethod('PROMPTPAY'); setSelectedPackageId(null); setVerifiedSlips([]) }}
                                    style={{
                                        padding: '12px 16px', borderRadius: '10px', cursor: 'pointer', textAlign: 'left',
                                        border: paymentMethod !== 'PACKAGE' ? '2px solid var(--c-primary)' : '1px solid var(--c-glass-border)',
                                        background: paymentMethod !== 'PACKAGE' ? 'rgba(250,204,21,0.1)' : 'transparent',
                                        color: 'var(--c-text)', fontFamily: 'inherit',
                                    }}
                                >
                                    <div style={{ fontWeight: 700 }}>ชำระเงินปกติ ฿{total.toLocaleString()}</div>
                                </button>
                                {userPackages.map(pkg => {
                                    const bookingWindow = formatPackageBookingWindow(pkg.package.validFrom, pkg.package.validTo)
                                    return (
                                        <button
                                            key={pkg.id}
                                            onClick={() => { setPaymentMethod('PACKAGE'); setSelectedPackageId(pkg.id) }}
                                            style={{
                                                padding: '12px 16px', borderRadius: '10px', cursor: 'pointer', textAlign: 'left',
                                                border: selectedPackageId === pkg.id ? '2px solid var(--c-primary)' : '1px solid var(--c-glass-border)',
                                                background: selectedPackageId === pkg.id ? 'rgba(250,204,21,0.15)' : 'transparent',
                                                color: 'var(--c-text)', fontFamily: 'inherit',
                                            }}
                                        >
                                            <div style={{ fontWeight: 700 }}>{pkg.package.name}</div>
                                            <div style={{ fontSize: '12px', color: 'var(--c-text-muted)', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                {bookingWindow && (
                                                    <div style={{
                                                        padding: '7px 9px',
                                                        borderRadius: '8px',
                                                        background: 'rgba(255,255,255,0.05)',
                                                        border: '1px solid rgba(255,255,255,0.06)',
                                                        lineHeight: 1.35,
                                                    }}>
                                                        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--c-text-secondary)', marginBottom: '2px' }}>
                                                            จองสนามได้วันที่
                                                        </div>
                                                        <div>{bookingWindow}</div>
                                                    </div>
                                                )}
                                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                    <span style={{
                                                        padding: '5px 8px',
                                                        borderRadius: '999px',
                                                        background: 'rgba(255,255,255,0.05)',
                                                        border: '1px solid rgba(255,255,255,0.06)',
                                                        lineHeight: 1.2,
                                                    }}>
                                                        เหลือ {pkg.remainingHours} ชม.
                                                    </span>
                                                    <span style={{
                                                        padding: '5px 8px',
                                                        borderRadius: '999px',
                                                        background: 'rgba(255,255,255,0.05)',
                                                        border: '1px solid rgba(255,255,255,0.06)',
                                                        lineHeight: 1.2,
                                                    }}>
                                                        หมดอายุ {formatPackageDate(pkg.expiresAt)}
                                                    </span>
                                                </div>
                                            </div>
                                            {pkg.remainingHours < cart.length && (
                                                <div style={{ fontSize: '12px', color: '#e17055', marginTop: '4px' }}>⚠️ ชั่วโมงไม่เพียงพอ</div>
                                            )}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* PromptPay QR + Slip Upload Section */}
                    {paymentMethod === 'PROMPTPAY' && (
                        <div className="glass-card" style={{ cursor: 'default', marginBottom: '24px', padding: '20px' }}>
                            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <QrCode size={18} /> ชำระเงินผ่านเลขบัญชี
                            </h3>

                            {/* QR Code display */}
                            {!hasTransferChannel ? (
                                <div style={{
                                    marginBottom: '20px',
                                    padding: '16px',
                                    borderRadius: '14px',
                                    border: '1px solid rgba(225,112,85,0.35)',
                                    background: 'rgba(225,112,85,0.08)',
                                    color: '#ffd6cc',
                                    textAlign: 'center',
                                }}>
                                    ช่องทางชำระเงินผ่านการโอนถูกปิดชั่วคราว กรุณาติดต่อแอดมิน
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'center', gap: '16px', marginBottom: '20px' }}>
                                    {paymentDisplayConfig.enableQrCode && qrImage && (
                                        <div style={{ background: 'white', borderRadius: '20px', padding: '14px', width: '100%', maxWidth: '300px', boxShadow: '0 20px 40px rgba(15,23,42,0.12)' }}>
                                            <Image
                                                src={qrImage}
                                                alt="QR Payment - SKI BKK"
                                                width={260}
                                                height={260}
                                                unoptimized
                                                style={{ width: '100%', height: 'auto', borderRadius: '12px', display: 'block' }}
                                            />
                                        </div>
                                    )}
                                    {hasVisibleBankDetails && (
                                        <div style={{
                                            flex: '1 1 360px',
                                            minWidth: 0,
                                            maxWidth: showPaymentImage ? '420px' : '100%',
                                            textAlign: 'left',
                                            padding: '18px',
                                            borderRadius: '22px',
                                            background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(255,248,220,0.88))',
                                            border: '1px solid rgba(250,204,21,0.22)',
                                            boxShadow: '0 18px 34px rgba(15,23,42,0.06)',
                                            color: 'var(--c-text-primary)',
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                                                <div style={{
                                                    width: '50px',
                                                    height: '50px',
                                                    borderRadius: '15px',
                                                    background: bankBrand.bg,
                                                    border: `1px solid ${bankBrand.ring}`,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    flexShrink: 0,
                                                    color: '#fff',
                                                    fontSize: '13px',
                                                    fontWeight: 800,
                                                    overflow: 'hidden',
                                                }}>
                                                    {bankBrand.logoSrc ? (
                                                        <Image
                                                            src={bankBrand.logoSrc}
                                                            alt={bankBrand.logoAlt}
                                                            width={36}
                                                            height={36}
                                                            style={{ width: '36px', height: '36px', objectFit: 'contain' }}
                                                        />
                                                    ) : (
                                                        bankBrand.short
                                                    )}
                                                </div>
                                                <div style={{ minWidth: 0 }}>
                                                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--c-text-muted)', marginBottom: '3px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                                                        บัญชีสำหรับโอนเงิน
                                                    </div>
                                                    <div style={{ fontSize: '20px', lineHeight: 1.25, color: 'var(--c-text-primary)', fontWeight: 800 }}>
                                                        {qrReceiver?.bankName || 'บัญชีธนาคาร'}
                                                    </div>
                                                    <div style={{ fontSize: '13px', color: 'var(--c-text-muted)', marginTop: '2px' }}>
                                                        ใช้โอนผ่านแอปธนาคารหรือ ATM ได้
                                                    </div>
                                                </div>
                                            </div>

                                            {qrReceiver?.account && (
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    gap: '12px',
                                                    padding: '14px 16px',
                                                    borderRadius: '16px',
                                                    background: '#ffffff',
                                                    border: '1px solid rgba(250,204,21,0.18)',
                                                    boxShadow: '0 10px 18px rgba(15,23,42,0.04)',
                                                    marginBottom: '12px',
                                                }}>
                                                    <div style={{ minWidth: 0 }}>
                                                        <div style={{ fontSize: '12px', color: 'var(--c-text-muted)', marginBottom: '4px' }}>เลขบัญชี</div>
                                                        <div style={{ fontSize: '22px', lineHeight: 1.15, color: 'var(--c-text-primary)', fontWeight: 900, letterSpacing: '0.03em', wordBreak: 'break-word' }}>
                                                            {qrReceiver.account}
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => copyPaymentText(qrReceiver?.account, 'เลขบัญชี')}
                                                        style={{
                                                            width: '42px',
                                                            height: '42px',
                                                            borderRadius: '12px',
                                                            border: '1px solid rgba(250,204,21,0.24)',
                                                            background: 'linear-gradient(135deg, rgba(250,204,21,0.16), rgba(255,255,255,0.92))',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            cursor: 'pointer',
                                                            flexShrink: 0,
                                                        }}
                                                    >
                                                        <Copy size={18} color="#B38600" />
                                                    </button>
                                                </div>
                                            )}

                                            {qrReceiver?.name && (
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    gap: '12px',
                                                    padding: '14px 16px',
                                                    borderRadius: '16px',
                                                    background: '#ffffff',
                                                    border: '1px solid rgba(250,204,21,0.18)',
                                                    boxShadow: '0 10px 18px rgba(15,23,42,0.04)',
                                                    marginBottom: qrReceiver?.bankName ? '12px' : '0',
                                                }}>
                                                    <div style={{ minWidth: 0 }}>
                                                        <div style={{ fontSize: '12px', color: 'var(--c-text-muted)', marginBottom: '4px' }}>ชื่อบัญชี</div>
                                                        <div style={{ fontSize: '18px', lineHeight: 1.3, color: 'var(--c-text-primary)', fontWeight: 800 }}>
                                                            {qrReceiver.name}
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => copyPaymentText(qrReceiver?.name, 'ชื่อบัญชี')}
                                                        style={{
                                                            width: '38px',
                                                            height: '38px',
                                                            borderRadius: '11px',
                                                            border: '1px solid rgba(250,204,21,0.22)',
                                                            background: 'linear-gradient(135deg, rgba(250,204,21,0.14), rgba(255,255,255,0.92))',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            cursor: 'pointer',
                                                            flexShrink: 0,
                                                        }}
                                                    >
                                                        <Copy size={16} color="#B38600" />
                                                    </button>
                                                </div>
                                            )}

                                            {qrReceiver?.bankName && (
                                                <div style={{ fontSize: '12px', color: 'var(--c-text-muted)', paddingLeft: '2px' }}>
                                                    ธนาคาร: <span style={{ color: bankBrand.text, fontWeight: 700 }}>{qrReceiver.bankName}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <div style={{
                                        flex: '1 0 100%',
                                        width: '100%',
                                        maxWidth: '320px',
                                        margin: '0 auto',
                                        padding: '16px 18px',
                                        borderRadius: '18px',
                                        background: 'linear-gradient(180deg, #fff9e7 0%, #fff4cf 100%)',
                                        border: '1px solid rgba(250,204,21,0.4)',
                                        boxShadow: '0 10px 24px rgba(250,204,21,0.12)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'center',
                                        textAlign: 'center',
                                    }}>
                                        <div style={{ fontSize: '12px', color: '#b89b37', marginBottom: '6px', fontWeight: 700 }}>ยอดที่ต้องชำระ</div>
                                        <div style={{ fontSize: '30px', fontWeight: 900, fontFamily: "'Inter'", color: '#B38600', letterSpacing: '-0.03em' }}>฿{payableTotal.toLocaleString()}</div>
                                        <div style={{ fontSize: '11px', color: '#b89b37', marginTop: '4px' }}>โอนให้ตรงยอดตามนี้</div>
                                    </div>
                                    <div style={{ width: '100%', fontSize: '12px', color: '#e17055', fontWeight: 700, textAlign: 'center', padding: '10px 14px', borderRadius: '14px', background: 'rgba(225,112,85,0.08)', border: '1px solid rgba(225,112,85,0.18)' }}>⚠️ กรุณาโอนเงินให้ตรงจำนวน เพื่อให้ระบบตรวจสอบอัตโนมัติ</div>
                                </div>
                            )}

                            {/* Slip upload */}
                            {hasTransferChannel && (
                                <div style={{ borderTop: '1px solid var(--c-border)', marginTop: '8px', paddingTop: '20px' }}>
                                <p style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>📸 อัปโหลดสลิปการโอนเงิน</p>
                                <label style={{
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    padding: slipPreview ? '8px' : '24px', borderRadius: '12px', cursor: 'pointer',
                                    border: `2px dashed ${remaining <= PAYMENT_TOLERANCE && verifiedSlips.length > 0 ? 'rgba(16,185,129,0.5)' : 'rgba(255,255,255,0.15)'}`,
                                    background: remaining <= PAYMENT_TOLERANCE && verifiedSlips.length > 0 ? 'rgba(16,185,129,0.05)' : 'rgba(255,255,255,0.02)',
                                    transition: 'all 0.2s',
                                }}>
                                    {slipPreview ? (
                                        <Image
                                            src={slipPreview}
                                            alt="สลิป"
                                            width={320}
                                            height={200}
                                            unoptimized
                                            style={{ maxHeight: '200px', width: 'auto', height: 'auto', borderRadius: '8px', objectFit: 'contain' }}
                                        />
                                    ) : (
                                        <>
                                            <Upload size={28} style={{ color: 'var(--c-text-muted)' }} />
                                            <span style={{ fontSize: '14px', color: 'var(--c-text-secondary)' }}>แตะเพื่อเลือกรูปสลิป</span>
                                            <span style={{ fontSize: '11px', color: 'var(--c-text-muted)', textAlign: 'center' }}>💡 ใช้รูปจากแอปธนาคารโดยตรง ไม่ใช่ screenshot</span>
                                        </>
                                    )}
                                    <input type="file" accept="image/*" style={{ display: 'none' }}
                                        disabled={slipVerifying}
                                        onChange={(e) => { if (e.target.files?.[0]) handleSlipSelect(e.target.files[0]) }} />
                                </label>

                                <div style={{
                                    marginTop: '12px',
                                    padding: '10px 12px',
                                    borderRadius: '10px',
                                    background: 'rgba(250,204,21,0.1)',
                                    border: '1px solid rgba(250,204,21,0.18)',
                                    color: '#B38600',
                                    fontSize: '12px',
                                    lineHeight: 1.6,
                                }}>
                                    หากเป็นสลิปธนาคารกรุงเทพ ระบบอาจใช้เวลา 1-5 นาทีในการตรวจสอบ กรุณาอย่าออกจากหน้านี้ระหว่างระบบกำลังตรวจสอบ
                                </div>

                                {slipVerifyState.phase !== 'idle' && (
                                    <div style={{
                                        marginTop: '12px',
                                        padding: '12px 14px',
                                        borderRadius: '10px',
                                        background: slipVerifyState.phase === 'success'
                                            ? 'rgba(16,185,129,0.08)'
                                            : slipVerifyState.phase === 'error'
                                                ? 'rgba(225,112,85,0.08)'
                                                : 'rgba(59,130,246,0.08)',
                                        border: slipVerifyState.phase === 'success'
                                            ? '1px solid rgba(16,185,129,0.2)'
                                            : slipVerifyState.phase === 'error'
                                                ? '1px solid rgba(225,112,85,0.18)'
                                                : '1px solid rgba(59,130,246,0.18)',
                                        color: slipVerifyState.phase === 'success'
                                            ? '#10b981'
                                            : slipVerifyState.phase === 'error'
                                                ? '#e17055'
                                                : '#60a5fa',
                                        fontSize: '13px',
                                        fontWeight: 700,
                                        textAlign: 'center',
                                    }}>
                                        {slipVerifying && <div className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px', margin: '0 auto 8px' }} />}
                                        {slipVerifyState.message}
                                    </div>
                                )}

                                {/* Verify button */}
                                {slipPreview && (
                                    <button
                                        onClick={handleVerifySlip}
                                        disabled={slipVerifying}
                                        className="btn btn-primary btn-block"
                                        style={{ marginTop: '12px', fontWeight: 700 }}
                                    >
                                        {slipVerifying ? (
                                            <><div className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }} /> {slipVerifyState.phase === 'pending' ? 'ตรวจสอบอยู่ 1-5 นาที...' : 'กำลังตรวจสอบ...'}</>
                                        ) : (
                                            <>🔍 ตรวจสอบสลิป</>
                                        )}
                                    </button>
                                )}

                                {/* Verified slips list */}
                                {verifiedSlips.length > 0 && (
                                    <div style={{ marginTop: '12px' }}>
                                        {verifiedSlips.map((slip, i) => (
                                            <div key={i} style={{
                                                padding: '10px 14px', borderRadius: '10px', marginBottom: '6px',
                                                background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px',
                                            }}>
                                                <div style={{ color: 'var(--c-text-secondary)' }}>
                                                    <><CheckCircle size={14} style={{ color: '#10b981', verticalAlign: 'middle', marginRight: '6px' }} />สลิป {i + 1}: {slip.sender}</>
                                                </div>
                                                <strong style={{ color: '#10b981' }}>฿{slip.amount.toLocaleString()}</strong>
                                            </div>
                                        ))}

                                        {/* Progress bar */}
                                        <div style={{ marginTop: '10px', padding: '12px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.04)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                                                <span style={{ color: 'var(--c-text-secondary)' }}>ชำระแล้ว</span>
                                                <strong>฿{paidTotal.toLocaleString()} / ฿{total.toLocaleString()}</strong>
                                            </div>
                                            <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                                                <div style={{ height: '100%', borderRadius: '3px', background: remaining <= PAYMENT_TOLERANCE ? '#10b981' : '#FACC15', width: `${Math.min(100, (paidTotal / total) * 100)}%`, transition: 'width 0.5s' }} />
                                            </div>
                                            {remaining > PAYMENT_TOLERANCE && (
                                                <div style={{ marginTop: '8px', fontSize: '14px', color: '#B38600', fontWeight: 700, textAlign: 'center' }}>
                                                    💰 โอนเพิ่มอีก ฿{remaining.toLocaleString()} แล้วแนบสลิปใหม่
                                                </div>
                                            )}
                                            {remaining <= PAYMENT_TOLERANCE && (
                                                <div style={{ marginTop: '8px', fontSize: '14px', color: '#10b981', fontWeight: 700, textAlign: 'center' }}>
                                                    ✅ ยอดครบแล้ว! กดยืนยันการจองได้เลย
                                                </div>
                                            )}
                                            {paidTotal > total + PAYMENT_TOLERANCE && (
                                                <div style={{ marginTop: '8px', padding: '8px 10px', borderRadius: '8px', background: 'rgba(250,204,21,0.1)', fontSize: '12px', color: '#B38600' }}>
                                                    ⚠️ โอนเกิน ฿{(paidTotal - total).toLocaleString()} กรุณา Add Line: <strong>@skibkk</strong> เพื่อรับเงินคืน
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}


                                </div>
                            )}
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button onClick={() => setStep(1)} className="btn btn-secondary" style={{ flex: 1, opacity: slipVerifying ? 0.6 : 1 }} disabled={slipVerifying}>
                            <ArrowLeft size={18} /> กลับ
                        </button>
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => { void handleSubmitBooking() }}
                            className="btn btn-success"
                            style={{ flex: 2, opacity: !canSubmit ? 0.5 : 1 }}
                            disabled={loading || slipVerifying || !canSubmit}
                        >
                            {loading ? <div className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px' }} /> : <>ยืนยันการจอง <CheckCircle size={18} /></>}
                        </motion.button>
                    </div>
                    {paymentMethod === 'PACKAGE' && (
                        <div style={{ marginTop: '10px', padding: '10px 12px', borderRadius: '10px', background: 'rgba(56,239,125,0.08)', color: '#00b894', fontSize: '13px', fontWeight: 700 }}>
                            ✅ ใช้แพ็คเกจในการจองครั้งนี้ ยอดที่บันทึกเป็น 0 บาท
                        </div>
                    )}
                </motion.div>
            )}

            {/* Booking Terms Modal */}
            {showTerms && !termsAccepted && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
                }}>
                    <div style={{
                        background: 'var(--c-bg)', borderRadius: '20px', maxWidth: '500px', width: '100%',
                        padding: '32px', maxHeight: '80vh', overflow: 'auto',
                        border: '1px solid var(--c-glass-border)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                            <AlertTriangle size={24} style={{ color: '#B38600' }} />
                            <h2 style={{ fontSize: '20px', fontWeight: 800 }}>เงื่อนไขการจอง</h2>
                        </div>
                        <div style={{
                            whiteSpace: 'pre-wrap', fontSize: '14px', lineHeight: 1.8,
                            color: 'var(--c-text-secondary)', marginBottom: '24px',
                            padding: '16px', background: 'var(--c-glass)', borderRadius: '12px',
                        }}>
                            {termsText}
                        </div>
                        <button
                            onClick={() => { setTermsAccepted(true); setShowTerms(false) }}
                            className="btn btn-primary btn-block"
                            style={{ fontWeight: 700, fontSize: '16px' }}
                        >
                            ยอมรับเงื่อนไข
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

// Auto-redirect to booking history after success
function SuccessRedirect({ router, bookingNumber }: { router: ReturnType<typeof useRouter>; bookingNumber: string }) {
    const [countdown, setCountdown] = useState(3)

    useEffect(() => {
        const timer = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(timer)
                    router.push('/profile')
                    return 0
                }
                return prev - 1
            })
        }, 1000)
        return () => clearInterval(timer)
    }, [router])

    return (
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} style={{ textAlign: 'center', padding: '40px 0' }}>
            <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                style={{
                    width: '100px', height: '100px', borderRadius: '50%',
                    background: 'var(--c-gradient-success)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 24px',
                }}
            >
                <CheckCircle size={48} style={{ color: '#0a0a1a' }} />
            </motion.div>
            <h2 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '8px' }}>จองสำเร็จ! 🎉</h2>
            <p style={{ color: 'var(--c-text-secondary)', marginBottom: '24px' }}>
                การจองของคุณได้รับการบันทึกเรียบร้อยแล้ว
            </p>
            <div className="glass-card" style={{ cursor: 'default', display: 'inline-block', padding: '20px 40px', marginBottom: '32px' }}>
                <p style={{ fontSize: '13px', color: 'var(--c-text-muted)', marginBottom: '4px' }}>หมายเลขการจอง</p>
                <p style={{ fontSize: '24px', fontWeight: 900, fontFamily: "'Inter'", letterSpacing: 1, background: 'var(--c-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    {bookingNumber}
                </p>
            </div>
            <p style={{ color: 'var(--c-text-muted)', fontSize: '14px', marginBottom: '32px' }}>
                กำลังไปหน้าประวัติการจองใน {countdown} วินาที...
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button onClick={() => router.push('/profile')} className="btn btn-secondary">
                    ดูประวัติการจอง
                </button>
                <button onClick={() => router.push('/courts')} className="btn btn-primary">
                    จองเพิ่ม
                </button>
            </div>
        </motion.div>
    )
}
