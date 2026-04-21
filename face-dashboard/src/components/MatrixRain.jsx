import { useEffect, useRef } from 'react'

const CHARS = '01アイウエオカキクケコサシスセソタチ認識生体システム制御監視110100110101'

export default function MatrixRain() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    const FONT_SIZE = 12
    let cols, drops, animId

    const resize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
      cols  = Math.floor(canvas.width / FONT_SIZE)
      drops = Array.from({ length: cols }, () => Math.random() * -(canvas.height / FONT_SIZE))
    }
    resize()
    window.addEventListener('resize', resize)

    // Vary speed per column
    const speeds = Array.from({ length: 2000 }, () => 0.2 + Math.random() * 0.5)

    let last = 0
    const FPS = 20

    const draw = (ts) => {
      animId = requestAnimationFrame(draw)
      if (ts - last < 1000 / FPS) return
      last = ts

      // Fade trail
      ctx.fillStyle = 'rgba(2, 5, 7, 0.08)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.font = `${FONT_SIZE}px "Space Mono", monospace`

      for (let i = 0; i < cols; i++) {
        const y = drops[i] * FONT_SIZE
        if (y < 0) { drops[i] += speeds[i]; continue }

        const char = CHARS[Math.floor(Math.random() * CHARS.length)]

        // Bright head
        ctx.fillStyle = `rgba(0, 229, 255, 0.9)`
        ctx.fillText(char, i * FONT_SIZE, y)

        // Fading body — render a couple rows behind
        ctx.fillStyle = `rgba(0, 180, 220, 0.35)`
        ctx.fillText(CHARS[Math.floor(Math.random() * CHARS.length)], i * FONT_SIZE, y - FONT_SIZE)

        ctx.fillStyle = `rgba(0, 100, 140, 0.15)`
        ctx.fillText(CHARS[Math.floor(Math.random() * CHARS.length)], i * FONT_SIZE, y - FONT_SIZE * 2)

        // Reset column
        if (y > canvas.height && Math.random() > 0.975) {
          drops[i] = -Math.random() * 20
        }
        drops[i] += speeds[i]
      }
    }

    animId = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0, left: 0,
        width: '100%', height: '100%',
        opacity: 0.055,
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  )
}
