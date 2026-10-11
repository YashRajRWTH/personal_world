import * as THREE from 'three';
import {
  createPaverTexture,
  createInfiniteGridMaterial,
  createNeonRingMaterial,
  createBlossomMaterial
} from './materials.js';

export class WorldEnvironment {
  constructor(scene) {
    this.scene = scene;
    this.animatedMaterials = [];
    this.petals = null;
    this.fireflies = null;
    this.lampPointLight = null;
    this.lampSpotLight = null;
    this.neonRingMesh = null;
    this.neonRingLight = null;
    this.gridMaterial = null;

    this.init();
  }

  init() {
    this.createDioramaIsland();
    this.createStreetLamp();
    this.createParkBench();
    this.createCherryBlossomTrees();
    this.createGrassAndRocks();
    this.createInfiniteGridFloor();
    this.createParticleSystems();
  }

  createDioramaIsland() {
    const islandGroup = new THREE.Group();
    const radius = 4.8;
    const height = 0.55;

    // Cylinder base
    const cylinderGeo = new THREE.CylinderGeometry(radius, radius + 0.15, height, 64);
    const paverTex = createPaverTexture();

    const topMat = new THREE.MeshStandardMaterial({
      map: paverTex,
      roughness: 0.65,
      metalness: 0.15
    });

    const sideMat = new THREE.MeshStandardMaterial({
      color: 0x140e1f,
      roughness: 0.8,
      metalness: 0.2
    });

    // Mesh with materials: [side, top, bottom]
    const pedestal = new THREE.Mesh(cylinderGeo, [sideMat, topMat, sideMat]);
    pedestal.position.y = height / 2;
    pedestal.receiveShadow = true;
    islandGroup.add(pedestal);

    // Glowing Neon Rim Ring (Default Cyber Cyan glow)
    const ringRadius = radius + 0.04;
    const ringTube = 0.07;
    const ringGeo = new THREE.TorusGeometry(ringRadius, ringTube, 24, 96);
    this.neonRingMat = createNeonRingMaterial(0x00d2d3, 1.8);
    this.neonRingMesh = new THREE.Mesh(ringGeo, this.neonRingMat);
    this.neonRingMesh.rotation.x = Math.PI / 2;
    this.neonRingMesh.position.y = height + 0.02;
    islandGroup.add(this.neonRingMesh);

    // Outer subtle underglow ring (cyan glow)
    const underRingGeo = new THREE.RingGeometry(radius - 0.2, radius + 0.8, 64);
    const underRingMat = new THREE.MeshBasicMaterial({
      color: 0x00838f,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide
    });
    const underRing = new THREE.Mesh(underRingGeo, underRingMat);
    underRing.rotation.x = Math.PI / 2;
    underRing.position.y = height - 0.02;
    islandGroup.add(underRing);

    this.scene.add(islandGroup);
  }

  createStreetLamp() {
    const lampGroup = new THREE.Group();
    lampGroup.position.set(-2.4, 0.55, 1.1); // Left-front of the car

    const darkIronMat = new THREE.MeshStandardMaterial({
      color: 0x22242b,
      metalness: 0.85,
      roughness: 0.35
    });

    const brassAccentMat = new THREE.MeshStandardMaterial({
      color: 0x8a6232,
      metalness: 0.9,
      roughness: 0.3
    });

    // 1. Plinth / Base (Tiered hexagonal base)
    const baseGeo1 = new THREE.CylinderGeometry(0.36, 0.46, 0.25, 6);
    const base1 = new THREE.Mesh(baseGeo1, darkIronMat);
    base1.position.y = 0.125;
    base1.castShadow = true;
    base1.receiveShadow = true;
    lampGroup.add(base1);

    const baseGeo2 = new THREE.CylinderGeometry(0.24, 0.36, 0.5, 6);
    const base2 = new THREE.Mesh(baseGeo2, darkIronMat);
    base2.position.y = 0.5;
    base2.castShadow = true;
    lampGroup.add(base2);

    // Accent ring
    const ringGeo = new THREE.TorusGeometry(0.24, 0.035, 12, 24);
    const accentRing = new THREE.Mesh(ringGeo, brassAccentMat);
    accentRing.rotation.x = Math.PI / 2;
    accentRing.position.y = 0.75;
    lampGroup.add(accentRing);

    // 2. Slender fluted pole
    const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 2.3, 16);
    const pole = new THREE.Mesh(poleGeo, darkIronMat);
    pole.position.y = 1.9;
    pole.castShadow = true;
    lampGroup.add(pole);

