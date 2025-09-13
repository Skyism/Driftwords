import * as THREE from 'three';

export class WritingInterface {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.isActive = false;
    this.typewriter = null;
    this.reflectionOrb = null;
    this.wordBubbles = [];
    this.particles = [];
    this.currentText = '';
    this.onComplete = null;
    
    this.createTypewriter();
    this.createReflectionOrb();
    this.setupTextInput();
  }
  
  createTypewriter() {
    // Typewriter base
    const baseGeometry = new THREE.BoxGeometry(2, 0.2, 1.5);
    const baseMaterial = new THREE.MeshLambertMaterial({ color: 0x2c1810 });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    
    // Typewriter keys (simplified)
    const keyGeometry = new THREE.BoxGeometry(0.1, 0.05, 0.1);
    const keyMaterial = new THREE.MeshLambertMaterial({ color: 0xf0f0f0 });
    
    this.typewriter = new THREE.Group();
    this.typewriter.add(base);
    
    // Add some keys for visual effect
    for (let i = 0; i < 20; i++) {
      const key = new THREE.Mesh(keyGeometry, keyMaterial);
      key.position.set(
        (Math.random() - 0.5) * 1.5,
        0.15,
        (Math.random() - 0.5) * 1
      );
      this.typewriter.add(key);
    }
    
    this.typewriter.visible = false;
    this.scene.add(this.typewriter);
  }
  
  createReflectionOrb() {
    const orbGeometry = new THREE.SphereGeometry(0.3, 16, 16);
    const orbMaterial = new THREE.MeshLambertMaterial({ 
      color: 0x4a90e2,
      transparent: true,
      opacity: 0.7,
      emissive: 0x1a3a5a
    });
    
    this.reflectionOrb = new THREE.Mesh(orbGeometry, orbMaterial);
    this.reflectionOrb.visible = false;
    this.scene.add(this.reflectionOrb);
  }
  
  setupTextInput() {
    // Create hidden HTML input for text capture
    this.textInput = document.createElement('textarea');
    this.textInput.style.cssText = `
      position: fixed; top: 70%; left: 50%; transform: translateX(-50%);
      width: 400px; height: 120px; padding: 15px;
      background: rgba(0,0,0,0.8); color: white; border: 2px solid #4a90e2;
      border-radius: 10px; font-size: 16px; font-family: 'Courier New', monospace;
      resize: none; outline: none; display: none; z-index: 1000;
    `;
    this.textInput.placeholder = 'Type your reflection...';
    
    this.submitBtn = document.createElement('button');
    this.submitBtn.textContent = 'Cast into Waters';
    this.submitBtn.style.cssText = `
      position: fixed; top: 85%; left: 50%; transform: translateX(-50%);
      padding: 10px 20px; background: #4a90e2; color: white; border: none;
      border-radius: 5px; cursor: pointer; display: none; z-index: 1000;
    `;
    
    // Create casting animation
    this.castingAnimation = document.createElement('div');
    this.castingAnimation.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background: rgba(0,0,0,0.9); padding: 30px; border-radius: 10px;
      color: white; text-align: center; display: none; z-index: 1002;
    `;
    this.castingAnimation.innerHTML = `
      <div style="font-size: 48px; margin-bottom: 15px;">🎣</div>
      <div style="font-size: 18px; margin-bottom: 10px;">Casting into the waters...</div>
      <div style="width: 40px; height: 40px; border: 3px solid #4a90e2; border-top: 3px solid transparent; 
                  border-radius: 50%; margin: 0 auto; animation: spin 1s linear infinite;"></div>
      <style>
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    `;
    
    // Create bottle content display
    this.bottleDisplay = document.createElement('div');
    this.bottleDisplay.style.cssText = `
      position: fixed; top: 20%; left: 50%; transform: translateX(-50%);
      width: 500px; max-height: 40%; overflow-y: auto; padding: 20px;
      background: rgba(0,0,0,0.9); color: white; border: 2px solid #32cd32;
      border-radius: 10px; font-size: 14px; font-family: Arial, sans-serif;
      display: none; z-index: 1001; line-height: 1.5;
    `;
    
    // Create fish question display (same size as bottle display)
    this.fishDisplay = document.createElement('div');
    this.fishDisplay.style.cssText = `
      position: fixed; top: 20%; left: 50%; transform: translateX(-50%);
      width: 500px; max-height: 40%; overflow-y: auto; padding: 20px;
      background: rgba(0,0,0,0.9); color: white; border: 2px solid #4a90e2;
      border-radius: 10px; font-size: 14px; font-family: Arial, sans-serif;
      display: none; z-index: 1001; line-height: 1.5;
    `;
    
    document.body.appendChild(this.textInput);
    document.body.appendChild(this.submitBtn);
    document.body.appendChild(this.castingAnimation);
    document.body.appendChild(this.bottleDisplay);
    document.body.appendChild(this.fishDisplay);
    
    this.textInput.addEventListener('input', (e) => this.onTextChange(e.target.value));
    this.submitBtn.addEventListener('click', () => this.completeWriting());
  }
  
  show(content, onComplete) {
    this.isActive = true;
    this.onComplete = onComplete;
    this.currentText = '';
    
    // Position typewriter above water
    const cameraDirection = new THREE.Vector3();
    this.camera.getWorldDirection(cameraDirection);
    
    this.typewriter.position.copy(this.camera.position);
    this.typewriter.position.add(cameraDirection.multiplyScalar(8));
    this.typewriter.position.y = 2; // Above water
    this.typewriter.lookAt(this.camera.position);
    
    // Position reflection orb
    this.reflectionOrb.position.copy(this.typewriter.position);
    this.reflectionOrb.position.y += 1.5;
    
    // Show elements
    this.typewriter.visible = true;
    this.reflectionOrb.visible = true;
    this.textInput.style.display = 'block';
    this.submitBtn.style.display = 'block';
    
    // Check if this is bottle content (has response section)
    if (content.includes('--- Your Response ---')) {
      this.textInput.placeholder = 'Write your response to this reflection...';
      this.submitBtn.textContent = 'Send Response';
      
      // Show bottle content in HTML overlay
      this.showBottleContent(content);
    } else {
      this.textInput.placeholder = 'Type your reflection...';
      this.submitBtn.textContent = 'Cast into Waters';
      
      // Show fish question in HTML overlay (same as bottle)
      this.showFishQuestion(content);
    }
    
    // Focus input
    setTimeout(() => this.textInput.focus(), 100);
  }
  
  showFishQuestion(question) {
    // Format fish question for HTML display
    const formattedHTML = `<div style="color: #4a90e2; font-weight: bold; font-size: 18px; margin-bottom: 20px;">🐟 Reflection Prompt</div>
                          <div style="font-size: 16px; line-height: 1.6;">${question}</div>
                          <div style="color: #ff69b4; font-weight: bold; margin-top: 25px; padding-top: 15px; border-top: 1px solid #555;">Your Reflection:</div>`;
    
    this.fishDisplay.innerHTML = formattedHTML;
    this.fishDisplay.style.display = 'block';
  }
  
  showBottleContent(content) {
    // Parse and format bottle content for HTML display
    const parts = content.split('--- Your Response ---')[0];
    const lines = parts.split('\n');
    
    let formattedHTML = '';
    lines.forEach(line => {
      if (line.includes('Question:')) {
        formattedHTML += `<div style="color: #4a90e2; font-weight: bold; margin-bottom: 10px;">${line}</div>`;
      } else if (line.includes('Reflection by')) {
        formattedHTML += `<div style="color: #32cd32; font-weight: bold; margin: 15px 0 5px 0;">${line}</div>`;
      } else if (line.trim() !== '') {
        formattedHTML += `<div style="margin-bottom: 8px;">${line}</div>`;
      }
    });
    
    formattedHTML += `<div style="color: #ff69b4; font-weight: bold; margin-top: 20px; padding-top: 15px; border-top: 1px solid #555;">Your Response:</div>`;
    
    this.bottleDisplay.innerHTML = formattedHTML;
    this.bottleDisplay.style.display = 'block';
  }
  
  showQuestion(content) {
    // Create floating content text
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 512;
    canvas.height = 512; // Increased height for bottle content
    
    context.fillStyle = 'rgba(0,0,0,0.8)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    context.fillStyle = '#ffffff';
    context.font = '18px Arial'; // Smaller font for more content
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    
    // Word wrap with line breaks
    const lines = [];
    const paragraphs = content.split('\n');
    
    paragraphs.forEach(paragraph => {
      if (paragraph.trim() === '') {
        lines.push(''); // Empty line
        return;
      }
      
      const words = paragraph.split(' ');
      let currentLine = '';
      
      for (const word of words) {
        const testLine = currentLine + word + ' ';
        if (context.measureText(testLine).width > 450 && currentLine !== '') {
          lines.push(currentLine);
          currentLine = word + ' ';
        } else {
          currentLine = testLine;
        }
      }
      lines.push(currentLine);
    });
    
    const lineHeight = 22;
    const startY = Math.max(50, (canvas.height - (lines.length * lineHeight)) / 2);
    
    lines.forEach((line, index) => {
      // Highlight different sections
      if (line.includes('Question:')) {
        context.fillStyle = '#4a90e2';
        context.font = 'bold 18px Arial';
      } else if (line.includes('Reflection by')) {
        context.fillStyle = '#32cd32';
        context.font = 'bold 18px Arial';
      } else if (line.includes('--- Your Response ---')) {
        context.fillStyle = '#ff69b4';
        context.font = 'bold 18px Arial';
      } else {
        context.fillStyle = '#ffffff';
        context.font = '18px Arial';
      }
      
      context.fillText(line, canvas.width / 2, startY + index * lineHeight);
    });
    
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.MeshBasicMaterial({ 
      map: texture, 
      transparent: true 
    });
    
    const geometry = new THREE.PlaneGeometry(6, 6); // Larger panel for bottle content
    const contentPanel = new THREE.Mesh(geometry, material);
    
    contentPanel.position.copy(this.typewriter.position);
    contentPanel.position.y += 4;
    contentPanel.lookAt(this.camera.position);
    
    this.scene.add(contentPanel);
    
    // Remove after 8 seconds (longer for bottle content)
    setTimeout(() => {
      this.scene.remove(contentPanel);
    }, 8000);
  }
  
  onTextChange(text) {
    this.currentText = text;
    
    // Create word bubble for new words
    const words = text.split(' ');
    if (words.length > this.wordBubbles.length) {
      this.createWordBubble(words[words.length - 1]);
    }
    
    // Update reflection orb glow based on text length
    const intensity = Math.min(text.length / 100, 1);
    this.reflectionOrb.material.emissive.setHex(
      new THREE.Color().setHSL(0.6, 1, intensity * 0.3).getHex()
    );
    this.reflectionOrb.scale.setScalar(1 + intensity * 0.5);
  }
  
  createWordBubble(word) {
    if (!word.trim()) return;
    
    // Create bubble geometry
    const bubbleGeometry = new THREE.SphereGeometry(0.2, 8, 8);
    const bubbleMaterial = new THREE.MeshLambertMaterial({ 
      color: 0x87ceeb,
      transparent: true,
      opacity: 0.7
    });
    
    const bubble = new THREE.Mesh(bubbleGeometry, bubbleMaterial);
    
    // Position near typewriter
    bubble.position.copy(this.typewriter.position);
    bubble.position.x += (Math.random() - 0.5) * 2;
    bubble.position.z += (Math.random() - 0.5) * 2;
    bubble.position.y -= 1;
    
    // Add text to bubble (simplified)
    bubble.userData = { word, startTime: Date.now() };
    
    this.wordBubbles.push(bubble);
    this.scene.add(bubble);
    
    // Animate bubble rising
    this.animateBubble(bubble);
  }
  
  animateBubble(bubble) {
    const animate = () => {
      if (!bubble.parent) return;
      
      bubble.position.y += 0.02;
      bubble.material.opacity -= 0.005;
      
      if (bubble.material.opacity <= 0) {
        this.scene.remove(bubble);
        const index = this.wordBubbles.indexOf(bubble);
        if (index > -1) this.wordBubbles.splice(index, 1);
      } else {
        requestAnimationFrame(animate);
      }
    };
    animate();
  }
  
  completeWriting() {
    if (!this.currentText.trim()) return;
    
    // Show casting animation
    this.showCastingAnimation();
    
    // Hide input elements
    this.textInput.style.display = 'none';
    this.submitBtn.style.display = 'none';
    this.bottleDisplay.style.display = 'none';
    this.fishDisplay.style.display = 'none';
    
    // Call completion callback with casting animation
    if (this.onComplete) {
      this.onComplete(this.currentText);
    }
  }
  
  showCastingAnimation() {
    this.castingAnimation.style.display = 'block';
  }
  
  hideCastingAnimation() {
    this.castingAnimation.style.display = 'none';
  }
  
  createBottleAnimation() {
    // Hide input
    this.textInput.style.display = 'none';
    this.submitBtn.style.display = 'none';
    
    // Transform orb into bottle
    const bottleGeometry = new THREE.CylinderGeometry(0.15, 0.2, 0.8, 8);
    const bottleMaterial = new THREE.MeshLambertMaterial({ 
      color: 0x228b22,
      transparent: true,
      opacity: 0.8
    });
    
    const bottle = new THREE.Mesh(bottleGeometry, bottleMaterial);
    bottle.position.copy(this.reflectionOrb.position);
    this.scene.add(bottle);
    
    // Hide orb
    this.reflectionOrb.visible = false;
    
    // Animate bottle floating away
    this.animateBottleRelease(bottle);
  }
  
  animateBottleRelease(bottle) {
    let time = 0;
    const animate = () => {
      time += 0.02;
      
      // Float away
      bottle.position.x += Math.sin(time) * 0.01;
      bottle.position.z += 0.02;
      bottle.position.y += Math.sin(time * 2) * 0.005;
      bottle.rotation.z += 0.01;
      
      // Create particle trail
      if (Math.random() < 0.3) {
        this.createParticle(bottle.position);
      }
      
      // Fade out after distance
      if (time > 5) {
        bottle.material.opacity -= 0.02;
        if (bottle.material.opacity <= 0) {
          this.scene.remove(bottle);
          this.hide();
          if (this.onComplete) this.onComplete(this.currentText);
          return;
        }
      }
      
      requestAnimationFrame(animate);
    };
    animate();
  }
  
  createParticle(position) {
    const particleGeometry = new THREE.SphereGeometry(0.02, 4, 4);
    const particleMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x4a90e2,
      transparent: true,
      opacity: 0.8
    });
    
    const particle = new THREE.Mesh(particleGeometry, particleMaterial);
    particle.position.copy(position);
    particle.position.add(new THREE.Vector3(
      (Math.random() - 0.5) * 0.2,
      (Math.random() - 0.5) * 0.2,
      (Math.random() - 0.5) * 0.2
    ));
    
    this.scene.add(particle);
    
    // Animate particle
    let life = 1;
    const animateParticle = () => {
      life -= 0.02;
      particle.material.opacity = life;
      particle.position.y += 0.01;
      
      if (life <= 0) {
        this.scene.remove(particle);
      } else {
        requestAnimationFrame(animateParticle);
      }
    };
    animateParticle();
  }
  
  hide() {
    this.isActive = false;
    this.typewriter.visible = false;
    this.reflectionOrb.visible = false;
    this.textInput.style.display = 'none';
    this.submitBtn.style.display = 'none';
    this.bottleDisplay.style.display = 'none';
    this.fishDisplay.style.display = 'none';
    this.castingAnimation.style.display = 'none';
    
    // Clean up bubbles
    this.wordBubbles.forEach(bubble => this.scene.remove(bubble));
    this.wordBubbles = [];
    
    this.currentText = '';
  }
  
  update() {
    if (!this.isActive) return;
    
    // Gentle typewriter animation
    if (this.typewriter.visible) {
      this.typewriter.rotation.y += 0.001;
    }
    
    // Orb pulsing
    if (this.reflectionOrb.visible) {
      const time = Date.now() * 0.001;
      this.reflectionOrb.material.emissive.setHSL(0.6, 1, 0.2 + Math.sin(time * 2) * 0.1);
    }
  }
}
