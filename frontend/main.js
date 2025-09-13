import * as THREE from 'three';
// import { Water } from 'three/addons/objects/Water.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { fishRef } from './load_model.js';
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
let camera;
const frustumSize = 50; // bigger = more zoomed out
let isoOffset = new THREE.Vector3(1, 1, 1).normalize().multiplyScalar(30); // ≈ isometric

function setupCamera() {
  const aspect = window.innerWidth / window.innerHeight;
  const halfW = (frustumSize * aspect) / 2;
  const halfH = frustumSize / 2;
  if (!camera) {
    camera = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, 2000);
  } else {
    camera.left = -halfW; camera.right = halfW; camera.top = halfH; camera.bottom = -halfH;
    camera.updateProjectionMatrix();
  }
}
setupCamera();

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

// --- Player
const player = new THREE.Group();
const body = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.8, 1.6, 8, 16),
  new THREE.MeshStandardMaterial({ color: 0x8bb3ff, roughness: 0.5 })
);
body.castShadow = true; body.receiveShadow = true;
body.position.y = 1.5;
player.add(body);

const nose = new THREE.Mesh(
  new THREE.ConeGeometry(0.25, 0.6, 12),
  new THREE.MeshStandardMaterial({ color: 0xffd28b })
);
nose.position.set(0, 2.4, 0.9); nose.rotation.x = Math.PI;
player.add(nose);

player.position.set(0, 2, 0);
scene.add(player);

// --- Load your glTF model (scene.gltf + scene.bin)
const loader = new GLTFLoader();
let mixer = null;

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

    // Play any animations
    if (gltf.animations?.length) {
      mixer = new THREE.AnimationMixer(root);
      gltf.animations.forEach((clip) => mixer.clipAction(clip).play());
    }
  },
  undefined,
  (err) => showErr('Model load note: ' + (err?.message || err) + '\nPlace your files at assets/scene.gltf and assets/scene.bin.')
);

// --- Movement state
const keys = { w:false, a:false, s:false, d:false, up:false, left:false, down:false, right:false, shift:false };
window.addEventListener('keydown', (e) => { setKey(e.code, true); });
window.addEventListener('keyup',   (e) => { setKey(e.code, false); });
// toggle debug visuals
window.addEventListener('keydown', (e) => { if (e.code === 'KeyP') debugEnabled = !debugEnabled; });

function setKey(code, val) {
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
  if (code === 'KeyQ') rotateIso(-Math.PI/2);
  if (code === 'KeyE') rotateIso( Math.PI/2);
}

function rotateIso(angleRad) {
  isoOffset.applyAxisAngle(new THREE.Vector3(0,1,0), angleRad);
}

// --- Loop
const baseSpeed = 6;
const sprintMult = 1.6;
const clock = new THREE.Clock();

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);

  // if (water.material?.uniforms?.time) water.material.uniforms.time.value += dt;
  if (mixer) mixer.update(dt);

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
      player.position.x = next.x;
      player.position.z = next.z;
      player.position.y = THREE.MathUtils.damp(currentY, targetY, SNAP_DAMP, dt);

      // align to surface normal while preserving yaw
      const up = new THREE.Vector3(0,1,0);
      const normal = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize() : up;
      const surfaceQuat = new THREE.Quaternion().setFromUnitVectors(up, normal);
      const targetYaw = Math.atan2(delta.x, delta.z);
      const yawQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), targetYaw);
      const desiredQuat = surfaceQuat.clone().multiply(yawQuat);
      player.quaternion.slerp(desiredQuat, 1 - Math.exp(-ROT_DAMP * dt));

      // subtle bob
      body.position.y = 1.6 + Math.sin(performance.now() * 0.015) * 0.05;
    } else {
      // No hit: allow movement toward beach — damp Y toward a beach fallback level so player can reach shore
      const beachY = WATER_LEVEL + STAND_OFFSET;
      player.position.x = next.x;
      player.position.z = next.z;
      player.position.y = THREE.MathUtils.damp(currentY, beachY, Math.max(1, SNAP_DAMP / 3), dt);
      // keep facing movement direction
      const targetYaw = Math.atan2(delta.x, delta.z);
      player.rotation.y = THREE.MathUtils.damp(player.rotation.y, targetYaw, 8, dt);
      body.position.y = 1.6 + Math.sin(performance.now() * 0.015) * 0.05;
    }
  } else {
    body.position.y = THREE.MathUtils.damp(body.position.y, 1.6, 6, dt);
  }

  // camera follow at isometric offset
  const camTarget = player.position;
  camera.position.copy(camTarget).add(isoOffset);
  camera.lookAt(camTarget.x, camTarget.y + 1.4, camTarget.z);

  // render
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

// --- Resize
window.addEventListener('resize', () => {
  setupCamera();
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

setInterval(() => {
  if (fishRef) {
    console.log(`(main.js) Fish position: X=${fishRef.position.x.toFixed(2)}, Y=${fishRef.position.y.toFixed(2)}, Z=${fishRef.position.z.toFixed(2)}`);
  } else {
    console.log('(main.js) Fish not loaded yet.');
  }
}, 2000);

export { scene };
