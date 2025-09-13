import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { scene } from './main.js';

// --- Tuna model loading and animation ---
const fbxLoader = new FBXLoader();
fbxLoader.load('frontend/assets/tuna.fbx', function (tuna) {
  scene.add(tuna);
  function tableScene(root = scene) {
    const rows = [];
    root.traverse(o => {
      rows.push({
        type: o.type,
        name: o.name || '',
        children: o.children.length,
        visible: o.visible,
        castShadow: !!o.castShadow,
        receiveShadow: !!o.receiveShadow
      });
    });
    console.table(rows);
  }
  tableScene();

  tuna.position.set(0, 2, 0);
  const scale = 100;
  tuna.scale.set(scale, scale, scale); // Reasonable scale

  let direction = new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();

  function swimRandomly() {
    if (Math.random() < 0.02) {
      direction.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
    }
    tuna.position.addScaledVector(direction, 0.2);
    tuna.position.x = Math.max(-50, Math.min(50, tuna.position.x));
    tuna.position.z = Math.max(-50, Math.min(50, tuna.position.z));
    tuna.rotation.y = Math.atan2(direction.x, direction.z);
    requestAnimationFrame(swimRandomly);
  }
  swimRandomly();
});
