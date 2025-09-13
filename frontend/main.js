import * as THREE from 'three';
// import { Water } from 'three/addons/objects/Water.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { loadFishModel, spawnFish, updateFishes, fishes } from './fish.js';
import { fishingAPI } from './api.js';
import { FishingGame } from './fishingGame.js';
import { WritingInterface } from './writingInterface.js';
// BVH accelerated raycasting
import { MeshBVH, acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh';
// wire accelerated raycast into three
THREE.Mesh.prototype.raycast = acceleratedRaycast;
// expose the compute/dispose helpers on BufferGeometry so we can call geometry.computeBoundsTree()
if (THREE.BufferGeometry && !THREE.BufferGeometry.prototype.computeBoundsTree) {
  THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
  THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
}

// --- Simple error surface
const errBox = document.getElementById('err');
const showErr = (msg) => { errBox.style.display='block'; errBox.textContent = msg; };
window.addEventListener('error', (e) => showErr('Error: ' + e.message));
window.addEventListener('unhandledrejection', (e) => showErr('Promise rejection: ' + (e.reason?.message || e.reason)));

// --- Basic setup
const app = document.getElementById('app');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87c8ff); // sunny sky

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

// --- Camera (orthographic, isometric)
// --- Cameras (perspective intro -> orthographic isometric)
let orthoCam, perspCam, activeCamera;
const frustumSize = 50; // Ortho size (bigger = more zoomed out)
let isoOffset = new THREE.Vector3(1, 1, 1).normalize().multiplyScalar(30);
// Current visible height the ortho camera uses (animates after handoff)
let orthoVisibleHeight = frustumSize;

// Keep ortho frustum in sync with a desired visible height
function setOrthoFrustumByHeight(cam, visibleHeight) {
  const aspect = window.innerWidth / window.innerHeight;
  const halfH = visibleHeight / 2;
  const halfW = halfH * aspect;
  cam.left = -halfW; cam.right = halfW;
  cam.top =  halfH;  cam.bottom = -halfH;
  cam.updateProjectionMatrix();
}

// Make ortho camera show exactly what the perspective camera shows (same framing)
function matchOrthoToPerspective(pCam, oCam, target) {
  // world-space distance from cam to look target
  const dist = pCam.position.distanceTo(target);
  const visH = 2 * dist * Math.tan(THREE.MathUtils.degToRad(pCam.fov * 0.5));
  setOrthoFrustumByHeight(oCam, visH);
  oCam.position.copy(pCam.position);
  oCam.quaternion.copy(pCam.quaternion);
  return visH; // we’ll use this as the starting orthoVisibleHeight
}

function setupCameras() {
  const aspect = window.innerWidth / window.innerHeight;

  // --- Ortho camera (final)
  if (!orthoCam) {
    // Create once; we’ll size it by visible height
    orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 500);
  }
  setOrthoFrustumByHeight(orthoCam, orthoVisibleHeight);

  // --- Perspective camera (intro)
  if (!perspCam) {
    perspCam = new THREE.PerspectiveCamera(50, aspect, 0.01, 500);
  } else {
    perspCam.aspect = aspect;
    perspCam.updateProjectionMatrix();
  }

  // start from the intro cam
  if (!activeCamera) activeCamera = perspCam;
}

setupCameras();

// -------- Intro tween state --------
const intro = {
  active: true,
  t: 0,
  dur: 2500, // ms (change to taste)
  startPos: new THREE.Vector3(-30, 8, -20), // <- your custom start (x,y,z)
  startYawRad: THREE.MathUtils.degToRad(25), // <- your start yaw in degrees
  endPos: new THREE.Vector3(),  // computed on the fly each frame (follows player+iso)
  endYawRad: 0,                 // computed each frame to face the player from iso
  startFov: 60,
  endFov: 24
};

// Helper: ease and angle lerp
function easeInOutCubic(u){ return u<0.5 ? 4*u*u*u : 1 - Math.pow(-2*u+2,3)/2; }
function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % (2*Math.PI)) - Math.PI;
  return a + d * t;
}

