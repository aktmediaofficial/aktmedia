import React, { FormEvent, useState, useEffect, useRef } from "react"
import { motion, MotionConfig } from "framer-motion"
import { assetUrl, LOGO } from "./lib/assets"

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"]
const DAYS = ["Su","Mo","Tu","We","Th","Fr","Sa"]

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}
const revealProps = (delay = 0, distance = 40) => ({
  initial: { opacity: 0, y: distance },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.8, delay, ease: [0.25, 0.46, 0.45, 0.94] as const },
})

function DateTimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const now = new Date()
  const [open, setOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [selectedHour, setSelectedHour] = useState<string>("")
  const [selectedMinute, setSelectedMinute] = useState<string>("00")
  const [pendingDate, setPendingDate] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth)

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1) } else setViewMonth(viewMonth - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1) } else setViewMonth(viewMonth + 1)
  }

  const confirm = (day: number) => {
    setSelectedDay(day)
    const mm = String(viewMonth + 1).padStart(2, "0")
    const dd = String(day).padStart(2, "0")
    setPendingDate(`${viewYear}-${mm}-${dd}`)
  }

  const confirmTime = () => {
    if (!pendingDate) return
    const hour = selectedHour || "10"
    const min = selectedMinute || "00"
    const val = `${pendingDate} ${hour}:${min}`
    onChange(val)
    setOpen(false)
    setPendingDate("")
  }

  const display = (() => {
    if (!value) return "Select date & time"
    const [d, t] = value.split(" ")
    const [y, m, dd] = d.split("-")
    return `${dd}/${m}/${y}  ·  ${t}`
  })()

  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"))
  const minutes = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"))

  return (
    <div className="dt-picker" ref={containerRef}>
      <button type="button" className={`dt-trigger${value ? " dt-trigger--filled" : ""}`} onClick={() => setOpen(!open)}>
        <span className="dt-trigger-text">{display}</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      </button>
      {open && (
        <div className="dt-popup">
          <div className="dt-cal-header">
            <button type="button" onClick={prevMonth}>&#8249;</button>
            <span>{MONTHS[viewMonth]} {viewYear}</span>
            <button type="button" onClick={nextMonth}>&#8250;</button>
          </div>
          <div className="dt-cal-days">
            {DAYS.map((d) => <span key={d}>{d}</span>)}
          </div>
          <div className="dt-cal-grid">
            {Array.from({ length: firstDay }).map((_, i) => <span key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => (
              <button key={day} type="button" className={pendingDate === `${viewYear}-${String(viewMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}` ? "dt-day--selected" : ""} onClick={() => confirm(day)}>{day}</button>
            ))}
          </div>
          <div className="dt-time-row">
            <div className="dt-time-display">
              <div className="dt-time-wheel">
                <span className="dt-time-label">Hour</span>
                <div className="dt-time-scroll">
                  {hours.map((h) => (
                    <button key={h} type="button" className={selectedHour === h ? "dt-time--sel" : ""} onClick={() => setSelectedHour(h)}>{h}</button>
                  ))}
                </div>
              </div>
              <span className="dt-time-colon">:</span>
              <div className="dt-time-wheel">
                <span className="dt-time-label">Min</span>
                <div className="dt-time-scroll">
                  {minutes.map((m) => (
                    <button key={m} type="button" className={selectedMinute === m ? "dt-time--sel" : ""} onClick={() => setSelectedMinute(m)}>{m}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <button type="button" className="dt-confirm" disabled={!pendingDate} onClick={confirmTime}>
            {pendingDate ? `Confirm ${pendingDate} ${selectedHour || "10"}:${selectedMinute}` : "Pick a day first"}
          </button>
        </div>
      )}
      <input type="hidden" name="date" value={value} required />
    </div>
  )
}


const studioImages = {
  hero: assetUrl("Site Images", "studio.jpg"),
  recording: assetUrl("Site Images", "Recording.jpeg"),
}

const packages = [
  {
    name: "Mixing",
    type: "Balance, clarity & creative polish",
    price: "R200",
    image: assetUrl("Site Images", "Mixing.jpeg"),
  },
  {
    name: "Mastering",
    type: "Release-ready across every platform",
    price: "R200",
    image: assetUrl("Site Images", "Mastering.jpg"),
  },
  {
    name: "Audio Recording",
    type: "Vocals, instruments & voiceover",
    price: "R200",
    image: studioImages.recording,
  },
  {
    name: "Beat / Instrumental",
    type: "Custom beats & instrumentals",
    price: "R200",
    image: assetUrl("Site Images", "Beat.jpeg"),
  },
]

const engineers = [
  {
    name: "Atee",
    specialty: "Soul · Hip-hop · Trap",
    image: assetUrl("Artist Profiles", "Atee.jpeg"),
  },
  {
    name: "Nazz",
    specialty: "3 Step · Afrohouse · House · Piano",
    image: assetUrl("Artist Profiles", "Nazz.jpeg"),
  },
]

type IconName = "mic" | "sliders" | "headphones" | "calendar" | "arrow"

function Icon({ name }: { name: IconName }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  }

  if (name === "mic") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true" {...common}>
        <rect x="11" y="3" width="10" height="18" rx="5" />
        <path d="M7.5 16.5a8.5 8.5 0 0 0 17 0M16 25v4M11 29h10M11 10h4M11 14h4" />
      </svg>
    )
  }
  if (name === "sliders") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true" {...common}>
        <path d="M7 3v26M16 3v26M25 3v26" />
        <circle cx="7" cy="11" r="3" />
        <circle cx="16" cy="21" r="3" />
        <circle cx="25" cy="13" r="3" />
      </svg>
    )
  }
  if (name === "headphones") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true" {...common}>
        <path d="M5 17v-2a11 11 0 0 1 22 0v2M5 17h4v9H7a2 2 0 0 1-2-2v-7ZM27 17h-4v9h2a2 2 0 0 0 2-2v-7Z" />
      </svg>
    )
  }
  if (name === "calendar") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true" {...common}>
        <rect x="4" y="6.5" width="24" height="22" rx="3" />
        <path d="M10 3v7M22 3v7M4 13h24M10 18h.01M16 18h.01M22 18h.01M10 23h.01M16 23h.01M22 23h.01" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...common}>
      <path d="M5 12h14M14 7l5 5-5 5" />
    </svg>
  )
}

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [selectedPackage, setSelectedPackage] = useState("Mixing")
  const [submitted, setSubmitted] = useState(false)
  const [shareActive, setShareActive] = useState(false)
  const [bookingDate, setBookingDate] = useState("")
  const shareBtnContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (shareBtnContainerRef.current && !shareBtnContainerRef.current.contains(e.target as Node)) {
        setShareActive(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const choosePackage = (packageName: string) => {
    setSelectedPackage(packageName)
    document.querySelector("#book")?.scrollIntoView({ behavior: "smooth" })
  }

  const submitBooking = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const name = formData.get("name")?.toString() || ""
    const email = formData.get("email")?.toString() || ""
    const packageName = formData.get("package")?.toString() || selectedPackage
    const date = formData.get("date")?.toString() || ""
    const message = formData.get("message")?.toString() || ""

    const phone = "+27601682299"
    const ownerEmail = "AKTMEDIAOFFICIAL@GMAIL.COM"
    const whatsappUrl = `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(
      `New Booking Request - AKT Media Productions\n\nName: ${name}\nEmail: ${email}\nPackage: ${packageName}\nPreferred Date: ${date}\n\nMessage:\n${message}`
    )}`
    const mailtoUrl = `mailto:${ownerEmail}?subject=${encodeURIComponent(
      "New Booking Request - AKT Media Productions"
    )}&body=${encodeURIComponent(
      `Name: ${name}\nEmail: ${email}\nPackage: ${packageName}\nPreferred Date: ${date}\n\nMessage:\n${message}`
    )}`

    try {
      window.open(whatsappUrl, "_blank")
      window.location.href = mailtoUrl
    } catch (e) {
      console.error(e)
    }

    setSubmitted(true)
  }

  return (
    <MotionConfig reducedMotion="user">
    <div className="min-h-screen overflow-x-hidden bg-[#080808] text-white">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#080808]/80 backdrop-blur-xl">
        <div className="page-shell flex h-20 items-center justify-between">
          <a className="brand" href="#top" aria-label="AKT Media Productions home">
            <img src={LOGO} alt="AKT Media Productions" />
          </a>
          <nav
            className="hidden items-center gap-8 md:flex"
            aria-label="Main navigation"
          >
            <a href="#packages">Packages</a>
            <a href="#process">How it works</a>
            <a href="#engineers">Engineers</a>
            <a href="#contact">Contact</a>
          </nav>
          <a
            className="button button--small hidden md:inline-flex"
            href="#book"
          >
            Book a session <Icon name="arrow" />
          </a>
          <button
            className="menu-button md:hidden"
            type="button"
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <span />
            <span />
          </button>
        </div>
        {menuOpen && (
          <nav className="mobile-nav md:hidden" aria-label="Mobile navigation">
            {[
              ["Packages", "#packages"],
              ["How it works", "#process"],
              ["Engineers", "#engineers"],
              ["Book a session", "#book"],
            ].map(([label, href]) => (
              <a key={href} href={href} onClick={() => setMenuOpen(false)}>
                {label}
              </a>
            ))}
          </nav>
        )}
      </header>

      <main id="top">
        <section className="hero">
          <div
            className="hero-image"
            style={{ backgroundImage: `url(${studioImages.hero})` }}
          />
          <div className="hero-overlay" />
          <div className="page-shell relative z-10 flex min-h-[760px] items-end pb-16 pt-36 lg:min-h-[860px] lg:items-center lg:pb-0">
            <motion.div
              className="max-w-3xl"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <motion.div
                className="eyebrow"
                initial={{ opacity: 0, x: -24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.7, delay: 0.15 }}
              >
                <span />
                East London, South Africa
              </motion.div>
              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, delay: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
              >
                Make noise.
                <br />
                <em>We&apos;ll make it sound good.</em>
              </motion.h1>
              <motion.p
                className="mt-7 max-w-xl text-lg leading-relaxed text-white/70 md:text-xl"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.45 }}
              >
                Professional audio services, experienced engineers, and
                everything you need to take your sound from first take to final
                master.
              </motion.p>
              <motion.div
                className="mt-10 flex flex-wrap items-center gap-5"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.6 }}
              >
                <a className="button" href="#book">
                  Find your session <Icon name="arrow" />
                </a>
                <a className="text-link" href="#packages">
                  Explore packages
                </a>
              </motion.div>
            </motion.div>
          </div>
          <div className="hero-stats">
            <div>
              <strong>04</strong>
              <span>Professional services</span>
            </div>
            <div>
              <strong>24/7</strong>
              <span>Sessions available</span>
            </div>
          </div>
        </section>

        <section className="section page-shell" id="packages">
          <div className="section-heading">
            <div>
              <p className="eyebrow">
                <span />
                Choose your package
              </p>
              <motion.h2 {...revealProps()}>Everything your audio needs.</motion.h2>
            </div>
            <motion.p {...revealProps(0.15)}>
              Focused services, transparent starting prices, and an expert touch
              from raw audio to final delivery.
            </motion.p>
          </div>

          <div className="packages-grid">
            {packages.map((servicePackage, index) => (
              <motion.article
                className="package-card"
                key={servicePackage.name}
                initial={{ opacity: 0, y: 60 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.7, delay: index * 0.12, ease: [0.25, 0.46, 0.45, 0.94] }}
                whileHover={{ y: -12, scale: 1.03 }}
                whileTap={{ scale: 0.99 }}
              >
                <img
                  src={servicePackage.image}
                  alt={`${servicePackage.name} audio service`}
                />
                <div className="package-card__shade" />
                <div className="package-card__content">
                  <p>{servicePackage.type}</p>
                  <h3>{servicePackage.name}</h3>
                  <div className="package-card__footer">
                    <span>
                      From <strong>{servicePackage.price}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => choosePackage(servicePackage.name)}
                    >
                      Select package <Icon name="arrow" />
                    </button>
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
        </section>

        <section className="process-section" id="process">
          <div className="waveform" aria-hidden="true" />
          <div className="page-shell relative z-10">
            <div className="mx-auto max-w-2xl text-center">
              <p className="eyebrow justify-center">
                <span />
                Simple by design
                <span />
              </p>
              <motion.h2 {...revealProps()}>From idea to session in minutes.</motion.h2>
            </div>
            <div className="process-grid">
              {[
                [
                  "mic",
                  "Tell us the goal",
                  "Recording, mixing, mastering, or podcast.",
                ],
                [
                  "sliders",
                  "Choose a package",
                  "Select the service that fits your project.",
                ],
                [
                  "headphones",
                  "Meet your engineer",
                  "Get matched with the right set of ears.",
                ],
                [
                  "calendar",
                  "Lock it in",
                  "Choose your time and we’ll handle the rest.",
                ],
              ].map(([icon, title, copy], index) => (
                <motion.article
                  className="process-step"
                  key={title}
                  initial={{ opacity: 0, y: 50 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.65, delay: index * 0.14, ease: [0.25, 0.46, 0.45, 0.94] }}
                  whileHover={{ y: -8 }}
                >
                  <div className="step-icon">
                    <Icon name={icon as IconName} />
                    <span>0{index + 1}</span>
                  </div>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <section className="section page-shell" id="engineers">
          <div className="section-heading">
            <div>
              <p className="eyebrow">
                <span />
                The people behind the sound
              </p>
              <motion.h2 {...revealProps()}>Engineers who listen first.</motion.h2>
            </div>
            <motion.p {...revealProps(0.15)}>
              Select a specialist or let us match you with the best engineer for
              your sound and session.
            </motion.p>
          </div>
          <div className="engineers-grid">
            {engineers.map((engineer, index) => (
              <motion.article
                className="engineer-card"
                key={engineer.name}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.65, delay: index * 0.12, ease: [0.25, 0.46, 0.45, 0.94] }}
                whileHover={{ y: -10 }}
              >
                <div className="engineer-card__image">
                  <img
                    src={engineer.image}
                    alt={`${engineer.name}, audio engineer`}
                  />
                  <span>0{index + 1}</span>
                </div>
                <div className="engineer-card__content">
                  <div>
                    <h3>{engineer.name}</h3>
                    <p>{engineer.specialty}</p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Book a session with ${engineer.name}`}
                    onClick={() => choosePackage(selectedPackage)}
                  >
                    <Icon name="arrow" />
                  </button>
                </div>
              </motion.article>
            ))}
          </div>
        </section>

        <section className="booking-section" id="book">
          <div className="page-shell booking-grid">
            <div>
              <p className="eyebrow">
                <span />
                Start your session
              </p>
              <motion.h2 {...revealProps()}>Ready when you are.</motion.h2>
              <motion.p className="booking-copy" {...revealProps(0.12)}>
                Tell us what you&apos;re working on. Our studio manager will get
                back to you within one business day with availability and next
                steps.
              </motion.p>
              <div className="booking-contact">
                <span>Prefer to talk?</span>
                <a href="tel:+27601682299">+27 60 168 2299</a>
                <a href="mailto:AKTMEDIAOFFICIAL@GMAIL.COM">AKTMEDIAOFFICIAL@GMAIL.COM</a>
              </div>
            </div>

            {submitted ? (
              <div className="success-card" role="status">
                <span>Request received</span>
                <h3>Your next record starts here.</h3>
                <p>
                  Thanks for reaching out. We&apos;ll be in touch shortly to
                  confirm availability and session details.
                </p>
                <button type="button" onClick={() => setSubmitted(false)}>
                  Send another request
                </button>
              </div>
            ) : (
              <motion.form
                className="booking-form"
                onSubmit={submitBooking}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
              >
                <label>
                  Your name
                  <input
                    name="name"
                    type="text"
                    placeholder="Alex Morgan"
                    required
                  />
                </label>
                <label>
                  Email address
                  <input
                    name="email"
                    type="email"
                    placeholder="alex@example.com"
                    required
                  />
                </label>
                <label>
                  Package
                  <select
                    name="package"
                    value={selectedPackage}
                    onChange={(event) => setSelectedPackage(event.target.value)}
                  >
                    {packages.map((servicePackage) => (
                      <option key={servicePackage.name}>
                        {servicePackage.name}
                      </option>
                    ))}
                  </select>
                </label>
                  <label>
                    Preferred date & time
                    <DateTimePicker value={bookingDate} onChange={setBookingDate} />
                  </label>
                <label className="col-span-full">
                  Tell us about the project
                  <textarea
                    name="message"
                    rows={4}
                    placeholder="What are you making, and what do you need?"
                  />
                </label>
                <button
                  className="button col-span-full justify-center"
                  type="submit"
                >
                  Request a session <Icon name="arrow" />
                </button>
              </motion.form>
            )}
          </div>
        </section>

        <section className="location-section" id="location">
          <div className="page-shell">
            <div className="location-heading">
              <p className="eyebrow">
                <span />
                Studio location
              </p>
              <motion.h2 {...revealProps()}>Find your way to the sound.</motion.h2>
            </div>

            <div className="location-grid">
              <motion.a
                className="map-card"
                href="https://maps.app.goo.gl/9f8L72TowPyLezu28"
                target="_blank"
                rel="noreferrer"
                aria-label="Open AKT Sound Studio in Google Maps"
                initial={{ opacity: 0, x: -50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.9, ease: [0.25, 0.46, 0.45, 0.94] }}
              >
                <iframe
                  className="map-iframe"
                  title="AKT Media Productions Location"
                  src="https://maps.google.com/maps?q=East%20London%2C%20South%20Africa&t=&z=14&ie=UTF8&iwloc=&output=embed"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
                <div className="map-overlay" aria-hidden="true" />
                <div className="map-grid" aria-hidden="true" />
                <span className="map-road map-road--one" aria-hidden="true" />
                <span className="map-road map-road--two" aria-hidden="true" />
                <span className="map-road map-road--three" aria-hidden="true" />
                <div className="map-pin-wrap">
                  <span className="map-pulse" aria-hidden="true" />
                  <span className="map-pin" aria-hidden="true">
                    <span />
                  </span>
                  <div className="map-label">
                    <strong>AKT Sound Studio</strong>
                    <span>Click to open in Google Maps</span>
                  </div>
                </div>
                <span className="map-coordinates">East London, South Africa</span>
              </motion.a>

              <motion.article
                className="location-card"
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.9, delay: 0.12, ease: [0.25, 0.46, 0.45, 0.94] }}
              >
                <span className="location-card__tag">Main studio</span>
                <h3>HQ &amp; Control Room</h3>
                <div className="location-meta">
                  <div>
                    <span>Region</span>
                     <strong>East London, South Africa</strong>
                  </div>
                  <div>
                    <span>Operating hours</span>
                    <strong>Mon–Fri · 09:00–20:00</strong>
                    <strong>Sat · 10:00–18:00</strong>
                    <strong>Sun · By appointment</strong>
                  </div>
                </div>
                <div className="location-meta" style={{ marginTop: '1rem' }}>
                  <div>
                    <span>Email</span>
                    <a href="mailto:AKTMEDIAOFFICIAL@GMAIL.COM"><strong>AKTMEDIAOFFICIAL@GMAIL.COM</strong></a>
                  </div>
                </div>
                <a
                  className="location-button"
                  href="https://maps.app.goo.gl/9f8L72TowPyLezu28"
                  target="_blank"
                  rel="noreferrer"
                >
                  Get Directions on Google Maps
                  <Icon name="arrow" />
                </a>
                <div className="share-section" style={{ marginTop: '1.5rem' }}>
                  <div className="location-card" style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.08)', padding: '1.5rem', minHeight: 0, gap: '1.5rem' }}>
                    <div>
                      <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem' }}>Profile</h3>
                      <div
                        ref={shareBtnContainerRef}
                        className={`share-btn-container${shareActive ? " active" : ""}`}
                        style={{ margin: '3rem auto' }}
                      >
                        <button
                          className="share-btn"
                          type="button"
                          aria-expanded={shareActive}
                          onClick={(e) => { e.stopPropagation(); setShareActive(!shareActive) }}
                        >
                          PROFILE
                        </button>
                        <div className="icons">
                          {[
                            { href: "https://www.instagram.com/akt_media_productions/", icon: "fa-brands fa-instagram", color: "#E1306C", label: "Instagram" },
                            { href: "https://www.tiktok.com/@akt.media.product", icon: "fa-brands fa-tiktok", color: "#000000", label: "TikTok" },
                            { href: "https://www.youtube.com/@akt_media_productions", icon: "fa-brands fa-youtube", color: "#FF0000", label: "YouTube" },
                            { href: "https://x.com/AKTMEDIAPROD", icon: "fa-brands fa-x-twitter", color: "#000000", label: "X" },
                            { href: "https://wa.me/27601682299", icon: "fa-brands fa-whatsapp", color: "#25D366", label: "WhatsApp" },
                            { href: "mailto:aktmediaofficial@gmail.com", icon: "fa-solid fa-envelope", color: "#EA4335", label: "Email" },
                          ].map((item, i) => (
                            <a
                              key={item.label}
                              className="icon"
                              href={item.href}
                              target={item.href.startsWith("http") ? "_blank" : undefined}
                              rel="noopener noreferrer"
                              aria-label={item.label}
                              title={item.label}
                              style={{ "--i": i, "--color": item.color } as React.CSSProperties}
                            >
                              <i className={item.icon}></i>
                            </a>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div>
                      <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem' }}>Sample</h3>
                      <a href="/sample.html" target="_blank" rel="noopener noreferrer" className="sample-link">
                        <span className="sample-link__disc">
                          <img src={LOGO} alt="" />
                        </span>
                        <span>Listen to samples</span>
                      </a>
                    </div>
                  </div>
                </div>
              </motion.article>
            </div>
          </div>
        </section>
      </main>

      <footer id="contact">
        <div className="page-shell">
          <div className="footer-top">
            <a className="brand" href="#top" aria-label="AKT Media Productions home">
              <img src={LOGO} alt="AKT Media Productions" />
            </a>
            <p>Make it loud. Make it honest. Make it here.</p>
          </div>
          <div className="footer-bottom">
            <p>South Africa</p>
            <div>
            </div>
            <p>© 2026 AKT Media Productions</p>
          </div>
        </div>
      </footer>
    </div>
    </MotionConfig>
  )
}
