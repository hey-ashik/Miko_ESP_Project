/**
 * ESP IoT Cloud Control Platform
 * Main JavaScript
 */

// Toggle Sidebar
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('open');
    sidebar.classList.toggle('collapsed');
}

// Close sidebar on mobile when clicking outside
document.addEventListener('click', function (e) {
    const sidebar = document.getElementById('sidebar');
    if (sidebar && sidebar.classList.contains('open')) {
        if (!sidebar.contains(e.target) && !e.target.classList.contains('mobile-menu-btn')) {
            sidebar.classList.remove('open');
        }
    }
});

// Modal Functions
function showModal(modalId) {
    document.getElementById(modalId).classList.add('show');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
}

// Close modal on overlay click
document.addEventListener('click', function (e) {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('show');
    }
});

// Close modal on ESC
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.show').forEach(function (modal) {
            modal.classList.remove('show');
        });
    }
});

// Dropdown Menu Toggle
function toggleMenu(projectId) {
    document.querySelectorAll('.dropdown-menu.show').forEach(function (menu) {
        menu.classList.remove('show');
    });
    var menu = document.getElementById('menu-' + projectId);
    menu.classList.toggle('show');
}

// Close dropdown on click outside
document.addEventListener('click', function (e) {
    if (!e.target.closest('.project-actions-menu')) {
        document.querySelectorAll('.dropdown-menu.show').forEach(function (menu) {
            menu.classList.remove('show');
        });
    }
});

// Show Create Project Modal
function showCreateProject() {
    showModal('createProjectModal');
}

// Create Project
function createProject() {
    var name = document.getElementById('project_name').value.trim();
    var slug = document.getElementById('project_slug').value.trim();
    var desc = document.getElementById('project_desc').value.trim();

    if (!name || !slug) {
        alert('Please fill in project name and folder name');
        return;
    }

    var btn = document.getElementById('create-project-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';

    fetch('api.php?action=create_project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            project_name: name,
            project_slug: slug,
            description: desc
        })
    })
        .then(function (r) { return r.json(); })
        .then(function (data) {
            if (data.success) {
                alert('Project created successfully!\n\nDevice Token: ' + data.device_token +
                    '\n\nDashboard URL: ' + data.dashboard_url +
                    '\n\nCopy the device token and add it to your ESP code.');
                location.reload();
            } else {
                alert('Error: ' + (data.error || 'Failed to create project'));
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-plus"></i> Create Project';
            }
        })
        .catch(function (err) {
            alert('Network error. Please try again.');
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-plus"></i> Create Project';
        });
}

// Delete Project
function deleteProject(projectId, projectName) {
    if (!confirm('Delete project "' + projectName + '"?\n\nThis will remove all devices and logs. This cannot be undone!')) {
        return;
    }

    fetch('api.php?action=delete_project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId })
    })
        .then(function (r) { return r.json(); })
        .then(function (data) {
            if (data.success) {
                var card = document.getElementById('project-' + projectId);
                if (card) {
                    card.style.animation = 'fadeOut 0.3s ease';
                    setTimeout(function () { card.remove(); }, 300);
                }
            } else {
                alert('Error: ' + (data.error || 'Failed to delete'));
            }
        });
}

// Show Token Modal
function showToken(projectId, token) {
    document.getElementById('tokenValue').textContent = token;
    showModal('tokenModal');
}

// Copy Token
function copyToken() {
    var token = document.getElementById('tokenValue').textContent;
    navigator.clipboard.writeText(token).then(function () {
        alert('Token copied to clipboard!');
    });
}

// Copy API Key
function copyApiKey(apiKey) {
    navigator.clipboard.writeText(apiKey).then(function () {
        alert('API Key copied to your clipboard!');
    });
}

// Show ESP Code Modal
function showEspCode(projectId, token, projectName) {
    var code = generateEspCode(token, projectName);
    document.getElementById('espCodeBlock').textContent = code;
    showModal('espCodeModal');
}

// Copy ESP Code
function copyEspCode() {
    var code = document.getElementById('espCodeBlock').textContent;
    navigator.clipboard.writeText(code).then(function () {
        alert('Code copied to clipboard!');
    });
}

// Generate ESP Arduino Code (Universal for ESP32 & ESP8266)
function generateEspCode(token, projectName) {
    var siteUrl = typeof SITE_URL !== 'undefined' ? SITE_URL : 'https://esp.ashikone.com';
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
