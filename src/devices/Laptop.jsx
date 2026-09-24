import React, { useMemo } from 'react'
import * as THREE from 'three'
import { RoundedBox } from '@react-three/drei'

const BASE_W = 0.34
const BASE_D = 0.235
const BASE_H = 0.013
const LID_H = 0.222
const LID_T = 0.007
const SCREEN_W = 0.316
const SCREEN_H = 0.1975

export const laptopMeta = {
  id: 'laptop',
  label: 'Laptop 14"',
  screenAspect: SCREEN_W / SCREEN_H,
  // Where the hinge sits relative to the device origin (origin = base resting on y=0).
  hinge: [0, BASE_H, -BASE_D / 2 + 0.005],
}

function Keyboard({ bezelColor }) {
  const keys = useMemo(() => {
    const rows = 5
    const cols = 14
    const gap = 0.0025
    const kw = (BASE_W * 0.76 - gap * (cols - 1)) / cols
    const kh = (BASE_D * 0.42 - gap * (rows - 1)) / rows
    const out = []
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        out.push({
          key: `${r}-${c}`,
          x: (c - (cols - 1) / 2) * (kw + gap),
          z: (r - (rows - 1) / 2) * (kh + gap) - BASE_D * 0.1,
          w: kw,
          h: kh,
        })
      }
    }
    return out
  }, [])

  return (
    <group>
      {keys.map((k) => (
        <mesh key={k.key} position={[k.x, BASE_H / 2 + 0.0012, k.z]} receiveShadow>
          <boxGeometry args={[k.w, 0.0016, k.h]} />
          <meshStandardMaterial color={bezelColor} roughness={0.72} metalness={0.15} />
        </mesh>
      ))}
    </group>
  )
}

export default function Laptop({ rootRef, lidRef, texture, screenMatRef, material, screen, lidScaleY = 1 }) {
  const screenColor = useMemo(() => {
    const b = screen.brightness
    return new THREE.Color(b, b, b)
  }, [screen.brightness])

  return (
    <group ref={rootRef} dispose={null}>
      {/* ---- base / keyboard deck ---- */}
      <RoundedBox
        args={[BASE_W, BASE_H, BASE_D]}
        radius={0.005}
        smoothness={4}
        position={[0, BASE_H / 2, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color={material.bodyColor}
          roughness={material.bodyRoughness}
          metalness={material.bodyMetalness}
        />
      </RoundedBox>

      {/* keyboard well */}
      <mesh position={[0, BASE_H / 2 + 0.0004, -BASE_D * 0.1]} receiveShadow>
        <boxGeometry args={[BASE_W * 0.79, 0.0008, BASE_D * 0.45]} />
        <meshStandardMaterial color={material.bezelColor} roughness={0.85} metalness={0.1} />
      </mesh>
      <Keyboard bezelColor={material.bezelColor} />

      {/* trackpad */}
      <mesh position={[0, BASE_H / 2 + 0.0008, BASE_D * 0.27]} receiveShadow>
        <boxGeometry args={[BASE_W * 0.3, 0.0008, BASE_D * 0.22]} />
        <meshStandardMaterial
          color={material.bodyColor}
          roughness={Math.min(1, material.bodyRoughness + 0.12)}
          metalness={material.bodyMetalness * 0.6}
        />
      </mesh>

      {/* ---- lid (hinged) ---- */}
      <group ref={lidRef} position={laptopMeta.hinge}>
        <group position={[0, (LID_H / 2) * lidScaleY, 0]} scale={[1, lidScaleY, 1]}>
          <RoundedBox args={[BASE_W, LID_H, LID_T]} radius={0.005} smoothness={4} castShadow receiveShadow>
            <meshStandardMaterial
              color={material.bodyColor}
              roughness={material.bodyRoughness}
              metalness={material.bodyMetalness}
            />
          </RoundedBox>

          {/* bezel face */}
          <mesh position={[0, 0, LID_T / 2 + 0.0004]}>
            <planeGeometry args={[BASE_W - 0.008, LID_H - 0.008]} />
            <meshStandardMaterial color={material.bezelColor} roughness={0.45} metalness={0.2} />
          </mesh>

          {/* display */}
          <mesh position={[0, 0.004, LID_T / 2 + 0.0012]}>
            <planeGeometry args={[SCREEN_W, SCREEN_H]} />
            {texture ? (
              <meshBasicMaterial ref={screenMatRef} map={texture} color={screenColor} toneMapped={false} />
            ) : (
              <meshStandardMaterial
                color="#12151c"
                roughness={0.18}
                metalness={0.1}
                emissive="#1b2434"
                emissiveIntensity={0.55}
              />
            )}
          </mesh>

          {/* glass sheen */}
          <mesh position={[0, 0.004, LID_T / 2 + 0.0016]}>
            <planeGeometry args={[SCREEN_W, SCREEN_H]} />
            <meshPhysicalMaterial
              transparent
              opacity={material.screenReflectivity}
              roughness={0.06}
              metalness={0}
              transmission={0}
              clearcoat={1}
              color="#ffffff"
            />
          </mesh>

          {/* screen spill light */}
          {screen.glow > 0.001 && (
            <pointLight
              position={[0, 0, 0.14]}
              intensity={screen.glow * 1.6}
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
