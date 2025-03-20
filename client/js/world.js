// Classe para gerenciar o mundo do jogo
class GameWorld {
  constructor() {
    this.colliders = []; // Lista de colliders no mundo
    this.objects = [];   // Lista de objetos no mundo
  }
  
  // Inicializa o mundo do jogo
  init() {
    // Adiciona iluminação
    this.addLights();
    
    // Cria o mapa (uma versão simplificada de Lorencia)
    this.createMap();
    
    // Registra os colliders de todos os objetos do mundo
    this.registerWorldColliders();
  }
  
  // Adiciona luzes à cena
  addLights() {
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
  createMap() {
    // Cria o chão
    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x7cac55 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    
    // Adiciona algumas construções simples (como referência para Lorencia)
    
    // Fonte central (símbolo de Lorencia)
    this.createFountain(0, 0, 0);
    
    // Algumas casas em volta
    this.createBuilding(-15, 0, -15, 5, 4, 5);
    this.createBuilding(15, 0, -15, 7, 5, 4);
    this.createBuilding(-15, 0, 15, 6, 4, 6);
    this.createBuilding(15, 0, 15, 5, 3, 5);
    
    // Algumas árvores para decoração
    this.createTree(-8, 0, -8);
    this.createTree(8, 0, -8);
    this.createTree(-8, 0, 8);
    this.createTree(8, 0, 8);
    
    // Adiciona uma muralha simples em volta
    this.createWall();
  }
  
  // Cria uma fonte no centro da cidade
  createFountain(x, y, z) {
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
    this.objects.push(fountainGroup);
  }
  
  // Cria uma construção simples
  createBuilding(x, y, z, width, height, depth) {
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
    this.objects.push(buildingGroup);
  }
  
  // Cria uma árvore simples
  createTree(x, y, z) {
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
    this.objects.push(treeGroup);
  }
  
  // Cria uma muralha simples em volta da cidade
  createWall() {
    const wallMaterial = new THREE.MeshLambertMaterial({ color: 0x777777 });
    const wallHeight = 3;
    const wallThickness = 1;
    
    // Define as coordenadas das paredes
    const walls = [
      // [x, z, width, depth] para cada parede
      [0, -50, 100, wallThickness],  // Norte
      [0, 50, 100, wallThickness],   // Sul
      [-50, 0, wallThickness, 100],  // Oeste
      [50, 0, wallThickness, 100]    // Leste
    ];
    
    // Cria cada parede
    for (let i = 0; i < walls.length; i++) {
      const [x, z, width, depth] = walls[i];
      
      // Cria a geometria e mesh
      const wallGeometry = new THREE.BoxGeometry(width, wallHeight, depth);
      const wall = new THREE.Mesh(wallGeometry, wallMaterial);
      wall.position.set(x, wallHeight/2, z);
      wall.castShadow = true;
      wall.receiveShadow = true;
      scene.add(wall);
      this.objects.push(wall);
    }
  }
  
  // Registrar collidables do mundo - CORRIGIDO, removida chamada recursiva
  registerWorldColliders() {
    console.log("Registrando colliders do mundo");
    
    // Fonte central
    this.registerStaticCollider({
      id: 'fountain',
      type: 'cylinder',
      x: 0, y: 0, z: 0,
      radius: 2.8,
      height: 3
    });
    
    // Construções
    this.registerStaticCollider({
      id: 'building1',
      type: 'box',
      x: -15, y: 0, z: -15,
      width: 5 * 0.95, // Reduzir levemente para evitar problemas de precisão
      height: 4,
      depth: 5 * 0.95
    });
    
    this.registerStaticCollider({
      id: 'building2',
      type: 'box',
      x: 15, y: 0, z: -15,
      width: 7 * 0.95,
      height: 5,
      depth: 4 * 0.95
    });
    
    this.registerStaticCollider({
      id: 'building3',
      type: 'box',
      x: -15, y: 0, z: 15,
      width: 6 * 0.95,
      height: 4,
      depth: 6 * 0.95
    });
    
    this.registerStaticCollider({
      id: 'building4',
      type: 'box',
      x: 15, y: 0, z: 15,
      width: 5 * 0.95,
      height: 3,
      depth: 5 * 0.95
    });
    
    // Árvores (apenas o tronco para colisão)
    this.registerStaticCollider({
      id: 'tree1',
      type: 'cylinder',
      x: -8, y: 0, z: -8,
      radius: 0.5,
      height: 2
    });
    
    this.registerStaticCollider({
      id: 'tree2',
      type: 'cylinder',
      x: 8, y: 0, z: -8,
      radius: 0.5,
      height: 2
    });
    
    this.registerStaticCollider({
      id: 'tree3',
      type: 'cylinder',
      x: -8, y: 0, z: 8,
      radius: 0.5,
      height: 2
    });
    
    this.registerStaticCollider({
      id: 'tree4',
      type: 'cylinder',
      x: 8, y: 0, z: 8,
      radius: 0.5,
      height: 2
    });
    
    // Muralhas
    this.registerStaticCollider({
      id: 'wall_north',
      type: 'box',
      x: 0, y: 0, z: -50,
      width: 100 * 0.98,
      height: 3,
      depth: 1 * 0.98
    });
    
    this.registerStaticCollider({
      id: 'wall_south',
      type: 'box',
      x: 0, y: 0, z: 50,
      width: 100 * 0.98,
      height: 3,
      depth: 1 * 0.98
    });
    
    this.registerStaticCollider({
      id: 'wall_west',
      type: 'box',
      x: -50, y: 0, z: 0,
      width: 1 * 0.98,
      height: 3,
      depth: 100 * 0.98
    });
    
    this.registerStaticCollider({
      id: 'wall_east',
      type: 'box',
      x: 50, y: 0, z: 0,
      width: 1 * 0.98,
      height: 3,
      depth: 100 * 0.98
    });
    
    console.log("Colliders de mundo registrados com sucesso");
  }

  // Método auxiliar para registrar collidables estáticos
  registerStaticCollider(object) {
    if (!window.CollisionSystem) {
      console.error("Sistema de colisão não disponível ao registrar collider estático");
      return null;
    }
    return window.CollisionSystem.createStaticCollidable(object);
  }
  
  // Retorna a lista de colliders
  getColliders() {
    // Usar o novo sistema
    if (window.CollisionSystem && window.CollisionSystem.collisionManager) {
      return window.CollisionSystem.collisionManager.getActiveColliderBoxes();
    }
    return [];
  }
}

// Variável para o mundo
let gameWorld;

// Inicializa o mundo do jogo
function initWorld() {
  gameWorld = new GameWorld();
  gameWorld.init();
}

// Retorna a lista de colliders do mundo
function getWorldColliders() {
  return gameWorld ? gameWorld.getColliders() : [];
}