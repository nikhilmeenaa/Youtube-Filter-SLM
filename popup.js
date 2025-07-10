// YouTube Smart Filter - Enhanced Popup Script
class EnhancedPopupController {
    constructor() {
        this.filterSettings = {
            // Major Categories
            safety: {
                'adult-content': false,
                'violence': false,
                'politics': false,
                'news': false,
                'religion': false
            },
            entertainment: {
                'gaming': false,
                'music': false,
                'movies-tv': false,
                'sports': false,
                'comedy': false,
                'beauty-fashion': false,
                'food-cooking': false,
                'travel': false
            },
            educational: {
                'educational': false,
                'technology': false,
                'business': false,
                'health-fitness': false,
                'science': false,
                'diy-crafts': false
            },
            // Niche Categories
            lifestyle: {
                'dating-relationships': false,
                'asmr': false,
                'meditation': false,
                'conspiracy': false,
                'true-crime': false
            },
            outdoor: {
                'hiking-outdoors': false,
                'adventure-sports': false,
                'hunting-fishing': false,
                'automotive': false,
                'aviation': false
            },
            specialized: {
                'geopolitics': false,
                'cryptocurrency': false,
                'paranormal': false,
                'minimalism': false,
                'prepping': false
            },
            mode: 'show', // 'show' or 'hide'
            hideMode: false // New toggle for hide mode
        };
        
        this.stats = {
            processed: 0,
            filtered: 0,
            activeFilters: 0,
            accuracy: 0
        };
        
        this.expandedCategories = new Set();
        this.init();
    }

    async init() {
        await this.loadSettings();
        this.setupEventListeners();
        this.updateUI();
        this.checkExtensionStatus();
        this.loadStats();
        this.updateActiveFiltersCount();
    }