    // Mid collar ring
    const midCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.12, 12), brassAccentMat);
    midCollar.position.y = 1.6;
    lampGroup.add(midCollar);

    // 3. Lantern lower support / cradle
    const neckGeo = new THREE.CylinderGeometry(0.26, 0.12, 0.35, 6);
    const neck = new THREE.Mesh(neckGeo, darkIronMat);
    neck.position.y = 3.2;
    neck.castShadow = true;
    lampGroup.add(neck);

    // 4. Vintage 4-sided/hexagonal glass lantern housing
    // Bottom lantern rim
    const lanternBottom = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.24, 0.1, 6), darkIronMat);
    lanternBottom.position.y = 3.42;
    lampGroup.add(lanternBottom);

    // Glass cage (visibly illuminated warm lantern housing)
    const glassGeo = new THREE.CylinderGeometry(0.42, 0.3, 0.8, 6);
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xffe29e,
      emissive: 0xffaa44,
      emissiveIntensity: 0.85,
      transmission: 0.65,
      opacity: 0.88,
      transparent: true,
      roughness: 0.18,
      metalness: 0.1
    });
    const glassCage = new THREE.Mesh(glassGeo, glassMat);
    glassCage.position.y = 3.85;
    lampGroup.add(glassCage);

    // Corner iron strut bars around glass
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const barGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.82, 8);
      const bar = new THREE.Mesh(barGeo, darkIronMat);
      const r = 0.36;
      bar.position.set(Math.cos(angle) * r, 3.85, Math.sin(angle) * r);
      lampGroup.add(bar);
    }

    // Top lantern roof (pyramid cap)
    const capGeo = new THREE.ConeGeometry(0.48, 0.45, 6);
    const cap = new THREE.Mesh(capGeo, darkIronMat);
    cap.position.y = 4.45;
    cap.castShadow = true;
    lampGroup.add(cap);

    // Finial ball on top
    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), brassAccentMat);
    finial.position.y = 4.75;
    lampGroup.add(finial);

    // Glowing interior filament / vintage bulb (visibly ON)
    const bulbGeo = new THREE.SphereGeometry(0.14, 16, 16);
    const bulbMat = new THREE.MeshBasicMaterial({
      color: 0xfff0b8
    });
    const bulb = new THREE.Mesh(bulbGeo, bulbMat);
    bulb.position.y = 3.85;
    lampGroup.add(bulb);

    // POINT LIGHT inside lantern (warm golden amber ambient glow)
    this.lampPointLight = new THREE.PointLight(0xffb04a, 2.4, 15, 1.8);
    this.lampPointLight.position.set(0, 3.85, 0);
    this.lampPointLight.castShadow = true;
    this.lampPointLight.shadow.mapSize.width = 1024;
    this.lampPointLight.shadow.mapSize.height = 1024;
    this.lampPointLight.shadow.bias = -0.002;
    this.lampPointLight.shadow.radius = 2.2;
    lampGroup.add(this.lampPointLight);

    // Directional soft spotlight aimed directly at the car for soft, realistic illumination
    this.lampSpotLight = new THREE.SpotLight(0xffbb52, 2.5, 16, Math.PI / 4.0, 0.85, 1.6);
    this.lampSpotLight.position.set(0, 3.85, 0);
    // Relative position from lamp to center of car
    const carTarget = new THREE.Object3D();
    carTarget.position.set(2.5, -3.1, -1.0);
    lampGroup.add(carTarget);
    this.lampSpotLight.target = carTarget;
    this.lampSpotLight.castShadow = true;
    this.lampSpotLight.shadow.mapSize.width = 1024;
    this.lampSpotLight.shadow.mapSize.height = 1024;
    this.lampSpotLight.shadow.bias = -0.001;
    this.lampSpotLight.shadow.radius = 2.5;
    lampGroup.add(this.lampSpotLight);

    this.scene.add(lampGroup);
  }

  createParkBench() {
    const benchGroup = new THREE.Group();
    // Positioned behind the car with ample clearance
    benchGroup.position.set(0.15, 0.55, -2.45);
    benchGroup.rotation.y = 0.15; // slightly angled

    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x9e5b38,
      roughness: 0.45,
      metalness: 0.1
    });

    const ironMat = new THREE.MeshStandardMaterial({
      color: 0x1f2126,
      roughness: 0.4,
      metalness: 0.9
    });

    const benchWidth = 2.4;
    const slatDepth = 0.14;
    const slatThick = 0.04;

    // Seat slats (3 wooden slats)
    for (let i = 0; i < 3; i++) {
      const seatSlat = new THREE.Mesh(
        new THREE.BoxGeometry(benchWidth, slatThick, slatDepth),
        woodMat
      );
      seatSlat.position.set(0, 0.55, i * 0.16);
      seatSlat.castShadow = true;
      seatSlat.receiveShadow = true;
      benchGroup.add(seatSlat);
    }

    // Backrest slats (4 wooden slats)
    for (let i = 0; i < 4; i++) {
      const backSlat = new THREE.Mesh(
        new THREE.BoxGeometry(benchWidth, slatDepth, slatThick),
        woodMat
      );
      backSlat.position.set(0, 0.78 + i * 0.17, -0.04 - i * 0.03);
      backSlat.rotation.x = -0.15; // comfortable tilt
      backSlat.castShadow = true;
      backSlat.receiveShadow = true;
      benchGroup.add(backSlat);
    }

    // Cast iron frame (left & right side supports)
    [-benchWidth / 2 + 0.1, benchWidth / 2 - 0.1].forEach((xPos) => {
      const legFrame = new THREE.Group();
      legFrame.position.x = xPos;

      // Front leg
      const frontLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.55, 8), ironMat);
      frontLeg.position.set(0, 0.275, 0.32);
      frontLeg.castShadow = true;
      legFrame.add(frontLeg);

      // Back leg & backrest spine
      const backLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.4, 8), ironMat);
      backLeg.position.set(0, 0.7, -0.06);
      backLeg.rotation.x = -0.15;
      backLeg.castShadow = true;
      legFrame.add(backLeg);

      // Curved armrest
      const armrest = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.5), ironMat);
      armrest.position.set(0, 0.8, 0.14);
      legFrame.add(armrest);

      // Bottom connector brace
      const brace = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.45, 8), ironMat);
      brace.rotation.x = Math.PI / 2;
      brace.position.set(0, 0.15, 0.14);
      legFrame.add(brace);

      benchGroup.add(legFrame);
    });

    this.scene.add(benchGroup);
  }

  createCherryBlossomTrees() {
    const treeConfigs = [
      { x: -1.4, z: -2.85, scale: 1.15, rotY: 0.3 },
      { x: 1.1, z: -3.05, scale: 0.95, rotY: -0.6 }
    ];

    treeConfigs.forEach((cfg) => {
      const treeGroup = new THREE.Group();
      treeGroup.position.set(cfg.x, 0.55, cfg.z);
      treeGroup.rotation.y = cfg.rotY;
      treeGroup.scale.setScalar(cfg.scale);

      const barkMat = new THREE.MeshStandardMaterial({
        color: 0x3d2a23,
        roughness: 0.85,
        metalness: 0.1
      });

      // Gnarled organic trunk
      const trunkGeo = new THREE.CylinderGeometry(0.18, 0.32, 2.2, 10);
      const trunk = new THREE.Mesh(trunkGeo, barkMat);
      trunk.position.y = 1.1;
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      treeGroup.add(trunk);

      // Primary branches arching towards bench & car
      const branchData = [
        { x: 0.3, y: 2.1, z: 0.2, rotX: 0.3, rotZ: -0.6, len: 1.8, thick: 0.14 },
        { x: -0.4, y: 2.2, z: -0.1, rotX: -0.2, rotZ: 0.7, len: 1.6, thick: 0.12 },
        { x: 0.1, y: 2.4, z: 0.4, rotX: 0.6, rotZ: -0.2, len: 1.9, thick: 0.13 },
        { x: -0.2, y: 2.6, z: -0.3, rotX: -0.5, rotZ: 0.4, len: 1.5, thick: 0.11 }
      ];

      branchData.forEach((b) => {
        const branchMesh = new THREE.Mesh(
          new THREE.CylinderGeometry(b.thick * 0.6, b.thick, b.len, 8),
          barkMat
        );
        branchMesh.position.set(b.x, b.y, b.z);
        branchMesh.rotation.set(b.rotX, 0, b.rotZ);
        branchMesh.castShadow = true;
        treeGroup.add(branchMesh);
      });

      // Volumetric Blossom Foliage (Lush Sakura Blossom Canopy)
      const blossomMat = createBlossomMaterial(0xff4a7b, 0xffa3ba);
      this.animatedMaterials.push(blossomMat);

      // Multiple overlapping clusters of foliage clouds
      const foliageClusters = [
        { pos: [0.6, 3.4, 0.4], size: 1.4 },
        { pos: [-0.6, 3.3, 0.1], size: 1.3 },
        { pos: [0.1, 3.9, 0.6], size: 1.5 },
        { pos: [-0.3, 3.8, -0.4], size: 1.35 },
        { pos: [0.8, 3.1, -0.3], size: 1.15 },
        { pos: [-0.9, 3.2, 0.5], size: 1.2 },
        { pos: [0.0, 4.4, 0.2], size: 1.45 },
        { pos: [0.4, 2.7, 0.8], size: 0.95 },
        { pos: [-0.5, 2.8, -0.7], size: 0.9 }
      ];

      foliageClusters.forEach((c) => {
        // Dodecahedron geometry with subdivided detail gives lovely stylized organic foliage
        const leafGeo = new THREE.DodecahedronGeometry(c.size * 0.85, 2);
        
        // Randomize vertex positions slightly for natural fluffy blossom volume
        const posAttr = leafGeo.attributes.position;
        for (let i = 0; i < posAttr.count; i++) {
          const vx = posAttr.getX(i);
          const vy = posAttr.getY(i);
          const vz = posAttr.getZ(i);
          const factor = 1.0 + (Math.sin(vx * 5.0) * Math.cos(vy * 5.0) * 0.18);
          posAttr.setXYZ(i, vx * factor, vy * factor, vz * factor);
        }
        leafGeo.computeVertexNormals();

        const foliageMesh = new THREE.Mesh(leafGeo, blossomMat);
        foliageMesh.position.set(c.pos[0], c.pos[1], c.pos[2]);
        foliageMesh.castShadow = true;
        foliageMesh.receiveShadow = true;
        treeGroup.add(foliageMesh);
      });

      this.scene.add(treeGroup);
    });
  }

  createGrassAndRocks() {
    const floraGroup = new THREE.Group();
    floraGroup.position.y = 0.55;

    // Grass blade material (vibrant olive to warm highlight)
    const grassMat = new THREE.MeshStandardMaterial({
      color: 0x3d7032,
      roughness: 0.7,
      metalness: 0.1,
      side: THREE.DoubleSide
    });

    // Create clusters of 3D grass tufts around the streetlamp and bench
    const clusterPositions = [
      // Around lamp post
      [-2.1, 0.9], [-2.3, 1.4], [-2.7, 1.0], [-2.5, 0.6], [-1.9, 0.7],
      // Under/around bench
      [-0.9, -2.35], [-0.5, -2.55], [0.2, -2.45], [0.8, -2.55], [1.3, -2.35],
      // Base of trees
      [-1.4, -2.8], [-1.1, -3.0], [0.9, -3.0], [1.2, -3.2]
    ];

    clusterPositions.forEach(([cx, cz]) => {
      const tuft = new THREE.Group();
      tuft.position.set(cx, 0, cz);

      const bladesCount = 7 + Math.floor(Math.random() * 6);
      for (let b = 0; b < bladesCount; b++) {
        const bladeH = 0.25 + Math.random() * 0.28;
        const bladeW = 0.035 + Math.random() * 0.02;
        const bladeGeo = new THREE.PlaneGeometry(bladeW, bladeH);
        bladeGeo.translate(0, bladeH / 2, 0);

        const blade = new THREE.Mesh(bladeGeo, grassMat);
        blade.rotation.y = Math.random() * Math.PI * 2;
        blade.rotation.x = (Math.random() - 0.5) * 0.45;
        blade.rotation.z = (Math.random() - 0.5) * 0.45;
        blade.castShadow = true;
        tuft.add(blade);
      }
      floraGroup.add(tuft);
    });

    // Scattered natural 3D rocks and pebbles
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x5a5666,
      roughness: 0.85,
      metalness: 0.15
    });

    const rockPositions = [
      { x: -1.8, z: 1.3, s: 0.28 },
      { x: -2.6, z: 0.7, s: 0.22 },
      { x: -2.1, z: 0.4, s: 0.16 },
      { x: 1.8, z: 0.8, s: 0.24 },
      { x: 2.2, z: -0.4, s: 0.18 },
      { x: -0.3, z: 1.9, s: 0.14 },
      { x: 0.7, z: 1.6, s: 0.2 }
    ];

    rockPositions.forEach((r) => {
      const rockGeo = new THREE.DodecahedronGeometry(r.s, 1);
      // Squash and deform for organic stone look
      const posAttr = rockGeo.attributes.position;
      for (let i = 0; i < posAttr.count; i++) {
        posAttr.setY(i, posAttr.getY(i) * 0.6);
      }
      rockGeo.computeVertexNormals();

      const rock = new THREE.Mesh(rockGeo, stoneMat);
      rock.position.set(r.x, r.s * 0.4, r.z);
      rock.rotation.set(Math.random(), Math.random(), Math.random());
      rock.castShadow = true;
      rock.receiveShadow = true;
      floraGroup.add(rock);
    });

    this.scene.add(floraGroup);
  }

  createInfiniteGridFloor() {
    // Vast ground plane
    const planeGeo = new THREE.PlaneGeometry(200, 200, 1, 1);
    this.gridMaterial = createInfiniteGridMaterial();

    const floor = new THREE.Mesh(planeGeo, this.gridMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.0;
    this.scene.add(floor);
  }

  createParticleSystems() {
    // 1. Falling Sakura Blossom Petals
    const petalCount = 140;
    const petalGeo = new THREE.BufferGeometry();
    const petalPositions = new Float32Array(petalCount * 3);
    const petalVelocities = [];

    for (let i = 0; i < petalCount; i++) {
      // Spawn around the tree canopies
      petalPositions[i * 3 + 0] = (Math.random() - 0.5) * 7.0;
      petalPositions[i * 3 + 1] = 1.0 + Math.random() * 4.5;
      petalPositions[i * 3 + 2] = (Math.random() - 0.5) * 7.0;

      petalVelocities.push({
        vx: (Math.random() - 0.5) * 0.015 + 0.008,
        vy: -0.008 - Math.random() * 0.012,
        vz: (Math.random() - 0.5) * 0.012,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 2.0 + Math.random() * 2.5
      });
    }

    petalGeo.setAttribute('position', new THREE.BufferAttribute(petalPositions, 3));

    // Petal particle texture
    const petalCanvas = document.createElement('canvas');
    petalCanvas.width = 64;
    petalCanvas.height = 64;
    const pctx = petalCanvas.getContext('2d');
    pctx.fillStyle = '#ff7597';
    pctx.beginPath();
    pctx.ellipse(32, 32, 26, 15, Math.PI / 4, 0, Math.PI * 2);
    pctx.fill();
    pctx.fillStyle = '#ffaec1';
    pctx.beginPath();
    pctx.ellipse(30, 30, 18, 9, Math.PI / 4, 0, Math.PI * 2);
    pctx.fill();

    const petalTex = new THREE.CanvasTexture(petalCanvas);
    const petalMat = new THREE.PointsMaterial({
      color: 0xffa3bb,
      size: 0.18,
      map: petalTex,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.petals = new THREE.Points(petalGeo, petalMat);
    this.petals.userData.velocities = petalVelocities;
    this.scene.add(this.petals);

    // 2. Floating Fireflies / Warm Embers around the Street Lamp
    const fireflyCount = 45;
    const fireflyGeo = new THREE.BufferGeometry();
    const fireflyPos = new Float32Array(fireflyCount * 3);
    const fireflyVel = [];

    for (let i = 0; i < fireflyCount; i++) {
      fireflyPos[i * 3 + 0] = -2.4 + (Math.random() - 0.5) * 3.5;
      fireflyPos[i * 3 + 1] = 1.0 + Math.random() * 3.5;
      fireflyPos[i * 3 + 2] = 1.1 + (Math.random() - 0.5) * 3.5;

      fireflyVel.push({
        baseX: fireflyPos[i * 3 + 0],
        baseY: fireflyPos[i * 3 + 1],
        baseZ: fireflyPos[i * 3 + 2],
        phase: Math.random() * Math.PI * 2,
        speed: 1.0 + Math.random() * 1.5
      });
    }

    fireflyGeo.setAttribute('position', new THREE.BufferAttribute(fireflyPos, 3));

    const fireflyMat = new THREE.PointsMaterial({
      color: 0xffba42,
      size: 0.12,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.fireflies = new THREE.Points(fireflyGeo, fireflyMat);
    this.fireflies.userData.vel = fireflyVel;
    this.scene.add(this.fireflies);
  }

  update(time, delta) {
    // 1. Update animated blossom foliage shader
    this.animatedMaterials.forEach((mat) => {
      if (mat.userData.shader) {
        mat.userData.shader.uniforms.uTime.value = time;
      }
    });

    // 2. Update infinite grid time uniform
    if (this.gridMaterial) {
      this.gridMaterial.uniforms.uTime.value = time;
    }

    // 3. Update Sakura Petals
    if (this.petals) {
      const posAttr = this.petals.geometry.attributes.position;
      const vels = this.petals.userData.velocities;
      for (let i = 0; i < vels.length; i++) {
        const v = vels[i];
        v.wobble += v.wobbleSpeed * delta;

        let px = posAttr.getX(i) + v.vx + Math.sin(v.wobble) * 0.006;
        let py = posAttr.getY(i) + v.vy;
        let pz = posAttr.getZ(i) + v.vz + Math.cos(v.wobble) * 0.006;

        // Reset if hit ground or out of radius
        if (py < 0.6) {
          py = 4.2 + Math.random() * 0.8;
          px = (Math.random() - 0.5) * 6.0;
          pz = (Math.random() - 0.5) * 6.0;
        }

        posAttr.setXYZ(i, px, py, pz);
      }
      posAttr.needsUpdate = true;
    }

    // 4. Update Fireflies around lantern
    if (this.fireflies) {
      const posAttr = this.fireflies.geometry.attributes.position;
      const vels = this.fireflies.userData.vel;
      for (let i = 0; i < vels.length; i++) {
        const v = vels[i];
        const t = time * v.speed + v.phase;
        const x = v.baseX + Math.sin(t) * 0.6;
        const y = v.baseY + Math.cos(t * 1.3) * 0.4;
        const z = v.baseZ + Math.sin(t * 0.8) * 0.6;
        posAttr.setXYZ(i, x, y, z);
      }
      posAttr.needsUpdate = true;
    }

    // 5. Lamp light subtle natural flicker
    if (this.lampPointLight) {
      const flicker = 1.0 + Math.sin(time * 12.0) * 0.02 + Math.cos(time * 35.0) * 0.015;
      this.lampPointLight.intensity = 3.8 * flicker;
    }
  }

  setNeonColor(colorHex) {
    if (this.neonRingMat) {
      this.neonRingMat.color.setHex(colorHex);
      this.neonRingMat.emissive.setHex(colorHex);
    }
  }
}
