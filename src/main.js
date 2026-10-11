import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

import { WorldEnvironment } from './environment.js';
import { VehicleManager } from './vehicles.js';
import { sound } from './audio.js';

class GameIntroWorld {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.lastTime = performance.now();
    this.startTime = performance.now();

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.composer = null;
    this.controls = null;

    this.environment = null;
    this.vehicles = null;

    this.isDriving = false;
    this.isTransitioning = false;
    this.isWorldRevealed = false;
    this.camTargetPos = new THREE.Vector3(9.2, 7.8, 11.5);
    this.camTargetLook = new THREE.Vector3(0, 1.2, 0);
    this.camStartPos = new THREE.Vector3();
    this.camStartLook = new THREE.Vector3();
    this.camTransitionProgress = 0.0;
    this.camTransitionDuration = 1.6;

    this.init();
  }

  startCameraTransition(targetPos, targetLook, duration = 1.6) {
    if (!this.camera) return;
    this.camStartPos.copy(this.camera.position);
    this.camStartLook.copy(this.controls ? this.controls.target : new THREE.Vector3(0, 1.2, 0));
    this.camTargetPos.copy(targetPos);
    this.camTargetLook.copy(targetLook);
    this.camTransitionDuration = duration;
    this.camTransitionProgress = 0.0;
    this.isTransitioning = true;
  }

  async init() {
    this.setupScene();
    this.setupCamera();
    this.setupRenderer();
    this.setupPostProcessing();
    this.setupLighting();
    this.setupEnvironmentMap();

    // Build World Elements
    this.environment = new WorldEnvironment(this.scene);
    this.vehicles = new VehicleManager(this.scene);

    this.setupControls();
    this.setupInteractions();
    this.setupUI();

    // Start render loop
    window.addEventListener('resize', () => this.onWindowResize());
    this.animate();
  }

  setupScene() {
    this.scene = new THREE.Scene();
    // Deep atmospheric background & fog
    this.scene.background = new THREE.Color(0x07030e);
    this.scene.fog = new THREE.FogExp2(0x07030e, 0.024);
  }

  setupCamera() {
    const isMobile = window.innerWidth < 768;
    const aspect = window.innerWidth / window.innerHeight;
    const fov = isMobile ? 42 : 38;

    // Shift camera & focal target vertically on desktop/mobile to center diorama properly
    const desktopYOffset = isMobile ? 0 : 0.75;
    const targetYOffset = isMobile ? 1.0 : 0.9;

    this.camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 2500);
    this.camera.position.set(10.29, 8.82 + desktopYOffset, 12.81);
    this.camTargetPos.copy(this.camera.position);
    this.camTargetLook.set(0, 1.2 + targetYOffset, 0);
  }

  setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      powerPreference: 'high-performance',
      antialias: true
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02; // Brighter, crisper skin appearance
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.container.appendChild(this.renderer.domElement);
  }

  setupPostProcessing() {
    const size = new THREE.Vector2(window.innerWidth, window.innerHeight);

    this.composer = new EffectComposer(this.renderer);
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    // UnrealBloomPass - soft gentle glow
    this.bloomPass = new UnrealBloomPass(
      size,
      0.5,  // strength
      0.35, // radius
      0.88  // threshold
    );
    this.composer.addPass(this.bloomPass);

    const outputPass = new OutputPass();
    this.composer.addPass(outputPass);
  }

  setupLighting() {
    // Ambient light with soft violet tint (illuminates car contours) during intro
    this.ambientLight = new THREE.AmbientLight(0x2d1d47, 1.15);
    this.scene.add(this.ambientLight);

    // Directional moon/sky rim light (crisp highlights on car skin) during intro
    this.dirLight = new THREE.DirectionalLight(0xb4a0f8, 1.25);
    this.dirLight.position.set(12, 18, 10);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 160;
    this.dirLight.shadow.camera.left = -28;
    this.dirLight.shadow.camera.right = 28;
    this.dirLight.shadow.camera.top = 28;
    this.dirLight.shadow.camera.bottom = -28;
    this.dirLight.shadow.bias = -0.0005;
    this.dirLight.shadow.radius = 2.0;
    this.scene.add(this.dirLight);

    // Soft fill light from opposite angle
    this.fillLight = new THREE.DirectionalLight(0x7c3888, 0.55);
    this.fillLight.position.set(-10, 8, -10);
    this.scene.add(this.fillLight);

    // Warm hemisphere ambient light for realistic sunset sky-and-ground bounce
    this.hemiLight = new THREE.HemisphereLight(0x2d1d47, 0x140e1f, 0.0);
    this.scene.add(this.hemiLight);
  }

  setupEnvironmentMap() {
    const rgbeLoader = new RGBELoader();
    rgbeLoader.load(
      '/textures/venice_sunset_1k.hdr',
      (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        this.scene.environment = texture;
        this.scene.environmentIntensity = 0.85; // Rich metallic & glossy reflections on car skin
      },
      undefined,
      (err) => {
        console.warn('Could not load HDR texture:', err);
      }
    );
  }

  setupControls() {
    const isMobile = window.innerWidth < 768;
    const desktopYOffset = isMobile ? 1.0 : 0.9;

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.target.set(0, 1.2 + desktopYOffset, 0);

    // Restrict controls to keep diorama centered and avoid going under the floor
    this.controls.minDistance = 4;
    this.controls.maxDistance = 35;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.04; // don't go below ground
    this.controls.minPolarAngle = 0.05;
    this.controls.autoRotate = true; // Auto-orbit enabled by default
    this.controls.autoRotateSpeed = 0.75;

    // Immediately stop automated camera transitions when user drags/touches the screen
    this.controls.addEventListener('start', () => {
      this.isTransitioning = false;
    });
  }

  setupInteractions() {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const triggerStartAction = () => {
      if (this.isWorldRevealed) return;
      this.isWorldRevealed = true;

      sound.unmute();
      sound.revEngine(1.3);
      sound.playExpansionSwell();
      this.vehicles.triggerRevBounce();

      // Trigger the expanding glowing blue light / circle to infinity and reveal island
      const waveColor = (this.vehicles && this.vehicles.primaryColor) ? this.vehicles.primaryColor : 0x00d2d3;
      if (this.environment) {
        this.environment.startWorldExpansion(waveColor);
      }

      // Show launch notification
      const toast = document.getElementById('launch-toast');
      if (toast) {
        const toastTitle = toast.querySelector('strong');
        if (toastTitle) toastTitle.textContent = 'ISLAND REVEALED';
        const toastDesc = toast.querySelector('span');
        if (toastDesc) toastDesc.textContent = 'Explore the coastlines and surrounding ocean';
        toast.classList.add('visible');
        setTimeout(() => toast.classList.remove('visible'), 4000);
      }

      // Elevated 3/4 perspective matching Bruno Simon portfolio view angle
      const isMobile = window.innerWidth < 768;
      const targetPos = isMobile
        ? new THREE.Vector3(22.0, 14.0, 26.0)
        : new THREE.Vector3(18.0, 10.5, 22.0);
      const targetLook = new THREE.Vector3(0.0, 1.2, 0.0);

      this.startCameraTransition(targetPos, targetLook, 1.8);

      // Expand maximum camera orbit distance for exploring the island & ocean freely
      if (this.controls) {
        this.controls.maxDistance = 500;
        this.controls.autoRotate = false; // Give user full, stable manual orbit control
        const orbitToggle = document.getElementById('btn-orbit-toggle');
        if (orbitToggle) orbitToggle.classList.remove('active');
      }

      this.isDriving = true;
    };

    // Track pointer down vs up to keep drag-to-move (OrbitControls) 100% smooth without accidental clicks
    let pointerDownPos = { x: 0, y: 0 };
    window.addEventListener('pointerdown', (e) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    });

    // Helper to test if raycast hit is on the car, decal, or anywhere in the circle (radius <= 5.0)
    const isHitOnCircleOrCar = (intersects) => {
      if (intersects && intersects.length > 0) {
        return true;
      }

      // Check ground plane within the diorama circle
      const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.55);
      const hitPoint = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(groundPlane, hitPoint)) {
        if (Math.hypot(hitPoint.x, hitPoint.z) <= 5.1) {
          return true;
        }
      }
      return false;
    };

    window.addEventListener('pointerup', (event) => {
      // Ignore clicks on UI buttons/panels
      if (event.target.closest('.interactive-ui') || event.target.closest('.ctrl-btn')) return;

      // If user moved more than 6px, it is a drag-to-move action, NOT a click
      const dragDist = Math.hypot(event.clientX - pointerDownPos.x, event.clientY - pointerDownPos.y);
      if (dragDist > 6) return;

      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, this.camera);

      // Check click targets: Car and click-to-start text
      const clickTargets = [];
      if (this.vehicles && this.vehicles.currentVehicle) {
        clickTargets.push(...this.vehicles.currentVehicle.children);
      }
      if (this.environment && this.environment.clickToStartMesh && this.environment.clickToStartMesh.visible) {
        clickTargets.push(this.environment.clickToStartMesh);
      }

      const intersects = raycaster.intersectObjects(clickTargets, true);
      if (isHitOnCircleOrCar(intersects)) {
        triggerStartAction();
      }
    });

    // Funky hover cursor effect on clickable objects
    window.addEventListener('pointermove', (event) => {
      if (this.isWorldRevealed) {
        document.body.style.cursor = 'default';
        return;
      }
      if (event.target.closest('.interactive-ui') || event.target.closest('.ctrl-btn')) {
        document.body.style.cursor = 'default';
        return;
      }

      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, this.camera);
      const hoverTargets = [];
      if (this.vehicles && this.vehicles.currentVehicle) {
        hoverTargets.push(...this.vehicles.currentVehicle.children);
      }
      if (this.environment && this.environment.clickToStartMesh && this.environment.clickToStartMesh.visible) {
        hoverTargets.push(this.environment.clickToStartMesh);
      }

      const intersects = raycaster.intersectObjects(hoverTargets, true);
      document.body.style.cursor = isHitOnCircleOrCar(intersects) ? 'pointer' : 'default';
    });



    // Sound toggle button
    const soundBtn = document.getElementById('sound-toggle');
    if (soundBtn) {
      soundBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const unmuted = sound.toggleMute();
        soundBtn.classList.toggle('unmuted', unmuted);
        soundBtn.querySelector('.sound-icon').textContent = unmuted ? '🔊' : '🔇';
      });
    }
  }

  setupUI() {
    // Car color picker buttons
    const colorSwatches = document.querySelectorAll('.color-swatch');
    colorSwatches.forEach((swatch) => {
      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        const hex = parseInt(swatch.dataset.color, 16);
        this.vehicles.setPaintColor(hex);
        this.environment.setNeonColor(hex);
        colorSwatches.forEach((s) => s.classList.remove('active'));
        swatch.classList.add('active');
        sound.revEngine(0.4);
      });
    });

    // Horn button
    const hornBtn = document.getElementById('btn-horn');
    if (hornBtn) {
      hornBtn.addEventListener('click', () => {
        sound.playHorn();
        this.vehicles.triggerRevBounce();
      });
    }

    // Rev engine button
    const revBtn = document.getElementById('btn-rev');
    if (revBtn) {
      revBtn.addEventListener('click', () => {
        sound.unmute();
        sound.revEngine(1.0);
        this.vehicles.triggerRevBounce();
      });
    }

    // Camera view presets & mobile dropdown
    const presetConfigs = {
      iso: {
        name: 'Isometric',
        getCoords: (dy, isMobile) => ({
          pos: new THREE.Vector3(10.29, 8.82 + dy, 12.81),
          look: new THREE.Vector3(0, 1.2 + (isMobile ? 1.0 : 0.9), 0)
        })
      },
      close: {
        name: 'Close-Up',
        getCoords: (dy) => ({
          pos: new THREE.Vector3(3.78, 2.31 + dy, 4.41),
          look: new THREE.Vector3(0.1, 0.9 + dy, 0.1)
        })
      },
      front: {
        name: 'Front',
        getCoords: (dy) => ({
          pos: new THREE.Vector3(0.5, 2.52 + dy, 7.14),
          look: new THREE.Vector3(0.1, 0.8 + dy, 0.1)
        })
      },
      top: {
        name: 'Top',
        getCoords: (dy, isMobile) => ({
          pos: new THREE.Vector3(0.1, isMobile ? 24.0 : 17.5, 0.1),
          look: new THREE.Vector3(0, 0.5 + dy, 0)
        })
      }
    };

    const currentText = document.getElementById('cam-current-text');
    const dropdown = document.getElementById('cam-dropdown');
    const dropdownBtn = document.getElementById('cam-dropdown-btn');

    const applyCamPreset = (presetKey) => {
      const cfg = presetConfigs[presetKey];
      if (!cfg) return;

      const isMobile = window.innerWidth < 768;
      const dy = isMobile ? 0 : 0.75;
      const { pos, look } = cfg.getCoords(dy, isMobile);

      this.startCameraTransition(pos, look, 1.4);

      // Synchronize active class across desktop buttons
      document.querySelectorAll('.cam-btn').forEach((b) => {
        b.classList.toggle('active', b.dataset.cam === presetKey);
      });

      // Synchronize active class across mobile dropdown options
      document.querySelectorAll('.cam-dropdown-opt').forEach((opt) => {
        const isActive = opt.dataset.cam === presetKey;
        opt.classList.toggle('active', isActive);
        opt.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });

      // Update mobile dropdown current label
      if (currentText) {
        currentText.textContent = cfg.name;
      }
    };

    // Desktop preset buttons
    document.querySelectorAll('.cam-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        applyCamPreset(btn.dataset.cam);
      });
    });

    // Mobile dropdown toggle & options
    if (dropdownBtn && dropdown) {
      dropdownBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = dropdown.classList.toggle('open');
        dropdownBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      });

      document.querySelectorAll('.cam-dropdown-opt').forEach((opt) => {
        opt.addEventListener('click', (e) => {
          e.stopPropagation();
          applyCamPreset(opt.dataset.cam);
          dropdown.classList.remove('open');
          dropdownBtn.setAttribute('aria-expanded', 'false');
        });
      });

      // Dismiss dropdown when clicking outside
      window.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target)) {
          dropdown.classList.remove('open');
          dropdownBtn.setAttribute('aria-expanded', 'false');
        }
      });
    }

    // Auto-rotate toggle (default active)
    const orbitToggle = document.getElementById('btn-orbit-toggle');
    if (orbitToggle) {
      orbitToggle.classList.toggle('active', this.controls.autoRotate);
      orbitToggle.addEventListener('click', () => {
        this.controls.autoRotate = !this.controls.autoRotate;
        orbitToggle.classList.toggle('active', this.controls.autoRotate);
      });
    }
  }

  onWindowResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const isMobile = width < 768;
    const targetYOffset = isMobile ? 1.0 : 0.9;

    this.camera.fov = isMobile ? 42 : 38;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    if (!this.isWorldRevealed && !this.isTransitioning) {
      this.controls.target.set(0, 1.2 + targetYOffset, 0);
    }

    this.renderer.setSize(width, height);
    this.composer.setSize(width, height);
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const now = performance.now();
    const delta = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;
    const time = (now - this.startTime) / 1000;

    // Smooth camera transition if active
    if (this.isTransitioning) {
      this.camTransitionProgress += delta / this.camTransitionDuration;
      if (this.camTransitionProgress >= 1.0) {
        this.camTransitionProgress = 1.0;
        this.isTransitioning = false;
        this.camera.position.copy(this.camTargetPos);
        this.controls.target.copy(this.camTargetLook);
      } else {
        // Smooth cubic ease-out curve
        const t = 1.0 - Math.pow(1.0 - this.camTransitionProgress, 3.0);
        this.camera.position.lerpVectors(this.camStartPos, this.camTargetPos, t);
        this.controls.target.lerpVectors(this.camStartLook, this.camTargetLook, t);
      }
    }

    // Smooth lighting & environment transition once revealed (NATURAL SUNSET LIGHTING)
    if (this.isWorldRevealed) {
      const lerpSpeed = delta * 1.8;

      // 1. Atmospheric Fog: soft sunset horizon haze (clear view of distant sea and small sun)
      if (this.scene.fog) {
        this.scene.fog.density = THREE.MathUtils.lerp(this.scene.fog.density, 0.0008, lerpSpeed);
        this.scene.fog.color.lerp(new THREE.Color(0xa2481e), lerpSpeed);
      }

      // 2. Scene Background: dusk twilight fallback
      if (this.scene.background) {
        this.scene.background.lerp(new THREE.Color(0x180b14), lerpSpeed);
      }

      // 3. Directional Sun: rich orangish sunset shade matching reference screenshot
      if (this.dirLight) {
        this.dirLight.intensity = THREE.MathUtils.lerp(this.dirLight.intensity, 1.85, lerpSpeed);
        this.dirLight.color.lerp(new THREE.Color(0xff7426), lerpSpeed);
        this.dirLight.position.lerp(new THREE.Vector3(-65, 8.5, -90), lerpSpeed);
      }

      // 4. Ambient Light: deep purple-violet ambient from reference screenshot shadows
      if (this.ambientLight) {
        this.ambientLight.intensity = THREE.MathUtils.lerp(this.ambientLight.intensity, 0.9, lerpSpeed);
        this.ambientLight.color.lerp(new THREE.Color(0x3e1c4a), lerpSpeed);
      }

      // 5. Fill Light: subtle warm fill from behind camera
      if (this.fillLight) {
        this.fillLight.intensity = THREE.MathUtils.lerp(this.fillLight.intensity, 0.35, lerpSpeed);
        this.fillLight.color.lerp(new THREE.Color(0x5a2444), lerpSpeed);
        this.fillLight.position.lerp(new THREE.Vector3(30, 15, 40), lerpSpeed);
      }

      // 6. Hemisphere Light: dusk sky + purple terrain bounce from screenshot
      if (this.hemiLight) {
        this.hemiLight.intensity = THREE.MathUtils.lerp(this.hemiLight.intensity, 0.4, lerpSpeed);
        this.hemiLight.color.lerp(new THREE.Color(0x6e2c46), lerpSpeed);
        this.hemiLight.groundColor.lerp(new THREE.Color(0x280e2a), lerpSpeed);
      }

      // 7. Bloom: crisp bloom for water glints and distant sun without enlarging sun disk
      if (this.bloomPass) {
        this.bloomPass.strength = THREE.MathUtils.lerp(this.bloomPass.strength, 0.35, lerpSpeed);
        this.bloomPass.threshold = THREE.MathUtils.lerp(this.bloomPass.threshold, 0.88, lerpSpeed);
      }
    }

    this.controls.update();

    if (this.environment) {
      this.environment.update(time, delta);
    }

    if (this.vehicles) {
      this.vehicles.update(time, delta, this.isDriving);
    }

    this.composer.render();
  }
}

// Start application
window.addEventListener('DOMContentLoaded', () => {
  new GameIntroWorld();
});
