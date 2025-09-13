// fish.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js'; // important for animated clones
import { scene } from './main.js';

export const fishes = [];         // { mesh, mixer, dir, speed, turniness, t, yCenter }
const swimBounds = new THREE.Box3(
  new THREE.Vector3(-75, -20, -75),
  new THREE.Vector3( 75,  10,  75)
);
let baseFish = null;              // original model (loaded once)
let baseClips = [];               // animation clips
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const SPAWN_Y = -15.5;

export async function loadFishModel() {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync('assets/fish/scene.gltf');

  baseFish = gltf.scene;
  baseClips = gltf.animations || [];

  // optional: tidy materials/shadows
  baseFish.traverse(o => {
    if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
  });
}

export function spawnFish(count = 10, { scaleMin = 0.3, scaleMax = 0.8 } = {}) {
  if (!baseFish) {
    console.warn('Call loadFishModel() before spawnFish().');
    return;
  }

  for (let i = 0; i < count; i++) {
    // Deep clone INCLUDING skeleton/bones
    const fish = clone(baseFish);

    // random scale & position within bounds
    const scale = THREE.MathUtils.randFloat(scaleMin, scaleMax);
    fish.scale.setScalar(scale);
    const px = THREE.MathUtils.randFloat(swimBounds.min.x, swimBounds.max.x);
    const py = SPAWN_Y;
    const pz = THREE.MathUtils.randFloat(swimBounds.min.z, swimBounds.max.z);
    fish.position.set(px, SPAWN_Y, pz);

    // Animation mixer per fish
    const mixer = new THREE.AnimationMixer(fish);
    baseClips.forEach((clip) => {
      const action = mixer.clipAction(clip);
      action.play();
      // randomize phase so every fish starts mid-stroke differently
      action.time = Math.random() * clip.duration;
    });

    // Random initial direction/speed/turniness
    const dir = new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
    const speed = THREE.MathUtils.randFloat(0.15, 0.35);
    const turniness = THREE.MathUtils.randFloat(0.01, 0.04); // chance to slightly turn each frame

    // Gentle vertical bobbing
    const yCenter = SPAWN_Y;
    const t = Math.random() * 10.0;

    scene.add(fish);
    fishes.push({ mesh: fish, mixer, dir, speed, turniness, t, yCenter });
  }
}

// Call this from your main render loop with delta time
export function updateFishes(dt = 0.016) {
  const tmp = new THREE.Vector3();

  for (const f of fishes) {
    // advance animation
    f.mixer.update(dt);

    // occasional small turn
    if (Math.random() < f.turniness) {
      const ang = THREE.MathUtils.randFloatSpread(0.3); // -0.15..+0.15 rad
      f.dir.applyAxisAngle(Y_AXIS, ang).normalize();
    }

    // move & face heading
    tmp.copy(f.dir).multiplyScalar(f.speed*0.1);
    f.mesh.position.add(tmp);
    f.mesh.rotation.y = Math.atan2(f.dir.x, f.dir.z);

    // soft vertical bob
    f.t += dt;
    const bob = Math.sin(f.t * 1.5) * 0.25; // amplitude ≈ 0.25 units
    f.mesh.position.y = THREE.MathUtils.clamp(f.yCenter + bob, swimBounds.min.y, swimBounds.max.y);

    // bounce off XZ bounds
    const p = f.mesh.position;
    if (p.x < swimBounds.min.x || p.x > swimBounds.max.x) f.dir.x *= -1;
    if (p.z < swimBounds.min.z || p.z > swimBounds.max.z) f.dir.z *= -1;
  }
}

// Optional cleanup if you ever need to despawn everything
export function clearFishes() {
  for (const f of fishes) {
    scene.remove(f.mesh);
    // dispose geometries/materials created by clones
    f.mesh.traverse(o => {
      if (o.isMesh) {
        o.geometry?.dispose?.();
        if (Array.isArray(o.material)) o.material.forEach(m => m.dispose?.());
        else o.material?.dispose?.();
      }
    });
  }
  fishes.length = 0;
}