    async loadSettings() {
        try {
            const result = await chrome.storage.local.get(['filterSettings', 'expandedCategories']);
            if (result.filterSettings) {
                this.filterSettings = this.mergeSettings(this.filterSettings, result.filterSettings);
            }
            if (result.expandedCategories) {
                this.expandedCategories = new Set(result.expandedCategories);
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    mergeSettings(defaultSettings, savedSettings) {
        const merged = { ...defaultSettings };
        
        // Merge category settings
        Object.keys(defaultSettings).forEach(category => {
            if (typeof defaultSettings[category] === 'object' && savedSettings[category]) {
                merged[category] = { ...defaultSettings[category], ...savedSettings[category] };
            } else if (savedSettings[category] !== undefined) {
                merged[category] = savedSettings[category];
            }
        });
        
        return merged;
    }

    async saveSettings() {
        try {
            await chrome.storage.local.set({ 
                filterSettings: this.filterSettings,
                expandedCategories: Array.from(this.expandedCategories)
            });
            
            // Notify content script
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs[0] && tabs[0].url.includes('youtube.com')) {
                try {
                    await this.sendMessageToTab(tabs[0].id, {
                        type: 'SETTINGS_UPDATED',
                        settings: this.filterSettings
                    });
                } catch (error) {
                    console.error('Error notifying content script:', error);
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
                this.stats = { ...this.stats, ...result.filterStats };
                this.updateStats();
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }

    setupEventListeners() {
        this.setupQuickActions();
        this.setupCategoryExpansion();
        this.setupFilterToggles();
        this.setupCategoryToggles();
        this.setupActionButtons();
        this.setupMessageListener();
    }

    setupQuickActions() {
        // Select All button
        document.getElementById('select-all').addEventListener('click', () => {
            this.selectAllFilters(true);
        });

        // Clear All button
        document.getElementById('clear-all').addEventListener('click', () => {
            this.selectAllFilters(false);
        });

        // Hide mode toggle
        document.getElementById('hide-mode').addEventListener('change', (e) => {
            this.filterSettings.hideMode = e.target.checked;
            this.updateModeLabels();
            this.saveSettings();
        });
    }

    setupCategoryExpansion() {
        const expandButtons = document.querySelectorAll('.expand-btn');
        expandButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const targetId = button.dataset.target;
                this.toggleCategory(targetId, button);
            });
        });

        const categoryHeaders = document.querySelectorAll('.category-header');
        categoryHeaders.forEach(header => {
            header.addEventListener('click', () => {
                const expandBtn = header.querySelector('.expand-btn');
                const targetId = expandBtn.dataset.target;
                this.toggleCategory(targetId, expandBtn);
            });
        });
    }

    setupFilterToggles() {
        const filterCheckboxes = document.querySelectorAll('.filter-item input[type="checkbox"]');
        filterCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const filter = e.target.dataset.filter;
                const category = this.findCategoryForFilter(filter);
                
                if (category) {
                    this.filterSettings[category][filter] = e.target.checked;
                    this.updateCategoryCheckbox(category);
                    this.updateActiveFiltersCount();
                    this.saveSettings();
                }
            });
        });
    }

    setupCategoryToggles() {
        const categoryCheckboxes = document.querySelectorAll('.category-checkbox');
        categoryCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const categoryId = checkbox.id.replace('-all', '');
                const isChecked = e.target.checked;
                
                this.toggleCategoryFilters(categoryId, isChecked);
                this.updateActiveFiltersCount();
                this.saveSettings();
            });
        });
    }

    setupActionButtons() {
        document.getElementById('apply-filters').addEventListener('click', () => {
            this.applyFilters();
        });

        document.getElementById('reset-filters').addEventListener('click', () => {
            this.resetFilters();
        });
    }

    setupMessageListener() {
        chrome.runtime.onMessage.addListener((message) => {
            if (message.type === 'STATS_UPDATE') {
                this.stats = { ...this.stats, ...message.stats };
                this.updateStats();
            } else if (message.type === 'MODEL_STATUS') {
                this.updateModelStatus(message.status);
            }
        });
    }

    toggleCategory(targetId, button) {
        const filterList = document.getElementById(targetId);
        const isExpanded = this.expandedCategories.has(targetId);
        
        if (isExpanded) {
            filterList.classList.remove('expanded');
            filterList.classList.add('collapsed');
            button.classList.remove('expanded');
            this.expandedCategories.delete(targetId);
        } else {
            filterList.classList.remove('collapsed');
            filterList.classList.add('expanded');
            button.classList.add('expanded');
            this.expandedCategories.add(targetId);
        }
        
        // Save expanded state
        chrome.storage.local.set({ expandedCategories: Array.from(this.expandedCategories) });
    }

    findCategoryForFilter(filter) {
        for (const [category, filters] of Object.entries(this.filterSettings)) {
            if (typeof filters === 'object' && filters.hasOwnProperty(filter)) {
                return category;
            }
        }
        return null;
    }

    toggleCategoryFilters(category, isChecked) {
        if (this.filterSettings[category]) {
            Object.keys(this.filterSettings[category]).forEach(filter => {
                this.filterSettings[category][filter] = isChecked;
                
                // Update individual filter checkboxes
                const checkbox = document.querySelector(`input[data-filter="${filter}"]`);
                if (checkbox) {
                    checkbox.checked = isChecked;
                }
            });
        }
    }

    updateCategoryCheckbox(category) {
        const categoryCheckbox = document.getElementById(`${category}-all`);
        if (categoryCheckbox && this.filterSettings[category]) {
            const filters = Object.values(this.filterSettings[category]);
            const allChecked = filters.every(Boolean);
            const someChecked = filters.some(Boolean);
            
            categoryCheckbox.checked = allChecked;
            categoryCheckbox.indeterminate = someChecked && !allChecked;
        }
    }

    selectAllFilters(select) {
        Object.keys(this.filterSettings).forEach(category => {
            if (typeof this.filterSettings[category] === 'object') {
                this.toggleCategoryFilters(category, select);
                this.updateCategoryCheckbox(category);
            }
        });
        this.updateActiveFiltersCount();
        this.saveSettings();
    }

    updateUI() {
        // Update filter checkboxes
        Object.keys(this.filterSettings).forEach(category => {
            if (typeof this.filterSettings[category] === 'object') {
                Object.keys(this.filterSettings[category]).forEach(filter => {
                    const checkbox = document.querySelector(`input[data-filter="${filter}"]`);
                    if (checkbox) {
                        checkbox.checked = this.filterSettings[category][filter];
                    }
                });
                this.updateCategoryCheckbox(category);
            }
        });

        // Update hide mode toggle
        document.getElementById('hide-mode').checked = this.filterSettings.hideMode;
        
        // Update mode labels
        this.updateModeLabels();

        // Restore expanded categories
        this.expandedCategories.forEach(categoryId => {
            const filterList = document.getElementById(categoryId);
            const button = document.querySelector(`[data-target="${categoryId}"]`);
            if (filterList && button) {
                filterList.classList.add('expanded');
                filterList.classList.remove('collapsed');
                button.classList.add('expanded');
            }
        });
    }

    updateModeLabels() {
        const showLabel = document.getElementById('show-label');
        const hideLabel = document.getElementById('hide-label');
        const helpText = document.getElementById('mode-help-text');

        if (this.filterSettings.hideMode) {
            // Hide mode is ON
            showLabel.classList.remove('active');
            hideLabel.classList.add('active');
            if (helpText) {
                helpText.textContent = 'Selected categories will be hidden from view';
            }
        } else {
            // Show mode is ON (default)
            showLabel.classList.add('active');
            hideLabel.classList.remove('active');
            if (helpText) {
                helpText.textContent = 'Only videos from selected categories will be shown';
            }
        }
    }

    updateActiveFiltersCount() {
        let count = 0;
        Object.keys(this.filterSettings).forEach(category => {
            if (typeof this.filterSettings[category] === 'object') {
                count += Object.values(this.filterSettings[category]).filter(Boolean).length;
            }
        });
        
        this.stats.activeFilters = count;
        document.getElementById('active-filters').textContent = count;
        
        // Update apply button text
        const applyButton = document.getElementById('apply-filters');
        applyButton.textContent = count > 0 ? `Apply ${count} Filters` : 'Apply Filters';
    }

    updateStats() {
        document.getElementById('processed-count').textContent = this.stats.processed || 0;
        document.getElementById('filtered-count').textContent = this.stats.filtered || 0;
        document.getElementById('active-filters').textContent = this.stats.activeFilters || 0;
        
        if (this.stats.processed > 0) {
            const accuracy = Math.round((this.stats.filtered / this.stats.processed) * 100);
            document.getElementById('accuracy-rate').textContent = `${accuracy}%`;
        } else {
            document.getElementById('accuracy-rate').textContent = '--';
        }
    }

    updateModelStatus(status) {
        const statusElement = document.getElementById('model-status');
        const statusIndicator = document.getElementById('status-indicator');
        const statusText = document.getElementById('status-text');
        
        switch (status) {
            case 'loading':
                statusElement.textContent = 'Loading AI classifier...';
                statusText.textContent = 'Initializing...';
                statusIndicator.className = 'status-dot';
                break;
            case 'ready':
                statusElement.textContent = 'AI classifier ready';
                statusText.textContent = 'Active';
                statusIndicator.className = 'status-dot active';
                break;
            case 'error':
                statusElement.textContent = 'Extension error';
                statusText.textContent = 'Error';
                statusIndicator.className = 'status-dot';
                break;
            case 'processing':
                statusElement.textContent = 'Analyzing content...';
                statusText.textContent = 'Processing...';
                statusIndicator.className = 'status-dot';
                break;
        }
    }

    async applyFilters() {
        const button = document.getElementById('apply-filters');
        button.classList.add('loading');
        button.textContent = 'Applying...';
        
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs[0] && tabs[0].url.includes('youtube.com')) {
                const response = await this.sendMessageToTab(tabs[0].id, {
                    type: 'APPLY_FILTERS',
                    settings: this.filterSettings
                });
                
                if (response && response.success) {
                    this.showNotification('Filters applied successfully!');
                    setTimeout(() => {
                        this.loadStats();
                    }, 1000);
                }
            } else {
                this.showNotification('Please navigate to YouTube first');
            }
        } catch (error) {
            console.error('Error applying filters:', error);
            this.showNotification('Error applying filters');
        } finally {
            button.classList.remove('loading');
            this.updateActiveFiltersCount(); // Restore button text
        }
    }

    resetFilters() {
        // Reset all filters to false
        Object.keys(this.filterSettings).forEach(category => {
            if (typeof this.filterSettings[category] === 'object') {
                Object.keys(this.filterSettings[category]).forEach(filter => {
                    this.filterSettings[category][filter] = false;
                });
            }
        });
        
        this.filterSettings.hideMode = false;
        this.updateUI();
        this.updateActiveFiltersCount();
        this.saveSettings();
        this.showNotification('All filters reset');
    }

    async sendMessageToTab(tabId, message) {
        return new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(tabId, message, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(response);
                }
            });
        });
    }

    showNotification(message) {
        // Create or update notification
        let notification = document.querySelector('.notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.className = 'notification';
            document.body.appendChild(notification);
        }
        
        notification.textContent = message;
        notification.style.display = 'block';
        
        setTimeout(() => {
            notification.style.display = 'none';
        }, 3000);
    }

    async checkExtensionStatus() {
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs[0] && tabs[0].url.includes('youtube.com')) {
                try {
                    await this.sendMessageToTab(tabs[0].id, { type: 'PING' });
                    this.updateModelStatus('ready');
                } catch (error) {
                    this.updateModelStatus('error');
                    // Try to inject content script
                    await this.tryInjectContentScript(tabs[0].id);
                }
            } else {
                this.updateModelStatus('error');
            }
        } catch (error) {
            console.error('Error checking extension status:', error);
            this.updateModelStatus('error');
        }
    }

    async tryInjectContentScript(tabId) {
        try {
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['content.js']
            });
            
            // Wait a bit and check again
            setTimeout(async () => {
                try {
                    await this.sendMessageToTab(tabId, { type: 'PING' });
                    this.updateModelStatus('ready');
                } catch (error) {
                    this.updateModelStatus('error');
                }
            }, 1000);
        } catch (error) {
            console.error('Error injecting content script:', error);
            this.updateModelStatus('error');
        }
    }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new EnhancedPopupController();
});

// Add notification styles
const notificationStyle = document.createElement('style');
notificationStyle.textContent = `
.notification {
    position: fixed;
    top: 20px;
    right: 20px;
    background: #667eea;
    color: white;
    padding: 12px 16px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    z-index: 1000;
    display: none;
    animation: slideIn 0.3s ease;
}

@keyframes slideIn {
    from {
        opacity: 0;
        transform: translateX(100%);
    }
    to {
        opacity: 1;
        transform: translateX(0);
    }
}
`;
document.head.appendChild(notificationStyle); 