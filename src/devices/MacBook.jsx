import React, { useMemo } from 'react'
import * as THREE from 'three'
import { RoundedBox } from '@react-three/drei'
import { cornerMask } from './screenMask.js'
import Sponsors from '../scene/Sponsors.jsx'

/**
 * MacBook Pro 16" style laptop.
 *
 * Geometry is authored in the source model's own units (body 17.5 wide) and
 * then scaled into the studio's metre-ish space, so the device ends up the same
 * physical size as every other device and existing camera work still frames it.
 */
const BW = 17.5
const BD = 12
const BH = 0.18
const LW = 17.5
const LD = 11.8
const LH = 0.12
/**
 * Heights of the things stacked on the keyboard deck, in author units.
 *
 * The deck is a 0.008-thick slab centred 0.002 above the base, so its top face
 * is at BASE_TOP + 0.006. Anything resting on the deck has to be above that
 * and above each other, and the separations are tiny once the model is scaled
 * by ~0.019 — which is exactly why two of them landing on the same number is
 * not obvious in the source and very obvious on screen.
 */
const DECK_TOP_OFF = 0.006
const GRILL_OFF = 0.012 // was DECK_TOP_OFF, i.e. coplanar with the deck
const CAPS_OFF = 0.010 // above the key tops, which sit at KEY_H + 0.004

const BASE_TOP = BH
const GRILL_Y = BASE_TOP + GRILL_OFF

const SCREEN_W = LW - 0.15 - 0.24
const SCREEN_H = LD - 0.15 - 0.37

/**
 * The lid's front stack, in author units out from the lid's front face at 0.
 *
 * Same trap as the deck, and worse, because the bezel covers the display
 * completely rather than touching it at an edge. These used to be 0.045 (bezel
 * front), 0.048 (display) and 0.051 (glass): 0.003 apart, which after the
 * ~0.019 scale is 5.8e-5 of a world unit.
 *
 * A 24-bit depth buffer over near 0.01 / far 100 resolves about 6e-6·z², so
 * that separation survives a camera a metre out and loses to one three metres
 * out — and it shrinks with the device's own scale on top. What you get when
 * it loses is not a subtle fringe: two quads the size of the whole screen
 * trading pixels, which reads as diagonal banding across the display.
 *
 * Twenty thousandths apart instead of three. That is 0.4mm at the size a
 * 16-inch laptop is actually drawn, so nothing looks different, and it holds
 * up to a camera far enough away that the device is a speck.
 */
const BEZEL_Z = LH / 2 - 0.02 // 0.04 centre, 0.01 thick, so its face is 0.045
const DISPLAY_Z = BEZEL_Z + 0.025
const GLASS_Z = DISPLAY_Z + 0.012
const NOTCH_Z = GLASS_Z + 0.004
const LENS_Z = NOTCH_Z + 0.012

const UNIT = 0.34 / BW // author units -> world units

/**
 * RoundedBoxGeometry inflates badly when the corner radius exceeds half of the
 * smallest dimension — on a thin slab that silently swells the body and can
 * swallow anything sitting on it. Always clamp.
 */
const safeRadius = (dims, r) => Math.min(r, Math.min(...dims) / 2 - 1e-4)

// keyboard grid
const KEY_W = 0.82
const KEY_D = 0.82
const GAP = 0.08
const STEP = KEY_W + GAP
const FN_D = 0.48
const KEY_H = 0.028
const KB_W = 14 * STEP - GAP

const FN_Z = -4.5
const R1_Z = FN_Z + FN_D / 2 + GAP + KEY_D / 2
const R2_Z = R1_Z + STEP
const R3_Z = R2_Z + STEP
const R4_Z = R3_Z + STEP
const R5_Z = R4_Z + STEP

export const macbookMeta = {
  id: 'macbook',
  label: 'MacBook 16"',
  width: BW * UNIT, // world units across, used to space a family shot
  screenAspect: SCREEN_W / SCREEN_H,
  hinge: [0, BH * UNIT, (-BD / 2) * UNIT],
  frame: { d: 0.88, ty: 0.12, fov: 34 },
}

