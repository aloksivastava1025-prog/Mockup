import React, { useMemo } from 'react'
import * as THREE from 'three'
import { RoundedBox } from '@react-three/drei'
import { cornerMask } from './screenMask.js'

/**
 * 11" tablet on a folio stand.
 *
 * Authored in millimetres against the same world scale as the other devices —
 * 355mm of laptop is 0.34 world units — so it stands next to them at a
 * believable size.
 */
const W = 249
const H = 179
const D = 5.9
const FRAME_R = 18

// Bezel chosen so the display plane's own aspect is the panel aspect exactly.
// Declaring one aspect in the meta and building the quad to another is how you
// get content quietly stretched a couple of percent.
const SCREEN_H = 161
const PANEL_ASPECT = 2388 / 1668
const SCREEN_W = SCREEN_H * PANEL_ASPECT

const UNIT = 0.34 / 355 // mm -> world
const TILT = 16 // degrees leaning back on the stand
const DEG = Math.PI / 180

const safeRadius = (dims, r) => Math.min(r, Math.min(...dims) / 2 - 1e-4)

/**
 * Depths of the stacked front surfaces, in millimetres from the body's front
 * face. These are authored in mm and then scaled by ~0.001, so a separation
 * that looks generous here is tiny in world units — and two faces landing on
 * the *same* depth is a guaranteed flicker, which is exactly what a glass slab
 * centred on the body face produces. Keep them apart, in this order.
 */
const GLASS_T = 0.5
const GLASS_INSET = 0.4 // glass front sits behind the body front
const Z_SCREEN = 0.5
const Z_CAMERA = 0.7
const Z_SHEEN = 0.9

export const tabletMeta = {
  id: 'tablet',
  label: 'Tablet 11"',
  width: W * UNIT,
  screenAspect: SCREEN_W / SCREEN_H,
  hasLid: false,
  // A tablet pushed much past these stops reading as a tablet. The lower stop
  // was 0.75, which refused ordinary 16:9 footage by 0.01 — an 1868x992 grab
  // wants 0.740 — and then silently letterboxed it. The shape holds fine here.
  adaptRange: [0.66, 1.35],
  frame: { d: 0.62, ty: 0.09, fov: 30 },
}

/**
 * The kickstand is solved rather than posed: given where it meets the back of
 * the tablet, work out the length and angle that put its far end exactly on the
 * floor. Hard-coding an angle and a length is how a stand ends up hanging in
 * the air or sunk through the ground.
 */
function kickstand() {
  const attachHeight = H * 0.52
  const t = TILT * DEG
  // Attachment point in stand space, after the tablet's lean.
  const ay = attachHeight * Math.cos(t) - (D / 2) * Math.sin(t)
  const az = -attachHeight * Math.sin(t) - (D / 2) * Math.cos(t)
  const back = ay * 0.82 // how far behind the foot lands
  const length = Math.hypot(ay, back)
  return {
    length,
    position: [0, ay / 2, az - back / 2],
    rotationX: Math.atan2(back, ay),
  }
}

export default function Tablet({ rootRef, texture, screenMatRef, material, screen, aspectScale = 1 }) {
  const stand = useMemo(() => kickstand(), [])
  const mask = useMemo(() => cornerMask(SCREEN_W / SCREEN_H, 0.035), [])

  const screenColor = useMemo(() => {
    const b = screen.brightness
    return new THREE.Color(b, b, b)
  }, [screen.brightness])

  const body = {
    color: material.bodyColor,
    roughness: Math.min(1, material.bodyRoughness + 0.1),
    metalness: material.bodyMetalness,
  }
  const folio = { color: '#26262a', roughness: 0.92, metalness: 0.05 }

  return (
    <group ref={rootRef} dispose={null}>
      <group scale={[UNIT, UNIT * aspectScale, UNIT]}>
        {/* the stand lives outside the lean, so its foot stays on the floor */}
        <mesh
          position={stand.position}
          rotation={[stand.rotationX, 0, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[W - 30, stand.length, 4]} />
          <meshStandardMaterial {...folio} />
        </mesh>

        {/* bottom edge sits on the floor; the group leans back about it */}
        <group rotation={[-TILT * DEG, 0, 0]}>
          <group position={[0, H / 2, 0]}>
            <RoundedBox
              args={[W, H, D]}
              radius={safeRadius([W, H, D], FRAME_R)}
              smoothness={6}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial {...body} />
            </RoundedBox>

            {/* black glass, set behind the body's front face */}
            <RoundedBox
              args={[W - 1.6, H - 1.6, GLASS_T]}
              radius={safeRadius([W - 1.6, H - 1.6, GLASS_T], FRAME_R - 0.8)}
              smoothness={5}
              position={[0, 0, D / 2 - GLASS_INSET - GLASS_T / 2]}
            >
              <meshStandardMaterial color={material.bezelColor} roughness={0.28} metalness={0.2} />
            </RoundedBox>

            {/* display */}
            <mesh position={[0, 0, D / 2 + Z_SCREEN]} userData={{ screenSurface: true }}>
              <planeGeometry args={[SCREEN_W, SCREEN_H]} />
              {texture ? (
                <meshBasicMaterial
                  ref={screenMatRef}
                  map={texture}
                  alphaMap={mask}
                  transparent
                  depthWrite={false}
                  color={screenColor}
                  toneMapped={false}
                />
              ) : (
                <meshStandardMaterial
                  color="#12151c"
                  alphaMap={mask}
                  transparent
                  depthWrite={false}
                  roughness={0.3}
                  emissive="#1b2434"
                  emissiveIntensity={0.5}
                />
              )}
            </mesh>

            {/* glass sheen */}
            <mesh position={[0, 0, D / 2 + Z_SHEEN]}>
              <planeGeometry args={[SCREEN_W, SCREEN_H]} />
              <meshPhysicalMaterial
                transparent
                opacity={material.screenReflectivity}
                roughness={0.05}
                metalness={0}
                clearcoat={1}
                color="#ffffff"
              />
            </mesh>

            {/* front camera */}
            <mesh position={[0, H / 2 - 5, D / 2 + Z_CAMERA]}>
              <circleGeometry args={[1.6, 20]} />
              <meshStandardMaterial color="#0b0b0e" roughness={0.3} metalness={0.5} />
            </mesh>

            {/* folio cover over the back */}
            <RoundedBox
              args={[W, H, 1.6]}
              radius={safeRadius([W, H, 1.6], 8)}
              smoothness={3}
              position={[0, 0, -D / 2 - 0.9]}
              castShadow
            >
              <meshStandardMaterial {...folio} />
            </RoundedBox>

            {screen.glow > 0.001 && (
              <pointLight
            userData={{ screenGlow: true }}
                position={[0, 0, 120]}
                intensity={screen.glow * 0.4}
                distance={0.34}
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
