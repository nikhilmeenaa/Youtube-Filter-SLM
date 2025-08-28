// YouTube Smart Filter - Content Script
/**
 * Enhanced YouTube Filter with ytm-video-with-context-renderer support
 * 
 * Key Features:
 * - Prioritizes ytm-video-with-context-renderer for comprehensive video detail extraction
 * - Extracts thumbnail, title, channel, and description from context renderer structure
 * - Applies targeted blurring to .media-item-thumbnail-container when filtering
 * - Enhanced metadata classification using title, description, and channel information
 * - Improved filtering application for context renderer elements
 * - Support for new categorized filter structure
 */

// Global flag to prevent duplicate initialization
if (window.youtubeSmartFilterLoaded) {
    console.log('🚫 YouTube Smart Filter already loaded, skipping duplicate initialization');
} else {
    window.youtubeSmartFilterLoaded = true;
    console.log('🎬 YouTube Smart Filter script loaded');

class YouTubeFilter {
    constructor() {
        this.classifier = null;
        this.settings = {
            // New categorized structure
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
            hideMode: false,
            mode: 'show'
        };
        this.stats = {
            processed: 0,
            filtered: 0
        };
        this.processedVideos = new Set();
        this.observer = null;
        this.debounceTimer = null;
        
        this.init();
    }

    async init() {
        console.log('🎯 YouTube Smart Filter initialized');
        console.log('📍 Current URL:', window.location.href);
        
        try {
            await this.loadSettings();
            console.log('⚙️ Settings loaded:', this.settings);
            await this.initializeClassifier();
            this.setupMessageListener();
            this.startObserving();
            await this.processExistingVideos();
            
            // Auto-apply filters after processing videos
            console.log('🎯 Auto-applying filters on page load...');
            await this.applyFilters();
            
            // Set up periodic auto-application to catch any missed videos
            setInterval(async () => {
                const unprocessedVideos = this.findUnprocessedVideos();
                if (unprocessedVideos.length > 0) {
                    console.log(`🔄 Found ${unprocessedVideos.length} unprocessed videos, processing...`);
                    await this.processExistingVideos();
                    await this.applyFilters();
                }
            }, 5000); // Check every 5 seconds
            
        } catch (error) {
            console.error('Error initializing YouTube Filter:', error);
            this.sendMessage({ type: 'MODEL_STATUS', status: 'error' });
        }
    }

    async loadSettings() {
        try {
            const result = await chrome.storage.local.get(['filterSettings']);
            if (result.filterSettings) {
                this.settings = this.mergeSettings(this.settings, result.filterSettings);
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    mergeSettings(defaultSettings, savedSettings) {
        const merged = { ...defaultSettings };
        
        // Handle both old and new format settings
        if (savedSettings.categories) {
            // Convert old format to new format
            console.log('🔄 Converting old settings format to new format');
            this.convertOldSettings(savedSettings, merged);
        } else {
            // Merge new format settings
            Object.keys(defaultSettings).forEach(category => {
                if (typeof defaultSettings[category] === 'object' && savedSettings[category]) {
                    merged[category] = { ...defaultSettings[category], ...savedSettings[category] };
                } else if (savedSettings[category] !== undefined) {
                    merged[category] = savedSettings[category];
                }
            });
        }
        
        return merged;
    }

    convertOldSettings(oldSettings, newSettings) {
        // Map old categories to new structure
        const categoryMapping = {
            'educational': ['educational', 'educational'],
            'entertainment': ['entertainment', 'comedy'],
            'news': ['safety', 'news'],
            'technology': ['educational', 'technology'],
            'gaming': ['entertainment', 'gaming'],
            'music': ['entertainment', 'music'],
            'sports': ['entertainment', 'sports'],
            'comedy': ['entertainment', 'comedy']
        };

        Object.keys(oldSettings.categories || {}).forEach(oldCategory => {
            const mapping = categoryMapping[oldCategory];
            if (mapping) {
                const [newCategoryGroup, newFilter] = mapping;
                if (newSettings[newCategoryGroup] && newSettings[newCategoryGroup][newFilter] !== undefined) {
                    newSettings[newCategoryGroup][newFilter] = oldSettings.categories[oldCategory];
                }
            }
        });

        // Copy other settings
        if (oldSettings.mode !== undefined) {
            newSettings.mode = oldSettings.mode;
        }
    }

    async initializeClassifier() {
        this.sendMessage({ type: 'MODEL_STATUS', status: 'loading' });
        
        try {
            // Initialize the transformers loader with real ML models
            if (!this.transformersLoader) {
                this.transformersLoader = new window.TransformersLoader();
            }
            
            // Try to initialize the ML pipeline
            this.classifier = await this.transformersLoader.initialize();
            
            if (this.classifier) {
                console.log('✅ ML models (DistilBERT, BERT, RoBERTa) loaded successfully');
                this.sendMessage({ type: 'MODEL_STATUS', status: 'ready' });
            } else {
                throw new Error('ML models not available');
            }
        } catch (error) {
            console.log('🔄 ML models not available, using enhanced keyword classification');
            // Fallback to enhanced keyword classification
            this.initializeFallbackClassifier();
            this.sendMessage({ type: 'MODEL_STATUS', status: 'ready' });
        }
    }

    initializeFallbackClassifier() {
        console.log('🔄 Using fallback rule-based classifier');
        
        // Enhanced keyword patterns for new categorized structure
        this.categoryKeywords = {
            // Safety & Content
            'adult-content': ['adult', '18+', 'nsfw', 'explicit', 'mature', 'xxx', 'porn', 'sex'],
            'violence': ['violence', 'violent', 'fight', 'war', 'weapon', 'gun', 'blood', 'death', 'kill'],
            'politics': ['politics', 'political', 'election', 'government', 'president', 'congress', 'senate', 'vote'],
            'news': ['news', 'breaking', 'report', 'journalism', 'current events', 'update', 'latest'],
            'religion': ['religion', 'religious', 'church', 'christian', 'islam', 'buddhist', 'hindu', 'prayer'],

            // Entertainment
            'gaming': ['gaming', 'game', 'gameplay', 'streamer', 'twitch', 'xbox', 'playstation', 'nintendo', 'esports'],
            'music': ['music', 'song', 'album', 'artist', 'concert', 'musician', 'band', 'singer', 'lyrics'],
            'movies-tv': ['movie', 'film', 'trailer', 'cinema', 'tv show', 'series', 'episode', 'actor', 'actress'],
            'sports': ['sports', 'football', 'basketball', 'soccer', 'baseball', 'tennis', 'olympics', 'athlete'],
            'comedy': ['comedy', 'funny', 'humor', 'joke', 'laugh', 'comedian', 'stand up', 'meme', 'parody'],
            'beauty-fashion': ['beauty', 'makeup', 'fashion', 'style', 'outfit', 'skincare', 'cosmetics', 'haul'],
            'food-cooking': ['cooking', 'recipe', 'food', 'chef', 'kitchen', 'baking', 'restaurant', 'cuisine'],
            'travel': ['travel', 'vacation', 'trip', 'destination', 'tourism', 'hotel', 'flight', 'adventure'],

            // Educational
            'educational': ['tutorial', 'learn', 'education', 'course', 'lesson', 'guide', 'how to', 'explained'],
            'technology': ['tech', 'technology', 'gadget', 'smartphone', 'computer', 'software', 'ai', 'programming'],
            'business': ['business', 'entrepreneur', 'startup', 'finance', 'investing', 'marketing', 'company'],
            'health-fitness': ['health', 'fitness', 'workout', 'exercise', 'nutrition', 'diet', 'wellness', 'yoga'],
            'science': ['science', 'research', 'experiment', 'biology', 'chemistry', 'physics', 'study'],
            'diy-crafts': ['diy', 'craft', 'handmade', 'tutorial', 'project', 'creative', 'art', 'build'],

            // Lifestyle
            'dating-relationships': ['dating', 'relationship', 'love', 'romance', 'couple', 'marriage', 'boyfriend'],
            'asmr': ['asmr', 'relaxing', 'sleep', 'whisper', 'tingles', 'calm', 'peaceful'],
            'meditation': ['meditation', 'mindfulness', 'spiritual', 'zen', 'peace', 'tranquil', 'inner'],
            'conspiracy': ['conspiracy', 'theory', 'secret', 'hidden', 'truth', 'exposed', 'cover up'],
            'true-crime': ['true crime', 'murder', 'investigation', 'detective', 'case', 'documentary', 'serial'],

            // Outdoor
            'hiking-outdoors': ['hiking', 'outdoors', 'nature', 'camping', 'trail', 'mountain', 'wilderness'],
            'adventure-sports': ['extreme', 'adventure', 'skydiving', 'surfing', 'climbing', 'snowboarding'],
            'hunting-fishing': ['hunting', 'fishing', 'outdoor', 'wildlife', 'angling', 'catch', 'deer'],
            'automotive': ['car', 'automotive', 'vehicle', 'driving', 'racing', 'mechanic', 'engine'],
            'aviation': ['aviation', 'plane', 'aircraft', 'flying', 'pilot', 'airport', 'flight'],

            // Specialized
            'geopolitics': ['geopolitics', 'international', 'global', 'world affairs', 'diplomacy', 'foreign'],
            'cryptocurrency': ['crypto', 'bitcoin', 'blockchain', 'ethereum', 'trading', 'nft', 'defi'],
            'paranormal': ['paranormal', 'ghost', 'supernatural', 'unexplained', 'mystery', 'haunted'],
            'minimalism': ['minimalism', 'minimal', 'simple', 'declutter', 'less', 'organized'],
            'prepping': ['prepping', 'survival', 'emergency', 'preparedness', 'disaster', 'self-reliance']
        };
    }

    setupMessageListener() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            console.log('📬 Received message:', message.type);
            
            switch (message.type) {
                case 'PING':
                    sendResponse({ status: 'active' });
                    return false; // Synchronous response
                
                case 'SETTINGS_UPDATED':
                    console.log('⚙️ Settings updated:', message.settings);
                    this.settings = this.mergeSettings(this.settings, message.settings);
                    this.applyFilters();
                    sendResponse({ success: true, action: 'settings_updated' });
                    return false; // Synchronous response
                
                case 'APPLY_FILTERS':
                    console.log('🔄 Apply filters requested:', message.settings);
                    this.settings = this.mergeSettings(this.settings, message.settings);
                    
                    // Handle async operation properly
                    this.handleApplyFilters(sendResponse);
                    return true; // Indicate async response
                
                case 'REFRESH_VIDEOS':
                    console.log('🔄 Refreshing video processing');
                    if (message.settings) {
                        this.settings = this.mergeSettings(this.settings, message.settings);
                    }
                    
                    // Handle async operation properly
                    this.handleRefreshVideos(sendResponse);
                    return true; // Indicate async response
                
                default:
                    sendResponse({ error: 'Unknown message type' });
                    return false;
            }
        });
    }

    async handleApplyFilters(sendResponse) {
        try {
            console.log('🔄 Starting filter application...');
            await this.applyFilters();
            const response = { 
                success: true, 
                action: 'filters_applied',
                stats: this.stats 
            };
            console.log('✅ Sending apply filters response:', response);
            sendResponse(response);
        } catch (error) {
            console.error('❌ Error applying filters:', error);
            const errorResponse = { 
                success: false, 
                error: error.message 
            };
            console.log('❌ Sending error response:', errorResponse);
            sendResponse(errorResponse);
        }
    }

    async handleRefreshVideos(sendResponse) {
        try {
            console.log('🔄 Starting video refresh...');
            this.processedVideos.clear(); // Clear processed videos to reprocess
            await this.processExistingVideos();
            await this.applyFilters();
            const response = { 
                success: true, 
                action: 'videos_refreshed',
                stats: this.stats 
            };
            console.log('✅ Sending refresh response:', response);
            sendResponse(response);
        } catch (error) {
            console.error('❌ Error refreshing videos:', error);
            const errorResponse = { 
                success: false, 
                error: error.message 
            };
            console.log('❌ Sending error response:', errorResponse);
            sendResponse(errorResponse);
        }
    }

    startObserving() {
        console.log('🔍 Starting video observation...');
        
        // Watch for new videos being loaded with more specific targeting
        this.observer = new MutationObserver((mutations) => {
            let shouldProcess = false;
            
            mutations.forEach(mutation => {
                // Check if new video elements were added
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const element = node;
                        // Check if this is a video element or contains video elements
                        if (element.matches && (
                            element.matches('ytm-video-with-context-renderer, ytd-video-renderer, ytd-grid-video-renderer, ytd-rich-item-renderer') ||
                            element.querySelector('ytm-video-with-context-renderer, ytd-video-renderer, ytd-grid-video-renderer, ytd-rich-item-renderer')
                        )) {
                            shouldProcess = true;
                            console.log('🆕 New video content detected');
                        }
                    }
                });
            });
            
            if (shouldProcess) {
                this.debounceProcessing();
            }
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Also listen for scroll events to catch infinite scroll loading
        let scrollTimer;
        window.addEventListener('scroll', () => {
            clearTimeout(scrollTimer);
            scrollTimer = setTimeout(() => {
                console.log('📜 Scroll detected, checking for new videos...');
                this.debounceProcessing();
            }, 1000);
        }, { passive: true });

        // Also listen for navigation changes
        let lastUrl = location.href;
        new MutationObserver(() => {
            const url = location.href;
            if (url !== lastUrl) {
                lastUrl = url;
                console.log('🔄 YouTube navigation detected, reprocessing videos...');
                setTimeout(async () => {
                    await this.processExistingVideos();
                    await this.applyFilters();
                }, 1000);
            }
        }).observe(document, { subtree: true, childList: true });
    }

    debounceProcessing() {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(async () => {
            await this.processExistingVideos();
            await this.applyFilters();
        }, 500);
    }

    async processExistingVideos() {
        const videoSelectors = [
            // Prioritize ytm-video-with-context-renderer for comprehensive video details
            'ytm-video-with-context-renderer',
            // Desktop YouTube selectors
            'ytd-video-renderer',
            'ytd-grid-video-renderer',
            'ytd-rich-item-renderer',
            'ytd-compact-video-renderer',
            'ytd-shorts-video-renderer',
            'ytd-reel-item-renderer',
            'ytd-playlist-video-renderer',
            // Mobile YouTube selectors
            '.compact-media-item',
            '.media-item',
            '.video-list-item',
            '.compact-video-renderer',
            '.video-renderer',
            // Universal fallbacks
            '[data-context-item-id]',
            'a[href*="/watch?v="]',
            'a[href*="/shorts/"]',
            // Container elements that might hold video info
            'div[class*="video"]',
            'div[class*="media"]'
        ];

        console.log('🔍 Scanning for videos...');
        let totalFound = 0;

        for (const selector of videoSelectors) {
            const videos = document.querySelectorAll(selector);
            if (videos.length > 0) {
                console.log(`📺 Found ${videos.length} videos with selector: ${selector}`);
                totalFound += videos.length;
            }
            
            for (const video of videos) {
                await this.processVideo(video);
            }
        }

        console.log(`📊 Total videos found: ${totalFound}, Processed: ${this.stats.processed}, Filtered: ${this.stats.filtered}`);
        this.updateStats();
    }

    findUnprocessedVideos() {
        const videoSelectors = [
            'ytm-video-with-context-renderer',
            'ytd-video-renderer',
            'ytd-grid-video-renderer',
            'ytd-rich-item-renderer',
            'ytd-compact-video-renderer'
        ];

        const unprocessedVideos = [];
        
        for (const selector of videoSelectors) {
            const videos = document.querySelectorAll(selector);
            videos.forEach(video => {
                if (!video.hasAttribute('data-filter-category')) {
                    const videoId = this.getVideoId(video);
                    if (videoId && !this.processedVideos.has(videoId)) {
                        unprocessedVideos.push(video);
                    }
                }
            });
        }
        
        return unprocessedVideos;
    }

    async processVideo(videoElement) {
        try {
            // Skip if already processed
            const videoId = this.getVideoId(videoElement);
            if (!videoId || this.processedVideos.has(videoId)) {
                return;
            }

            // Extract video metadata
            const metadata = this.extractVideoMetadata(videoElement);
            if (!metadata.title) {
                console.log('⚠️ Skipping video with no title');
                return;
            }

            console.log('🎬 Processing video:', {
                title: metadata.title,
                channel: metadata.channel,
                videoId: videoId
            });

            // Classify the video
            const category = await this.classifyVideo(metadata);
            console.log(`🏷️ Classified as: ${category}`);

            // Mark as processed and store category
            this.processedVideos.add(videoId);
            videoElement.setAttribute('data-filter-category', category);
            
            this.stats.processed++;
            
        } catch (error) {
            console.error('Error processing video:', error);
        }
    }

    getVideoId(element) {
        // Try multiple methods to extract video ID
        const methods = [
            // From href attributes
            () => {
                const link = element.querySelector('a[href*="/watch?v="], a[href*="/shorts/"]') || 
                           (element.tagName === 'A' && element.href);
                if (link) {
                    const href = typeof link === 'string' ? link : link.href;
                    const match = href.match(/(?:watch\?v=|shorts\/)([a-zA-Z0-9_-]{11})/);
                    return match ? match[1] : null;
                }
                return null;
            },
            
            // From data attributes
            () => element.getAttribute('data-context-item-id'),
            () => {
                const dataId = element.getAttribute('data-video-id') || 
                             element.getAttribute('data-id');
                return dataId;
            },
            
            // From nested elements
            () => {
                const thumbnailLink = element.querySelector('[data-video-id]');
                return thumbnailLink ? thumbnailLink.getAttribute('data-video-id') : null;
            },
            
            // Generate unique ID based on title and position if no video ID found
            () => {
                const title = this.extractVideoMetadata(element).title;
                if (title) {
                    return 'generated_' + btoa(title).substring(0, 11);
                }
                return null;
            }
        ];

        for (const method of methods) {
            try {
                const id = method();
                if (id) return id;
            } catch (e) {
                continue;
            }
        }

        return null;
    }

    extractVideoMetadata(videoElement) {
        let metadata = {
            title: '',
            channel: '',
            description: '',
            duration: '',
            views: ''
        };

        try {
            // Check if this is a ytm-video-with-context-renderer (priority method)
            const contextRenderer = videoElement.querySelector('ytm-video-with-context-renderer') || 
                                   (videoElement.tagName?.toLowerCase() === 'ytm-video-with-context-renderer' ? videoElement : null);
            
            if (contextRenderer) {
                console.log('🎯 Extracting from ytm-video-with-context-renderer');
                const contextData = this.extractFromContextRenderer(contextRenderer);
                if (contextData.title) {
                    return contextData;
                }
            }

            // Fallback extraction methods
            const selectors = {
                title: [
                    '#video-title',
                    '.video-title',
                    '[aria-label*="title"]',
                    'h3 a',
                    'h4 a',
                    '.compact-media-item-headline',
                    '.media-item-headline',
                    '.ytm-video-description-headline',
                    '.compact-media-item-metadata .compact-media-item-headline',
                    '[id*="title"]',
                    'a[title]'
                ],
                channel: [
                    '.channel-name',
                    '.ytd-channel-name',
                    '[href*="/channel/"]',
                    '[href*="/@"]',
                    '.compact-media-item-byline',
                    '.media-item-byline',
                    '.ytm-video-description-byline'
                ],
                description: [
                    '.video-description',
                    '.description-text',
                    '.compact-media-item-metadata',
                    '.media-item-metadata'
                ]
            };

            // Extract title
            for (const selector of selectors.title) {
                const element = videoElement.querySelector(selector);
                if (element) {
                    metadata.title = element.textContent?.trim() || element.title?.trim() || element.getAttribute('aria-label')?.trim() || '';
                    if (metadata.title) break;
                }
            }

            // Extract channel
            for (const selector of selectors.channel) {
                const element = videoElement.querySelector(selector);
                if (element) {
                    metadata.channel = element.textContent?.trim() || '';
                    if (metadata.channel) break;
                }
            }

            // Extract description
            for (const selector of selectors.description) {
                const element = videoElement.querySelector(selector);
                if (element) {
                    metadata.description = element.textContent?.trim() || '';
                    if (metadata.description) break;
                }
            }

            // Clean up extracted data
            metadata.title = metadata.title.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
            metadata.channel = metadata.channel.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
            metadata.description = metadata.description.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

        } catch (error) {
            console.error('Error extracting metadata:', error);
        }

        console.log('📊 Extracted metadata:', metadata);
        return metadata;
    }

    extractFromContextRenderer(contextRenderer) {
        const metadata = {
            title: '',
            channel: '',
            description: '',
            duration: '',
            views: ''
        };

        try {
            // Enhanced extraction for ytm-video-with-context-renderer
            console.log('🔍 Analyzing ytm-video-with-context-renderer structure...');

            // Method 1: Direct text content extraction
            const headlineElement = contextRenderer.querySelector('.compact-media-item-headline, .media-item-headline, .ytm-video-description-headline');
            if (headlineElement) {
                metadata.title = headlineElement.textContent?.trim() || '';
                console.log('📝 Title found (headline):', metadata.title);
            }

            // Method 2: Link-based extraction
            if (!metadata.title) {
                const titleLink = contextRenderer.querySelector('a[title], a[aria-label]');
                if (titleLink) {
                    metadata.title = titleLink.title?.trim() || titleLink.getAttribute('aria-label')?.trim() || '';
                    console.log('📝 Title found (link):', metadata.title);
                }
            }

            // Method 3: Comprehensive search
            if (!metadata.title) {
                const possibleTitleElements = contextRenderer.querySelectorAll('h1, h2, h3, h4, h5, h6, [class*="title"], [class*="headline"]');
                for (const element of possibleTitleElements) {
                    const text = element.textContent?.trim();
                    if (text && text.length > 10) { // Reasonable title length
                        metadata.title = text;
                        console.log('📝 Title found (comprehensive):', metadata.title);
                        break;
                    }
                }
            }

            // Extract channel information
            const channelElement = contextRenderer.querySelector('.compact-media-item-byline, .media-item-byline, .ytm-video-description-byline, [href*="/channel/"], [href*="/@"]');
            if (channelElement) {
                metadata.channel = channelElement.textContent?.trim() || '';
                console.log('👤 Channel found:', metadata.channel);
            }

            // Extract additional metadata
            const metadataElements = contextRenderer.querySelectorAll('.compact-media-item-metadata, .media-item-metadata, .ytm-video-meta');
            metadataElements.forEach(element => {
                const text = element.textContent?.trim();
                if (text && !metadata.description) {
                    metadata.description = text;
                }
            });

            // Extract description from context if available
            const descriptionElement = contextRenderer.querySelector('[class*="description"], [class*="snippet"]');
            if (descriptionElement && !metadata.description) {
                metadata.description = descriptionElement.textContent?.trim() || '';
            }

            // Clean and validate
            metadata.title = metadata.title.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
            metadata.channel = metadata.channel.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
            metadata.description = metadata.description.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

            console.log('📊 Context renderer metadata:', {
                title: metadata.title,
                channel: metadata.channel,
                description: metadata.description.substring(0, 100) + '...'
            });

        } catch (error) {
            console.error('Error extracting from context renderer:', error);
        }

        return metadata;
    }

    async classifyVideo(metadata) {
        const text = `${metadata.title} ${metadata.channel} ${metadata.description}`.toLowerCase();
        
        try {
            if (this.classifier) {
                return await this.classifyWithML(text);
            } else {
                return this.classifyWithKeywords(text);
            }
        } catch (error) {
            console.error('Error classifying video:', error);
            return this.classifyWithKeywords(text);
        }
    }

    async classifyWithML(text) {
        try {
            const result = await this.classifier(text);
            if (result && result.length > 0) {
                const classification = result[0];
                console.log(`🎯 ML classification: ${classification.label} (confidence: ${classification.confidence.toFixed(2)}, model: ${classification.model})`);
                return classification.label;
            }
        } catch (error) {
            console.error('ML classification error:', error);
        }
        
        // Fallback to keyword classification
        return this.classifyWithKeywords(text);
    }

    classifyWithKeywords(text) {
        let maxScore = 0;
        let bestCategory = 'entertainment'; // Default category
        
        // Check each category for keyword matches
        Object.keys(this.categoryKeywords).forEach(category => {
            const keywords = this.categoryKeywords[category];
            let score = 0;
            
            keywords.forEach(keyword => {
                if (text.includes(keyword.toLowerCase())) {
                    // Weight longer keywords more heavily
                    score += keyword.length;
                }
            });
            
            if (score > maxScore) {
                maxScore = score;
                bestCategory = category;
            }
        });
        
        console.log(`🎯 Keyword classification: ${bestCategory} (score: ${maxScore})`);
        return bestCategory;
    }

    async applyFilters() {
        console.log('🎯 Applying filters with settings:', this.settings);
        const videos = document.querySelectorAll('[data-filter-category]');
        console.log(`🎬 Found ${videos.length} classified videos to filter`);
        
        let filteredCount = 0;
        
        videos.forEach((video, index) => {
            const category = video.getAttribute('data-filter-category');
            const metadata = this.extractVideoMetadata(video);
            
            if (this.applyFilterToVideo(video, category)) {
                filteredCount++;
                console.log(`🚫 Filtered video ${index + 1}: "${metadata.title}" (${category})`);
            } else {
                console.log(`✅ Showing video ${index + 1}: "${metadata.title}" (${category})`);
            }
        });

        this.stats.filtered = filteredCount;
        console.log(`📊 Filter result: ${filteredCount}/${videos.length} videos filtered`);
        this.updateStats();
    }

    applyFilterToVideo(videoElement, category) {
        // Check if this filter should be applied based on the new settings structure
        const shouldFilter = this.shouldFilterCategory(category);
        
        // Find the specific #content element with the required classes
        const contentElement = videoElement.querySelector('#content.style-scope.ytd-rich-item-renderer');
        
        if (!shouldFilter) {
            // Show video - remove filtered class and overlay
            if (contentElement) {
                contentElement.classList.remove('ysf-filtered');
                contentElement.removeAttribute('data-filter-category');
                
                // Remove any existing overlay
                const existingOverlay = videoElement.querySelector('.ysf-category-overlay');
                if (existingOverlay) {
                    existingOverlay.remove();
                }
            }
            return false;
        } else {
            // Filter video - add filtered class to the #content element
            if (contentElement) {
                contentElement.classList.add('ysf-filtered');
                contentElement.setAttribute('data-filter-category', category.toUpperCase());
                
                // Create unblurred overlay element
                let overlay = videoElement.querySelector('.ysf-category-overlay');
                if (!overlay) {
                    overlay = document.createElement('div');
                    overlay.className = 'ysf-category-overlay';
                    videoElement.style.position = 'relative';
                    videoElement.appendChild(overlay);
                }
                
                overlay.textContent = category.toUpperCase();
                overlay.setAttribute('data-category', category);
                
                console.log(`🎯 Applied blur filter to #content element for category: ${category}`);
                return true;
            } else {
                console.log('❌ No #content.style-scope.ytd-rich-item-renderer element found');
                return false;
            }
        }
    }

    shouldFilterCategory(category) {
        // Find which category group this filter belongs to
        let isFilterSelected = false;
        
        Object.keys(this.settings).forEach(categoryGroup => {
            if (typeof this.settings[categoryGroup] === 'object' && 
                this.settings[categoryGroup][category] !== undefined) {
                isFilterSelected = this.settings[categoryGroup][category];
            }
        });
        
        // Apply filter logic based on mode
        if (this.settings.hideMode) {
            // Hide mode: filter (hide) selected categories
            return isFilterSelected;
        } else {
            // Show mode: show only selected categories (filter everything else)
            // If no filters are selected, show everything
            const hasAnyFiltersSelected = this.hasAnyFiltersSelected();
            if (!hasAnyFiltersSelected) {
                return false; // Show everything if no filters are selected
            }
            return !isFilterSelected; // Filter (hide) unselected categories
        }
    }

    hasAnyFiltersSelected() {
        return Object.keys(this.settings).some(categoryGroup => {
            if (typeof this.settings[categoryGroup] === 'object') {
                return Object.values(this.settings[categoryGroup]).some(value => value === true);
            }
            return false;
        });
    }

    updateStats() {
        chrome.storage.local.set({ filterStats: this.stats });
        this.sendMessage({ 
            type: 'STATS_UPDATE', 
            stats: this.stats 
        });
    }

    sendMessage(message) {
        try {
            chrome.runtime.sendMessage(message);
        } catch (error) {
            // Extension context might be invalid
            console.debug('Could not send message:', error);
        }
    }
}

