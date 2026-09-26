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

/**
 * And the same again on the back, measured from the body's rear face.
 *
 * The back carries four surfaces now - glass, logo, camera plateau, lenses -
 * and they are stacked outward in that order. Authored in millimetres and
 * scaled by ~0.001 like everything else, so the gaps look generous here and
 * are fractions of a world unit once placed.
 */
const BACK_GLASS_T = 0.5
const Z_BACK_GLASS = 0.25   // half its own thickness: sits flush at the body
const Z_LOGO = 0.75
const Z_PLATEAU = 1.4

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

  // Polished, not brushed. A phone rail is the shiniest surface in the set and
  // the extra roughness the other bodies want makes it read as plastic.
  const body = {
    color: material.bodyColor,
    roughness: Math.max(0.05, material.bodyRoughness * 0.7),
    metalness: Math.max(material.bodyMetalness, 0.85),
    clearcoat: 0.6,
    clearcoatRoughness: 0.12,
  }
  const backGlass = {
    color: material.bodyColor,
    roughness: 0.28,
    metalness: 0.25,
    clearcoat: 1,
    clearcoatRoughness: 0.18,
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
          <meshPhysicalMaterial {...body} />
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
        <mesh position={[0, H / 2, D / 2 + Z_SCREEN]} userData={{ screenSurface: true }}>
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
            <meshPhysicalMaterial {...body} />
          </mesh>
        ))}
        <mesh position={[W / 2 + 0.4, H - 48, 0]}>
          <boxGeometry args={[1.2, 15, 3.4]} />
          <meshPhysicalMaterial {...body} />
        </mesh>

        {/* back glass, proud of the body by its own thickness */}
        <RoundedBox
          args={[W - 1.2, H - 1.2, BACK_GLASS_T]}
          radius={safeRadius([W - 1.2, H - 1.2, BACK_GLASS_T], FRAME_R - 0.6)}
          smoothness={5}
          position={[0, H / 2, -D / 2 - Z_BACK_GLASS]}
        >
          <meshPhysicalMaterial {...backGlass} />
        </RoundedBox>

        {/* logo: a disc a shade darker, catching the light differently */}
        <mesh position={[0, H / 2, -D / 2 - Z_LOGO]} rotation={[0, Math.PI, 0]}>
          <circleGeometry args={[8.5, 48]} />
          <meshPhysicalMaterial
            color={material.bodyColor}
            roughness={0.08}
            metalness={0.95}
            clearcoat={1}
          />
        </mesh>

        {/*
          Rear camera. Three lenses in the Pro arrangement - two down the left,
          one at the right middle - with the flash above it and the LiDAR
          below, which is the detail that stops a phone render reading as a
          generic slab.
        */}
        <group position={[-W / 2 + 19, H - 21, -D / 2 - Z_PLATEAU]}>
          <RoundedBox args={[34, 34, 1.6]} radius={9} smoothness={5}>
            <meshPhysicalMaterial
              color={material.bodyColor}
              roughness={0.34}
              metalness={0.4}
              clearcoat={0.5}
            />
          </RoundedBox>

          {[
            [-8, 8],
            [-8, -8],
            [8, 0],
          ].map(([lx, ly]) => (
            <group key={`${lx}_${ly}`} position={[lx, ly, -1.7]}>
              {/* ring */}
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[5.8, 5.8, 2.0, 32]} />
                <meshPhysicalMaterial color="#3a3a3f" roughness={0.12} metalness={1} />
              </mesh>
              {/* glass, sunk inside the ring so the ring reads as a wall */}
              <mesh position={[0, 0, -1.1]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[4.6, 4.6, 0.5, 32]} />
                <meshPhysicalMaterial
                  color="#04050a"
                  roughness={0.03}
                  metalness={0.3}
                  clearcoat={1}
                  clearcoatRoughness={0.02}
                />
              </mesh>
            </group>
          ))}

          {/* flash */}
          <mesh position={[8, 10.2, -1.2]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[2.7, 2.7, 1.2, 24]} />
            <meshStandardMaterial color="#ffeedd" emissive="#2a1a08" roughness={0.4} />
          </mesh>
          {/* LiDAR */}
          <mesh position={[8, -10.2, -1.2]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[2.7, 2.7, 1.2, 24]} />
            <meshPhysicalMaterial color="#0a0a0d" roughness={0.16} metalness={0.5} clearcoat={1} />
          </mesh>
        </group>

        {/* screen spill. Intensity and distance are world-space and must not be
            scaled into these millimetre units. */}
        {screen.glow > 0.001 && (
          <pointLight
            userData={{ screenGlow: true }}
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
