// Inicializa o mundo do jogo
function initWorld() {
  // Adiciona iluminação
  addLights();
  
  // Cria o mapa (uma versão simplificada de Lorencia)
  createMap();
}

// Adiciona luzes à cena
function addLights() {
  // Luz ambiente
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);
  
  // Luz direcional (simula o sol)
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(100, 100, 50);
  directionalLight.castShadow = true;
  
  // Configura as sombras
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = 500;
  directionalLight.shadow.camera.left = -100;
  directionalLight.shadow.camera.right = 100;
  directionalLight.shadow.camera.top = 100;
  directionalLight.shadow.camera.bottom = -100;
  
  scene.add(directionalLight);
}

// Cria o mapa do jogo (versão simplificada de Lorencia)
function createMap() {
  // Cria o chão
  const groundGeometry = new THREE.PlaneGeometry(100, 100);
  const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x7cac55 });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  
  // Adiciona algumas construções simples (como referência para Lorencia)
  
  // Fonte central (símbolo de Lorencia)
  createFountain(0, 0, 0);
  
  // Algumas casas em volta
  createBuilding(-15, 0, -15, 5, 4, 5);
  createBuilding(15, 0, -15, 7, 5, 4);
  createBuilding(-15, 0, 15, 6, 4, 6);
  createBuilding(15, 0, 15, 5, 3, 5);
  
  // Algumas árvores para decoração
  createTree(-8, 0, -8);
  createTree(8, 0, -8);
  createTree(-8, 0, 8);
  createTree(8, 0, 8);
  
  // Adiciona uma muralha simples em volta
  createWall();
}

// Cria uma fonte no centro da cidade
function createFountain(x, y, z) {
  const fountainGroup = new THREE.Group();
  
  // Base da fonte
  const baseGeometry = new THREE.CylinderGeometry(3, 3.5, 1, 8);
  const baseMaterial = new THREE.MeshLambertMaterial({ color: 0x888888 });
  const base = new THREE.Mesh(baseGeometry, baseMaterial);
  base.position.y = 0.5;
  fountainGroup.add(base);
  
  // Pilar central
  const pillarGeometry = new THREE.CylinderGeometry(0.5, 0.5, 2, 8);
  const pillarMaterial = new THREE.MeshLambertMaterial({ color: 0x777777 });
  const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
  pillar.position.y = 2;
  fountainGroup.add(pillar);
  
  // Topo da fonte
  const topGeometry = new THREE.SphereGeometry(1, 8, 8);
  const topMaterial = new THREE.MeshLambertMaterial({ color: 0x999999 });
  const top = new THREE.Mesh(topGeometry, topMaterial);
  top.position.y = 3.5;
  fountainGroup.add(top);
  
  // Água (anel)
  const waterGeometry = new THREE.TorusGeometry(2, 0.4, 8, 16);
  const waterMaterial = new THREE.MeshLambertMaterial({ color: 0x3498db });
  const water = new THREE.Mesh(waterGeometry, waterMaterial);
  water.position.y = 1.2;
  water.rotation.x = Math.PI / 2;
  fountainGroup.add(water);
  
  // Posiciona a fonte
  fountainGroup.position.set(x, y, z);
  
  // Adiciona sombras
  fountainGroup.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  
  scene.add(fountainGroup);
}

// Cria uma construção simples
function createBuilding(x, y, z, width, height, depth) {
  const buildingGroup = new THREE.Group();
  
  // Corpo principal da construção
  const buildingGeometry = new THREE.BoxGeometry(width, height, depth);
  const buildingMaterial = new THREE.MeshLambertMaterial({ color: 0xa67b5c });
  const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
  building.position.y = height / 2;
  buildingGroup.add(building);
  
  // Telhado
  const roofGeometry = new THREE.ConeGeometry(Math.max(width, depth) / Math.sqrt(2), height / 2, 4);
  const roofMaterial = new THREE.MeshLambertMaterial({ color: 0x8b4513 });
  const roof = new THREE.Mesh(roofGeometry, roofMaterial);
  roof.position.y = height + height / 4;
  roof.rotation.y = Math.PI / 4;
  buildingGroup.add(roof);
  
  // Porta
  const doorGeometry = new THREE.PlaneGeometry(width / 3, height / 2);
  const doorMaterial = new THREE.MeshLambertMaterial({ color: 0x4d3b28, side: THREE.DoubleSide });
  const door = new THREE.Mesh(doorGeometry, doorMaterial);
  door.position.z = depth / 2 + 0.01;
  door.position.y = height / 4;
  buildingGroup.add(door);
  
  // Posiciona a construção
  buildingGroup.position.set(x, y, z);
  
  // Adiciona sombras
  buildingGroup.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  
  scene.add(buildingGroup);
}

// Cria uma árvore simples
function createTree(x, y, z) {
  const treeGroup = new THREE.Group();
  
  // Tronco
  const trunkGeometry = new THREE.CylinderGeometry(0.4, 0.6, 2, 8);
  const trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x8b4513 });
  const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
  trunk.position.y = 1;
  treeGroup.add(trunk);
  
  // Folhagem (com formato cônico)
  const leavesGeometry = new THREE.ConeGeometry(2, 4, 8);
  const leavesMaterial = new THREE.MeshLambertMaterial({ color: 0x2ecc71 });
  const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
  leaves.position.y = 4;
  treeGroup.add(leaves);
  
  // Posiciona a árvore
  treeGroup.position.set(x, y, z);
  
  // Adiciona sombras
  treeGroup.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  
  scene.add(treeGroup);
}

// Cria uma muralha simples em volta da cidade
function createWall() {
  const wallMaterial = new THREE.MeshLambertMaterial({ color: 0x777777 });
  
  // Parede 1 (norte)
  const wall1Geometry = new THREE.BoxGeometry(100, 3, 1);
  const wall1 = new THREE.Mesh(wall1Geometry, wallMaterial);
  wall1.position.set(0, 1.5, -50);
  scene.add(wall1);
  
  // Parede 2 (sul)
  const wall2Geometry = new THREE.BoxGeometry(100, 3, 1);
  const wall2 = new THREE.Mesh(wall2Geometry, wallMaterial);
  wall2.position.set(0, 1.5, 50);
  scene.add(wall2);
  
  // Parede 3 (oeste)
  const wall3Geometry = new THREE.BoxGeometry(1, 3, 100);
  const wall3 = new THREE.Mesh(wall3Geometry, wallMaterial);
  wall3.position.set(-50, 1.5, 0);
  scene.add(wall3);
  
  // Parede 4 (leste)
  const wall4Geometry = new THREE.BoxGeometry(1, 3, 100);
  const wall4 = new THREE.Mesh(wall4Geometry, wallMaterial);
  wall4.position.set(50, 1.5, 0);
  scene.add(wall4);
  
  // Adiciona sombras
  wall1.castShadow = true;
  wall1.receiveShadow = true;
  wall2.castShadow = true;
  wall2.receiveShadow = true;
  wall3.castShadow = true;
  wall3.receiveShadow = true;
  wall4.castShadow = true;
  wall4.receiveShadow = true;
}
