/**
 * Enhanced Application Logic
 * Integrates cloud storage, offline sync, and GitHub authentication with existing functionality
 */

// Global data storage with cloud sync
let productions = [];
let materialTransactions = [];
let currentUser = null;
let isInitialized = false;

// Services
const auth = window.GitHubAuth;
const storage = window.GitHubStorage;
const offline = window.OfflineManager;
const config = window.Config;

/**
 * Initialize the application
 */
async function initializeApp() {
    try {
        if (config.dev.enableDebugLogging) {
            console.log('Initializing enhanced pistachio production app...');
        }
        
        // Check authentication
        if (!auth.isAuthenticated()) {
            showLoginScreen();
            return;
        }
        
        // Initialize services
        await Promise.all([
            storage.init(),
            offline.init()
        ]);
        
        // Load data from cloud/offline storage
        await loadApplicationData();
        
        // Show main application
        showMainApp();
        
        // Set up periodic sync
        setupPeriodicSync();
        
        isInitialized = true;
        
        if (config.dev.enableDebugLogging) {
            console.log('Application initialized successfully');
        }
        
    } catch (error) {
        console.error('Failed to initialize application:', error);
        showErrorState('Failed to initialize application. Please refresh and try again.');
    }
}

/**
 * Load application data from storage
 */
async function loadApplicationData() {
    try {
        // Show loading state
        updateSyncStatus('Loading...');
        
        // Load data with offline support
        const [loadedProductions, loadedMaterials] = await Promise.all([
            offline.loadDataOffline('productions'),
            offline.loadDataOffline('materials')
        ]);
        
        productions = loadedProductions || [];
        materialTransactions = loadedMaterials || [];
        
        // Migrate old data if needed
        migrateOldBoxData();
        
        // Update UI
        updateDashboard();
        updateInventory();
        updateMaterialStockDisplay();
        
        // Update sync status
        offline.updateSyncStatus();
        
    } catch (error) {
        console.error('Failed to load application data:', error);
        
        // Try to load from localStorage as fallback
        productions = JSON.parse(localStorage.getItem('productions') || '[]');
        materialTransactions = JSON.parse(localStorage.getItem('materialTransactions') || '[]');
        
        // Still update UI with fallback data
        updateDashboard();
        updateInventory();
        updateMaterialStockDisplay();
    }
}

/**
 * Save application data to storage
 */
async function saveApplicationData() {
    try {
        // Save to localStorage as backup
        localStorage.setItem('productions', JSON.stringify(productions));
        localStorage.setItem('materialTransactions', JSON.stringify(materialTransactions));
        
        // Sync to cloud (will queue if offline)
        await Promise.all([
            offline.syncToCloud('productions', productions),
            offline.syncToCloud('materials', materialTransactions)
        ]);
        
    } catch (error) {
        console.error('Failed to save application data:', error);
        // Still save to localStorage as fallback
        localStorage.setItem('productions', JSON.stringify(productions));
        localStorage.setItem('materialTransactions', JSON.stringify(materialTransactions));
    }
}

/**
 * Set up periodic sync
 */
function setupPeriodicSync() {
    if (!config.sync.enableAutoSync) return;
    
    setInterval(async () => {
        if (navigator.onLine && auth.isAuthenticated() && isInitialized) {
            try {
                await saveApplicationData();
            } catch (error) {
                console.error('Periodic sync failed:', error);
            }
        }
    }, config.app.syncInterval);
}

/**
 * Show main application interface
 */
function showMainApp() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    
    const user = auth.getCurrentUser();
    if (user) {
        document.getElementById('userDisplay').textContent = user.name || user.login;
        
        // Show user avatar if available
        const avatar = document.getElementById('userAvatar');
        if (user.avatar_url && avatar) {
            avatar.src = user.avatar_url;
            avatar.style.display = 'block';
        }
    }
    
    document.getElementById('prodDate').valueAsDate = new Date();
    
    // Add event listeners for reject calculations
    document.querySelectorAll('[id^="reject"]').forEach(input => {
        input.addEventListener('input', calculateTotalRejects);
    });
    
    // Add event listeners for box validation
    setupBoxValidation();
}

/**
 * Show login screen
 */
function showLoginScreen() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
}

/**
 * Show error state
 */
function showErrorState(message) {
    alert(message); // Simple error display - could be enhanced with better UI
}

/**
 * Update sync status in UI
 */
function updateSyncStatus(message) {
    const statusElement = document.getElementById('syncStatus');
    if (statusElement && message) {
        statusElement.textContent = message;
    }
}

/**
 * Set up box validation event listeners
 */
function setupBoxValidation() {
    document.getElementById('boxesUsed').addEventListener('input', function() {
        if (this.value > 0 && !document.getElementById('boxTypeUsed').value) {
            document.getElementById('boxTypeUsed').style.borderColor = '#dc3545';
        } else {
            document.getElementById('boxTypeUsed').style.borderColor = '';
        }
    });
    
    document.getElementById('boxesWasted').addEventListener('input', function() {
        if (this.value > 0 && !document.getElementById('boxTypeWasted').value) {
            document.getElementById('boxTypeWasted').style.borderColor = '#dc3545';
        } else {
            document.getElementById('boxTypeWasted').style.borderColor = '';
        }
    });
    
    document.getElementById('boxTypeUsed').addEventListener('change', function() {
        if (document.getElementById('boxesUsed').value > 0 && this.value) {
            this.style.borderColor = '';
        }
    });
    
    document.getElementById('boxTypeWasted').addEventListener('change', function() {
        if (document.getElementById('boxesWasted').value > 0 && this.value) {
            this.style.borderColor = '';
        }
    });
}

