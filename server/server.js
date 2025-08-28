const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const NodeCache = require('node-cache');
require('dotenv').config();

const AdvancedContentClassifier = require('./server-classification');

class ClassificationServer {
    constructor() {
        this.app = express();
        this.classifier = null;
        this.cache = new NodeCache({ stdTTL: 3600 }); // 1 hour cache
        this.logger = this.setupLogger();
        
        this.setupMiddleware();
        this.setupRoutes();
        this.initializeClassifier();
    }

    setupLogger() {
        return winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors({ stack: true }),
                winston.format.json()
            ),
            defaultMeta: { service: 'classification-server' },
            transports: [
                new winston.transports.File({ filename: 'error.log', level: 'error' }),
                new winston.transports.File({ filename: 'combined.log' }),
                new winston.transports.Console({
                    format: winston.format.simple()
                })
            ]
        });
    }

    setupMiddleware() {
        // Security middleware
        this.app.use(helmet());
        
        // CORS for browser extension
        this.app.use(cors({
            origin: ['chrome-extension://*', 'moz-extension://*'],
            credentials: true
        }));
        
        // Rate limiting
        const limiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100, // limit each IP to 100 requests per windowMs
            message: 'Too many requests from this IP, please try again later.'
        });
        this.app.use('/api/', limiter);
        
        // Compression
        this.app.use(compression());
        
        // Body parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true }));
        
        // Request logging
        this.app.use((req, res, next) => {
            this.logger.info(`${req.method} ${req.path}`, {
                ip: req.ip,
                userAgent: req.get('User-Agent')
            });
            next();
        });
    }

    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({ 
                status: 'healthy', 
                timestamp: new Date().toISOString(),
                classifierReady: this.classifier && this.classifier.isInitialized
            });
        });

        // Main classification endpoint
        this.app.post('/api/classify', async (req, res) => {
            try {
                const { text, metadata = {} } = req.body;
                
                if (!text) {
                    return res.status(400).json({ 
                        error: 'Text content is required' 
                    });
                }

                // Check cache first
                const cacheKey = this.generateCacheKey(text, metadata);
                const cachedResult = this.cache.get(cacheKey);
                if (cachedResult) {
                    this.logger.info('Cache hit for classification request');
                    return res.json({
                        ...cachedResult,
                        cached: true
                    });
                }

                // Perform classification
                if (!this.classifier || !this.classifier.isInitialized) {
                    return res.status(503).json({ 
                        error: 'Classifier not ready' 
                    });
                }

                const result = await this.classifier.classifyContent(text, metadata);
                
                // Cache the result
                this.cache.set(cacheKey, result);
                
                this.logger.info('Classification completed', {
                    textLength: text.length,
                    primaryCategory: result.primary,
                    confidence: result.confidence
                });

                res.json({
                    ...result,
                    cached: false,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                this.logger.error('Classification error', { error: error.message });
                res.status(500).json({ 
                    error: 'Classification failed',
                    message: error.message 
                });
            }
        });

        // Batch classification endpoint
        this.app.post('/api/classify/batch', async (req, res) => {
            try {
                const { items } = req.body;
                
                if (!Array.isArray(items) || items.length === 0) {
                    return res.status(400).json({ 
                        error: 'Items array is required' 
                    });
                }

                if (items.length > 50) {
                    return res.status(400).json({ 
                        error: 'Maximum 50 items per batch' 
                    });
                }

                if (!this.classifier || !this.classifier.isInitialized) {
                    return res.status(503).json({ 
                        error: 'Classifier not ready' 
                    });
                }

                const results = [];
                for (const item of items) {
                    try {
                        const result = await this.classifier.classifyContent(item.text, item.metadata || {});
                        results.push({
                            id: item.id,
                            ...result
                        });
                    } catch (error) {
                        results.push({
                            id: item.id,
                            error: error.message
                        });
                    }
                }

                this.logger.info('Batch classification completed', {
                    totalItems: items.length,
                    successfulItems: results.filter(r => !r.error).length
                });

                res.json({
                    results,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                this.logger.error('Batch classification error', { error: error.message });
                res.status(500).json({ 
                    error: 'Batch classification failed',
                    message: error.message 
                });
            }
        });

        // Model status endpoint
        this.app.get('/api/status', (req, res) => {
            res.json({
                ready: this.classifier && this.classifier.isInitialized,
                models: this.classifier ? Object.keys(this.classifier.models) : [],
                cacheStats: this.cache.getStats(),
                timestamp: new Date().toISOString()
            });
        });

        // Error handling
        this.app.use((error, req, res, next) => {
            this.logger.error('Unhandled error', { error: error.message });
            res.status(500).json({ 
                error: 'Internal server error' 
            });
        });

        // 404 handler
        this.app.use((req, res) => {
            res.status(404).json({ 
                error: 'Endpoint not found' 
            });
        });
    }

    async initializeClassifier() {
        try {
            this.logger.info('Initializing advanced content classifier...');
            this.classifier = new AdvancedContentClassifier();
            await this.classifier.initialize();
            this.logger.info('Advanced content classifier initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize classifier', { error: error.message });
            // Continue running server, but classifier won't be available
        }
    }

    generateCacheKey(text, metadata) {
        // Create a hash of the text and metadata for caching
        const content = JSON.stringify({ text, metadata });
        return require('crypto').createHash('md5').update(content).digest('hex');
    }

    start(port = process.env.PORT || 3000) {
        this.app.listen(port, () => {
            this.logger.info(`Classification server running on port ${port}`);
            console.log(`🚀 Classification server running on port ${port}`);
            console.log(`📊 Health check: http://localhost:${port}/health`);
            console.log(`🔍 API docs: http://localhost:${port}/api/status`);
        });
    }
}

// Start the server
const server = new ClassificationServer();
server.start();