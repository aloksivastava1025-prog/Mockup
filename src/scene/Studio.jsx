import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, MeshReflectorMaterial, OrbitControls } from '@react-three/drei'
import { useStudio } from '../store/useStudio.js'
import { DEFAULT_DEVICE, DEVICES } from '../devices/index.js'
import { sampleAt } from '../anim/interpolate.js'
import { shakeAt } from '../anim/shake.js'
import { createScreenSource } from '../hooks/useScreenTexture.js'
import { studioApi } from './studioApi.js'
import { SURFACES, SURFACE_GEOMETRY, surfaceTexture } from './surfaces.js'
import { FloorSponsors } from './Sponsors.jsx'
import { backdropTexture } from './backdrops.js'
import { makeTitleLayer } from './titles.js'
import { makePostPass } from './post.js'
import Props from './Props.jsx'

const DEG = Math.PI / 180

// Default limits on how far Adapt may deform a device; a device meta can
// narrow them with its own adaptRange.
const ADAPT_MIN = 0.6
const ADAPT_MAX = 1.7

/**
 * Distance haze, so the floor does not end in a visible line.
 *
 * The ground is a finite plane, and its far edge lands within a fraction of a
 * degree of the horizon. Against a pale backdrop nobody notices, because the
 * two are a similar value there. Against a dark window the warm floor meets
 * cold night at full contrast and the seam reads as the edge of a table —
 * which is exactly what it looks like, and exactly what it is not.
 *
 * Fading the floor into the backdrop's own colour before it runs out removes
 * the edge instead of hiding it. Set near far enough out that the device,
 * which sits within about a unit of the origin, is never touched.
 */
function useFog() {
  const { scene } = useThree()
  const fog = useStudio((s) => s.background.fog)

  useEffect(() => {
    scene.fog = fog ? new THREE.Fog(fog.color, fog.near, fog.far) : null
    // Materials compile the fog chunk into their shader or they do not. Adding
    // or removing scene.fog after they are built changes nothing on screen
    // until each one is recompiled, which is why simply assigning it looked
    // like it had no effect at all.
    scene.traverse((o) => {
      const m = o.material
      if (!m) return
      for (const mat of Array.isArray(m) ? m : [m]) {
        // A screen is emissive: it is showing its own light, not reflecting
        // the room's, so haze in front of it would be wrong.
        if (mat.isMeshBasicMaterial) mat.fog = false
        mat.needsUpdate = true
      }
    })
    return () => {
      scene.fog = null
    }
  }, [scene, fog?.color, fog?.near, fog?.far])
}

/**
 * Keep the screen's own light off the floor.
 *
 * A display spills light onto the desk in front of it, and that spill is worth
 * having — but a point light does not know the machine is in the way, so it
 * shines straight through the body and lays a bright disc on the ground
 * directly underneath. The device then reads as hovering over a lit patch
 * rather than standing on a surface, which is exactly what it looked like.
 *
 * Shadow-casting would be the physical answer and costs a cube map per device.
 * Layers cost nothing: the glow lights move to a layer of their own, and
 * everything except the ground is opted in to it. The camera still draws
 * everything, because enable() adds a layer rather than replacing layer 0.
 */
const GLOW_LAYER = 1

function useScreenGlowLayer() {
  const { scene } = useThree()
  const deviceId = useStudio((s) => s.deviceId)
  const companions = useStudio((s) => s.companions)
  const lit = useStudio((s) => s.screen.glow > 0.001)

  useEffect(() => {
    scene.traverse((o) => {
      if (o.userData?.screenGlow) o.layers.set(GLOW_LAYER)
      else if (o.isMesh && !o.userData?.ground) o.layers.enable(GLOW_LAYER)
    })
  }, [scene, deviceId, companions, lit])
}

