// Variáveis do jogo
let scene, camera, renderer;
let localPlayer, players = {};
let gameStarted = false;

// Inicializa o jogo
function init() {
  // Inicializa o Three.js
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87CEEB); // Céu azul claro
  
  // Configuração da câmera
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 5, 10);
  camera.lookAt(0, 0, 0);
  
  // Configuração do renderizador
  renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game-canvas'), antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  
  // Inicializa o mundo
  initWorld();
  
  // Inicializa o sistema de entrada
  initInputSystem();
  
  // Inicializa a rede
  initNetworking(() => {
    // Callback após a conexão ser estabelecida
    hideLoadingScreen();
    gameStarted = true;
    animate();
  });
  
  // Event listener para redimensionamento da janela
  window.addEventListener('resize', onWindowResize);
}

// Esconde a tela de carregamento
function hideLoadingScreen() {
  const loadingScreen = document.getElementById('loading-screen');
  loadingScreen.style.display = 'none';
}

// Atualiza as dimensões do renderizador quando a janela é redimensionada
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// Loop de animação
function animate() {
  requestAnimationFrame(animate);
  
  if (gameStarted && localPlayer) {
    // Atualiza o jogador local
    updateLocalPlayer();
    
    // Atualiza a câmera para seguir o jogador
    updateCamera();
    
    // Renderiza a cena
    renderer.render(scene, camera);
    
    // Atualiza o UI
    updateUI();
  }
}

// Atualiza o jogador local com base nas entradas
function updateLocalPlayer() {
  const moveDirection = getMovementDirection();
  
  if (moveDirection.length() > 0) {
    // Normaliza e aplica a velocidade
    moveDirection.normalize();
    const SPEED = 0.15;
    
    // Move o jogador
    localPlayer.mesh.position.x += moveDirection.x * SPEED;
    localPlayer.mesh.position.z += moveDirection.z * SPEED;
    
    // Atualiza a rotação do jogador
    if (moveDirection.length() > 0) {
      const angle = Math.atan2(moveDirection.x, moveDirection.z);
      localPlayer.mesh.rotation.y = angle;
    }
    
    // Envia a atualização para o servidor
    sendPlayerMove({
      position: {
        x: localPlayer.mesh.position.x,
        y: localPlayer.mesh.position.y,
        z: localPlayer.mesh.position.z
      },
      rotation: {
        y: localPlayer.mesh.rotation.y
      }
    });
  }
  
  // Verifica ataques
  if (isAttacking()) {
    performAttack();
  }
}

// Atualiza a câmera para seguir o jogador
function updateCamera() {
  if (localPlayer) {
    const offset = new THREE.Vector3(0, 8, 10);
    camera.position.copy(localPlayer.mesh.position).add(offset);
    camera.lookAt(localPlayer.mesh.position);
  }
}

// Atualiza a interface do usuário
function updateUI() {
  if (localPlayer) {
    const healthFill = document.getElementById('health-fill');
    const healthPercent = (localPlayer.health / 100) * 100;
    healthFill.style.width = `${healthPercent}%`;
  }
}

// Inicializa o jogo quando a página carrega
window.onload = init;