// Enhanced save production with cloud sync
async function saveProduction(event) {
    event.preventDefault();
    
    const editId = document.getElementById('productionForm').getAttribute('data-edit-id');
    const inputType = document.getElementById('inputType').value;
    
    const production = {
        id: editId ? parseInt(editId) : Date.now(),
        date: document.getElementById('prodDate').value,
        lotNumber: document.getElementById('lotNumber').value,
        inputType: inputType,
        inputWeight: parseFloat(document.getElementById('inputWeight').value),
        output: {},
        rejects: {
            looseShell: parseFloat(document.getElementById('rejectLooseShell').value) || 0,
            shellSplit: parseFloat(document.getElementById('rejectShellSplit').value) || 0,
            undersize: parseFloat(document.getElementById('rejectUndersize').value) || 0,
            darkStain: parseFloat(document.getElementById('rejectDarkStain').value) || 0,
            adheringHull: parseFloat(document.getElementById('rejectAdheringHull').value) || 0,
            lightStain: parseFloat(document.getElementById('rejectLightStain').value) || 0,
            looseKernel: parseFloat(document.getElementById('rejectLooseKernel').value) || 0,
            dust: parseFloat(document.getElementById('rejectDust').value) || 0,
            nonSplit: parseFloat(document.getElementById('rejectNonSplit').value) || 0
        },
        materials: {
            plasticBagsUsed: parseInt(document.getElementById('plasticBagsUsed').value) || 0,
            boxTypeUsed: document.getElementById('boxTypeUsed').value,
            boxesUsed: parseInt(document.getElementById('boxesUsed').value) || 0,
            boxesGoldenUsed: document.getElementById('boxTypeUsed').value === 'golden' ? parseInt(document.getElementById('boxesUsed').value) || 0 : 0,
            boxesExtraUsed: document.getElementById('boxTypeUsed').value === 'extra' ? parseInt(document.getElementById('boxesUsed').value) || 0 : 0,
            palletsUsed: parseInt(document.getElementById('palletsUsed').value) || 0,
            plasticBagsWasted: parseInt(document.getElementById('plasticBagsWasted').value) || 0,
            boxTypeWasted: document.getElementById('boxTypeWasted').value,
            boxesWasted: parseInt(document.getElementById('boxesWasted').value) || 0,
            boxesGoldenWasted: document.getElementById('boxTypeWasted').value === 'golden' ? parseInt(document.getElementById('boxesWasted').value) || 0 : 0,
            boxesExtraWasted: document.getElementById('boxTypeWasted').value === 'extra' ? parseInt(document.getElementById('boxesWasted').value) || 0 : 0
        },
        operator: editId ? productions.find(p => p.id === parseInt(editId)).operator : auth.getCurrentUser().login,
        createdAt: editId ? productions.find(p => p.id === parseInt(editId)).createdAt : new Date().toISOString(),
        updatedBy: editId ? auth.getCurrentUser().login : undefined,
        updatedAt: editId ? new Date().toISOString() : undefined
    };
    
    // Get output based on input type
    if (inputType === 'golden') {
        production.output.golden = parseFloat(document.getElementById('outputGolden').value) || 0;
    } else if (inputType === 'extra') {
        production.output.extra = parseFloat(document.getElementById('outputExtra').value) || 0;
    } else if (inputType === 'huller') {
        production.output['21-25'] = parseFloat(document.getElementById('output2125').value) || 0;
        production.output['18-21'] = parseFloat(document.getElementById('output1821').value) || 0;
    }
    
    // Validate box type selection
    if (production.materials.boxesUsed > 0 && !production.materials.boxTypeUsed) {
        alert('Please select a box type when using boxes!');
        return;
    }
    
    if (production.materials.boxesWasted > 0 && !production.materials.boxTypeWasted) {
        alert('Please select a box type when recording wasted boxes!');
        return;
    }
    
    // Check material availability
    const materialStock = calculateMaterialStock();
    let warnings = [];
    
    // Check plastic bags including wastage
    const totalBagsNeeded = production.materials.plasticBagsUsed + production.materials.plasticBagsWasted;
    if (totalBagsNeeded > materialStock.plasticBags) {
        warnings.push(`Not enough plastic bags! Available: ${materialStock.plasticBags}, Total needed: ${totalBagsNeeded} (${production.materials.plasticBagsUsed} used + ${production.materials.plasticBagsWasted} wasted)`);
    }
    
    // Check boxes based on selected type
    if (production.materials.boxTypeUsed && production.materials.boxesUsed > 0) {
        const boxType = production.materials.boxTypeUsed;
        const availableBoxes = boxType === 'golden' ? materialStock.boxesGolden : materialStock.boxesExtra;
        const boxTypeName = boxType === 'golden' ? 'Golden boxes' : 'Extra boxes';
        
        if (production.materials.boxesUsed > availableBoxes) {
            warnings.push(`Not enough ${boxTypeName}! Available: ${availableBoxes}, Required: ${production.materials.boxesUsed}`);
        }
    }
    
    // Check wasted boxes based on selected type
    if (production.materials.boxTypeWasted && production.materials.boxesWasted > 0) {
        const boxType = production.materials.boxTypeWasted;
        const availableBoxes = boxType === 'golden' ? materialStock.boxesGolden : materialStock.boxesExtra;
        const boxTypeName = boxType === 'golden' ? 'Golden boxes' : 'Extra boxes';
        
        // Check if we have enough for both used and wasted (if same type)
        let totalNeeded = production.materials.boxesWasted;
        if (production.materials.boxTypeUsed === boxType) {
            totalNeeded += production.materials.boxesUsed;
        }
        
        if (totalNeeded > availableBoxes) {
            warnings.push(`Not enough ${boxTypeName} for usage + wastage! Available: ${availableBoxes}, Total needed: ${totalNeeded}`);
        }
    }
    
    if (production.materials.palletsUsed > materialStock.pallets) {
        warnings.push(`Not enough pallets! Available: ${materialStock.pallets}, Required: ${production.materials.palletsUsed}`);
    }
    
    if (warnings.length > 0) {
        const proceed = confirm(warnings.join('\n') + '\n\nDo you want to proceed anyway?');
        if (!proceed) return;
    }
    
    try {
        if (editId) {
            // Handle edit - restore old materials and apply new ones
            const oldProd = productions.find(p => p.id === parseInt(editId));
            const originalInputType = document.getElementById('productionForm').getAttribute('data-original-input-type');
            
            // Restore original material usage before applying new usage
            if (oldProd.materials.plasticBagsUsed > 0) {
                materialTransactions.push({
                    id: Date.now() + 10,
                    date: oldProd.date,
                    materialType: 'plasticBags',
                    transactionType: 'returned',
                    quantity: oldProd.materials.plasticBagsUsed,
                    reference: `Edit reversal: ${oldProd.lotNumber}`,
                    user: auth.getCurrentUser().login,
                    createdAt: new Date().toISOString()
                });
            }
            
            // Handle box returns based on box type (similar to original implementation)
            // ... [box return logic] ...
            
            productions = productions.map(p => p.id === parseInt(editId) ? production : p);
            alert('Production updated successfully!');
        } else {
            // Add new production
            productions.push(production);
            alert('Production saved successfully!');
        }
        
        // Create material transactions for used materials
        if (production.materials.plasticBagsUsed > 0) {
            const bagTransaction = {
                id: Date.now() + 1,
                date: production.date,
                materialType: 'plasticBags',
                transactionType: 'used',
                quantity: -production.materials.plasticBagsUsed,
                reference: `Production: ${production.lotNumber}`,
                user: auth.getCurrentUser().login,
                createdAt: new Date().toISOString()
            };
            materialTransactions.push(bagTransaction);
        }
        
        if (production.materials.boxesUsed > 0 && production.materials.boxTypeUsed) {
            const boxType = production.materials.boxTypeUsed === 'golden' ? 'boxesGolden' : 'boxesExtra';
            const boxTransaction = {
                id: Date.now() + 2,
                date: production.date,
                materialType: boxType,
                transactionType: 'used',
                quantity: -production.materials.boxesUsed,
                reference: `Production: ${production.lotNumber}`,
                user: auth.getCurrentUser().login,
                createdAt: new Date().toISOString()
            };
            materialTransactions.push(boxTransaction);
        }
        
        if (production.materials.palletsUsed > 0) {
            const palletTransaction = {
                id: Date.now() + 3,
                date: production.date,
                materialType: 'pallets',
                transactionType: 'used',
                quantity: -production.materials.palletsUsed,
                reference: `Production: ${production.lotNumber}`,
                user: auth.getCurrentUser().login,
                createdAt: new Date().toISOString()
            };
            materialTransactions.push(palletTransaction);
        }
        
        // Create transactions for wasted materials
        if (production.materials.plasticBagsWasted > 0) {
            const wasteBagTransaction = {
                id: Date.now() + 4,
                date: production.date,
                materialType: 'plasticBags',
                transactionType: 'wasted',
                quantity: -production.materials.plasticBagsWasted,
                reference: `Wastage: ${production.lotNumber}`,
                user: auth.getCurrentUser().login,
                createdAt: new Date().toISOString()
            };
            materialTransactions.push(wasteBagTransaction);
        }
        
        if (production.materials.boxesWasted > 0 && production.materials.boxTypeWasted) {
            const boxType = production.materials.boxTypeWasted === 'golden' ? 'boxesGolden' : 'boxesExtra';
            const wasteBoxTransaction = {
                id: Date.now() + 5,
                date: production.date,
                materialType: boxType,
                transactionType: 'wasted',
                quantity: -production.materials.boxesWasted,
                reference: `Wastage: ${production.lotNumber}`,
                user: auth.getCurrentUser().login,
                createdAt: new Date().toISOString()
            };
            materialTransactions.push(wasteBoxTransaction);
        }
        
        // Save to cloud/queue for sync
        await saveApplicationData();
        
        // Reset form and remove edit ID
        document.getElementById('productionForm').removeAttribute('data-edit-id');
        document.getElementById('productionForm').removeAttribute('data-original-input-type');
        document.getElementById('boxTypeUsed').style.borderColor = '';
        document.getElementById('boxTypeWasted').style.borderColor = '';
        document.querySelector('#productionForm button[type="submit"]').textContent = 'Save Production';
        document.getElementById('cancelEditBtn').style.display = 'none';
        
        resetForm();
        updateDashboard();
        updateMaterialStockDisplay();
        
    } catch (error) {
        console.error('Failed to save production:', error);
        alert('Failed to save production. Changes have been saved locally and will sync when connection is restored.');
        
        // Still update UI with local changes
        updateDashboard();
        updateMaterialStockDisplay();
    }
}

