// YouTube Smart Filter - Popup Script
class PopupController {
    constructor() {
        this.filterSettings = {
            categories: {
                educational: true,
                entertainment: true,
                news: false,
                technology: false,
                gaming: false,
                music: false,
                sports: false,
                comedy: false
            },
            mode: 'show' // 'show' or 'hide'
        };
        this.stats = {
            processed: 0,
            filtered: 0
        };
        this.init();
    }

    async init() {
        await this.loadSettings();
        this.setupEventListeners();
        this.updateUI();
        this.checkExtensionStatus();
        this.loadStats();
    }

    async loadSettings() {
        try {
            const result = await chrome.storage.local.get(['filterSettings']);
            if (result.filterSettings) {
                this.filterSettings = { ...this.filterSettings, ...result.filterSettings };
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    async saveSettings() {
        try {
            await chrome.storage.local.set({ filterSettings: this.filterSettings });
            // Notify content script about changes
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs[0] && tabs[0].url.includes('youtube.com')) {
                try {
                    const response = await new Promise((resolve, reject) => {
                        chrome.tabs.sendMessage(tabs[0].id, {
                            type: 'SETTINGS_UPDATED',
                            settings: this.filterSettings
                        }, (response) => {
                            if (chrome.runtime.lastError) {
                                reject(new Error(chrome.runtime.lastError.message));
                            } else {
                                resolve(response);
                            }
                        });
                    });
                    
                    if (response && response.success) {
                        console.log('⚙️ Settings updated successfully');
                    }
                } catch (error) {
                    console.error('Error notifying content script about settings:', error);
                }
            }
        } catch (error) {
            console.error('Error saving settings:', error);
        }
    }

    async loadStats() {
        try {
            const result = await chrome.storage.local.get(['filterStats']);
            if (result.filterStats) {
                this.stats = result.filterStats;
                this.updateStats();
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }

    setupEventListeners() {
        // Category checkboxes
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                this.filterSettings.categories[e.target.id] = e.target.checked;
                this.saveSettings();
                this.updateFilterCount();
            });
        });

        // Filter mode radio buttons
        const radioButtons = document.querySelectorAll('input[name="filterMode"]');
        radioButtons.forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.filterSettings.mode = e.target.value;
                this.saveSettings();
            });
        });

        // Action buttons
        document.getElementById('apply-filters').addEventListener('click', () => {
            this.applyFilters();
        });

        document.getElementById('reset-filters').addEventListener('click', () => {
            this.resetFilters();
        });

        // Listen for messages from content script
        chrome.runtime.onMessage.addListener((message) => {
            if (message.type === 'STATS_UPDATE') {
                this.stats = message.stats;
                this.updateStats();
            } else if (message.type === 'MODEL_STATUS') {
                this.updateModelStatus(message.status);
            }
        });
    }

    updateUI() {
        // Update checkboxes
        Object.keys(this.filterSettings.categories).forEach(category => {
            const checkbox = document.getElementById(category);
            if (checkbox) {
                checkbox.checked = this.filterSettings.categories[category];
            }
        });

        // Update radio buttons
        document.querySelector(`input[value="${this.filterSettings.mode}"]`).checked = true;
        
        this.updateFilterCount();
    }

    updateFilterCount() {
        const selectedCount = Object.values(this.filterSettings.categories).filter(Boolean).length;
        const totalCount = Object.keys(this.filterSettings.categories).length;
        
        // Update button text to show active filters
        const applyButton = document.getElementById('apply-filters');
        applyButton.textContent = `Apply Filters (${selectedCount}/${totalCount})`;
    }

    updateStats() {
        document.getElementById('processed-count').textContent = this.stats.processed;
        document.getElementById('filtered-count').textContent = this.stats.filtered;
    }

    updateModelStatus(status) {
        const statusElement = document.getElementById('model-status');
        const statusIndicator = document.getElementById('status-indicator');
        const statusText = document.getElementById('status-text');
        
        switch (status) {
            case 'loading':
                statusElement.textContent = 'Loading classifier...';
                statusText.textContent = 'Initializing...';
                statusIndicator.className = 'status-dot';
                break;
            case 'ready':
                statusElement.textContent = 'Keyword classifier ready';
                statusText.textContent = 'Ready';
                statusIndicator.className = 'status-dot active';
                break;
            case 'error':
                statusElement.textContent = 'Extension not loaded';
                statusText.textContent = 'Error';
                statusIndicator.className = 'status-dot';
                break;
            case 'processing':
                statusElement.textContent = 'Processing videos...';
                statusText.textContent = 'Processing...';
                statusIndicator.className = 'status-dot';
                break;
        }
    }

    async applyFilters() {
        const button = document.getElementById('apply-filters');
        button.classList.add('loading');
        
        try {
            // Get current tab
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs[0] && tabs[0].url.includes('youtube.com')) {
                console.log('🔄 Sending apply filters message to content script');
                
                // Send message to content script to apply filters and wait for response
                const response = await new Promise((resolve, reject) => {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        type: 'APPLY_FILTERS',
                        settings: this.filterSettings
                    }, (response) => {
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message));
                        } else {
                            resolve(response);
                        }
                    });
                });
                
                if (response && response.success) {
                    console.log('✅ Filters applied successfully:', response);
                    // Update stats if provided
                    if (response.stats) {
                        this.stats = response.stats;
                        this.updateStats();
                    }
                    
                    // Show success feedback and keep it
                    button.textContent = '✓ Filters Applied';
                    button.style.backgroundColor = '#4caf50';
                    
                    // Reset button after 3 seconds
                    setTimeout(() => {
                        button.style.backgroundColor = '';
                        this.updateFilterCount();
                    }, 3000);
                } else {
                    throw new Error(response?.error || 'Unknown error applying filters');
                }
                
            } else {
                this.showNotification('Please navigate to YouTube first');
            }
        } catch (error) {
            console.error('Error applying filters:', error);
            this.showNotification('Error applying filters: ' + error.message);
            
            // Reset button on error
            button.textContent = 'Apply Filters';
            button.style.backgroundColor = '';
        } finally {
            button.classList.remove('loading');
        }
    }

    resetFilters() {
        // Reset all categories to unchecked except educational and entertainment
        this.filterSettings.categories = {
            educational: true,
            entertainment: true,
            news: false,
            technology: false,
            gaming: false,
            music: false,
            sports: false,
            comedy: false
        };
        this.filterSettings.mode = 'show';
        
        this.updateUI();
        this.saveSettings();
        
        // Reset stats
        this.stats = { processed: 0, filtered: 0 };
        chrome.storage.local.set({ filterStats: this.stats });
        this.updateStats();
        
        this.showNotification('Filters reset');
    }

    async checkExtensionStatus() {
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs[0] && tabs[0].url.includes('youtube.com')) {
                console.log('🔍 Checking extension status on:', tabs[0].url);
                
                // Try to ping content script with retry logic
                await this.pingContentScriptWithRetry(tabs[0].id, 3);
            } else {
                this.updateModelStatus('error');
                this.updateExtensionStatus('Navigate to YouTube to use filters');
            }
        } catch (error) {
            console.error('Error checking status:', error);
            this.updateModelStatus('error');
            this.updateExtensionStatus('Error checking extension status');
        }
    }

    async pingContentScriptWithRetry(tabId, maxRetries = 3) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`📡 Attempting to ping content script (attempt ${attempt}/${maxRetries})`);
                
                const response = await new Promise((resolve, reject) => {
                    chrome.tabs.sendMessage(tabId, { type: 'PING' }, (response) => {
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message));
                        } else {
                            resolve(response);
                        }
                    });
                });

                if (response && response.status === 'active') {
                    console.log('✅ Content script is active');
                    this.updateModelStatus('ready');
                    this.updateExtensionStatus('✅ Active on this page');
                    
                    // Now try to refresh videos
                    await this.refreshVideosWithFallback(tabId);
                    return; // Success, exit retry loop
                }
            } catch (error) {
                console.log(`❌ Ping attempt ${attempt} failed:`, error.message);
                
                if (attempt === maxRetries) {
                    // All retries failed
                    this.updateModelStatus('error');
                    this.updateExtensionStatus('❌ Content script not responding');
                    
                    // Try to inject the content script
                    await this.tryInjectContentScript(tabId);
                } else {
                    // Wait before next retry
                    this.updateExtensionStatus(`🔄 Connecting... (${attempt}/${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
        }
    }

    async tryInjectContentScript(tabId) {
        try {
            console.log('🔧 Attempting to inject content script...');
            this.updateExtensionStatus('🔧 Injecting content script...');
            
            // Try to inject the content script manually
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['transformers-loader.js', 'content.js']
            });
            
            await chrome.scripting.insertCSS({
                target: { tabId: tabId },
                files: ['content.css']
            });
            
            // Wait a moment for injection to complete
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Try pinging again
            await this.pingContentScriptWithRetry(tabId, 2);
            
        } catch (error) {
            console.error('Failed to inject content script:', error);
            this.updateExtensionStatus('❌ Failed to load extension');
        }
    }

    async refreshVideosWithFallback(tabId) {
        try {
            const refreshResponse = await new Promise((resolve, reject) => {
                chrome.tabs.sendMessage(tabId, { 
                    type: 'REFRESH_VIDEOS',
                    settings: this.filterSettings 
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve(response);
                    }
                });
            });
            
            if (refreshResponse && refreshResponse.success && refreshResponse.stats) {
                this.stats = refreshResponse.stats;
                this.updateStats();
                console.log('📊 Stats updated from refresh:', this.stats);
            }
        } catch (error) {
            console.log('⚠️ Could not refresh videos:', error.message);
            // Don't show error to user - extension is working, just couldn't refresh
        }
    }

    updateExtensionStatus(message) {
        const statusText = document.getElementById('status-text');
        const modelStatus = document.getElementById('model-status');
        
        if (statusText) {
            statusText.textContent = message;
        }
        if (modelStatus) {
            modelStatus.textContent = message;
        }
    }

    showNotification(message) {
        // Create a temporary notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            background: #333;
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            font-size: 12px;
            z-index: 1000;
            animation: slideIn 0.3s ease;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PopupController();
});

// Add slide-in animation styles
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(-50%) translateY(-20px); opacity: 0; }
        to { transform: translateX(-50%) translateY(0); opacity: 1; }
    }
`;
document.head.appendChild(style); 