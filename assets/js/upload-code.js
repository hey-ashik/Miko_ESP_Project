/**
 * Upload Code - Web Serial Flash Tool
 * Miko IoT Platform
 * 
 * Uses the Web Serial API to:
 * 1. Connect to ESP32/ESP8266/Arduino via USB
 * 2. Read serial output (Serial Monitor)
 * 3. Send data to the device
 * 4. Flash compiled binaries using esptool-js protocol
 */

// ===== STATE =====
let port = null;
let reader = null;
let writer = null;
let readableStreamClosed = null;
let writableStreamClosed = null;
let isConnected = false;
let selectedBoard = 'esp32';
let isUploading = false;

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
    // Check Web Serial API support
    if (!('serial' in navigator)) {
        document.getElementById('browserWarning').style.display = 'flex';
        document.getElementById('connectBtn').disabled = true;
        document.getElementById('uploadBtn').disabled = true;
    }

    // Initialize line numbers
    updateLineNumbers();

    // Code editor events
    const codeEditor = document.getElementById('codeEditor');
    codeEditor.addEventListener('input', function() {
        updateLineNumbers();
        updateStepStatus();
    });
    codeEditor.addEventListener('scroll', syncScroll);
    codeEditor.addEventListener('keydown', handleTabKey);

    // File upload
    document.getElementById('codeFileUpload').addEventListener('change', handleFileUpload);

    // Serial input enter key
    document.getElementById('serialInput').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            sendSerialMessage();
        }
    });

    // Update step status on load
    updateStepStatus();
});

// ===== LINE NUMBERS =====
function updateLineNumbers() {
    const codeEditor = document.getElementById('codeEditor');
    const lineNumbersEl = document.getElementById('editorLineNumbers');
    const lines = codeEditor.value.split('\n');
    const count = Math.max(lines.length, 20);
    let html = '';
    for (let i = 1; i <= count; i++) {
        html += i + '\n';
    }
    lineNumbersEl.textContent = html;
}

function syncScroll() {
    const codeEditor = document.getElementById('codeEditor');
    const lineNumbersEl = document.getElementById('editorLineNumbers');
    lineNumbersEl.scrollTop = codeEditor.scrollTop;
}

// Handle Tab key in textarea
function handleTabKey(e) {
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

    const reader = new FileReader();
    reader.onload = function(evt) {
        document.getElementById('codeEditor').value = evt.target.result;
        document.getElementById('openFileName').textContent = file.name;
        document.getElementById('openFileSize').textContent = formatFileSize(file.size);
        document.getElementById('fileBar').style.display = 'flex';
        updateLineNumbers();
        updateStepStatus();
        showToast('File loaded: ' + file.name, 'success');
    };
    reader.readAsText(file);
}

