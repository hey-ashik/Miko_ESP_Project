
/**
 * AI Code Editor - JavaScript
 * Powered by Groq Cloud (LLaMA 3 Model)
 */

// ===== STATE =====
let chatHistoryArr = [];
let outputCode = '';
let isGenerating = false;

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function () {
    const codeInput = document.getElementById('codeInput');
    const fileUpload = document.getElementById('fileUpload');

    // Line numbers sync
    codeInput.addEventListener('input', updateLineNumbers);
    codeInput.addEventListener('scroll', syncScroll);
    codeInput.addEventListener('keydown', handleTab);

    // File upload handler
    fileUpload.addEventListener('change', handleFileUpload);

    // Initialize line numbers
    updateLineNumbers();
});

// ===== LINE NUMBERS =====
function updateLineNumbers() {
    const textarea = document.getElementById('codeInput');
    const lineNumbersEl = document.getElementById('lineNumbers');
    const lines = textarea.value.split('\n');
    const count = lines.length;

    let html = '';
    for (let i = 1; i <= count; i++) {
        html += i + '\n';
    }
    lineNumbersEl.textContent = html;
}

function updateOutputLineNumbers(text) {
    const lineNumbersEl = document.getElementById('outputLineNumbers');
    if (!text || text.trim() === '') {
        lineNumbersEl.textContent = '';
        return;
    }
    const lines = text.split('\n');
    let html = '';
    for (let i = 1; i <= lines.length; i++) {
        html += i + '\n';
    }
    lineNumbersEl.textContent = html;
}

function syncScroll() {
    const textarea = document.getElementById('codeInput');
    const lineNumbers = document.getElementById('lineNumbers');
    lineNumbers.scrollTop = textarea.scrollTop;
}

// ===== TAB SUPPORT =====
function handleTab(e) {
    if (e.key === 'Tab') {
        e.preventDefault();
        const start = this.selectionStart;
        const end = this.selectionEnd;
        this.value = this.value.substring(0, start) + '    ' + this.value.substring(end);
        this.selectionStart = this.selectionEnd = start + 4;
        updateLineNumbers();
    }
}

