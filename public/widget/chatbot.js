/**
 * Scrybe Chatbot Widget
 *
 * Embeddable script that creates an iframe with the chatbot UI.
 * Usage:
 * <script
 *   src="https://app.scrybe.com/widget/chatbot.js"
 *   data-org="org-slug"
 *   data-form="intake-form-id" (optional)
 *   data-primary-color="#4F46E5" (optional)
 *   data-position="bottom-right" (optional: bottom-right, bottom-left)
 * ></script>
 *
 * @see PX-702 - Automated Chatbot Intake
 */

(function() {
  'use strict';

  // Get script configuration from data attributes
  var scriptTag = document.currentScript || (function() {
    var scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();

  var config = {
    org: scriptTag.getAttribute('data-org'),
    formId: scriptTag.getAttribute('data-form'),
    primaryColor: scriptTag.getAttribute('data-primary-color') || '#4F46E5',
    position: scriptTag.getAttribute('data-position') || 'bottom-right',
  };

  if (!config.org) {
    console.error('[Scrybe Chatbot] Error: data-org attribute is required');
    return;
  }

  // Determine base URL
  var baseUrl = (function() {
    var src = scriptTag.src;
    if (src) {
      // Extract base URL from script src
      var url = new URL(src);
      return url.origin;
    }
    // Fallback to current origin
    return window.location.origin;
  })();

  // Widget state
  var state = {
    isOpen: false,
    isLoaded: false,
    isMinimized: false,
    hasUnread: false,
  };

  // Create styles
  var styles = document.createElement('style');
  styles.textContent = '\n' +
    '.scrybe-chatbot-container {\n' +
    '  position: fixed;\n' +
    '  z-index: 999999;\n' +
    '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;\n' +
    '}\n' +
    '.scrybe-chatbot-container.bottom-right {\n' +
    '  bottom: 20px;\n' +
    '  right: 20px;\n' +
    '}\n' +
    '.scrybe-chatbot-container.bottom-left {\n' +
    '  bottom: 20px;\n' +
    '  left: 20px;\n' +
    '}\n' +
    '.scrybe-chatbot-button {\n' +
    '  width: 60px;\n' +
    '  height: 60px;\n' +
    '  border-radius: 50%;\n' +
    '  border: none;\n' +
    '  background-color: ' + config.primaryColor + ';\n' +
    '  color: white;\n' +
    '  cursor: pointer;\n' +
    '  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);\n' +
    '  display: flex;\n' +
    '  align-items: center;\n' +
    '  justify-content: center;\n' +
    '  transition: transform 0.2s, box-shadow 0.2s;\n' +
    '}\n' +
    '.scrybe-chatbot-button:hover {\n' +
    '  transform: scale(1.05);\n' +
    '  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);\n' +
    '}\n' +
    '.scrybe-chatbot-button:focus {\n' +
    '  outline: 2px solid ' + config.primaryColor + ';\n' +
    '  outline-offset: 2px;\n' +
    '}\n' +
    '.scrybe-chatbot-button svg {\n' +
    '  width: 28px;\n' +
    '  height: 28px;\n' +
    '}\n' +
    '.scrybe-chatbot-button .close-icon {\n' +
    '  display: none;\n' +
    '}\n' +
    '.scrybe-chatbot-button.open .chat-icon {\n' +
    '  display: none;\n' +
    '}\n' +
    '.scrybe-chatbot-button.open .close-icon {\n' +
    '  display: block;\n' +
    '}\n' +
    '.scrybe-chatbot-unread {\n' +
    '  position: absolute;\n' +
    '  top: -4px;\n' +
    '  right: -4px;\n' +
    '  width: 16px;\n' +
    '  height: 16px;\n' +
    '  background-color: #ef4444;\n' +
    '  border-radius: 50%;\n' +
    '  border: 2px solid white;\n' +
    '  display: none;\n' +
    '}\n' +
    '.scrybe-chatbot-unread.visible {\n' +
    '  display: block;\n' +
    '}\n' +
    '.scrybe-chatbot-frame {\n' +
    '  position: absolute;\n' +
    '  bottom: 70px;\n' +
    '  width: 380px;\n' +
    '  height: 600px;\n' +
    '  max-height: calc(100vh - 100px);\n' +
    '  border: none;\n' +
    '  border-radius: 16px;\n' +
    '  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);\n' +
    '  background: white;\n' +
    '  opacity: 0;\n' +
    '  transform: translateY(10px) scale(0.95);\n' +
    '  transition: opacity 0.2s, transform 0.2s;\n' +
    '  pointer-events: none;\n' +
    '}\n' +
    '.scrybe-chatbot-container.bottom-right .scrybe-chatbot-frame {\n' +
    '  right: 0;\n' +
    '}\n' +
    '.scrybe-chatbot-container.bottom-left .scrybe-chatbot-frame {\n' +
    '  left: 0;\n' +
    '}\n' +
    '.scrybe-chatbot-frame.open {\n' +
    '  opacity: 1;\n' +
    '  transform: translateY(0) scale(1);\n' +
    '  pointer-events: auto;\n' +
    '}\n' +
    '@media (max-width: 480px) {\n' +
    '  .scrybe-chatbot-frame {\n' +
    '    width: calc(100vw - 20px);\n' +
    '    height: calc(100vh - 90px);\n' +
    '    max-height: none;\n' +
    '    bottom: 70px;\n' +
    '    left: 10px !important;\n' +
    '    right: 10px !important;\n' +
    '    border-radius: 12px;\n' +
    '  }\n' +
    '  .scrybe-chatbot-container {\n' +
    '    bottom: 10px !important;\n' +
    '    right: 10px !important;\n' +
    '    left: auto !important;\n' +
    '  }\n' +
    '}\n';
  document.head.appendChild(styles);

  // Create container
  var container = document.createElement('div');
  container.className = 'scrybe-chatbot-container ' + config.position;
  container.setAttribute('role', 'complementary');
  container.setAttribute('aria-label', 'Chat widget');

  // Create toggle button
  var button = document.createElement('button');
  button.className = 'scrybe-chatbot-button';
  button.setAttribute('aria-label', 'Open chat');
  button.setAttribute('aria-expanded', 'false');
  button.innerHTML =
    '<svg class="chat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>' +
    '</svg>' +
    '<svg class="close-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<line x1="18" y1="6" x2="6" y2="18"></line>' +
    '<line x1="6" y1="6" x2="18" y2="18"></line>' +
    '</svg>';

  // Create unread indicator
  var unreadIndicator = document.createElement('span');
  unreadIndicator.className = 'scrybe-chatbot-unread';
  unreadIndicator.setAttribute('aria-hidden', 'true');
  button.appendChild(unreadIndicator);

  // Create iframe
  var iframe = document.createElement('iframe');
  iframe.className = 'scrybe-chatbot-frame';
  iframe.setAttribute('title', 'Chat with us');
  iframe.setAttribute('allow', 'microphone');
  iframe.setAttribute('loading', 'lazy');

  // Build iframe URL
  var iframeUrl = baseUrl + '/chatbot/' + encodeURIComponent(config.org);
  if (config.formId) {
    iframeUrl += '?formId=' + encodeURIComponent(config.formId);
  }
  iframeUrl += (config.formId ? '&' : '?') + 'primaryColor=' + encodeURIComponent(config.primaryColor);

  // Toggle chat open/closed
  function toggleChat() {
    state.isOpen = !state.isOpen;

    if (state.isOpen) {
      button.classList.add('open');
      button.setAttribute('aria-label', 'Close chat');
      button.setAttribute('aria-expanded', 'true');
      iframe.classList.add('open');

      // Load iframe on first open
      if (!state.isLoaded) {
        iframe.src = iframeUrl;
        state.isLoaded = true;
      }

      // Clear unread indicator
      state.hasUnread = false;
      unreadIndicator.classList.remove('visible');

      // Focus iframe for accessibility
      setTimeout(function() {
        iframe.focus();
      }, 300);
    } else {
      button.classList.remove('open');
      button.setAttribute('aria-label', 'Open chat');
      button.setAttribute('aria-expanded', 'false');
      iframe.classList.remove('open');
    }
  }

  // Handle messages from iframe
  function handleMessage(event) {
    // Verify origin
    if (event.origin !== baseUrl) {
      return;
    }

    var data = event.data;
    if (!data || typeof data !== 'object' || data.source !== 'scrybe-chatbot') {
      return;
    }

    switch (data.type) {
      case 'close':
        if (state.isOpen) {
          toggleChat();
        }
        break;
      case 'minimize':
        if (state.isOpen) {
          toggleChat();
        }
        break;
      case 'newMessage':
        if (!state.isOpen) {
          state.hasUnread = true;
          unreadIndicator.classList.add('visible');
        }
        break;
      case 'resize':
        if (data.height) {
          iframe.style.height = Math.min(data.height, 600) + 'px';
        }
        break;
    }
  }

  // Event listeners
  button.addEventListener('click', toggleChat);
  window.addEventListener('message', handleMessage);

  // Keyboard accessibility
  button.addEventListener('keydown', function(event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleChat();
    }
    if (event.key === 'Escape' && state.isOpen) {
      toggleChat();
    }
  });

  // Assemble widget
  container.appendChild(iframe);
  container.appendChild(button);

  // Add to page when DOM is ready
  function init() {
    document.body.appendChild(container);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose API for programmatic control
  window.ScrybeChatbot = {
    open: function() {
      if (!state.isOpen) {
        toggleChat();
      }
    },
    close: function() {
      if (state.isOpen) {
        toggleChat();
      }
    },
    toggle: toggleChat,
    isOpen: function() {
      return state.isOpen;
    },
  };
})();