function clearFile() {
    document.getElementById('fileBar').style.display = 'none';
    document.getElementById('codeFileUpload').value = '';
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ===== CODE EDITOR ACTIONS =====
function copyEditorCode() {
    const code = document.getElementById('codeEditor').value;
    if (!code.trim()) {
        showToast('No code to copy', 'warning');
        return;
    }
    navigator.clipboard.writeText(code).then(function() {
        showToast('Code copied to clipboard!', 'success');
    });
}

function clearEditorCode() {
    document.getElementById('codeEditor').value = '';
    clearFile();
    updateLineNumbers();
    updateStepStatus();
}

function downloadCode() {
    const code = document.getElementById('codeEditor').value;
    if (!code.trim()) {
        showToast('No code to download', 'warning');
        return;
    }

    const ext = selectedBoard.startsWith('arduino') ? '.ino' : '.cpp';
    const filename = 'miko_sketch' + ext;
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Code downloaded as ' + filename, 'success');
}

// ===== BOARD SELECTION =====
function selectBoard(board) {
    selectedBoard = board;
    document.querySelectorAll('.board-option').forEach(function(btn) {
        btn.classList.remove('active');
    });
    document.querySelector('[data-board="' + board + '"]').classList.add('active');

    // Update language badge
    const langBadge = document.getElementById('langBadge');
    if (board === 'esp32' || board === 'esp32-devkit-v1') {
        langBadge.textContent = 'ESP32 C++';
    } else if (board === 'esp8266') {
        langBadge.textContent = 'ESP8266 C++';
    } else {
        langBadge.textContent = 'Arduino C++';
    }
}

// ===== WEB SERIAL API =====
async function handleConnect() {
    if (!('serial' in navigator)) {
        showToast('Web Serial API is not supported in this browser', 'error');
        return;
    }
    // If we already have a port open, try to close it first
    if (port) {
        try {
            await port.close();
        } catch(e) {}
    }

    try {
        // Request port
        port = await navigator.serial.requestPort();
        
        // Auto-select baud rate based on board if default
        let baudRate = parseInt(document.getElementById('baudRate').value);
        if (selectedBoard.startsWith('esp') && baudRate < 115200) {
            baudRate = 115200;
            document.getElementById('baudRate').value = "115200";
        }

        await port.open({ baudRate: baudRate });

        isConnected = true;
        updateConnectionUI(true);
        updateStepStatus();
        showToast('Device connected successfully!', 'success');
        appendToMonitor('--- Connected at ' + baudRate + ' baud ---', 'system');

        // Start reading
        startReading();

    } catch (err) {
        if (err.name === 'NotFoundError') {
            showToast('No device selected', 'warning');
        } else if (err.name === 'SecurityError') {
             showToast('Permission denied. Try again or check browser settings.', 'error');
        } else if (err.message.includes('busy') || err.message.includes('Failed to open')) {
            showToast('Port is busy! Close Arduino IDE Serial Monitor or other browser tabs.', 'error');
        } else {
            showToast('Connection failed: ' + err.message, 'error');
            console.error('Serial connection error:', err);
        }
    }
}

async function handleDisconnect() {
    try {
        if (reader) {
            await reader.cancel();
            await readableStreamClosed.catch(() => {});
            reader = null;
            readableStreamClosed = null;
        }

        if (writer) {
            await writer.close();
            await writableStreamClosed;
            writer = null;
            writableStreamClosed = null;
        }

        if (port) {
            await port.close();
            port = null;
        }

        isConnected = false;
        updateConnectionUI(false);
        updateStepStatus();
        appendToMonitor('--- Disconnected ---', 'system');
        showToast('Device disconnected', 'info');

    } catch (err) {
        console.error('Disconnect error:', err);
        // Force cleanup
        port = null;
        reader = null;
        writer = null;
        isConnected = false;
        updateConnectionUI(false);
    }
}

async function startReading() {
    const textDecoder = new TextDecoderStream();
    readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
    reader = textDecoder.readable.getReader();

    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) {
                break;
            }
            if (value) {
                appendToMonitor(value, 'success');
            }
        }
    } catch (err) {
        if (err.name !== 'NetworkError' && err.message !== 'The device has been lost.') {
            console.error('Read error:', err);
        }
    } finally {
        if (isConnected) {
            isConnected = false;
            updateConnectionUI(false);
            updateStepStatus();
            appendToMonitor('--- Device disconnected ---', 'system');
            showToast('Device disconnected unexpectedly', 'warning');
        }
    }
}

async function sendSerialMessage() {
    const input = document.getElementById('serialInput');
    const message = input.value;
    if (!message || !isConnected || !port) return;

    try {
        const textEncoder = new TextEncoderStream();
        writableStreamClosed = textEncoder.readable.pipeTo(port.writable);
        writer = textEncoder.writable.getWriter();

        await writer.write(message + '\n');
        appendToMonitor('> ' + message, 'info');
        input.value = '';

        // Release the writer
        writer.releaseLock();
        writer = null;
    } catch (err) {
        showToast('Failed to send: ' + err.message, 'error');
        console.error('Send error:', err);
    }
}

