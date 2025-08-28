// Enhanced client-side classifier with better accuracy
// Uses multiple techniques to improve classification without heavy ML models

class EnhancedContentClassifier {
    constructor() {
        this.isInitialized = false;
        this.models = {};
        this.embeddings = {};
        this.similarityCache = new Map();
    }

    async initialize() {
        try {
            // Load lightweight models that work in extensions
            await this.loadLightweightModels();
            
            // Initialize enhanced keyword patterns
            this.initializeEnhancedPatterns();
            
            // Load pre-computed embeddings for common terms
            await this.loadEmbeddings();
            
            this.isInitialized = true;
            console.log('✅ Enhanced classifier initialized');
        } catch (error) {
            console.error('❌ Failed to initialize enhanced classifier:', error);
            // Fallback to basic initialization
            this.initializeEnhancedPatterns();
            this.isInitialized = true;
        }
    }

    async loadLightweightModels() {
        // Load lightweight models that can work in extensions
        // These are smaller, optimized models for specific tasks
        
        // 1. Sentiment analysis model (lightweight)
        this.models.sentiment = await this.loadSentimentModel();
        
        // 2. Topic classification model (lightweight)
        this.models.topic = await this.loadTopicModel();
        
        // 3. Safety detection model (lightweight)
        this.models.safety = await this.loadSafetyModel();
    }

    async loadSentimentModel() {
        // Load a lightweight sentiment analysis model
        // This could be a simple rule-based model or a small neural network
        return {
            analyze: (text) => {
                const positiveWords = ['good', 'great', 'amazing', 'awesome', 'love', 'like', 'enjoy', 'happy'];
                const negativeWords = ['bad', 'terrible', 'hate', 'awful', 'dislike', 'sad', 'angry', 'frustrated'];
                
                const words = text.toLowerCase().split(/\s+/);
                let positiveScore = 0;
                let negativeScore = 0;
                
                words.forEach(word => {
                    if (positiveWords.includes(word)) positiveScore++;
                    if (negativeWords.includes(word)) negativeScore++;
                });
                
                const total = words.length;
                if (total === 0) return { sentiment: 'neutral', confidence: 0.5 };
                
                const positiveRatio = positiveScore / total;
                const negativeRatio = negativeScore / total;
                
                if (positiveRatio > negativeRatio) {
                    return { sentiment: 'positive', confidence: positiveRatio };
                } else if (negativeRatio > positiveRatio) {
                    return { sentiment: 'negative', confidence: negativeRatio };
                } else {
                    return { sentiment: 'neutral', confidence: 0.5 };
                }
            }
        };
    }

    async loadTopicModel() {
        // Enhanced topic classification with better patterns
        return {
            classify: (text) => {
                const topics = this.enhancedTopicClassification(text);
                return topics.sort((a, b) => b.confidence - a.confidence);
            }
        };
    }

    async loadSafetyModel() {
        // Safety detection with multiple layers
        return {
            analyze: (text) => {
                return this.analyzeSafety(text);
            }
        };
    }

