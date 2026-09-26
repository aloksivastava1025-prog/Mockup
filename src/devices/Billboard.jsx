import React, { useMemo } from 'react'
import * as THREE from 'three'
import { RoundedBox } from '@react-three/drei'
import { cornerMask } from './screenMask.js'

/**
 * A wall-mounted billboard — an outdoor LED panel, not a desk device.
 *
 * Authored in millimetres like everything else, at the size a real one is:
 * 3.4m across. That puts it ten times a MacBook, which is the point — drop
 * a laptop in beside it and the difference reads immediately, because every
 * device in this app shares one scale.
 *
 * Three things distinguish it from the Frame device, which is also just a
 * screen:
 *
 * A billboard has a body. It is a deep box with a machined bezel around the
 * picture, mounted proud of whatever is behind it, and that depth is most of
 * what makes it look fixed to a wall rather than pasted on one.
 *
 * It is lit from inside. The panel is emissive rather than merely textured,
 * so at dusk it reads as a light source in the scene instead of a poster.
 *
 * Its origin is the bottom edge, like every other device here, so Position
 * and Float behave the way they do everywhere else. `frame.ty` lifts the
 * default camera to the middle of the panel, since nobody frames a billboard
 * from its feet.
 */
const W = 3400 // mm across — a real hoarding, not a monitor
const H = 1912 // 16:9
const D = 110 // deep enough to sit off the wall and catch an edge
const BEZEL = 42 // the dark frame around the picture
const R = 10

const SCREEN_W = W - BEZEL * 2
const SCREEN_H = H - BEZEL * 2

const UNIT = 0.34 / 355 // mm -> world, the same scale every other device uses

const safeRadius = (dims, r) => Math.min(r, Math.min(...dims) / 2 - 1e-4)

/**
 * The front stack, in millimetres out from the body's face.
 *
 * Same discipline as the other bodies: authored in mm and scaled by ~0.001,
 * so two surfaces sharing a number will flicker. At this size the margins
 * can be generous — half a millimetre is the floor elsewhere and there is
 * no reason to run that close on a three-metre panel.
 */
const Z_SCREEN = 1.2
const Z_SHEEN = 2.4

export const billboardMeta = {
  id: 'billboard',
  label: 'Billboard',
  screenAspect: SCREEN_W / SCREEN_H,
  hasLid: false,
  width: W * UNIT,
  /**
   * Billboards come in whatever shape the site allows — portrait transit
   * panels, long horizontal hoardings — so Adapt gets a wide licence here.
   * There is no familiar silhouette to lose.
   */
  adaptRange: [0.35, 2.2],
  // Framed from the middle of the panel, far enough back to see the wall.
  frame: { d: 7.4, ty: 0.92, fov: 30 },
}

export default function Billboard({
  rootRef,
  texture,
  screenMatRef,
  material,
  screen,
  aspectScale = 1,
}) {
  const mask = useMemo(() => cornerMask(SCREEN_W / SCREEN_H, 0.004), [])

  const screenColor = useMemo(() => {
    const b = screen.brightness
    return new THREE.Color(b, b, b)
  }, [screen.brightness])

  return (
    <group ref={rootRef} dispose={null}>
      {/* Origin at the bottom edge, so it stands on the floor and stretching
          the height grows it upward rather than sinking it. */}
      <group scale={[UNIT, UNIT * aspectScale, UNIT]}>
        {/* body */}
        <RoundedBox
          args={[W, H, D]}
          radius={safeRadius([W, H, D], R)}
          smoothness={4}
          position={[0, H / 2, 0]}
          castShadow
          receiveShadow
        >
          {/* Deliberately not the body colour. A hoarding's case is a dark
              powder-coated frame; painting it in the device finish would
              make a three-metre aluminium slab nobody has ever seen. */}
          <meshStandardMaterial color="#141416" roughness={0.72} metalness={0.25} />
        </RoundedBox>

        {/* the picture */}
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
            />
          ) : (
            <meshStandardMaterial
              color="#0e1014"
              alphaMap={mask}
              transparent
              depthWrite={false}
              roughness={0.3}
              emissive="#161c26"
              emissiveIntensity={0.5}
            />
          )}
        </mesh>

        {/* A whisper of glass. Kept very low: this is a matte outdoor panel,
            not a phone, and a mirror finish three metres across looks wrong. */}
        <mesh position={[0, H / 2, D / 2 + Z_SHEEN]}>
          <planeGeometry args={[SCREEN_W, SCREEN_H]} />
          <meshPhysicalMaterial
            transparent
            depthWrite={false}
            opacity={material.screenReflectivity * 0.35}
            roughness={0.5}
            metalness={0}
            color="#ffffff"
          />
        </mesh>

        {/* Spill. Intensity and distance are world-space and must not be
            scaled into these millimetre units — but the distance does have to
            answer for the size of the thing: a hoarding throws light across a
            street, where a laptop lights a desk. */}
        {screen.glow > 0.001 && (
          <pointLight
            userData={{ screenGlow: true }}
            position={[0, H / 2, 420]}
            intensity={screen.glow * 2.6}
            distance={4.5}
            decay={2}
            color="#cfe2ff"
          />
        )}
      </group>
    </group>
  )
}
