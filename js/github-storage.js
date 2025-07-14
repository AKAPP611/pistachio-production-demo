/**
 * GitHub Storage Service
 * Handles data persistence via GitHub Contents API with conflict resolution
 */

class GitHubStorage {
    constructor() {
        this.config = window.Config;
        this.auth = window.GitHubAuth;
        this.cache = new Map();
        this.lastSyncTime = null;
        this.syncInProgress = false;
        
        // SHA cache for conflict resolution
        this.shaCache = new Map();
    }
    
    /**
     * Initialize storage service
     */
    async init() {
        try {
            if (this.config.dev.enableDebugLogging) {
                console.log('GitHubStorage initializing...');
            }
            
            // Load initial data if authenticated
            if (this.auth.isAuthenticated()) {
                await this.loadAllData();
            }
            
        } catch (error) {
            console.error('Failed to initialize GitHubStorage:', error);
            throw error;
        }
    }
    
    /**
     * Save productions data to GitHub
     */
    async saveProductions(productions) {
        return await this.saveData('productions', productions);
    }
    
    /**
     * Load productions data from GitHub
     */
    async loadProductions() {
        return await this.loadData('productions') || [];
    }
    
    /**
     * Save materials data to GitHub
     */
    async saveMaterials(materials) {
        return await this.saveData('materials', materials);
    }
    
    /**
     * Load materials data from GitHub
     */
    async loadMaterials() {
        return await this.loadData('materials') || [];
    }
    
    /**
     * Save user preferences to GitHub
     */
    async saveUserPreferences(preferences) {
        return await this.saveData('users', preferences);
    }
    
    /**
     * Load user preferences from GitHub
     */
    async loadUserPreferences() {
        return await this.loadData('users') || {};
    }
    
    /**
     * Save application configuration to GitHub
     */
    async saveAppConfig(config) {
        return await this.saveData('config', config);
    }
    
    /**
     * Load application configuration from GitHub
     */
    async loadAppConfig() {
        return await this.loadData('config') || {};
    }
    
    /**
     * Generic method to save data to GitHub repository
     */
    async saveData(dataType, data) {
        try {
            if (!this.auth.isAuthenticated()) {
                throw new Error('User not authenticated');
            }
            
            const fileName = this.config.app.dataFiles[dataType];
            if (!fileName) {
                throw new Error(`Unknown data type: ${dataType}`);
            }
            
            // Serialize data
            const content = JSON.stringify(data, null, 2);
            const encodedContent = btoa(unescape(encodeURIComponent(content)));
            
            // Get current file SHA for conflict resolution
            let sha = this.shaCache.get(fileName);
            
            try {
                if (!sha) {
                    const currentFile = await this.getFileContents(fileName);
                    sha = currentFile.sha;
                    this.shaCache.set(fileName, sha);
                }
            } catch (error) {
                // File doesn't exist yet, which is fine for new repositories
                if (error.status !== 404) {
                    throw error;
                }
            }
            
            // Prepare commit data
            const commitData = {
                message: `Update ${dataType} data - ${new Date().toISOString()}`,
                content: encodedContent,
                branch: this.config.github.branch,
                committer: {
                    name: this.auth.getCurrentUser().name || this.auth.getCurrentUser().login,
                    email: this.auth.getCurrentUser().email || `${this.auth.getCurrentUser().login}@users.noreply.github.com`
                }
            };
            
            if (sha) {
                commitData.sha = sha;
            }
            
            // Save to GitHub
            const [owner, repo] = this.config.github.repo.split('/');
            const response = await this.auth.githubRequest(
                `/repos/${owner}/${repo}/contents/${fileName}`,
                {
                    method: 'PUT',
                    body: JSON.stringify(commitData)
                }
            );
            
            // Update SHA cache
            this.shaCache.set(fileName, response.content.sha);
            
            // Update local cache
            this.cache.set(dataType, data);
            
            // Update sync time
            this.lastSyncTime = new Date().toISOString();
            
            if (this.config.dev.enableDebugLogging) {
                console.log(`Successfully saved ${dataType} to GitHub`, response);
            }
            
            return response;
            
        } catch (error) {
            console.error(`Failed to save ${dataType}:`, error);
            
            // Handle conflicts
            if (error.status === 409) {
                return await this.handleSaveConflict(dataType, data);
            }
            
            throw error;
        }
    }
    
