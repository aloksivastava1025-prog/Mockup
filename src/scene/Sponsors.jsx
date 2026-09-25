import React, { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import { useStudio } from '../store/useStudio.js'
import { pickImage } from '../ui/pickImage.js'

/**
 * Sponsor marks on the palm rest, either side of the trackpad.
 *
 * Editor only, and that is the whole design. Baked into the model they would
 * land in every export, and the user's export is marketing for *their*
 * product — a third party's logo in it makes the file unusable and they leave.
 * These live where a sponsor actually gets seen, which is while someone is
 * composing, and they are gone the moment a frame is rendered for keeps.
 *
 * Etched rather than printed: at rest they are a faint tone-on-tone mark, the
 * way a real laptop's regulatory text is. Hover lifts one, brightens it and
 * turns the cursor into a pointer; the whole thing is quiet until you go
 * looking at it.
 */

const BADGE_W = 512
const BADGE_H = 160

/**
 * Rounded corners for a square sticker.
 *
 * A real sticker is die-cut, and a hard-cornered square on a palm rest reads
 * as a texture bug rather than as a sticker. Cached, since every sticker at a
 * given size wants the same mask.
 */
let stickerMask = null
function cornerMask() {
  if (stickerMask) return stickerMask
  const S = 512
  const c = document.createElement('canvas')
  c.width = S
  c.height = S
  const g = c.getContext('2d')
  g.fillStyle = '#000000'
  g.fillRect(0, 0, S, S)
  g.fillStyle = '#ffffff'
  g.beginPath()
  g.roundRect(0, 0, S, S, S * 0.14)
  g.fill()
  stickerMask = new THREE.CanvasTexture(c)
  stickerMask.colorSpace = THREE.NoColorSpace
  return stickerMask
}

/** Draws a name into a texture, so a sponsor costs a string and not an asset. */
function badgeTexture(label, bright, fill) {
  const c = document.createElement('canvas')
  c.width = BADGE_W
  c.height = BADGE_H
  const g = c.getContext('2d')
  g.clearRect(0, 0, BADGE_W, BADGE_H)
  // White is right on a dark palm rest and invisible on a pale floor, so the
  // caller can name a fill that survives whichever surface it lands on.
  g.fillStyle = fill ?? (bright ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.30)')
  g.font = `600 ${Math.round(BADGE_H * 0.42)}px -apple-system, "Segoe UI", Inter, sans-serif`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.letterSpacing = '4px'
  g.fillText(label, BADGE_W / 2, BADGE_H / 2)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

/** An image sticker, die-cut square, sitting proud of the deck. */
function ImageSticker({ sponsor, x, z, y }) {
  const [hot, setHot] = useState(false)
  const mask = useMemo(() => cornerMask(), [])

  // Loaded by hand rather than with useLoader, which suspends. There is no
  // Suspense boundary inside the Canvas, so suspending here takes the whole
  // app down to a blank page — which is exactly what it did.
  const [map, setMap] = useState(null)
  useEffect(() => {
    let alive = true
    new THREE.TextureLoader().load(sponsor.image, (t) => {
      if (!alive) return t.dispose()
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = 8
      setMap(t)
    })
    return () => {
      alive = false
    }
  }, [sponsor.image])

  if (!map) return null

  return (
    <group position={[x, y + (hot ? 0.07 : 0.004), z]} scale={hot ? 1.1 : 1}>
      {/* the sticker */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHot(true)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          setHot(false)
          document.body.style.cursor = ''
        }}
        onClick={(e) => {
          e.stopPropagation()
          window.open(sponsor.url, '_blank', 'noopener,noreferrer')
        }}
      >
        <planeGeometry args={[3.5, 3.5]} />
        <meshBasicMaterial map={map} alphaMap={mask} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      {/* A shadow of its own once lifted, or it floats. */}
      {hot && (
        <mesh position={[0, -0.07, 0.05]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[3.6, 3.6]} />
          <meshBasicMaterial color="#000000" alphaMap={mask} transparent opacity={0.22} depthWrite={false} />
        </mesh>
      )}
    </group>
  )
}

function Badge({ sponsor, x, z, y }) {
  const [hot, setHot] = useState(false)
  const dim = useMemo(() => badgeTexture(sponsor.label, false), [sponsor.label])
  const lit = useMemo(() => badgeTexture(sponsor.label, true), [sponsor.label])

  return (
    <mesh
      position={[x, y + (hot ? 0.06 : 0), z]}
      rotation={[-Math.PI / 2, 0, 0]}
      scale={hot ? 1.08 : 1}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHot(true)
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        setHot(false)
        document.body.style.cursor = ''
      }}
      onClick={(e) => {
        e.stopPropagation()
        // Opened in a tab of its own, and never from a render loop — this only
        // ever runs from a real click on the mesh.
        window.open(sponsor.url, '_blank', 'noopener,noreferrer')
      }}
    >
      <planeGeometry args={[3.5, 1.09]} />
      <meshBasicMaterial map={hot ? lit : dim} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

/**
 * `deck` is where the palm rest sits in the device's own authored units, which
 * the caller knows and this does not: every device has a different scale.
 */
export default function Sponsors({ sponsors = [], deck }) {
  const exporting = useStudio((s) => s.exporting)
  const deckMarks = sponsors.filter((s) => s.where !== 'floor')
  if (exporting || !deckMarks.length || !deck) return null

  // Left of the trackpad first, then right, then wrap. Two is the sensible
  // maximum; a palm rest covered in logos is a billboard, not a laptop.
  const slots = [
    [-deck.side, deck.z],
    [deck.side, deck.z],
  ]

  return (
    <group>
      {deckMarks.slice(0, 2).map((s, i) =>
        s.image ? (
          <ImageSticker key={s.id} sponsor={s} x={slots[i][0]} z={slots[i][1]} y={deck.y} />
        ) : (
          <Badge key={s.id} sponsor={s} x={slots[i][0]} z={slots[i][1]} y={deck.y} />
        ),
      )}
    </group>
  )
}


/* ------------------------------------------------------------------ */
/* Floor slots                                                         */
/* ------------------------------------------------------------------ */

/**
 * Sponsor placements on the surface the device stands on.
 *
 * The grid lives in the store so it is editable: click an empty slot and it
 * asks for an image there and then, rather than sending you to a panel to do
 * it. Clicking is how you found the slot, so clicking should be how you fill
 * it. Size and position are on the panel, where a slider belongs.
 *
 * Editor only, like the deck marks. None of this is in an export.
 */

/** The dashed outline of a slot nobody has bought yet. */
const emptyTexCache = new Map()
function emptySlotTexture(active) {
  const key = active ? 'on' : 'off'
  if (emptyTexCache.has(key)) return emptyTexCache.get(key)
  const S = 512
  const c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')
  // Mid grey at low alpha, deliberately: the floor is white in Studio and
  // near-black in Night, and a colour picked for one disappears on the other.
  g.strokeStyle = active ? 'rgba(45,140,255,0.95)' : 'rgba(128,128,128,0.55)'
  g.lineWidth = S * (active ? 0.026 : 0.018)
  g.setLineDash([S * 0.05, S * 0.04])
  g.beginPath()
  g.roundRect(g.lineWidth, g.lineWidth, S - g.lineWidth * 2, S - g.lineWidth * 2, S * 0.1)
  g.stroke()
  g.setLineDash([])
  g.fillStyle = active ? 'rgba(45,140,255,0.95)' : 'rgba(128,128,128,0.5)'
  g.font = `600 ${Math.round(S * 0.085)}px -apple-system, "Segoe UI", Inter, sans-serif`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.letterSpacing = '6px'
  g.fillText(active ? 'UPLOAD' : 'SLOT', S / 2, S / 2)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  emptyTexCache.set(key, tex)
  return tex
}

/** The marching-ants frame drawn around whichever slot the panel is editing. */
let selectionTex = null
function selectionTexture() {
  if (selectionTex) return selectionTex
  const S = 256
  const c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')
  g.strokeStyle = 'rgba(45,140,255,0.9)'
  g.lineWidth = S * 0.02
  g.beginPath()
  g.roundRect(g.lineWidth, g.lineWidth, S - g.lineWidth * 2, S - g.lineWidth * 2, S * 0.08)
  g.stroke()
  selectionTex = new THREE.CanvasTexture(c)
  selectionTex.colorSpace = THREE.SRGBColorSpace
  return selectionTex
}

function FloorMark({ slot, selected }) {
  const [hot, setHot] = useState(false)
  const mask = useMemo(() => cornerMask(), [])
  const selectSlot = useStudio((s) => s.selectSlot)
  const updateSlot = useStudio((s) => s.updateSlot)
  const empty = !slot.image
  const wordmark = useMemo(
    () => (!slot.image && slot.label ? badgeTexture(slot.label, true, 'rgba(120,120,120,0.9)') : null),
    [slot.image, slot.label],
  )

  const [map, setMap] = useState(null)
  useEffect(() => {
    if (!slot.image) return setMap(null)
    let alive = true
    new THREE.TextureLoader().load(slot.image, (t) => {
      if (!alive) return t.dispose()
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = 8
      setMap(t)
    })
    return () => {
      alive = false
    }
  }, [slot.image])

  const w = slot.size * (hot ? 1.06 : 1)
  // Just clear of the floor plane at -0.0005. Any closer and the two z-fight.
  const y = 0.0015 + (hot ? 0.01 : 0)

  const handlers = {
    onPointerOver: (e) => {
      e.stopPropagation()
      setHot(true)
      document.body.style.cursor = 'pointer'
    },
    onPointerOut: () => {
      setHot(false)
      document.body.style.cursor = ''
    },
    onClick: async (e) => {
      e.stopPropagation()
      selectSlot(slot.id)
      // An empty slot asks for an image right where you clicked. A filled one
      // only selects — replacing artwork is a deliberate act and belongs on
      // the panel, next to an undo you can see.
      if (!slot.image) {
        const data = await pickImage()
        if (data) updateSlot(slot.id, { image: data })
      }
    },
  }

  const face = map
    ? { map, alphaMap: mask }
    : wordmark
    ? { map: wordmark }
    : { map: emptySlotTexture(hot) }
  const h = !map && wordmark ? w * (BADGE_H / BADGE_W) : w

  return (
    <group
      position={[slot.x, y, slot.z]}
      rotation={[-Math.PI / 2, 0, ((slot.rot ?? 0) * Math.PI) / 180]}
    >
      <mesh {...handlers}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial {...face} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      {selected && (
        <mesh position={[0, 0, -0.0005]} raycast={() => null}>
          <planeGeometry args={[slot.size * 1.16, slot.size * 1.16]} />
          <meshBasicMaterial map={selectionTexture()} transparent depthWrite={false} toneMapped={false} />
        </mesh>
      )}
    </group>
  )
}

export function FloorSponsors() {
  const exporting = useStudio((s) => s.exporting)
  const groundVisible = useStudio((s) => s.background.groundVisible)
  const slotsVisible = useStudio((s) => s.slotsVisible)
  const slots = useStudio((s) => s.floorSlots)
  const selected = useStudio((s) => s.selectedSlot)
  if (exporting || !groundVisible || !slotsVisible) return null

  return (
    <group>
      {slots.map((slot) => (
        <FloorMark key={slot.id} slot={slot} selected={selected === slot.id} />
      ))}
    </group>
  )
}