function useGradientBackground() {
  const { scene } = useThree()
  const background = useStudio((s) => s.background)
  const backdrop = useStudio((s) => s.backdrop)

  useEffect(() => {
    if (background.mode === 'transparent') {
      scene.background = null
      return
    }
    // A painted room. Cached and shared, so it is never disposed here.
    if (background.mode === 'scene') {
      const tex = backdropTexture(background.scene)
      scene.background = tex ?? new THREE.Color(background.colorBottom ?? '#101418')
      return
    }
    if (background.mode === 'image') {
      if (!backdrop) {
        scene.background = new THREE.Color('#d6d6d6')
        return
      }
      const tex = new THREE.Texture(backdrop.el)
      tex.colorSpace = THREE.SRGBColorSpace
      // Marked so the frame loop knows to keep its aspect; the gradient below
      // is a 4x256 strip that is *meant* to stretch.
      tex.userData.cover = true
      tex.needsUpdate = true
      scene.background = tex
      return () => tex.dispose()
    }
    if (background.mode === 'color') {
      scene.background = new THREE.Color(background.color)
      return
    }
    const c = document.createElement('canvas')
    c.width = 4
    c.height = 256
    const ctx = c.getContext('2d')
    const grad = ctx.createLinearGradient(0, 0, 0, 256)
    grad.addColorStop(0, background.colorTop)
    grad.addColorStop(1, background.colorBottom)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 4, 256)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    scene.background = tex
    return () => tex.dispose()
  }, [scene, backdrop, background.mode, background.scene, background.color, background.colorTop, background.colorBottom])
}

function EnvRig({ preset, intensity }) {
  if (preset === 'none') return null
  const warm = preset === 'warm'
  const soft = preset === 'softbox'
  return (
    <Environment resolution={256} frames={1}>
      <Lightformer
        form="rect"
        intensity={intensity * (soft ? 2.4 : 3.2)}
        color={warm ? '#ffd9b0' : '#ffffff'}
        position={[0, 3, 2]}
        rotation={[-Math.PI / 3, 0, 0]}
        scale={[8, 5, 1]}
      />
      <Lightformer
        form="rect"
        intensity={intensity * 1.6}
        color={warm ? '#ffbe86' : '#cfe0ff'}
        position={[-4, 1.5, 1]}
        rotation={[0, Math.PI / 2, 0]}
        scale={[6, 4, 1]}
      />
      <Lightformer
        form="rect"
        intensity={intensity * (soft ? 1.8 : 1.1)}
        color="#ffffff"
        position={[4, 2, -1]}
        rotation={[0, -Math.PI / 2, 0]}
        scale={[6, 4, 1]}
      />
      <Lightformer
        form="ring"
        intensity={intensity * 1.2}
        color={warm ? '#ffca9a' : '#ffffff'}
        position={[0, 2, -4]}
        scale={[4, 4, 1]}
      />
    </Environment>
  )
}

function Lights() {
  const lighting = useStudio((s) => s.lighting)
  const keyRef = useRef()
  const isPlaying = useStudio((s) => s.isPlaying)
  const pose = useStudio((s) => s.device)

  // Likewise the key light's shadow map: re-render it when the pose or the
  // lighting changes, not on every frame of video playback.
  useEffect(() => {
    const light = keyRef.current
    if (!light?.shadow) return
    light.shadow.autoUpdate = isPlaying
    light.shadow.needsUpdate = true
  }, [isPlaying, pose, lighting])

  const keyPos = useMemo(() => {
    const r = 3
    const az = lighting.keyAzimuth * DEG
    const el = lighting.keyElevation * DEG
    return [r * Math.cos(el) * Math.sin(az), r * Math.sin(el), r * Math.cos(el) * Math.cos(az)]
  }, [lighting.keyAzimuth, lighting.keyElevation])

  return (
    <>
      <ambientLight intensity={lighting.ambient} />
      <hemisphereLight intensity={lighting.hemi ?? 0} groundColor="#444444" />
      <directionalLight
        ref={keyRef}
        position={keyPos}
        intensity={lighting.keyIntensity}
        castShadow={lighting.shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0005}
        shadow-normalBias={0.02}
      >
        <orthographicCamera attach="shadow-camera" args={[-0.6, 0.6, 0.6, -0.6, 0.05, 8]} />
      </directionalLight>
      <directionalLight position={[-keyPos[0], keyPos[1] * 0.6, -keyPos[2] * 0.4]} intensity={lighting.fillIntensity} />
      <spotLight
        position={[0, 1.8, -2.4]}
        angle={0.9}
        penumbra={1}
        intensity={lighting.rimIntensity}
        color="#dbe7ff"
      />
      <EnvRig preset={lighting.envPreset} intensity={lighting.envIntensity} />
    </>
  )
}