    /**
     * Generic method to load data from GitHub repository
     */
    async loadData(dataType) {
        try {
            if (!this.auth.isAuthenticated()) {
                // Return cached data if available
                return this.cache.get(dataType) || this.getLocalFallback(dataType);
            }
            
            const fileName = this.config.app.dataFiles[dataType];
            if (!fileName) {
                throw new Error(`Unknown data type: ${dataType}`);
            }
            
            // Check cache first
            if (this.cache.has(dataType) && !this.shouldRefreshCache(dataType)) {
                return this.cache.get(dataType);
            }
            
            const fileData = await this.getFileContents(fileName);
            
            // Decode and parse content
            const content = decodeURIComponent(escape(atob(fileData.content)));
            const data = JSON.parse(content);
            
            // Update cache and SHA
            this.cache.set(dataType, data);
            this.shaCache.set(fileName, fileData.sha);
            
            if (this.config.dev.enableDebugLogging) {
                console.log(`Successfully loaded ${dataType} from GitHub`);
            }
            
            return data;
            
        } catch (error) {
            console.error(`Failed to load ${dataType}:`, error);
            
            // Return cached data or local fallback
            return this.cache.get(dataType) || this.getLocalFallback(dataType);
        }
    }
    
    /**
     * Get file contents from GitHub repository
     */
    async getFileContents(filePath) {
        const [owner, repo] = this.config.github.repo.split('/');
        const response = await this.auth.githubRequest(
            `/repos/${owner}/${repo}/contents/${filePath}?ref=${this.config.github.branch}`
        );
        return response;
    }
    
    /**
     * Handle save conflicts with merge strategy
     */
    async handleSaveConflict(dataType, localData) {
        try {
            if (this.config.dev.enableDebugLogging) {
                console.log(`Handling conflict for ${dataType}`);
            }
            
            // Load current remote data
            this.cache.delete(dataType); // Force refresh
            const remoteData = await this.loadData(dataType);
            
            // Merge data based on type
            const mergedData = await this.mergeData(dataType, localData, remoteData);
            
            // Save merged data
            return await this.saveData(dataType, mergedData);
            
        } catch (error) {
            console.error(`Failed to resolve conflict for ${dataType}:`, error);
            throw error;
        }
    }
    
    /**
     * Merge local and remote data based on data type
     */
    async mergeData(dataType, localData, remoteData) {
        if (dataType === 'productions') {
            return this.mergeProductions(localData, remoteData);
        } else if (dataType === 'materials') {
            return this.mergeMaterials(localData, remoteData);
        } else {
            // For other data types, use timestamp-based merge
            return this.mergeByTimestamp(localData, remoteData);
        }
    }
    
