// Pure drawing for the venue TV scenes. Every frame is computed from the time
// `t` (seconds since the scene mounted), never from state carried between
// frames, so motion stays smooth and identical however the TV schedules frames.

export const AZURE = "#00b7ff"
export const NAVY = "#07111d"

const AZURE_RGB = "0, 183, 255"

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let r = Math.imul(a ^ (a >>> 15), 1 | a)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

/** Damped spring kick: 1 at age 0, settling to 0 with a small overshoot. */
function kick(age: number, freq = 9, damping = 5) {
  if (age < 0) return 0
  return Math.exp(-age * damping) * Math.cos(age * freq)
}

/** Triangle wave between 0 and L: position of something bouncing off walls. */
function bounce(u: number, L: number) {
  const m = ((u % (2 * L)) + 2 * L) % (2 * L)
  return m <= L ? m : 2 * L - m
}

function drawRipple(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  age: number,
  scale: number,
  strength = 1,
) {
  if (age < 0 || age > 1.6) return
  const radius = scale * (0.02 + age * 0.22)
  const alpha = 0.55 * strength * Math.exp(-age * 2.6)
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.strokeStyle = `rgba(${AZURE_RGB}, ${alpha})`
  ctx.lineWidth = Math.max(1.5, scale * 0.003)
  ctx.stroke()
}

function drawBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  ctx.fillStyle = NAVY
  ctx.fillRect(0, 0, w, h)
  // One slow azure glow drifting in a wide loop: depth without decoration.
  const gx = w * (0.5 + 0.28 * Math.sin(t * 0.07))
  const gy = h * (0.45 + 0.18 * Math.cos(t * 0.05))
  const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.max(w, h) * 0.6)
  glow.addColorStop(0, `rgba(${AZURE_RGB}, 0.10)`)
  glow.addColorStop(1, `rgba(${AZURE_RGB}, 0)`)
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, w, h)
}

/**
 * Idle: the PlayTT mark drifts and bounces off the screen edges, like the old
 * DVD screensaver. Each wall hit sends a ripple; a corner hit sends a big one.
 */
export function drawIdle(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  mark: HTMLImageElement | null,
) {
  drawBackdrop(ctx, w, h, t)

  const logoW = Math.min(w * 0.22, 420)
  const logoH = logoW * (200 / 270)
  const Lx = w - logoW
  const Ly = h - logoH
  // Speeds chosen so corners line up every few minutes, not every pass.
  const vx = w * 0.085
  const vy = w * 0.061
  const x0 = Lx * 0.31
  const y0 = Ly * 0.17

  const posAt = (time: number) => ({
    x: bounce(x0 + vx * time, Lx),
    y: bounce(y0 + vy * time, Ly),
  })

  // Time of the most recent hit on each axis (a hit = crossing a multiple of L).
  const lastHit = (start: number, v: number, L: number) => {
    const n = Math.floor((start + v * t) / L)
    if (n <= 0) return { age: Infinity, time: -Infinity, n }
    const time = (n * L - start) / v
    return { age: t - time, time, n }
  }
  const hx = lastHit(x0, vx, Lx)
  const hy = lastHit(y0, vy, Ly)

  // Soft trail behind the mark.
  for (let i = 10; i >= 1; i -= 1) {
    const p = posAt(t - i * 0.06)
    ctx.globalAlpha = 0.035 * (11 - i)
    ctx.beginPath()
    ctx.arc(p.x + logoW * 0.86, p.y + logoH * 0.245, logoW * 0.05, 0, Math.PI * 2)
    ctx.fillStyle = AZURE
    ctx.fill()
  }
  ctx.globalAlpha = 1

  const isCorner = Math.abs(hx.time - hy.time) < 0.18 && Math.min(hx.age, hy.age) < 3
  for (const hit of [hx, hy]) {
    if (!Number.isFinite(hit.age)) continue
    const p = posAt(hit.time)
    const isX = hit === hx
    const atMax = hit.n % 2 === 1
    const cx = isX ? (atMax ? w : 0) : p.x + logoW / 2
    const cy = isX ? p.y + logoH / 2 : atMax ? h : 0
    drawRipple(ctx, cx, cy, hit.age, Math.max(w, h), isCorner ? 2.2 : 1)
    if (isCorner) drawRipple(ctx, cx, cy, hit.age - 0.18, Math.max(w, h), 1.4)
  }

  const p = posAt(t)
  const hitAge = Math.min(hx.age, hy.age)
  const squash = 0.06 * kick(hitAge, 14, 6)
  const sx = 1 + squash
  const sy = 1 - squash

  ctx.save()
  ctx.translate(p.x + logoW / 2, p.y + logoH / 2)
  ctx.scale(sx, sy)
  ctx.shadowColor = `rgba(${AZURE_RGB}, ${0.35 + 0.45 * Math.max(0, kick(hitAge, 0, 2.4))})`
  ctx.shadowBlur = logoW * 0.18
  if (mark) {
    ctx.drawImage(mark, -logoW / 2, -logoH / 2, logoW, logoH)
  }
  ctx.restore()

  return { cornerAge: isCorner ? Math.min(hx.age, hy.age) : Infinity }
}

