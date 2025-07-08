// YouTube Smart Filter - Background Script (Service Worker)
class BackgroundService {
    constructor() {
        this.init();
    }

    init() {
        this.setupInstallHandler();
        this.setupMessageHandlers();
        this.setupTabUpdateHandlers();
        console.log('🚀 YouTube Smart Filter background service initialized');
    }

    setupInstallHandler() {
        chrome.runtime.onInstalled.addListener((details) => {
            if (details.reason === 'install') {
                this.handleFirstInstall();
            } else if (details.reason === 'update') {
                this.handleUpdate(details.previousVersion);
            }
        });
    }

    async handleFirstInstall() {
        console.log('📦 Extension installed for the first time');
        
        // Set default settings
        const defaultSettings = {
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
            mode: 'show'
        };

        const defaultStats = {
            processed: 0,
            filtered: 0,
            installDate: Date.now()
        };

        try {
            await chrome.storage.local.set({
                filterSettings: defaultSettings,
                filterStats: defaultStats
            });

            // Show welcome notification
            this.showWelcomeNotification();
        } catch (error) {
            console.error('Error setting default values:', error);
        }
    }

    async handleUpdate(previousVersion) {
        console.log(`📈 Extension updated from ${previousVersion}`);
        
        try {
            // Migrate settings if needed
            const result = await chrome.storage.local.get(['filterSettings']);
            if (result.filterSettings) {
                // Add any new categories that might have been added in updates
                const updatedSettings = {
                    ...result.filterSettings,
                    categories: {
                        educational: true,
                        entertainment: true,
                        news: false,
                        technology: false,
                        gaming: false,
                        music: false,
                        sports: false,
                        comedy: false,
                        ...result.filterSettings.categories
                    }
                };
                
                await chrome.storage.local.set({ filterSettings: updatedSettings });
            }
        } catch (error) {
            console.error('Error during update migration:', error);
        }
    }