// Call this once after scene loads (right after setupCameras) if you want a different start:
function beginIntro({ x=-30, y=7.5, z=-10, yawDeg=25, durationMs=2500 } = {}) {
  intro.active = true;
  intro.t = 0;
  intro.dur = durationMs;
  intro.startPos.set(x, y, z);
  intro.startYawRad = THREE.MathUtils.degToRad(yawDeg);
  perspCam.position.copy(intro.startPos);
  perspCam.fov = intro.startFov;
  perspCam.updateProjectionMatrix();
  activeCamera = perspCam;
}

// Example: set a very specific starting pose (edit these numbers)
beginIntro({ x: -30, y: 8, z: -10, yawDeg: 35, durationMs: 2200 });


// --- Initialize Fishing Game
const fishingGame = new FishingGame(scene, activeCamera);

// --- Lights
const hemi = new THREE.HemisphereLight(0xbfdfff, 0x4b5a3a, 0.65);
scene.add(hemi);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.25);
dirLight.position.set(40, 80, 30);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048);
dirLight.shadow.camera.near = 1;
dirLight.shadow.camera.far = 200;
dirLight.shadow.camera.left = -60;
dirLight.shadow.camera.right = 60;
dirLight.shadow.camera.top = 60;
dirLight.shadow.camera.bottom = -60;
scene.add(dirLight);

// Extra light & ambient
const sunLight = new THREE.DirectionalLight(0xFFBBB0, 2);
sunLight.position.set(10, 20, 10);
sunLight.castShadow = true;
scene.add(sunLight);

const ambient = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambient);

// --- Water (optional) ---
// const waterNormals = new THREE.TextureLoader().load(
//   'three/addons/textures/waternormals.jpg', (tex) => { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; }
// );
// const water = new Water(
//   new THREE.PlaneGeometry(400, 400),
//   { textureWidth: 512, textureHeight: 512, waterNormals, sunDirection: dirLight.position.clone().normalize(), sunColor: 0xffffff, waterColor: 0x4aa3f0, distortionScale: 2.2, fog: false }
// );
// water.rotation.x = -Math.PI / 2;
// water.position.y = -0.04;
// scene.add(water);

// --- Island radius guard (if you’re keeping the circle island)
const islandRadius = 120;

// --- BVH + movement tuning
const RAY_HEIGHT = 12; // how high above candidate position to cast downward
const WATER_LEVEL = -1.0; // y below which is considered water/void and not walkable
const STAND_OFFSET = 0.12; // how high above the hit point the player stands
const SNAP_DAMP = 12; // damping for vertical snap (larger = snappier)
const ROT_DAMP = 8; // damping for rotation alignment to surface normal
const FLOOR_Y = -13.9625; // hard floor clamp for the player

// Walkable meshes populated at load time
const walkableMeshes = [];
// Raycaster & helpers
const downDir = new THREE.Vector3(0, -1, 0);
const raycaster = new THREE.Raycaster();

// Debug helpers
let debugEnabled = false;
let debugRayLine = null;
let debugNormalArrow = null;

// create debug visuals
const dbgLineMat = new THREE.LineBasicMaterial({ color: 0xff0000 });
const dbgLineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
debugRayLine = new THREE.Line(dbgLineGeo, dbgLineMat);
debugRayLine.visible = false;
scene.add(debugRayLine);
debugNormalArrow = new THREE.ArrowHelper(new THREE.Vector3(0,1,0), new THREE.Vector3(), 2, 0x00ff00);
debugNormalArrow.visible = false;
scene.add(debugNormalArrow);

// --- Player group (transforms + physics live here)
const player = new THREE.Group();
player.position.set(-30, 7.5, -20);
scene.add(player);

// --- Load your glTF environment (scene.gltf + scene.bin)
const loader = new GLTFLoader();
let envMixer = null;

