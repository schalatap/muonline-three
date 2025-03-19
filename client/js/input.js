// Estado das teclas e do mouse
const keys = {
  w: false,
  a: false,
  s: false,
  d: false
};

let mouseButtonRight = false;
let mousePosition = { x: 0, y: 0 };

// Inicializa o sistema de entrada
function initInputSystem() {
  // Adiciona event listeners para teclado
  window.addEventListener('keydown', (e) => {
    setKey(e.key.toLowerCase(), true);
  });
  
  window.addEventListener('keyup', (e) => {
    setKey(e.key.toLowerCase(), false);
  });
  
  // Adiciona event listeners para mouse
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault(); // Impede o menu de contexto padrão
  });
  
  document.addEventListener('mousedown', (e) => {
    if (e.button === 2) { // Botão direito
      mouseButtonRight = true;
    }
  });
  
  document.addEventListener('mouseup', (e) => {
    if (e.button === 2) { // Botão direito
      mouseButtonRight = false;
    }
  });
  
  document.addEventListener('mousemove', (e) => {
    mousePosition.x = e.clientX;
    mousePosition.y = e.clientY;
  });
}

// Atualiza o estado da tecla
function setKey(key, pressed) {
  if (key in keys) {
    keys[key] = pressed;
  }
}

// Retorna a direção de movimento baseada no estado das teclas
function getMovementDirection() {
  const direction = new THREE.Vector3(0, 0, 0);
  
  if (keys.w) direction.z -= 1;
  if (keys.s) direction.z += 1;
  if (keys.a) direction.x -= 1;
  if (keys.d) direction.x += 1;
  
  return direction;
}

// Verifica se o jogador está atacando
function isAttacking() {
  return mouseButtonRight;
}

// Obtém a posição do mouse
function getMousePosition() {
  return { ...mousePosition };
}
