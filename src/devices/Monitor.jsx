import React, { useMemo } from 'react'
import * as THREE from 'three'
import { RoundedBox } from '@react-three/drei'
import { cornerMask } from './screenMask.js'

/**
 * 32" desktop display on a pillar stand.
 *
 * Millimetres against the same world scale as everything else, so it reads as
 * twice the laptop rather than as a laptop with a big screen.
 */
const PANEL_W = 718
const PANEL_H = 413
const PANEL_D = 27
const FRAME_R = 10

// As with the tablet: derive the quad from the panel aspect so the declared
// screenAspect and the actual plane cannot drift apart.
const SCREEN_H = 394
const PANEL_ASPECT = 16 / 9
const SCREEN_W = SCREEN_H * PANEL_ASPECT

const PANEL_BOTTOM = 168 // height of the panel's lower edge above the desk
const UNIT = 0.34 / 355 // mm -> world
const DEG = Math.PI / 180

const safeRadius = (dims, r) => Math.min(r, Math.min(...dims) / 2 - 1e-4)

export const monitorMeta = {
  id: 'monitor',
  label: 'Display 32"',
  screenAspect: SCREEN_W / SCREEN_H,
  hasLid: false,
  adaptRange: [0.8, 1.25],
  frame: { d: 1.45, ty: 0.28, fov: 30 },
}

export default function Monitor({ rootRef, texture, screenMatRef, material, screen, aspectScale = 1 }) {
  const mask = useMemo(() => cornerMask(SCREEN_W / SCREEN_H, 0.012), [])

  const screenColor = useMemo(() => {
    const b = screen.brightness
    return new THREE.Color(b, b, b)
  }, [screen.brightness])

  const body = {
    color: material.bodyColor,
    roughness: material.bodyRoughness,
    metalness: material.bodyMetalness,
  }

  const panelY = PANEL_BOTTOM + PANEL_H / 2

  return (
    <group ref={rootRef} dispose={null}>
      <group scale={[UNIT, UNIT * aspectScale, UNIT]}>
        {/* ── stand ── */}
        <mesh position={[0, 5, 10]} castShadow receiveShadow>
          <cylinderGeometry args={[110, 118, 10, 48]} />
          <meshStandardMaterial {...body} />
        </mesh>
        <RoundedBox
          args={[96, PANEL_BOTTOM + 60, 26]}
          radius={safeRadius([96, PANEL_BOTTOM + 60, 26], 12)}
          smoothness={4}
          position={[0, (PANEL_BOTTOM + 60) / 2, -26]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial {...body} />
        </RoundedBox>
        {/* hinge where the arm meets the panel */}
        <mesh position={[0, PANEL_BOTTOM + 52, -18]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[16, 16, 84, 24]} />
          <meshStandardMaterial color="#5a5b60" metalness={0.85} roughness={0.25} />
        </mesh>

        {/* ── panel, tilted back a touch ── */}
        <group position={[0, panelY, 0]} rotation={[-4 * DEG, 0, 0]}>
          <RoundedBox
            args={[PANEL_W, PANEL_H, PANEL_D]}
            radius={safeRadius([PANEL_W, PANEL_H, PANEL_D], FRAME_R)}
            smoothness={5}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial {...body} />
          </RoundedBox>

          {/* Black glass face, placed by its front surface rather than its
              centre so it does not sit proud of the body and hide the display. */}
          <RoundedBox
            args={[PANEL_W - 2, PANEL_H - 2, 1]}
            radius={safeRadius([PANEL_W - 2, PANEL_H - 2, 1], FRAME_R - 1)}
            smoothness={4}
            position={[0, 0, PANEL_D / 2 - 0.5]}
          >
            <meshStandardMaterial color={material.bezelColor} roughness={0.3} metalness={0.2} />
          </RoundedBox>

          {/* display */}
          <mesh position={[0, 0, PANEL_D / 2 + 0.15]}>
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
          <mesh position={[0, 0, PANEL_D / 2 + 0.32]}>
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

          {screen.glow > 0.001 && (
            <pointLight
              position={[0, 0, 300]}
              intensity={screen.glow * 1.1}
              distance={0.9}
              decay={2}
              color="#cfe2ff"
            />
          )}
        </group>
      </group>
    </group>
  )
}