loader.load(
  'assets/scene.gltf',
  (gltf) => {
    const root = gltf.scene;
    root.traverse((o) => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
    });

    // Center & scale to a reasonable size
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3(); box.getSize(size);
    const center = new THREE.Vector3(); box.getCenter(center);
    root.position.sub(center); // center on origin

    const targetSize = 1000; 
    const s = targetSize / Math.max(size.x || 1, size.z || 1);
    root.scale.setScalar(s);

    // Position tweak (optional)
    root.position.y = -5;
    root.position.z = -15;
    root.position.x = -5;

    // Build BVH on loaded geometries and collect walkable meshes
    root.traverse((o) => {
      if (o.isMesh && o.geometry && o.geometry.isBufferGeometry) {
        try {
          if (typeof o.geometry.computeBoundsTree === 'function') {
            o.geometry.computeBoundsTree();
          } else {
            computeBoundsTree(o.geometry);
          }
          walkableMeshes.push(o);
        } catch (err) {
          console.warn('Failed to build BVH for mesh', o, err);
        }
      }
    });

    scene.add(root);

    // Play any animations on the environment
    if (gltf.animations?.length) {
      envMixer = new THREE.AnimationMixer(root);
      gltf.animations.forEach((clip) => envMixer.clipAction(clip).play());
    }
  },
  undefined,
  (err) => showErr('Model load note: ' + (err?.message || err) + '\nPlace your files at assets/scene.gltf and assets/scene.bin.')
);

// ----------------- Cat (player avatar) -----------------
const CAT_PATH = 'assets/cat/scene.gltf'; // put scene.gltf, scene.bin, textures/ under assets/cat/
const CAT_SCALE = 1.5;                    // adjust if the cat is too big/small
const CAT_FACES_POS_Z = true;             // flip to false if your cat faces the wrong way
const WALK_MPS_AT_1X = 1.2;               // world meters/sec that looks right at timeScale=1

let catRoot = null;
let catMixer = null;
let catActions = { idle: null, walk: null };
let activeAction = null;

// small helper: fuzzy clip lookup
function getClip(gltf, names) {
  const n = names.map(s => s.toLowerCase());
  return gltf.animations.find(c => n.some(t => c.name.toLowerCase().includes(t))) || null;
}

// cross-fade helper
function fadeTo(action, duration = 0.2) {
  if (!action || action === activeAction) return;
  if (activeAction) activeAction.crossFadeTo(action, duration, false);
  activeAction = action;
}

// helper + play-state flag (place near your other top-level vars)
let walkPlaying = false;
function anyMoveKeyDown() {
  return keys.w || keys.a || keys.s || keys.d ||
         keys.up || keys.left || keys.down || keys.right;
}

const catLoader = new GLTFLoader();
catLoader.load(
  CAT_PATH,
  (gltf) => {
    catRoot = gltf.scene || gltf.scenes?.[0];

    // shadows
    catRoot.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }});

    // scale & orientation
    catRoot.scale.setScalar(CAT_SCALE);
    if (!CAT_FACES_POS_Z) catRoot.rotation.y = Math.PI; // face +Z for our “forward” math

    // center horizontally; keep feet near y=0
    const bbox = new THREE.Box3().setFromObject(catRoot);
    const size = new THREE.Vector3(); bbox.getSize(size);
    const center = new THREE.Vector3(); bbox.getCenter(center);
    catRoot.position.x -= center.x;
    catRoot.position.z -= center.z;
    catRoot.position.y -= bbox.min.y; // rest feet at y≈0

    const CAT_EXTRA_LIFT = 8; // small lift; ground snap handles the rest
    catRoot.position.y += CAT_EXTRA_LIFT;

    // parent under player transform so all movement/tilt applies
    player.add(catRoot);

    // --- Animations: name-agnostic, play only when move keys are down ---
    catMixer = new THREE.AnimationMixer(catRoot);

    // choose the longest clip as our "walk" clip
    if (gltf.animations && gltf.animations.length) {
      const primaryClip =
        gltf.animations.reduce((best, c) =>
          (!best || c.duration > best.duration) ? c : best, null);

      catActions = catActions || {};
      catActions.walk = catMixer.clipAction(primaryClip);
      catActions.walk.setLoop(THREE.LoopRepeat, Infinity);
      catActions.walk.clampWhenFinished = false;
      // do NOT play here — we’ll start/stop in animate() based on key state
    } else {
      console.warn('Cat model has no animations.');
    }
  },
  undefined,
  (err) => showErr('Cat load failed: ' + (err?.message || err))
);