// Enhanced YouTube SPA-aware initialization system
class YouTubeFilterInitializer {
    constructor() {
        this.filter = null;
        this.initialized = false;
        this.initRetries = 0;
        this.maxRetries = 10;
        this.retryDelay = 1000;
        
        console.log('🚀 YouTube Filter Initializer starting...');
        this.startInitialization();
    }
    
    async startInitialization() {
        // Multiple initialization strategies to ensure it works
        this.setupImmediateInit();
        this.setupDelayedInit();
        this.setupNavigationListener();
        this.setupPeriodicCheck();
        this.setupPageLoadListener();
    }
    
    setupImmediateInit() {
        // Try immediate initialization
        console.log('🔄 Attempting immediate initialization...');
        this.tryInitialize('immediate');
    }
    
    setupDelayedInit() {
        // Try after a short delay to let YouTube load
        setTimeout(() => {
            if (!this.initialized) {
                console.log('🔄 Attempting delayed initialization...');
                this.tryInitialize('delayed');
            }
        }, 1000);
        
        // Additional delays for slower connections
        setTimeout(() => {
            if (!this.initialized) {
                console.log('🔄 Attempting extended delay initialization...');
                this.tryInitialize('extended-delay');
            }
        }, 3000);

        // More aggressive retry for page reloads
        setTimeout(() => {
            if (!this.initialized) {
                console.log('🔄 Attempting final initialization attempt...');
                this.tryInitialize('final-attempt');
            }
        }, 8000);
    }
    
