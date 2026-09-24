import React, { useMemo } from 'react'
import * as THREE from 'three'
import { RoundedBox } from '@react-three/drei'

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

const UNIT = 0.147 / H // mm -> world units

const safeRadius = (dims, r) => Math.min(r, Math.min(...dims) / 2 - 1e-4)

export const phoneMeta = {
  id: 'phone',
  label: 'Phone',
  screenAspect: SCREEN_W / SCREEN_H,
  hasLid: false,
  // Framing that shows the whole device with a little room around it.
  frame: { d: 0.42, ty: 0.075, fov: 30 },
}

export default function Phone({ rootRef, texture, screenMatRef, material, screen, aspectScale = 1 }) {
  const screenColor = useMemo(() => {
    const b = screen.brightness
    return new THREE.Color(b, b, b)
  }, [screen.brightness])

  const body = {
    color: material.bodyColor,
    roughness: Math.min(1, material.bodyRoughness + 0.12),
    metalness: material.bodyMetalness,
  }

  const front = D / 2 + 0.01

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

        {/* black glass face, inset just proud of the frame */}
        <RoundedBox
          args={[W - 1.6, H - 1.6, 0.4]}
          radius={safeRadius([W - 1.6, H - 1.6, 0.4], FRAME_R - 0.8)}
          smoothness={5}
          position={[0, H / 2, D / 2 - 0.1]}
        >
          <meshStandardMaterial color={material.bezelColor} roughness={0.25} metalness={0.2} />
        </RoundedBox>

        {/* display */}
        <mesh position={[0, H / 2, front]}>
          <planeGeometry args={[SCREEN_W, SCREEN_H]} />
          {texture ? (
            <meshBasicMaterial ref={screenMatRef} map={texture} color={screenColor} toneMapped={false} />
          ) : (
            <meshStandardMaterial color="#12151c" roughness={0.3} emissive="#1b2434" emissiveIntensity={0.5} />
          )}
        </mesh>

        {/* glass sheen */}
        <mesh position={[0, H / 2, front + 0.01]}>
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
          position={[0, H - 14, front + 0.02]}
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
