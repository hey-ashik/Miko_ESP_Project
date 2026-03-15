<?php
/**
 * ESP IoT Cloud Control Platform
 * Individual Project Dashboard
 * 
 * Accessed via: esp.ashikone.com/projects/project-slug
 */

require_once '../config.php';
$userId = requireLogin();

$slug = isset($_GET['slug']) ? preg_replace('/[^a-z0-9\-_]/', '', strtolower($_GET['slug'])) : '';

if (empty($slug)) {
    header('Location: ../dashboard.php');
    exit;
}

$isAdmin = isset($_SESSION['is_admin']) && $_SESSION['is_admin'] === true && $userId === -1;

$pdo = getDB();

// Get project
if ($isAdmin) {
    $stmt = $pdo->prepare("
        SELECT p.*, h.last_seen, h.ip_address as esp_ip, h.firmware_version, h.wifi_ssid, h.rssi, h.free_heap
        FROM projects p 
        LEFT JOIN esp_heartbeat h ON p.id = h.project_id 
        WHERE p.project_slug = ?
    ");
    $stmt->execute([$slug]);
}
else {
    $stmt = $pdo->prepare("
        SELECT p.*, h.last_seen, h.ip_address as esp_ip, h.firmware_version, h.wifi_ssid, h.rssi, h.free_heap
        FROM projects p 
        LEFT JOIN esp_heartbeat h ON p.id = h.project_id 
        WHERE p.user_id = ? AND p.project_slug = ?
    ");
    $stmt->execute([$userId, $slug]);
}
$project = $stmt->fetch();

if (!$project) {
    header('HTTP/1.0 404 Not Found');
    echo '<!DOCTYPE html><html><head><title>Project Not Found</title>
    <style>body{font-family:Inter,sans-serif;background:#0f172a;color:#e2e8f0;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;}
    .card{background:#1e293b;border-radius:16px;padding:40px;text-align:center;box-shadow:0 25px 50px rgba(0,0,0,0.5);}
    h1{color:#ef4444;}a{color:#3b82f6;text-decoration:none;}</style></head>
    <body><div class="card"><h1>404</h1><p>Project not found</p><a href="../dashboard.php">← Back to Dashboard</a></div></body></html>';
    exit;
}

// Get devices
$stmt = $pdo->prepare("SELECT * FROM devices WHERE project_id = ? ORDER BY gpio_pin");
$stmt->execute([$project['id']]);
$devices = $stmt->fetchAll();

// Check online status (use UNIX_TIMESTAMP to avoid timezone issues)
$isOnline = false;
if ($project['last_seen']) {
    $stmt2 = $pdo->prepare("SELECT UNIX_TIMESTAMP(NOW()) - UNIX_TIMESTAMP(?) as diff");
    $stmt2->execute([$project['last_seen']]);
    $diff = $stmt2->fetch();
    $isOnline = ($diff && $diff['diff'] < 30);
}

// Get user info for sidebar
if ($isAdmin && $userId === -1) {
    $user = ['username' => 'Super Admin', 'email' => 'admin@miko.com'];
}
else {
    $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $user = $stmt->fetch();
}

// Get all projects for sidebar
$stmt = $pdo->prepare("
    SELECT p.*, CASE WHEN h.last_seen IS NOT NULL AND UNIX_TIMESTAMP(NOW()) - UNIX_TIMESTAMP(h.last_seen) < 30 THEN 1 ELSE 0 END as is_online
    FROM projects p 
    LEFT JOIN esp_heartbeat h ON p.id = h.project_id 
    WHERE p.user_id = ? 
    ORDER BY p.created_at DESC
");
$stmt->execute([$isAdmin ? $project['user_id'] : $userId]);
$allProjects = $stmt->fetchAll();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo $project['project_name']; ?> - <?php echo SITE_NAME; ?></title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <link rel="stylesheet" href="../assets/css/style.css?v=5">
    <link rel="stylesheet" href="../assets/css/dashboard.css?v=6">
    <script src="../assets/js/theme.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body class="dashboard-page">
    <!-- Sidebar -->
    <aside class="sidebar" id="sidebar">
        <div class="sidebar-header">
            <a href="<?php echo $isAdmin ? '../ashikadmin.php' : '../dashboard.php'; ?>" class="sidebar-logo">
                <i class="fas fa-microchip"></i>
                <span>Miko</span>
            </a>
            <button class="sidebar-toggle" onclick="toggleSidebar()">
                <i class="fas fa-bars"></i>
            </button>
        </div>
        
        <nav class="sidebar-nav">
            <a href="<?php echo $isAdmin ? '../ashikadmin.php' : '../dashboard.php'; ?>" class="nav-item">
                <i class="fas fa-th-large"></i>
                <span>Dashboard</span>
            </a>
            <a href="../ai-code-editor.php" class="nav-item">
                <i class="fas fa-wand-magic-sparkles"></i>
                <span>AI Code Editor</span>
            </a>
            <a href="../upload-code.php" class="nav-item">
                <i class="fas fa-upload"></i>
                <span>Upload Code</span>
            </a>
            <div class="nav-divider">
                <span>Your Projects</span>
            </div>
            <?php foreach ($allProjects as $p): ?>
                <a href="../projects/<?php echo $p['project_slug']; ?>" class="nav-item <?php echo $p['project_slug'] === $slug ? 'active' : ''; ?>">
                    <span class="status-dot <?php echo $p['is_online'] ? 'online' : 'offline'; ?>"></span>
                    <span><?php echo $p['project_name']; ?></span>
                </a>
            <?php
endforeach; ?>
        </nav>
        
        <div class="sidebar-footer">
            <div class="user-info">
                <div class="user-avatar">
                    <?php echo strtoupper(substr($user['username'], 0, 1)); ?>
                </div>
                <div class="user-details">
                    <span class="user-name"><?php echo $user['username']; ?></span>
                    <span class="user-email"><?php echo $user['email']; ?></span>
                </div>
            </div>
            <a href="../logout.php" class="btn btn-ghost btn-sm" title="Logout">
                <i class="fas fa-sign-out-alt"></i>
            </a>
        </div>
    </aside>
    
    <!-- Mobile Sidebar Overlay -->
    <div class="sidebar-overlay" id="sidebarOverlay" onclick="closeSidebar()"></div>
    
    <!-- Main Content -->
    <main class="main-content">
        <div class="topbar">
            <button class="mobile-menu-btn" onclick="toggleSidebar()">
                <i class="fas fa-bars"></i>
            </button>
            <div class="topbar-title">
                <h2><?php echo $project['project_name']; ?></h2>
                <span class="status-badge <?php echo $isOnline ? 'online' : 'offline'; ?>">
                    <span class="pulse-dot"></span>
                    <?php echo $isOnline ? 'ESP Online' : 'ESP Offline'; ?>
                </span>
            </div>
            <div class="topbar-actions">
                <button class="theme-toggle" onclick="toggleTheme()" title="Toggle Theme">
                    <i class="fas fa-moon"></i>
                </button>
                <button class="btn btn-ghost btn-sm" onclick="showDeviceInfo()">
                    <i class="fas fa-info-circle"></i> <span class="btn-text">Info</span>
                </button>
                <button class="btn btn-ghost btn-sm" onclick="showEspCodeProject()">
                    <i class="fas fa-code"></i> <span class="btn-text">ESP Code</span>
                </button>
                <button class="btn btn-primary btn-sm" onclick="showAddDevice()">
                    <i class="fas fa-plus"></i> <span class="btn-text">Add Pin</span>
                </button>
            </div>
        </div>
        
        <div class="content-area">
            <!-- Device Info Bar -->
            <div class="device-info-bar" id="deviceInfoBar" style="display:none;">
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">Device Token</span>
                        <span class="info-value">
                            <code id="projectToken"><?php echo $project['device_token']; ?></code>
                            <button class="btn-icon-sm" onclick="copyText('<?php echo $project['device_token']; ?>')">
                                <i class="fas fa-copy"></i>
                            </button>
                        </span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Dashboard URL</span>
                        <span class="info-value">
                            <code><?php echo SITE_URL; ?>/projects/<?php echo $project['project_slug']; ?></code>
                        </span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">ESP IP</span>
                        <span class="info-value"><?php echo $project['esp_ip'] ?: 'N/A'; ?></span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">WiFi</span>
                        <span class="info-value"><?php echo $project['wifi_ssid'] ?: 'N/A'; ?></span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Signal</span>
                        <span class="info-value"><?php echo $project['rssi'] ? $project['rssi'] . ' dBm' : 'N/A'; ?></span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Free Memory</span>
                        <span class="info-value"><?php echo $project['free_heap'] ? number_format($project['free_heap']) . ' bytes' : 'N/A'; ?></span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Last Seen</span>
                        <span class="info-value" id="lastSeen"><?php echo $project['last_seen'] ?: 'Never'; ?></span>
                    </div>
                </div>
            </div>
            
            <!-- Device Controls -->
            <?php if (empty($devices)): ?>
                <div class="empty-state">
                    <div class="empty-icon">
                        <i class="fas fa-microchip"></i>
                    </div>
                    <h3>No Pins Configured</h3>
                    <p>Add GPIO pins to start controlling your ESP device.</p>
                    <button class="btn btn-primary" onclick="showAddDevice()">
                        <i class="fas fa-plus"></i> Add First Pin
                    </button>
                </div>
            <?php
else: ?>
                <div class="devices-grid" id="devicesGrid">
                    <?php foreach ($devices as $device): ?>
                        <div class="device-card <?php echo $device['pin_type'] === 'graph' ? 'graph-card' : ''; ?>" id="device-<?php echo $device['id']; ?>" data-device-id="<?php echo $device['id']; ?>">
                            <div class="device-card-header">
                                <div class="device-icon <?php echo($device['current_state'] && $device['pin_type'] !== 'graph') ? 'active' : ''; ?>">
                                    <i class="fas fa-<?php echo $device['icon']; ?>"></i>
                                </div>
                                <button class="btn-icon-sm danger" onclick="deleteDevice(<?php echo $device['id']; ?>, '<?php echo addslashes($device['pin_name']); ?>')" title="Delete">
                                    <i class="fas fa-trash-alt"></i>
                                </button>
                            </div>
                            <div class="device-card-body">
                                <h4><?php echo $device['pin_name']; ?></h4>
                                <span class="device-pin-label">GPIO <?php echo $device['gpio_pin']; ?></span>
                                
                                <?php if ($device['pin_type'] === 'graph'): ?>
                                    <div class="graph-container" style="height: 120px; width: 100%; margin-top: 15px;">
                                        <canvas id="chart-<?php echo $device['id']; ?>"></canvas>
                                    </div>
                                <?php
        endif; ?>
                            </div>
                            
                            <?php if ($device['pin_type'] !== 'graph'): ?>
                                <div class="device-card-footer">
                                    <label class="toggle-switch">
                                        <input type="checkbox" 
                                               <?php echo $device['current_state'] ? 'checked' : ''; ?>
                                               onchange="toggleDevice(<?php echo $device['id']; ?>, this.checked ? 1 : 0)"
                                               id="toggle-<?php echo $device['id']; ?>">
                                        <span class="toggle-slider"></span>
                                    </label>
                                    <span class="toggle-label" id="state-<?php echo $device['id']; ?>">
                                        <?php echo $device['current_state'] ? 'ON' : 'OFF'; ?>
                                    </span>
                                </div>
                            <?php
        else: ?>
                                <div class="device-card-footer">
                                    <span style="font-size:0.8rem; color:var(--text-muted);"><i class="fas fa-chart-line"></i> Real-time Sensor Graph</span>
                                    <span class="toggle-label" id="state-<?php echo $device['id']; ?>" style="font-weight:700; font-size:1.1rem; color:var(--primary);">
                                        <?php echo $device['current_state'] ?: '0'; ?>
                                    </span>
                                </div>
                            <?php
        endif; ?>
                        </div>
                    <?php
    endforeach; ?>
                </div>
            <?php
endif; ?>
            
            <!-- Activity Log -->
            <div class="section-header-inline" style="margin-top:30px;">
                <h3><i class="fas fa-history"></i> Recent Activity</h3>
                <button class="btn btn-ghost btn-sm" onclick="refreshLogs()">
                    <i class="fas fa-sync-alt"></i> Refresh
                </button>
            </div>
            <div class="log-container" id="logContainer">
                <div class="log-loading">
                    <i class="fas fa-spinner fa-spin"></i> Loading logs...
                </div>
            </div>
        </div>
    </main>
    
    <!-- Add Device Modal -->
    <div class="modal-overlay" id="addDeviceModal">
        <div class="modal">
            <div class="modal-header">
                <h3><i class="fas fa-plus-circle"></i> Add GPIO Pin</h3>
                <button class="modal-close" onclick="closeModal('addDeviceModal')">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label for="pin_name"><i class="fas fa-tag"></i> Pin Name</label>
                    <input type="text" id="pin_name" placeholder="e.g., Living Room Light">
                </div>
                <div class="form-group">
                    <label for="pin_type"><i class="fas fa-layer-group"></i> Widget Type</label>
                    <select id="pin_type" style="width: 100%; padding: 12px; border: 1px solid var(--border); border-radius: 8px; font-family: 'Inter', sans-serif; background: var(--bg-card); color: var(--text-primary); outline: none;">
                        <option value="output">Switch & Toggle (Output)</option>
                        <option value="graph">Real-time Graph (Analog/Sensor Input)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="gpio_pin"><i class="fas fa-microchip"></i> GPIO Number</label>
                    <input type="number" id="gpio_pin" placeholder="e.g., 2" min="0" max="40">
                    <small>Sensors: A0 (ESP8266) or GPIO 34, 35 (ESP32) are common for graphs.</small>
                </div>
                <div class="form-group">
                    <label for="pin_icon"><i class="fas fa-icons"></i> Icon</label>
                    <div class="icon-selector" id="iconSelector">
                        <button class="icon-option active" data-icon="lightbulb" title="Light"><i class="fas fa-lightbulb"></i></button>
                        <button class="icon-option" data-icon="fan" title="Fan"><i class="fas fa-fan"></i></button>
                        <button class="icon-option" data-icon="plug" title="Plug"><i class="fas fa-plug"></i></button>
                        <button class="icon-option" data-icon="door-open" title="Door"><i class="fas fa-door-open"></i></button>
                        <button class="icon-option" data-icon="bell" title="Bell"><i class="fas fa-bell"></i></button>
                        <button class="icon-option" data-icon="tv" title="TV"><i class="fas fa-tv"></i></button>
                        <button class="icon-option" data-icon="snowflake" title="AC"><i class="fas fa-snowflake"></i></button>
                        <button class="icon-option" data-icon="water" title="Water"><i class="fas fa-water"></i></button>
                        <button class="icon-option" data-icon="car" title="Garage"><i class="fas fa-car"></i></button>
                        <button class="icon-option" data-icon="lock" title="Lock"><i class="fas fa-lock"></i></button>
                        <button class="icon-option" data-icon="bolt" title="Power"><i class="fas fa-bolt"></i></button>
                        <button class="icon-option" data-icon="cog" title="Motor"><i class="fas fa-cog"></i></button>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-ghost" onclick="closeModal('addDeviceModal')">Cancel</button>
                <button class="btn btn-primary" onclick="addDevice()" id="add-device-btn">
                    <i class="fas fa-plus"></i> Add Pin
                </button>
            </div>
        </div>
    </div>
    
    <!-- ESP Code Modal -->
    <div class="modal-overlay" id="espCodeModalProject">
        <div class="modal modal-lg">
            <div class="modal-header">
                <h3><i class="fas fa-code"></i> ESP Arduino Code</h3>
                <button class="modal-close" onclick="closeModal('espCodeModalProject')">&times;</button>
            </div>
            <div class="modal-body">
                <p>Copy this code to Arduino IDE. Update WiFi credentials and upload to your ESP:</p>
                <div class="code-actions">
                    <button class="btn btn-primary btn-sm" onclick="copyEspCodeProject2()">
                        <i class="fas fa-copy"></i> Copy Code
                    </button>
                </div>
                <pre class="code-block" id="espCodeBlockProject"></pre>
            </div>
        </div>
    </div>
    
    <script>
        const PROJECT_ID = <?php echo $project['id']; ?>;
        const PROJECT_TOKEN = '<?php echo $project['device_token']; ?>';
        const PROJECT_NAME = '<?php echo addslashes($project['project_name']); ?>';
        const SITE_URL = '<?php echo SITE_URL; ?>';
        const API_URL = SITE_URL + '/api.php';
        
        let selectedIcon = 'lightbulb';
        let infoVisible = false;
        
        // Modal functions (inline so they work immediately)
        function closeModal(modalId) {
            document.getElementById(modalId).classList.remove('show');
        }
        function showModal(modalId) {
            document.getElementById(modalId).classList.add('show');
        }
        
        // Icon selector
        document.querySelectorAll('.icon-option').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.icon-option').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                selectedIcon = this.dataset.icon;
            });
        });
        
        // Toggle device
        function toggleDevice(deviceId, state) {
            fetch(API_URL + '?action=toggle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ project_id: PROJECT_ID, device_id: deviceId, state: state })
            })
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    const card = document.getElementById('device-' + deviceId);
                    const icon = card.querySelector('.device-icon');
                    const label = document.getElementById('state-' + deviceId);
                    
                    if (state) {
                        icon.classList.add('active');
                        label.textContent = 'ON';
                        label.style.color = '#22c55e';
                    } else {
                        icon.classList.remove('active');
                        label.textContent = 'OFF';
                        label.style.color = '#94a3b8';
                    }
                } else {
                    alert('Error: ' + (data.error || 'Failed to toggle'));
                    // Revert toggle
                    document.getElementById('toggle-' + deviceId).checked = !state;
                }
            })
            .catch(err => {
                alert('Network error. Please try again.');
                document.getElementById('toggle-' + deviceId).checked = !state;
            });
        }
        
        // Add device
        function addDevice() {
            const pinName = document.getElementById('pin_name').value.trim();
            const gpioPin = parseInt(document.getElementById('gpio_pin').value);
            
            if (!pinName || isNaN(gpioPin)) {
                alert('Please fill in all fields');
                return;
            }
            
            const btn = document.getElementById('add-device-btn');
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';
            
            fetch(API_URL + '?action=add_device', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    project_id: PROJECT_ID,
                    pin_name: pinName,
                    gpio_pin: gpioPin,
                    pin_type: document.getElementById('pin_type').value,
                    icon: selectedIcon
                })
            })
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    location.reload();
                } else {
                    alert('Error: ' + (data.error || 'Failed to add device'));
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-plus"></i> Add Pin';
                }
            })
            .catch(err => {
                alert('Network error');
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-plus"></i> Add Pin';
            });
        }
        
        // Delete device
        function deleteDevice(deviceId, name) {
            if (!confirm('Delete "' + name + '"? This cannot be undone.')) return;
            
            fetch(API_URL + '?action=delete_device', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ project_id: PROJECT_ID, device_id: deviceId })
            })
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    document.getElementById('device-' + deviceId).remove();
                } else {
                    alert('Error: ' + (data.error || 'Failed to delete'));
                }
            });
        }
        
        // Show device info
        function showDeviceInfo() {
            infoVisible = !infoVisible;
            document.getElementById('deviceInfoBar').style.display = infoVisible ? 'block' : 'none';
        }
        
        // Show add device modal
        function showAddDevice() {
            document.getElementById('addDeviceModal').classList.add('show');
        }
        
        // Load logs
        function refreshLogs() {
            fetch(API_URL + '?action=logs&project_id=' + PROJECT_ID)
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    const container = document.getElementById('logContainer');
                    if (data.logs.length === 0) {
                        container.innerHTML = '<div class="log-empty">No activity yet</div>';
                        return;
                    }
                    let html = '<div class="log-list">';
                    data.logs.forEach(log => {
                        const time = new Date(log.created_at).toLocaleString();
                        html += `<div class="log-item">
                            <div class="log-icon ${log.source}">
                                <i class="fas fa-${log.source === 'esp' ? 'microchip' : 'globe'}"></i>
                            </div>
                            <div class="log-content">
                                <span class="log-action">${log.action}${log.pin_name ? ': ' + log.pin_name + ' (GPIO ' + log.gpio_pin + ')' : ''}</span>
                                <span class="log-value">${log.value || ''}</span>
                            </div>
                            <div class="log-meta">
                                <span class="log-time">${time}</span>
                                <span class="log-source">${log.source}</span>
                            </div>
                        </div>`;
                    });
                    html += '</div>';
                    container.innerHTML = html;
                }
            })
            .catch(() => {
                document.getElementById('logContainer').innerHTML = '<div class="log-empty">Failed to load logs</div>';
            });
        }
        
        // Show ESP code for this project
        function showEspCodeProject() {
            const code = generateEspCode(PROJECT_TOKEN, PROJECT_NAME);
            document.getElementById('espCodeBlockProject').textContent = code;
            document.getElementById('espCodeModalProject').classList.add('show');
        }
        
        function copyEspCodeProject2() {
            const code = document.getElementById('espCodeBlockProject').textContent;
            navigator.clipboard.writeText(code).then(() => {
                alert('Code copied to clipboard!');
            });
        }
        
        function copyText(text) {
            navigator.clipboard.writeText(text).then(() => {
                alert('Copied!');
            });
        }
        
        // Generate ESP Arduino code (Universal for ESP32 & ESP8266)
        function generateEspCode(token, projectName) {
            var lines = [
'/*',
' * ============================================',
' * Miko IoT Platform (v2.0)',
' * Project: ' + projectName,
' * ============================================',
' *',
' * INSTRUCTIONS:',
' * 1. Install Arduino IDE (https://arduino.cc)',
' * 2. Install Board Support:',
' *    ESP32: Add URL in File > Preferences > Board Manager URLs:',
' *      https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json',
' *    ESP8266: Add URL:',
' *      http://arduino.esp8266.com/stable/package_esp8266com_index.json',
' * 3. Install Library: Sketch > Include Library > Manage Libraries',
' *    > Search "ArduinoJson" > Install',
' * 4. Update YOUR_WIFI_SSID and YOUR_WIFI_PASSWORD below',
' * 5. Select your board: Tools > Board',
' * 6. Upload!',
' *',
' * BOARD SELECTION:',
' *   ESP32:   Tools > Board > ESP32 Dev Module',
' *   ESP8266: Tools > Board > NodeMCU 1.0 (ESP-12E)',
' *',
' * FOR ESP8266 - Change the two includes below:',
' *   #include <WiFi.h>       -->  #include <ESP8266WiFi.h>',
' *   #include <HTTPClient.h> -->  #include <ESP8266HTTPClient.h>',
' *',
' * PIN CONTROL:',
' *   All pins are auto-configured from the server dashboard.',
' *   Just add pins on the web dashboard - no code changes needed!',
' *',
' * SAFE ESP32 GPIO PINS:',
' *   2, 4, 5, 12-19, 21-23, 25-27, 32-33',
' * AVOID: 0(boot), 1(TX), 3(RX), 6-11(flash), 34-39(input only)',
' */',
'',
'// ===== INCLUDES (ESP32) =====',
'// For ESP8266: replace WiFi.h->ESP8266WiFi.h, HTTPClient.h->ESP8266HTTPClient.h, WiFiClientSecure.h->ESP8266WiFiMulti.h',
'#include <WiFi.h>',
'#include <HTTPClient.h>',
'#include <WiFiClientSecure.h>',
'#include <ArduinoJson.h>',
'',
'// ===== CONFIGURATION (UPDATE THESE!) =====',
'const char* WIFI_SSID      = "YOUR_WIFI_SSID";      // <-- Your WiFi name',
'const char* WIFI_PASSWORD   = "YOUR_WIFI_PASSWORD";   // <-- Your WiFi password',
'const char* SERVER_HOST     = "' + SITE_URL.replace('https://', '').replace('http://', '') + '";',
'const char* SERVER_PATH     = "/api.php";',
'const char* DEVICE_TOKEN    = "' + token + '";',
'',
'// Poll interval (how often ESP checks server)',
'const unsigned long POLL_INTERVAL = 3000; // 3 seconds',
'',
'// ===== INTERNAL (DO NOT MODIFY BELOW) =====',
'unsigned long lastPoll = 0;',
'WiFiClientSecure client;',
'',
'// URL encode (handles spaces & special chars in WiFi name)',
'String urlEncode(String str) {',
'    String encoded = "";',
'    for (unsigned int i = 0; i < str.length(); i++) {',
'        char c = str.charAt(i);',
"        if (isAlphaNumeric(c) || c == '-' || c == '_' || c == '.' || c == '~') {",
'            encoded += c;',
"        } else if (c == ' ') {",
'            encoded += "%20";',
'        } else {',
"            encoded += '%';",
"            if (c < 16) encoded += '0';",
'            encoded += String((int)c, HEX);',
'        }',
'    }',
'    return encoded;',
'}',
'',
'void setup() {',
'    Serial.begin(115200);',
'    delay(500);',
'    Serial.println();',
'    Serial.println("=============================");',
'    Serial.println("Miko IoT Platform");',
'    Serial.println("Project: ' + projectName + '");',
'    Serial.println("=============================");',
'',
'    WiFi.mode(WIFI_STA);',
'    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);',
'    Serial.print("Connecting to WiFi: ");',
'    Serial.println(WIFI_SSID);',
'',
'    int attempts = 0;',
'    while (WiFi.status() != WL_CONNECTED && attempts < 40) {',
'        delay(500);',
'        Serial.print(".");',
'        attempts++;',
'    }',
'    Serial.println();',
'',
'    if (WiFi.status() == WL_CONNECTED) {',
'        Serial.println("WiFi Connected!");',
'        Serial.print("IP: "); Serial.println(WiFi.localIP());',
'        Serial.print("Signal: "); Serial.print(WiFi.RSSI());',
'        Serial.println(" dBm");',
'    } else {',
'        Serial.println("WiFi FAILED! Restarting in 5s...");',
'        delay(5000);',
'        ESP.restart();',
'    }',
'',
'    client.setInsecure(); // Skip cert verify (ok for IoT devices)',
'    Serial.println("Ready! Polling server...");',
'    Serial.println();',
'}',
'',
'void loop() {',
'    if (WiFi.status() != WL_CONNECTED) {',
'        Serial.println("WiFi lost! Reconnecting...");',
'        WiFi.reconnect();',
'        delay(5000);',
'        return;',
'    }',
'    if (millis() - lastPoll >= POLL_INTERVAL) {',
'        lastPoll = millis();',
'        pollServer();',
'    }',
'}',
'',
'void pollServer() {',
'    HTTPClient http;',
'',
'    // Build poll URL with WiFi info so the dashboard shows real signal/SSID/memory',
'    String ssid = String(WIFI_SSID);',
'    ssid.replace(" ", "%20"); // Basic space encoding for URL',
'    String path = String(SERVER_PATH)',
'        + "?action=poll&token=" + String(DEVICE_TOKEN)',
'        + "&ssid=" + ssid',
'        + "&rssi=" + String(WiFi.RSSI())',
'        + "&heap=" + String(ESP.getFreeHeap())',
'        + "&ip=" + WiFi.localIP().toString();',
'',
'    // begin() with host+port+path ensures correct SNI for HTTPS',
'    http.begin(client, SERVER_HOST, 443, path, true);',
'    http.addHeader("Accept", "application/json");',
'    http.setTimeout(10000);',
'    int httpCode = http.GET();',
'    Serial.print("[POLL] HTTP "); Serial.println(httpCode);',
'',
'    if (httpCode == HTTP_CODE_OK) {',
'        String payload = http.getString();',
'        JsonDocument doc;',
'        DeserializationError error = deserializeJson(doc, payload);',
'',
'        if (!error && doc["success"] == true) {',
'            JsonObject pins = doc["pins"];',
'            StaticJsonDocument<512> reportDoc;',
'            JsonObject reportPins = reportDoc.createNestedObject("pins");',
'            bool hasSensors = false;',
'',
'            for (JsonPair p : pins) {',
'                int pin = String(p.key().c_str()).toInt();',
'                int state = p.value()["state"].as<int>();',
'                String title = p.value()["name"].as<String>();',
'                String type = p.value()["type"].as<String>();',
'',
'                if (type == "output" || type == "switch" || type == "") {',
'                    pinMode(pin, OUTPUT);',
'                    digitalWrite(pin, state ? HIGH : LOW);',
'                    Serial.print("[OUT] "); Serial.print(title);',
'                    Serial.print(" GPIO"); Serial.print(pin);',
'                    Serial.print(" -> "); Serial.println(state ? "ON" : "OFF");',
'                } else if (type == "graph" || type == "input") {',
'                    pinMode(pin, INPUT);',
'                    int val = analogRead(pin);',
'                    reportPins[String(pin)] = val;',
'                    hasSensors = true;',
'                    Serial.print("[SENSOR] "); Serial.print(title);',
'                    Serial.print(" GPIO"); Serial.print(pin);',
'                    Serial.print(" = "); Serial.println(val);',
'                }',
'            }',
'',
'            if (hasSensors) {',
'                HTTPClient reportHttp;',
'                String rPath = String(SERVER_PATH) + "?action=report&token=" + String(DEVICE_TOKEN);',
'                reportHttp.begin(client, SERVER_HOST, 443, rPath, true);',
'                reportHttp.addHeader("Content-Type", "application/json");',
'                String body;',
'                serializeJson(reportDoc, body);',
'                reportHttp.POST(body);',
'                reportHttp.end();',
'            }',
'        } else if (error) {',
'            Serial.print("[ERR] JSON parse: ");',
'            Serial.println(error.c_str());',
'        } else {',
'            Serial.println("[ERR] success!=true");',
'        }',
'    } else {',
'        String body = http.getString();',
'        Serial.print("[ERR] HTTP code: "); Serial.println(httpCode);',
'        Serial.print("[ERR] Response: "); Serial.println(body.substring(0, 200));',
'    }',
'    http.end();',
'}',
            ];
            return lines.join('\n') + '\n';
        }
        
        // Auto-refresh devices every 3 seconds
        function refreshDevices() {
            fetch(API_URL + '?action=devices&project_id=' + PROJECT_ID)
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    // Update online status
                    const badge = document.querySelector('.status-badge');
                    if (data.project.is_online) {
                        badge.classList.remove('offline');
                        badge.classList.add('online');
                        badge.innerHTML = '<span class="pulse-dot"></span> ESP Online';
                    } else {
                        badge.classList.remove('online');
                        badge.classList.add('offline');
                        badge.innerHTML = '<span class="pulse-dot"></span> ESP Offline';
                    }
                    
                    // Update device states and charts
                    data.devices.forEach(device => {
                        const isGraph = device.pin_type === 'graph';
                        const toggle = document.getElementById('toggle-' + device.id);
                        const stateLabel = document.getElementById('state-' + device.id);
                        const icon = document.querySelector('#device-' + device.id + ' .device-icon');
                        
                        if (isGraph) {
                            if (stateLabel) stateLabel.textContent = device.current_state;
                            
                            // Push new data to chart if exists
                            const chartInstance = charts[device.id];
                            if (chartInstance) {
                                const now = new Date();
                                chartInstance.data.labels.push(now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'}));
                                chartInstance.data.datasets[0].data.push(device.current_state);
                                
                                if (chartInstance.data.labels.length > 20) {
                                    chartInstance.data.labels.shift();
                                    chartInstance.data.datasets[0].data.shift();
                                }
                                chartInstance.update('none'); // Update without animation so it's smooth
                            }
                        } else {
                            if (toggle && !toggle.matches(':active')) {
                                toggle.checked = device.current_state == 1;
                                if (stateLabel) {
                                    stateLabel.textContent = device.current_state == 1 ? 'ON' : 'OFF';
                                    stateLabel.style.color = device.current_state == 1 ? '#22c55e' : '#94a3b8';
                                }
                                if (icon) {
                                    if (device.current_state == 1) {
                                        icon.classList.add('active');
                                    } else {
                                        icon.classList.remove('active');
                                    }
                                }
                            }
                        }
                    });
                    
                    // Update last seen
                    if (data.project.last_seen) {
                        document.getElementById('lastSeen').textContent = new Date(data.project.last_seen).toLocaleString();
                    }
                }
            })
            .catch(() => {});
        }
        
        // Sidebar toggle for mobile
        function toggleSidebar() {
            document.getElementById('sidebar').classList.toggle('open');
            document.getElementById('sidebarOverlay').classList.toggle('show');
        }
        function closeSidebar() {
            document.getElementById('sidebar').classList.remove('open');
            document.getElementById('sidebarOverlay').classList.remove('show');
        }
        
        // Initialize Charts
        const charts = {};
        function initCharts() {
            const graphCards = document.querySelectorAll('.graph-card');
            graphCards.forEach(card => {
                const deviceId = card.dataset.deviceId;
                const canvas = document.getElementById('chart-' + deviceId);
                if (canvas) {
                    const ctx = canvas.getContext('2d');
                    const primaryColor = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? '#22c55e' : '#16a34a';
                    const gridColor = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
                    const textColor = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? '#94a3b8' : '#64748b';

                    charts[deviceId] = new Chart(ctx, {
                        type: 'line',
                        data: {
                            labels: [],
                            datasets: [{
                                label: 'Sensor Value',
                                data: [],
                                borderColor: primaryColor,
                                backgroundColor: primaryColor + '20', // Add transparency
                                borderWidth: 2,
                                fill: true,
                                tension: 0.4,
                                pointRadius: 0,
                                pointHoverRadius: 5
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            animation: false,
                            plugins: {
                                legend: { display: false },
                                tooltip: {
                                    mode: 'index',
                                    intersect: false,
                                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                    titleColor: '#fff',
                                    bodyColor: primaryColor,
                                    borderColor: 'rgba(255,255,255,0.1)',
                                    borderWidth: 1
                                }
                            },
                            scales: {
                                x: {
                                    display: false, // Hide X axis dates for cleaner look
                                    grid: { display: false }
                                },
                                y: {
                                    beginAtZero: true,
                                    grid: { color: gridColor },
                                    ticks: { color: textColor, maxTicksLimit: 5 }
                                }
                            },
                            interaction: { mode: 'nearest', axis: 'x', intersect: false }
                        }
                    });
                    
                    // Fetch historical data
                    fetch(API_URL + '?action=graph_data&device_id=' + deviceId)
                        .then(r => r.json())
                        .then(data => {
                            if (data.success && data.data.length > 0) {
                                const chart = charts[deviceId];
                                data.data.forEach(d => {
                                    const time = new Date(d.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                                    chart.data.labels.push(time);
                                    chart.data.datasets[0].data.push(d.value);
                                });
                                // Keep only last 30
                                if (chart.data.labels.length > 30) {
                                    chart.data.labels = chart.data.labels.slice(-30);
                                    chart.data.datasets[0].data = chart.data.datasets[0].data.slice(-30);
                                }
                                chart.update();
                            }
                        });
                }
            });
        }
        
        // Initialize
        refreshLogs();
        initCharts();
        setInterval(refreshDevices, 3000);
    </script>
    <script src="../assets/js/app.js?v=6"></script>
</body>
</html>