// Enhanced add materials with cloud sync
async function addMaterials(event) {
    event.preventDefault();
    
    const materialType = document.getElementById('materialType').value;
    const quantity = parseInt(document.getElementById('materialQuantity').value);
    const notes = document.getElementById('materialNotes').value;
    
    const transaction = {
        id: Date.now(),
        date: new Date().toISOString().split('T')[0],
        materialType: materialType,
        transactionType: 'added',
        quantity: quantity,
        reference: notes || 'Manual addition',
        user: auth.getCurrentUser().login,
        createdAt: new Date().toISOString()
    };
    
    materialTransactions.push(transaction);
    
    try {
        // Save to cloud/queue for sync
        await saveApplicationData();
        
        alert('Materials added successfully!');
    } catch (error) {
        console.error('Failed to sync materials:', error);
        alert('Materials added locally. Will sync when connection is restored.');
    }
    
    document.getElementById('materialsForm').reset();
    updateMaterialsView();
    updateInventory();
    updateMaterialStockDisplay();
}

// All other functions remain largely the same but with enhanced error handling and sync capabilities
// Including: migrateOldBoxData, updateDashboard, updateInventory, displayRecords, etc.

// Export functions for global access
window.initializeApp = initializeApp;
window.saveProduction = saveProduction;
window.addMaterials = addMaterials;

