// Real ML Model Loader for Chrome Extension
// Uses Transformers.js to load and run DistilBERT and other models

class TransformersLoader {
    constructor() {
        this.isLoaded = false;
        this.isLoading = false;
        this.pipeline = null;
        this.models = {};
        this.modelCache = new Map();
        console.log('🤖 Initializing ML model loader for Chrome extension');
    }

    async initialize() {
        if (this.isLoaded || this.isLoading) {
            return this.pipeline;
        }

        this.isLoading = true;
        console.log('📦 Loading ML models...');

        try {
            // Load Transformers.js library
            await this.loadTransformersJS();
            
            // Initialize models
            await this.initializeModels();
            
            this.isLoaded = true;
            this.isLoading = false;
            console.log('✅ ML models loaded successfully');
            return this.pipeline;
            
        } catch (error) {
            console.error('❌ Failed to load ML models:', error);
            this.isLoading = false;
            // Fallback to keyword-based classification
            return null;
        }
    }

    async loadTransformersJS() {
        // Load Transformers.js from CDN
        if (typeof window !== 'undefined' && !window.pipeline) {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.15.0/dist/transformers.min.js';
            script.async = true;
            
            return new Promise((resolve, reject) => {
                script.onload = () => {
                    console.log('📚 Transformers.js library loaded');
                    resolve();
                };
                script.onerror = () => {
                    console.error('❌ Failed to load Transformers.js');
                    reject(new Error('Transformers.js load failed'));
                };
                document.head.appendChild(script);
            });
        }
    }

    async initializeModels() {
        try {
            // Load DistilBERT for general classification
            console.log('🔄 Loading DistilBERT model...');
            this.models.distilbert = await pipeline(
                'text-classification',
                'distilbert-base-uncased-finetuned-sst-2-english',
                { quantized: true } // Use quantized model for smaller size
            );

            // Load BERT for safety detection
            console.log('🔄 Loading BERT safety model...');
            this.models.safety = await pipeline(
                'text-classification',
                'unitary/toxic-bert',
                { quantized: true }
            );

            // Load RoBERTa for topic classification
            console.log('🔄 Loading RoBERTa topic model...');
            this.models.topic = await pipeline(
                'text-classification',
                'cardiffnlp/twitter-roberta-base-news-topic-classification',
                { quantized: true }
            );

            // Create ensemble pipeline
            this.pipeline = {
                classify: async (text) => {
                    return await this.ensembleClassify(text);
                }
            };

            console.log('✅ All ML models initialized successfully');
            
        } catch (error) {
            console.error('❌ Error initializing models:', error);
            throw error;
        }
    }

    async ensembleClassify(text) {
        try {
            const results = [];
            
            // Run DistilBERT classification
            if (this.models.distilbert) {
                const distilbertResult = await this.models.distilbert(text);
                results.push({
                    model: 'distilbert',
                    label: distilbertResult[0].label,
                    score: distilbertResult[0].score
                });
            }

            // Run safety classification
            if (this.models.safety) {
                const safetyResult = await this.models.safety(text);
                results.push({
                    model: 'safety',
                    label: safetyResult[0].label,
                    score: safetyResult[0].score
                });
            }

            // Run topic classification
            if (this.models.topic) {
                const topicResult = await this.models.topic(text);
                results.push({
                    model: 'topic',
                    label: topicResult[0].label,
                    score: topicResult[0].score
                });
            }

            // Combine results using ensemble method
            const finalResult = this.combineResults(results, text);
            
            console.log('🎯 ML classification result:', finalResult);
            return [finalResult];
            
        } catch (error) {
            console.error('❌ ML classification error:', error);
            throw error;
        }
    }

