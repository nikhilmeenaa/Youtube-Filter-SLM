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
            
        } catch (error) {
            console.error('Error initializing YouTube Filter:', error);
            this.sendMessage({ type: 'MODEL_STATUS', status: 'error' });
        }
    }

    async loadSettings() {
        try {
            const result = await chrome.storage.local.get(['filterSettings']);
            if (result.filterSettings) {
                this.settings = { ...this.settings, ...result.filterSettings };
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    async initializeClassifier() {
        this.sendMessage({ type: 'MODEL_STATUS', status: 'loading' });
        
        try {
            // Initialize the transformers loader
            if (!this.transformersLoader) {
                this.transformersLoader = new window.TransformersLoader();
            }
            
            // Try to initialize the ML pipeline
            this.classifier = await this.transformersLoader.initialize();
            
            if (this.classifier) {
                console.log('✅ AI model loaded successfully');
                this.sendMessage({ type: 'MODEL_STATUS', status: 'ready' });
            } else {
                throw new Error('AI model not available');
            }
        } catch (error) {
            console.log('🔄 AI model not available, using keyword-based classification');
            // Fallback to rule-based classification
            this.initializeFallbackClassifier();
            this.sendMessage({ type: 'MODEL_STATUS', status: 'ready' });
        }
    }

    initializeFallbackClassifier() {
        console.log('🔄 Using fallback rule-based classifier');
        
        // Define keyword patterns for each category
        this.categoryKeywords = {
            educational: [
                'tutorial', 'learn', 'education', 'course', 'lesson', 'guide', 'how to',
                'explained', 'science', 'math', 'history', 'programming', 'coding',
                'lecture', 'university', 'school', 'study', 'teaching', 'instructor'
            ],
            entertainment: [
                'funny', 'comedy', 'entertainment', 'movie', 'film', 'trailer',
                'celebrity', 'gossip', 'drama', 'reality', 'show', 'series'
            ],
            news: [
                'news', 'breaking', 'report', 'journalism', 'politics', 'election',
                'government', 'world', 'update', 'latest', 'current events'
            ],
            technology: [
                'tech', 'technology', 'gadget', 'smartphone', 'computer', 'software',
                'ai', 'artificial intelligence', 'robot', 'innovation', 'startup',
                'programming', 'coding', 'developer', 'app', 'digital'
            ],
            gaming: [
                'gaming', 'game', 'gameplay', 'streamer', 'twitch', 'xbox', 'playstation',
                'nintendo', 'esports', 'gamer', 'video game', 'pc gaming'
            ],
            music: [
                'music', 'song', 'album', 'artist', 'concert', 'performance',
                'musician', 'band', 'singer', 'lyrics', 'audio', 'sound'
            ],
            sports: [
                'sports', 'football', 'basketball', 'soccer', 'baseball', 'tennis',
                'olympics', 'fitness', 'workout', 'athlete', 'team', 'match'
            ],
            comedy: [
                'comedy', 'funny', 'humor', 'joke', 'laugh', 'comedian',
                'stand up', 'meme', 'parody', 'satire', 'sketch'
            ]
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
                    this.settings = message.settings;
                    this.applyFilters();
                    sendResponse({ success: true, action: 'settings_updated' });
                    return false; // Synchronous response
                
                case 'APPLY_FILTERS':
                    console.log('🔄 Apply filters requested:', message.settings);
                    this.settings = message.settings;
                    
                    // Handle async operation properly
                    this.handleApplyFilters(sendResponse);
                    return true; // Indicate async response
                
                case 'REFRESH_VIDEOS':
                    console.log('🔄 Refreshing video processing');
                    this.settings = message.settings;
                    
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
            await this.processExistingVideos();
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
        // Watch for new videos being loaded
        this.observer = new MutationObserver((mutations) => {
            this.debounceProcessing();
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Also listen for navigation changes
        let lastUrl = location.href;
        new MutationObserver(() => {
            const url = location.href;
            if (url !== lastUrl) {
                lastUrl = url;
                setTimeout(() => this.processExistingVideos(), 1000);
            }
        }).observe(document, { subtree: true, childList: true });
    }

    debounceProcessing() {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
            this.processExistingVideos();
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
            
            // Store classification result
            videoElement.setAttribute('data-filter-category', category);
            this.processedVideos.add(videoId);
            this.stats.processed++;

            // Apply current filter
            const wasFiltered = this.applyFilterToVideo(videoElement, category);
            if (wasFiltered) {
                console.log(`🚫 Video filtered out (${category})`);
            } else {
                console.log(`✅ Video shown (${category})`);
            }

        } catch (error) {
            console.error('Error processing video:', error);
        }
    }

    getVideoId(element) {
        // Try to extract video ID from various sources
        const linkSelectors = [
            'a[href*="/watch?v="]',
            'a[href*="/shorts/"]',
            'a[href*="youtube.com/watch"]'
        ];
        
        for (const selector of linkSelectors) {
            const link = element.querySelector(selector);
            if (link) {
                try {
                    if (link.href.includes('/shorts/')) {
                        // Extract from shorts URL: /shorts/VIDEO_ID
                        const match = link.href.match(/\/shorts\/([a-zA-Z0-9_-]+)/);
                        if (match) return match[1];
                    } else {
                        // Extract from regular watch URL
                        const url = new URL(link.href, window.location.origin);
                        const videoId = url.searchParams.get('v');
                        if (videoId) return videoId;
                    }
                } catch (error) {
                    console.debug('Error parsing video URL:', error);
                }
            }
        }
        
        // Fallback: try to extract from data attributes
        const dataId = element.getAttribute('data-context-item-id') || 
                     element.getAttribute('data-video-id');
        if (dataId) return dataId;
        
        return null;
    }

    extractVideoMetadata(videoElement) {
        // Check if this is a ytm-video-with-context-renderer for enhanced extraction
        const isContextRenderer = videoElement.tagName?.toLowerCase() === 'ytm-video-with-context-renderer' || 
                                 videoElement.closest('ytm-video-with-context-renderer');
        
        if (isContextRenderer) {
            console.log('🎯 Processing ytm-video-with-context-renderer for comprehensive details');
            return this.extractFromContextRenderer(videoElement.tagName?.toLowerCase() === 'ytm-video-with-context-renderer' ? videoElement : videoElement.closest('ytm-video-with-context-renderer'));
        }

        // Fallback to comprehensive selectors for other video elements
        const titleSelectors = [
            // Desktop selectors
            '#video-title',
            '.ytd-video-meta-block #video-title', 
            'h3 a',
            '.video-title',
            'a[aria-describedby]',
            '.ytd-rich-grid-media #video-title',
            '.ytd-compact-video-renderer #video-title',
            'yt-formatted-string[aria-label]',
            '.style-scope.ytd-video-renderer #video-title',
            // Mobile selectors
            '.media-item-headline',
            '.compact-media-item-headline', 
            '.video-title-link',
            'h4 a',
            '.details h4 a',
            '.metadata h4 a',
            'a[title]',
            '.compact-media-item-metadata a'
        ];
        
        const channelSelectors = [
            // Desktop selectors
            '#channel-name',
            '.ytd-video-meta-block #channel-name',
            '.ytd-channel-name a',
            'ytd-channel-name a',
            '.ytd-video-owner-renderer a',
            '.ytd-video-meta-block .ytd-channel-name a',
            // Mobile selectors
            '.media-item-info a',
            '.compact-media-item-info a',
            '.channel-name',
            '.details .channel-name',
            '.metadata .channel-name',
            '.byline a',
            '.compact-media-item-byline a'
        ];
        
        const descriptionSelectors = [
            // Desktop selectors
            '#description-text',
            '.description-snippet',
            '.metadata-snippet-text',
            '.style-scope.ytd-video-meta-block .description-snippet',
            // Mobile selectors
            '.media-item-snippet',
            '.compact-media-item-snippet',
            '.description',
            '.details .description',
            '.metadata .description'
        ];
        
        let titleElement = null;
        let channelElement = null; 
        let descriptionElement = null;
        
        // Try each selector until we find content
        for (const selector of titleSelectors) {
            titleElement = videoElement.querySelector(selector);
            if (titleElement && titleElement.textContent.trim()) break;
        }
        
        for (const selector of channelSelectors) {
            channelElement = videoElement.querySelector(selector);
            if (channelElement && channelElement.textContent.trim()) break;
        }
        
        for (const selector of descriptionSelectors) {
            descriptionElement = videoElement.querySelector(selector);
            if (descriptionElement && descriptionElement.textContent.trim()) break;
        }
        
        const metadata = {
            title: titleElement?.textContent?.trim() || '',
            channel: channelElement?.textContent?.trim() || '',
            description: descriptionElement?.textContent?.trim() || '',
            thumbnail: null // No thumbnail extraction for non-context-renderer elements
        };
        
        // Fallback: if no title found, try to extract from link text or any text content
        if (!metadata.title) {
            // Try to get title from the actual link text
            const linkElement = videoElement.querySelector('a[href*="/watch"], a[href*="/shorts"]');
            if (linkElement && linkElement.textContent.trim()) {
                metadata.title = linkElement.textContent.trim();
                console.log('📝 Extracted title from link text:', metadata.title);
            } else {
                // Last resort: try to extract meaningful text from the element
                const allText = videoElement.textContent?.trim();
                if (allText && allText.length > 10) {
                    // Take first meaningful line as title
                    const lines = allText.split('\n').filter(line => line.trim().length > 5);
                    if (lines.length > 0) {
                        metadata.title = lines[0].trim().substring(0, 100);
                        console.log('📝 Extracted title from text content:', metadata.title);
                    }
                }
            }
        }
        
        // Debug logging for metadata extraction
        if (!metadata.title) {
            console.log('⚠️ Could not extract title from video element');
            console.log('Element HTML:', videoElement.outerHTML.substring(0, 200));
            console.log('Available text content:', videoElement.textContent?.substring(0, 100));
        } else {
            console.log('✅ Extracted metadata:', { 
                title: metadata.title.substring(0, 50) + '...', 
                channel: metadata.channel,
                hasDescription: !!metadata.description 
            });
        }
        
        return metadata;
    }

    extractFromContextRenderer(contextRenderer) {
        console.log('🔍 Extracting comprehensive details from ytm-video-with-context-renderer');
        
        // Extract thumbnail
        const thumbnailSelectors = [
            '.media-item-thumbnail-container img',
            'ytm-thumbnail-cover img',
            '.video-thumbnail-img',
            '.yt-core-image',
            'img[src*="ytimg.com"]',
            'img'
        ];
        
        let thumbnailElement = null;
        for (const selector of thumbnailSelectors) {
            thumbnailElement = contextRenderer.querySelector(selector);
            if (thumbnailElement && thumbnailElement.src) break;
        }
        
        // Extract title with enhanced selectors for context renderer
        const titleSelectors = [
            '.media-item-headline a',
            '.media-item-headline',
            '.compact-media-item-headline a',
            '.compact-media-item-headline',
            'h4 a',
            'h3 a',
            '.details h4 a',
            '.metadata h4 a',
            'a[title]',
            'yt-formatted-string',
            '.video-title-link'
        ];
        
        let titleElement = null;
        for (const selector of titleSelectors) {
            titleElement = contextRenderer.querySelector(selector);
            if (titleElement && titleElement.textContent?.trim()) break;
        }
        
        // Extract channel with enhanced selectors
        const channelSelectors = [
            '.media-item-info a',
            '.compact-media-item-info a',
            '.media-channel a',
            '.channel-name a',
            '.details .channel-name',
            '.metadata .channel-name',
            '.byline a',
            '.compact-media-item-byline a',
            'ytm-badge-and-byline-renderer a',
            '.ytm-badge-and-byline-renderer a'
        ];
        
        let channelElement = null;
        for (const selector of channelSelectors) {
            channelElement = contextRenderer.querySelector(selector);
            if (channelElement && channelElement.textContent?.trim()) break;
        }
        
        // Extract description/snippet
        const descriptionSelectors = [
            '.media-item-snippet',
            '.compact-media-item-snippet',
            '.description',
            '.details .description',
            '.metadata .description',
            '.video-snippet',
            '.description-snippet'
        ];
        
        let descriptionElement = null;
        for (const selector of descriptionSelectors) {
            descriptionElement = contextRenderer.querySelector(selector);
            if (descriptionElement && descriptionElement.textContent?.trim()) break;
        }
        
        const metadata = {
            title: titleElement?.textContent?.trim() || titleElement?.getAttribute('title')?.trim() || '',
            channel: channelElement?.textContent?.trim() || '',
            description: descriptionElement?.textContent?.trim() || '',
            thumbnail: thumbnailElement?.src || null,
            hasContextRenderer: true
        };
        
        console.log('✅ Extracted comprehensive metadata from context renderer:', {
            title: metadata.title.substring(0, 50) + '...',
            channel: metadata.channel,
            hasDescription: !!metadata.description,
            hasThumbnail: !!metadata.thumbnail,
            thumbnailUrl: metadata.thumbnail ? metadata.thumbnail.substring(0, 50) + '...' : 'none'
        });
        
        return metadata;
    }

    async classifyVideo(metadata) {
        // Enhanced text extraction for classification including channel info
        const text = `${metadata.title} ${metadata.description} ${metadata.channel}`.toLowerCase();
        
        console.log('🔍 Classifying video with enhanced metadata:', {
            hasTitle: !!metadata.title,
            hasDescription: !!metadata.description,
            hasChannel: !!metadata.channel,
            hasThumbnail: !!metadata.thumbnail,
            fromContextRenderer: !!metadata.hasContextRenderer
        });
        
        if (this.classifier) {
            try {
                // Use ML model for classification
                return await this.classifyWithML(text);
            } catch (error) {
                console.error('ML classification failed, using fallback:', error);
                return this.classifyWithKeywords(text);
            }
        } else {
            // Use keyword-based classification
            return this.classifyWithKeywords(text);
        }
    }

    async classifyWithML(text) {
        try {
            if (this.transformersLoader) {
                const result = await this.transformersLoader.classify(text);
                if (result && result.length > 0) {
                    // Map sentiment to categories (simplified approach)
                    // In production, you'd use a model trained specifically for video categories
                    const sentiment = result[0].label;
                    const confidence = result[0].score;
                    
                    // For now, fall back to keyword classification with ML confidence boost
                    const keywordCategory = this.classifyWithKeywords(text);
                    
                    // You could enhance this by training a custom model or using
                    // a multi-label classification model for video categories
                    return keywordCategory;
                }
            }
        } catch (error) {
            console.debug('ML classification failed:', error);
        }
        
        // Fallback to keyword classification
        return this.classifyWithKeywords(text);
    }

    classifyWithKeywords(text) {
        let maxScore = 0;
        let bestCategory = 'entertainment'; // default
        let scoreDetails = {};

        // Score each category based on keyword matches
        for (const [category, keywords] of Object.entries(this.categoryKeywords)) {
            let score = 0;
            let matchedKeywords = [];
            
            for (const keyword of keywords) {
                if (text.includes(keyword)) {
                    const keywordScore = keyword.split(' ').length; // Multi-word keywords get higher scores
                    score += keywordScore;
                    matchedKeywords.push(keyword);
                }
            }
            
            scoreDetails[category] = { score, matchedKeywords };
            
            if (score > maxScore) {
                maxScore = score;
                bestCategory = category;
            }
        }

        console.log('🔍 Classification analysis:', {
            text: text.substring(0, 100) + '...',
            scores: scoreDetails,
            result: bestCategory,
            maxScore
        });

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
        const shouldShow = this.settings.mode === 'show' 
            ? this.settings.categories[category] 
            : !this.settings.categories[category];

        if (shouldShow) {
            // Show video - remove filtered class and attributes
            videoElement.classList.remove('ysf-filtered');
            videoElement.removeAttribute('data-filter-message');
            videoElement.removeAttribute('data-filter-category');
            
            // Also remove from nested containers
            const nestedContainers = videoElement.querySelectorAll('.media-item-thumbnail-container, ytm-media-item');
            nestedContainers.forEach(container => {
                container.classList.remove('ysf-filtered');
                container.removeAttribute('data-filter-message');
                container.removeAttribute('data-filter-category');
            });
            
            return false;
        } else {
            // Add filtered class and set overlay text
            videoElement.classList.add('ysf-filtered');
            videoElement.setAttribute('data-filter-message', 'FILTERED');
            videoElement.setAttribute('data-filter-category', category.toUpperCase());
            
            // For ytm-video-with-context-renderer, ensure thumbnail container is properly blurred
            const isContextRenderer = videoElement.tagName?.toLowerCase() === 'ytm-video-with-context-renderer';
            
            if (isContextRenderer) {
                console.log('🎯 Applying enhanced filtering to ytm-video-with-context-renderer');
                
                // Find and blur the thumbnail container specifically
                const thumbnailContainer = videoElement.querySelector('.media-item-thumbnail-container');
                if (thumbnailContainer) {
                    thumbnailContainer.classList.add('ysf-filtered');
                    thumbnailContainer.setAttribute('data-filter-message', 'FILTERED');
                    thumbnailContainer.setAttribute('data-filter-category', category.toUpperCase());
                    console.log('✅ Applied blur to media-item-thumbnail-container');
                }
                
                // Also blur other key components within the context renderer
                const mediaItem = videoElement.querySelector('ytm-media-item');
                if (mediaItem) {
                    mediaItem.classList.add('ysf-filtered');
                    mediaItem.setAttribute('data-filter-message', 'FILTERED');
                    mediaItem.setAttribute('data-filter-category', category.toUpperCase());
                }
                
                // Blur the details section
                const detailsSection = videoElement.querySelector('.details, .media-item-info, .compact-media-item-info');
                if (detailsSection) {
                    detailsSection.classList.add('ysf-filtered-details');
                }
            } else {
                // Fallback for other video containers
                const videoContainer = videoElement.querySelector('ytm-media-item') || 
                                     videoElement.querySelector('.media-item-thumbnail-container');
                if (videoContainer) {
                    videoContainer.classList.add('ysf-filtered');
                    videoContainer.setAttribute('data-filter-message', 'FILTERED');
                    videoContainer.setAttribute('data-filter-category', category.toUpperCase());
                }
            }
            
            return true;
        }
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
        }, 2000);
        
        // Additional delays for slower connections
        setTimeout(() => {
            if (!this.initialized) {
                console.log('🔄 Attempting extended delay initialization...');
                this.tryInitialize('extended-delay');
            }
        }, 5000);
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
                setTimeout(() => {
                    this.tryInitialize('navigation');
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
            setTimeout(() => {
                this.tryInitialize('popstate');
            }, 1000);
        });
    }
    
    setupPeriodicCheck() {
        // Periodic check to ensure the filter stays active
        setInterval(() => {
            if (this.initialized && this.filter) {
                // Check if we're still on YouTube and the filter is working
                if (location.href.includes('youtube.com')) {
                    // Verify the filter is still active by checking for processed videos
                    const processedVideos = document.querySelectorAll('[data-filter-category]');
                    if (processedVideos.length === 0 && document.querySelectorAll('ytm-video-with-context-renderer, ytd-video-renderer').length > 0) {
                        console.log('⚠️ Filter appears inactive, re-initializing...');
                        this.tryInitialize('periodic-check');
                    }
                }
            } else if (location.href.includes('youtube.com')) {
                console.log('⚠️ Filter not initialized, attempting restart...');
                this.tryInitialize('periodic-restart');
            }
        }, 15000); // Check every 15 seconds
    }
    
    async tryInitialize(source) {
        try {
            console.log(`🎯 Initializing YouTube Filter (source: ${source}, attempt: ${this.initRetries + 1})`);
            
            // Check if we're on YouTube
            if (!location.href.includes('youtube.com')) {
                console.log('❌ Not on YouTube, skipping initialization');
                return false;
            }
            
            // Detect if we're on mobile or desktop YouTube
            const isMobile = location.href.includes('m.youtube.com') || 
                           window.innerWidth < 768 || 
                           /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent);
            
            console.log(`📱 Detected ${isMobile ? 'mobile' : 'desktop'} YouTube`);
            
            // Check if YouTube content is ready with appropriate selectors
            const youtubeAppSelectors = isMobile 
                ? ['#page-manager', '#app', '.mobile-web-app', 'body[class*="mobile"]', '#content']
                : ['ytd-app', '#container', 'ytd-page-manager', '#content'];
            
            let youtubeApp = null;
            for (const selector of youtubeAppSelectors) {
                youtubeApp = document.querySelector(selector);
                if (youtubeApp) {
                    console.log(`✅ Found YouTube app with selector: ${selector}`);
                    break;
                }
            }
            
            if (!youtubeApp) {
                // Check if we have basic video content
                const hasVideoContent = document.querySelectorAll('ytm-video-with-context-renderer, ytd-video-renderer, .compact-media-item, .video-list-item').length > 0;
                
                if (!hasVideoContent && this.initRetries < 5) {
                    console.log('⏳ YouTube app not ready, will retry...');
                    this.scheduleRetry(source);
                    return false;
                } else {
                    console.log('🔄 No app container found, but proceeding with available content...');
                }
            }
            
            // Initialize or re-initialize the filter
            if (this.filter) {
                console.log('🔄 Stopping existing filter...');
                if (this.filter.observer) {
                    this.filter.observer.disconnect();
                }
            }
            
            // Create new filter instance
            this.filter = new YouTubeFilter();
            this.initialized = true;
            this.initRetries = 0;
            
            console.log('✅ YouTube Filter initialized successfully!');
            
            // Give it a moment to settle, then process videos
            setTimeout(async () => {
                if (this.filter) {
                    console.log('🔄 Running initial video processing...');
                    await this.filter.processExistingVideos();
                    await this.filter.applyFilters();
                }
            }, 1000);
            
            return true;
            
        } catch (error) {
            console.error('❌ Failed to initialize YouTube Filter:', error);
            this.scheduleRetry(source);
            return false;
        }
    }
    
    scheduleRetry(source) {
        this.initRetries++;
        
        if (this.initRetries < this.maxRetries) {
            const delay = this.retryDelay * Math.min(this.initRetries, 5); // Cap delay growth
            console.log(`⏳ Retrying initialization in ${delay}ms (${this.initRetries}/${this.maxRetries})`);
            
            setTimeout(() => {
                this.tryInitialize(`${source}-retry-${this.initRetries}`);
            }, delay);
        } else {
            console.log('❌ Max retries reached, giving up on initialization');
            this.initRetries = 0; // Reset for future attempts
        }
    }
}

// Start the enhanced initialization system
console.log('🎬 YouTube Smart Filter loading...');

// Initialize immediately if document is ready, otherwise wait
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new YouTubeFilterInitializer();
    });
} else {
    new YouTubeFilterInitializer();
}

} // Close the global if statement to prevent duplicate loading 