    /**
     * Merge production records
     */
    mergeProductions(local, remote) {
        const merged = [...remote];
        const remoteIds = new Set(remote.map(p => p.id));
        
        // Add local records not in remote
        local.forEach(localProd => {
            if (!remoteIds.has(localProd.id)) {
                merged.push(localProd);
            } else {
                // Merge existing record by latest update time
                const remoteIndex = merged.findIndex(p => p.id === localProd.id);
                const remoteProd = merged[remoteIndex];
                
                const localTime = new Date(localProd.updatedAt || localProd.createdAt);
                const remoteTime = new Date(remoteProd.updatedAt || remoteProd.createdAt);
                
                if (localTime > remoteTime) {
                    merged[remoteIndex] = localProd;
                }
            }
        });
        
        // Sort by creation date
        return merged.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    
    /**
     * Merge material transactions
     */
    mergeMaterials(local, remote) {
        const merged = [...remote];
        const remoteIds = new Set(remote.map(m => m.id));
        
        // Add local transactions not in remote
        local.forEach(localMaterial => {
            if (!remoteIds.has(localMaterial.id)) {
                merged.push(localMaterial);
            }
        });
        
        // Sort by creation date
        return merged.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    
    /**
     * Generic timestamp-based merge
     */
    mergeByTimestamp(local, remote) {
        // Simple strategy: prefer most recent data
        const localTime = local.lastModified || 0;
        const remoteTime = remote.lastModified || 0;
        
        return localTime > remoteTime ? local : remote;
    }
    
    /**
     * Load all data types
     */
    async loadAllData() {
        try {
            const [productions, materials, userPrefs, appConfig] = await Promise.allSettled([
                this.loadProductions(),
                this.loadMaterials(),
                this.loadUserPreferences(),
                this.loadAppConfig()
            ]);
            
            return {
                productions: productions.status === 'fulfilled' ? productions.value : [],
                materials: materials.status === 'fulfilled' ? materials.value : [],
                userPreferences: userPrefs.status === 'fulfilled' ? userPrefs.value : {},
                appConfig: appConfig.status === 'fulfilled' ? appConfig.value : {}
            };
            
        } catch (error) {
            console.error('Failed to load all data:', error);
            throw error;
        }
    }
    
    /**
     * Save all data types
     */
    async saveAllData(data) {
        try {
            const results = await Promise.allSettled([
                this.saveProductions(data.productions || []),
                this.saveMaterials(data.materials || []),
                this.saveUserPreferences(data.userPreferences || {}),
                this.saveAppConfig(data.appConfig || {})
            ]);
            
            // Check for any failures
            const failures = results.filter(r => r.status === 'rejected');
            if (failures.length > 0) {
                console.warn('Some data saves failed:', failures);
            }
            
            return results;
            
        } catch (error) {
            console.error('Failed to save all data:', error);
            throw error;
        }
    }
    
    /**
     * Check if cache should be refreshed
     */
    shouldRefreshCache(dataType) {
        if (!this.config.performance.enableCaching) {
            return true;
        }
        
        const cacheTime = this.cache.get(`${dataType}_timestamp`);
        if (!cacheTime) {
            return true;
        }
        
        const age = Date.now() - cacheTime;
        return age > this.config.performance.cacheExpiry;
    }
    
    /**
     * Get local fallback data
     */
    getLocalFallback(dataType) {
        try {
            const key = `${this.config.storage.localStoragePrefix}${dataType}`;
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error(`Failed to get local fallback for ${dataType}:`, error);
            return null;
        }
    }
    
    /**
     * Store local fallback data
     */
    storeLocalFallback(dataType, data) {
        try {
            const key = `${this.config.storage.localStoragePrefix}${dataType}`;
            localStorage.setItem(key, JSON.stringify(data));
        } catch (error) {
            console.error(`Failed to store local fallback for ${dataType}:`, error);
        }
    }
    
    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
        this.shaCache.clear();
    }
    
    /**
     * Get sync status
     */
    getSyncStatus() {
        return {
            lastSyncTime: this.lastSyncTime,
            syncInProgress: this.syncInProgress,
            cacheSize: this.cache.size,
            isOnline: navigator.onLine
        };
    }
    
    /**
     * Force sync all data
     */
    async forceSync() {
        if (this.syncInProgress) {
            return false;
        }
        
        try {
            this.syncInProgress = true;
            this.clearCache();
            await this.loadAllData();
            return true;
        } catch (error) {
            console.error('Force sync failed:', error);
            return false;
        } finally {
            this.syncInProgress = false;
        }
    }
    
    /**
     * Create repository structure if it doesn't exist
     */
    async initializeRepository() {
        try {
            const [owner, repo] = this.config.github.repo.split('/');
            
            // Check if data directory exists
            try {
                await this.auth.githubRequest(`/repos/${owner}/${repo}/contents/data`);
            } catch (error) {
                if (error.status === 404) {
                    // Create initial data structure
                    await this.createInitialStructure();
                }
            }
            
        } catch (error) {
            console.error('Failed to initialize repository:', error);
            throw error;
        }
    }
    
    /**
     * Create initial repository structure
     */
    async createInitialStructure() {
        const initialData = {
            productions: [],
            materials: [],
            users: {},
            config: {
                version: this.config.app.version,
                createdAt: new Date().toISOString(),
                createdBy: this.auth.getCurrentUser().login
            }
        };
        
        await this.saveAllData(initialData);
    }
}

// Create global instance
window.GitHubStorage = new GitHubStorage();