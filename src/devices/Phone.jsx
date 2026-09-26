import React, { useMemo } from 'react'
import * as THREE from 'three'
import { cornerMask } from './screenMask.js'

/**
 * iPhone 15 Pro, ported from the supplied reference build.
 *
 * Every dimension below is the reference's own number multiplied by S, so
 * the port is auditable: the reference authors the body as 3.2 x 6.7 with a
 * 0.42 corner, and that is what is written here. S converts its arbitrary
 * units into the millimetres this project authors in - 6.7 reference units
 * is a 146.7mm phone, which fixes the factor at 21.9.
 *
 * The body is an extruded rounded shape with a bevel, as in the reference,
 * not a RoundedBox. A bevelled extrusion is what gives the rail its bright
 * edge highlight, and it is the main reason the reference reads as metal.
 */
const S = 21.9 // reference unit -> mm

const W = 3.2 * S // 70.1
const H = 6.7 * S // 146.7
/**
 * The one number not taken literally.
 *
 * The reference is 0.12 units deep, which is 2.6mm - about a third of a real
 * phone. On its own white page that reads as stylised; in this app every
 * device stands at true physical scale next to the others, and a 2.6mm phone
 * beside a 16-inch laptop looks like a sheet of paper. 8.25mm is the real
 * iPhone 15 Pro. Put `0.12 * S` back for the reference's own proportion.
 */
const D = 8.25
const RADIUS = 0.42 * S // 9.2
const BEVEL = 0.025 * S // 0.55

const UNIT = 0.34 / 355 // mm -> world, the same scale every other device uses

/** The reference's inner bezel: a 6px inset on a 320px-wide UI. */
const BEZEL = (6 / 320) * W // 1.31
const SCREEN_W = W - BEZEL * 2
const SCREEN_H = H - BEZEL * 2

/**
 * Front and back stacks, in millimetres out from each face.
 *
 * Authored in mm and scaled by ~0.001, so two surfaces on the same number
 * flicker. The reference puts its screen at depth/2 + 0.026 and its back
 * glass at -depth/2 - 0.012; those ratios are kept, spread far enough apart
 * to survive the scale.
 *
 * The first pass put the bezel slab's front face 0.05mm behind the display,
 * which is 5e-8 of a world unit - far under what the depth buffer can tell
 * apart - so the black bezel won the z-fight and covered the screen
 * completely. Half a millimetre is the working figure here, the same margin
 * the back stack already uses and roughly what the lid needed.
 */
const Z_BEZEL = 0.15
const Z_SCREEN = 0.9
const Z_ISLAND = 1.3
const Z_SHEEN = 1.6

const Z_BACK_GLASS = 0.26
const Z_LOGO = 0.75
const Z_BUMP = 1.3

/**
 * The reference's `createPhoneGeometry`: a rounded rectangle traced with
 * four arcs, extruded with a small bevel and centred.
 */
function roundedSlab(width, height, depth, radius, bevel = BEVEL) {
  const shape = new THREE.Shape()
  const x = width / 2
  const y = height / 2
  shape.moveTo(-x + radius, -y)
  shape.lineTo(x - radius, -y)
  shape.absarc(x - radius, -y + radius, radius, -Math.PI / 2, 0, false)
  shape.lineTo(x, y - radius)
  shape.absarc(x - radius, y - radius, radius, 0, Math.PI / 2, false)
  shape.lineTo(-x + radius, y)
  shape.absarc(-x + radius, y - radius, radius, Math.PI / 2, Math.PI, false)
  shape.lineTo(-x, -y + radius)
  shape.absarc(-x + radius, -y + radius, radius, Math.PI, Math.PI * 1.5, false)

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 1,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: 24,
  })
  geo.center()
  return geo
}

export const phoneMeta = {
  id: 'phone',
  label: 'Phone',
  screenAspect: SCREEN_W / SCREEN_H,
  hasLid: false,
  width: W * UNIT,
  // A phone is the least forgiving body in the set: it is already extreme in
  // aspect, so there is very little room to stretch it before it stops
  // reading as a phone at all.
  adaptRange: [0.85, 1.2],
  frame: { d: 0.5, ty: 0.072, fov: 30 },
}

