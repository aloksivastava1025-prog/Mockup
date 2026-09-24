# 3D Device Mockup Studio

Browser-based 3D mockup editor: drop in a website screen recording or
screenshot, map it onto a realistic device display, pose the scene, animate it,
and export a finished video or still.

```bash
npm install
npm run dev     # http://localhost:5183
```

## How it works

Add media → choose device → position → animate → export.

The source can be a **screen recording** or a **screenshot**. A full-page
screenshot taller than the display is scrolled through rather than squashed:
`screen.scroll` runs 0 (top of page) to 1 (bottom), and the *Scroll page*
preset keyframes it end to end.

Output goes to **MP4** (the timeline) or **PNG** (the current frame), in
16:9, 9:16, 1:1 or 4:5. A PNG can be exported as a cutout — transparent
background with the floor removed. **Draft** renders small, at 24fps and
without mipmapping, for checking timing before committing to a full render.

Projects save to a `.mockup.json` file (Ctrl+S) holding the scene but not the
media, which is far too large for it; reopening asks you to re-attach the
source. The document also autosaves to localStorage, offered as *Restore last
session*. `Ctrl+Z` / `Ctrl+Shift+Z` undo and redo.

- **Add media** — drag an MP4/WebM/PNG/JPG onto the viewport, or use *Add media*.
  It is composited onto the device display.
- **Position** — drag in the viewport to orbit, or type exact values. Device
  position/rotation/scale, lid angle, camera position, look-at point and focal
  length (FOV) are all numeric fields.
- **Animate** — pose the scene and press **+ Keyframe** (or `K`) to pin it at the
  playhead. Two or more keyframes animate, eased with smoothstep between them.
  The short presets (Open lid, Orbit, Push in, Hero reveal) build keyframes from
  whatever pose you are currently in. **Cinematic 2 min** is a full nine-shot
  film: it sets a 120s timeline, all the keyframes, and its own lighting.
- **Export** — renders the timeline frame by frame at the chosen resolution and
  frame rate, so the output is frame-accurate regardless of viewport performance.

### Recording a take

Instead of placing keyframes by hand, press **● Record** and perform the shot:
orbit the camera, open the lid, drag any control. Everything is sampled at
~30Hz and, on Stop, reduced to a keyframe track you can then play back, edit
and export like any other.

The reduction matters — a 20 second take sampled raw would be 600 keyframes,
nearly all redundant, since while you drag one control nothing else moves.
`anim/record.js` keeps a sample only when a field has changed by more than its
own perceptual tolerance (a millimetre of camera travel, a third of a degree
of rotation) or half a second has passed, which collapses a take to a handful
of points. Recording also restarts the footage from the top, so the take lines
up with what the export renders.

### Adapt

On by default, in the Screen panel. The display takes the footage's aspect
ratio so a recording fills it exactly — no crop and no letterbox bars.

It works by scaling the whole chassis along its depth, not just the lid: the
lid's length runs along its local Y and the base's along Z, and both take the
same factor. Scaling only the lid leaves it too short to cover the base when
closed. Turn Adapt off for true device proportions, and the Fit control
(cover / contain / stretch) comes back.

### Transitions

There is no cross-dissolve — a single render pass can only show one pose at a
time. Shot changes instead dip through black: `post.fade` is an animated value
like any other, driven by a full-frame quad locked to the camera. A shot gets
four keyframes (black, clear, clear, black), so the pose swap for the next shot
happens while the frame is already dark. Because the overlay lives in the scene,
the viewport and the export show exactly the same transition.

### Playhead vs. live pose

While you are adjusting controls the viewport shows the *live* values. Scrubbing
the timeline or pressing play hands control to the keyframed animation. Touching
any control switches back to live — so editing never fights the timeline.

**Autoplay** (Screen panel, on by default) runs the recording live on the device
while you compose. Turn it off and the display shows exactly the frame under the
playhead — which is what the export will contain, so match this when keyframing
against specific moments. Either way the export is unaffected: it seeks the
source per frame.

## Export pipeline

Primary path is **WebCodecs** (`VideoEncoder`, H.264) muxed to MP4 with
`mp4-muxer` — deterministic, one encoded frame per timeline frame. Browsers
without WebCodecs fall back to a real-time `MediaRecorder` capture of the canvas
and produce WebM instead. Exports are video-only (no audio track).

## Adding another device

Devices live in `src/devices/`. A device is a component accepting
`{ rootRef, lidRef, texture, screenMatRef, material, screen }` plus a meta object
with `screenAspect` and a `hinge` offset; register it in `src/devices/index.js`.

Two gotchas, both learned the hard way in `MacBook.jsx`:

- Author geometry at whatever scale is convenient, then wrap it in a group scaled
  so the device matches the others in world size — camera work stays portable.
  But a light's `intensity` and `distance` are world-space scalars and are *not*
  affected by that group scale, so never convert those into local units.
- `RoundedBoxGeometry` inflates if the corner radius exceeds half the smallest
  dimension. On a thin slab that quietly swells the body and swallows anything
  resting on it. Use the `safeRadius` helper.
The scene, controls, animator and exporter are device-agnostic, so a phone,
tablet or monitor needs no changes outside that folder.

## Performance

The preview renders without mipmapping on the screen texture and skips the
canvas redraw entirely when neither the source frame nor the framing changed —
re-uploading a multi-megabyte texture every frame was costing roughly two
thirds of the frame budget. The exporter switches mipmapping back on for the
final pass, where sharpness is what matters and throughput is not.

If the viewport feels slow, check how many other WebGL pages are open: several
live contexts on one GPU slow each other down badly.

## Layout

```
src/
  scene/Studio.jsx      Canvas, lighting, floor, the rig that drives everything
  scene/studioApi.js    bridge from the R3F scene to the exporter
  devices/              device registry + the laptop model
  anim/interpolate.js   keyframe sampling
  anim/presets.js       one-click animation presets
  export/exportVideo.js WebCodecs → MP4, MediaRecorder fallback
  store/useStudio.js    all editor state
  ui/                   control panels and timeline
  media/loadSource.js   video + image loading behind one shape
  project/project.js    save / open / autosave
```

## Keyboard

- `Space` — play / pause
- `K` — add a keyframe at the playhead
- `Ctrl/Cmd + Z` — undo, `Ctrl/Cmd + Shift + Z` — redo
- `Ctrl/Cmd + S` — save the project

## Notes

Stack: React 18, React Three Fiber, three.js, drei, zustand, Vite.
Tested in Chromium; WebCodecs export requires a Chromium-based browser.
