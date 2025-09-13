import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { scene } from './main.js';

export let fishRef = null;
let fishMixer = null;

// --- Fish model loading and animation ---
const loader = new GLTFLoader();
loader.load('assets/fish/scene.gltf', function (gltf) {
  const fish = gltf.scene;
  scene.add(fish);
  fishRef = fish;

  fish.position.set(0, 2, 0);
  fish.scale.set(2, 2, 2); // Adjust scale as needed

  // Play fish animation if available
  if (gltf.animations && gltf.animations.length > 0) {
    fishMixer = new THREE.AnimationMixer(fish);
    gltf.animations.forEach((clip) => fishMixer.clipAction(clip).play());
  }

  let direction = new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
  function swimRandomly() {
    if (fishMixer) fishMixer.update(0.016); // ~60fps

    // Change direction less frequently
    if (Math.random() < 0.005) {
      // Rotate direction by a small random angle
      const angle = (Math.random() - 0.5) * 0.3; // smaller angle, e.g. -0.15 to +0.15 radians
      direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle).normalize();
    }

    fish.position.addScaledVector(direction, 0.2);
    fish.position.x = Math.max(-50, Math.min(50, fish.position.x));
    fish.position.z = Math.max(-50, Math.min(50, fish.position.z));
    fish.rotation.y = Math.atan2(direction.x, direction.z);
    requestAnimationFrame(swimRandomly);
  }
  swimRandomly();

  // Print fish location every 2 seconds
  setInterval(() => {
    console.log(`Fish position: X=${fish.position.x.toFixed(2)}, Y=${fish.position.y.toFixed(2)}, Z=${fish.position.z.toFixed(2)}`);
  }, 2000);
});

