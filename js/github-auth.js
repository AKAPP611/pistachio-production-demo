/**
 * GitHub Authentication Service
 * Handles OAuth 2.0 flow, token management, and user authentication
 */

class GitHubAuth {
    constructor() {
        this.config = window.Config;
        this.currentUser = null;
        this.accessToken = null;
        this.isInitialized = false;
        
        // Bind methods to preserve context
        this.login = this.login.bind(this);
        this.logout = this.logout.bind(this);
        this.handleCallback = this.handleCallback.bind(this);
        this.getCurrentUser = this.getCurrentUser.bind(this);
        this.isAuthenticated = this.isAuthenticated.bind(this);
    }
    
    /**
     * Initialize the authentication service
     */
    async init() {
        try {
            // Check for OAuth callback
            if (this.isOAuthCallback()) {
                await this.handleCallback();
                return;
            }
            
            // Try to restore existing session
            await this.restoreSession();
            
            this.isInitialized = true;
            
            if (this.config.dev.enableDebugLogging) {
                console.log('GitHubAuth initialized', { 
                    authenticated: this.isAuthenticated(),
                    user: this.currentUser?.login 
                });
            }
            
        } catch (error) {
            console.error('Failed to initialize GitHubAuth:', error);
            throw error;
        }
    }
    
    /**
     * Start OAuth login flow
     */
    login() {
        try {
            // Generate state parameter for CSRF protection
            const state = this.generateState();
            sessionStorage.setItem('oauth_state', state);
            
            // Build authorization URL
            const authUrl = new URL('https://github.com/login/oauth/authorize');
            authUrl.searchParams.set('client_id', this.config.github.clientId);
            authUrl.searchParams.set('redirect_uri', this.config.github.redirectUri);
            authUrl.searchParams.set('scope', this.config.github.scopes);
            authUrl.searchParams.set('state', state);
            
            // Show loading state
            this.showLoadingState();
            
            // Redirect to GitHub
            window.location.href = authUrl.toString();
            
        } catch (error) {
            console.error('Login failed:', error);
            this.showErrorState('Login failed. Please try again.');
        }
    }
    
    /**
     * Handle OAuth callback
     */
    async handleCallback() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const code = urlParams.get('code');
            const state = urlParams.get('state');
            const error = urlParams.get('error');
            
            // Handle OAuth errors
            if (error) {
                throw new Error(`OAuth error: ${error}`);
            }
            
            // Validate state parameter
            const savedState = sessionStorage.getItem('oauth_state');
            if (!state || state !== savedState) {
                throw new Error('Invalid state parameter');
            }
            
            // Clear state from session
            sessionStorage.removeItem('oauth_state');
            
            if (!code) {
                throw new Error('No authorization code received');
            }
            
            // Exchange code for access token
            await this.exchangeCodeForToken(code);
            
            // Get user information
            await this.fetchUserInfo();
            
            // Clean up URL
            window.history.replaceState({}, document.title, window.location.pathname);
            
