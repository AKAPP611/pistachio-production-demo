/**
 * Offline Manager
 * Handles offline/online state management, sync queue, and service worker integration
 */

class OfflineManager {
    constructor() {
        this.config = window.Config;
        this.storage = window.GitHubStorage;
        this.auth = window.GitHubAuth;
        
        this.isOnline = navigator.onLine;
        this.syncQueue = [];
        this.retryAttempts = new Map();
        this.db = null;
        
        // Bind methods
        this.handleOnline = this.handleOnline.bind(this);
        this.handleOffline = this.handleOffline.bind(this);
        this.syncToCloud = this.syncToCloud.bind(this);
        this.addToSyncQueue = this.addToSyncQueue.bind(this);
    }
    
    /**
     * Initialize offline manager
     */
    async init() {
        try {
            if (this.config.dev.enableDebugLogging) {
                console.log('OfflineManager initializing...');
            }
            
            // Initialize IndexedDB
            await this.initIndexedDB();
            
            // Load sync queue from storage
            await this.loadSyncQueue();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Update UI with current state
            this.updateSyncStatus();
            
            // If online, process any queued operations
            if (this.isOnline && this.auth.isAuthenticated()) {
                setTimeout(() => this.processSyncQueue(), 1000);
            }
            
            if (this.config.dev.enableDebugLogging) {
                console.log('OfflineManager initialized', {
                    isOnline: this.isOnline,
                    queueLength: this.syncQueue.length
                });
            }
            
        } catch (error) {
            console.error('Failed to initialize OfflineManager:', error);
            throw error;
        }
    }
    
    /**
     * Initialize IndexedDB for offline storage
     */
    async initIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(
                this.config.storage.indexedDBName,
                this.config.storage.indexedDBVersion
            );
            