// ===== FILE UPLOAD =====
function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Check file size (max 500KB)
    if (file.size > 500 * 1024) {
        showToast('File too large. Maximum 500KB allowed.', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = function (event) {
        const textarea = document.getElementById('codeInput');
        textarea.value = event.target.result;
        updateLineNumbers();

        // Show file info
        document.getElementById('fileInfoBar').style.display = 'flex';
        document.getElementById('fileName').textContent = file.name + ' (' + formatFileSize(file.size) + ')';

        // Auto detect language
        autoDetectLanguage(file.name);

        showToast('File loaded: ' + file.name, 'success');
    };
    reader.onerror = function () {
        showToast('Failed to read file.', 'error');
    };
    reader.readAsText(file);
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
}

function autoDetectLanguage(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const langMap = {
        'js': 'javascript', 'jsx': 'javascript', 'mjs': 'javascript',
        'ts': 'typescript', 'tsx': 'typescript',
        'py': 'python', 'pyw': 'python',
        'php': 'php', 'phtml': 'php',
        'html': 'html', 'htm': 'html',
        'css': 'css', 'scss': 'css', 'sass': 'css',
        'c': 'cpp', 'cpp': 'cpp', 'h': 'cpp', 'hpp': 'cpp', 'cc': 'cpp',
        'java': 'java',
        'go': 'go',
        'rs': 'rust',
        'rb': 'ruby',
        'swift': 'swift',
        'kt': 'kotlin', 'kts': 'kotlin',
        'dart': 'dart',
        'ino': 'arduino',
        'sql': 'sql',
        'sh': 'shell', 'bash': 'shell', 'zsh': 'shell'
    };

    if (langMap[ext]) {
        document.getElementById('languageSelect').value = langMap[ext];
    }
}

function clearUpload() {
    document.getElementById('fileUpload').value = '';
    document.getElementById('fileInfoBar').style.display = 'none';
    document.getElementById('fileName').textContent = '';
}

// ===== SUGGESTIONS =====
function useSuggestion(text) {
    document.getElementById('aiPrompt').value = text;
    document.getElementById('aiPrompt').focus();
}

// ===== CLEAR CODE =====
function clearCode() {
    document.getElementById('codeInput').value = '';
    updateLineNumbers();
    clearUpload();
}

// ===== GENERATE CODE =====
const MAX_CODE_LENGTH = 15000;  // Max chars to send to AI (prevents 413)
const MAX_HISTORY_MSGS = 2;     // Keep only last 2 chat history messages

async function generateCode() {
    let code = document.getElementById('codeInput').value.trim();
    const prompt = document.getElementById('aiPrompt').value.trim();
    const language = document.getElementById('languageSelect').value;

    if (!code) {
        showToast('Please enter or upload your code first.', 'error');
        return;
    }

    if (!prompt) {
        showToast('Please describe what you want AI to do.', 'error');
        return;
    }

    if (isGenerating) return;
    isGenerating = true;

    // Truncate code if too large to prevent 413 error
    let truncated = false;
    if (code.length > MAX_CODE_LENGTH) {
        code = code.substring(0, MAX_CODE_LENGTH);
        truncated = true;
        showToast('Code truncated to ' + MAX_CODE_LENGTH + ' chars to fit AI limits.', 'info');
    }

    // Update UI
    const btn = document.getElementById('generateBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Generating...</span>';
    showLoading(true);

    // Build the system message
    const langHint = language !== 'auto' ? ' The code is written in ' + language + '.' : '';
    const systemMessage = 'You are an expert software engineer and code assistant with deep expertise in Arduino, ESP32, ESP8266, IoT development, and all major programming languages. ' +
        'The user will provide their existing code and a request for modifications. ' +
        'Your task is to modify and return the COMPLETE updated code with the requested changes applied.' + langHint +
        '\n\nARDUINO/ESP EXPERTISE:\n' +
        '- You have expert knowledge of Arduino IDE, ESP32, ESP8266, NodeMCU, Wemos boards\n' +
        '- You know all Arduino libraries (WiFi, HTTPClient, ArduinoJson, Servo, DHT, Adafruit, etc.)\n' +
        '- You understand GPIO pin mappings, PWM, I2C, SPI, UART protocols\n' +
        '- You can write efficient, memory-safe embedded C/C++ code\n' +
        '- You know board-specific differences (ESP32 vs ESP8266 includes, pin numbering)\n' +
        '\n\nIMPORTANT RULES:\n' +
        '1. Return ONLY the complete modified code - no explanations, no markdown formatting, no code fences (no ```)\n' +
        '2. Include ALL the original code with the modifications integrated\n' +
        '3. Add clear comments where you made changes (e.g., // NEW: Added feature)\n' +
        '4. Follow best practices and conventions for the language\n' +
        '5. Make sure the code is complete and ready to use\n' +
        '6. For Arduino code: ensure proper setup()/loop() structure, correct pin modes, and memory-efficient practices';

    // Build messages array
    const messages = [
        { role: 'system', content: systemMessage }
    ];

    // Add chat history for context (limited to prevent large payloads)
    const recentHistory = chatHistoryArr.slice(-MAX_HISTORY_MSGS);
    recentHistory.forEach(function (msg) {
        // Truncate old history messages to save space
        const truncatedContent = msg.content.length > 3000
            ? msg.content.substring(0, 3000) + '\n// ... (truncated for brevity)'
            : msg.content;
        messages.push({ role: msg.role, content: truncatedContent });
    });

    // Add current user message
    const userMessage = 'Here is my code:\n\n' + code + (truncated ? '\n// ... (code truncated due to size limit)' : '') + '\n\nPlease make the following changes: ' + prompt;
    messages.push({ role: 'user', content: userMessage });

    try {
        const response = await fetch('ai-api.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: messages
            })
        });

        if (!response.ok) {
            if (response.status === 413) {
                throw new Error('Code is too large for the server. Please try with a shorter code snippet or clear chat history.');
            }
            // Try to parse error response, handle HTML errors
            const errorText = await response.text();
            let errorMsg = 'Server error (' + response.status + ')';
            try {
                if (errorText.trim().startsWith('<')) {
                    // Server returned HTML (PHP error) instead of JSON
                    errorMsg = 'Server configuration error. Status: ' + response.status;
                } else {
                    const errData = JSON.parse(errorText);
                    errorMsg = errData.error || errorMsg;
                }
            } catch (e) { /* keep default error message */ }
            throw new Error(errorMsg);
        }

        // Parse response - handle HTML error pages
        const responseText = await response.text();
        let data;
        try {
            if (responseText.trim().startsWith('<')) {
                throw new Error('Server returned an invalid response. Please try again.');
            }
            data = JSON.parse(responseText);
        } catch (e) {
            throw new Error('Invalid response from server. Please try again.');
        }

        if (data.error) {
            throw new Error(data.error);
        }

        // Extract the generated code
        let generatedCode = data.content || data.choices?.[0]?.message?.content || '';

        // Clean up markdown fences if present
        generatedCode = cleanCodeOutput(generatedCode);

        outputCode = generatedCode;

        // Display output
        displayOutput(generatedCode);

        // Enable buttons
        document.getElementById('copyBtn').disabled = false;
        document.getElementById('applyBtn').disabled = false;

        // Add to chat history (store truncated version to save memory)
        chatHistoryArr.push({ role: 'user', content: 'User requested: ' + prompt });
        chatHistoryArr.push({ role: 'assistant', content: generatedCode });

        // Keep history manageable
        if (chatHistoryArr.length > 6) {
            chatHistoryArr = chatHistoryArr.slice(-4);
        }

        updateChatHistory(prompt, 'Code generated successfully');

        showToast('Code generated successfully!', 'success');

    } catch (error) {
        console.error('AI Error:', error);
        showToast('Error: ' + error.message, 'error');
    } finally {
        isGenerating = false;
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i> <span>Generate with AI</span>';
        showLoading(false);
    }
}

