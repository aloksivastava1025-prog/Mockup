/**
 * The state groups a keyframe captures and the animator interpolates.
 *
 * Deliberately not in the store. The animation code is pure and runs in the
 * test suite under plain Node; importing the store just to read one array of
 * strings drags in the device registry, and with it React, three.js and a
 * pile of .jsx the runner cannot load.
 */
export const ANIMATED_GROUPS = ['device', 'camera', 'screen', 'post']