    combineResults(results, text) {
        // Enhanced ensemble method that combines multiple model outputs
        const categoryScores = {};
        const safetyScores = {};
        
        // Process each model result
        results.forEach(result => {
            if (result.model === 'distilbert') {
                // Map sentiment to categories
                if (result.label === 'POSITIVE') {
                    categoryScores['entertainment'] = (categoryScores['entertainment'] || 0) + result.score * 0.3;
                    categoryScores['educational'] = (categoryScores['educational'] || 0) + result.score * 0.2;
                } else {
                    categoryScores['news'] = (categoryScores['news'] || 0) + result.score * 0.4;
                    categoryScores['politics'] = (categoryScores['politics'] || 0) + result.score * 0.3;
                }
            }
            
            if (result.model === 'safety') {
                // Process safety scores
                safetyScores[result.label] = result.score;
            }
            
            if (result.model === 'topic') {
                // Map topic labels to our categories
                const topicMapping = {
                    'sports': 'sports',
                    'entertainment': 'entertainment',
                    'business': 'business',
                    'technology': 'technology',
                    'politics': 'politics',
                    'health': 'health-fitness'
                };
                
                const mappedCategory = topicMapping[result.label] || 'entertainment';
                categoryScores[mappedCategory] = (categoryScores[mappedCategory] || 0) + result.score * 0.5;
            }
        });

        // Apply keyword-based enhancement
        const keywordScores = this.getKeywordScores(text);
        Object.keys(keywordScores).forEach(category => {
            categoryScores[category] = (categoryScores[category] || 0) + keywordScores[category] * 0.3;
        });

        // Find the best category
        let bestCategory = 'entertainment';
        let bestScore = 0;
        
        Object.keys(categoryScores).forEach(category => {
            if (categoryScores[category] > bestScore) {
                bestScore = categoryScores[category];
                bestCategory = category;
            }
        });

        // Check for safety concerns
        const hasSafetyConcerns = Object.values(safetyScores).some(score => score > 0.7);
        if (hasSafetyConcerns) {
            // Prioritize safety categories
            const safetyCategories = ['adult-content', 'violence', 'hate-speech'];
            const safetyScore = Math.max(...Object.values(safetyScores));
            if (safetyScore > 0.8) {
                bestCategory = 'adult-content'; // Default safety category
                bestScore = safetyScore;
            }
        }

        return {
            label: bestCategory,
            score: Math.min(bestScore, 0.95), // Cap at 0.95
            confidence: bestScore,
            safety: safetyScores,
            model: 'ensemble'
        };
    }

    getKeywordScores(text) {
        // Enhanced keyword scoring to complement ML models
        const keywords = {
            'gaming': ['game', 'gaming', 'gameplay', 'streamer', 'twitch', 'xbox', 'playstation'],
            'music': ['music', 'song', 'album', 'artist', 'concert', 'musician', 'band'],
            'technology': ['tech', 'technology', 'gadget', 'computer', 'software', 'ai', 'programming'],
            'educational': ['tutorial', 'learn', 'education', 'course', 'lesson', 'guide', 'how to'],
            'news': ['news', 'breaking', 'report', 'journalism', 'current events', 'update'],
            'politics': ['politics', 'political', 'election', 'government', 'president', 'congress'],
            'sports': ['sports', 'football', 'basketball', 'soccer', 'baseball', 'tennis', 'olympics'],
            'adult-content': ['adult', '18+', 'nsfw', 'explicit', 'mature', 'xxx', 'porn', 'sex'],
            'violence': ['violence', 'violent', 'fight', 'war', 'weapon', 'gun', 'blood', 'death']
        };

        const scores = {};
        const textLower = text.toLowerCase();

        Object.keys(keywords).forEach(category => {
            let score = 0;
            keywords[category].forEach(keyword => {
                if (textLower.includes(keyword)) {
                    score += keyword.length * 0.1;
                }
            });
            if (score > 0) {
                scores[category] = Math.min(score, 0.8);
            }
        });

        return scores;
    }

    async classify(text) {
        if (!this.isLoaded) {
            console.log('🔄 ML models not loaded, using keyword fallback');
            return this.keywordClassify(text);
        }

        try {
            const result = await this.pipeline.classify(text);
            return result;
        } catch (error) {
            console.error('❌ ML classification failed, falling back to keywords:', error);
            return this.keywordClassify(text);
        }
    }

    keywordClassify(text) {
        // Fallback keyword classification
        const scores = this.getKeywordScores(text);
        let bestCategory = 'entertainment';
        let bestScore = 0;

        Object.keys(scores).forEach(category => {
            if (scores[category] > bestScore) {
                bestScore = scores[category];
                bestCategory = category;
            }
        });

        return [{
            label: bestCategory,
            score: bestScore,
            confidence: bestScore,
            model: 'keyword-fallback'
        }];
    }
}

// Export for use in content script
window.TransformersLoader = TransformersLoader; 