function Ground() {
  const background = useStudio((s) => s.background)
  const lighting = useStudio((s) => s.lighting)
  const { groundVisible } = background
  const kind = background.surface ?? 'studio'
  const surface = SURFACES[kind] ?? SURFACES.studio
  // Big enough that a high aerial never catches the plane's edge. The texture
  // repeat scales with it, so tile size on the floor stays constant.
  const GROUND = 60
  const map = useMemo(() => surfaceTexture(kind, GROUND), [kind])

  // Contact shadows cost a full extra scene render per frame. While a video
  // plays the device and camera are usually still — only the screen content
  // changes — so the shadow is identical frame after frame. Recompute it once
  // per pose instead, and only fall back to continuous updates when the
  // timeline is actually moving the device.
  const isPlaying = useStudio((s) => s.isPlaying)
  const pose = useStudio((s) => s.device)
  const companions = useStudio((s) => s.companions)
  // Companions are part of what the catcher sees, so moving one has to
  // invalidate the cached shadow the same way moving the hero does.
  const poseKey =
    `${pose.position.join()}|${pose.rotation.join()}|${pose.lidAngle}|${pose.scale}` +
    companions.map((c) => `|${c.deviceId}${c.position.join()}${c.rotation.join()}${c.lidAngle}${c.scale}`).join('')

  // Lift the device and its shadow has to answer for it: a hard contact patch
  // under something floating in mid-air reads as a mistake. Spread it, fade it,
  // and widen the catcher's reach so it does not simply vanish.
  const lift = Math.max(0, pose.position[1] ?? 0)
  /*
   * Below the origin the shadow travels with the device instead of staying
   * put.
   *
   * Above it, the origin is the floor and the device is hovering over it, so
   * the shadow belongs on the floor — that is what `lift` handles. Below it
   * there is no floor to stay on: the only reason to put a device under the
   * origin is to line its base up with a ground line in a background
   * photograph, and the contact patch has to land there too. Left at zero it
   * hung in the air above the machine it was supposed to be under.
   */
  const shadowY = Math.min(0, pose.position[1] ?? 0)
  const shadowOpacity = lighting.shadowOpacity / (1 + lift * 6)
  const shadowBlur = lighting.shadowBlur * (1 + lift * 8)
  // The catcher is a fixed square centred on the origin, so a companion placed
  // out to the side falls off it and loses its shadow entirely. Grow it to
  // reach the furthest device.
  const spread = companions.reduce(
    (m, c) => Math.max(m, Math.abs(c.position[0]) + Math.abs(c.position[2])),
    0,
  )
  const shadowScale = 1.4 + lift * 1.6 + spread * 2.4
  const shadowFar = 0.55 + lift * 1.2

  return (
    <>
      {groundVisible && surface.geometry && (
        <mesh
          geometry={SURFACE_GEOMETRY[surface.geometry]()}
          position={[0, -0.0005, 0]}
          receiveShadow
          castShadow
          userData={{ ground: true }}
        >
          <meshStandardMaterial
            color={background.groundColor ?? surface.color}
            roughness={surface.roughness}
            metalness={surface.metalness}
            flatShading
          />
        </mesh>
      )}
      {groundVisible && !surface.geometry && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.0005, 0]} receiveShadow userData={{ ground: true }}>
          <planeGeometry args={[GROUND, GROUND]} />
          {surface.reflect ? (
            /*
             * A polished surface shows what is standing on it, and on a dark
             * one that reflection is the only thing holding the device down.
             * A contact shadow is a dark patch, which says nothing against an
             * almost-black floor — the machine ends up looking like it is
             * hovering over its own glow. The reference photo anchors its
             * monitor the same way: reflection, not shade.
             */
            <MeshReflectorMaterial
              key={kind}
              map={map}
              resolution={512}
              mixBlur={surface.reflect.mixBlur}
              mixStrength={surface.reflect.strength}
              blur={surface.reflect.blur}
              roughness={surface.roughness}
              depthScale={1.1}
              minDepthThreshold={0.4}
              maxDepthThreshold={1.3}
              color={map ? background.groundColor ?? '#ffffff' : background.groundColor ?? surface.color}
              metalness={surface.metalness}
              mirror={surface.reflect.mirror}
            />
          ) : (
            <meshStandardMaterial
              key={kind}
              map={map}
              color={map ? background.groundColor ?? '#ffffff' : background.groundColor ?? surface.color}
              roughness={surface.roughness}
              metalness={surface.metalness}
            />
          )}
        </mesh>
      )}
      {lighting.shadows && (
        <ContactShadows
          key={isPlaying ? 'animating' : poseKey}
          position={[0, shadowY + 0.001, 0]}
          opacity={shadowOpacity}
          scale={shadowScale}
          blur={shadowBlur}
          far={shadowFar}
          resolution={512}
          frames={isPlaying ? Infinity : 1}
        />
      )}
    </>
  )
}

