"use client"

import { useEffect, useRef } from "react"

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  opacity: number
  fadeDirection: number
  color: string
  type: "fur" | "snow"
  windOffset: number
  life: number
}

export default function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const animationRef = useRef<number>()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const resizeCanvas = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    const createParticles = () => {
      const particles: Particle[] = []
      const particleCount = Math.floor((canvas.width * canvas.height) / 12000) // More particles for richer effect

      for (let i = 0; i < particleCount; i++) {
        const type = Math.random() > 0.6 ? "fur" : "snow"
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.3, // Gentler horizontal drift
          vy: (Math.random() - 0.5) * 0.2, // Gentler vertical drift
          size: type === "fur" ? Math.random() * 2 + 0.5 : Math.random() * 3 + 1,
          opacity: Math.random() * 0.6 + 0.2,
          fadeDirection: Math.random() > 0.5 ? 1 : -1,
          color:
            type === "fur"
              ? Math.random() > 0.5
                ? "rgba(220, 220, 220, 1)"
                : "rgba(255, 255, 255, 1)"
              : // Fur particles - silver/white
                Math.random() > 0.7
                ? "rgba(192, 192, 192, 1)"
                : "rgba(255, 255, 255, 1)", // Snow particles - more white
          type,
          windOffset: Math.random() * Math.PI * 2,
          life: Math.random() * 1000 + 500,
        })
      }

      particlesRef.current = particles
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const time = Date.now() * 0.001

      particlesRef.current.forEach((particle, index) => {
        const windX = Math.sin(time * 0.5 + particle.windOffset) * 0.15
        const windY = Math.cos(time * 0.3 + particle.windOffset * 1.5) * 0.1
        const microWind = Math.sin(time * 2 + particle.x * 0.01) * 0.05

        particle.x += particle.vx + windX + microWind
        particle.y += particle.vy + windY

        const breathingRate = particle.type === "fur" ? 0.003 : 0.005
        particle.opacity += particle.fadeDirection * breathingRate
        if (particle.opacity <= 0.1 || particle.opacity >= (particle.type === "fur" ? 0.7 : 0.9)) {
          particle.fadeDirection *= -1
        }

        particle.life -= 1
        if (particle.life <= 0) {
          particle.x = Math.random() * canvas.width
          particle.y = Math.random() * canvas.height
          particle.life = Math.random() * 1000 + 500
          particle.opacity = Math.random() * 0.6 + 0.2
        }

        // Wrap around screen edges with smooth transition
        if (particle.x < -10) particle.x = canvas.width + 10
        if (particle.x > canvas.width + 10) particle.x = -10
        if (particle.y < -10) particle.y = canvas.height + 10
        if (particle.y > canvas.height + 10) particle.y = -10

        ctx.save()
        ctx.globalAlpha = particle.opacity

        if (particle.type === "fur") {
          // Fur particles - softer, more diffuse glow
          const gradient = ctx.createRadialGradient(
            particle.x,
            particle.y,
            0,
            particle.x,
            particle.y,
            particle.size + 3,
          )
          gradient.addColorStop(0, `rgba(255, 255, 255, ${particle.opacity})`)
          gradient.addColorStop(0.5, `rgba(220, 220, 220, ${particle.opacity * 0.5})`)
          gradient.addColorStop(1, `rgba(192, 192, 192, 0)`)

          ctx.beginPath()
          ctx.arc(particle.x, particle.y, particle.size + 2, 0, Math.PI * 2)
          ctx.fillStyle = gradient
          ctx.fill()
        } else {
          // Snow particles - sharper, more crystalline
          ctx.shadowBlur = 4
          ctx.shadowColor = `rgba(255, 255, 255, ${particle.opacity * 0.5})`

          ctx.beginPath()
          ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(255, 255, 255, ${particle.opacity})`
          ctx.fill()
        }

        ctx.restore()
      })

      animationRef.current = requestAnimationFrame(animate)
    }

    resizeCanvas()
    createParticles()
    animate()

    const handleResize = () => {
      resizeCanvas()
      createParticles()
    }

    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])

  return (
    <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0" style={{ background: "transparent" }} />
  )
}