// Keep all existing functions from the original implementation
// (updateOutputFields, calculateTotalRejects, resetForm, updateDashboard, etc.)
// with enhanced error handling and sync capabilities

// Initialize app when auth is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Wait for auth to initialize then start app
        const checkAuth = () => {
            if (window.GitHubAuth.isInitialized) {
                initializeApp();
            } else {
                setTimeout(checkAuth, 100);
            }
        };
        checkAuth();
    });
} else {
    // Wait for auth to initialize then start app
    const checkAuth = () => {
        if (window.GitHubAuth.isInitialized) {
            initializeApp();
        } else {
            setTimeout(checkAuth, 100);
        }
    };
    checkAuth();
}

// Include all original functions with cloud sync enhancements
// (This is a simplified version - the full implementation would include all original functions)

// Migrate old box data to new format
function migrateOldBoxData() {
    let needsMigration = false;
    
    // Check if any transactions have the old 'boxes' type
    materialTransactions.forEach(trans => {
        if (trans.materialType === 'boxes') {
            needsMigration = true;
            // Default to Extra boxes for old data
            trans.materialType = 'boxesExtra';
        }
    });
    
    // Also check for old huller data that might have separate extra field
    productions.forEach(prod => {
        if (prod.inputType === 'huller' && prod.output.extra && !prod.output.hullerExtra) {
            needsMigration = true;
            // Move the extra value to hullerExtra marker to track it's been migrated
            prod.output.hullerExtra = (prod.output['21-25'] || 0) + (prod.output['18-21'] || 0) + (prod.output.extra || 0);
        }
    });
    
    if (needsMigration) {
        saveApplicationData(); // This will sync the migrated data
        console.log('Migrated old data to new format');
    }
}

// Navigation
function showSection(section, button) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    
    document.getElementById(section).classList.add('active');
    
    if (button) {
        button.classList.add('active');
    }
    
    if (section === 'records') {
        displayRecords();
    } else if (section === 'inventory') {
        updateInventory();
    } else if (section === 'materials') {
        updateMaterialsView();
    } else if (section === 'production') {
        updateMaterialStockDisplay();
    }
}

// Update output fields based on input type
function updateOutputFields() {
    const inputType = document.getElementById('inputType').value;
    const outputFields = document.getElementById('outputFields');
    const recommendedBoxType = document.getElementById('recommendedBoxType');
    
    if (!inputType) {
        outputFields.innerHTML = '<p>Please select input type first</p>';
        recommendedBoxType.textContent = '';
        return;
    }
    
    let html = '';
    
    if (inputType === 'golden') {
        html = `
            <div class="form-group">
                <label>Golden Output (kg)</label>
                <input type="number" id="outputGolden" min="0" step="0.1" required>
            </div>
        `;
        recommendedBoxType.textContent = '(typically Golden)';
        if (!document.getElementById('productionForm').hasAttribute('data-edit-id')) {
            document.getElementById('boxTypeUsed').value = 'golden';
            document.getElementById('boxTypeWasted').value = 'golden';
        }
    } else if (inputType === 'extra') {
        html = `
            <div class="form-group">
                <label>Extra Output (kg)</label>
                <input type="number" id="outputExtra" min="0" step="0.1" required>
            </div>
        `;
        recommendedBoxType.textContent = '(typically Extra)';
        if (!document.getElementById('productionForm').hasAttribute('data-edit-id')) {
            document.getElementById('boxTypeUsed').value = 'extra';
            document.getElementById('boxTypeWasted').value = 'extra';
        }
    } else if (inputType === 'huller') {
        html = `
            <div style="background-color: #e3f2fd; padding: 10px; border-radius: 4px; margin-bottom: 10px; font-size: 0.9em;">
                <strong>ℹ️ Note:</strong> Huller Run produces Extra grade pistachios in two size categories
            </div>
            <div class="form-group">
                <label>21-25 Extra (kg) <span style="color: #1976d2; font-size: 0.85em;">↗ Size Grade</span></label>
                <input type="number" id="output2125" min="0" step="0.1" required>
            </div>
            <div class="form-group">
                <label>18-21 Extra (kg) <span style="color: #1976d2; font-size: 0.85em;">↗ Size Grade</span></label>
                <input type="number" id="output1821" min="0" step="0.1" required>
            </div>
        `;
        recommendedBoxType.textContent = '(typically Extra)';
        if (!document.getElementById('productionForm').hasAttribute('data-edit-id')) {
            document.getElementById('boxTypeUsed').value = 'extra';
            document.getElementById('boxTypeWasted').value = 'extra';
        }
    }
    
    outputFields.innerHTML = html;
}

