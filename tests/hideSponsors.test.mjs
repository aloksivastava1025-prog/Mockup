import assert from 'node:assert'
import * as THREE from 'three'
import { hideSponsors } from '../src/export/hideSponsors.js'

/**
 * The guarantee under test: no sponsor mark can reach a rendered frame, and
 * every one of them comes back afterwards. A logo belonging to someone else
 * turning up in a user's marketing video makes that video unusable.
 */
const scene = new THREE.Scene()

const device = new THREE.Mesh()
const floorMarks = new THREE.Group()
floorMarks.userData.sponsor = true
const mark = new THREE.Mesh()
floorMarks.add(mark)

const deckMarks = new THREE.Group()
deckMarks.userData.sponsor = true

// Something the user hid themselves, which must stay hidden on restore.
const userHidden = new THREE.Group()
userHidden.userData.sponsor = true
userHidden.visible = false

scene.add(device, floorMarks, deckMarks, userHidden)

const restore = hideSponsors(scene)
assert.equal(floorMarks.visible, false, 'floor marks hidden')
assert.equal(deckMarks.visible, false, 'deck marks hidden')
assert.equal(device.visible, true, 'the device is not a sponsor mark')
// The child is untouched, but its parent being invisible is what matters: a
// three.js render skips the whole subtree.
assert.equal(mark.visible, true, 'children are left alone; the parent does the hiding')

restore()
assert.equal(floorMarks.visible, true, 'floor marks come back')
assert.equal(deckMarks.visible, true, 'deck marks come back')
assert.equal(userHidden.visible, false, 'a mark the user had already hidden stays hidden')

console.log('sponsor marks hidden for the render, restored after, nothing else touched')
console.log('ok')
