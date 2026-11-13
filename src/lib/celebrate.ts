import confetti from 'canvas-confetti'

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Short buzz on devices that support it (Android). Silently ignored elsewhere (iOS). */
export function buzz(pattern: number | number[] = 40) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    /* not supported */
  }
}

/** Small burst for an all-time PR. */
export function celebratePR() {
  buzz([30, 40, 60])
  if (reducedMotion()) return
  void confetti({
    particleCount: 60,
    spread: 70,
    startVelocity: 35,
    origin: { y: 0.25 },
    colors: ['#536dfe', '#7d90ff', '#f0c35a', '#ffffff'],
    disableForReducedMotion: true,
  })
}

/** Big two-sided celebration for milestones and workout summaries with PRs. */
export function celebrateBig() {
  buzz([60, 50, 60, 50, 120])
  if (reducedMotion()) return
  const end = Date.now() + 900
  const colors = ['#536dfe', '#7d90ff', '#f0c35a', '#ffffff']
  const frame = () => {
    void confetti({ particleCount: 4, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors, disableForReducedMotion: true })
    void confetti({ particleCount: 4, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors, disableForReducedMotion: true })
    if (Date.now() < end) requestAnimationFrame(frame)
  }
  frame()
}
