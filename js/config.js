/**
 * Configuration for Pistachio Production Management
 * GitHub Pages Implementation
 */

const Config = {
    // GitHub OAuth Configuration
    github: {
        clientId: 'Ov23lizH9QoqwmOf0JD8',           // CORRECTED: Use the actual Client ID from OAuth app
        redirectUri: 'https://akapp611.github.io/pistachio-production-demo/', // CORRECTED: Fixed URL
        scopes: 'repo',
        repo: 'AKAPP611/pistachio-production-demo',     // Your repository
        branch: 'main',
        apiUrl: 'https://api.github.com'
    },
    
    // Application Configuration
    app: {
        name: 'Pistachio Production Management',
        version: '2.0.0',
        syncInterval: 30000, // 30 seconds
        offlineRetries: 3,
        maxRetryDelay: 60000, // 1 minute
        dataFiles: {
            productions: 'data/productions.json',
            materials: 'data/materials.json',
            users: 'data/users.json',
            config: 'data/config.json'
        }
    },
    
    // Storage Configuration
    storage: {
        localStoragePrefix: 'pistachio_',
        indexedDBName: 'PistachioProductionDB',
        indexedDBVersion: 1,
        syncQueueStore: 'syncQueue',
        offlineDataStore: 'offlineData'
    },
    
    // Authentication Configuration
    auth: {
        tokenKey: 'github_access_token',
        userKey: 'github_user',
        refreshThreshold: 300000, // 5 minutes before expiry
        sessionTimeout: 86400000 // 24 hours
    },
    
    // Sync Configuration
    sync: {
        enableAutoSync: true,
        enableOfflineMode: true,
        enableConflictResolution: true,
        syncOnStartup: true,
        retryFailedSyncs: true
    },
    
    // Security Configuration
    security: {
        enableCSRFProtection: true,
        enableXSSProtection: true,
        enableTokenEncryption: false, // CHANGED: Disabled problematic encryption
        allowedOrigins: ['https://akapp611.github.io'] // CORRECTED: Fixed origin
    },
    
    // Development Configuration
    dev: {
        enableDebugLogging: true, // CHANGED: Enable for troubleshooting
        enableMockData: false,
        bypassAuthentication: false
    },
    
    // Feature Flags
    features: {
        enableGitHubIssues: true,
        enableAdvancedReporting: true,
        enableRealTimeSync: true,
        enableTeamCollaboration: true,
        enableOfflineMode: true,
        enableMobileOptimization: true
    },
    
    // Error Handling Configuration
    errors: {
        enableErrorReporting: true,
        enableUserFeedback: true,
        retryAttempts: 3,
        retryDelay: 2000
    },
    
    // UI Configuration
    ui: {
        theme: 'default',
        language: 'en',
        dateFormat: 'YYYY-MM-DD',
        numberFormat: 'en-US',
        showSyncStatus: true,
        showOfflineIndicator: true
    },
    
    // Performance Configuration
    performance: {
        enableCaching: true,
        cacheExpiry: 3600000, // 1 hour
        enableCompression: true,
        maxDataSize: 50 * 1024 * 1024, // 50MB
        enableLazyLoading: true
    }
};

// Environment-specific overrides
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    Config.dev.enableDebugLogging = true;
    Config.github.redirectUri = 'http://localhost:3000'; // For local development
}

// Freeze configuration to prevent runtime modifications
Object.freeze(Config);

// Export for use in other modules
window.Config = Config;
