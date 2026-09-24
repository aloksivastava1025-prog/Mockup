import React, { useMemo } from 'react'
import * as THREE from 'three'
import { RoundedBox } from '@react-three/drei'

/**
 * Desk dressing.
 *
 * A drone move that climbs away from a laptop on an infinite plane has nothing
 * to look at — the floor reads as a void and the shot has no sense of place.
 * These are deliberately plain: a mat, a cup, a pad, a phone, a plant. They
 * exist to give the wide framings something to be wide *of*, and are muted so
 * they never compete with the screen.
 *
 * Everything is sized against the device, which is 0.34 world units across.
 */

const safeRadius = (dims, r) => Math.min(r, Math.min(...dims) / 2 - 1e-4)

/**
 * Light falling through a window, thrown onto the floor. Nothing sells "this
 * is a room" faster from above, and it costs one textured plane rather than
 * an actual window, wall and spotlight.
 */
function makeGobo() {
  const S = 512
  const c = document.createElement('canvas')
  c.width = S
  c.height = S
  const g = c.getContext('2d')
  g.fillStyle = '#000000'
  g.fillRect(0, 0, S, S)

  g.save()
  g.translate(S / 2, S / 2)
  g.rotate(-0.28)
  // two panes with a mullion between them, soft at the edges
  g.filter = 'blur(10px)'
  g.fillStyle = 'rgba(255,255,255,0.85)'
  g.fillRect(-S * 0.42, -S * 0.3, S * 0.38, S * 0.6)
  g.fillRect(S * 0.02, -S * 0.3, S * 0.38, S * 0.6)
  g.restore()

  // fade the whole thing out toward the edges so it has no hard boundary
  const grd = g.createRadialGradient(S / 2, S / 2, S * 0.1, S / 2, S / 2, S * 0.52)
  grd.addColorStop(0, 'rgba(0,0,0,0)')
  grd.addColorStop(1, 'rgba(0,0,0,1)')
  g.filter = 'none'
  g.globalCompositeOperation = 'destination-out'
  g.fillStyle = grd
  g.fillRect(0, 0, S, S)

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function Mug({ position, rotation = 0, color = '#e8e6e2' }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.042, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.033, 0.029, 0.084, 28]} />
        <meshStandardMaterial color={color} roughness={0.55} metalness={0.02} />
      </mesh>
      {/* the coffee */}
      <mesh position={[0, 0.079, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.029, 24]} />
        <meshStandardMaterial color="#3a241a" roughness={0.3} />
      </mesh>
      <mesh position={[0.039, 0.045, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <torusGeometry args={[0.017, 0.005, 10, 20]} />
        <meshStandardMaterial color={color} roughness={0.55} />
      </mesh>
    </group>
  )
}

function Plant({ position }) {
  const leaves = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => ({
        a: (i / 7) * Math.PI * 2 + 0.3,
        tilt: 0.5 + (i % 3) * 0.22,
        len: 0.075 + (i % 4) * 0.016,
      })),
    [],
  )
  return (
    <group position={position}>
      <mesh position={[0, 0.038, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.036, 0.028, 0.076, 20]} />
        <meshStandardMaterial color="#b9b2a7" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.076, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.031, 18]} />
        <meshStandardMaterial color="#2e2a24" roughness={1} />
      </mesh>
      {leaves.map((l, i) => (
        <mesh
          key={i}
          position={[Math.sin(l.a) * 0.014, 0.088 + l.len * 0.42, Math.cos(l.a) * 0.014]}
          rotation={[l.tilt * Math.cos(l.a), -l.a, l.tilt * Math.sin(l.a)]}
          castShadow
        >
          <planeGeometry args={[0.042, l.len]} />
          <meshStandardMaterial color="#4a6b45" roughness={0.75} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  )
}

export default function Props({ visible = true }) {
  const gobo = useMemo(() => makeGobo(), [])
  React.useEffect(() => () => gobo.dispose(), [gobo])

  if (!visible) return null

  return (
    <group>
      {/* window light on the floor, off to one side and well clear of the device */}
      <mesh position={[-0.55, 0.0015, 0.35]} rotation={[-Math.PI / 2, 0, 0.35]}>
        <planeGeometry args={[1.5, 1.5]} />
        <meshBasicMaterial
          map={gobo}
          transparent
          opacity={0.16}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* desk mat under the device */}
      <RoundedBox
        args={[0.66, 0.004, 0.46]}
        radius={safeRadius([0.66, 0.004, 0.46], 0.012)}
        smoothness={3}
        position={[0, 0.002, 0.02]}
        receiveShadow
      >
        <meshStandardMaterial color="#3b3b3f" roughness={0.95} metalness={0} />
      </RoundedBox>

      <Mug position={[0.33, 0.004, 0.13]} rotation={-0.5} />

      {/* notepad and pen */}
      <group position={[-0.34, 0.004, 0.07]} rotation={[0, 0.22, 0]}>
        <RoundedBox args={[0.15, 0.009, 0.21]} radius={0.004} smoothness={3} position={[0, 0.0045, 0]} castShadow receiveShadow>
          <meshStandardMaterial color="#e9e6df" roughness={0.9} />
        </RoundedBox>
        <mesh position={[0.012, 0.012, 0.01]} rotation={[0, -0.35, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.0035, 0.0035, 0.115, 12]} />
          <meshStandardMaterial color="#26262a" roughness={0.4} metalness={0.3} />
        </mesh>
      </group>

      {/* phone face down, just off the mat */}
      <RoundedBox
        args={[0.071, 0.008, 0.147]}
        radius={0.008}
        smoothness={4}
        position={[0.27, 0.008, -0.14]}
        rotation={[0, -0.42, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color="#2a2c31" roughness={0.35} metalness={0.7} />
      </RoundedBox>

      <Plant position={[-0.46, 0, -0.26]} />
    </group>
  )
}
