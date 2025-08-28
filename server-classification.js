// Server-side classification service for enhanced accuracy
// This can be deployed as a separate service or API endpoint

const { pipeline } = require('@huggingface/transformers');
const natural = require('natural');
const tf = require('@tensorflow/tfjs-node');

class AdvancedContentClassifier {
    constructor() {
        this.models = {};
        this.tokenizer = null;
        this.isInitialized = false;
    }

    async initialize() {
        try {
            // Load multiple specialized models for different content types
            this.models = {
                // General content classification
                'general': await pipeline('text-classification', 'facebook/bart-large-mnli'),
                
                // Specialized models for better accuracy
                'safety': await pipeline('text-classification', 'unitary/toxic-bert'),
                'topic': await pipeline('text-classification', 'cardiffnlp/twitter-roberta-base-news-topic-classification'),
                'sentiment': await pipeline('text-classification', 'cardiffnlp/twitter-roberta-base-sentiment-latest'),
                
                // Custom fine-tuned models (if available)
                'youtube-content': await pipeline('text-classification', 'your-custom-youtube-model'),
            };

            // Initialize tokenizer for custom processing
            this.tokenizer = new natural.WordTokenizer();
            
            this.isInitialized = true;
            console.log('✅ Advanced classifier initialized with multiple models');
        } catch (error) {
            console.error('❌ Failed to initialize advanced classifier:', error);
            throw error;
        }
    }

    async classifyContent(text, metadata = {}) {
        if (!this.isInitialized) {
            throw new Error('Classifier not initialized');
        }

        const results = {
            primary: null,
            confidence: 0,
            categories: [],
            safety: {},
            metadata: {}
        };

        try {
            // 1. General content classification
            const generalResult = await this.models.general(text);
            results.primary = generalResult[0].label;
            results.confidence = generalResult[0].score;

            // 2. Safety classification
            const safetyResult = await this.models.safety(text);
            results.safety = {
                toxic: safetyResult.find(r => r.label === 'toxic')?.score || 0,
                hate: safetyResult.find(r => r.label === 'hate')?.score || 0,
                violence: safetyResult.find(r => r.label === 'violence')?.score || 0,
                sexual: safetyResult.find(r => r.label === 'sexual')?.score || 0
            };

            // 3. Topic classification
            const topicResult = await this.models.topic(text);
            results.categories.push({
                label: topicResult[0].label,
                confidence: topicResult[0].score
            });

            // 4. Sentiment analysis
            const sentimentResult = await this.models.sentiment(text);
            results.metadata.sentiment = sentimentResult[0].label;

            // 5. Custom YouTube-specific classification
            if (this.models['youtube-content']) {
                const youtubeResult = await this.models['youtube-content'](text);
                results.categories.push({
                    label: youtubeResult[0].label,
                    confidence: youtubeResult[0].score,
                    source: 'youtube-specific'
                });
            }

            // 6. Enhanced keyword analysis
            const keywordAnalysis = this.enhancedKeywordAnalysis(text, metadata);
            results.categories.push(...keywordAnalysis);

            // 7. Context-aware classification
            const contextResult = this.contextAwareClassification(text, metadata);
            if (contextResult) {
                results.categories.push(contextResult);
            }

            // Sort categories by confidence
            results.categories.sort((a, b) => b.confidence - a.confidence);

            return results;

        } catch (error) {
            console.error('Classification error:', error);
            // Fallback to enhanced keyword analysis
            return this.enhancedKeywordAnalysis(text, metadata);
        }
    }

