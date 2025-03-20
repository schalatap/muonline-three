// Variáveis do sistema de chat
let chatVisible = true;
const MAX_MESSAGES = 50;
const CHAT_RANGE = 15; // Distância máxima para receber mensagens (em unidades do jogo)

// Inicializa o sistema de chat
function initChatSystem() {
  const chatInput = document.getElementById('chat-input');
  
  // Event listener para envio de mensagens
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const message = chatInput.value.trim();
      
      if (message) {
        // Envia a mensagem para o servidor
        sendChatMessage(message);
        chatInput.value = '';
      }
      
      // Evita que o Enter faça outras ações
      e.preventDefault();
    }
    
    // Toggle de visibilidade com a tecla Tab
    if (e.key === 'Tab') {
      toggleChatVisibility();
      e.preventDefault();
    }
  });
  
  // Evento de toggle de chat com a tecla Enter
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && document.activeElement !== chatInput) {
      chatInput.focus();
      e.preventDefault();
    }
    
    if (e.key === 'Escape') {
      chatInput.blur();
      e.preventDefault();
    }
  });
  
  // Inicializa a interface
  updateChatVisibility();
}

// Adiciona uma mensagem ao contêiner de chat
function addChatMessage(data) {
  const chatMessages = document.getElementById('chat-messages');
  const messageElement = document.createElement('div');
  messageElement.className = 'chat-message';
  
  if (data.system) {
    // Mensagem do sistema
    messageElement.classList.add('chat-system-message');
    messageElement.textContent = data.message;
  } else {
    // Mensagem de jogador
    const playerName = document.createElement('span');
    playerName.className = 'chat-player-name';
    
    // Se for o jogador local, destaca o nome
    if (data.senderId === playerId) {
      playerName.textContent = 'Você';
    } else {
      playerName.textContent = data.senderName || `Jogador ${data.senderId.slice(0, 4)}`;
    }
    
    messageElement.appendChild(playerName);
    messageElement.appendChild(document.createTextNode(`: ${data.message}`));
  }
  
  chatMessages.appendChild(messageElement);
  
  // Mantém o scroll no fim da lista
  chatMessages.scrollTop = chatMessages.scrollHeight;
  
  // Limita o número de mensagens
  while (chatMessages.children.length > MAX_MESSAGES) {
    chatMessages.removeChild(chatMessages.firstChild);
  }
}

// Adiciona uma mensagem do sistema
function addSystemMessage(message) {
  addChatMessage({
    system: true,
    message: message
  });
}

// Toggle de visibilidade do chat
function toggleChatVisibility() {
  chatVisible = !chatVisible;
  updateChatVisibility();
}

// Atualiza a visibilidade do chat
function updateChatVisibility() {
  const chatContainer = document.getElementById('chat-container');
  if (chatVisible) {
    chatContainer.style.display = 'flex';
  } else {
    chatContainer.style.display = 'none';
  }
}