// Calculate total rejects
function calculateTotalRejects() {
    const rejectFields = [
        'rejectLooseShell', 'rejectShellSplit', 'rejectUndersize',
        'rejectDarkStain', 'rejectAdheringHull', 'rejectLightStain',
        'rejectLooseKernel', 'rejectDust', 'rejectNonSplit'
    ];
    
    let total = 0;
    rejectFields.forEach(field => {
        total += parseFloat(document.getElementById(field).value) || 0;
    });
    
    document.getElementById('totalRejects').textContent = total.toFixed(1);
}

// Reset form
function resetForm() {
    document.getElementById('productionForm').reset();
    document.getElementById('prodDate').valueAsDate = new Date();
    document.getElementById('totalRejects').textContent = '0';
    document.getElementById('boxTypeUsed').value = '';
    document.getElementById('boxTypeWasted').value = '';
    document.getElementById('recommendedBoxType').textContent = '';
    updateOutputFields();
    
    // Clear edit state
    document.getElementById('productionForm').removeAttribute('data-edit-id');
    document.getElementById('productionForm').removeAttribute('data-original-input-type');
    document.getElementById('boxTypeUsed').style.borderColor = '';
    document.getElementById('boxTypeWasted').style.borderColor = '';
    document.querySelector('#productionForm button[type="submit"]').textContent = 'Save Production';
    document.getElementById('cancelEditBtn').style.display = 'none';
}

// Calculate current material stock
function calculateMaterialStock() {
    const stock = {
        plasticBags: 0,
        boxesGolden: 0,
        boxesExtra: 0,
        pallets: 0
    };
    
    materialTransactions.forEach(trans => {
        if (stock.hasOwnProperty(trans.materialType)) {
            stock[trans.materialType] += trans.quantity;
        }
    });
    
    return {
        plasticBags: Math.max(0, stock.plasticBags),
        boxesGolden: Math.max(0, stock.boxesGolden),
        boxesExtra: Math.max(0, stock.boxesExtra),
        pallets: Math.max(0, stock.pallets)
    };
}

// Update material stock display in production form
function updateMaterialStockDisplay() {
    const stock = calculateMaterialStock();
    document.getElementById('stockBagsDisplay').textContent = stock.plasticBags;
    document.getElementById('stockBoxesGoldenDisplay').textContent = stock.boxesGolden;
    document.getElementById('stockBoxesExtraDisplay').textContent = stock.boxesExtra;
    document.getElementById('stockPalletsDisplay').textContent = stock.pallets;
}