// --- Movement state
const keys = { w:false, a:false, s:false, d:false, up:false, left:false, down:false, right:false, shift:false };
window.addEventListener('keydown', (e) => { setKey(e.code, true); });
window.addEventListener('keyup',   (e) => { setKey(e.code, false); });
// toggle debug visuals
window.addEventListener('keydown', (e) => { if (e.code === 'KeyP') debugEnabled = !debugEnabled; });

function setKey(code, val) {
  // Debug logging
  if (code === 'KeyE') {
    console.log('E key pressed, isModalOpen:', isModalOpen, 'val:', val);
  }

  // Disable all game controls when any modal is open OR writing interface is active
  if (isModalOpen || fishingGame.writingInterface.isActive) {
    console.log('Modal or writing interface is open, blocking key:', code);
    return;
  }

  if (code === 'KeyW') keys.w = val;
  if (code === 'KeyA') keys.a = val;
  if (code === 'KeyS') keys.s = val;
  if (code === 'KeyD') keys.d = val;

  if (code === 'ArrowUp') keys.up = val;
  if (code === 'ArrowLeft') keys.left = val;
  if (code === 'ArrowDown') keys.down = val;
  if (code === 'ArrowRight') keys.right = val;

  if (code === 'ShiftLeft' || code === 'ShiftRight') keys.shift = val;

  if (!val) return;
  // Modal check is already above, so Q/E rotation is already blocked
  if (code === 'KeyQ') rotateIso(-Math.PI/2);
  if (code === 'KeyE') {
    console.log('Executing E rotation');
    rotateIso( Math.PI/2);
  }
}

function rotateIso(angleRad) {
  // Don't rotate camera when any modal is open OR writing interface is active
  if (isModalOpen || fishingGame.writingInterface.isActive) return;

  isoOffset.applyAxisAngle(new THREE.Vector3(0,1,0), angleRad);
}

async function initFish() {
  await loadFishModel();
  spawnFish(100);               // ← spawn however many you want
  // trickle in more fish over time (optional):
  // setInterval(() => spawnFish(1), 4000);

  // simple position logger (optional)
  setInterval(() => {
    const p = fishes[0]?.mesh?.position;
    if (p) {
      console.log(`Fish[0] @ X=${p.x.toFixed(2)} Y=${p.y.toFixed(2)} Z=${p.z.toFixed(2)}`);
    }
  }, 2000);
}
initFish();

// --- Loop
const baseSpeed = 6;
const sprintMult = 1.6;
const clock = new THREE.Clock();