            request.onerror = () => {
                console.error('Failed to open IndexedDB:', request.error);
                reject(request.error);
            };
            
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create sync queue store
                if (!db.objectStoreNames.contains(this.config.storage.syncQueueStore)) {
                    const syncStore = db.createObjectStore(this.config.storage.syncQueueStore, {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    syncStore.createIndex('timestamp', 'timestamp', { unique: false });
                    syncStore.createIndex('type', 'type', { unique: false });
                }
                
                // Create offline data store
                if (!db.objectStoreNames.contains(this.config.storage.offlineDataStore)) {
                    const dataStore = db.createObjectStore(this.config.storage.offlineDataStore, {
                        keyPath: 'key'
                    });
                    dataStore.createIndex('lastModified', 'lastModified', { unique: false });
                }
            };
        });
    }
    
    /**
     * Set up event listeners for online/offline events
     */
    setupEventListeners() {
        window.addEventListener('online', this.handleOnline);
        window.addEventListener('offline', this.handleOffline);
        
        // Listen for visibility change to sync when app becomes visible
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.isOnline && this.auth.isAuthenticated()) {
                setTimeout(() => this.processSyncQueue(), 500);
            }
        });
        
        // Set up periodic sync if enabled
        if (this.config.sync.enableAutoSync) {
            setInterval(() => {
                if (this.isOnline && this.auth.isAuthenticated() && this.syncQueue.length > 0) {
                    this.processSyncQueue();
                }
            }, this.config.app.syncInterval);
        }
    }
    
    /**
     * Handle online event
     */
    handleOnline() {
        this.isOnline = true;
        this.updateSyncStatus('online');
        
        if (this.config.dev.enableDebugLogging) {
            console.log('Device came online');
        }
        
        // Process sync queue after a short delay
        if (this.auth.isAuthenticated()) {
            setTimeout(() => this.processSyncQueue(), 1000);
        }
    }
    
    /**
     * Handle offline event
     */
    handleOffline() {
        this.isOnline = false;
        this.updateSyncStatus('offline');
        
        if (this.config.dev.enableDebugLogging) {
            console.log('Device went offline');
        }
    }
    
    /**
     * Add operation to sync queue
     */
    async addToSyncQueue(operation) {
        try {
            const queueItem = {
                ...operation,
                timestamp: new Date().toISOString(),
                attempts: 0,
                maxAttempts: this.config.app.offlineRetries
            };
            
            // Add to memory queue
            this.syncQueue.push(queueItem);
            
            // Persist to IndexedDB
            await this.persistSyncQueue();
            
            // Update UI
            this.updateSyncStatus();
            
            // If online, try to sync immediately
            if (this.isOnline && this.auth.isAuthenticated()) {
                setTimeout(() => this.processSyncQueue(), 100);
            }
            
            if (this.config.dev.enableDebugLogging) {
                console.log('Added to sync queue:', operation);
            }
            
        } catch (error) {
            console.error('Failed to add to sync queue:', error);
        }
    }
    
    /**
     * Process sync queue
     */
    async processSyncQueue() {
        if (!this.isOnline || !this.auth.isAuthenticated() || this.syncQueue.length === 0) {
            return;
        }
        
        try {
            this.updateSyncStatus('syncing');
            
            const itemsToProcess = [...this.syncQueue];
            let processedCount = 0;
            
            for (let i = 0; i < itemsToProcess.length; i++) {
                const item = itemsToProcess[i];
                
                try {
                    await this.processSyncItem(item);
                    
                    // Remove from queue
                    this.syncQueue = this.syncQueue.filter(q => q.id !== item.id);
                    processedCount++;
                    
                } catch (error) {
                    console.error('Failed to process sync item:', error);
                    
                    // Increment attempts
                    item.attempts = (item.attempts || 0) + 1;
                    
                    // Remove if max attempts reached
                    if (item.attempts >= item.maxAttempts) {
                        console.warn('Max sync attempts reached for item:', item);
                        this.syncQueue = this.syncQueue.filter(q => q.id !== item.id);
                        
                        // Optionally store failed items for manual retry
                        await this.storeFailedItem(item, error);
                    }
                }
            }
            
            // Persist updated queue
            await this.persistSyncQueue();
            
            // Update UI
            this.updateSyncStatus(this.syncQueue.length > 0 ? 'pending' : 'synced');
            
            if (this.config.dev.enableDebugLogging) {
                console.log(`Processed ${processedCount} sync items, ${this.syncQueue.length} remaining`);
            }
            
        } catch (error) {
            console.error('Failed to process sync queue:', error);
            this.updateSyncStatus('error');
        }
    }
    
    /**
     * Process individual sync item
     */
    async processSyncItem(item) {
        switch (item.type) {
            case 'saveProductions':
                await this.storage.saveProductions(item.data);
                break;
                
            case 'saveMaterials':
                await this.storage.saveMaterials(item.data);
                break;
                
            case 'saveUserPreferences':
                await this.storage.saveUserPreferences(item.data);
                break;
                
            case 'saveAppConfig':
                await this.storage.saveAppConfig(item.data);
                break;
                
            default:
                throw new Error(`Unknown sync item type: ${item.type}`);
        }
    }
    
    /**
     * Sync data to cloud
     */
    async syncToCloud(dataType, data) {
        if (!this.isOnline) {
            // Add to queue for later sync
            await this.addToSyncQueue({
                id: this.generateId(),
                type: `save${dataType.charAt(0).toUpperCase() + dataType.slice(1)}`,
                data: data
            });
            return false;
        }
        
        try {
            if (!this.auth.isAuthenticated()) {
                throw new Error('User not authenticated');
            }
            
            // Try immediate sync
            switch (dataType) {
                case 'productions':
                    await this.storage.saveProductions(data);
                    break;
                case 'materials':
                    await this.storage.saveMaterials(data);
                    break;
                default:
                    throw new Error(`Unknown data type: ${dataType}`);
            }
            
            this.updateSyncStatus('synced');
            return true;
            
        } catch (error) {
            console.error(`Failed to sync ${dataType}:`, error);
            
            // Add to queue for retry
            await this.addToSyncQueue({
                id: this.generateId(),
                type: `save${dataType.charAt(0).toUpperCase() + dataType.slice(1)}`,
                data: data
            });
            
            return false;
        }
    }
    
    /**
     * Load data with offline support
     */
    async loadDataOffline(dataType) {
        try {
            // Try to load from cloud first if online
            if (this.isOnline && this.auth.isAuthenticated()) {
                const cloudData = await this.storage.loadData(dataType);
                
                // Store in offline cache
                await this.storeOfflineData(dataType, cloudData);
                
                return cloudData;
            }
            
            // Load from offline cache
            const offlineData = await this.getOfflineData(dataType);
            if (offlineData) {
                return offlineData;
            }
            
            // Fallback to localStorage
            return this.storage.getLocalFallback(dataType) || [];
            
        } catch (error) {
            console.error(`Failed to load ${dataType} offline:`, error);
            
            // Try offline cache
            const offlineData = await this.getOfflineData(dataType);
            if (offlineData) {
                return offlineData;
            }
            
            // Final fallback to localStorage
            return this.storage.getLocalFallback(dataType) || [];
        }
    }
    
    /**
     * Store data in offline cache
     */
    async storeOfflineData(key, data) {
        if (!this.db) return;
        
        try {
            const transaction = this.db.transaction([this.config.storage.offlineDataStore], 'readwrite');
            const store = transaction.objectStore(this.config.storage.offlineDataStore);
            
            await store.put({
                key: key,
                data: data,
                lastModified: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('Failed to store offline data:', error);
        }
    }
    
    /**
     * Get data from offline cache
     */
    async getOfflineData(key) {
        if (!this.db) return null;
        
        try {
            const transaction = this.db.transaction([this.config.storage.offlineDataStore], 'readonly');
            const store = transaction.objectStore(this.config.storage.offlineDataStore);
            
            return new Promise((resolve, reject) => {
                const request = store.get(key);
                
                request.onsuccess = () => {
                    const result = request.result;
                    resolve(result ? result.data : null);
                };
                
                request.onerror = () => {
                    reject(request.error);
                };
            });
            
        } catch (error) {
            console.error('Failed to get offline data:', error);
            return null;
        }
    }
    
    /**
     * Persist sync queue to IndexedDB
     */
    async persistSyncQueue() {
        if (!this.db) return;
        
        try {
            const transaction = this.db.transaction([this.config.storage.syncQueueStore], 'readwrite');
            const store = transaction.objectStore(this.config.storage.syncQueueStore);
            
            // Clear existing queue
            await store.clear();
            
            // Add current queue items
            for (const item of this.syncQueue) {
                await store.add(item);
            }
            
        } catch (error) {
            console.error('Failed to persist sync queue:', error);
        }
    }
    
    /**
     * Load sync queue from IndexedDB
     */
    async loadSyncQueue() {
        if (!this.db) return;
        
        try {
            const transaction = this.db.transaction([this.config.storage.syncQueueStore], 'readonly');
            const store = transaction.objectStore(this.config.storage.syncQueueStore);
            
            return new Promise((resolve, reject) => {
                const request = store.getAll();
                
                request.onsuccess = () => {
                    this.syncQueue = request.result || [];
                    resolve(this.syncQueue);
                };
                
                request.onerror = () => {
                    reject(request.error);
                };
            });
            
        } catch (error) {
            console.error('Failed to load sync queue:', error);
            this.syncQueue = [];
        }
    }
    
    /**
     * Store failed sync item for manual retry
     */
    async storeFailedItem(item, error) {
        try {
            const failedItems = JSON.parse(localStorage.getItem('failed_sync_items') || '[]');
            failedItems.push({
                ...item,
                error: error.message,
                failedAt: new Date().toISOString()
            });
            
            // Keep only last 50 failed items
            if (failedItems.length > 50) {
                failedItems.splice(0, failedItems.length - 50);
            }
            
            localStorage.setItem('failed_sync_items', JSON.stringify(failedItems));
            
        } catch (error) {
            console.error('Failed to store failed item:', error);
        }
    }
    
    /**
     * Update sync status in UI
     */
    updateSyncStatus(status) {
        const indicator = document.getElementById('syncIndicator');
        const statusText = document.getElementById('syncStatus');
        
        if (!indicator || !statusText) return;
        
        // Determine status
        const currentStatus = status || (this.isOnline ? 
            (this.syncQueue.length > 0 ? 'pending' : 'synced') : 'offline');
        
        // Update indicator
        indicator.className = 'sync-indicator';
        switch (currentStatus) {
            case 'syncing':
                indicator.classList.add('syncing');
                statusText.textContent = 'Syncing...';
                break;
            case 'pending':
                indicator.classList.add('syncing');
                statusText.textContent = `${this.syncQueue.length} pending`;
                break;
            case 'offline':
                indicator.classList.add('offline');
                statusText.textContent = 'Offline';
                break;
            case 'error':
                indicator.classList.add('offline');
                statusText.textContent = 'Sync error';
                break;
            default:
                statusText.textContent = 'Synced';
        }
    }
    
    /**
     * Generate unique ID for sync items
     */
    generateId() {
        return Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }
    
    /**
     * Force sync all pending items
     */
    async forceSyncAll() {
        if (!this.isOnline || !this.auth.isAuthenticated()) {
            throw new Error('Cannot sync while offline or unauthenticated');
        }
        
        await this.processSyncQueue();
        return this.syncQueue.length === 0;
    }
    
    /**
     * Clear sync queue
     */
    async clearSyncQueue() {
        this.syncQueue = [];
        await this.persistSyncQueue();
        this.updateSyncStatus();
    }
    
    /**
     * Get sync statistics
     */
    getSyncStats() {
        return {
            isOnline: this.isOnline,
            queueLength: this.syncQueue.length,
            lastSyncTime: this.storage.lastSyncTime,
            totalRetryAttempts: Array.from(this.retryAttempts.values()).reduce((sum, attempts) => sum + attempts, 0)
        };
    }
}

// Create global instance
window.OfflineManager = new OfflineManager();