// ===== UPLOAD / FLASH =====
async function handleUpload() {
    const code = document.getElementById('codeEditor').value.trim();

    if (!code) {
        showToast('Please write or paste some code first', 'warning');
        return;
    }

    if (isUploading) return;

    isUploading = true;
    const uploadBtn = document.getElementById('uploadBtn');
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Compiling...</span>';

    showProgress(true);
    updateProgress(5, 'Preparing code...');
    appendToMonitor('--- Starting compilation ---', 'system');
    appendToMonitor('[INFO] Board: ' + selectedBoard, 'info');

    try {
        // Step 1: Send code to server for compilation
        updateProgress(15, 'Sending code to compiler...');
        appendToMonitor('[COMPILE] Sending code to cloud compiler...', 'info');

        const response = await fetch('api.php?action=compile_code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code: code,
                board: selectedBoard
            })
        });

        updateProgress(40, 'Processing response...');

        let result;
        try {
            result = await response.json();
        } catch (parseErr) {
            throw new Error('Server returned invalid response. Check server logs.');
        }

        // Handle setup required
        if (result.setup_required) {
            appendToMonitor('[ERROR] Arduino CLI not installed on server!', 'error');
            appendToMonitor('', 'info');
            appendToMonitor('[SETUP] You need to run the compiler setup first:', 'warning');
            appendToMonitor('[SETUP] Open: ' + window.location.origin + '/setup-compiler.php', 'warning');
            appendToMonitor('[SETUP] This will install Arduino CLI, ESP32/ESP8266 boards,', 'warning');
            appendToMonitor('[SETUP] and common libraries (ArduinoJson, DHT, etc.)', 'warning');
            appendToMonitor('', 'info');
            appendToMonitor('[TIP] You only need to run setup once!', 'success');
            showToast('Compiler setup required. See Serial Monitor for instructions.', 'warning');
            updateProgress(0, 'Setup required');
            return;
        }

        if (result.success && result.binary) {
            updateProgress(60, 'Compilation successful!');
            appendToMonitor('[COMPILE] ✓ Compilation successful!', 'success');
            appendToMonitor('[COMPILE] Binary size: ' + formatBytes(result.binarySize), 'info');
            appendToMonitor('[COMPILE] Board FQBN: ' + (result.fqbn || selectedBoard), 'info');

            // Show compiler output if available
            if (result.output) {
                var outputLines = result.output.split('\n');
                for (var i = 0; i < Math.min(outputLines.length, 10); i++) {
                    if (outputLines[i].trim()) {
                        appendToMonitor('[BUILD] ' + outputLines[i].trim(), 'info');
                    }
                }
            }

            // Step 2: Flash the binary via Serial (if connected)
            if (isConnected && port) {
                updateProgress(70, 'Flashing to device...');
                appendToMonitor('[FLASH] Sending binary to device via USB...', 'info');

                await flashBinary(result.binary);

                updateProgress(100, 'Upload complete!');
                appendToMonitor('[FLASH] ✓ Upload complete! Device restarting...', 'success');
                showToast('Code compiled and uploaded successfully!', 'success');

                // Mark step 3 complete
                document.getElementById('step3').classList.add('completed');
            } else {
                updateProgress(100, 'Compilation complete!');
                appendToMonitor('', 'info');
                appendToMonitor('[INFO] ✓ Code compiled successfully!', 'success');
                appendToMonitor('[INFO] Connect your device via USB to flash the binary.', 'warning');
                showToast('Compilation successful! Connect device to flash.', 'success');
            }

        } else {
            // Compilation failed - show detailed errors
            updateProgress(0, 'Compilation failed');
            appendToMonitor('[ERROR] ✗ Compilation failed!', 'error');

            if (result.error) {
                // Show the error lines
                var errorLines = result.error.split('\n');
                for (var j = 0; j < errorLines.length; j++) {
                    if (errorLines[j].trim()) {
                        appendToMonitor('[ERROR] ' + errorLines[j].trim(), 'error');
                    }
                }
            }

            // Show full compiler output for debugging
            if (result.fullOutput) {
                appendToMonitor('', 'info');
                appendToMonitor('--- Full Compiler Output ---', 'system');
                var fullLines = result.fullOutput.split('\n');
                for (var k = 0; k < fullLines.length; k++) {
                    if (fullLines[k].trim()) {
                        var lineType = 'info';
                        var lineText = fullLines[k].trim();
                        if (lineText.toLowerCase().includes('error')) lineType = 'error';
                        else if (lineText.toLowerCase().includes('warning')) lineType = 'warning';
                        appendToMonitor(lineText, lineType);
                    }
                }
                appendToMonitor('--- End of Output ---', 'system');
            }

            appendToMonitor('', 'info');
            appendToMonitor('[TIP] Common fixes:', 'warning');
            appendToMonitor('[TIP]   - Check for missing semicolons or brackets', 'warning');
            appendToMonitor('[TIP]   - Make sure you have setup() and loop() functions', 'warning');
            appendToMonitor('[TIP]   - Verify library includes are correct', 'warning');
            appendToMonitor('[TIP]   - Select the correct board type', 'warning');

            showToast('Compilation failed. Check Serial Monitor for errors.', 'error');
        }

    } catch (err) {
        updateProgress(0, 'Upload failed');
        appendToMonitor('[ERROR] ' + err.message, 'error');

        // If server returned non-JSON or network error
        if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
            appendToMonitor('[ERROR] Network error. Check your internet connection.', 'error');
            showToast('Network error. Please check your connection.', 'error');
        } else {
            showToast('Upload failed: ' + err.message, 'error');
        }
    } finally {
        isUploading = false;
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = '<i class="fas fa-bolt"></i> <span>Compile & Upload</span>';
        setTimeout(function() { showProgress(false); }, 5000);
    }
}

function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// Flash binary to ESP device
async function flashBinary(binaryData) {
    // Convert base64 binary to Uint8Array
    const binaryString = atob(binaryData);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    appendToMonitor('[FLASH] Sending ' + bytes.length + ' bytes...', 'info');

    // Send binary data in chunks via serial
    const chunkSize = 1024;
    let offset = 0;

    while (offset < bytes.length) {
        const chunk = bytes.slice(offset, offset + chunkSize);

        try {
            const writable = port.writable;
            const writer = writable.getWriter();
            await writer.write(chunk);
            writer.releaseLock();
        } catch (err) {
            throw new Error('Failed to write to device: ' + err.message);
        }

        offset += chunkSize;
        const percent = Math.min(70 + Math.floor((offset / bytes.length) * 30), 99);
        updateProgress(percent, 'Flashing... ' + Math.floor((offset / bytes.length) * 100) + '%');
    }

    // Wait for device to restart
    await new Promise(resolve => setTimeout(resolve, 2000));
}