    initializeEnhancedPatterns() {
        // Enhanced keyword patterns with better scoring
        this.enhancedPatterns = {
            // Safety & Content (high priority)
            'adult-content': {
                patterns: [
                    { regex: /\b(adult|18\+|nsfw|explicit|mature)\b/i, weight: 3.0 },
                    { regex: /\b(xxx|porn|sex|nude|intimate)\b/i, weight: 4.0 },
                    { regex: /\b(onlyfans|fansly)\b/i, weight: 3.5 }
                ],
                safety: 'high',
                priority: 1
            },
            'violence': {
                patterns: [
                    { regex: /\b(violence|violent|fight|war|weapon)\b/i, weight: 2.5 },
                    { regex: /\b(gun|blood|death|kill|attack)\b/i, weight: 3.0 },
                    { regex: /\b(murder|assault|battle)\b/i, weight: 3.5 }
                ],
                safety: 'high',
                priority: 1
            },
            'hate-speech': {
                patterns: [
                    { regex: /\b(hate|racist|sexist|homophobic)\b/i, weight: 3.0 },
                    { regex: /\b(discrimination|bigotry|prejudice)\b/i, weight: 2.5 }
                ],
                safety: 'high',
                priority: 1
            },

            // Entertainment (medium priority)
            'gaming': {
                patterns: [
                    { regex: /\b(gaming|game|gameplay|streamer)\b/i, weight: 2.0 },
                    { regex: /\b(twitch|xbox|playstation|nintendo)\b/i, weight: 2.5 },
                    { regex: /\b(esports|fps|rpg|mmo)\b/i, weight: 2.0 }
                ],
                safety: 'low',
                priority: 2
            },
            'music': {
                patterns: [
                    { regex: /\b(music|song|album|artist)\b/i, weight: 1.5 },
                    { regex: /\b(concert|musician|band|singer)\b/i, weight: 2.0 },
                    { regex: /\b(lyrics|music video|mv)\b/i, weight: 1.8 }
                ],
                safety: 'low',
                priority: 2
            },
            'movies-tv': {
                patterns: [
                    { regex: /\b(movie|film|trailer|cinema)\b/i, weight: 1.5 },
                    { regex: /\b(tv show|series|episode|actor)\b/i, weight: 1.8 },
                    { regex: /\b(hollywood|netflix|disney)\b/i, weight: 1.5 }
                ],
                safety: 'low',
                priority: 2
            },

            // Educational (medium priority)
            'educational': {
                patterns: [
                    { regex: /\b(tutorial|learn|education|course)\b/i, weight: 2.0 },
                    { regex: /\b(lesson|guide|how to|explained)\b/i, weight: 1.8 },
                    { regex: /\b(academic|university|college)\b/i, weight: 2.2 }
                ],
                safety: 'low',
                priority: 2
            },
            'technology': {
                patterns: [
                    { regex: /\b(tech|technology|gadget|smartphone)\b/i, weight: 1.8 },
                    { regex: /\b(computer|software|ai|programming)\b/i, weight: 2.0 },
                    { regex: /\b(coding|developer|app|startup)\b/i, weight: 1.8 }
                ],
                safety: 'low',
                priority: 2
            },

            // News & Politics (high priority)
            'news': {
                patterns: [
                    { regex: /\b(news|breaking|report|journalism)\b/i, weight: 2.5 },
                    { regex: /\b(current events|update|latest)\b/i, weight: 2.0 },
                    { regex: /\b(cnn|bbc|fox news|msnbc)\b/i, weight: 2.2 }
                ],
                safety: 'medium',
                priority: 1
            },
            'politics': {
                patterns: [
                    { regex: /\b(politics|political|election|government)\b/i, weight: 2.5 },
                    { regex: /\b(president|congress|senate|vote)\b/i, weight: 2.8 },
                    { regex: /\b(campaign|democrat|republican)\b/i, weight: 2.5 }
                ],
                safety: 'medium',
                priority: 1
            }
        };
    }

    async loadEmbeddings() {
        // Load pre-computed embeddings for semantic similarity
        // This could be a small embedding model or pre-computed vectors
        this.embeddings = {
            // Simple word embeddings for common terms
            'gaming': ['game', 'play', 'fun', 'entertainment', 'stream'],
            'educational': ['learn', 'teach', 'study', 'knowledge', 'information'],
            'technology': ['tech', 'computer', 'digital', 'innovation', 'software'],
            'music': ['sound', 'audio', 'melody', 'rhythm', 'song'],
            'news': ['information', 'current', 'recent', 'update', 'report']
        };
    }

    async classifyContent(text, metadata = {}) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const results = {
            primary: null,
            confidence: 0,
            categories: [],
            safety: {},
            metadata: {}
        };