    setupNavigationListener() {
        // Listen for YouTube SPA navigation changes
        let lastUrl = location.href;
        
        const checkForNavigation = () => {
            const currentUrl = location.href;
            if (currentUrl !== lastUrl) {
                lastUrl = currentUrl;
                console.log('🔄 YouTube navigation detected:', currentUrl);
                
                // Re-initialize after navigation with delay
                setTimeout(async () => {
                    await this.tryInitialize('navigation');
                }, 1500);
            }
        };
        
        // Multiple ways to detect navigation
        const observer = new MutationObserver(() => {
            checkForNavigation();
        });
        
        observer.observe(document, { 
            childList: true, 
            subtree: true 
        });
        
        // Also check periodically
        setInterval(checkForNavigation, 3000);
        
        // Listen for popstate events
        window.addEventListener('popstate', () => {
            console.log('🔄 Popstate navigation detected');
            setTimeout(async () => {
                await this.tryInitialize('popstate');
            }, 1000);
        });
    }
    
    setupPageLoadListener() {
        // Listen for page load events
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                console.log('🔄 DOMContentLoaded detected');
                setTimeout(() => this.tryInitialize('dom-loaded'), 500);
            });
        }

        window.addEventListener('load', () => {
            console.log('🔄 Window load detected');
            setTimeout(() => this.tryInitialize('window-loaded'), 1000);
        });

        // Also listen for YouTube-specific events
        document.addEventListener('yt-navigate-finish', () => {
            console.log('🔄 YouTube navigation finish detected');
            setTimeout(() => this.tryInitialize('yt-navigate'), 500);
        });
    }

    setupPeriodicCheck() {
        // Periodic check to ensure the filter stays active
        setInterval(() => {
            if (this.initialized && this.filter) {
                // Check if we're still on YouTube and the filter is working
                if (location.hostname === 'www.youtube.com' || location.hostname === 'm.youtube.com') {
                    const videos = document.querySelectorAll('[data-filter-category]');
                    if (videos.length === 0) {
                        console.log('🔄 No classified videos found, re-processing...');
                        this.filter.processExistingVideos().then(() => {
                            this.filter.applyFilters();
                        });
                    }
                }
            } else if (!this.initialized) {
                this.tryInitialize('periodic-check');
            }
        }, 15000); // Check every 15 seconds (more frequent)
    }
    
    async tryInitialize(source) {
        if (this.initialized) {
            return;
        }
        
        try {
            console.log(`🔄 Initializing filter (${source})...`);
            
            // Check if we're on YouTube
            if (!location.hostname.includes('youtube.com')) {
                console.log('❌ Not on YouTube, skipping initialization');
                return;
            }
            
            // Check if DOM is ready
            if (document.readyState === 'loading') {
                console.log('⏳ DOM still loading, waiting...');
                if (this.initRetries < this.maxRetries) {
                    this.scheduleRetry(source);
                }
                return;
            }
            
            // Check for basic YouTube elements
            const youtubeElements = document.querySelectorAll('ytd-app, ytm-app, #app, #content');
            if (youtubeElements.length === 0) {
                console.log('⏳ YouTube app not ready, waiting...');
                if (this.initRetries < this.maxRetries) {
                    this.scheduleRetry(source);
                }
                return;
            }
            
            // Initialize the filter
            this.filter = new YouTubeFilter();
            this.initialized = true;
            this.initRetries = 0;
            
            console.log(`✅ YouTube Filter initialized successfully via ${source}`);
            
        } catch (error) {
            console.error(`❌ Initialization failed (${source}):`, error);
            
            if (this.initRetries < this.maxRetries) {
                this.scheduleRetry(source);
            } else {
                console.error('❌ Max initialization retries reached');
            }
        }
    }
    
    scheduleRetry(source) {
        this.initRetries++;
        console.log(`🔄 Scheduling retry ${this.initRetries}/${this.maxRetries} for ${source}...`);
        
        setTimeout(() => {
            this.tryInitialize(`${source}-retry-${this.initRetries}`);
        }, this.retryDelay);
    }
}

// Start the initialization process
new YouTubeFilterInitializer();

} 