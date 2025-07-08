// Keyword-based Classification Loader for Chrome Extension
// Note: ML model loading removed due to Chrome extension CSP restrictions
class TransformersLoader {
    constructor() {
        this.isLoaded = true; // Always "loaded" since we use keywords
        this.isLoading = false;
        this.pipeline = null; // Always null - we use keyword classification
        console.log('🔤 Using keyword-based video classification (ML model disabled due to CSP)');
    }

    async initialize() {
        // Return null immediately to use keyword-based classification
        console.log('📦 Keyword-based classification ready');
        return null;
    }

    async classify(text) {
        // Always return null to trigger keyword-based fallback
        return null;
    }
}

// Export for use in content script
window.TransformersLoader = TransformersLoader; 