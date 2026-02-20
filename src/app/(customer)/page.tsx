'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Calendar, Shield, Clock, CreditCard, Star, ArrowRight, Zap, Users } from 'lucide-react'

export default function HomePage() {
    const features = [
        {
            icon: <Calendar size={28} />,
            title: 'จองง่าย ดูตารางว่าง Real-time',
            desc: 'เลือกวัน เลือกเวลา เลือกสนาม ได้ทันที ไม่ต้องโทรถาม',
            gradient: 'linear-gradient(135deg, #667eea, #764ba2)',
        },
        {
            icon: <Clock size={28} />,
            title: 'ระบบ Lock เวลา 20 นาที',
            desc: 'เวลาที่คุณเลือกจะถูก Lock ไว้ให้คุณ 20 นาที ไม่โดนแย่ง',
            gradient: 'linear-gradient(135deg, #f093fb, #f5576c)',
        },
        {
            icon: <CreditCard size={28} />,
            title: 'ชำระเงินออนไลน์ ปลอดภัย',
            desc: 'รองรับ QR PromptPay และโอนผ่านธนาคาร ตรวจสลิปอัตโนมัติ',
            gradient: 'linear-gradient(135deg, #11998e, #38ef7d)',
        },
        {
            icon: <Shield size={28} />,
            title: 'ตรวจสลิปด้วย EasySlip',
            desc: 'ระบบตรวจสอบสลิปอัตโนมัติ ป้องกันสลิปซ้ำและสลิปปลอม',
            gradient: 'linear-gradient(135deg, #a18cd1, #fbc2eb)',
        },
        {
            icon: <Users size={28} />,
            title: 'ระบบสมาชิก ดูประวัติย้อนหลัง',
            desc: 'จัดการข้อมูลส่วนตัว ดูประวัติการจองทั้งหมดได้ง่ายๆ',
            gradient: 'linear-gradient(135deg, #ffecd2, #fcb69f)',
        },
        {
            icon: <Zap size={28} />,
            title: 'แพ็คเกจชั่วโมงสุดคุ้ม',
            desc: 'ซื้อแพ็คเกจชั่วโมงในราคาพิเศษ แล้วนำมาจองเมื่อไหร่ก็ได้',
            gradient: 'linear-gradient(135deg, #fad0c4, #ffd1ff)',
        },
    ]

    return (
        <>
            {/* Hero Section */}
            <section className="hero-section">
                <motion.div
                    className="hero-content"
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 20px',
                            background: 'rgba(102, 126, 234, 0.1)',
                            border: '1px solid rgba(102, 126, 234, 0.2)',
                            borderRadius: '50px',
                            fontSize: '14px',
                            color: 'var(--c-primary-light)',
                            marginBottom: '28px',
                            fontWeight: 600,
                        }}
                    >
                        <Star size={16} fill="var(--c-primary)" />
                        ระบบจองสนามกีฬาออนไลน์ อันดับ 1
                    </motion.div>

                    <h1 className="hero-title">
                        จองสนามกีฬา<br />
                        <span>ง่ายแค่ปลายนิ้ว</span>
                    </h1>

                    <p className="hero-subtitle">
                        ดูตารางว่างแบบ Real-time เลือกเวลาที่ต้องการ<br />
                        ชำระเงินออนไลน์ ได้รับยืนยันทันที
                    </p>

                    <div className="hero-buttons">
                        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                            <Link href="/courts" className="btn btn-primary btn-lg">
                                <Calendar size={20} />
                                จองสนามเลย
                                <ArrowRight size={20} />
                            </Link>
                        </motion.div>
                        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                            <Link href="/register" className="btn btn-secondary btn-lg">
                                สมัครสมาชิก
                            </Link>
                        </motion.div>
                    </div>

                    {/* Stats */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                        style={{
                            display: 'flex',
                            justifyContent: 'center',
                            gap: '48px',
                            marginTop: '60px',
                            flexWrap: 'wrap',
                        }}
                    >
                        {[
                            { value: '500+', label: 'ลูกค้าที่ไว้วางใจ' },
                            { value: '1000+', label: 'การจองสำเร็จ' },
                            { value: '4.9', label: 'คะแนนรีวิว' },
                        ].map((stat) => (
                            <div key={stat.label} style={{ textAlign: 'center' }}>
                                <div style={{
                                    fontSize: '36px',
                                    fontWeight: 900,
                                    fontFamily: "'Inter', sans-serif",
                                    background: 'var(--c-gradient)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    lineHeight: 1,
                                }}>
                                    {stat.value}
                                </div>
                                <div style={{ fontSize: '14px', color: 'var(--c-text-muted)', marginTop: '6px' }}>
                                    {stat.label}
                                </div>
                            </div>
                        ))}
                    </motion.div>
                </motion.div>

                {/* Floating orbs */}
                <div style={{ position: 'absolute', top: '20%', right: '10%', width: '200px', height: '200px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(102,126,234,0.15), transparent)', filter: 'blur(40px)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', bottom: '15%', left: '8%', width: '150px', height: '150px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(240,147,251,0.12), transparent)', filter: 'blur(30px)', pointerEvents: 'none' }} />
            </section>

            {/* Features Section */}
            <section style={{ padding: '80px 24px', maxWidth: '1200px', margin: '0 auto' }}>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    style={{ textAlign: 'center', marginBottom: '60px' }}
                >
                    <h2 style={{
                        fontSize: '42px',
                        fontWeight: 800,
                        fontFamily: "'Inter', sans-serif",
                        letterSpacing: '-1.5px',
                        marginBottom: '16px',
                    }}>
                        ทำไมต้อง <span style={{ background: 'var(--c-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>SKIBKK</span>
                    </h2>
                    <p style={{ color: 'var(--c-text-secondary)', fontSize: '18px', maxWidth: '600px', margin: '0 auto' }}>
                        ระบบจองที่ออกแบบมาเพื่อความสะดวกของคุณ ครบทุกฟีเจอร์ในที่เดียว
                    </p>
                </motion.div>

                <div className="grid-3">
                    {features.map((feature, i) => (
                        <motion.div
                            key={feature.title}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.1 }}
                            className="glass-card"
                            style={{ cursor: 'default' }}
                        >
                            <div style={{
                                width: '56px',
                                height: '56px',
                                borderRadius: '14px',
                                background: feature.gradient,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                marginBottom: '18px',
                            }}>
                                {feature.icon}
                            </div>
                            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '10px' }}>
                                {feature.title}
                            </h3>
                            <p style={{ fontSize: '14px', color: 'var(--c-text-secondary)', lineHeight: 1.7 }}>
                                {feature.desc}
                            </p>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* CTA Section */}
            <section style={{
                padding: '80px 24px',
                textAlign: 'center',
                position: 'relative',
                overflow: 'hidden',
            }}>
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'var(--c-gradient)',
                    opacity: 0.06,
                }} />
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    style={{ position: 'relative', zIndex: 1 }}
                >
                    <h2 style={{
                        fontSize: '36px',
                        fontWeight: 800,
                        fontFamily: "'Inter', sans-serif",
                        letterSpacing: '-1px',
                        marginBottom: '16px',
                    }}>
                        พร้อมจองสนามแล้วหรือยัง?
                    </h2>
                    <p style={{ color: 'var(--c-text-secondary)', fontSize: '18px', marginBottom: '32px' }}>
                        เริ่มต้นจองสนามวันนี้ ง่าย สะดวก รวดเร็ว
                    </p>
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} style={{ display: 'inline-block' }}>
                        <Link href="/courts" className="btn btn-primary btn-lg">
                            <Calendar size={20} />
                            ดูตารางว่าง
                            <ArrowRight size={20} />
                        </Link>
                    </motion.div>
                </motion.div>
            </section>
        </>
    )
}
