import * as THREE from 'three';
import { fishingAPI } from './api.js';
import { WritingInterface } from './writingInterface.js';
import {exitFishingZoom} from "./main.js";
export class FishingGame {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.isActive = false;
    this.currentState = 'idle'; // idle, baitSelection, casting, meditating, hooking, reeling
    this.meditationTimer = 0;
    this.breathingPhase = 0; // 0=inhale, 1=hold, 2=exhale
    this.breathingTimer = 0;
    this.selectedBait = null;
    this.currentFish = null;
    
    this.baitTypes = {
      personal: { name: 'Personal', emoji: '🌸', color: 0xff69b4 },
      philosophical: { name: 'Philosophical', emoji: '🧠', color: 0x9370db },
      deep: { name: 'Deep', emoji: '🌊', color: 0x4682b4 },
      fun: { name: 'Fun', emoji: '🎉', color: 0xffd700 }
    };
    
    this.writingInterface = new WritingInterface(scene, camera);
    this.createUI();
  }
  
  createUI() {
    // Bait selection UI
    this.baitUI = document.createElement('div');
    this.baitUI.id = 'bait-selection';
    this.baitUI.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background: rgba(0,0,0,0.8); padding: 20px; border-radius: 10px;
      display: none; z-index: 1000; color: white; text-align: center;
    `;
    
    this.baitUI.innerHTML = `
      <h3>Select Your Bait</h3>
      <div id="bait-options" style="display: flex; gap: 15px; margin: 20px 0;"></div>
      <button id="cancel-fishing">Cancel</button>
    `;
    
    // Fish/Bottle selection UI
    this.typeUI = document.createElement('div');
    this.typeUI.id = 'type-selection';
    this.typeUI.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background: rgba(0,0,0,0.8); padding: 20px; border-radius: 10px;
      display: none; z-index: 1000; color: white; text-align: center;
    `;
    
    this.typeUI.innerHTML = `
      <h3>What would you like to catch?</h3>
      <div style="display: flex; gap: 20px; margin: 20px 0;">
        <div id="fish-option" style="
          padding: 20px; border: 2px solid #4a90e2; border-radius: 10px;
          cursor: pointer; transition: all 0.3s; background: rgba(74,144,226,0.1);
        ">
          <div style="font-size: 32px;">🐟</div>
          <div>Fish for Questions</div>
          <div style="font-size: 12px; color: #aaa;">Get a new reflection prompt</div>
        </div>
        <div id="bottle-option" style="
          padding: 20px; border: 2px solid #32cd32; border-radius: 10px;
          cursor: pointer; transition: all 0.3s; background: rgba(50,205,50,0.1);
        ">
          <div style="font-size: 32px;">🍾</div>
          <div>Fish for Bottles</div>
          <div style="font-size: 12px; color: #aaa;">Read others' reflections</div>
        </div>
      </div>
      <button id="back-to-bait">Back</button>
    `;
    
    // Meditation UI (unchanged)
    this.meditationUI = document.createElement('div');
    this.meditationUI.id = 'meditation-ui';
    this.meditationUI.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background: rgba(0,0,0,0.8); padding: 40px; border-radius: 10px;
      display: none; z-index: 1000; color: white; text-align: center;
      width: 500px;
    `;
    
    this.meditationUI.innerHTML = `
      <h3 id="meditation-title">Waiting for Fish...</h3>
      <div id="breathing-guide" style="margin: 30px 0;">
        <div id="breathing-orb" style="
          width: 120px; height: 120px; border-radius: 50%;
          background: radial-gradient(circle, #4a90e2, #2c5aa0);
          margin: 0 auto 20px; transition: transform 0.5s ease;
        "></div>
        <div id="breathing-text">Breathe in...</div>
      </div>
      <div id="meditation-progress" style="
        width: 100%; height: 10px; background: #333; border-radius: 5px; overflow: hidden;
      ">
        <div id="progress-bar" style="
          height: 100%; background: linear-gradient(90deg, #4a90e2, #2c5aa0);
          width: 0%; transition: width 0.1s ease;
        "></div>
      </div>
      <div id="meditation-timer">60s</div>
      <button id="skip-meditation" style="margin-top: 15px; display: none;">Skip (30s+)</button>
      <button id="test-skip" style="margin-top: 10px; background: #ff4444; color: white; border: none; padding: 8px 16px; border-radius: 5px; cursor: pointer;">Skip (Testing)</button>
    `;
    
    document.body.appendChild(this.baitUI);
    document.body.appendChild(this.typeUI);
    document.body.appendChild(this.meditationUI);
    
    this.setupEventListeners();
    this.populateBaitOptions();
  }
  
  populateBaitOptions() {
    const container = document.getElementById('bait-options');
    Object.entries(this.baitTypes).forEach(([key, bait]) => {
      const option = document.createElement('div');
      option.style.cssText = `
        padding: 15px; border: 2px solid #${bait.color.toString(16)};
        border-radius: 8px; cursor: pointer; transition: all 0.3s;
        background: rgba(${(bait.color >> 16) & 255}, ${(bait.color >> 8) & 255}, ${bait.color & 255}, 0.1);
      `;
      option.innerHTML = `<div style="font-size: 24px;">${bait.emoji}</div><div>${bait.name}</div>`;
      option.onclick = () => this.selectBait(key);
      container.appendChild(option);
    });
  }
  
  setupEventListeners() {
    document.getElementById('cancel-fishing').onclick = () => this.cancel();
    document.getElementById('skip-meditation').onclick = () => this.skipMeditation();
    document.getElementById('test-skip').onclick = () => this.skipMeditation();
    document.getElementById('fish-option').onclick = () => this.selectType('fish');
    document.getElementById('bottle-option').onclick = () => this.selectType('bottle');
    document.getElementById('back-to-bait').onclick = () => this.backToBait();
  }
  
  startFishing() {
    if (this.isActive) return;
    this.isActive = true;
    this.currentState = 'baitSelection';
    this.baitUI.style.display = 'block';
  }
  
  selectBait(baitType) {
    this.selectedBait = baitType;
    this.baitUI.style.display = 'none';
    this.showTypeSelection();
  }
  
  showTypeSelection() {
    this.currentState = 'typeSelection';
    this.typeUI.style.display = 'block';
  }
  
  selectType(type) {
    this.selectedType = type;
    this.typeUI.style.display = 'none';
    this.startMeditation();
  }
  
  backToBait() {
    this.typeUI.style.display = 'none';
    this.baitUI.style.display = 'block';
    this.currentState = 'baitSelection';
  }
  
  startMeditation() {
    this.currentState = 'meditating';
    this.meditationTimer = 60; // 60 seconds
    this.breathingTimer = 0;
    this.breathingPhase = 0;
    
    // Update title based on what we're fishing for
    const title = this.selectedType === 'bottle' ? 'Waiting for Bottles...' : 'Waiting for Fish...';
    document.getElementById('meditation-title').textContent = title;
    
    this.meditationUI.style.display = 'block';
    this.updateMeditation();
  }
  
  updateMeditation() {
    if (this.currentState !== 'meditating') return;
    
    const deltaTime = 0.016; // ~60fps
    this.meditationTimer -= deltaTime;
    this.breathingTimer += deltaTime;
    
    // Breathing cycle: 4s inhale, 4s hold, 6s exhale
    const phases = [4, 4, 6];
    const currentPhaseTime = phases[this.breathingPhase];
    
    if (this.breathingTimer >= currentPhaseTime) {
      this.breathingTimer = 0;
      this.breathingPhase = (this.breathingPhase + 1) % 3;
    }
    
    this.updateBreathingUI();
    this.updateProgressBar();
    
    // Show skip button after 30 seconds
    if (this.meditationTimer <= 30) {
      document.getElementById('skip-meditation').style.display = 'block';
    }
    
    if (this.meditationTimer <= 0) {
      this.completeMeditation();
    } else {
      requestAnimationFrame(() => this.updateMeditation());
    }
  }
  
  updateBreathingUI() {
    const orb = document.getElementById('breathing-orb');
    const text = document.getElementById('breathing-text');
    const timer = document.getElementById('meditation-timer');
    
    const phases = ['Breathe in...', 'Hold...', 'Breathe out...'];
    const scales = [1.2, 1.2, 0.9]; // Reduced from [1.5, 1.5, 0.8]
    
    text.textContent = phases[this.breathingPhase];
    orb.style.transform = `scale(${scales[this.breathingPhase]})`;
    timer.textContent = `${Math.ceil(this.meditationTimer)}s`;
  }
  
  updateProgressBar() {
    const progress = ((60 - this.meditationTimer) / 60) * 100;
    document.getElementById('progress-bar').style.width = `${progress}%`;
  }
  
  skipMeditation() {
    this.completeMeditation();
  }
  
  async completeMeditation() {
    this.meditationUI.style.display = 'none';
    this.currentState = 'hooking';
    
    try {
      if (this.selectedType === 'fish') {
        // Get fish (question) based on selected bait
        this.currentFish = await this.catchFishByBait();
        console.log('Caught fish:', this.currentFish);
        this.showCatch(this.currentFish);
      } else {
        // Get bottle (other user's reflection) based on selected bait
        this.currentBottle = await this.catchBottleByBait();
        console.log('Caught bottle:', this.currentBottle);
        this.showBottle(this.currentBottle);
      }
    } catch (error) {
      console.error('Failed to catch:', error);
      this.cancel();
    }
  }
  
  async catchFishByBait() {
    // Map bait types to question types for API
    const baitToQuestionType = {
      personal: 'personal',
      philosophical: 'philosophical', 
      deep: 'deep',
      fun: 'fun'
    };
    
    const questionType = baitToQuestionType[this.selectedBait] || 'personal';
    
    // Use API with question type filtering
    return await fishingAPI.catchFish('player', questionType);
  }
  
  async catchBottleByBait() {
    // Get bottles from other users
    console.log('Calling catchBottle API...');
    const bottle = await fishingAPI.catchBottle('player');
    console.log('API returned bottle:', bottle);
    return bottle;
  }
  
  showCatch(fish) {
    this.currentState = 'writing';
    console.log('Showing fish catch:', fish);
    
    // Show artistic writing interface for fish (questions)
    this.writingInterface.show(fish.question, (reflection) => {
      this.createBottle(fish, reflection);
    });
  }
  
  showBottle(bottle) {
    this.currentState = 'responding';
    console.log('Showing bottle:', bottle);
    
    // Create a formatted display of the bottle content
    const bottleDisplay = `Question: "${bottle.question}"\n\nReflection by ${bottle.username}:\n"${bottle.message}"\n\n--- Your Response ---`;
    console.log('Bottle display text:', bottleDisplay);
    
    this.writingInterface.show(bottleDisplay, (response) => {
      this.respondToBottle(bottle, response);
    });
  }
  
  async respondToBottle(bottle, response) {
    try {
      // Use the bottle's question_id to add response
      await fishingAPI.respondToBottle('player', bottle.question_id, response);
      console.log('🍾 Your response has been added to this bottle!');
    } catch (error) {
      console.error('Failed to respond to bottle:', error);
    }
    
    // Hide casting animation and reset
    this.writingInterface.hideCastingAnimation();
    this.reset();
  }
  
  async createBottle(fish, reflection) {
    try {
      await fishingAPI.createBottle(fish.id, 'player', reflection);
      console.log('🍾 Reflection bottled and cast into the waters!');
    } catch (error) {
      console.error('Failed to create bottle:', error);
    }
    
    // Hide casting animation and reset
    this.writingInterface.hideCastingAnimation();
    this.reset();
  }
  
  cancel() {
    exitFishingZoom();
    this.reset();
  }
  
  reset() {
    this.isActive = false;
    this.currentState = 'idle';
    this.selectedBait = null;
    this.selectedType = null;
    this.currentFish = null;
    this.currentBottle = null;
    this.baitUI.style.display = 'none';
    this.typeUI.style.display = 'none';
    this.meditationUI.style.display = 'none';
    document.getElementById('skip-meditation').style.display = 'none';
    
    // Ensure writing interface is properly closed
    this.writingInterface.hide();
  }
  
  update() {
    // Update writing interface
    this.writingInterface.update();
  }
}