    enhancedKeywordAnalysis(text, metadata) {
        const enhancedKeywords = {
            // Safety & Content (with weighted scoring)
            'adult-content': {
                keywords: ['adult', '18+', 'nsfw', 'explicit', 'mature', 'xxx', 'porn', 'sex', 'nude', 'intimate'],
                weight: 2.0,
                safety: 'high'
            },
            'violence': {
                keywords: ['violence', 'violent', 'fight', 'war', 'weapon', 'gun', 'blood', 'death', 'kill', 'attack'],
                weight: 1.8,
                safety: 'high'
            },
            'politics': {
                keywords: ['politics', 'political', 'election', 'government', 'president', 'congress', 'senate', 'vote', 'campaign'],
                weight: 1.5,
                safety: 'medium'
            },
            
            // Entertainment (with subcategories)
            'gaming': {
                keywords: ['gaming', 'game', 'gameplay', 'streamer', 'twitch', 'xbox', 'playstation', 'nintendo', 'esports', 'fps', 'rpg'],
                weight: 1.2,
                safety: 'low'
            },
            'music': {
                keywords: ['music', 'song', 'album', 'artist', 'concert', 'musician', 'band', 'singer', 'lyrics', 'music video'],
                weight: 1.0,
                safety: 'low'
            },
            
            // Educational (with expertise levels)
            'educational': {
                keywords: ['tutorial', 'learn', 'education', 'course', 'lesson', 'guide', 'how to', 'explained', 'academic'],
                weight: 1.3,
                safety: 'low'
            },
            'technology': {
                keywords: ['tech', 'technology', 'gadget', 'smartphone', 'computer', 'software', 'ai', 'programming', 'coding'],
                weight: 1.4,
                safety: 'low'
            }
        };

        const scores = {};
        const textLower = text.toLowerCase();

        // Calculate weighted scores
        Object.keys(enhancedKeywords).forEach(category => {
            const config = enhancedKeywords[category];
            let score = 0;
            
            config.keywords.forEach(keyword => {
                if (textLower.includes(keyword.toLowerCase())) {
                    // Weight by keyword length and frequency
                    const frequency = (textLower.match(new RegExp(keyword.toLowerCase(), 'g')) || []).length;
                    score += keyword.length * frequency * config.weight;
                }
            });

            if (score > 0) {
                scores[category] = {
                    label: category,
                    confidence: Math.min(score / 100, 0.95), // Normalize to 0-0.95
                    weight: config.weight,
                    safety: config.safety
                };
            }
        });

        return Object.values(scores);
    }

    contextAwareClassification(text, metadata) {
        // Analyze context from metadata (channel, upload date, view count, etc.)
        const context = {
            channelType: this.analyzeChannelType(metadata.channelName),
            uploadTime: this.analyzeUploadTime(metadata.uploadDate),
            popularity: this.analyzePopularity(metadata.viewCount, metadata.subscriberCount)
        };

        // Adjust classification based on context
        if (context.channelType === 'educational' && context.popularity === 'high') {
            return {
                label: 'educational',
                confidence: 0.8,
                source: 'context-aware'
            };
        }

        return null;
    }

    analyzeChannelType(channelName) {
        if (!channelName) return 'unknown';
        
        const educational = ['university', 'college', 'school', 'academy', 'institute', 'tutorial', 'learn'];
        const news = ['news', 'channel', 'network', 'broadcast', 'media'];
        
        const nameLower = channelName.toLowerCase();
        
        if (educational.some(term => nameLower.includes(term))) return 'educational';
        if (news.some(term => nameLower.includes(term))) return 'news';
        
        return 'general';
    }

    analyzeUploadTime(uploadDate) {
        // Analyze if content is recent, trending, or evergreen
        if (!uploadDate) return 'unknown';
        
        const upload = new Date(uploadDate);
        const now = new Date();
        const daysDiff = (now - upload) / (1000 * 60 * 60 * 24);
        
        if (daysDiff <= 7) return 'recent';
        if (daysDiff <= 30) return 'trending';
        return 'evergreen';
    }

    analyzePopularity(viewCount, subscriberCount) {
        if (!viewCount) return 'unknown';
        
        const views = parseInt(viewCount);
        if (views > 1000000) return 'high';
        if (views > 100000) return 'medium';
        return 'low';
    }
}

module.exports = AdvancedContentClassifier;