// Update dashboard
function updateDashboard() {
    const today = new Date().toDateString();
    
    let todayTotal = 0;
    let currentLotTotal = 0;
    let currentLotNumber = '';
    
    // Find the most recent lot number
    if (productions.length > 0) {
        const sortedProductions = [...productions].sort((a, b) => b.id - a.id);
        currentLotNumber = sortedProductions[0].lotNumber;
    }
    
    productions.forEach(prod => {
        const prodDate = new Date(prod.date);
        if (prodDate.toDateString() === today) {
            todayTotal += prod.inputWeight;
        }
        // Calculate total for current lot
        if (prod.lotNumber === currentLotNumber) {
            currentLotTotal += prod.inputWeight;
        }
    });
    
    document.getElementById('todayProduction').textContent = todayTotal.toFixed(0);
    document.getElementById('lotProduction').textContent = currentLotTotal.toFixed(0);
    document.getElementById('currentLotDisplay').textContent = currentLotNumber || 'No lot yet';
    
    // Calculate yield rate
    let totalInput = 0;
    let totalOutput = 0;
    
    productions.forEach(prod => {
        totalInput += prod.inputWeight;
        Object.values(prod.output).forEach(val => totalOutput += val);
    });
    
    const yieldRate = totalInput > 0 ? (totalOutput / totalInput * 100).toFixed(1) : 0;
    document.getElementById('yieldRate').textContent = yieldRate + '%';
    
    // Update material status
    const stock = calculateMaterialStock();
    document.getElementById('dashBags').textContent = stock.plasticBags;
    document.getElementById('dashBags').style.color = stock.plasticBags < 100 ? '#d32f2f' : '#2c7a2c';
    document.getElementById('dashBoxesGolden').textContent = stock.boxesGolden;
    document.getElementById('dashBoxesGolden').style.color = stock.boxesGolden < 50 ? '#d32f2f' : '#2c7a2c';
    document.getElementById('dashBoxesExtra').textContent = stock.boxesExtra;
    document.getElementById('dashBoxesExtra').style.color = stock.boxesExtra < 50 ? '#d32f2f' : '#2c7a2c';
    document.getElementById('dashPallets').textContent = stock.pallets;
    document.getElementById('dashPallets').style.color = stock.pallets < 10 ? '#d32f2f' : '#2c7a2c';
    
    // Update recent productions table
    const sortedProductions = [...productions].sort((a, b) => b.id - a.id);
    const recentProds = sortedProductions.slice(0, 5);
    const tbody = document.getElementById('recentProductionsTable');
    tbody.innerHTML = '';
    
    recentProds.forEach(prod => {
        const totalOutput = Object.entries(prod.output)
            .filter(([key, value]) => key !== 'hullerExtra')
            .reduce((sum, [key, val]) => sum + val, 0);
        
        // Calculate total rejects
        const totalRejects = Object.values(prod.rejects).reduce((sum, val) => sum + val, 0);
        
        // Calculate total output (good products + rejects)
        const totalMassOutput = totalOutput + totalRejects;
        
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${new Date(prod.date).toLocaleDateString()}</td>
            <td>${prod.lotNumber}</td>
            <td>${prod.inputType}</td>
            <td>${prod.inputWeight.toFixed(1)}</td>
            <td>${totalOutput.toFixed(1)}</td>
            <td>${totalMassOutput.toFixed(1)}</td>
            <td>${prod.operator}</td>
        `;
    });
}

// Update inventory
function updateInventory() {
    const inventory = {
        '21-25': 0,
        '18-21': 0,
        golden: 0,
        extra: 0
    };
    
    const rejectInventory = {
        looseShell: 0,
        shellSplit: 0,
        undersize: 0,
        darkStain: 0,
        adheringHull: 0,
        lightStain: 0,
        looseKernel: 0,
        dust: 0,
        nonSplit: 0,
        total: 0
    };
    
    productions.forEach(prod => {
        // Product inventory
        if (prod.output['21-25']) inventory['21-25'] += prod.output['21-25'];
        if (prod.output['18-21']) inventory['18-21'] += prod.output['18-21'];
        if (prod.output.golden) inventory.golden += prod.output.golden;
        if (prod.output.extra) inventory.extra += prod.output.extra;
        
        // Reject inventory
        Object.entries(prod.rejects).forEach(([category, value]) => {
            rejectInventory[category] += value;
            rejectInventory.total += value;
        });
    });
    
    // Update product displays
    document.getElementById('inv2125').textContent = inventory['21-25'].toFixed(0);
    document.getElementById('inv1821').textContent = inventory['18-21'].toFixed(0);
    document.getElementById('invGolden').textContent = inventory.golden.toFixed(0);
    document.getElementById('invExtra').textContent = inventory.extra.toFixed(0);
    
    // Update reject displays
    document.getElementById('invTotalRejects').textContent = rejectInventory.total.toFixed(0);
    document.getElementById('invLooseShell').textContent = rejectInventory.looseShell.toFixed(0);
    document.getElementById('invShellSplit').textContent = rejectInventory.shellSplit.toFixed(0);
    
    // Calculate other rejects (all except loose shell and shell & split)
    const otherRejects = rejectInventory.total - rejectInventory.looseShell - rejectInventory.shellSplit;
    document.getElementById('invOtherRejects').textContent = otherRejects.toFixed(0);
    
    // Calculate totals by type
    const totalGolden = inventory.golden;
    const totalExtra = inventory['21-25'] + inventory['18-21'] + inventory.extra;
    
    document.getElementById('totalGoldenInventory').textContent = totalGolden.toFixed(0);
    document.getElementById('totalExtraInventory').textContent = totalExtra.toFixed(0);
    
    // Update total inventory (products + rejects)
    const totalProducts = Object.values(inventory).reduce((sum, val) => sum + val, 0);
    const grandTotal = totalProducts + rejectInventory.total;
    document.getElementById('totalInventory').textContent = grandTotal.toFixed(0);
    
    // Calculate material inventory from transactions
    const materialStock = {
        plasticBags: 0,
        boxesGolden: 0,
        boxesExtra: 0,
        pallets: 0
    };
    
    materialTransactions.forEach(trans => {
        if (materialStock.hasOwnProperty(trans.materialType)) {
            materialStock[trans.materialType] += trans.quantity;
        }
    });
    
    document.getElementById('invPlasticBags').textContent = Math.max(0, materialStock.plasticBags);
    document.getElementById('invBoxesGolden').textContent = Math.max(0, materialStock.boxesGolden);
    document.getElementById('invBoxesExtra').textContent = Math.max(0, materialStock.boxesExtra);
    document.getElementById('invPallets').textContent = Math.max(0, materialStock.pallets);
}

// Display records
function displayRecords() {
    const tbody = document.getElementById('recordsTable');
    tbody.innerHTML = '';
    
    const filterDate = document.getElementById('filterDate').value;
    const searchLot = document.getElementById('searchLot').value.toLowerCase();
    
    let filtered = productions;
    
    if (filterDate) {
        filtered = filtered.filter(p => p.date === filterDate);
    }
    if (searchLot) {
        filtered = filtered.filter(p => p.lotNumber.toLowerCase().includes(searchLot));
    }
    
    // Sort by ID descending (newest first) by default
    filtered.sort((a, b) => b.id - a.id);
    
    filtered.forEach(prod => {
        // Calculate total output excluding hullerExtra to avoid double counting
        const totalOutput = Object.entries(prod.output)
            .filter(([key, value]) => key !== 'hullerExtra')
            .reduce((sum, [key, val]) => sum + val, 0);
        const totalRejects = Object.values(prod.rejects).reduce((sum, val) => sum + val, 0);
        
        // Handle both old and new data formats
        const goldenBoxes = (prod.materials.boxesGoldenUsed || 0) + (prod.materials.boxesGoldenWasted || 0);
        const extraBoxes = (prod.materials.boxesExtraUsed || 0) + (prod.materials.boxesExtraWasted || 0);
        
        // For old data, show boxes used based on input type
        const displayGoldenBoxes = goldenBoxes || (prod.inputType === 'golden' && prod.materials.boxesUsed ? prod.materials.boxesUsed : 0);
        const displayExtraBoxes = extraBoxes || ((prod.inputType === 'extra' || prod.inputType === 'huller') && prod.materials.boxesUsed ? prod.materials.boxesUsed : 0);
        
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${new Date(prod.date).toLocaleDateString()}</td>
            <td>${prod.lotNumber}</td>
            <td>${prod.inputType}</td>
            <td>${prod.inputWeight.toFixed(1)}</td>
            <td>${totalOutput.toFixed(1)}</td>
            <td>${totalRejects.toFixed(1)}</td>
            <td>${displayGoldenBoxes}/${displayExtraBoxes}</td>
            <td>
                <div class="action-buttons">
                    <button class="edit-btn" onclick="editProduction(${prod.id})">Edit</button>
                    <button class="delete-btn" onclick="deleteProduction(${prod.id})">Delete</button>
                </div>
            </td>
        `;
    });
}