export default function Phone({ rootRef, texture, screenMatRef, material, screen, aspectScale = 1 }) {
  const mask = useMemo(() => cornerMask(SCREEN_W / SCREEN_H, RADIUS / SCREEN_W), [])

  const bodyGeo = useMemo(() => roundedSlab(W, H, D, RADIUS), [])
  const backGlassGeo = useMemo(
    // reference: (width - 0.015, height - 0.015, 0.02, radius - 0.01)
    () => roundedSlab(W - 0.015 * S, H - 0.015 * S, 0.02 * S, RADIUS - 0.01 * S, 0.2),
    [],
  )
  const bezelGeo = useMemo(() => roundedSlab(W - 0.3, H - 0.3, 0.25, RADIUS - 0.15, 0.05), [])
  // reference: bump is 1.5 x 1.6 with a 0.4 corner
  const bumpGeo = useMemo(() => roundedSlab(1.5 * S, 1.6 * S, 0.03 * S, 0.4 * S, 0.2), [])

  const screenColor = useMemo(() => {
    const b = screen.brightness
    return new THREE.Color(b, b, b)
  }, [screen.brightness])

  // The reference's material set, with the user's body colour driving it.
  const railMat = {
    color: material.bodyColor,
    metalness: Math.max(material.bodyMetalness, 0.8),
    roughness: Math.max(0.08, material.bodyRoughness * 1.5),
    clearcoat: 0.2,
    clearcoatRoughness: 0.1,
  }
  const backGlassMat = {
    color: material.bodyColor,
    metalness: 0.3,
    roughness: 0.3,
    clearcoat: 1.0,
    clearcoatRoughness: 0.2,
  }

  // reference: lensZ -0.035, outer 0.26, inner 0.22, ring 0.045 / glass 0.046
  const LENS_Z = -0.035 * S
  const LENS_OUTER = 0.26 * S
  const LENS_INNER = 0.22 * S

  return (
    <group ref={rootRef} dispose={null}>
      {/* Origin at the bottom edge, so the phone stands on the floor and
          stretching the height grows it upward rather than sinking it. */}
      <group scale={[UNIT, UNIT * aspectScale, UNIT]}>
        <group position={[0, H / 2, 0]}>
          {/* rail */}
          <mesh geometry={bodyGeo} castShadow receiveShadow>
            <meshPhysicalMaterial {...railMat} />
          </mesh>

          {/* the reference's 6px inset bezel, as geometry */}
          <mesh geometry={bezelGeo} position={[0, 0, D / 2 + Z_BEZEL]}>
            <meshStandardMaterial color="#000000" roughness={0.35} metalness={0.1} />
          </mesh>

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

          {/* reference: 100 x 30 px island, 12px from the top, 20px radius */}
          <mesh position={[0, H / 2 - (12 / 670) * H - ((30 / 670) * H) / 2, D / 2 + Z_ISLAND]}>
            <planeGeometry args={[(100 / 320) * W, (30 / 670) * H]} />
            <meshBasicMaterial color="#000000" />
          </mesh>

          {/* glass glare */}
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

          {/* frosted back glass */}
          <mesh geometry={backGlassGeo} position={[0, 0, -D / 2 - Z_BACK_GLASS]}>
            <meshPhysicalMaterial {...backGlassMat} />
          </mesh>

          {/* logo — reference: a 0.2 radius glossy disc facing out of the back */}
          <mesh position={[0, 0, -D / 2 - Z_LOGO]} rotation={[0, Math.PI, 0]}>
            <circleGeometry args={[0.2 * S, 32]} />
            <meshPhysicalMaterial color={material.bodyColor} metalness={0.9} roughness={0.1} />
          </mesh>

          {/* camera bump — reference places it at (0.7, 2.4) on the back */}
          <group position={[-0.7 * S, 2.4 * S, -D / 2 - Z_BUMP]}>
            <mesh geometry={bumpGeo}>
              <meshPhysicalMaterial
                color={material.bodyColor}
                metalness={0.2}
                roughness={0.4}
                clearcoat={0.5}
              />
            </mesh>

            {[
              [-0.35 * S, 0.35 * S],
              [-0.35 * S, -0.35 * S],
              [0.35 * S, 0],
            ].map(([lx, ly]) => (
              <group key={`${lx}_${ly}`} position={[lx, ly, LENS_Z]}>
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[LENS_OUTER, LENS_OUTER, 0.045 * S, 32]} />
                  <meshPhysicalMaterial color="#444444" metalness={1} roughness={0.1} />
                </mesh>
                <mesh position={[0, 0, -0.002 * S]} rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[LENS_INNER, LENS_INNER, 0.046 * S, 32]} />
                  <meshPhysicalMaterial
                    color="#000000"
                    metalness={0.5}
                    roughness={0}
                    clearcoat={1}
                    clearcoatRoughness={0.02}
                  />
                </mesh>
              </group>
            ))}

            {/* flash */}
            <mesh position={[0.35 * S, 0.5 * S, LENS_Z]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.12 * S, 0.12 * S, 0.04 * S, 32]} />
              <meshPhysicalMaterial color="#ffeedd" emissive="#221100" />
            </mesh>
            {/* LiDAR */}
            <mesh position={[0.35 * S, -0.5 * S, LENS_Z]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.12 * S, 0.12 * S, 0.04 * S, 32]} />
              <meshPhysicalMaterial color="#050505" metalness={0.5} roughness={0.2} clearcoat={1} />
            </mesh>
          </group>

          {/* buttons — reference: 0.04 x 0.5 volume pair, 0.04 x 0.7 power */}
          {[1.2 * S, 0.5 * S].map((by) => (
            <mesh key={by} position={[-W / 2 - 0.03 * S, by, 0]}>
              <boxGeometry args={[0.04 * S, 0.5 * S, 0.04 * S]} />
              <meshPhysicalMaterial {...railMat} />
            </mesh>
          ))}
          <mesh position={[W / 2 + 0.03 * S, 0.8 * S, 0]}>
            <boxGeometry args={[0.04 * S, 0.7 * S, 0.04 * S]} />
            <meshPhysicalMaterial {...railMat} />
          </mesh>
        </group>

        {/* Screen spill. Intensity and distance are world-space and must not
            be scaled into these millimetre units. */}
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
