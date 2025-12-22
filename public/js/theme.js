/**
 * =============================================================================
 * THEME TOGGLE
 * =============================================================================
 * Dark/Light mode toggle dengan localStorage persistence
 */

(function() {
    'use strict';

    // Get saved theme atau default ke dark
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);

    console.log(`[Theme] 🎨 Current theme: ${savedTheme}`);
})();

/**
 * Toggle antara dark dan light theme
 */
function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    console.log(`[Theme] 🎨 Theme switched to: ${newTheme}`);
}
