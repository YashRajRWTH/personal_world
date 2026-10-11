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

    // Shift camera & focal target vertically on desktop to move base plate, car and everything down by ~2cm
    const desktopYOffset = isMobile ? 0 : 0.75;

    this.camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 150);
    this.camera.position.set(10.29, 8.82 + desktopYOffset, 12.81);
    this.camTargetPos.copy(this.camera.position);
    this.camTargetLook.set(0, 1.2 + desktopYOffset, 0);
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

    // Click handler for 3D car object and start overlay
    window.addEventListener('click', (event) => {
      // Ignore clicks on UI elements
      if (event.target.closest('.interactive-ui') || event.target.closest('.ctrl-btn')) return;

      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, this.camera);
      if (this.vehicles && this.vehicles.currentVehicle) {
        const intersects = raycaster.intersectObjects(this.vehicles.currentVehicle.children, true);
        if (intersects.length > 0) {
          triggerStartAction();
        }
      }
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

    // Camera view presets
    const camIsoBtn = document.getElementById('cam-iso');
    const camCloseBtn = document.getElementById('cam-close');
    const camFrontBtn = document.getElementById('cam-front');
    const camTopBtn = document.getElementById('cam-top');

    const setCamPreset = (btn, pos, target) => {
      this.isTransitioning = true;
      this.camTargetPos.copy(pos);
      this.camTargetLook.copy(target);

      // Fix: Update active highlight class on the camera preset buttons
      document.querySelectorAll('.cam-btn').forEach((b) => b.classList.remove('active'));
      if (btn) {
        btn.classList.add('active');
      }
    };

    const getDesktopY = () => (window.innerWidth < 768 ? 0 : 0.75);

    if (camIsoBtn) camIsoBtn.addEventListener('click', () => {
      const dy = getDesktopY();
      setCamPreset(camIsoBtn, new THREE.Vector3(10.29, 8.82 + dy, 12.81), new THREE.Vector3(0, 1.2 + dy, 0));
    });
    if (camCloseBtn) camCloseBtn.addEventListener('click', () => {
      const dy = getDesktopY();
      setCamPreset(camCloseBtn, new THREE.Vector3(3.78, 2.31 + dy, 4.41), new THREE.Vector3(0.1, 0.9 + dy, 0.1));
    });
    if (camFrontBtn) camFrontBtn.addEventListener('click', () => {
      const dy = getDesktopY();
      setCamPreset(camFrontBtn, new THREE.Vector3(0.5, 2.52 + dy, 7.14), new THREE.Vector3(0.1, 0.8 + dy, 0.1));
    });
    if (camTopBtn) camTopBtn.addEventListener('click', () => {
      const isMobile = window.innerWidth < 768;
      const dy = getDesktopY();
      const topHeight = isMobile ? 24.0 : 17.5;
      setCamPreset(camTopBtn, new THREE.Vector3(0.1, topHeight, 0.1), new THREE.Vector3(0, 0.5 + dy, 0));
    });

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
    const desktopYOffset = isMobile ? 0 : 0.75;

    this.camera.fov = isMobile ? 42 : 38;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    if (!this.isTransitioning) {
      this.controls.target.set(0, 1.2 + desktopYOffset, 0);
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
