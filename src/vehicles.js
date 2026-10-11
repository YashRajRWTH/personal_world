import * as THREE from 'three';

/**
 * Vehicle Manager:
 * Dedicated procedural Cyber Rally Buggy matching reference image with
 * brightened, glossy automotive skin, suspension bounce, and spotlights.
 */

export class VehicleManager {
  constructor(scene) {
    this.scene = scene;
    this.currentVehicle = null;
    this.buggyGroup = null;

    // References for animations and effects
    this.chassisMesh = null;
    this.wheels = [];
    this.headlights = [];
    this.roofLights = [];
    this.exhaustMeshes = [];
    this.headlightSpotlights = [];
    this.underglowLight = null;
    this.hubRings = [];

    // Color theme - Cyber Cyan (Default)
    this.primaryColor = 0x00d2d3;
    this.bodyMaterial = null;
    this.cageMat = null;

    // Suspension bounce physics
    this.suspensionY = 0;
    this.suspensionVel = 0;

    this.init();
  }

  init() {
    this.createCyberBuggy();
  }

  createCyberBuggy() {
    this.buggyGroup = new THREE.Group();
    // Position car right at the center of the circular island
    this.buggyGroup.position.set(0.1, 0.55, 0.1);
    this.buggyGroup.rotation.y = -0.65; // Matches screenshot angle

    // Materials - Bright, glossy, vibrant skin
    this.bodyMaterial = new THREE.MeshPhysicalMaterial({
      color: this.primaryColor,
      roughness: 0.16,
      metalness: 0.4,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      reflectivity: 0.95
    });

    const matteDarkMat = new THREE.MeshStandardMaterial({
      color: 0x16171b,
      roughness: 0.65,
      metalness: 0.35
    });

    const gunmetalMat = new THREE.MeshStandardMaterial({
      color: 0x2e3037,
      roughness: 0.3,
      metalness: 0.85
    });

    this.cageMat = new THREE.MeshStandardMaterial({
      color: this.primaryColor,
      roughness: 0.22,
      metalness: 0.55
    });
    const cageMat = this.cageMat;

    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x0a0d12,
      roughness: 0.05,
      metalness: 0.1,
      transmission: 0.6,
      opacity: 0.9,
      transparent: true
    });

    const tireMat = new THREE.MeshStandardMaterial({
      color: 0x121315,
      roughness: 0.9,
      metalness: 0.05
    });

    const rimMat = new THREE.MeshStandardMaterial({
      color: 0x1f2126,
      roughness: 0.25,
      metalness: 0.9
    });

    const headlightMat = new THREE.MeshBasicMaterial({
      color: 0xe0ad36 // Pleasant warm golden LED, muted
    });

    const roofLightMat = new THREE.MeshBasicMaterial({
      color: 0xd97706 // Muted amber roof marker lights
    });

    const taillightMat = new THREE.MeshBasicMaterial({
      color: 0x991b1b // Muted deep crimson red
    });

    // 1. CHASSIS ROOT (for suspension bounce)
    this.chassisMesh = new THREE.Group();
    this.buggyGroup.add(this.chassisMesh);

    // Main lower tub / frame
    const lowerTubGeo = new THREE.BoxGeometry(1.6, 0.35, 3.2);
    const lowerTub = new THREE.Mesh(lowerTubGeo, matteDarkMat);
    lowerTub.position.y = 0.5;
    lowerTub.castShadow = true;
    lowerTub.receiveShadow = true;
    this.chassisMesh.add(lowerTub);

    // Heavy-duty front skid plate / bash plate
    const skidGeo = new THREE.BoxGeometry(1.4, 0.15, 0.9);
    const skid = new THREE.Mesh(skidGeo, gunmetalMat);
    skid.position.set(0, 0.42, 1.6);
    skid.rotation.x = -0.35;
    skid.castShadow = true;
    this.chassisMesh.add(skid);

    // Front bullbar bumper
    const bumperGeo = new THREE.CylinderGeometry(0.045, 0.045, 1.7, 12);
    const bumper = new THREE.Mesh(bumperGeo, cageMat);
    bumper.rotation.z = Math.PI / 2;
    bumper.position.set(0, 0.48, 1.95);
    bumper.castShadow = true;
    this.chassisMesh.add(bumper);

    // Tow hooks on bumper
    [-0.45, 0.45].forEach((hx) => {
      const hook = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.02, 8, 16), cageMat);
      hook.position.set(hx, 0.44, 2.0);
      hook.rotation.y = Math.PI / 2;
      this.chassisMesh.add(hook);
    });

    // 2. MAIN BODY HOOD & FENDERS (Crimson bodywork)
    const hoodGeo = new THREE.BoxGeometry(1.5, 0.28, 1.4);
    const hood = new THREE.Mesh(hoodGeo, this.bodyMaterial);
    hood.position.set(0, 0.65, 0.85);
    hood.castShadow = true;
    this.chassisMesh.add(hood);

    // Hood scoop / vents
    const scoopGeo = new THREE.BoxGeometry(0.65, 0.1, 0.6);
    const scoop = new THREE.Mesh(scoopGeo, matteDarkMat);
    scoop.position.set(0, 0.82, 0.85);
    this.chassisMesh.add(scoop);

    // Muscular flared wheel arches / fenders
    const fenderGeo = new THREE.BoxGeometry(0.32, 0.35, 0.95);
    const fenderPos = [
      [-0.88, 0.62, 1.1], // front left
      [0.88, 0.62, 1.1],  // front right
      [-0.88, 0.65, -1.0], // rear left
      [0.88, 0.65, -1.0]   // rear right
    ];
    fenderPos.forEach(([fx, fy, fz]) => {
      const fender = new THREE.Mesh(fenderGeo, matteDarkMat);
      fender.position.set(fx, fy, fz);
      fender.castShadow = true;
      this.chassisMesh.add(fender);
    });

    // 3. CABIN & COCKPIT CANOPY
    const cabinGeo = new THREE.BoxGeometry(1.3, 0.65, 1.3);
    const cabin = new THREE.Mesh(cabinGeo, glassMat);
    cabin.position.set(0, 1.05, -0.2);
    cabin.castShadow = true;
    this.chassisMesh.add(cabin);

    // Interior cockpit glow & steering wheel
    const dashLight = new THREE.PointLight(0xff5500, 0.5, 1.5);
    dashLight.position.set(0, 0.95, 0.1);
    this.chassisMesh.add(dashLight);

    const steering = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 8, 16), matteDarkMat);
    steering.position.set(-0.3, 0.95, 0.1);
    steering.rotation.x = -0.4;
    this.chassisMesh.add(steering);

    // 4. EXTERNAL EXOSKELETON ROLL CAGE (Tubular crimson cage)
    const cageBarData = [
      // A-pillars (front angled)
      { p: [-0.68, 1.0, 0.45], r: [0.65, 0, 0], len: 1.1 },
      { p: [0.68, 1.0, 0.45], r: [0.65, 0, 0], len: 1.1 },
      // Roof side rails
      { p: [-0.68, 1.38, -0.2], r: [Math.PI / 2, 0, 0], len: 1.4 },
      { p: [0.68, 1.38, -0.2], r: [Math.PI / 2, 0, 0], len: 1.4 },
      // C-pillars (rear angled down)
      { p: [-0.68, 1.05, -0.9], r: [-0.7, 0, 0], len: 1.15 },
      { p: [0.68, 1.05, -0.9], r: [-0.7, 0, 0], len: 1.15 },
      // Roof crossbars
      { p: [0, 1.38, 0.35], r: [0, 0, Math.PI / 2], len: 1.36 },
      { p: [0, 1.38, -0.75], r: [0, 0, Math.PI / 2], len: 1.36 }
    ];

    cageBarData.forEach((b) => {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, b.len, 10), cageMat);
      bar.position.set(b.p[0], b.p[1], b.p[2]);
      bar.rotation.set(b.r[0], b.r[1], b.r[2]);
      bar.castShadow = true;
      this.chassisMesh.add(bar);
    });

    // 5. ROOF AUXILIARY LIGHT BAR (4 glowing amber lights)
    const roofRackGeo = new THREE.BoxGeometry(1.2, 0.08, 0.15);
    const roofRack = new THREE.Mesh(roofRackGeo, matteDarkMat);
    roofRack.position.set(0, 1.44, 0.35);
    this.chassisMesh.add(roofRack);

    for (let i = 0; i < 4; i++) {
      const lightMesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.09, 0.06), roofLightMat);
      const lx = -0.42 + i * 0.28;
      lightMesh.position.set(lx, 1.44, 0.43);
      this.chassisMesh.add(lightMesh);
      this.roofLights.push(lightMesh);
    }

    // 6. FRONT HEADLIGHTS LED BAR
    const lightBarGeo = new THREE.BoxGeometry(1.25, 0.1, 0.08);
    const lightBar = new THREE.Mesh(lightBarGeo, headlightMat);
    lightBar.position.set(0, 0.64, 1.62);
    this.chassisMesh.add(lightBar);
    this.headlights.push(lightBar);

    // Projecting forward SpotLights for realistic ground illumination (gentle, muted)
    [-0.45, 0.45].forEach((hx) => {
      const spot = new THREE.SpotLight(0xf2c46d, 1.6, 10, Math.PI / 5, 0.45, 1.8);
      spot.position.set(hx, 0.64, 1.62);
      const targetObj = new THREE.Object3D();
      targetObj.position.set(hx * 1.5, 0.0, 6.0);
      this.buggyGroup.add(targetObj);
      spot.target = targetObj;
      spot.castShadow = true;
      spot.shadow.mapSize.width = 512;
      spot.shadow.mapSize.height = 512;
      this.chassisMesh.add(spot);
      this.headlightSpotlights.push(spot);
    });

    // 7. REAR TAIL LIGHTS & EXHAUST PIPES
    const tailBarGeo = new THREE.BoxGeometry(1.3, 0.08, 0.06);
    const tailBar = new THREE.Mesh(tailBarGeo, taillightMat);
    tailBar.position.set(0, 0.68, -1.62);
    this.chassisMesh.add(tailBar);

    // Twin exhausts
    [-0.35, 0.35].forEach((ex) => {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.28, 12), gunmetalMat);
      pipe.rotation.x = Math.PI / 2;
      pipe.position.set(ex, 0.42, -1.68);
      this.chassisMesh.add(pipe);
      this.exhaustMeshes.push(pipe);
    });

    // Rear spoiler wing
    const wingGeo = new THREE.BoxGeometry(1.55, 0.06, 0.35);
    const wing = new THREE.Mesh(wingGeo, this.bodyMaterial);
    wing.position.set(0, 1.18, -1.55);
    wing.rotation.x = -0.15;
    wing.castShadow = true;
    this.chassisMesh.add(wing);

    [-0.55, 0.55].forEach((wx) => {
      const support = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.4, 0.1), gunmetalMat);
      support.position.set(wx, 0.98, -1.55);
      this.chassisMesh.add(support);
    });

    // 8. OFF-ROAD MASSIVE WHEELS & SUSPENSION
    const wheelPositions = [
      { x: -0.92, y: 0.48, z: 1.1 },   // Front Left
      { x: 0.92, y: 0.48, z: 1.1 },    // Front Right
      { x: -0.92, y: 0.48, z: -1.0 },  // Rear Left
      { x: 0.92, y: 0.48, z: -1.0 }   // Rear Right
    ];

    wheelPositions.forEach((wp) => {
      const wheelAssembly = new THREE.Group();
      wheelAssembly.position.set(wp.x, wp.y, wp.z);

      // Heavy suspension coilover
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.45, 8), gunmetalMat);
      strut.position.set(wp.x > 0 ? -0.15 : 0.15, 0.15, 0);
      strut.rotation.z = wp.x > 0 ? -0.2 : 0.2;
      this.buggyGroup.add(strut);

      // Tire cylinder
      const tireRadius = 0.46;
      const tireWidth = 0.36;
      const tireGeo = new THREE.CylinderGeometry(tireRadius, tireRadius, tireWidth, 24);
      tireGeo.rotateZ(Math.PI / 2);
      const tire = new THREE.Mesh(tireGeo, tireMat);
      tire.castShadow = true;
      wheelAssembly.add(tire);

      // Deep treads (procedural lugs around perimeter)
      for (let t = 0; t < 16; t++) {
        const angle = (t / 16) * Math.PI * 2;
        const lug = new THREE.Mesh(new THREE.BoxGeometry(tireWidth * 0.85, 0.05, 0.1), tireMat);
        lug.position.set(
          0,
          Math.sin(angle) * (tireRadius + 0.02),
          Math.cos(angle) * (tireRadius + 0.02)
        );
        lug.rotation.x = angle;
        wheelAssembly.add(lug);
      }

      // Dark alloy rim
      const rimGeo = new THREE.CylinderGeometry(0.28, 0.28, tireWidth + 0.02, 16);
      rimGeo.rotateZ(Math.PI / 2);
      const rim = new THREE.Mesh(rimGeo, rimMat);
      wheelAssembly.add(rim);

      // Neon center hub accent ring
      const hubRingMat = new THREE.MeshBasicMaterial({ color: this.primaryColor });
      const hubRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.12, 0.025, 8, 16),
        hubRingMat
      );
      hubRing.rotation.y = Math.PI / 2;
      hubRing.position.x = wp.x > 0 ? tireWidth / 2 + 0.02 : -tireWidth / 2 - 0.02;
      wheelAssembly.add(hubRing);
      this.hubRings.push(hubRingMat);

      this.buggyGroup.add(wheelAssembly);
      this.wheels.push(wheelAssembly);
    });

    // 9. NEON UNDERGLOW LIGHT (Default Cyber Cyan under car)
    this.underglowLight = new THREE.PointLight(0x00d2d3, 1.1, 3.5, 1.8);
    this.underglowLight.position.set(0, 0.2, 0);
    this.buggyGroup.add(this.underglowLight);

    this.scene.add(this.buggyGroup);
    this.currentVehicle = this.buggyGroup;
  }

  setPaintColor(hexColor) {
    this.primaryColor = hexColor;
    if (this.bodyMaterial) {
      this.bodyMaterial.color.setHex(hexColor);
    }
    if (this.cageMat) {
      this.cageMat.color.setHex(hexColor);
    }
    if (this.underglowLight) {
      this.underglowLight.color.setHex(hexColor);
    }
    this.hubRings.forEach((mat) => {
      mat.color.setHex(hexColor);
    });
  }

  toggleLights(mode) {
    // mode: 'all' | 'dim' | 'off'
    if (mode === 'off') {
      this.headlightSpotlights.forEach((s) => (s.intensity = 0));
      this.underglowLight.intensity = 0;
      this.roofLights.forEach((l) => (l.material.color.setHex(0x181005)));
    } else if (mode === 'dim') {
      this.headlightSpotlights.forEach((s) => (s.intensity = 0.7));
      this.underglowLight.intensity = 0.4;
      this.roofLights.forEach((l) => (l.material.color.setHex(0x8a4503)));
    } else {
      // Full bright (gentle and balanced, not pricking eyes)
      this.headlightSpotlights.forEach((s) => (s.intensity = 1.6));
      this.underglowLight.intensity = 0.9;
      this.roofLights.forEach((l) => (l.material.color.setHex(0xd97706)));
    }
  }

  triggerRevBounce() {
    this.suspensionVel = 0.09;
  }

  update(time, delta, isDriving = false) {
    // Spring physics for suspension bounce
    if (this.chassisMesh) {
      const springK = 60.0;
      const damping = 7.5;
      const force = -springK * this.suspensionY - damping * this.suspensionVel;
      this.suspensionVel += force * delta;
      this.suspensionY += this.suspensionVel * delta;

      // Micro engine vibration
      const engineVibration = Math.sin(time * 38.0) * 0.003;
      this.chassisMesh.position.y = this.suspensionY + engineVibration;
      this.chassisMesh.rotation.x = Math.sin(time * 24.0) * 0.002 - this.suspensionVel * 0.2;
    }

    // Spin wheels if driving or subtle idle creep
    if (isDriving) {
      this.wheels.forEach((w) => {
        w.children.forEach((c) => {
          c.rotation.x += delta * 12.0;
        });
      });
    }
  }
}