let prevPlayerPos = new THREE.Vector3();
let currentSpeedMps = 0; // measured world speed (XZ), meters/sec
prevPlayerPos.copy(player.position);

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);

  if (envMixer) envMixer.update(dt);
  if (catMixer) catMixer.update(dt);

  // if (water.material?.uniforms?.time) water.material.uniforms.time.value += dt;

  updateFishes(dt); // ← animate + move all fish
  
  // Update fishing game
  fishingGame.update();

  // after you compute currentSpeedMps, inside animate():
  if (catMixer && catActions?.walk) {
  const MOVING_KEYS = anyMoveKeyDown();
    if (MOVING_KEYS) {
      if (!walkPlaying) {
        catActions.walk.reset().play();
        walkPlaying = true;
      }
    // optional: sync foot speed to world speed
      catActions.walk.timeScale = THREE.MathUtils.clamp(
      currentSpeedMps / WALK_MPS_AT_1X, 0.1, 3.5
    );
    } else if (walkPlaying) {
      catActions.walk.stop();
      walkPlaying = false;
    }
  }


  // movement (relative to camera iso orientation)
  // forward should point from camera toward the scene center (negated isoOffset)
  const forward = new THREE.Vector3().copy(isoOffset).setY(0).normalize().negate();
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0,1,0)).normalize();

  let move = new THREE.Vector3();
  const pressUp    = keys.w || keys.up;
  const pressDown  = keys.s || keys.down;
  const pressLeft  = keys.a || keys.left;
  const pressRight = keys.d || keys.right;
  if (pressUp)    move.add(forward);
  if (pressDown)  move.add(forward.clone().negate());
  if (pressRight) move.add(right);
  if (pressLeft)  move.add(right.clone().negate());

  if (move.lengthSq() > 0) {
    move.normalize();
    const speed = baseSpeed * (keys.shift ? sprintMult : 1);
    const delta = move.multiplyScalar(speed * dt);
  // remember previous horizontal position so we can snap back if move is blocked
  const prevX = player.position.x;
  const prevZ = player.position.z;
  const next = player.position.clone().add(delta);

    // keep player near island if using circular boundary
    const len = Math.hypot(next.x, next.z);
    const maxLen = islandRadius - 0.8;
    if (len > maxLen) {
      const ang = Math.atan2(next.z, next.x);
      next.x = Math.cos(ang) * maxLen;
      next.z = Math.sin(ang) * maxLen;
    }

    // BVH-accelerated downward raycast from above candidate XZ to find surface
    raycaster.set(new THREE.Vector3(next.x, next.y + RAY_HEIGHT, next.z), downDir);
    raycaster.far = RAY_HEIGHT * 2;
    const currentY = player.position.y;
    const hits = raycaster.intersectObjects(walkableMeshes, true);

    if (debugEnabled) {
      const start = raycaster.ray.origin.clone();
      const end = start.clone().add(raycaster.ray.direction.clone().multiplyScalar(raycaster.far));
      debugRayLine.geometry.setFromPoints([start, end]);
      debugRayLine.visible = true;
    } else {
      debugRayLine.visible = false;
      debugNormalArrow.visible = false;
    }

    if (hits.length > 0) {
      const hit = hits[0];
      if (debugEnabled) {
        debugNormalArrow.position.copy(hit.point);
        const normalVec = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize() : new THREE.Vector3(0,1,0);
        debugNormalArrow.setDirection(normalVec);
        debugNormalArrow.visible = true;
      }

      // Accept movement when there's a surface hit (including beach/water areas).
      const targetY = hit.point.y + STAND_OFFSET;
      // if the targetY would be below the floor, cancel this move
      if (targetY <= FLOOR_Y) {
        // blocked: snap back to previous horizontal position to avoid any drift/slide
        player.position.x = prevX;
        player.position.z = prevZ;
        // keep Y unchanged
      } else {
        player.position.x = next.x;
        player.position.z = next.z;
        player.position.y = THREE.MathUtils.damp(currentY, targetY, SNAP_DAMP, dt);
      }

      // align to surface normal while preserving yaw
      const up = new THREE.Vector3(0,1,0);
      const normal = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize() : up;
      const surfaceQuat = new THREE.Quaternion().setFromUnitVectors(up, normal);
      const targetYaw = Math.atan2(delta.x, delta.z);
      const yawQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), targetYaw);
      const desiredQuat = surfaceQuat.clone().multiply(yawQuat);
      player.quaternion.slerp(desiredQuat, 1 - Math.exp(-ROT_DAMP * dt));
    } else {
      // No hit: allow movement toward beach — damp Y toward a beach fallback level so player can reach shore
      const beachY = WATER_LEVEL + STAND_OFFSET;
      // if beachY would be below the floor, cancel move
      if (beachY <= FLOOR_Y) {
        // blocked: snap back to previous horizontal position
        player.position.x = prevX;
        player.position.z = prevZ;
      } else {
        player.position.x = next.x;
        player.position.z = next.z;
        player.position.y = THREE.MathUtils.damp(currentY, beachY, Math.max(1, SNAP_DAMP / 3), dt);
        // keep facing movement direction
        const targetYaw = Math.atan2(delta.x, delta.z);
        player.rotation.y = THREE.MathUtils.damp(player.rotation.y, targetYaw, 8, dt);
        player.position.y = 1.6 + Math.sin(performance.now() * 0.015) * 0.05;
      }
    }
  }

  // === After player.position has been updated for this frame ===
  // measure actual horizontal speed to drive animation
  const dx = player.position.x - prevPlayerPos.x;
  const dz = player.position.z - prevPlayerPos.z;
  const dist = Math.hypot(dx, dz);
  currentSpeedMps = dist / Math.max(dt, 1e-6);  // meters/second in world units
  prevPlayerPos.copy(player.position);

  // animation state machine: Idle <-> Walk
  if (catMixer && (catActions.idle || catActions.walk)) {
    const MOVING = currentSpeedMps > 0.05; // deadzone to avoid jitter
    if (MOVING && catActions.walk) {
      // normalize timeScale so feet match ground speed
      const tScale = THREE.MathUtils.clamp(currentSpeedMps / WALK_MPS_AT_1X, 0.1, 3.5);
      catActions.walk.timeScale = tScale;
      fadeTo(catActions.walk, 0.12);
    } else if (!MOVING && catActions.idle) {
      catActions.idle.timeScale = 1;
      fadeTo(catActions.idle, 0.15);
    }
  }

  // camera follow at isometric offset (final target for ortho)
  const camTarget = player.position;

  // ---- INTRO TWEEN (perspective) ----
  if (intro.active) {
    intro.t += dt * 1000;
    const u = THREE.MathUtils.clamp(intro.t / intro.dur, 0, 1);
    const e = easeInOutCubic(u);

    const look = new THREE.Vector3(camTarget.x, camTarget.y + 1.4, camTarget.z);
    const desiredEndPos = new THREE.Vector3().copy(camTarget).add(isoOffset);

    // Tween pos + yaw + FOV
    const curPos = new THREE.Vector3().lerpVectors(intro.startPos, desiredEndPos, e);
    const dir = new THREE.Vector3().subVectors(camTarget, desiredEndPos).setY(0);
    const endYaw = Math.atan2(dir.x, dir.z);
    const curYaw = lerpAngle(intro.startYawRad, endYaw, e);
    const curFov = THREE.MathUtils.lerp(intro.startFov, intro.endFov, e);

    perspCam.position.copy(curPos);
    perspCam.lookAt(look);
    perspCam.fov = curFov;
    perspCam.updateProjectionMatrix();

    // Start aligning the ortho camera to the perspective view for a seamless swap
    const handoffStart = 0.85;   // begin matching frustum for last ~15%
    if (u >= handoffStart) {
      // Continuously match ortho to what perspective shows *this frame*
      const matchedHeight = matchOrthoToPerspective(perspCam, orthoCam, look);
      orthoVisibleHeight = matchedHeight; // remember this so we can ease from it later
    }

    if (u >= 0.999) {
      // Switch with no visible jump (views are already identical)
      activeCamera = orthoCam;
      intro.active = false;
      fishingGame.setCamera?.(activeCamera);
    }
  } else {
    // ---- NORMAL ORTHO FOLLOW ----
    // Smoothly ease ortho zoom back to your standard frustumSize
    orthoVisibleHeight = THREE.MathUtils.damp(orthoVisibleHeight, frustumSize, 3.5, dt);
    setOrthoFrustumByHeight(orthoCam, orthoVisibleHeight);

    orthoCam.position.copy(camTarget).add(isoOffset);
    orthoCam.lookAt(camTarget.x, camTarget.y + 1.4, camTarget.z);
  }
  renderer.render(scene, activeCamera);
  requestAnimationFrame(animate);
}
animate();

