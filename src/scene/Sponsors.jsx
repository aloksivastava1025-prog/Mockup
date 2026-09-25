import React, { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import { useStudio } from '../store/useStudio.js'

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
 * Laid out as a fixed grid of slots rather than wherever a logo happens to
 * land, for two reasons. A buyer is buying a position, and a position only
 * means something if it is the same one every time. And an empty slot that is
 * *drawn* is inventory a visitor can see going spare — a blank floor sells
 * nothing.
 *
 * Further out means bigger: a mark twice the distance away needs roughly twice
 * the size to read the same in frame, so the back row is not a row of specks.
 *
 * Editor only, like the deck marks. None of this is in an export.
 */
const FLOOR_SLOTS = [
  // Flanks and behind, never straight out in front: a = 0 is the lane the
  // camera itself stands in, and a mark placed there is either under the lens
  // or behind it. The floor a viewer actually sees is beside the device.
  { a: -80, r: 0.6, s: 0.22 },
  { a: 80, r: 0.6, s: 0.22 },
  { a: -140, r: 0.62, s: 0.22 },
  { a: 140, r: 0.62, s: 0.22 },
  // Outer ring, offset in angle so nothing sits directly behind an inner mark,
  // and larger: twice the distance needs roughly twice the size to read the
  // same in frame.
  { a: -55, r: 1.05, s: 0.34 },
  { a: 55, r: 1.05, s: 0.34 },
  { a: -110, r: 1.1, s: 0.34 },
  { a: 110, r: 1.1, s: 0.34 },
  { a: 180, r: 1.0, s: 0.34 },
].map(({ a, r, s }) => {
  const rad = (a * Math.PI) / 180
  // a = 0 is straight out in front of the device, toward the default camera.
  return { x: +(Math.sin(rad) * r).toFixed(4), z: +(Math.cos(rad) * r).toFixed(4), size: s }
})

/** The dashed outline of a slot nobody has bought yet. */
let emptyTex = null
function emptySlotTexture() {
  if (emptyTex) return emptyTex
  const S = 512
  const c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')
  // Mid grey at low alpha, deliberately: the floor is white in Studio and
  // near-black in Night, and a colour picked for one disappears on the other.
  g.strokeStyle = 'rgba(128,128,128,0.55)'
  g.lineWidth = S * 0.018
  g.setLineDash([S * 0.05, S * 0.04])
  g.beginPath()
  g.roundRect(g.lineWidth, g.lineWidth, S - g.lineWidth * 2, S - g.lineWidth * 2, S * 0.1)
  g.stroke()
  g.setLineDash([])
  g.fillStyle = 'rgba(128,128,128,0.5)'
  g.font = `600 ${Math.round(S * 0.085)}px -apple-system, "Segoe UI", Inter, sans-serif`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.letterSpacing = '6px'
  g.fillText('SLOT', S / 2, S / 2)
  emptyTex = new THREE.CanvasTexture(c)
  emptyTex.colorSpace = THREE.SRGBColorSpace
  emptyTex.anisotropy = 8
  return emptyTex
}

function FloorMark({ sponsor, slot }) {
  const [hot, setHot] = useState(false)
  const mask = useMemo(() => cornerMask(), [])
  const empty = !sponsor
  const wordmark = useMemo(
    () => (sponsor && !sponsor.image ? badgeTexture(sponsor.label, true, 'rgba(120,120,120,0.9)') : null),
    [sponsor],
  )

  const [map, setMap] = useState(null)
  useEffect(() => {
    if (!sponsor?.image) return setMap(null)
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
  }, [sponsor])

  const w = slot.size * (hot ? 1.08 : 1)
  // Just clear of the floor plane at -0.0005. Any closer and the two z-fight.
  const y = 0.0015 + (hot ? 0.02 : 0)

  const common = {
    onPointerOver: (e) => {
      if (empty) return
      e.stopPropagation()
      setHot(true)
      document.body.style.cursor = 'pointer'
    },
    onPointerOut: () => {
      setHot(false)
      document.body.style.cursor = ''
    },
    onClick: (e) => {
      if (empty) return
      e.stopPropagation()
      window.open(sponsor.url, '_blank', 'noopener,noreferrer')
    },
  }

  if (empty) {
    return (
      <mesh position={[slot.x, 0.0015, slot.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[slot.size, slot.size]} />
        <meshBasicMaterial map={emptySlotTexture()} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    )
  }

  if (wordmark) {
    return (
      <mesh position={[slot.x, y, slot.z]} rotation={[-Math.PI / 2, 0, 0]} {...common}>
        <planeGeometry args={[w, w * (BADGE_H / BADGE_W)]} />
        <meshBasicMaterial map={wordmark} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    )
  }

  if (!map) return null
  return (
    <mesh position={[slot.x, y, slot.z]} rotation={[-Math.PI / 2, 0, 0]} {...common}>
      <planeGeometry args={[w, w]} />
      <meshBasicMaterial map={map} alphaMap={mask} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

export function FloorSponsors({ sponsors = [] }) {
  const exporting = useStudio((s) => s.exporting)
  const groundVisible = useStudio((s) => s.background.groundVisible)
  if (exporting || !groundVisible) return null

  // A sponsor may name its slot; anything unnumbered fills the next free one,
  // so adding a logo never silently moves the ones already sold.
  const floor = sponsors.filter((s) => s.where === 'floor')
  // No sponsors on the floor means no empty slots either. Dashed boxes around
  // a scene nobody is selling are just litter in everyone else's shot.
  if (!floor.length) return null
  const taken = new Map()
  const queue = []
  for (const s of floor) {
    if (Number.isInteger(s.slot) && FLOOR_SLOTS[s.slot] && !taken.has(s.slot)) taken.set(s.slot, s)
    else queue.push(s)
  }
  FLOOR_SLOTS.forEach((_, i) => {
    if (!taken.has(i) && queue.length) taken.set(i, queue.shift())
  })

  return (
    <group>
      {FLOOR_SLOTS.map((slot, i) => (
        <FloorMark key={i} slot={slot} sponsor={taken.get(i)} />
      ))}
    </group>
  )
}
