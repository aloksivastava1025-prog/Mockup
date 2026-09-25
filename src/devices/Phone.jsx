import React, { useMemo } from 'react'
import * as THREE from 'three'
import { RoundedBox } from '@react-three/drei'
import { cornerMask } from './screenMask.js'

/**
 * Modern 6.1" phone. Authored in millimetres and scaled into world space, so it
 * sits at a believable size next to the laptop.
 *
 * Unlike the laptops there is no lid: `aspectScale` stretches the body along Y,
 * which is the display's height axis here.
 */
const W = 71.5
const H = 146.7
const D = 7.8
const FRAME_R = 11

const BEZEL = 3.4
const SCREEN_W = W - BEZEL * 2
const SCREEN_H = H - BEZEL * 2

const UNIT = 0.34 / 355 // mm -> world, the same scale every other device uses

const safeRadius = (dims, r) => Math.min(r, Math.min(...dims) / 2 - 1e-4)

/**
 * Stacked front surfaces, in millimetres from the body's front face.
 *
 * The same rule as the tablet and the display: these are authored in mm and
 * scaled by about 0.001, so a separation that reads as generous here is tiny in
 * world units, and two faces at the same depth flicker. The phone had the worse
 * version of the bug — its glass slab sat *proud* of the body and buried the
 * display behind it — which went unnoticed only because it was never shipped.
 */
const GLASS_T = 0.5
const GLASS_INSET = 0.4
const Z_SCREEN = 0.5
const Z_ISLAND = 0.7
const Z_SHEEN = 0.9

export const phoneMeta = {
  id: 'phone',
  label: 'Phone',
  screenAspect: SCREEN_W / SCREEN_H,
  hasLid: false,
  width: W * UNIT,
  // A phone is the least forgiving body in the set: it is already extreme in
  // aspect, so there is very little room to stretch it before it stops reading
  // as a phone at all.
  adaptRange: [0.85, 1.2],
  // Framing that shows the whole device with a little room around it.
  frame: { d: 0.42, ty: 0.075, fov: 30 },
}

export default function Phone({ rootRef, texture, screenMatRef, material, screen, aspectScale = 1 }) {
  // A phone with square screen corners is the giveaway that it is a render.
  const mask = useMemo(() => cornerMask(SCREEN_W / SCREEN_H, 0.11), [])

  const screenColor = useMemo(() => {
    const b = screen.brightness
    return new THREE.Color(b, b, b)
  }, [screen.brightness])

  const body = {
    color: material.bodyColor,
    roughness: Math.min(1, material.bodyRoughness + 0.12),
    metalness: material.bodyMetalness,
  }

  return (
    <group ref={rootRef} dispose={null}>
      {/* origin sits at the bottom edge, so the phone stands on the floor and
          scaling Y grows it upward rather than sinking it */}
      <group scale={[UNIT, UNIT * aspectScale, UNIT]}>
        {/* frame */}
        <RoundedBox
          args={[W, H, D]}
          radius={safeRadius([W, H, D], FRAME_R)}
          smoothness={6}
          position={[0, H / 2, 0]}
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
          position={[0, H / 2, D / 2 - GLASS_INSET - GLASS_T / 2]}
        >
          <meshStandardMaterial color={material.bezelColor} roughness={0.25} metalness={0.2} />
        </RoundedBox>

        {/* display */}
        <mesh position={[0, H / 2, D / 2 + Z_SCREEN]}>
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
        <mesh position={[0, H / 2, D / 2 + Z_SHEEN]}>
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

        {/* dynamic island */}
        <RoundedBox
          args={[24, 7.4, 0.5]}
          radius={safeRadius([24, 7.4, 0.5], 3.6)}
          smoothness={4}
          position={[0, H - 14, D / 2 + Z_ISLAND]}
        >
          <meshStandardMaterial color="#000000" roughness={0.35} metalness={0.1} />
        </RoundedBox>

        {/* side buttons */}
        {[
          { y: H - 42, h: 9 }, // volume up
          { y: H - 54, h: 9 }, // volume down
        ].map((b) => (
          <mesh key={b.y} position={[-W / 2 - 0.4, b.y, 0]}>
            <boxGeometry args={[1.2, b.h, 3.4]} />
            <meshStandardMaterial {...body} />
          </mesh>
        ))}
        <mesh position={[W / 2 + 0.4, H - 48, 0]}>
          <boxGeometry args={[1.2, 15, 3.4]} />
          <meshStandardMaterial {...body} />
        </mesh>

        {/* rear camera plateau */}
        <group position={[-W / 2 + 19, H - 20, -D / 2 - 0.6]}>
          <RoundedBox args={[30, 30, 1.4]} radius={7} smoothness={4}>
            <meshStandardMaterial {...body} />
          </RoundedBox>
          {[
            [-6.5, 6.5],
            [6.5, 6.5],
            [0, -6.5],
          ].map(([lx, ly]) => (
            <group key={`${lx}_${ly}`} position={[lx, ly, -1.5]}>
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[5.4, 5.4, 1.8, 24]} />
                <meshStandardMaterial color="#26262a" roughness={0.3} metalness={0.8} />
              </mesh>
              <mesh position={[0, 0, -1.0]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[3.9, 3.9, 0.4, 24]} />
                <meshPhysicalMaterial color="#05060a" roughness={0.08} metalness={0.2} clearcoat={1} />
              </mesh>
            </group>
          ))}
        </group>

        {/* screen spill. Intensity and distance are world-space and must not be
            scaled into these millimetre units. */}
        {screen.glow > 0.001 && (
          <pointLight
            position={[0, H / 2, 60]}
            intensity={screen.glow * 0.35}
            distance={0.3}
            decay={2}
            color="#cfe2ff"
          />
        )}
      </group>
    </group>
  )
}