// --- Resize
window.addEventListener('resize', () => {
  setupCameras();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Click to focus (better key capture)
window.addEventListener('click', () => renderer.domElement.focus());

// --- Update player coordinates display
const coordsDisplay = document.getElementById('player-coords');
function updateCoords() {
  const pos = player.position;
  coordsDisplay.textContent = `X: ${pos.x.toFixed(2)}, Y: ${pos.y.toFixed(2)}, Z: ${pos.z.toFixed(2)}`;
}
setInterval(updateCoords, 100); // update every 100ms

// --- Fishing Modal Logic
const fishingChoiceModal = document.getElementById('fishing-choice-modal');
const fishModal = document.getElementById('fish-modal');
const myBottlesModal = document.getElementById('my-bottles-modal');
const bottlesList = document.getElementById('bottles-list');
const bottlesCloseBtn = document.getElementById('bottles-close-btn');
const fishQuestion = document.getElementById('fish-question');
const bottleContent = document.getElementById('bottle-content');
const bottleQuestion = document.getElementById('bottle-question');
const bottleAuthor = document.getElementById('bottle-author');
const bottleMessage = document.getElementById('bottle-message');
const reflectionInput = document.getElementById('reflection-input');
const cancelBtn = document.getElementById('cancel-btn');
const submitBtn = document.getElementById('submit-btn');
const choiceCancelBtn = document.getElementById('choice-cancel-btn');
const fishForFishBtn = document.getElementById('fish-for-fish');
const fishForBottlesBtn = document.getElementById('fish-for-bottles');
const fishForAnythingBtn = document.getElementById('fish-for-anything');

let currentFish = null;
let currentBottle = null;
let isModalOpen = false;
const currentUsername = 'player'; // TODO: Get from auth system

// Modal controls
function showChoiceModal() {
  isModalOpen = true;
  console.log('showChoiceModal: isModalOpen set to', isModalOpen);
  fishingChoiceModal.style.display = 'flex';
}

function hideChoiceModal() {
  fishingChoiceModal.style.display = 'none';
  isModalOpen = false;
  console.log('hideChoiceModal: isModalOpen set to', isModalOpen);
}

function showFishModal(fish) {
  // Hide choice modal but keep isModalOpen true
  fishingChoiceModal.style.display = 'none';
  isModalOpen = true; // Keep modal state active
  
  currentFish = fish;
  currentBottle = null;
  fishQuestion.textContent = fish.question;
  fishQuestion.style.display = 'block';
  bottleContent.style.display = 'none';
  reflectionInput.placeholder = 'Write your reflection...';
  reflectionInput.value = '';
  fishModal.style.display = 'flex';
  reflectionInput.focus();
}

function showBottleModal(bottle) {
  // Hide choice modal but keep isModalOpen true
  fishingChoiceModal.style.display = 'none';
  isModalOpen = true; // Keep modal state active
  
  currentBottle = bottle;
  currentFish = null;
  bottleQuestion.textContent = bottle.question;
  bottleAuthor.textContent = bottle.username;
  bottleMessage.textContent = bottle.message;
  fishQuestion.style.display = 'none';
  bottleContent.style.display = 'block';
  reflectionInput.placeholder = 'Write your response...';
  reflectionInput.value = '';
  fishModal.style.display = 'flex';
  reflectionInput.focus();
}

function hideFishModal() {
  fishModal.style.display = 'none';
  isModalOpen = false;
  currentFish = null;
  currentBottle = null;
}

function showMyBottlesModal(bottles) {
  isModalOpen = true;
  bottlesList.innerHTML = '';
  
  if (!bottles || bottles.length === 0) {
    bottlesList.innerHTML = '<div style="text-align: center; color: #a0a0a0;">No bottles yet. Go fishing to create some!</div>';
  } else {
    bottles.forEach(bottle => {
      const bottleDiv = document.createElement('div');
      bottleDiv.className = 'bottle-item';
      
      let responsesHtml = '';
      if (bottle.responses && bottle.responses.length > 0) {
        responsesHtml = `
          <div class="bottle-responses">
            <strong>Responses (${bottle.responses.length}):</strong>
            ${bottle.responses.map(resp => `
              <div class="response-item">
                <span class="response-author">${resp.username}:</span> ${resp.response}
              </div>
            `).join('')}
          </div>
        `;
      } else {
        responsesHtml = '<div class="bottle-responses"><em>No responses yet</em></div>';
      }
      
      bottleDiv.innerHTML = `
        <div class="bottle-question">${bottle.question}</div>
        <div class="bottle-message">${bottle.message}</div>
        ${responsesHtml}
      `;
      
      bottlesList.appendChild(bottleDiv);
    });
  }
  
  myBottlesModal.style.display = 'flex';
}

function hideMyBottlesModal() {
  myBottlesModal.style.display = 'none';
  isModalOpen = false;
}

// Event listeners
cancelBtn.addEventListener('click', hideFishModal);
choiceCancelBtn.addEventListener('click', hideChoiceModal);
bottlesCloseBtn.addEventListener('click', hideMyBottlesModal);

submitBtn.addEventListener('click', async () => {
  const reflection = reflectionInput.value.trim();
  if (!reflection) return;
  
  try {
    submitBtn.textContent = 'Casting...';
    submitBtn.disabled = true;
    
    if (currentFish) {
      await fishingAPI.createBottle(currentFish.id, currentUsername, reflection);
    } else if (currentBottle) {
      await fishingAPI.respondToBottle(currentUsername, currentBottle.question_id, reflection);
    }
    
    hideFishModal();
    console.log('Success!');
  } catch (error) {
    console.error('Failed:', error);
  } finally {
    submitBtn.textContent = 'Cast into Ocean';
    submitBtn.disabled = false;
  }
});

// Choice button listeners
fishForFishBtn.addEventListener('click', async () => {
  hideChoiceModal();
  try {
    const fish = await fishingAPI.catchFish(currentUsername);
    showFishModal(fish);
  } catch (error) {
    console.error('Failed to catch fish:', error);
    isModalOpen = false;
  }
});

fishForBottlesBtn.addEventListener('click', async () => {
  console.log('Fish for bottles clicked');
  hideChoiceModal();
  try {
    console.log('Calling catchBottle API...');
    const bottle = await fishingAPI.catchBottle(currentUsername);
    console.log('Received bottle:', bottle);
    showBottleModal(bottle);
  } catch (error) {
    console.error('Failed to catch bottle:', error);
    alert('Failed to catch bottle: ' + error.message);
    isModalOpen = false;
  }
});

fishForAnythingBtn.addEventListener('click', async () => {
  hideChoiceModal();
  try {
    const random = Math.random() < 0.5;
    if (random) {
      const fish = await fishingAPI.catchFish(currentUsername);
      showFishModal(fish);
    } else {
      const bottle = await fishingAPI.catchBottle(currentUsername);
      showBottleModal(bottle);
    }
  } catch (error) {
    console.error('Failed to catch anything:', error);
    isModalOpen = false;
  }
});

// --- Modal System Variables (already declared above)

// Fishing interaction
async function triggerFishing() {
  // Check if player is near water level
  const playerY = player.position.y;
  const distanceToWater = playerY - WATER_LEVEL; // Distance above water level
  
  if (distanceToWater > 3) { // Must be within 3 units above water level
    console.log('Too far from water! Get closer to the shore to fish.');
    return;
  }
  
  // Start the new fishing game
  fishingGame.startFishing();
}

async function showMyBottles() {
  try {
    const bottles = await fishingAPI.getUserBottles(currentUsername);
    showMyBottlesModal(bottles);
  } catch (error) {
    console.error('Failed to get bottles:', error);
  }
}

// Add F key for fishing
keys.f = false;
keys.b = false;
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyF' && !isModalOpen) {
    keys.f = true;
    e.preventDefault();
  }
  if (e.code === 'KeyB' && !isModalOpen) {
    keys.b = true;
    e.preventDefault();
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyF' && !isModalOpen) {
    keys.f = false;
    triggerFishing();
    e.preventDefault();
  }
  if (e.code === 'KeyB' && !isModalOpen) {
    keys.b = false;
    showMyBottles();
    e.preventDefault();
  }
});

export { scene };
