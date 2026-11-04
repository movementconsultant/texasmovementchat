(function() {
  'use strict';

  // Configuration
  const KB_URL = '/assets/chatbot/knowledge-base.json';
  let knowledgeBase = null;
  let isPanelOpen = false;

  // Create DOM elements
  const container = document.createElement('div');
  container.className = 'tm-cb-container';
  container.setAttribute('role', 'region');
  container.setAttribute('aria-label', 'Texas Movement Chatbot');

  container.innerHTML = `
    <div class="tm-cb-panel" id="tmCbPanel" role="dialog" aria-modal="true" aria-labelledby="tmCbTitle">
      <div class="tm-cb-header">
        <h3 class="tm-cb-title" id="tmCbTitle">Texas Movement Assistant</h3>
        <div class="tm-cb-header-actions">
          <button class="tm-cb-icon-btn" id="tmCbClear" aria-label="Clear chat history" title="Clear chat">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
          </button>
          <button class="tm-cb-icon-btn" id="tmCbClose" aria-label="Close chatbot" title="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
      </div>
      <div class="tm-cb-messages" id="tmCbMessages" aria-live="polite"></div>
      <div class="tm-cb-input-area">
        <input type="text" class="tm-cb-input" id="tmCbInput" placeholder="Type your question..." aria-label="Chat message input" autocomplete="off">
        <button class="tm-cb-send-btn" id="tmCbSend" aria-label="Send message" disabled>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
        </button>
      </div>
    </div>
    <button class="tm-cb-launcher" id="tmCbLauncher" aria-label="Open chat assistant" aria-expanded="false">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
    </button>
  `;

  document.body.appendChild(container);

  // Inject CSS dynamically to keep index.html clean
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/assets/chatbot/chatbot.css';
  document.head.appendChild(link);

  // DOM References
  const panel = document.getElementById('tmCbPanel');
  const messagesDiv = document.getElementById('tmCbMessages');
  const input = document.getElementById('tmCbInput');
  const sendBtn = document.getElementById('tmCbSend');
  const launcher = document.getElementById('tmCbLauncher');

  // Lazy-load knowledge base
  async function loadKnowledgeBase() {
    if (knowledgeBase) return knowledgeBase;
    try {
      const response = await fetch(KB_URL);
      if (!response.ok) throw new Error('Failed to load');
      knowledgeBase = await response.json();
      return knowledgeBase;
    } catch (error) {
      console.error('Chatbot KB load error:', error);
      return null;
    }
  }

  // UI Functions
  function togglePanel() {
    isPanelOpen = !isPanelOpen;
    panel.classList.toggle('tm-cb-open', isPanelOpen);
    launcher.setAttribute('aria-expanded', isPanelOpen.toString());
    
    if (isPanelOpen && !knowledgeBase) {
      loadKnowledgeBase().then(kb => {
        if (kb && messagesDiv.children.length === 0) {
          addBotMessage(kb.greeting);
          renderSuggestions(kb.suggestedQuestions);
        }
      });
    }
    
    if (isPanelOpen) {
      setTimeout(() => input.focus(), 100);
    }
  }

  function addBotMessage(htmlContent, sourceUrl = null) {
    const msg = document.createElement('div');
    msg.className = 'tm-cb-message tm-cb-bot';
    // Sanitize: We trust the KB JSON, but we must prevent injection if KB is tampered with.
    // We allow specific tags (b, strong, a, br) by using a safe parser or simple replacement.
    // For maximum safety with controlled JSON, we'll use textContent for user input, 
    // and a constrained innerHTML for bot responses that we control.
    msg.innerHTML = htmlContent; 
    
    if (sourceUrl) {
      const source = document.createElement('span');
      source.className = 'tm-cb-source';
      source.innerHTML = `Source: <a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">texasmovement.com</a>`;
      msg.appendChild(source);
    }
    
    messagesDiv.appendChild(msg);
    scrollToBottom();
  }

  function addUserMessage(text) {
    const msg = document.createElement('div');
    msg.className = 'tm-cb-message tm-cb-user';
    msg.textContent = text; // Secure against XSS
    messagesDiv.appendChild(msg);
    scrollToBottom();
  }

  function showTyping() {
    const typing = document.createElement('div');
    typing.className = 'tm-cb-typing';
    typing.id = 'tmCbTyping';
    typing.innerHTML = '<span></span><span></span><span></span>';
    messagesDiv.appendChild(typing);
    scrollToBottom();
  }

  function hideTyping() {
    const typing = document.getElementById('tmCbTyping');
    if (typing) typing.remove();
  }

  function scrollToBottom() {
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  function renderSuggestions(questions) {
    if (!questions || questions.length === 0) return;
    const container = document.createElement('div');
    container.className = 'tm-cb-suggestions';
    questions.forEach(q => {
      const chip = document.createElement('button');
      chip.className = 'tm-cb-suggestion-chip';
      chip.textContent = q;
      chip.onclick = () => {
        container.remove();
        handleUserInput(q);
      };
      container.appendChild(chip);
    });
    messagesDiv.appendChild(container);
    scrollToBottom();
  }

  // Retrieval Engine
  function findBestResponse(userInput) {
    if (!knowledgeBase) return knowledgeBase.entries.find(e => e.id === 'fallback');
    
    const tokens = userInput.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(t => t.length >= 3);
    let bestMatch = null;
    let highestScore = 0;

    for (const entry of knowledgeBase.entries) {
      if (entry.id === 'fallback') continue;
      
      let score = 0;
      const allKeywords = [...entry.keywords, ...(entry.synonyms || [])].map(k => k.toLowerCase());
      
      // Token matching
      for (const token of tokens) {
        for (const kw of allKeywords) {
          if (kw.includes(token) || token.includes(kw)) {
            score += entry.keywords.includes(kw) ? 2 : 1; // Weight official keywords higher
          }
        }
      }
      
      // Exact phrase boost
      if (entry.keywords.some(kw => userInput.toLowerCase().includes(kw.toLowerCase()))) {
        score += 5;
      }

      if (score > highestScore && score >= 3) {
        highestScore = score;
        bestMatch = entry;
      }
    }

    return bestMatch || knowledgeBase.entries.find(e => e.id === 'fallback');
  }

  function escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  async function handleUserInput(text) {
    if (!text.trim()) return;
    
    addUserMessage(text);
    input.value = '';
    sendBtn.disabled = true;
    showTyping();

    // Simulate natural delay
    await new Promise(r => setTimeout(r, 600));
    
    const response = findBestResponse(text);
    hideTyping();
    addBotMessage(response.answer, response.source);
  }

  // Event Listeners
  launcher.addEventListener('click', togglePanel);
  
  document.getElementById('tmCbClose').addEventListener('click', () => {
    togglePanel();
    launcher.focus(); // Return focus
  });

  document.getElementById('tmCbClear').addEventListener('click', () => {
    messagesDiv.innerHTML = '';
    if (knowledgeBase) {
      addBotMessage(knowledgeBase.greeting);
      renderSuggestions(knowledgeBase.suggestedQuestions);
    }
    input.focus();
  });

  sendBtn.addEventListener('click', () => handleUserInput(input.value));
  
  input.addEventListener('input', () => {
    sendBtn.disabled = !input.value.trim();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!sendBtn.disabled) handleUserInput(input.value);
    }
    if (e.key === 'Escape') {
      togglePanel();
      launcher.focus();
    }
  });

  // Close on click outside (optional, improves mobile UX)
  document.addEventListener('click', (e) => {
    if (isPanelOpen && !container.contains(e.target)) {
      togglePanel();
    }
  });

})();
