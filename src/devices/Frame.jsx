import React, { useMemo } from 'react'
import * as THREE from 'three'
import { RoundedBox } from '@react-three/drei'
import { cornerMask } from './screenMask.js'

/**
 * No device. Just the footage, standing in the scene.
 *
 * Every other entry in the registry is a body with a screen in it. This one
 * is the screen, so the room, the light, the shadow and the camera work all
 * still apply but nothing frames the picture. It is the right answer when the
 * footage is the subject and a laptop around it would only be a costume.
 *
 * It is not a bare plane. A plane has no thickness, so it takes no rim light
 * and casts a shadow you cannot read - it looks like a sticker floating in
 * the room. A two-millimetre slab behind the picture is enough to catch an
 * edge and sit on the floor, and at this scale nobody reads it as a body.
 */
const W = 240
const H = 135 // 16:9 before Adapt reshapes it
const D = 2
const R = 4

const UNIT = 0.34 / 355 // mm -> world, the same scale every other device uses

const safeRadius = (dims, r) => Math.min(r, Math.min(...dims) / 2 - 1e-4)

/**
 * The front stack, in millimetres out from the slab's face.
 *
 * Same discipline as the other bodies: authored in mm, scaled by ~0.001, so
 * two surfaces on the same number flicker. The picture sits proud of the
 * slab and the sheen sits proud of the picture.
 */
const Z_SCREEN = 0.4
const Z_SHEEN = 0.7

export const frameMeta = {
  id: 'frame',
  label: 'Frame',
  screenAspect: W / H,
  hasLid: false,
  width: W * UNIT,
  /**
   * Adapt may do whatever it likes here.
   *
   * The limits on the other devices exist because a laptop stretched too far
   * stops looking like a laptop. This has no shape to lose, so a square post
   * or a tall story frame is as correct as a widescreen one, and clamping it
   * would be inventing a constraint.
   */
  adaptRange: [0.2, 5],
  frame: { d: 0.74, ty: 0.115, fov: 34 },
}

export default function Frame({ rootRef, texture, screenMatRef, material, screen, aspectScale = 1 }) {
  const mask = useMemo(() => cornerMask(W / H, 0.022), [])

  const screenColor = useMemo(() => {
    const b = screen.brightness
    return new THREE.Color(b, b, b)
  }, [screen.brightness])

  return (
    <group ref={rootRef} dispose={null}>
      {/* Origin at the bottom edge, so it stands on the floor and stretching
          the height grows it upward rather than sinking it. */}
      <group scale={[UNIT, UNIT * aspectScale, UNIT]}>
        <RoundedBox
          args={[W, H, D]}
          radius={safeRadius([W, H, D], R)}
          smoothness={4}
          position={[0, H / 2, 0]}
          castShadow
          receiveShadow
        >
          {/* Deliberately not the body colour. The slab is a backing, and
              painting it in the device finish would make it look like the
              bezel this device exists to avoid. */}
          <meshStandardMaterial color="#141519" roughness={0.62} metalness={0.15} />
        </RoundedBox>

        <mesh position={[0, H / 2, D / 2 + Z_SCREEN]} userData={{ screenSurface: true }}>
          <planeGeometry args={[W, H]} />
          {texture ? (
            <meshBasicMaterial
              ref={screenMatRef}
              map={texture}
              alphaMap={mask}
              transparent
              depthWrite={false}
              color={screenColor}
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

        {/* A whisper of glass. Left in because the other devices have it and
            a frame with none looks flatter than the rest of the set, but at
            half strength - there is no panel here to be behind. */}
        <mesh position={[0, H / 2, D / 2 + Z_SHEEN]}>
          <planeGeometry args={[W, H]} />
          <meshPhysicalMaterial
            transparent
            opacity={material.screenReflectivity * 0.5}
            roughness={0.06}
            metalness={0}
            clearcoat={1}
            color="#ffffff"
          />
        </mesh>

        {/* Screen spill. Intensity and distance are world-space and must not
            be scaled into these millimetre units. */}
        {screen.glow > 0.001 && (
          <pointLight
            userData={{ screenGlow: true }}
            position={[0, H / 2, 90]}
            intensity={screen.glow * 0.5}
            distance={0.45}
            decay={2}
            color="#cfe2ff"
          />
        )}
      </group>
    </group>
  )
}