// ===== UI UPDATES =====
function updateConnectionUI(connected) {
    const connectBtn = document.getElementById('connectBtn');
    const disconnectBtn = document.getElementById('disconnectBtn');
    const connectionDot = document.getElementById('connectionDot');
    const connectionLabel = document.getElementById('connectionLabel');
    const connectionBar = document.getElementById('connectionBar');
    const connectionInfo = document.getElementById('connectionInfo');
    const serialInput = document.getElementById('serialInput');
    const sendBtn = document.getElementById('sendBtn');

    if (connected) {
        connectBtn.style.display = 'none';
        disconnectBtn.style.display = 'inline-flex';
        connectionDot.classList.add('connected');
        connectionLabel.textContent = 'Device Connected';
        connectionBar.classList.add('connected');
        connectionInfo.style.display = 'flex';
        serialInput.disabled = false;
        sendBtn.disabled = false;
        document.getElementById('baudDisplay').textContent = document.getElementById('baudRate').value;
        document.getElementById('portName').textContent = 'USB Serial';
    } else {
        connectBtn.style.display = 'inline-flex';
        disconnectBtn.style.display = 'none';
        connectionDot.classList.remove('connected');
        connectionLabel.textContent = 'No Device Connected';
        connectionBar.classList.remove('connected');
        connectionInfo.style.display = 'none';
        serialInput.disabled = true;
        sendBtn.disabled = true;
    }
}

function updateStepStatus() {
    const code = document.getElementById('codeEditor').value.trim();
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');

    // Step 1: Device connected
    step1.classList.remove('completed', 'active');
    if (isConnected) {
        step1.classList.add('completed');
    } else {
        step1.classList.add('active');
    }

    // Step 2: Code written
    step2.classList.remove('completed', 'active');
    if (code.length > 10) {
        step2.classList.add('completed');
    } else if (isConnected) {
        step2.classList.add('active');
    }
}

// ===== SERIAL MONITOR =====
function appendToMonitor(text, type) {
    const monitor = document.getElementById('serialMonitor');

    // Remove welcome message on first output
    const welcome = monitor.querySelector('.monitor-welcome');
    if (welcome) {
        welcome.remove();
    }

    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    const line = document.createElement('div');
    line.className = 'serial-line' + (type ? ' ' + type : '');

    const ts = document.createElement('span');
    ts.className = 'serial-timestamp';
    ts.textContent = '[' + timestamp + ']';

    line.appendChild(ts);
    line.appendChild(document.createTextNode(' ' + text));
    monitor.appendChild(line);

    // Auto-scroll
    if (document.getElementById('autoScroll').checked) {
        monitor.scrollTop = monitor.scrollHeight;
    }
}

function clearMonitor() {
    const monitor = document.getElementById('serialMonitor');
    monitor.innerHTML = '<div class="monitor-welcome"><i class="fas fa-terminal"></i><span>Serial monitor cleared</span></div>';
}

// ===== PROGRESS =====
function showProgress(show) {
    document.getElementById('uploadProgress').style.display = show ? 'block' : 'none';
}

function updateProgress(percent, label) {
    document.getElementById('progressFill').style.width = percent + '%';
    document.getElementById('progressPercent').textContent = percent + '%';
    if (label) {
        document.getElementById('progressLabel').textContent = label;
    }
}

// ===== TOAST NOTIFICATIONS =====
function showToast(message, type) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = 'toast ' + (type || 'info');

    const icons = {
        success: 'fa-check-circle',
        error: 'fa-times-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };

    toast.innerHTML = '<i class="fas ' + (icons[type] || icons.info) + '"></i> ' + message;
    container.appendChild(toast);

    // Remove after 4 seconds
    setTimeout(function() {
        toast.style.animation = 'toastOut 0.3s ease forwards';
        setTimeout(function() {
            toast.remove();
        }, 300);
    }, 4000);
}

// ===== SIDEBAR HANDLERS =====
// Note: These functions control the mobile sidebar and its overlay
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.toggle('open');
    if (overlay) overlay.classList.toggle('show');
}

function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('show');
}

// Automatically close sidebar if window resized to desktop
window.addEventListener('resize', function() {
    if (window.innerWidth > 1024) {
        closeSidebar();
    }
});
