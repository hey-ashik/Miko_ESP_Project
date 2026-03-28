# Signal - IoT Cloud Control Platform

![Signal IoT Platform](https://esp.ashikone.com/IMGFolder/1.png)

**Signal** is a sophisticated, all-in-one IoT cloud platform designed specifically for ESP32 and ESP8266 devices. It enables users to control hardware from anywhere in the world without the need for complex port forwarding, static IPs, or external VPNs. With a focus on user experience and AI-driven development, Signal makes IoT accessible to both hobbyists and professionals.

---

## 🚀 Key Features

- **🌐 Global Control**: Access and toggle your ESP devices from any browser, anywhere in the world.
- **🤖 AI Code Editor**: Built-in AI assistant to generate custom Arduino code for your specific IoT needs.
- **⚡ Web Serial Flasher**: Upload code directly to your ESP32/ESP8266 via the browser—no Arduino IDE required!
- **📊 Real-time Dashboard**: Monitor device health, online/offline status, WiFi signal (RSSI), and memory usage.
- **📱 Android Integration**: Manage your entire IoT ecosystem on the go with the dedicated Signal Android App.
- **🔒 Secure Architecture**: Token-based authentication for projects and custom API keys for users.
- **📜 Activity Logs**: Comprehensive logs tracking every interaction, state change, and connection event.
- **🌗 Modern UI**: Beautiful, responsive dashboard with automatic Dark and Light mode support.

---

## 🛠️ Self-Hosting Setup

To deploy Signal on your own server (e.g., cPanel, VPS, or local XAMPP), follow these steps:

### 1. Prerequisites
- PHP 7.4 or higher
- MySQL/MariaDB database
- SSL certificate (Highly recommended for Web Serial API)

### 2. Configuration
1. Clone the repository to your web server:
   ```bash
   git clone https://github.com/your-username/Signal_IoT_Projects.git
   ```
2. Open `config.php` and update the database credentials:
   ```php
   define('DB_HOST', 'localhost');
   define('DB_NAME', 'your_database_name');
   define('DB_USER', 'your_database_user');
   define('DB_PASS', 'your_database_password');
   define('SITE_URL', 'https://your-domain.com');
   ```

### 3. Database Initialization
1. Navigate to `https://your-domain.com/setup.php` in your browser.
2. This will automatically create all necessary tables (`users`, `projects`, `devices`, `device_logs`, `esp_heartbeat`).
3. **IMPORTANT**: Delete `setup.php` from your server immediately after completion.

---

## 📖 How to Get Started

### Step 1: Create an Account
Visit the registration page and create your Signal account. Once logged in, you'll receive a unique **User API Key** which defines your account's cloud access.

### Step 2: Create a New Project
In the dashboard, click on **"New Project"**. Provide a name (e.g., "Smart Home") and a unique folder slug. Signal will generate a **32-character Device Token** specifically for this project.

### Step 3: Get the Code
Signal simplifies the hardware side:
- **Auto-Generated Code**: Each project provides a "Copy ESP Code" button with your token and server URL pre-configured.
- **AI Code Generation**: Use the **AI Code Editor** to describe your project (e.g., *"Make a 4-channel relay controller with a DHT11 sensor"*). The AI will generate the full Arduino source code for you.

### Step 4: Flash Your Device
You have two options to get the code onto your ESP:
1. **Arduino IDE**: Copy the generated code, paste it into Arduino IDE, and upload via USB.
2. **Web Upload**: Go to the **"Upload Code"** section on the Signal dashboard. Select your COM port and flash the firmware directly from your browser using the Web Serial API.

---

## 🧠 AI Code Editor & Web Flashing

### AI-Powered Intelligence
The **AI Code Editor** is integrated directly into the platform. It understands the Signal API structure and can generate production-ready code for:
- Relay control & Home Automation
- Sensor monitoring (Temperature, Humidity, Ultrasonic, etc.)
- Custom logic based on your hardware attachments.

### No-Install Flashing
Our **Web Serial Terminal** allows you to communicate with your ESP device directly from Chrome or Edge. You can monitor serial logs and upload pre-compiled binaries or scripts without installing any local drivers or software.

---

## 📱 Mobile App
Take your IoT project everywhere. Download the **Signal Android App** (`SignalApp.apk`) directly from the dashboard to handle projects and toggle pins with a mobile-optimized interface.

---

## 💻 Tech Stack
- **Frontend**: Vanilla JavaScript (ES6+), Inter Font, FontAwesome, CSS3 (Glassmorphism).
- **Backend**: PHP 7.4+, PDO (PHP Data Objects).
- **Real-time**: Ajax Poll (Dashboard Auto-Refresh) & Web Serial API.
- **Database**: MySQL / MariaDB.

---

## 👨‍💻 Developer
Developed with ❤️ by **Ashikul Islam**.

*Empowering the world of IoT, one device at a time.*

---
© 2026 Signal IoT Platform. All rights reserved.
