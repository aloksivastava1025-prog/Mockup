import React, { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, MeshReflectorMaterial, OrbitControls } from '@react-three/drei'
import { useStudio } from '../store/useStudio.js'
import { DEVICES } from '../devices/index.js'
import { sampleAt } from '../anim/interpolate.js'
import { createScreenCompositor } from '../hooks/useScreenTexture.js'
import { studioApi } from './studioApi.js'

const DEG = Math.PI / 180

// How far Adapt may deform a device before we decide the pairing is nonsense.
const ADAPT_MIN = 0.6
const ADAPT_MAX = 1.7

function useGradientBackground() {
  const { scene } = useThree()
  const background = useStudio((s) => s.background)

  useEffect(() => {
    if (background.mode === 'transparent') {
      scene.background = null
      return
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
  }, [scene, background.mode, background.color, background.colorTop, background.colorBottom])
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
  const matte = (background.groundStyle ?? 'reflective') === 'matte'

  // Contact shadows cost a full extra scene render per frame. While a video
  // plays the device and camera are usually still — only the screen content
  // changes — so the shadow is identical frame after frame. Recompute it once
  // per pose instead, and only fall back to continuous updates when the
  // timeline is actually moving the device.
  const isPlaying = useStudio((s) => s.isPlaying)
  const pose = useStudio((s) => s.device)
  const poseKey = `${pose.position.join()}|${pose.rotation.join()}|${pose.lidAngle}|${pose.scale}`

  return (
    <>
      {groundVisible && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.0005, 0]} receiveShadow userData={{ ground: true }}>
          <planeGeometry args={[24, 24]} />
          {matte ? (
            <meshStandardMaterial color={background.groundColor ?? '#d2d2d2'} roughness={0.9} metalness={0} />
          ) : (
            <MeshReflectorMaterial
              resolution={512}
              mixBlur={1}
              mixStrength={12}
              blur={[320, 90]}
              roughness={0.85}
              depthScale={1.1}
              minDepthThreshold={0.4}
              maxDepthThreshold={1.3}
              color="#0d0f14"
              metalness={0.5}
              mirror={0.35}
            />
          )}
        </mesh>
      )}
      {lighting.shadows && (
        <ContactShadows
          key={isPlaying ? 'animating' : poseKey}
          position={[0, 0.001, 0]}
          opacity={lighting.shadowOpacity}
          scale={1.4}
          blur={lighting.shadowBlur}
          far={0.55}
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

function Rig() {
  const rootRef = useRef()
  const lidRef = useRef()
  const screenMatRef = useRef()
  const controlsRef = useRef()
  const fadeMeshRef = useRef()
  const fadeMatRef = useRef()
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

  // The timeline owns the camera during playback and while scrubbing a
  // keyframed animation; orbit controls must stand down or they fight it.
  const timelineOwnsCamera = isPlaying || (hasAnimation && !previewLive)

  const device = DEVICES[deviceId] ?? DEVICES.laptop
  const adaptScreen = useStudio((s) => s.adaptScreen)

  // With Adapt on the display takes the source's aspect ratio, stretched along
  // the display's height axis. Clamped, because some pairings are nonsense: a
  // landscape recording on a portrait phone, or a full-page screenshot on a
  // laptop, would otherwise deform the device beyond recognition. Outside the
  // clamp we keep the real device shape and let Fit (or scroll) handle it.
  const sourceAspect = source?.width && source?.height ? source.width / source.height : null
  const wanted = adaptScreen && sourceAspect ? device.screenAspect / sourceAspect : 1
  // Either adapt fully or not at all — a half-applied clamp would deform the
  // device without ever matching the source, which is the worst of both.
  const adapted = !!sourceAspect && adaptScreen && wanted >= ADAPT_MIN && wanted <= ADAPT_MAX
  const aspectScale = adapted ? wanted : 1
  const effectiveAspect = adapted ? sourceAspect : device.screenAspect

  const compositor = useMemo(
    () =>
      source
        ? createScreenCompositor(source, effectiveAspect, gl.capabilities.getMaxAnisotropy())
        : null,
    [source, effectiveAspect, gl],
  )
  useEffect(() => () => compositor?.dispose(), [compositor])
  const texture = compositor?.texture ?? null
  const target = useMemo(() => new THREE.Vector3(), [])

  useGradientBackground()

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

      if (compositor) compositor.draw(eff.screen)
      if (screenMatRef.current) {
        const b = eff.screen.brightness
        screenMatRef.current.color.setRGB(b, b, b)
      }

      if (driveCamera) {
        camera.position.set(...eff.camera.position)
        target.set(...eff.camera.target)
        camera.lookAt(target)
        if (camera.fov !== eff.camera.fov) {
          camera.fov = eff.camera.fov
          camera.updateProjectionMatrix()
        }
        if (controlsRef.current) controlsRef.current.target.copy(target)
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
          const dist = camera.near * 2.5
          const h = 2 * dist * Math.tan((camera.fov * DEG) / 2)
          fadeMesh.scale.set(h * camera.aspect * 1.2, h * 1.2, 1)
          camera.updateMatrixWorld()
          fadeMesh.quaternion.copy(camera.quaternion)
          fadeMesh.position.copy(camera.position).add(
            new THREE.Vector3(0, 0, -dist).applyQuaternion(camera.quaternion),
          )
          fadeMesh.updateMatrixWorld()
        }
      }
      return eff
    },
    [camera, target, compositor],
  )

  useEffect(() => {
    studioApi.gl = gl
    studioApi.scene = scene
    studioApi.camera = camera
    studioApi.canvas = gl.domElement
    studioApi.applyAt = applyAt
    studioApi.renderFrame = () => gl.render(scene, camera)
    studioApi.markScreenDirty = () => compositor?.redraw()
    studioApi.setFastTexture = (fast) => compositor?.setFast(fast)
    // Publish from here rather than main.jsx: under HMR the two files can end
    // up holding different module instances of studioApi.
    if (import.meta.env.DEV) window.__studioApi = studioApi
    return () => {
      if (studioApi.applyAt === applyAt) studioApi.applyAt = null
    }
  }, [gl, scene, camera, applyAt, compositor])

  const exposure = useStudio((s) => s.lighting.exposure)
  useEffect(() => {
    gl.toneMappingExposure = exposure ?? 1
    invalidate()
  }, [gl, exposure, invalidate])

  // Keep fov in sync while the user is driving the camera by hand.
  useEffect(() => {
    const unsub = useStudio.subscribe((s) => {
      if (camera.fov !== s.camera.fov) {
        camera.fov = s.camera.fov
        camera.updateProjectionMatrix()
        invalidate()
      }
    })
    return unsub
  }, [camera, invalidate])

  useFrame((_, delta) => {
    const s = useStudio.getState()
    const exporting = !!s.exporting
    if (exporting) return // the exporter drives applyAt + render itself

    const hasAnim = s.keyframes.length >= 2
    const v = source?.kind === 'video' ? source.el : null

    if (s.isPlaying) {
      let t = s.playhead + delta
      let looped = false
      if (t >= s.duration) {
        t = 0
        looped = true
      }
      useStudio.setState({ playhead: t, previewLive: false })
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
  })

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
      <FadeOverlay meshRef={fadeMeshRef} matRef={fadeMatRef} />
      <DeviceComponent
        rootRef={rootRef}
        lidRef={lidRef}
        texture={texture}
        screenMatRef={screenMatRef}
        material={material}
        screen={screen}
        aspectScale={aspectScale}
      />
      <OrbitControls
        ref={controlsRef}
        enabled={orbitEnabled && !timelineOwnsCamera}
        enableDamping
        dampingFactor={0.08}
        minDistance={0.25}
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

export default function Studio() {
  const camera = useStudio((s) => s.camera)
  const bg = useStudio((s) => s.background)

  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
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
