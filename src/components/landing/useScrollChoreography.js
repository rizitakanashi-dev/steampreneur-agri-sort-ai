import { useEffect, useRef, useState } from 'react'

/**
 * Updates global CSS custom properties `--agri-scroll-y` and `--agri-scroll-scale`
 * using requestAnimationFrame (passive scroll listener, zero React re-renders per frame).
 */
export function useScrollParallaxVar() {
  const containerRef = useRef(null)

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const prefersReduced =
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) return undefined

    let rafId = null
    const updateScroll = () => {
      if (containerRef.current) {
        containerRef.current.style.setProperty('--agri-scroll-y', `${window.scrollY.toFixed(1)}px`)
      }
      const docHeight = document.documentElement.scrollHeight - window.innerHeight
      const progress = docHeight > 0 ? Math.min(1, Math.max(0, window.scrollY / docHeight)) : 0
      document.documentElement.style.setProperty('--agri-scroll-scale', progress.toFixed(4))
      rafId = null
    }

    const onScroll = () => {
      if (rafId === null) {
        rafId = window.requestAnimationFrame(updateScroll)
      }
    }

    updateScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (rafId !== null) window.cancelAnimationFrame(rafId)
    }
  }, [])

  return containerRef
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
    const updateConvergence = () => {
      // Complete the convergence over the first 420px of natural page scroll
      const convergeDistance = Math.min(440, Math.max(300, window.innerHeight * 0.48))
      const rawP = Math.min(1, Math.max(0, window.scrollY / convergeDistance))
      // Smooth cubic ease-out so cards glide naturally downward into the Dashboard stage below
      const easedP = 1 - Math.pow(1 - rawP, 2.5)
      const scatterInv = 1 - easedP

      // Dashboard window shell (frame, sidebar, topbar, live YOLO scan strip) materializes smoothly
      const shellOpacity = Math.max(0, Math.min(1, (rawP - 0.15) / 0.68))

      node.style.setProperty('--converge-p', easedP.toFixed(4))
      node.style.setProperty('--scatter-inv', scatterInv.toFixed(4))
      node.style.setProperty('--shell-opacity', shellOpacity.toFixed(4))

      setIsConverged((prev) => {
        const next = rawP > 0.5
        return prev !== next ? next : prev
      })
      rafId = null
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
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return undefined

    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter(Boolean)

    if (elements.length === 0) return undefined

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        if (visible.length > 0 && visible[0].target?.id) {
          setActiveId(visible[0].target.id)
        }
      },
      {
        rootMargin: '-20% 0px -55% 0px',
        threshold: [0.1, 0.25, 0.5],
      }
    )

    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
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
        }
      },
      { threshold: 0.14, rootMargin: '0px 0px -6% 0px' }
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return [ref, revealed]
}