/** Builds the full key layout once: one entry per physical key. */
function buildKeyLayout() {
  const keys = []

  const row = (z, d, labels, widths) => {
    const totalW = widths.reduce((a, b) => a + b, 0) * STEP - GAP
    let x = -totalW / 2
    labels.forEach((label, i) => {
      const w = widths[i] * STEP - GAP
      keys.push({ x: x + w / 2, z, w, d, label })
      x += widths[i] * STEP
    })
  }

  const ones = (n) => Array(n).fill(1)

  row(FN_Z, FN_D, ['esc','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12','⏻'], ones(14))
  row(R1_Z, KEY_D, ['`','1','2','3','4','5','6','7','8','9','0','-','=','⌫'], ones(14))
  row(R2_Z, KEY_D, ['⇥','Q','W','E','R','T','Y','U','I','O','P','[',']','\\'],
    [1.4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0.6])
  row(R3_Z, KEY_D, ['⇪','A','S','D','F','G','H','J','K','L',';',"'",'↵'],
    [1.7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.3])
  row(R4_Z, KEY_D, ['⇧','Z','X','C','V','B','N','M',',','.','/','⇧'],
    [2.1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.9])

  // Bottom row is laid out left to right so the modifiers, space bar and the
  // inverted-T arrow cluster all fit inside the keyboard width.
  let x = -KB_W / 2
  const push = (units, label, d = KEY_D, zOff = 0) => {
    const w = units * STEP - GAP
    keys.push({ x: x + w / 2, z: R5_Z + zOff, w, d, label })
    x += units * STEP
  }
  push(1, 'fn'); push(1, '⌃'); push(1, '⌥'); push(1.2, '⌘')

  const spaceUnits = 4.1 / STEP
  push(spaceUnits, '')

  push(1.2, '⌘'); push(1, '⌥')

  const halfD = (KEY_D - GAP) / 2
  const arrowX = x
  keys.push({ x: arrowX + (KEY_W) / 2, z: R5_Z, w: KEY_W, d: KEY_D, label: '←' })
  keys.push({ x: arrowX + STEP + KEY_W / 2, z: R5_Z - KEY_D / 4 - GAP / 4, w: KEY_W, d: halfD, label: '↑' })
  keys.push({ x: arrowX + STEP + KEY_W / 2, z: R5_Z + KEY_D / 4 + GAP / 4, w: KEY_W, d: halfD, label: '↓' })
  keys.push({ x: arrowX + 2 * STEP + KEY_W / 2, z: R5_Z, w: KEY_W, d: KEY_D, label: '→' })

  return keys
}

/**
 * Bakes the key caps into one texture laid over the key bodies — one mesh
 * instead of ~160 — and the labels into a second.
 *
 * The labels are separated out so they can drive an emissive map: a real
 * keyboard is backlit, and without that the deck falls into the lid's shadow in
 * any moody lighting and the whole keyboard reads as a black slab.
 */
function bakeKeycaps(keys, bounds) {
  const PX = 170 // canvas pixels per author unit
  const w = bounds.maxX - bounds.minX
  const d = bounds.maxZ - bounds.minZ
  const c = document.createElement('canvas')
  c.width = Math.round(w * PX)
  c.height = Math.round(d * PX)
  const g = c.getContext('2d')

  const lc = document.createElement('canvas')
  lc.width = c.width
  lc.height = c.height
  const lg = lc.getContext('2d')

  const toX = (x) => (x - bounds.minX) * PX
  const toY = (z) => (z - bounds.minZ) * PX

  keys.forEach((k) => {
    const x0 = toX(k.x - k.w / 2)
    const y0 = toY(k.z - k.d / 2)
    const kw = k.w * PX
    const kh = k.d * PX
    const r = Math.min(kw, kh) * 0.16

    g.save()
    g.beginPath()
    g.roundRect(x0, y0, kw, kh, r)
    g.clip()

    g.fillStyle = '#0c0c0f'
    g.fillRect(x0, y0, kw, kh)

    // concave dish: brighter toward the upper centre, darker at the rim
    const dish = g.createRadialGradient(
      x0 + kw * 0.45, y0 + kh * 0.4, 0,
      x0 + kw * 0.5, y0 + kh * 0.5, Math.max(kw, kh) * 0.58,
    )
    dish.addColorStop(0, 'rgba(150,156,172,0.07)')
    dish.addColorStop(0.5, 'rgba(100,106,122,0.035)')
    dish.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = dish
    g.fillRect(x0, y0, kw, kh)

    const rim = g.createRadialGradient(
      x0 + kw / 2, y0 + kh / 2, Math.min(kw, kh) * 0.3,
      x0 + kw / 2, y0 + kh / 2, Math.max(kw, kh) * 0.58,
    )
    rim.addColorStop(0, 'rgba(0,0,0,0)')
    rim.addColorStop(1, 'rgba(0,0,0,0.38)')
    g.fillStyle = rim
    g.fillRect(x0, y0, kw, kh)
    g.restore()

    // A real key is separated from its neighbours by a shadowed gap, not by
    // being a lighter colour. Without this the block reads as one flat plate.
    g.strokeStyle = 'rgba(0,0,0,0.85)'
    g.lineWidth = Math.max(2, Math.min(kw, kh) * 0.055)
    g.beginPath()
    g.roundRect(x0 + g.lineWidth / 2, y0 + g.lineWidth / 2, kw - g.lineWidth, kh - g.lineWidth, r)
    g.stroke()

    // a thin catch of light along the top edge of the cap
    g.strokeStyle = 'rgba(190,196,210,0.13)'
    g.lineWidth = Math.max(1, Math.min(kw, kh) * 0.025)
    g.beginPath()
    g.moveTo(x0 + r, y0 + g.lineWidth)
    g.lineTo(x0 + kw - r, y0 + g.lineWidth)
    g.stroke()

    if (k.label) {
      const size = k.label.length > 2 ? kh * 0.3 : k.label.length > 1 ? kh * 0.4 : kh * 0.5
      const font = `500 ${size}px Inter, system-ui, -apple-system, sans-serif`
      const cx = x0 + kw / 2
      const cy = y0 + kh / 2 + 1

      g.fillStyle = 'rgba(232,236,245,0.80)'
      g.font = font
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText(k.label, cx, cy)

      // the same glyph again, on its own, to light from behind
      lg.fillStyle = '#ffffff'
      lg.font = font
      lg.textAlign = 'center'
      lg.textBaseline = 'middle'
      // just enough bloom to read as light escaping around the glyph; more
      // than this and every key becomes a blob at shot distance
      lg.shadowColor = 'rgba(255,255,255,0.5)'
      lg.shadowBlur = 1.2
      lg.fillText(k.label, cx, cy)
      lg.shadowBlur = 0
    }
  })

  const mk = (src) => {
    const t = new THREE.CanvasTexture(src)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    return t
  }
  return { caps: mk(c), labels: mk(lc) }
}

