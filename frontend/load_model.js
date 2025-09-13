import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { scene } from './main.js';

export let fishRef = null;

// --- Fish model loading and animation ---
const loader = new GLTFLoader();
loader.load('assets/fish/scene.gltf', function (gltf) {
  const fish = gltf.scene;
  scene.add(fish);
  fishRef = fish;

  fish.position.set(75, 2, 75); 
  fish.scale.set(2, 2, 2); // Adjust scale as needed

  // Play fish animation if available
  let mixer = null;
  if (gltf.animations && gltf.animations.length > 0) {
    mixer = new THREE.AnimationMixer(fish);
    gltf.animations.forEach((clip) => mixer.clipAction(clip).play());
  }

  let direction = new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
  function swimRandomly() {
    if (mixer) mixer.update(0.016); // Advance animation by ~1/60s per frame
    // Change direction less frequently
    if (Math.random() < 0.005) {
      // Less aggressive angle change: blend current direction with new random
      const newDir = new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
      direction.lerp(newDir, 0.2).normalize(); // Only slightly change direction
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