/**
 * Full-frame dip-to-colour used for shot transitions. It is a quad parented to
 * nothing and re-seated in front of the camera every frame, so it covers the
 * view at any fov/aspect and is captured by the exporter like everything else.
 */
const _seat = new THREE.Vector3()

/**
 * Park a quad just in front of the near plane, square to the camera and big
 * enough to fill the frame at any fov or aspect. Used by both full-frame
 * overlays; they were carrying a copy each.
 */
function seatOnCamera(mesh, camera) {
  const dist = camera.near * 2.5
  const h = 2 * dist * Math.tan((camera.fov * DEG) / 2)
  mesh.scale.set(h * camera.aspect * 1.2, h * 1.2, 1)
  camera.updateMatrixWorld()
  mesh.quaternion.copy(camera.quaternion)
  mesh.position.copy(camera.position).add(_seat.set(0, 0, -dist).applyQuaternion(camera.quaternion))
  mesh.updateMatrixWorld()
}

/**
 * The title layer: same camera-locked quad trick as the dip-to-black, one
 * order below it so a fade covers the text rather than the text surviving it.
 */
function TitleOverlay({ meshRef, matRef, map }) {
  return (
    <mesh ref={meshRef} renderOrder={998} frustumCulled={false} visible={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        ref={matRef}
        map={map}
        transparent
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  )
}

function FadeOverlay({ meshRef, matRef }) {
  return (
    <mesh ref={meshRef} renderOrder={999} frustumCulled={false} visible={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        ref={matRef}
        color="#000000"
        transparent
        opacity={0}
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  )
}

/**
 * A second (or third) device standing alongside the hero.
 *
 * Posed by hand and never animated — see the note on `companions` in the
 * store. The lid is set imperatively for the same reason the hero's is: the
 * device components expose it as a ref on the hinge group, not as a prop.
 */
function Companion({ spec, texture, material, screen, textureAspect }) {
  const rootRef = useRef()
  const lidRef = useRef()
  const entry = DEVICES[spec.deviceId] ?? DEFAULT_DEVICE
  const Component = entry.Component

  // The screen texture is composited to the *hero's* aspect, so a companion of
  // a different shape would stretch it. Reshaping the companion's own body to
  // that aspect — exactly what Adapt does for the hero — makes its quad match
  // instead. Outside its own tolerance we leave the real shape alone and take
  // the stretch, which is the lesser of the two wrongs.
  const [lo, hi] = entry.adaptRange ?? [ADAPT_MIN, ADAPT_MAX]
  const wanted = textureAspect ? entry.screenAspect / textureAspect : 1
  const aspectScale = wanted >= lo && wanted <= hi ? wanted : 1

  useLayoutEffect(() => {
    if (lidRef.current) lidRef.current.rotation.x = ((spec.lidAngle ?? 102) - 90) * -DEG
  })

  return (
    <group
      position={spec.position}
      rotation={[spec.rotation[0] * DEG, spec.rotation[1] * DEG, spec.rotation[2] * DEG]}
      scale={spec.scale}
    >
      <Component
        rootRef={rootRef}
        lidRef={lidRef}
        texture={texture}
        material={material}
        screen={screen}
        aspectScale={aspectScale}
      />
    </group>
  )
}

function Rig() {
  const rootRef = useRef()
  const lidRef = useRef()
  const screenMatRef = useRef()
  const controlsRef = useRef()
  const fadeMeshRef = useRef()
  const fadeMatRef = useRef()
  const titleMeshRef = useRef()
  const titleMatRef = useRef()
  const titleLayer = useMemo(() => makeTitleLayer(), [])
  useEffect(() => () => titleLayer.dispose(), [titleLayer])
  const post = useMemo(() => makePostPass(), [])
  useEffect(() => () => post.dispose(), [post])
  const { camera, gl, scene, invalidate } = useThree()

  const deviceId = useStudio((s) => s.deviceId)
  const material = useStudio((s) => s.material)
  const screen = useStudio((s) => s.screen)
  const source = useStudio((s) => s.source)
  const orbitEnabled = useStudio((s) => s.orbitEnabled)
  const isPlaying = useStudio((s) => s.isPlaying)
  const previewLive = useStudio((s) => s.previewLive)
  const hasAnimation = useStudio((s) => s.keyframes.length >= 2)
  const draggingRef = useRef(false)
  const playRef = useRef(null)
  const lastPublished = useRef(0)

  // The timeline owns the camera during playback and while scrubbing a
  // keyframed animation; orbit controls must stand down or they fight it.
  const timelineOwnsCamera = isPlaying || (hasAnimation && !previewLive)

  const device = DEVICES[deviceId] ?? DEFAULT_DEVICE
  const adaptScreen = useStudio((s) => s.adaptScreen)
  const background = useStudio((s) => s.background)
  const sponsors = useStudio((s) => s.sponsors)
  const companions = useStudio((s) => s.companions)

  // With Adapt on the display takes the source's aspect ratio, stretched along
  // the display's height axis. Clamped, because some pairings are nonsense: a
  // landscape recording on a portrait phone, or a full-page screenshot on a
  // laptop, would otherwise deform the device beyond recognition. Outside the
  // clamp we keep the real device shape and let Fit (or scroll) handle it.
  const sourceAspect = source?.width && source?.height ? source.width / source.height : null
  const wanted = adaptScreen && sourceAspect ? device.screenAspect / sourceAspect : 1
  // Either adapt fully or not at all — a half-applied clamp would deform the
  // device without ever matching the source, which is the worst of both.
  // How far this particular body may be stretched before it stops reading as
  // itself. A laptop takes a lot; a tablet almost none.
  const [adaptMin, adaptMax] = device.adaptRange ?? [ADAPT_MIN, ADAPT_MAX]
  const adapted = !!sourceAspect && adaptScreen && wanted >= adaptMin && wanted <= adaptMax
  const aspectScale = adapted ? wanted : 1
  const effectiveAspect = adapted ? sourceAspect : device.screenAspect

  const screenSource = useMemo(
    () =>
      source ? createScreenSource(source, effectiveAspect, gl.capabilities.getMaxAnisotropy()) : null,
    [source, effectiveAspect, gl],
  )
  useEffect(() => () => screenSource?.dispose(), [screenSource])
  const texture = screenSource?.texture ?? null
  const target = useMemo(() => new THREE.Vector3(), [])

  useGradientBackground()
  useFog()
  useScreenGlowLayer()

  // Position everything for a given timeline time. Used by both the live
  // viewport loop and the frame-accurate exporter.
  const applyAt = useMemo(
    () => (time, { animated = false, driveCamera = false } = {}) => {
      const s = useStudio.getState()
      const live = { device: s.device, camera: s.camera, screen: s.screen }
      const eff = animated ? sampleAt(s.keyframes, time, live) : live

      const root = rootRef.current
      if (root) {
        root.position.set(...eff.device.position)
        root.rotation.set(eff.device.rotation[0] * DEG, eff.device.rotation[1] * DEG, eff.device.rotation[2] * DEG)
        root.scale.setScalar(eff.device.scale)
      }
      if (lidRef.current) lidRef.current.rotation.x = (eff.device.lidAngle - 90) * -DEG

      if (screenSource) {
        screenSource.draw(eff.screen)
        // The active texture can switch between the direct and composited
        // paths as the framing changes, so keep the material pointing at it.
        const mat = screenMatRef.current
        if (mat && mat.map !== screenSource.texture) {
          mat.map = screenSource.texture
          mat.needsUpdate = true
        }
      }
      if (screenMatRef.current) {
        const b = eff.screen.brightness
        screenMatRef.current.color.setRGB(b, b, b)
      }

      if (driveCamera) {
        // Shake is added after the timeline has had its say, so it rides on
        // top of the move instead of being part of it.
        const sh = shakeAt(time, s.shake)
        camera.position.set(...eff.camera.position)
        target.set(...eff.camera.target)
        let fov = eff.camera.fov
        if (sh) {
          camera.position.x += sh.pos[0]
          camera.position.y += sh.pos[1]
          camera.position.z += sh.pos[2]
          target.x += sh.aim[0]
          target.y += sh.aim[1]
          fov += sh.fov
        }
        camera.lookAt(target)
        if (camera.fov !== fov) {
          camera.fov = fov
          camera.updateProjectionMatrix()
        }
        // The controls track the un-shaken aim, or a drag would inherit the
        // wobble and the shake would slowly walk the camera off the subject.
        if (controlsRef.current) controlsRef.current.target.set(...eff.camera.target)
      }

      // A backdrop photo must keep its aspect whatever shape the output is —
      // stretching someone's own image to fit 9:16 is never what they meant.
      const bg = scene.background
      if (bg?.isTexture && bg.userData?.cover) {
        const iw = bg.image?.naturalWidth || bg.image?.width || 1
        const ih = bg.image?.naturalHeight || bg.image?.height || 1
        const frame = gl.domElement.width / gl.domElement.height
        const image = iw / ih
        // Cover fit first: the largest crop of the photo that fills the frame
        // without distorting it.
        let rx, ry
        if (image > frame) {
          rx = frame / image
          ry = 1
        } else {
          rx = 1
          ry = image / frame
        }
        // Then the user's own framing on top. Zoom shrinks the sampled window
        // (closer in), and X/Y slide it, so the photo can be moved behind a
        // device that never has to leave the origin.
        const bgs = useStudio.getState().background
        const zoom = Math.max(0.2, bgs.imageZoom ?? 1)
        rx /= zoom
        ry /= zoom
        bg.repeat.set(rx, ry)
        bg.offset.set(
          (1 - rx) / 2 + (bgs.imageX ?? 0),
          (1 - ry) / 2 - (bgs.imageY ?? 0),
        )
      }

      // Titles. Drawn at the drawing buffer's own size so type is rendered at
      // output resolution rather than scaled up from the preview's.
      const titleMesh = titleMeshRef.current
      if (titleMesh) {
        const titles = useStudio.getState().titles
        const on =
          titles.length > 0 &&
          titleLayer.draw(titles, time, gl.domElement.width, gl.domElement.height)
        titleMesh.visible = on
        if (on) seatOnCamera(titleMesh, camera)
      }

      // Transition overlay: sit just in front of the near plane, sized to the
      // current frustum so it always fills the frame.
      const fadeMesh = fadeMeshRef.current
      const fadeMat = fadeMatRef.current
      if (fadeMesh && fadeMat) {
        const amount = THREE.MathUtils.clamp(eff.post?.fade ?? 0, 0, 1)
        fadeMesh.visible = amount > 0.001
        fadeMat.opacity = amount
        if (fadeMesh.visible) {
          if (eff.post?.fadeColor) fadeMat.color.set(eff.post.fadeColor)
          seatOnCamera(fadeMesh, camera)
        }
      }
      return eff
    },
    [camera, target, screenSource, scene, gl],
  )

  useEffect(() => {
    studioApi.gl = gl
    studioApi.scene = scene
    studioApi.camera = camera
    studioApi.canvas = gl.domElement
    studioApi.applyAt = applyAt
    studioApi.renderFrame = () => post.render(gl, scene, camera, useStudio.getState().effects)
    studioApi.markScreenDirty = () => screenSource?.redraw()
    studioApi.setSharpTexture = (on) => screenSource?.setSharp(on)
    // Publish from here rather than main.jsx: under HMR the two files can end
    // up holding different module instances of studioApi.
    if (import.meta.env.DEV) window.__studioApi = studioApi
    return () => {
      if (studioApi.applyAt === applyAt) studioApi.applyAt = null
    }
  }, [gl, scene, camera, applyAt, screenSource, post])

  // Numeric camera edits have to reach the camera even while orbit is on.
  // Orbit owns the camera between drags, so anything typed into the panel (or
  // written by Float tracking the device) was silently discarded. Apply store
  // changes whenever they did not come from a drag; syncCameraToStore ignores
  // the resulting change event, so there is no loop.
  useEffect(() => {
    let prev = useStudio.getState().camera
    return useStudio.subscribe((s) => {
      const c = s.camera
      if (c === prev) return
      prev = c
      if (draggingRef.current || s.isPlaying || s.exporting) return
      if (s.keyframes.length >= 2 && !s.previewLive) return
      camera.position.set(...c.position)
      if (camera.fov !== c.fov) {
        camera.fov = c.fov
        camera.updateProjectionMatrix()
      }
      const ctrl = controlsRef.current
      if (ctrl) {
        ctrl.target.set(...c.target)
        ctrl.update()
      } else {
        camera.lookAt(...c.target)
      }
      invalidate()
    })
  }, [camera, invalidate])

  const exposure = useStudio((s) => s.lighting.exposure)
  useEffect(() => {
    gl.toneMappingExposure = exposure ?? 1
    invalidate()
  }, [gl, exposure, invalidate])

  // Snapshot of what is on screen right now. The camera is read from the live
  // object rather than the store so a mouse orbit is captured smoothly, not
  // only at the points where the controls happen to write back.
  const liveSnapshot = () => {
    const s = useStudio.getState()
    const t = controlsRef.current?.target
    const r4 = (n) => +n.toFixed(4)
    return {
      device: JSON.parse(JSON.stringify(s.device)),
      camera: {
        position: [r4(camera.position.x), r4(camera.position.y), r4(camera.position.z)],
        target: t ? [r4(t.x), r4(t.y), r4(t.z)] : [...s.camera.target],
        fov: camera.fov,
      },
      screen: JSON.parse(JSON.stringify(s.screen)),
      post: JSON.parse(JSON.stringify(s.post)),
    }
  }

  // Priority 1 takes rendering away from R3F, which is the only way to put a
  // pass between the scene and the canvas.
  useFrame((_, delta) => {
    const s = useStudio.getState()
    const exporting = !!s.exporting
    if (exporting) return // the exporter drives applyAt + render itself

    // ---- live recording ----
    const rec = s.recording
    if (rec) {
      const t = (performance.now() - rec.startedAt) / 1000
      const n = rec.samples.length
      if (!n || t - rec.samples[n - 1].time >= 1 / 30) rec.samples.push({ time: t, state: liveSnapshot() })
      // The user is driving; just show the live pose and keep the readout moving.
      applyAt(t, { animated: false, driveCamera: false })
      if (Math.abs(s.playhead - t) > 0.05) useStudio.setState({ playhead: t })
      const rv = source?.kind === 'video' ? source.el : null
      if (rv && rv.paused) rv.play().catch(() => {})
      return
    }

    const hasAnim = s.keyframes.length >= 2
    const v = source?.kind === 'video' ? source.el : null

    if (s.isPlaying) {
      // The playhead is advanced on a ref, not in the store. Writing it to the
      // store every frame re-renders the timeline sixty times a second for a
      // readout nobody can read that fast; the scene still moves at full rate.
      if (playRef.current === null) playRef.current = s.playhead
      let t = playRef.current + delta
      let looped = false
      if (t >= s.duration) {
        t = 0
        looped = true
      }
      playRef.current = t
      if (looped || t - lastPublished.current > 0.05) {
        lastPublished.current = t
        useStudio.setState({ playhead: t, previewLive: false })
      }
      applyAt(t, { animated: hasAnim, driveCamera: true })
      if (v && v.duration) {
        if (looped) v.currentTime = 0
        if (v.paused) v.play().catch(() => {})
        // The element free-runs once started and drifts from the playhead (it
        // takes a moment to spin up). Nudge it back so the preview shows the
        // same frame the export will put at this time.
        const want = t % v.duration
        if (!looped && Math.abs(v.currentTime - want) > 0.25) v.currentTime = want
      }
    } else {
      // While scrubbing a keyframed timeline the playhead owns the pose;
      // as soon as a control is touched the live values take over again.
      playRef.current = null
      const animated = hasAnim && !s.previewLive
      applyAt(s.playhead, { animated, driveCamera: animated || !s.orbitEnabled })

      if (v && v.duration) {
        if (s.autoplay) {
          // Live preview: let the recording run on the device while you work.
          if (v.paused) v.play().catch(() => {})
        } else {
          // Locked to the playhead, which is what the export will render. The
          // compositor redraws from the element every frame, so a landed seek
          // reaches the GPU without any extra prodding.
          if (!v.paused) v.pause()
          const want = s.playhead % v.duration
          if (Math.abs(v.currentTime - want) > 0.08) v.currentTime = want
        }
      }
    }

    // We own the frame now, so nothing else is going to draw it.
    post.render(gl, scene, camera, s.effects)
  }, 1)

  // Only mirror the camera into the store for changes the user actually made —
  // otherwise driving the camera from the timeline would write itself back in.
  const syncCameraToStore = () => {
    const c = controlsRef.current
    if (!c || !draggingRef.current) return
    const s = useStudio.getState()
    if (s.isPlaying || s.exporting || !s.orbitEnabled) return
    useStudio.getState().update('camera', {
      position: [
        +camera.position.x.toFixed(3),
        +camera.position.y.toFixed(3),
        +camera.position.z.toFixed(3),
      ],
      target: [+c.target.x.toFixed(3), +c.target.y.toFixed(3), +c.target.z.toFixed(3)],
    })
  }

  const DeviceComponent = device.Component

  return (
    <>
      <Lights />
      <Ground />
      <FloorSponsors />
      <Props visible={!!background.props} />
      <FadeOverlay meshRef={fadeMeshRef} matRef={fadeMatRef} />
      <TitleOverlay meshRef={titleMeshRef} matRef={titleMatRef} map={titleLayer.texture} />
      <DeviceComponent
        rootRef={rootRef}
        lidRef={lidRef}
        texture={texture}
        screenMatRef={screenMatRef}
        material={material}
        screen={screen}
        aspectScale={aspectScale}
        sponsors={sponsors}
      />
      {companions.map((c) => (
        <Companion
          key={c.id}
          spec={c}
          texture={texture}
          material={material}
          screen={screen}
          textureAspect={effectiveAspect}
        />
      ))}
      {/*
        minDistance was 0.25, and it was an invisible wall.

        A dead-on hero shot of a laptop — the kind where the trackpad runs
        away from the viewer and the base fills the bottom of the frame —
        sits about 0.22 from the subject on a wide lens. With the old floor
        the controls silently clamped the camera back to 0.25 every time the
        store pushed a closer position, so the shot was simply unreachable
        and nothing said why: the numbers in the panel read back correctly
        while the camera sat somewhere else entirely. The device is 0.34
        across, so 0.05 still stops anyone ending up inside it.
      */}
      <OrbitControls
        ref={controlsRef}
        enabled={orbitEnabled && !timelineOwnsCamera}
        enableDamping
        dampingFactor={0.08}
        minDistance={0.05}
        maxDistance={12}
        onStart={() => {
          draggingRef.current = true
        }}
        onChange={syncCameraToStore}
        onEnd={() => {
          syncCameraToStore()
          draggingRef.current = false
        }}
        makeDefault
      />
    </>
  )
}

/**
 * Device pixel ratio is a trap on a big window: at 1.5 a 1920x1080 viewport is
 * 4.6 million fragments a frame, and the preview drops to a crawl while a small
 * pane at the same ratio sails along. Budget the drawing buffer instead, so the
 * ratio falls back on large windows and stays crisp on small ones.
 */
const PIXEL_BUDGET = 2_300_000

function useBudgetedDpr() {
  const pick = () => {
    const w = window.innerWidth
    const h = window.innerHeight
    const ideal = Math.min(window.devicePixelRatio || 1, 1.5)
    const fit = Math.sqrt(PIXEL_BUDGET / Math.max(1, w * h))
    return Math.max(0.75, Math.min(ideal, fit))
  }
  const [dpr, setDpr] = React.useState(pick)
  useEffect(() => {
    const onResize = () => setDpr(pick())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return dpr
}

export default function Studio() {
  const camera = useStudio((s) => s.camera)
  const bg = useStudio((s) => s.background)
  const dpr = useBudgetedDpr()

  return (
    <Canvas
      shadows
      dpr={dpr}
      gl={{
        antialias: true,
        preserveDrawingBuffer: true,
        alpha: true, // must exist up front; the context cannot gain alpha later
        toneMapping: THREE.ACESFilmicToneMapping,
      }}
      camera={{ position: camera.position, fov: camera.fov, near: 0.01, far: 100 }}
    >
      <Rig />
    </Canvas>
  )
}