/** Perforated speaker grill, baked rather than built from ~140 cylinders. */
function bakeGrill(cols, rows) {
  const cell = 18
  const c = document.createElement('canvas')
  c.width = cols * cell
  c.height = rows * cell
  const g = c.getContext('2d')
  g.fillStyle = '#0e0e10'
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      if ((r + col) % 2 !== 0) continue
      g.beginPath()
      g.arc(col * cell + cell / 2, r * cell + cell / 2, cell * 0.28, 0, Math.PI * 2)
      g.fill()
    }
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

export default function MacBook({ rootRef, lidRef, texture, screenMatRef, material, screen, aspectScale = 1, sponsors = [] }) {
  const keys = useMemo(() => buildKeyLayout(), [])

  const bounds = useMemo(() => {
    const b = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity }
    keys.forEach((k) => {
      b.minX = Math.min(b.minX, k.x - k.w / 2)
      b.maxX = Math.max(b.maxX, k.x + k.w / 2)
      b.minZ = Math.min(b.minZ, k.z - k.d / 2)
      b.maxZ = Math.max(b.maxZ, k.z + k.d / 2)
    })
    return b
  }, [keys])

  const { caps: capTex, labels: labelTex } = useMemo(() => bakeKeycaps(keys, bounds), [keys, bounds])
  const grillTex = useMemo(() => bakeGrill(5, 28), [])

  // One geometry per distinct key footprint, shared across every key that uses it.
  const keyGeometries = useMemo(() => {
    const cache = new Map()
    keys.forEach((k) => {
      const id = `${k.w.toFixed(3)}x${k.d.toFixed(3)}`
      if (!cache.has(id)) cache.set(id, new THREE.BoxGeometry(k.w, KEY_H, k.d))
    })
    return cache
  }, [keys])

  React.useEffect(
    () => () => {
      capTex.dispose()
      labelTex.dispose()
      grillTex.dispose()
      keyGeometries.forEach((g) => g.dispose())
    },
    [capTex, labelTex, grillTex, keyGeometries],
  )

  const mask = useMemo(() => cornerMask(SCREEN_W / SCREEN_H, 0.012), [])

  const screenColor = useMemo(() => {
    const b = screen.brightness
    return new THREE.Color(b, b, b)
  }, [screen.brightness])

  const bodyProps = {
    color: material.bodyColor,
    roughness: material.bodyRoughness,
    metalness: material.bodyMetalness,
  }

  const kbW = bounds.maxX - bounds.minX
  const kbD = bounds.maxZ - bounds.minZ
  const kbCx = (bounds.minX + bounds.maxX) / 2
  const kbCz = (bounds.minZ + bounds.maxZ) / 2

  return (
    <group ref={rootRef} dispose={null}>
      <group scale={UNIT}>
        {/* Adapt scales the whole chassis along its depth, not just the lid —
            otherwise a shortened lid no longer covers the base when closed. */}
        <group scale={[1, 1, aspectScale]}>
        {/* ── base ── */}
        <RoundedBox args={[BW, BH, BD]} radius={safeRadius([BW, BH, BD], 0.12)} smoothness={4} position={[0, BH / 2, 0]} castShadow receiveShadow>
          <meshStandardMaterial {...bodyProps} />
        </RoundedBox>

        {/* recessed keyboard deck. Its top face lands at DECK_TOP; everything
            laid on the deck has to clear that, and clear each other. The grill
            planes used to sit at exactly DECK_TOP and flickered against it
            whenever the camera moved. */}
        <mesh position={[0, BASE_TOP + 0.002, -1.8]} receiveShadow>
          <boxGeometry args={[14.2, 0.008, 5.8]} />
          <meshStandardMaterial color="#0a0a0c" metalness={0.1} roughness={0.92} />
        </mesh>

        {/* speaker grills */}
        {[-7.8, 7.8].map((gx) => (
          <mesh key={gx} position={[gx, GRILL_Y, -1.8]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.9, 4.8]} />
            <meshStandardMaterial map={grillTex} color="#4a4a4e" roughness={0.9} metalness={0.1} />
          </mesh>
        ))}

        {/* Sponsor marks on the palm rest, either side of the trackpad. Editor
            only — see Sponsors.jsx for why they must never reach an export. */}
        <Sponsors
          sponsors={sponsors}
          deck={{ side: 5.9, z: BD / 2 - 2.8, y: BASE_TOP + 0.014 }}
        />

        {/* keys */}
        {keys.map((k, idx) => (
          <mesh
            key={idx}
            geometry={keyGeometries.get(`${k.w.toFixed(3)}x${k.d.toFixed(3)}`)}
            position={[k.x, BASE_TOP + KEY_H / 2 + 0.004, k.z]}
            castShadow
          >
            <meshStandardMaterial color="#0d0d11" metalness={0.06} roughness={0.72} />
          </mesh>
        ))}

        {/* baked key caps, with the glyphs lit from behind */}
        <mesh position={[kbCx, BASE_TOP + KEY_H + CAPS_OFF, kbCz]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[kbW, kbD]} />
          <meshStandardMaterial
            map={capTex}
            transparent
            roughness={0.82}
            metalness={0.05}
            emissive="#eaf2ff"
            emissiveMap={labelTex}
            emissiveIntensity={material.keyBacklight ?? 0.5}
          />
        </mesh>

        {/* Touch ID */}
        <mesh position={[KB_W / 2 + 0.5, BASE_TOP + 0.014, FN_Z]}>
          <cylinderGeometry args={[0.28, 0.28, 0.025, 24]} />
          <meshStandardMaterial color="#1a1a1c" metalness={0.5} roughness={0.4} />
        </mesh>
        <mesh position={[KB_W / 2 + 0.5, BASE_TOP + 0.026, FN_Z]} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.28, 0.015, 8, 24]} />
          <meshStandardMaterial color="#444448" metalness={0.8} roughness={0.2} />
        </mesh>

        {/* trackpad */}
        <RoundedBox
          args={[6.56, 0.005, 4.46]}
          radius={safeRadius([6.56, 0.005, 4.46], 0.1)}
          smoothness={3}
          position={[0, BASE_TOP + 0.006, BD / 2 - 2.8]}
        >
          <meshStandardMaterial color="#666668" metalness={0.6} roughness={0.3} />
        </RoundedBox>
        <RoundedBox
          args={[6.5, 0.012, 4.4]}
          radius={safeRadius([6.5, 0.012, 4.4], 0.08)}
          smoothness={3}
          position={[0, BASE_TOP + 0.01, BD / 2 - 2.8]}
          receiveShadow
        >
          <meshStandardMaterial color="#88888c" metalness={0.7} roughness={0.22} />
        </RoundedBox>

        {/* rubber feet */}
        {[
          [-BW / 2 + 0.7, -BD / 2 + 0.7],
          [BW / 2 - 0.7, -BD / 2 + 0.7],
          [-BW / 2 + 0.7, BD / 2 - 0.7],
          [BW / 2 - 0.7, BD / 2 - 0.7],
        ].map(([fx, fz]) => (
          <mesh key={`${fx}_${fz}`} position={[fx, 0.012, fz]}>
            <cylinderGeometry args={[0.22, 0.22, 0.025, 16]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.95} />
          </mesh>
        ))}

        {/* hinge barrel */}
        <mesh position={[0, BH, -BD / 2]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.08, 0.08, BW - 0.6, 16]} />
          <meshStandardMaterial color="#606065" metalness={0.9} roughness={0.15} />
        </mesh>

        </group>

        {/* ── lid ── */}
        <group ref={lidRef} position={[0, BH, (-BD / 2) * aspectScale]}>
          {/* The lid's length runs along local Y, so it takes the same factor
              here that the base takes on Z. Closed, the two still match. */}
          <group scale={[1, aspectScale, 1]}>
          <RoundedBox
            args={[LW, LD, LH]}
            radius={safeRadius([LW, LD, LH], 0.1)}
            smoothness={4}
            position={[0, LD / 2, -LH / 2]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial {...bodyProps} />
          </RoundedBox>

          {/* bezel */}
          <RoundedBox
            args={[LW - 0.15, LD - 0.15, 0.01]}
            radius={safeRadius([LW - 0.15, LD - 0.15, 0.01], 0.08)}
            smoothness={3}
            position={[0, LD / 2, BEZEL_Z]}
          >
            {/* Nudged away from the camera in depth only. The separation above
                should already settle this; a polygon offset costs nothing and
                means the bezel cannot win even on a driver that hands back a
                16-bit depth buffer. */}
            <meshStandardMaterial
              color={material.bezelColor}
              metalness={0.05}
              roughness={0.92}
              polygonOffset
              polygonOffsetFactor={1}
              polygonOffsetUnits={1}
            />
          </RoundedBox>

          {/* display */}
          <mesh position={[0, LD / 2 - 0.06, DISPLAY_Z]} userData={{ screenSurface: true }}>
            <planeGeometry args={[SCREEN_W, SCREEN_H]} />
            {texture ? (
              <meshBasicMaterial
                ref={screenMatRef}
                map={texture}
                alphaMap={mask}
                transparent
                depthWrite={false}
                color={screenColor}
                // Tone-mapped like everything else in the frame. It used to opt
                // out so the site's colours came through untouched, but once
                // there is a post pass the frame has two owners of tone mapping
                // and the display alone comes out 25/255 wrong. Measured, being
                // mapped costs the site 5/255 — a real screen in a real room is
                // subject to the room's exposure anyway.
              />
            ) : (
              <meshStandardMaterial
                color="#12151c"
                alphaMap={mask}
                transparent
                depthWrite={false}
                roughness={0.35}
                emissive="#1b2434"
                emissiveIntensity={0.5}
              />
            )}
          </mesh>

          {/* glass sheen */}
          <mesh position={[0, LD / 2 - 0.06, GLASS_Z]}>
            <planeGeometry args={[SCREEN_W, SCREEN_H]} />
            {/* A sheen over the picture and nothing else, so it has no business
                writing depth — doing so put a second transparent surface in the
                buffer a hair from the display and gave them something to argue
                about. */}
            <meshPhysicalMaterial
              transparent
              depthWrite={false}
              opacity={material.screenReflectivity}
              roughness={0.06}
              metalness={0}
              clearcoat={1}
              color="#ffffff"
            />
          </mesh>

          {/* notch + camera */}
          <RoundedBox args={[1.2, 0.18, 0.015]} radius={safeRadius([1.2, 0.18, 0.015], 0.06)} smoothness={2} position={[0, LD - 0.22, NOTCH_Z]}>
            <meshStandardMaterial color={material.bezelColor} metalness={0.05} roughness={0.92} />
          </RoundedBox>
          <mesh position={[0, LD - 0.22, LENS_Z]}>
            <sphereGeometry args={[0.04, 16, 16]} />
            <meshStandardMaterial color="#111111" metalness={0.8} roughness={0.3} />
          </mesh>

          {/* badge on the lid back */}
          <mesh position={[0, LD / 2, -LH / 2 - 0.005]} rotation={[0, Math.PI, 0]}>
            <circleGeometry args={[0.45, 32]} />
            <meshStandardMaterial color="#999999" metalness={0.95} roughness={0.08} side={THREE.DoubleSide} />
          </mesh>

          {/* Screen spill light. Position is local and scales with the group,
              but intensity and distance are world-space — never scale those. */}
          {screen.glow > 0.001 && (
            <pointLight
              userData={{ screenGlow: true }}
              position={[0, LD / 2, 9]}
              intensity={screen.glow * 0.5}
              distance={0.4}
              decay={2}
              color="#cfe2ff"
            />
          )}
          </group>
        </group>
      </group>
    </group>
  )
}
