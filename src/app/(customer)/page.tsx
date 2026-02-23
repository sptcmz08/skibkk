'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar, Shield, Clock, CreditCard, Users, Zap, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'

export default function HomePage() {
    const [banners, setBanners] = useState<string[]>([])
    const [gallery, setGallery] = useState<string[]>([])
    const [currentSlide, setCurrentSlide] = useState(0)

    useEffect(() => {
        fetch('/api/settings')
            .then(r => r.json())
            .then(data => {
                if (data.banners) setBanners(JSON.parse(data.banners))
                if (data.gallery) setGallery(JSON.parse(data.gallery))
            })
            .catch(() => { })
    }, [])

    // Auto-advance slider
    useEffect(() => {
        if (banners.length <= 1) return
        const id = setInterval(() => {
            setCurrentSlide(prev => (prev + 1) % banners.length)
        }, 5000)
        return () => clearInterval(id)
    }, [banners.length])

    const goToSlide = (index: number) => setCurrentSlide(index)
    const prevSlide = () => setCurrentSlide(prev => (prev - 1 + banners.length) % banners.length)
    const nextSlide = () => setCurrentSlide(prev => (prev + 1) % banners.length)

    const services = [
        {
            icon: '⛷️',
            title: 'สกีในร่ม',
            desc: 'สนามสกีในร่มมาตรฐานระดับสากล พร้อมลานฝึกหลายระดับ',
            gradient: 'linear-gradient(135deg, #667eea, #764ba2)',
        },
        {
            icon: '🏂',
            title: 'สโนว์บอร์ด',
            desc: 'ลานสโนว์บอร์ดพร้อมอุปกรณ์ครบ ลื่นไหลทุกจังหวะ',
            gradient: 'linear-gradient(135deg, #f093fb, #f5576c)',
        },
        {
            icon: '👨‍🏫',
            title: 'ครูผู้สอน',
            desc: 'ครูมืออาชีพสอนตั้งแต่เริ่มต้น ดูแลใกล้ชิด ปลอดภัยทุกขั้นตอน',
            gradient: 'linear-gradient(135deg, #11998e, #38ef7d)',
        },
        {
            icon: '🎿',
            title: 'อุปกรณ์ครบครัน',
            desc: 'รองเท้าสกี สโนว์บอร์ด หมวก แว่น พร้อมให้บริการครบชุด',
            gradient: 'linear-gradient(135deg, #a18cd1, #fbc2eb)',
        },
        {
            icon: '📦',
            title: 'แพ็คเกจสุดคุ้ม',
            desc: 'แพ็คเกจชั่วโมงในราคาพิเศษ ยิ่งซื้อเยอะยิ่งคุ้ม',
            gradient: 'linear-gradient(135deg, #ffecd2, #fcb69f)',
        },
        {
            icon: '🛡️',
            title: 'ระบบจองออนไลน์',
            desc: 'จองง่าย ดูตารางว่าง Real-time ชำระเงินออนไลน์ ปลอดภัย',
            gradient: 'linear-gradient(135deg, #667eea, #764ba2)',
        },
    ]

    return (
        <>
            {/* ===== HERO SLIDER ===== */}
            <section style={{
                position: 'relative',
                width: '100%',
                height: banners.length > 0 ? '520px' : '600px',
                overflow: 'hidden',
            }}>
                {banners.length > 0 ? (
                    <>
                        {/* Slides */}
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={currentSlide}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.6 }}
                                style={{
                                    position: 'absolute',
                                    inset: 0,
                                    backgroundImage: `url(${banners[currentSlide]})`,
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center',
                                }}
                            />
                        </AnimatePresence>

                        {/* Overlay gradient */}
                        <div style={{
                            position: 'absolute', inset: 0,
                            background: 'linear-gradient(to bottom, rgba(10,10,26,0.4) 0%, rgba(10,10,26,0.8) 100%)',
                        }} />

                        {/* Text over banner */}
                        <div style={{
                            position: 'absolute', inset: 0,
                            display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center',
                            zIndex: 2, textAlign: 'center', padding: '0 24px',
                        }}>
                            <motion.h1
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                style={{
                                    fontSize: 'clamp(32px, 6vw, 56px)',
                                    fontWeight: 900,
                                    fontFamily: "'Inter', sans-serif",
                                    letterSpacing: '-1.5px',
                                    color: 'white',
                                    textShadow: '0 2px 20px rgba(0,0,0,0.4)',
                                    marginBottom: '16px',
                                    lineHeight: 1.2,
                                }}
                            >
                                SKI & SNOWBOARD<br />
                                <span style={{ background: 'var(--c-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                                    TRAINING CENTER
                                </span>
                            </motion.h1>
                            <motion.p
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                style={{ color: 'rgba(255,255,255,0.85)', fontSize: '18px', marginBottom: '32px', maxWidth: '600px' }}
                            >
                                จองสนาม ดูตารางว่าง Real-time ชำระเงินออนไลน์
                            </motion.p>
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4 }}
                                style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}
                            >
                                <Link href="/courts" className="btn btn-primary btn-lg">
                                    <Calendar size={20} /> จองสนามเลย <ArrowRight size={20} />
                                </Link>
                                <Link href="/register" className="btn btn-secondary btn-lg">
                                    สมัครสมาชิก
                                </Link>
                            </motion.div>
                        </div>

                        {/* Navigation arrows */}
                        {banners.length > 1 && (
                            <>
                                <button onClick={prevSlide} style={{
                                    position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)',
                                    zIndex: 3, background: 'rgba(0,0,0,0.4)', border: 'none', borderRadius: '50%',
                                    width: '44px', height: '44px', display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', color: 'white', cursor: 'pointer',
                                    backdropFilter: 'blur(4px)', transition: 'all 0.2s',
                                }} onMouseOver={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.6)')}
                                    onMouseOut={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.4)')}>
                                    <ChevronLeft size={24} />
                                </button>
                                <button onClick={nextSlide} style={{
                                    position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)',
                                    zIndex: 3, background: 'rgba(0,0,0,0.4)', border: 'none', borderRadius: '50%',
                                    width: '44px', height: '44px', display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', color: 'white', cursor: 'pointer',
                                    backdropFilter: 'blur(4px)', transition: 'all 0.2s',
                                }} onMouseOver={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.6)')}
                                    onMouseOut={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.4)')}>
                                    <ChevronRight size={24} />
                                </button>
                            </>
                        )}

                        {/* Dots indicator */}
                        {banners.length > 1 && (
                            <div style={{
                                position: 'absolute', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
                                display: 'flex', gap: '8px', zIndex: 3,
                            }}>
                                {banners.map((_, i) => (
                                    <button
                                        key={i}
                                        onClick={() => goToSlide(i)}
                                        style={{
                                            width: currentSlide === i ? '28px' : '10px', height: '10px',
                                            borderRadius: '5px', border: 'none', cursor: 'pointer',
                                            background: currentSlide === i ? 'white' : 'rgba(255,255,255,0.4)',
                                            transition: 'all 0.3s',
                                        }}
                                    />
                                ))}
                            </div>
                        )}
                    </>
                ) : (
                    /* Fallback hero when no banners uploaded */
                    <div className="hero-section" style={{ minHeight: '100%' }}>
                        <motion.div
                            className="hero-content"
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8 }}
                        >
                            <h1 className="hero-title">
                                จองสนามกีฬา<br />
                                <span>ง่ายแค่ปลายนิ้ว</span>
                            </h1>
                            <p className="hero-subtitle">
                                ดูตารางว่างแบบ Real-time เลือกเวลาที่ต้องการ<br />
                                ชำระเงินออนไลน์ ได้รับยืนยันทันที
                            </p>
                            <div className="hero-buttons">
                                <Link href="/courts" className="btn btn-primary btn-lg">
                                    <Calendar size={20} /> จองสนามเลย <ArrowRight size={20} />
                                </Link>
                                <Link href="/register" className="btn btn-secondary btn-lg">
                                    สมัครสมาชิก
                                </Link>
                            </div>
                        </motion.div>
                        <div style={{ position: 'absolute', top: '20%', right: '10%', width: '200px', height: '200px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(102,126,234,0.15), transparent)', filter: 'blur(40px)', pointerEvents: 'none' }} />
                    </div>
                )}
            </section>

            {/* ===== SERVICES SECTION ===== */}
            <section style={{ padding: '80px 24px', maxWidth: '1200px', margin: '0 auto' }}>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    style={{ textAlign: 'center', marginBottom: '60px' }}
                >
                    <h2 style={{
                        fontSize: '42px', fontWeight: 800, fontFamily: "'Inter', sans-serif",
                        letterSpacing: '-1.5px', marginBottom: '16px',
                    }}>
                        บริการของเรา
                    </h2>
                    <p style={{ color: 'var(--c-text-secondary)', fontSize: '18px', maxWidth: '600px', margin: '0 auto' }}>
                        สัมผัสประสบการณ์สกีและสโนว์บอร์ดระดับมืออาชีพ ครบทุกบริการในที่เดียว
                    </p>
                </motion.div>

                <div className="grid-3">
                    {services.map((svc, i) => (
                        <motion.div
                            key={svc.title}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.1 }}
                            className="glass-card"
                            style={{ cursor: 'default' }}
                        >
                            <div style={{
                                width: '56px', height: '56px', borderRadius: '14px',
                                background: svc.gradient, display: 'flex', alignItems: 'center',
                                justifyContent: 'center', fontSize: '28px', marginBottom: '18px',
                            }}>
                                {svc.icon}
                            </div>
                            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '10px' }}>
                                {svc.title}
                            </h3>
                            <p style={{ fontSize: '14px', color: 'var(--c-text-secondary)', lineHeight: 1.7 }}>
                                {svc.desc}
                            </p>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* ===== GALLERY / ATMOSPHERE SECTION ===== */}
            <section style={{
                padding: '80px 24px',
                position: 'relative',
                overflow: 'hidden',
            }}>
                <div style={{
                    position: 'absolute', inset: 0,
                    background: 'var(--c-gradient)', opacity: 0.04,
                }} />
                <div style={{ maxWidth: '1200px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        style={{ textAlign: 'center', marginBottom: '48px' }}
                    >
                        <h2 style={{
                            fontSize: '42px', fontWeight: 800, fontFamily: "'Inter', sans-serif",
                            letterSpacing: '-1.5px', marginBottom: '16px',
                        }}>
                            บรรยากาศการเรียนการสอน
                        </h2>
                        <p style={{ color: 'var(--c-text-secondary)', fontSize: '18px', maxWidth: '600px', margin: '0 auto' }}>
                            สัมผัสบรรยากาศจริงจากผู้มาใช้บริการ
                        </p>
                    </motion.div>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                        gap: '16px',
                    }}>
                        {gallery.length > 0 ? (
                            gallery.map((url, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    whileInView={{ opacity: 1, scale: 1 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: i * 0.08 }}
                                    style={{
                                        borderRadius: '16px', overflow: 'hidden',
                                        border: '1px solid var(--c-glass-border)',
                                        aspectRatio: i % 3 === 0 ? '4/3' : '1',
                                        position: 'relative',
                                    }}
                                >
                                    <img
                                        src={url}
                                        alt={`บรรยากาศ ${i + 1}`}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.4s' }}
                                        onMouseOver={e => (e.currentTarget.style.transform = 'scale(1.05)')}
                                        onMouseOut={e => (e.currentTarget.style.transform = 'scale(1)')}
                                    />
                                    <div style={{
                                        position: 'absolute', inset: 0,
                                        background: 'linear-gradient(to top, rgba(0,0,0,0.3), transparent)',
                                        pointerEvents: 'none',
                                    }} />
                                </motion.div>
                            ))
                        ) : (
                            /* Placeholder cards when no gallery images yet */
                            [1, 2, 3].map(i => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    whileInView={{ opacity: 1, scale: 1 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: i * 0.1 }}
                                    style={{
                                        borderRadius: '16px', overflow: 'hidden',
                                        border: '1px solid var(--c-glass-border)',
                                        aspectRatio: '4/3',
                                        background: 'var(--c-glass)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexDirection: 'column', gap: '12px',
                                    }}
                                >
                                    <span style={{ fontSize: '48px', opacity: 0.3 }}>📷</span>
                                    <span style={{ color: 'var(--c-text-muted)', fontSize: '14px' }}>เร็วๆ นี้</span>
                                </motion.div>
                            ))
                        )}
                    </div>
                </div>
            </section>

            {/* ===== CTA SECTION ===== */}
            <section style={{
                padding: '80px 24px', textAlign: 'center',
                position: 'relative', overflow: 'hidden',
            }}>
                <div style={{ position: 'absolute', inset: 0, background: 'var(--c-gradient)', opacity: 0.06 }} />
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    style={{ position: 'relative', zIndex: 1 }}
                >
                    <h2 style={{
                        fontSize: '36px', fontWeight: 800, fontFamily: "'Inter', sans-serif",
                        letterSpacing: '-1px', marginBottom: '16px',
                    }}>
                        พร้อมจองสนามแล้วหรือยัง?
                    </h2>
                    <p style={{ color: 'var(--c-text-secondary)', fontSize: '18px', marginBottom: '32px' }}>
                        เริ่มต้นจองสนามวันนี้ ง่าย สะดวก รวดเร็ว
                    </p>
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} style={{ display: 'inline-block' }}>
                        <Link href="/courts" className="btn btn-primary btn-lg">
                            <Calendar size={20} /> ดูตารางว่าง <ArrowRight size={20} />
                        </Link>
                    </motion.div>
                </motion.div>
            </section>
        </>
    )
}