            // Initialize application
            if (window.initializeApp) {
                window.initializeApp();
            }
            
        } catch (error) {
            console.error('OAuth callback failed:', error);
            this.showErrorState('Authentication failed. Please try again.');
            
            // Clear URL and redirect to login
            window.history.replaceState({}, document.title, window.location.pathname);
            this.showLoginScreen();
        }
    }
    
    /**
     * Exchange authorization code for access token
     */
    async exchangeCodeForToken(code) {
        try {
            // Note: In a real production environment, this should be done on a backend server
            // For GitHub Pages, we need to use a proxy service or GitHub Apps
            // This is a simplified implementation for demonstration
            
            const response = await fetch('https://github.com/login/oauth/access_token', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    client_id: this.config.github.clientId,
                    client_secret: this.config.github.clientSecret, // This should come from backend
                    code: code,
                    redirect_uri: this.config.github.redirectUri
                })
            });
            
            if (!response.ok) {
                throw new Error(`Token exchange failed: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error_description || data.error);
            }
            
            this.accessToken = data.access_token;
            
            // Store token securely
            this.storeToken(data.access_token);
            
        } catch (error) {
            console.error('Token exchange failed:', error);
            throw error;
        }
    }
    
    /**
     * Fetch current user information from GitHub API
     */
    async fetchUserInfo() {
        try {
            const response = await this.githubRequest('/user');
            this.currentUser = response;
            
            // Store user info
            this.storeUser(response);
            
            // Check repository access
            await this.checkRepositoryAccess();
            
        } catch (error) {
            console.error('Failed to fetch user info:', error);
            throw error;
        }
    }
    
    /**
     * Check if user has access to the repository
     */
    async checkRepositoryAccess() {
        try {
            const [owner, repo] = this.config.github.repo.split('/');
            await this.githubRequest(`/repos/${owner}/${repo}`);
            
            // User has access to repository
            this.currentUser.hasRepoAccess = true;
            
        } catch (error) {
            console.warn('Repository access check failed:', error);
            this.currentUser.hasRepoAccess = false;
            
            // Still allow access for public repositories or if error is not permission-related
            if (error.status !== 403 && error.status !== 404) {
                this.currentUser.hasRepoAccess = true;
            }
        }
    }
    
    /**
     * Make authenticated request to GitHub API
     */
    async githubRequest(endpoint, options = {}) {
        if (!this.accessToken) {
            throw new Error('No access token available');
        }
        
        const url = `${this.config.github.apiUrl}${endpoint}`;
        const config = {
            ...options,
            headers: {
                'Authorization': `token ${this.accessToken}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': `${this.config.app.name}/${this.config.app.version}`,
                ...options.headers
            }
        };
        
        const response = await fetch(url, config);
        
        if (!response.ok) {
            const error = new Error(`GitHub API request failed: ${response.status}`);
            error.status = response.status;
            error.response = response;
            throw error;
        }
        
        return await response.json();
    }
    
    /**
     * Get current authenticated user
     */
    getCurrentUser() {
        return this.currentUser;
    }
    
    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return !!(this.accessToken && this.currentUser);
    }
    
    /**
     * Get current access token
     */
    getAccessToken() {
        return this.accessToken;
    }
    
    /**
     * Logout user
     */
    logout() {
        // Clear stored data
        this.clearStoredData();
        
        // Reset state
        this.currentUser = null;
        this.accessToken = null;
        
        // Show login screen
        this.showLoginScreen();
        
        if (this.config.dev.enableDebugLogging) {
            console.log('User logged out');
        }
    }
    
    /**
     * Restore session from stored data
     */
    async restoreSession() {
        try {
            const token = this.getStoredToken();
            const user = this.getStoredUser();
            
            if (token && user) {
                this.accessToken = token;
                this.currentUser = user;
                
                // Verify token is still valid
                try {
                    await this.fetchUserInfo();
                } catch (error) {
                    // Token is invalid, clear stored data
                    this.clearStoredData();
                    throw error;
                }
            }
            
        } catch (error) {
            if (this.config.dev.enableDebugLogging) {
                console.log('Session restoration failed:', error);
            }
            // Don't throw error, just continue without authentication
        }
    }
    
    /**
     * Store access token securely
     */
    storeToken(token) {
        try {
            if (this.config.security.enableTokenEncryption) {
                // In a real implementation, encrypt the token
                token = this.encryptToken(token);
            }
            
            localStorage.setItem(this.config.auth.tokenKey, token);
            
        } catch (error) {
            console.error('Failed to store token:', error);
        }
    }
    
    /**
     * Get stored access token
     */
    getStoredToken() {
        try {
            let token = localStorage.getItem(this.config.auth.tokenKey);
            
            if (token && this.config.security.enableTokenEncryption) {
                token = this.decryptToken(token);
            }
            
            return token;
            
        } catch (error) {
            console.error('Failed to retrieve token:', error);
            return null;
        }
    }
    
    /**
     * Store user information
     */
    storeUser(user) {
        try {
            localStorage.setItem(this.config.auth.userKey, JSON.stringify(user));
        } catch (error) {
            console.error('Failed to store user:', error);
        }
    }
    
    /**
     * Get stored user information
     */
    getStoredUser() {
        try {
            const userJson = localStorage.getItem(this.config.auth.userKey);
            return userJson ? JSON.parse(userJson) : null;
        } catch (error) {
            console.error('Failed to retrieve user:', error);
            return null;
        }
    }
    
    /**
     * Clear all stored authentication data
     */
    clearStoredData() {
        localStorage.removeItem(this.config.auth.tokenKey);
        localStorage.removeItem(this.config.auth.userKey);
    }
    
    /**
     * Check if current URL is OAuth callback
     */
    isOAuthCallback() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.has('code') || urlParams.has('error');
    }
    
    /**
     * Generate random state parameter for CSRF protection
     */
    generateState() {
        const array = new Uint32Array(4);
        crypto.getRandomValues(array);
        return Array.from(array, dec => ('0' + dec.toString(16)).substr(-2)).join('');
    }
    
    /**
     * Basic token encryption (for demonstration)
     */
    encryptToken(token) {
        // In a real implementation, use proper encryption
        return btoa(token);
    }
    
    /**
     * Basic token decryption (for demonstration)
     */
    decryptToken(encryptedToken) {
        // In a real implementation, use proper decryption
        return atob(encryptedToken);
    }
    
    /**
     * Show loading state during authentication
     */
    showLoadingState() {
        const loginContent = document.getElementById('loginContent');
        const loadingContent = document.getElementById('loadingContent');
        
        if (loginContent) loginContent.style.display = 'none';
        if (loadingContent) loadingContent.style.display = 'block';
    }
    
    /**
     * Show error state
     */
    showErrorState(message) {
        const loginContent = document.getElementById('loginContent');
        const loadingContent = document.getElementById('loadingContent');
        
        if (loadingContent) loadingContent.style.display = 'none';
        if (loginContent) {
            loginContent.style.display = 'block';
            
            // Show error message
            let errorDiv = document.getElementById('errorMessage');
            if (!errorDiv) {
                errorDiv = document.createElement('div');
                errorDiv.id = 'errorMessage';
                errorDiv.style.cssText = 'background: #f8d7da; color: #721c24; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #f5c6cb;';
                loginContent.appendChild(errorDiv);
            }
            errorDiv.textContent = message;
        }
    }
    
    /**
     * Show login screen
     */
    showLoginScreen() {
        const loginScreen = document.getElementById('loginScreen');
        const mainApp = document.getElementById('mainApp');
        
        if (loginScreen) loginScreen.style.display = 'flex';
        if (mainApp) mainApp.style.display = 'none';
        
        // Reset loading states
        const loginContent = document.getElementById('loginContent');
        const loadingContent = document.getElementById('loadingContent');
        
        if (loginContent) loginContent.style.display = 'block';
        if (loadingContent) loadingContent.style.display = 'none';
        
        // Clear any error messages
        const errorDiv = document.getElementById('errorMessage');
        if (errorDiv) {
            errorDiv.remove();
        }
    }
}

// Create global instance
window.GitHubAuth = new GitHubAuth();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.GitHubAuth.init());
} else {
    window.GitHubAuth.init();
}