        try {
            // 1. Pattern-based classification
            const patternResults = this.patternBasedClassification(text);
            results.categories.push(...patternResults);

            // 2. Semantic similarity analysis
            const semanticResults = await this.semanticSimilarityAnalysis(text);
            results.categories.push(...semanticResults);

            // 3. Safety analysis
            const safetyResults = await this.models.safety.analyze(text);
            results.safety = safetyResults;

            // 4. Sentiment analysis
            const sentimentResults = await this.models.sentiment.analyze(text);
            results.metadata.sentiment = sentimentResults;

            // 5. Context-aware analysis
            const contextResults = this.contextAwareAnalysis(text, metadata);
            if (contextResults) {
                results.categories.push(contextResults);
            }

            // 6. Topic classification
            const topicResults = await this.models.topic.classify(text);
            results.categories.push(...topicResults);

            // Sort and select primary category
            results.categories.sort((a, b) => {
                // Sort by priority first, then by confidence
                if (a.priority !== b.priority) {
                    return a.priority - b.priority;
                }
                return b.confidence - a.confidence;
            });

            if (results.categories.length > 0) {
                results.primary = results.categories[0].label;
                results.confidence = results.categories[0].confidence;
            }

            return results;

        } catch (error) {
            console.error('Enhanced classification error:', error);
            // Fallback to pattern-based classification
            return this.patternBasedClassification(text);
        }
    }

    patternBasedClassification(text) {
        const results = [];
        const textLower = text.toLowerCase();

        Object.keys(this.enhancedPatterns).forEach(category => {
            const config = this.enhancedPatterns[category];
            let totalScore = 0;
            let matchCount = 0;

            config.patterns.forEach(pattern => {
                const matches = textLower.match(pattern.regex);
                if (matches) {
                    totalScore += pattern.weight * matches.length;
                    matchCount += matches.length;
                }
            });

            if (totalScore > 0) {
                // Normalize score and apply safety weighting
                let confidence = Math.min(totalScore / 50, 0.95);
                
                // Boost confidence for safety-related content
                if (config.safety === 'high') {
                    confidence = Math.min(confidence * 1.2, 0.95);
                }

                results.push({
                    label: category,
                    confidence: confidence,
                    priority: config.priority,
                    safety: config.safety,
                    matchCount: matchCount,
                    source: 'pattern-based'
                });
            }
        });

        return results;
    }

    async semanticSimilarityAnalysis(text) {
        const results = [];
        const words = text.toLowerCase().split(/\s+/);

        Object.keys(this.embeddings).forEach(category => {
            const categoryWords = this.embeddings[category];
            let similarity = 0;

            words.forEach(word => {
                if (categoryWords.includes(word)) {
                    similarity += 1;
                }
            });

            if (similarity > 0) {
                const confidence = Math.min(similarity / categoryWords.length, 0.8);
                results.push({
                    label: category,
                    confidence: confidence,
                    priority: 3,
                    safety: 'low',
                    source: 'semantic-similarity'
                });
            }
        });

        return results;
    }

    contextAwareAnalysis(text, metadata) {
        // Analyze context from metadata
        const context = {
            channelType: this.analyzeChannelType(metadata.channelName),
            uploadTime: this.analyzeUploadTime(metadata.uploadDate),
            popularity: this.analyzePopularity(metadata.viewCount)
        };

        // Adjust classification based on context
        if (context.channelType === 'educational' && context.popularity === 'high') {
            return {
                label: 'educational',
                confidence: 0.7,
                priority: 2,
                safety: 'low',
                source: 'context-aware'
            };
        }

        if (context.channelType === 'news' && context.uploadTime === 'recent') {
            return {
                label: 'news',
                confidence: 0.6,
                priority: 1,
                safety: 'medium',
                source: 'context-aware'
            };
        }

        return null;
    }

    analyzeSafety(text) {
        const safetyScores = {
            toxic: 0,
            violence: 0,
            hate: 0,
            sexual: 0
        };

        // Simple safety detection patterns
        const toxicPatterns = [/\b(fuck|shit|damn|bitch)\b/gi];
        const violencePatterns = [/\b(kill|death|blood|gun|weapon)\b/gi];
        const hatePatterns = [/\b(hate|racist|sexist|homophobic)\b/gi];
        const sexualPatterns = [/\b(sex|nude|porn|adult)\b/gi];

        // Calculate safety scores
        toxicPatterns.forEach(pattern => {
            const matches = text.match(pattern);
            if (matches) safetyScores.toxic += matches.length * 0.1;
        });

        violencePatterns.forEach(pattern => {
            const matches = text.match(pattern);
            if (matches) safetyScores.violence += matches.length * 0.15;
        });

        hatePatterns.forEach(pattern => {
            const matches = text.match(pattern);
            if (matches) safetyScores.hate += matches.length * 0.2;
        });

        sexualPatterns.forEach(pattern => {
            const matches = text.match(pattern);
            if (matches) safetyScores.sexual += matches.length * 0.15;
        });

        // Normalize scores
        Object.keys(safetyScores).forEach(key => {
            safetyScores[key] = Math.min(safetyScores[key], 1.0);
        });

        return safetyScores;
    }

    analyzeChannelType(channelName) {
        if (!channelName) return 'unknown';
        
        const nameLower = channelName.toLowerCase();
        
        if (nameLower.includes('university') || nameLower.includes('college') || 
            nameLower.includes('academy') || nameLower.includes('tutorial')) {
            return 'educational';
        }
        
        if (nameLower.includes('news') || nameLower.includes('channel') || 
            nameLower.includes('network')) {
            return 'news';
        }
        
        return 'general';
    }

    analyzeUploadTime(uploadDate) {
        if (!uploadDate) return 'unknown';
        
        const upload = new Date(uploadDate);
        const now = new Date();
        const daysDiff = (now - upload) / (1000 * 60 * 60 * 24);
        
        if (daysDiff <= 7) return 'recent';
        if (daysDiff <= 30) return 'trending';
        return 'evergreen';
    }

    analyzePopularity(viewCount) {
        if (!viewCount) return 'unknown';
        
        const views = parseInt(viewCount);
        if (views > 1000000) return 'high';
        if (views > 100000) return 'medium';
        return 'low';
    }
}

// Export for use in content script
window.EnhancedContentClassifier = EnhancedContentClassifier;