// ===== CLEAN CODE OUTPUT =====
function cleanCodeOutput(text) {
    // Remove markdown code fences
    text = text.replace(/^```[\w]*\n?/gm, '');
    text = text.replace(/\n?```$/gm, '');
    // Trim leading/trailing whitespace
    text = text.trim();
    return text;
}

// ===== DISPLAY OUTPUT =====
function displayOutput(code) {
    const outputEl = document.getElementById('codeOutput');
    const emptyEl = document.getElementById('emptyOutput');

    if (emptyEl) emptyEl.style.display = 'none';

    // Escape HTML and display
    outputEl.textContent = code;
    outputEl.style.whiteSpace = 'pre';

    // Update line numbers
    updateOutputLineNumbers(code);
}

// ===== COPY OUTPUT =====
function copyOutput() {
    if (!outputCode) {
        showToast('Nothing to copy.', 'error');
        return;
    }

    navigator.clipboard.writeText(outputCode).then(function () {
        showToast('Code copied to clipboard!', 'success');
        // Animate button
        const btn = document.getElementById('copyBtn');
        btn.innerHTML = '<i class="fas fa-check"></i> <span class="action-text">Copied!</span>';
        setTimeout(function () {
            btn.innerHTML = '<i class="fas fa-copy"></i> <span class="action-text">Copy</span>';
        }, 2000);
    }).catch(function () {
        // Fallback copy
        fallbackCopy(outputCode);
    });
}

function fallbackCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
        document.execCommand('copy');
        showToast('Code copied to clipboard!', 'success');
    } catch (e) {
        showToast('Copy failed. Please select and copy manually.', 'error');
    }
    document.body.removeChild(textarea);
}

// ===== APPLY TO INPUT =====
function applyToInput() {
    if (!outputCode) return;

    document.getElementById('codeInput').value = outputCode;
    updateLineNumbers();
    showToast('AI output applied as input. You can now iterate further!', 'info');

    // Scroll to top
    document.getElementById('codeInput').scrollTop = 0;
}

// ===== CHAT HISTORY UI =====
function updateChatHistory(userPrompt, aiResponse) {
    const historyEl = document.getElementById('chatHistory');
    const messagesEl = document.getElementById('chatMessages');

    historyEl.style.display = 'flex';

    const userMsg = document.createElement('div');
    userMsg.className = 'chat-msg user';
    userMsg.innerHTML = '<span class="chat-msg-label">You</span>' + escapeHtml(userPrompt);
    messagesEl.appendChild(userMsg);

    const aiMsg = document.createElement('div');
    aiMsg.className = 'chat-msg ai';
    aiMsg.innerHTML = '<span class="chat-msg-label">AI</span>' + escapeHtml(aiResponse);
    messagesEl.appendChild(aiMsg);

    // Scroll to bottom
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

function clearHistory() {
    chatHistoryArr = [];
    document.getElementById('chatMessages').innerHTML = '';
    document.getElementById('chatHistory').style.display = 'none';
    showToast('Conversation cleared.', 'info');
}

// ===== LOADING OVERLAY =====
function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (show) {
        overlay.classList.add('show');
        // Reset progress bar animation
        const bar = document.getElementById('loadingBar');
        bar.style.animation = 'none';
        bar.offsetHeight; // force reflow
        bar.style.animation = 'loadingProgress 12s ease-in-out forwards';
    } else {
        // Complete progress bar
        const bar = document.getElementById('loadingBar');
        bar.style.animation = 'none';
        bar.style.width = '100%';
        setTimeout(function () {
            overlay.classList.remove('show');
            bar.style.width = '0%';
        }, 400);
    }
}

// ===== TOAST NOTIFICATIONS =====
function showToast(message, type) {
    type = type || 'info';
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;

    const iconMap = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        info: 'fa-info-circle'
    };

    toast.innerHTML = '<i class="fas ' + (iconMap[type] || 'fa-info-circle') + '"></i> ' + escapeHtml(message);
    container.appendChild(toast);

    // Auto-remove after 4s
    setTimeout(function () {
        toast.style.animation = 'toastOut 0.3s ease forwards';
        setTimeout(function () {
            toast.remove();
        }, 300);
    }, 4000);
}

// ===== UTILITY =====
function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Sidebar toggle (reuse from dashboard)
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebarOverlay').classList.toggle('show');
}
function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('show');
}
