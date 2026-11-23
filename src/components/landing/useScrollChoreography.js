import { useEffect, useRef, useState } from 'react'

/**
 * Lightweight, zero-cascade scroll progress + threshold tracker for the Navbar.
 * Mutates `barRef.current.style.transform` directly (single compositor layer, no root CSS var cascade).
 */
export function useNavbarScrollProgress(barRef) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    let rafId = null
    let lastProgress = -1

    const update = () => {
      const y = window.scrollY
      const nextScrolled = y > 24
      setScrolled((prev) => (prev !== nextScrolled ? nextScrolled : prev))

      const docHeight = document.documentElement.scrollHeight - window.innerHeight
      const progress = docHeight > 0 ? Math.min(1, Math.max(0, y / docHeight)) : 0
      const rounded = Math.round(progress * 1000) / 1000
      if (barRef.current && rounded !== lastProgress) {
        lastProgress = rounded
        barRef.current.style.transform = `scaleX(${rounded})`
      }
      rafId = null
    }

    const onScroll = () => {
      if (rafId === null) {
        rafId = window.requestAnimationFrame(update)
      }
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (rafId !== null) window.cancelAnimationFrame(rafId)
    }
  }, [barRef])

  return scrolled
}

/**
 * Viewport-gated parallax transform on a single card ref.
 * Only runs while the element is visible in the viewport on desktop (`>= 900px`).
 */
export function useParallaxRef(factor = 0) {
  const ref = useRef(null)

  useEffect(() => {
    if (typeof window === 'undefined' || factor === 0) return undefined
    const prefersReduced =
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) return undefined

    const node = ref.current
    if (!node) return undefined

    let isVisible = false
    let rafId = null

    const update = () => {
      rafId = null
      if (!isVisible || window.innerWidth < 900) {
        if (node.style.transform) node.style.transform = ''
        return
      }
      const rect = node.getBoundingClientRect()
      const viewportCenter = window.innerHeight * 0.5
      const cardCenter = rect.top + rect.height * 0.5
      const delta = Math.max(-28, Math.min(28, (cardCenter - viewportCenter) * factor * 2.2))
      node.style.transform = `translate3d(0, ${delta.toFixed(1)}px, 0)`
    }

    const onScroll = () => {
      if (isVisible && rafId === null) {
        rafId = window.requestAnimationFrame(update)
      }
    }

    const observer =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(
            ([entry]) => {
              isVisible = entry.isIntersecting
              if (isVisible && rafId === null) {
                rafId = window.requestAnimationFrame(update)
              }
            },
            { rootMargin: '80px 0px' }
          )
        : null

    if (observer) observer.observe(node)
    else isVisible = true

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      if (observer) observer.disconnect()
      window.removeEventListener('scroll', onScroll)
      if (rafId !== null) window.cancelAnimationFrame(rafId)
    }
  }, [factor])

  return ref
}

/**
 * Drives the Hero-to-Dashboard scroll convergence without trapping scroll:
 * - At `scrollY = 0`: The 4 cards are lifted up and scattered around the Hero headline
 *   (`--scatter-inv = 1`, `--shell-opacity = 0`).
 * - As the user scrolls down (`scrollY: 0 -> ~420px`) toward the open stage below the Hero text:
 *   The 4 cards travel downward & inward (`--scatter-inv: 1 -> 0`) into the full-size
 *   Agri-Sort AI Dashboard Window waiting in the open space below (`--shell-opacity: 0 -> 1`).
 */
export function useHeroConvergenceScroll() {
  const trackRef = useRef(null)
  const [isConverged, setIsConverged] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const node = trackRef.current
    if (!node) return undefined

    let rafId = null
    let lastRawP = -1
    const updateConvergence = () => {
      rafId = null
      // Complete the convergence over the first 420px of natural page scroll
      const convergeDistance = Math.min(440, Math.max(300, window.innerHeight * 0.48))
      const rawP = Math.min(1, Math.max(0, window.scrollY / convergeDistance))
      const quantP = Math.round(rawP * 1000) / 1000
      if (quantP === lastRawP) return
      lastRawP = quantP

      // Smooth cubic ease-out so cards glide naturally downward into the Dashboard stage below
      const easedP = 1 - Math.pow(1 - quantP, 2.5)
      const scatterInv = 1 - easedP

      // Dashboard window shell (frame, sidebar, topbar, live YOLO scan strip) materializes smoothly
      const shellOpacity = Math.max(0, Math.min(1, (quantP - 0.15) / 0.68))

      node.style.setProperty('--converge-p', easedP.toFixed(4))
      node.style.setProperty('--scatter-inv', scatterInv.toFixed(4))
      node.style.setProperty('--shell-opacity', shellOpacity.toFixed(4))

      setIsConverged((prev) => {
        const next = quantP > 0.5
        return prev !== next ? next : prev
      })
    }

    const onScroll = () => {
      if (rafId === null) {
        rafId = window.requestAnimationFrame(updateConvergence)
      }
    }

    updateConvergence()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (rafId !== null) window.cancelAnimationFrame(rafId)
    }
  }, [])

  return [trackRef, isConverged]
}

/**
 * Tracks which section ID is currently in view for navigation highlighting.
 */
export function useActiveSection(sectionIds = []) {
  const [activeId, setActiveId] = useState(sectionIds[0] || 'beranda')

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter(Boolean)

    if (elements.length === 0) return undefined

    let rafId = null

    // Deterministik: section aktif = section terakhir yang titik atasnya
    // sudah melewati garis deteksi (35% tinggi viewport). Tidak bisa "stuck"
    // seperti pendekatan IntersectionObserver yang hanya reaksi event.
    const update = () => {
      rafId = null
      const line = window.innerHeight * 0.35
      let current = elements[0].id
      for (const el of elements) {
        if (el.getBoundingClientRect().top <= line) current = el.id
      }
      setActiveId((prev) => (prev !== current ? current : prev))
    }

    const onScroll = () => {
      if (rafId === null) {
        rafId = window.requestAnimationFrame(update)
      }
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (rafId !== null) window.cancelAnimationFrame(rafId)
    }
  }, [sectionIds])

  return activeId
}

/**
 * Gently elevates and sharpens a stage container when it enters the viewport.
 */
export function useStageReveal() {
  const ref = useRef(null)
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') {
      setRevealed(true)
      return undefined
    }
    const node = ref.current
    if (!node) return undefined

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true)
          observer.disconnect()
        }
      },
      { threshold: 0.14, rootMargin: '0px 0px -6% 0px' }
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return [ref, revealed]
}
