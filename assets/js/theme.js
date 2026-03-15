/**
 * ESP IoT Cloud - Theme Manager
 * Handles dark/light mode switching with localStorage persistence
 */

(function () {
    'use strict';

    // Get saved theme or default to 'light'
    function getTheme() {
        return localStorage.getItem('esp-theme') || 'light';
    }

    // Apply theme to document
    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('esp-theme', theme);
        updateToggleIcons(theme);
    }

    // Update all toggle button icons on page
    function updateToggleIcons(theme) {
        document.querySelectorAll('.theme-toggle').forEach(function (btn) {
            var icon = btn.querySelector('i');
            if (icon) {
                icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
            }
        });
    }

    // Toggle between light and dark
    window.toggleTheme = function () {
        var current = getTheme();
        var next = current === 'dark' ? 'light' : 'dark';
        applyTheme(next);
    };

    // Apply saved theme immediately (before DOM loads to prevent flash)
    applyTheme(getTheme());

    // Re-apply after DOM loads (for toggle icons)
    document.addEventListener('DOMContentLoaded', function () {
        updateToggleIcons(getTheme());
    });
})();