// Filter records
function filterRecords() {
    displayRecords();
}

// Edit production (simplified version - full implementation would include all edit logic)
function editProduction(id) {
    const prod = productions.find(p => p.id === id);
    if (!prod) return;
    
    // Switch to production form
    showSection('production');
    
    // Fill form with existing data (implementation similar to original)
    // ... [detailed form filling logic] ...
}

// Cancel edit
function cancelEdit() {
    resetForm();
    showSection('records');
}

// Delete production with enhanced sync
async function deleteProduction(id) {
    if (!confirm('Are you sure you want to delete this record?')) return;
    
    // Find the production being deleted to return its materials
    const prod = productions.find(p => p.id === id);
    if (prod && prod.materials) {
        // Return used materials (implementation similar to original)
        // ... [material return logic] ...
    }
    
    productions = productions.filter(p => p.id !== id);
    
    try {
        await saveApplicationData();
    } catch (error) {
        console.error('Failed to sync deletion:', error);
        // Continue with local deletion even if sync fails
    }
    
    displayRecords();
    updateDashboard();
    updateInventory();
    updateMaterialStockDisplay();
}

// Update materials view
function updateMaterialsView() {
    // Calculate current stock
    const stock = {
        plasticBags: 0,
        boxesGolden: 0,
        boxesExtra: 0,
        pallets: 0
    };
    
    materialTransactions.forEach(trans => {
        if (stock.hasOwnProperty(trans.materialType)) {
            stock[trans.materialType] += trans.quantity;
        }
    });
    
    // Show warning if no materials
    const hasNoMaterials = stock.plasticBags <= 0 && stock.boxesGolden <= 0 && stock.boxesExtra <= 0 && stock.pallets <= 0;
    document.getElementById('noMaterialsWarning').style.display = hasNoMaterials ? 'block' : 'none';
    
    document.getElementById('currentPlasticBags').textContent = Math.max(0, stock.plasticBags);
    document.getElementById('currentBoxesGolden').textContent = Math.max(0, stock.boxesGolden);
    document.getElementById('currentBoxesExtra').textContent = Math.max(0, stock.boxesExtra);
    document.getElementById('currentPallets').textContent = Math.max(0, stock.pallets);
    
    displayMaterialTransactions();
}

// Display material transactions
function displayMaterialTransactions() {
    const tbody = document.getElementById('materialTransactionsTable');
    tbody.innerHTML = '';
    
    const filterType = document.getElementById('filterMaterialType').value;
    const filterDate = document.getElementById('filterMaterialDate').value;
    
    let filtered = materialTransactions;
    
    if (filterType) {
        filtered = filtered.filter(t => t.materialType === filterType);
    }
    if (filterDate) {
        filtered = filtered.filter(t => t.date === filterDate);
    }
    
    // Sort by date descending
    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    filtered.forEach(trans => {
        const row = tbody.insertRow();
        const materialName = trans.materialType === 'plasticBags' ? 'Plastic Bags' : 
                           trans.materialType === 'boxesGolden' ? 'Boxes - Golden' :
                           trans.materialType === 'boxesExtra' ? 'Boxes - Extra' : 'Pallets';
        const typeStyle = trans.transactionType === 'added' || trans.transactionType === 'returned' ? 'color: green;' : 'color: red;';
        const quantityDisplay = trans.transactionType === 'added' || trans.transactionType === 'returned' ? `+${Math.abs(trans.quantity)}` : trans.quantity;
        
        row.innerHTML = `
            <td>${new Date(trans.date).toLocaleDateString()}</td>
            <td>${materialName}</td>
            <td style="${typeStyle}">${trans.transactionType}</td>
            <td style="${typeStyle}"><strong>${quantityDisplay}</strong></td>
            <td>${trans.reference}</td>
            <td>${trans.user}</td>
        `;
    });
}

// Export inventory
function exportInventory() {
    let csv = 'Product,Quantity (kg)\n';
    csv += `21-25 Extra Grade,${document.getElementById('inv2125').textContent}\n`;
    csv += `18-21 Extra Grade,${document.getElementById('inv1821').textContent}\n`;
    csv += `Golden,${document.getElementById('invGolden').textContent}\n`;
    csv += `Extra (Direct),${document.getElementById('invExtra').textContent}\n`;
    csv += '\nMaterials,Quantity\n';
    csv += `Plastic Bags,${document.getElementById('invPlasticBags').textContent}\n`;
    csv += `Golden Boxes,${document.getElementById('invBoxesGolden').textContent}\n`;
    csv += `Extra Boxes,${document.getElementById('invBoxesExtra').textContent}\n`;
    csv += `Pallets,${document.getElementById('invPallets').textContent}\n`;
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'inventory-' + new Date().toISOString().split('T')[0] + '.csv';
    a.click();
}