type RallyGeometry = {
  tableY: number
  left: number
  right: number
  net: number
  ballR: number
  unit: number
}

function rallyGeometry(w: number, h: number): RallyGeometry {
  return {
    tableY: h * 0.8,
    left: w * 0.1,
    right: w * 0.9,
    net: w * 0.5,
    ballR: Math.max(6, Math.min(w, h) * 0.014),
    unit: h,
  }
}

/** One crossing of the ball, seeded so every rally varies a little. */
function crossing(k: number) {
  const rand = mulberry32(k * 7919 + 13)
  return {
    bounceAt: 0.62 + rand() * 0.1,
    startH: 0.1 + rand() * 0.05,
    arc1: 0.2 + rand() * 0.12,
    endH: 0.12 + rand() * 0.06,
    arc2: 0.12 + rand() * 0.08,
  }
}

const HALF_RALLY_S = 1.25

function ballAt(t: number, g: RallyGeometry) {
  const u = t / HALF_RALLY_S
  const k = Math.floor(u)
  const f = u - k
  const c = crossing(k)
  const leftToRight = k % 2 === 0
  const from = leftToRight ? g.left : g.right
  const to = leftToRight ? g.right : g.left
  const x = from + (to - from) * f
  let height: number
  if (f < c.bounceAt) {
    const s = f / c.bounceAt
    height = c.startH * (1 - s) + 4 * c.arc1 * s * (1 - s)
  } else {
    const s = (f - c.bounceAt) / (1 - c.bounceAt)
    height = c.endH * s + 4 * c.arc2 * s * (1 - s)
  }
  return {
    x,
    y: g.tableY - g.ballR - height * g.unit * 0.55,
    k,
    f,
    c,
    leftToRight,
  }
}

