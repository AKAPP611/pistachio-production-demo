/**
 * GitHub Authentication Service - Frontend Only
 * Handles OAuth 2.0 flow for GitHub Pages without backend
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
            console.log('GitHubAuth initializing...');
            
            // Check for OAuth callback
            if (this.isOAuthCallback()) {
                console.log('OAuth callback detected');
                await this.handleCallback();
                return;
            }
            
            // Try to restore existing session
            await this.restoreSession();
            
            this.isInitialized = true;
            
            // Show appropriate screen
            if (this.isAuthenticated()) {
                this.showMainApp();
            } else {
                this.showLoginScreen();
            }
            
            console.log('GitHubAuth initialized', { 
                authenticated: this.isAuthenticated(),
                user: this.currentUser?.login 
            });
            
        } catch (error) {
            console.error('Failed to initialize GitHubAuth:', error);
            this.showErrorState('Failed to initialize authentication: ' + error.message);
        }
    }
    
    /**
     * Start OAuth login flow
     */
    login() {
        try {
            console.log('Starting OAuth login...');
            
            // Generate state parameter for CSRF protection
            const state = this.generateState();
            sessionStorage.setItem('oauth_state', state);
            
            // Build authorization URL
            const authUrl = new URL('https://github.com/login/oauth/authorize');
            authUrl.searchParams.set('client_id', this.config.github.clientId);
            authUrl.searchParams.set('redirect_uri', this.config.github.redirectUri);
            authUrl.searchParams.set('scope', this.config.github.scopes);
            authUrl.searchParams.set('state', state);
            
            console.log('OAuth URL:', authUrl.toString());
            console.log('Client ID:', this.config.github.clientId);
            console.log('Redirect URI:', this.config.github.redirectUri);
            
            // Show loading state
            this.showLoadingState();
            
            // Redirect to GitHub
            window.location.href = authUrl.toString();
            
        } catch (error) {
            console.error('Login failed:', error);
            this.showErrorState('Login failed: ' + error.message);
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
            
            console.log('OAuth callback params:', { code: !!code, state: !!state, error });
            
            // Handle OAuth errors
            if (error) {
                throw new Error(`OAuth error: ${error} - ${urlParams.get('error_description')}`);
            }
            
            // Validate state parameter
            const savedState = sessionStorage.getItem('oauth_state');
            if (!state || state !== savedState) {
                throw new Error('Invalid state parameter - possible CSRF attack');
            }
            
            // Clear state from session
            sessionStorage.removeItem('oauth_state');
            
            if (!code) {
                throw new Error('No authorization code received');
            }
            
            console.log('OAuth code received, exchanging for token...');
            
            // Exchange code for access token using a proxy service
            await this.exchangeCodeForToken(code);
            
            // Get user information
            await this.fetchUserInfo();
            
            // Clean up URL
            window.history.replaceState({}, document.title, window.location.pathname);
            
            // Show main application
            this.showMainApp();
            
            console.log('OAuth flow completed successfully');
            
        } catch (error) {
            console.error('OAuth callback failed:', error);
            this.showErrorState('Authentication failed: ' + error.message);
            
            // Clear URL and redirect to login
            window.history.replaceState({}, document.title, window.location.pathname);
            this.showLoginScreen();
        }
    }
    
    /**
     * Exchange authorization code for access token
     * Uses a proxy service since we can't expose client secret in frontend
     */
    async exchangeCodeForToken(code) {
        try {
            // Option 1: Use a free proxy service (like github-oauth-proxy.herokuapp.com)
            // Option 2: Use your own proxy service
            // Option 3: Use GitHub Apps instead of OAuth Apps
            
            // For now, we'll use a simplified approach with a public proxy
            // In production, you should use your own secure proxy
            
            const proxyUrl = 'https://cors-anywhere.herokuapp.com/https://github.com/login/oauth/access_token';
            
            const response = await fetch(proxyUrl, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify({
                    client_id: this.config.github.clientId,
                    client_secret: 'YOUR_CLIENT_SECRET', // This needs to be handled by a backend service
                    code: code,
                    redirect_uri: this.config.github.redirectUri
                })
            });
            
            if (!response.ok) {
                throw new Error(`Token exchange failed: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error_description || data.error);
            }
            
            this.accessToken = data.access_token;
            
            // Store token securely
            this.storeToken(data.access_token);
            
            console.log('Access token obtained successfully');
            
        } catch (error) {
            console.error('Token exchange failed:', error);
            
            // For demo purposes, we'll show a message about needing a backend
            throw new Error('Token exchange requires a backend service. For GitHub Pages, consider using GitHub Apps or a proxy service.');
        }
    }
    
    /**
     * Fetch current user information from GitHub API
     */
    async fetchUserInfo() {
        try {
            const response = await this.githubRequest('/user');
            this.currentUser = response;
            
            console.log('User info fetched:', this.currentUser.login);
            
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
            
            this.currentUser.hasRepoAccess = true;
            console.log('Repository access confirmed');
            
        } catch (error) {
            console.warn('Repository access check failed:', error);
            this.currentUser.hasRepoAccess = false;
            
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
        console.log('Logging out user');
        
        // Clear stored data
        this.clearStoredData();
        
        // Reset state
        this.currentUser = null;
        this.accessToken = null;
        
        // Show login screen
        this.showLoginScreen();
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
                
                console.log('Session restored for user:', user.login);
                
                // Verify token is still valid
                try {
                    await this.fetchUserInfo();
                } catch (error) {
                    console.log('Stored token invalid, clearing session');
                    this.clearStoredData();
                    throw error;
                }
            }
            
        } catch (error) {
            console.log('Session restoration failed:', error.message);
            // Don't throw error, just continue without authentication
        }
    }
    
    /**
     * Store access token securely
     */
    storeToken(token) {
        try {
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
            return localStorage.getItem(this.config.auth.tokenKey);
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
        console.error('Auth Error:', message);
        
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
            errorDiv.innerHTML = `
                <strong>Authentication Error:</strong><br>
                ${message}<br><br>
                <small>Check the browser console for more details.</small>
            `;
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
    }
    
    /**
     * Show main application
     */
    showMainApp() {
        const loginScreen = document.getElementById('loginScreen');
        const mainApp = document.getElementById('mainApp');
        
        if (loginScreen) loginScreen.style.display = 'none';
        if (mainApp) mainApp.style.display = 'block';
        
        // Update user display
        this.updateUserDisplay();
        
        // Initialize application if function exists
        if (typeof window.initializeApp === 'function') {
            window.initializeApp();
        }
    }
    
    /**
     * Update user display in header
     */
    updateUserDisplay() {
        if (!this.currentUser) return;
        
        const userDisplay = document.getElementById('userDisplay');
        const userAvatar = document.getElementById('userAvatar');
        
        if (userDisplay) {
            userDisplay.textContent = this.currentUser.login;
        }
        
        if (userAvatar && this.currentUser.avatar_url) {
            userAvatar.src = this.currentUser.avatar_url;
            userAvatar.style.display = 'block';
        }
    }
}

// Create global instance
window.GitHubAuth = new GitHubAuth();