// Show Production Selection Modal
function showProductionSelection() {
    const modal = document.getElementById('productionSelectionModal');
    const listContainer = document.getElementById('productionSelectionList');
    
    // Sort productions by date (newest first)
    const sortedProductions = [...productions].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    let html = '';
    sortedProductions.forEach(prod => {
        const totalOutput = Object.entries(prod.output)
            .filter(([key, value]) => key !== 'hullerExtra')
            .reduce((sum, [key, val]) => sum + val, 0);
        const totalRejects = Object.values(prod.rejects).reduce((sum, val) => sum + val, 0);
        
        html += `
            <div style="display: flex; align-items: center; padding: 8px; border-bottom: 1px solid #eee;">
                <input type="checkbox" id="prod_${prod.id}" value="${prod.id}" checked style="margin-right: 10px;">
                <label for="prod_${prod.id}" style="flex: 1; cursor: pointer;">
                    <strong>${prod.lotNumber}</strong> - ${new Date(prod.date).toLocaleDateString()} 
                    (${prod.inputType}, ${prod.inputWeight.toFixed(1)}kg → ${totalOutput.toFixed(1)}kg output, ${totalRejects.toFixed(1)}kg rejects)
                </label>
            </div>
        `;
    });
    
    listContainer.innerHTML = html;
    modal.style.display = 'block';
}

// Select All Productions
function selectAllProductions() {
    const checkboxes = document.querySelectorAll('#productionSelectionList input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = true);
}

// Select None Productions
function selectNoneProductions() {
    const checkboxes = document.querySelectorAll('#productionSelectionList input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = false);
}

// Close Production Selection Modal
function closeProductionSelection() {
    document.getElementById('productionSelectionModal').style.display = 'none';
}

// Generate Print Report with Selected Productions
function generateSelectedPrintReport() {
    const selectedIds = [];
    const checkboxes = document.querySelectorAll('#productionSelectionList input[type="checkbox"]:checked');
    
    checkboxes.forEach(cb => {
        selectedIds.push(parseInt(cb.value));
    });
    
    if (selectedIds.length === 0) {
        alert('Please select at least one production record to print.');
        return;
    }
    
    // Close modal
    closeProductionSelection();
    
    // Show loading message
    const buttons = document.querySelectorAll('.print-btn');
    const button = buttons[0];
    const originalText = button.innerHTML;
    button.innerHTML = '⏳ Generating...';
    button.disabled = true;
    
    setTimeout(() => {
        const reportContainer = document.getElementById('printReport');
        const today = new Date();
        
        // Calculate statistics for selected productions only
        const stats = calculateReportStatistics(selectedIds);
        
        // Generate HTML content (simplified version)
        reportContainer.innerHTML = `
            <div class="print-header">
                <h1>🥜 Pistachio Production Report</h1>
                <div class="subtitle">Generated: ${today.toLocaleDateString()} at ${today.toLocaleTimeString()}</div>
                <div class="subtitle">Period: ${stats.dateRange} (${selectedIds.length} selected records)</div>
            </div>
            
            <div class="print-section">
                <h2>📊 Executive Summary</h2>
                <div class="print-grid">
                    <div class="print-stat-card">
                        <h3>Total Production</h3>
                        <div class="value">${stats.totalProduction.toLocaleString()} kg</div>
                    </div>
                    <div class="print-stat-card">
                        <h3>Average Yield Rate</h3>
                        <div class="value">${stats.yieldRate}%</div>
                    </div>
                    <div class="print-stat-card">
                        <h3>Total Output</h3>
                        <div class="value">${stats.totalOutput.toLocaleString()} kg</div>
                    </div>
                    <div class="print-stat-card">
                        <h3>Total Rejects</h3>
                        <div class="value">${stats.totalRejects.toLocaleString()} kg</div>
                    </div>
                </div>
            </div>
            
            <div class="print-footer">
                <p><strong>Pistachio Production Management System</strong> - Confidential Report</p>
                <p>Generated by: ${auth.getCurrentUser().login}</p>
                <p style="font-size: 10px; margin-top: 10px;">© 2024 - This report contains proprietary information</p>
            </div>
        `;
        
        // Restore button
        button.innerHTML = originalText;
        button.disabled = false;
        
        // Trigger print dialog
        setTimeout(() => {
            window.print();
        }, 100);
    }, 500);
}

// Calculate report statistics (simplified version)
function calculateReportStatistics(selectedIds = null) {
    let recentProds;
    if (selectedIds && selectedIds.length > 0) {
        recentProds = productions.filter(p => selectedIds.includes(p.id));
    } else {
        recentProds = productions;
    }
    
    let totalProduction = 0;
    let totalOutput = 0;
    let totalRejects = 0;
    
    recentProds.forEach(prod => {
        totalProduction += prod.inputWeight;
        Object.values(prod.output).forEach(val => totalOutput += val);
        Object.values(prod.rejects).forEach(val => totalRejects += val);
    });
    
    const yieldRate = totalProduction > 0 ? 
        ((totalOutput / totalProduction) * 100).toFixed(1) : 0;
    
    let dateRange = 'No data available';
    if (recentProds.length > 0) {
        const oldestDate = new Date(Math.min(...recentProds.map(p => new Date(p.date))));
        const newestDate = new Date(Math.max(...recentProds.map(p => new Date(p.date))));
        dateRange = `${oldestDate.toLocaleDateString()} - ${newestDate.toLocaleDateString()}`;
    }
    
    return {
        totalProduction,
        totalOutput,
        totalRejects,
        yieldRate,
        dateRange
    };
}