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
    this.camTargetPos = new THREE.Vector3(9.2, 7.8, 11.5);
    this.camTargetLook = new THREE.Vector3(0, 1.2, 0);

    this.init();
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

    this.camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 150);
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
    // Ambient light with soft violet tint (illuminates car contours)
    const ambientLight = new THREE.AmbientLight(0x2d1d47, 1.15);
    this.scene.add(ambientLight);

    // Directional moon/sky rim light (crisp highlights on car skin)
    this.dirLight = new THREE.DirectionalLight(0xb4a0f8, 1.25);
    this.dirLight.position.set(12, 18, 10);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 40;
    this.dirLight.shadow.camera.left = -8;
    this.dirLight.shadow.camera.right = 8;
    this.dirLight.shadow.camera.top = 8;
    this.dirLight.shadow.camera.bottom = -8;
    this.dirLight.shadow.bias = -0.0005;
    this.dirLight.shadow.radius = 2.0;
    this.scene.add(this.dirLight);

    // Soft fill light from opposite angle
    const fillLight = new THREE.DirectionalLight(0x7c3888, 0.55);
    fillLight.position.set(-10, 8, -10);
    this.scene.add(fillLight);
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
    this.controls.maxPolarAngle = Math.PI / 2 - 0.06; // don't go below ground
    this.controls.minPolarAngle = 0.1;
    this.controls.autoRotate = true; // Auto-orbit enabled by default
    this.controls.autoRotateSpeed = 0.75;
  }

  setupInteractions() {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const triggerStartAction = () => {
      sound.unmute();
      sound.revEngine(1.2);
      sound.playChime();
      this.vehicles.triggerRevBounce();

      if (this.environment) {
        this.environment.hideClickToStart();
      }

      // Show launch notification
      const toast = document.getElementById('launch-toast');
      if (toast) {
        toast.classList.add('visible');
        setTimeout(() => toast.classList.remove('visible'), 3500);
      }

      // Camera cinematic swoosh
      const dy = window.innerWidth < 768 ? 0 : 0.75;
      this.isTransitioning = true;
      this.camTargetPos.set(4.8, 2.8 + dy, 6.2);
      this.camTargetLook.set(0.2, 0.8 + dy, 0.2);

      this.isDriving = true;
    };

    // Track pointer down vs up to keep drag-to-move (OrbitControls) 100% smooth without accidental clicks
    let pointerDownPos = { x: 0, y: 0 };
    window.addEventListener('pointerdown', (e) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('pointerup', (event) => {
      // Ignore clicks on UI buttons/panels
      if (event.target.closest('.interactive-ui') || event.target.closest('.ctrl-btn')) return;

      // If user moved more than 6px, it is a drag-to-move action, NOT a click
      const dragDist = Math.hypot(event.clientX - pointerDownPos.x, event.clientY - pointerDownPos.y);
      if (dragDist > 6) return;

      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, this.camera);

      // Check click targets: Car and "CLICK to START" text on sand
      const clickTargets = [];
      if (this.vehicles && this.vehicles.currentVehicle) {
        clickTargets.push(...this.vehicles.currentVehicle.children);
      }
      if (this.environment && this.environment.clickToStartMesh && this.environment.clickToStartMesh.visible) {
        clickTargets.push(this.environment.clickToStartMesh);
      }

      // Helper to test if raycast hit is on the curved text arc or car body
      const isHitOnCurvedTextOrCar = (intersects) => {
        for (const hit of intersects) {
          if (hit.object === this.environment?.clickToStartMesh) {
            const p = hit.point;
            const r = Math.hypot(p.x, p.z);
            const theta = Math.atan2(p.z, p.x);
            // Text arc at the side/front-right of vehicle: radius 3.1m to 4.4m, angle -0.2 to 1.4 rad
            if (r >= 3.1 && r <= 4.4 && theta >= -0.2 && theta <= 1.4) {
              return true;
            }
          } else {
            // Hit directly on the car
            return true;
          }
        }
        return false;
      };

      const intersects = raycaster.intersectObjects(clickTargets, true);
      if (isHitOnCurvedTextOrCar(intersects)) {
        triggerStartAction();
      }
    });

    // Funky hover cursor effect on clickable objects
    window.addEventListener('pointermove', (event) => {
      if (this.isDriving) {
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
      document.body.style.cursor = isHitOnCurvedTextOrCar(intersects) ? 'pointer' : 'default';
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

      this.isTransitioning = true;
      this.camTargetPos.copy(pos);
      this.camTargetLook.copy(look);

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

    if (!this.isTransitioning) {
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
      this.camera.position.lerp(this.camTargetPos, 0.04);
      this.controls.target.lerp(this.camTargetLook, 0.04);
      if (this.camera.position.distanceTo(this.camTargetPos) < 0.08) {
        this.isTransitioning = false;
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
