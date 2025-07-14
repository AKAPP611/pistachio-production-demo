# 🥜 Pistachio Production Management - GitHub Pages Edition

[![Deploy to GitHub Pages](https://github.com/your-username/pistachio-production/workflows/Deploy%20to%20GitHub%20Pages/badge.svg)](https://github.com/your-username/pistachio-production/actions)
[![Data Backup](https://github.com/your-username/pistachio-production/workflows/Data%20Backup%20and%20Validation/badge.svg)](https://github.com/your-username/pistachio-production/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A comprehensive, cloud-powered pistachio production management system built for GitHub Pages with real-time synchronization, offline capabilities, and team collaboration features.

## ✨ Features

### 🚀 **Enhanced Cloud Integration**
- **GitHub OAuth Authentication** - Secure login with your GitHub account
- **Real-time Data Synchronization** - Automatic cloud backup and sync across devices
- **Offline-First Architecture** - Works seamlessly without internet connection
- **Conflict Resolution** - Smart merging of concurrent edits
- **Automatic Backups** - Daily automated backups with version control

### 📱 **Mobile & Accessibility**
- **Progressive Web App (PWA)** - Install on mobile devices like a native app
- **Mobile Data Entry** - Quick production entry via GitHub Issues
- **Responsive Design** - Optimized for all screen sizes
- **Offline Mode** - Full functionality without internet
- **Touch-Friendly Interface** - Designed for field use

### 👥 **Team Collaboration**
- **Multi-User Support** - Role-based access with GitHub permissions
- **Real-Time Updates** - See changes from team members instantly
- **Audit Trail** - Complete history of all changes with user tracking
- **Concurrent Editing** - Multiple users can work simultaneously

### 📊 **Advanced Features**
- **Enhanced Reporting** - Detailed production analytics and charts
- **Data Export** - CSV export for external analysis
- **Print Reports** - Professional production reports
- **Material Tracking** - Comprehensive packaging material management
- **Quality Control** - Reject categorization and tracking

## 🚀 Quick Start

### 1. Fork & Setup Repository

1. **Fork this repository** to your GitHub account
2. **Enable GitHub Pages** in repository settings
3. **Create a GitHub OAuth App**:
   - Go to GitHub Settings → Developer settings → OAuth Apps
   - Click "New OAuth App"
   - Fill in details:
     - Application name: `Pistachio Production Management`
     - Homepage URL: `https://your-username.github.io/pistachio-production/`
     - Authorization callback URL: `https://your-username.github.io/pistachio-production/`
   - Note down the **Client ID** and **Client Secret**

### 2. Configure OAuth

Edit `js/config.js` and update:

```javascript
github: {
    clientId: 'your-oauth-app-client-id', // Replace with your OAuth app client ID
    repo: 'your-username/pistachio-production', // Replace with your repository
    // ... other settings
}
```

### 3. Repository Settings

1. **Enable Issues** in repository settings (for mobile data entry)
2. **Set up branch protection** for the main branch (recommended)
3. **Configure GitHub Pages** to deploy from GitHub Actions

### 4. Deploy

Push your changes to the main branch. GitHub Actions will automatically:
- Validate the code
- Build the application
- Deploy to GitHub Pages
- Run health checks

Your application will be available at: `https://your-username.github.io/pistachio-production/`

## 📋 Prerequisites

- GitHub account with repository access
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Internet connection for initial setup (offline mode available after setup)

## 🔧 Configuration

### Environment Variables

The application uses configuration in `js/config.js`. Key settings:

```javascript
const Config = {
    github: {
        clientId: 'your-client-id',           // OAuth app client ID
        repo: 'owner/repository-name',         // Your repository
        branch: 'main'                         // Default branch
    },
    app: {
        syncInterval: 30000,                   // Sync interval (30 seconds)
        offlineRetries: 3                      // Retry attempts for failed syncs
    }
    // ... more configuration options
};
```

### Feature Flags

Enable/disable features in the configuration:

```javascript
features: {
    enableGitHubIssues: true,      // Mobile data entry via Issues
    enableAdvancedReporting: true, // Enhanced reporting features
    enableRealTimeSync: true,      // Real-time synchronization
    enableOfflineMode: true        // Offline functionality
}
```

## 📱 Mobile Data Entry

The system supports mobile data entry through GitHub Issues:

### Production Entry
- Navigate to Issues tab in your repository
- Click "New Issue" → "Production Entry"
- Fill out the mobile-optimized form
- Submit to automatically add production data

### Material Addition
- Use the "Material Addition" issue template
- Perfect for receiving deliveries or stock counts
- Automatically updates inventory levels

## 🔄 Data Synchronization

### How It Works
1. **Local First** - All changes saved locally immediately
2. **Automatic Sync** - Changes synced to GitHub every 30 seconds
3. **Conflict Resolution** - Smart merging of concurrent edits
4. **Offline Queue** - Changes queued when offline, synced when online

### Sync Status Indicators
- 🟢 **Synced** - All data synchronized
- 🟡 **Syncing** - Synchronization in progress
- 🔴 **Offline** - No internet connection
- ⚠️ **Pending** - Changes waiting to sync

## 🔒 Security Features

### Authentication
- **GitHub OAuth 2.0** for secure authentication
- **Token encryption** for stored credentials
- **CSRF protection** with state parameters
- **Session management** with automatic refresh

### Data Protection
- **Repository permissions** control access
- **Encrypted token storage** in browser
- **Audit logging** for all changes
- **Automatic backups** with version control

## 🛠️ Development

### Local Development

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/pistachio-production.git
   cd pistachio-production
   ```

2. **Serve locally** (Python example):
   ```bash
   python -m http.server 8000
   ```

3. **Open in browser**: `http://localhost:8000`

### File Structure

```
pistachio-production/
├── index.html                    # Main application file
├── manifest.json                # PWA manifest
├── sw.js                       # Service worker for offline support
├── js/
│   ├── config.js               # Application configuration
│   ├── github-auth.js          # GitHub authentication service
│   ├── github-storage.js       # Cloud storage service
│   ├── offline-manager.js      # Offline functionality
│   └── enhanced-app.js         # Main application logic
├── data/                       # Data storage (created automatically)
│   ├── productions.json        # Production records
│   ├── materials.json          # Material transactions
│   ├── users.json             # User preferences
│   └── config.json            # Application settings
├── .github/
│   ├── workflows/
│   │   ├── deploy.yml          # Deployment automation
│   │   └── backup.yml          # Data backup automation
│   └── ISSUE_TEMPLATE/
│       ├── production-entry.yml # Mobile production entry
│       └── material-addition.yml # Mobile material addition
└── backups/                    # Automated backups (created by Actions)
```

### Adding Features

1. **Create feature branch**:
   ```bash
   git checkout -b feature/new-feature
   ```

2. **Make changes** to the appropriate files

3. **Test thoroughly** with different scenarios

4. **Submit pull request** for review

## 📊 Backup & Recovery

### Automated Backups
- **Daily backups** at 2 AM UTC
- **Incremental backups** for changed files
- **30-day retention** (configurable)
- **Integrity validation** with checksums

### Manual Backup
```bash
# Trigger manual backup
curl -X POST \
  -H "Authorization: token YOUR_GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/YOUR_USERNAME/pistachio-production/actions/workflows/backup.yml/dispatches \
  -d '{"ref":"main","inputs":{"backup_type":"full"}}'
```

### Recovery Process
1. Navigate to the backups folder
2. Download the required backup archive
3. Extract and verify checksums
4. Replace data files with backup versions
5. Commit and push changes

## 🔧 Troubleshooting

### Common Issues

#### Authentication Problems
- **Issue**: OAuth login fails
- **Solution**: Verify OAuth app configuration and callback URLs

#### Sync Issues
- **Issue**: Data not syncing
- **Solution**: Check network connection and GitHub API limits

#### Offline Mode
- **Issue**: App not working offline
- **Solution**: Ensure service worker is registered and cached properly

### Debug Mode

Enable debug logging in `js/config.js`:

```javascript
dev: {
    enableDebugLogging: true
}
```

### Health Checks

The deployment workflow includes automatic health checks:
- Site accessibility test
- Manifest file validation
- Service worker verification
- Performance audit with Lighthouse

## 📈 Performance

### Optimization Features
- **Service Worker caching** for instant loading
- **Lazy loading** for large datasets
- **Data compression** for reduced bandwidth
- **Efficient diff algorithms** for sync operations

### Performance Metrics
- **First Paint**: < 1 second
- **Interactive**: < 3 seconds
- **Offline Activation**: < 1 second
- **Sync Completion**: < 5 seconds (typical)

## 🤝 Contributing

### Development Process
1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Submit a pull request
5. Code review and merge

### Coding Standards
- Use ES6+ JavaScript features
- Follow existing code style
- Add comments for complex logic
- Include error handling
- Test offline scenarios

### Issue Templates
Use the provided issue templates for:
- 🐛 Bug reports
- ✨ Feature requests
- 📊 Production data entry
- 📦 Material additions

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- GitHub Pages for free hosting
- GitHub Actions for automation
- Service Workers for offline functionality
- Progressive Web App standards

## 📞 Support

### Getting Help
- **Documentation**: Check this README and inline comments
- **Issues**: Use GitHub Issues for bug reports and feature requests
- **Discussions**: Use GitHub Discussions for questions and ideas

### Contact
- **Repository**: https://github.com/your-username/pistachio-production
- **Issues**: https://github.com/your-username/pistachio-production/issues
- **Wiki**: https://github.com/your-username/pistachio-production/wiki

---

**Made with ❤️ for the pistachio production industry**

*Transform your production management with modern web technologies!*