    setupMessageHandlers() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true; // Keep message channel open for async responses
        });
    }

    async handleMessage(message, sender, sendResponse) {
        try {
            switch (message.type) {
                case 'GET_SETTINGS':
                    const settings = await this.getSettings();
                    sendResponse({ success: true, settings });
                    break;

                case 'SAVE_SETTINGS':
                    await this.saveSettings(message.settings);
                    sendResponse({ success: true });
                    break;

                case 'GET_STATS':
                    const stats = await this.getStats();
                    sendResponse({ success: true, stats });
                    break;

                case 'UPDATE_STATS':
                    await this.updateStats(message.stats);
                    sendResponse({ success: true });
                    break;

                case 'RESET_STATS':
                    await this.resetStats();
                    sendResponse({ success: true });
                    break;

                case 'MODEL_STATUS':
                    // Forward model status updates to popup if open
                    this.forwardToPopup(message);
                    break;

                case 'STATS_UPDATE':
                    // Forward stats updates to popup if open
                    this.forwardToPopup(message);
                    break;

                default:
                    console.warn('Unknown message type:', message.type);
                    sendResponse({ success: false, error: 'Unknown message type' });
            }
        } catch (error) {
            console.error('Error handling message:', error);
            sendResponse({ success: false, error: error.message });
        }
    }

    setupTabUpdateHandlers() {
        // Listen for tab updates to YouTube
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            if (changeInfo.status === 'complete' && tab.url && tab.url.includes('youtube.com')) {
                this.handleYouTubeTabUpdate(tabId, tab);
            }
        });

        // Listen for tab activation
        chrome.tabs.onActivated.addListener(async (activeInfo) => {
            try {
                const tab = await chrome.tabs.get(activeInfo.tabId);
                if (tab.url && tab.url.includes('youtube.com')) {
                    this.handleYouTubeTabActivated(activeInfo.tabId, tab);
                }
            } catch (error) {
                // Tab might be closed or inaccessible
                console.debug('Could not get tab info:', error);
            }
        });
    }

    async handleYouTubeTabUpdate(tabId, tab) {
        try {
            console.log('🔄 YouTube tab updated:', tab.url);
            
            // Wait a moment for the page to settle
            setTimeout(async () => {
                await this.ensureContentScriptActive(tabId);
            }, 1000);
            
        } catch (error) {
            console.debug('Error handling YouTube tab update:', error);
        }
    }

    async ensureContentScriptActive(tabId) {
        try {
            // First, try to ping the existing content script
            const response = await chrome.tabs.sendMessage(tabId, { type: 'PING' });
            if (response && response.status === 'active') {
                console.log('✅ Content script already active on tab', tabId);
                return;
            }
        } catch (error) {
            console.log('📡 Content script not responding, will re-inject');
        }
        
        try {
            // Re-inject the content script files
            console.log('🔧 Re-injecting content script on tab', tabId);
            
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['transformers-loader.js', 'content.js']
            });
            
            await chrome.scripting.insertCSS({
                target: { tabId: tabId },
                files: ['content.css']
            });
            
            console.log('✅ Content script re-injected successfully');
            
            // Wait a moment, then send current settings
            setTimeout(async () => {
                try {
                    const settings = await this.getSettings();
                    await chrome.tabs.sendMessage(tabId, {
                        type: 'SETTINGS_UPDATED',
                        settings: settings
                    });
                    console.log('⚙️ Settings sent to reactivated content script');
                } catch (error) {
                    console.debug('Could not send settings to reactivated script:', error);
                }
            }, 2000);
            
        } catch (error) {
            console.error('❌ Failed to re-inject content script:', error);
        }
    }

    async handleYouTubeTabActivated(tabId, tab) {
        // Refresh settings in content script when user switches to YouTube tab
        try {
            const settings = await this.getSettings();
            chrome.tabs.sendMessage(tabId, {
                type: 'SETTINGS_UPDATED',
                settings: settings
            });
        } catch (error) {
            console.debug('Could not send settings to tab:', error);
        }
    }

    async getSettings() {
        try {
            const result = await chrome.storage.local.get(['filterSettings']);
            return result.filterSettings || this.getDefaultSettings();
        } catch (error) {
            console.error('Error getting settings:', error);
            return this.getDefaultSettings();
        }
    }

    async saveSettings(settings) {
        try {
            await chrome.storage.local.set({ filterSettings: settings });
            
            // Notify all YouTube tabs about the settings change
            const tabs = await chrome.tabs.query({ url: ['*://www.youtube.com/*', '*://youtube.com/*'] });
            for (const tab of tabs) {
                try {
                    chrome.tabs.sendMessage(tab.id, {
                        type: 'SETTINGS_UPDATED',
                        settings: settings
                    });
                } catch (error) {
                    console.debug('Could not send message to tab:', tab.id, error);
                }
            }
        } catch (error) {
            console.error('Error saving settings:', error);
            throw error;
        }
    }

    async getStats() {
        try {
            const result = await chrome.storage.local.get(['filterStats']);
            return result.filterStats || { processed: 0, filtered: 0 };
        } catch (error) {
            console.error('Error getting stats:', error);
            return { processed: 0, filtered: 0 };
        }
    }

    async updateStats(newStats) {
        try {
            await chrome.storage.local.set({ filterStats: newStats });
        } catch (error) {
            console.error('Error updating stats:', error);
            throw error;
        }
    }

    async resetStats() {
        try {
            const resetStats = { 
                processed: 0, 
                filtered: 0,
                resetDate: Date.now()
            };
            await chrome.storage.local.set({ filterStats: resetStats });
        } catch (error) {
            console.error('Error resetting stats:', error);
            throw error;
        }
    }

    async forwardToPopup(message) {
        try {
            // Try to send message to popup
            chrome.runtime.sendMessage(message);
        } catch (error) {
            // Popup might not be open
            console.debug('Could not forward message to popup:', error);
        }
    }

    getDefaultSettings() {
        return {
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
            mode: 'show'
        };
    }

    async showWelcomeNotification() {
        try {
            // Create a notification to welcome users
            if (chrome.notifications) {
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: 'icons/icon48.png',
                    title: 'YouTube Smart Filter',
                    message: 'Welcome! Visit YouTube and click the extension icon to start filtering videos.'
                });
            }
        } catch (error) {
            console.debug('Could not show notification:', error);
        }
    }

    // Context menu setup (optional feature)
    setupContextMenus() {
        try {
            chrome.contextMenus.create({
                id: 'open-filter-settings',
                title: 'Open YouTube Filter Settings',
                contexts: ['page'],
                documentUrlPatterns: ['*://www.youtube.com/*', '*://youtube.com/*']
            });

            chrome.contextMenus.onClicked.addListener((info, tab) => {
                if (info.menuItemId === 'open-filter-settings') {
                    chrome.action.openPopup();
                }
            });
        } catch (error) {
            console.debug('Could not setup context menus:', error);
        }
    }

    // Cleanup on extension unload
    cleanup() {
        if (this.observer) {
            this.observer.disconnect();
        }
    }
}

// Initialize background service
const backgroundService = new BackgroundService();

// Handle extension unload
chrome.runtime.onSuspend.addListener(() => {
    backgroundService.cleanup();
});

// Global error handler
self.addEventListener('error', (event) => {
    console.error('Background script error:', event.error);
});

// Keep service worker alive
chrome.runtime.onStartup.addListener(() => {
    console.log('🔄 Extension startup');
}); 