function drawPaddle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  facingRight: boolean,
  hitAge: number,
) {
  const tilt = (facingRight ? -1 : 1) * (0.35 + 0.4 * kick(hitAge, 10, 5))
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(tilt)
  ctx.fillStyle = "#0b1627"
  ctx.strokeStyle = AZURE
  ctx.lineWidth = Math.max(2, size * 0.07)
  ctx.beginPath()
  ctx.ellipse(0, 0, size * 0.42, size * 0.5, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(0, size * 0.5)
  ctx.lineTo(0, size * 0.95)
  ctx.lineCap = "round"
  ctx.lineWidth = size * 0.16
  ctx.stroke()
  ctx.restore()
}

/**
 * Session: a calm rally across a side-view table. The ball arcs, lands on the
 * far side with a ripple, and each paddle kicks on contact.
 */
export function drawRally(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  progress: number,
) {
  drawBackdrop(ctx, w, h, t)
  const g = rallyGeometry(w, h)

  // Table surface with a soft reflection, net, and legs.
  const surface = ctx.createLinearGradient(0, g.tableY, 0, g.tableY + h * 0.12)
  surface.addColorStop(0, `rgba(${AZURE_RGB}, 0.16)`)
  surface.addColorStop(1, `rgba(${AZURE_RGB}, 0)`)
  ctx.fillStyle = surface
  ctx.fillRect(g.left, g.tableY, g.right - g.left, h * 0.12)

  ctx.strokeStyle = `rgba(${AZURE_RGB}, 0.9)`
  ctx.lineWidth = Math.max(2, h * 0.004)
  ctx.beginPath()
  ctx.moveTo(g.left, g.tableY)
  ctx.lineTo(g.right, g.tableY)
  ctx.stroke()

  // Session progress fills the table edge from the left.
  ctx.strokeStyle = AZURE
  ctx.lineWidth = Math.max(3, h * 0.008)
  ctx.beginPath()
  ctx.moveTo(g.left, g.tableY + h * 0.008)
  ctx.lineTo(g.left + (g.right - g.left) * Math.min(1, Math.max(0, progress)), g.tableY + h * 0.008)
  ctx.stroke()

  ctx.strokeStyle = "rgba(146, 166, 191, 0.55)"
  ctx.lineWidth = Math.max(2, h * 0.003)
  ctx.beginPath()
  ctx.moveTo(g.net, g.tableY)
  ctx.lineTo(g.net, g.tableY - h * 0.06)
  ctx.moveTo(g.left + w * 0.04, g.tableY)
  ctx.lineTo(g.left + w * 0.02, h)
  ctx.moveTo(g.right - w * 0.04, g.tableY)
  ctx.lineTo(g.right - w * 0.02, h)
  ctx.stroke()

  const ball = ballAt(t, g)

  // Landing ripple on the table.
  const bounceTime = (ball.k + ball.c.bounceAt) * HALF_RALLY_S
  const prev = crossing(ball.k - 1)
  const prevBounceTime = (ball.k - 1 + prev.bounceAt) * HALF_RALLY_S
  for (const [time, kIndex, c] of [
    [bounceTime, ball.k, ball.c],
    [prevBounceTime, ball.k - 1, prev],
  ] as const) {
    const age = t - time
    if (age < 0) continue
    const ltr = kIndex % 2 === 0
    const bx = ltr
      ? g.left + (g.right - g.left) * c.bounceAt
      : g.right - (g.right - g.left) * c.bounceAt
    ctx.save()
    ctx.translate(bx, g.tableY)
    ctx.scale(1, 0.22)
    drawRipple(ctx, 0, 0, age, Math.max(w, h) * 0.6)
    ctx.restore()
  }

  // Paddles follow the ball's height on their side and kick on contact.
  const paddleSize = h * 0.11
  const lastHitTime = ball.k * HALF_RALLY_S
  const hitAge = t - lastHitTime
  // Each paddle glides between the heights of its previous and next hit.
  const paddleY = (offset: number) => {
    const span = 2 * HALF_RALLY_S
    const prevHit = Math.floor((t - offset) / span) * span + offset
    const s = (t - prevHit) / span
    const eased = s < 0.5 ? 4 * s * s * s : 1 - Math.pow(-2 * s + 2, 3) / 2
    const a = ballAt(prevHit + 1e-6, g).y
    const b = ballAt(prevHit + span + 1e-6, g).y
    return a + (b - a) * eased
  }
  const leftY = paddleY(0)
  const rightY = paddleY(HALF_RALLY_S)
  drawPaddle(ctx, g.left - paddleSize * 0.55, leftY, paddleSize, true, ball.leftToRight ? hitAge : Infinity)
  drawPaddle(ctx, g.right + paddleSize * 0.55, rightY, paddleSize, false, ball.leftToRight ? Infinity : hitAge)

  // Ball with a short motion trail.
  for (let i = 6; i >= 1; i -= 1) {
    const p = ballAt(t - i * 0.022, g)
    ctx.globalAlpha = 0.07 * (7 - i)
    ctx.beginPath()
    ctx.arc(p.x, p.y, g.ballR, 0, Math.PI * 2)
    ctx.fillStyle = AZURE
    ctx.fill()
  }
  ctx.globalAlpha = 1
  ctx.save()
  ctx.shadowColor = `rgba(${AZURE_RGB}, 0.8)`
  ctx.shadowBlur = g.ballR * 3
  ctx.beginPath()
  ctx.arc(ball.x, ball.y, g.ballR, 0, Math.PI * 2)
  ctx.fillStyle = "#e8f7ff"
  ctx.fill()
  ctx.restore()
}

/**
 * Up next: a ball tapping on a paddle while the table gets ready, each tap a
 * little ripple. Calm, with a beat every second like a countdown.
 */
export function drawWarmup(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  drawBackdrop(ctx, w, h, t)
  const cx = w * 0.76
  const baseY = h * 0.68
  const r = Math.max(8, Math.min(w, h) * 0.02)
  const period = 1
  const f = (t % period) / period
  const height = h * 0.26 * 4 * f * (1 - f)
  const age = (t % period)

  // Paddle seen edge-on, face up, dipping a touch on each tap.
  const size = h * 0.16
  const dip = h * 0.012 * Math.max(0, kick(age, 14, 8))
  ctx.save()
  ctx.translate(cx, baseY + r + dip)
  ctx.rotate(-0.04 + 0.05 * kick(age, 14, 8))
  ctx.strokeStyle = AZURE
  ctx.lineCap = "round"
  ctx.lineWidth = Math.max(4, size * 0.09)
  ctx.beginPath()
  ctx.moveTo(-size * 0.5, size * 0.04)
  ctx.lineTo(size * 0.5, size * 0.04)
  ctx.stroke()
  ctx.lineWidth = Math.max(5, size * 0.12)
  ctx.beginPath()
  ctx.moveTo(size * 0.55, size * 0.06)
  ctx.lineTo(size * 0.95, size * 0.16)
  ctx.stroke()
  ctx.restore()

  ctx.save()
  ctx.translate(cx, baseY + r)
  ctx.scale(1, 0.25)
  drawRipple(ctx, 0, 0, age, Math.max(w, h) * 0.5)
  ctx.restore()

  const squash = 0.25 * kick(age, 18, 9)
  ctx.save()
  ctx.translate(cx, baseY - height)
  ctx.scale(1 + squash, 1 - squash)
  ctx.shadowColor = `rgba(${AZURE_RGB}, 0.8)`
  ctx.shadowBlur = r * 3
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.fillStyle = "#e8f7ff"
  ctx.fill()
  ctx.restore()
}
