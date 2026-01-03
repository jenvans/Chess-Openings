// Initialize chess game and board
let game = new Chess();
let board = null;
let moveHistory = [];
let selectedSquare = null;
let currentTheme = 'blue';

// Practice mode variables
let spacedRepetitionGame = new Chess();
let spacedRepetitionBoard = null;
let practiceGame = new Chess();
let practiceBoard = null;
let learnGame = new Chess();
let learnBoard = null;
let currentSpacedRepetitionOpening = null;
let spacedRepetitionHasMistakes = false;
let spacedRepetitionStatusTimeout = null;
let currentPracticeOpening = null;
let practiceHasMistakes = false;
let practiceStatusTimeout = null;
let currentLearnOpening = null;
let learnHasMistakes = false;
let learnStatusTimeout = null;
let spacedRepetitionQueue = [];
let practiceQueue = [];
let currentMoveIndex = 0;
let practiceMode = null; // 'spaced', 'practice', or 'learn'
let sessionCompletedCount = 0; // Track openings completed in current session

// Performance cache
let openingsCache = null; // Cache for parsed localStorage data
let cacheTimestamp = 0; // Timestamp of last cache
const CACHE_DURATION = 1000; // Cache for 1 second

// Helper to get openings with caching
function getOpenings(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && openingsCache && (now - cacheTimestamp) < CACHE_DURATION) {
        return openingsCache;
    }
    openingsCache = JSON.parse(localStorage.getItem('chessOpenings') || '{}');
    cacheTimestamp = now;
    return openingsCache;
}

// Helper to save openings and invalidate cache
function saveOpenings(openings) {
    localStorage.setItem('chessOpenings', JSON.stringify(openings));
    openingsCache = openings;
    cacheTimestamp = Date.now();
}

// Audio context for sounds
let audioContext = null;
function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
}

// Play success sound
function playSuccessSound() {
    initAudio();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 523.25; // C5
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
}

// Play error sound
function playErrorSound() {
    initAudio();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 196; // G3 (lower, sadder)
    oscillator.type = 'sawtooth';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
}

// Initialize the board
function initBoard() {
    const config = {
        draggable: true,
        position: 'start',
        onDragStart: onDragStart,
        onDrop: onDrop,
        onSnapEnd: onSnapEnd,
        pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png',
        onMouseoutSquare: onMouseoutSquare,
        onMouseoverSquare: onMouseoverSquare
    };
    board = Chessboard('board', config);
    
    // Add click handler for click-to-move
    $('#board').on('click', '.square-55d63', onSquareClick);
    
    // Load saved theme
    const savedTheme = localStorage.getItem('boardTheme') || 'blue';
    setTheme(savedTheme);
}

// Prevent picking up pieces if game is over or wrong color
function onDragStart(source, piece, position, orientation) {
    // Disable drag if click-to-move is enabled
    if (document.getElementById('clickToMove').checked) return false;
    
    // Only allow moves when the game is not over
    if (game.game_over()) return false;
    
    // Only pick up pieces for the side to move
    if ((game.turn() === 'w' && piece.search(/^b/) !== -1) ||
        (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
        return false;
    }
}

// Handle piece drop
function onDrop(source, target) {
    // Check if the move is legal
    const move = game.move({
        from: source,
        to: target,
        promotion: 'q' // Always promote to queen for simplicity
    });
    
    // Illegal move
    if (move === null) return 'snapback';
    
    // Add move to history
    moveHistory.push(move);
    updateMoveList();
    updateStatus();
}

// Update board position after piece snap
function onSnapEnd() {
    board.position(game.fen());
}

// Handle square clicks for click-to-move
function onSquareClick(e) {
    if (!document.getElementById('clickToMove').checked) return;
    
    const square = $(e.currentTarget).attr('data-square');
    const piece = game.get(square);
    
    // If no square is selected and there's a piece, select it
    if (!selectedSquare && piece && piece.color === game.turn()) {
        selectedSquare = square;
        highlightLegalMoves(square);
        return;
    }
    
    // If a square is already selected, try to move there
    if (selectedSquare) {
        const move = game.move({
            from: selectedSquare,
            to: square,
            promotion: 'q'
        });
        
        if (move) {
            moveHistory.push(move);
            board.position(game.fen());
            updateMoveList();
            updateStatus();
        }
        
        // Clear selection and highlights
        removeHighlights();
        selectedSquare = null;
    }
}

// Highlight legal moves for a piece
function highlightLegalMoves(square) {
    // Highlight the selected square
    $('#board .square-' + square).addClass('highlight-square');
    
    // Get legal moves
    const moves = game.moves({
        square: square,
        verbose: true
    });
    
    // Highlight legal move squares
    for (let i = 0; i < moves.length; i++) {
        $('#board .square-' + moves[i].to).addClass('legal-move');
    }
}

// Remove all highlights
function removeHighlights() {
    $('#board .square-55d63').removeClass('highlight-square legal-move');
}

// Handle mouse over square
function onMouseoverSquare(square, piece) {
    // Don't show hints if click-to-move is disabled or a square is already selected
    if (!document.getElementById('clickToMove').checked || selectedSquare) return;
    
    // Only show hints for pieces that can move
    if (!piece || piece.search(game.turn() === 'w' ? /^w/ : /^b/) === -1) return;
    
    const moves = game.moves({
        square: square,
        verbose: true
    });
    
    if (moves.length === 0) return;
    
    // Highlight the square being hovered
    $('#board .square-' + square).addClass('highlight-square');
}

// Handle mouse out of square
function onMouseoutSquare(square, piece) {
    if (!selectedSquare) {
        removeHighlights();
    }
}

// Set board theme
function setTheme(theme) {
    currentTheme = theme;
    
    // Get all board wrappers
    const boardWrappers = [
        document.getElementById('boardWrapper'),
        document.getElementById('spacedRepetitionBoardWrapper'),
        document.getElementById('practiceBoardWrapper'),
        document.getElementById('learnBoardWrapper')
    ].filter(el => el !== null);
    
    // Apply theme to all boards
    boardWrappers.forEach(boardWrapper => {
        // Remove all theme classes
        boardWrapper.classList.remove('theme-blue', 'theme-green', 'theme-brown', 'theme-purple', 'theme-gray');
        // Add new theme class
        boardWrapper.classList.add('theme-' + theme);
    });
    
    // Update active button
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-theme="${theme}"]`).classList.add('active');
    
    // Save to localStorage
    localStorage.setItem('boardTheme', theme);
}

// Check localStorage quota
function checkStorageQuota() {
    try {
        const total = JSON.stringify(localStorage).length;
        const maxSize = 5 * 1024 * 1024; // 5MB typical limit
        const usedPercent = (total / maxSize * 100).toFixed(1);
        
        if (total > maxSize * 0.9) {
            return {
                warning: true,
                message: `Storage is ${usedPercent}% full. Consider exporting and deleting old openings.`
            };
        }
        return { warning: false };
    } catch (e) {
        return { warning: true, message: 'Storage quota check failed.' };
    }
}

// Handle PGN file upload
function handlePGNUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const pgnText = e.target.result;
        parsePGN(pgnText);
    };
    reader.readAsText(file);
}

// Parse PGN and import openings
function parsePGN(pgnText) {
    const statusEl = document.getElementById('pgnStatus');
    
    // Check storage quota before importing
    const quotaCheck = checkStorageQuota();
    if (quotaCheck.warning) {
        statusEl.textContent = `⚠️ ${quotaCheck.message}`;
        statusEl.className = 'status-message error';
        statusEl.style.display = 'block';
        return;
    }
    
    try {
        // Split PGN into individual games
        const games = pgnText.split(/\n\n(?=\[)/).filter(g => g.trim());
        
        if (games.length === 0) {
            statusEl.textContent = '❌ No valid games found in PGN file';
            statusEl.className = 'status-message error';
            statusEl.style.display = 'block';
            return;
        }
        
        let imported = 0;
        let skipped = 0;
        const errors = [];
        
        games.forEach((gameText, index) => {
            try {
                const opening = parseSingleGame(gameText);
                if (opening && opening.moves.length > 0) {
                    // Save the opening
                    const openings = getOpenings();
                    const key = `${opening.name}_${Date.now()}_${Math.random()}`;
                    
                    openings[key] = {
                        name: opening.name,
                        category: opening.category,
                        playingAs: opening.playingAs,
                        firstMove: opening.moves[0],
                        moves: opening.moves,
                        reviewCount: 0,
                        difficulty: 1.0,
                        lastReviewed: null,
                        nextReview: new Date().toISOString()
                    };
                    
                    saveOpenings(openings);
                    imported++;
                } else {
                    skipped++;
                }
            } catch (err) {
                skipped++;
                if (errors.length < 3) {
                    errors.push(`Game ${index + 1}: ${err.message}`);
                }
            }
        });
        
        // Check quota again after import
        const postCheck = checkStorageQuota();
        if (postCheck.warning) {
            statusEl.textContent = `⚠️ Imported ${imported} opening(s) but ${postCheck.message}`;
            statusEl.className = 'status-message error';
            statusEl.style.display = 'block';
            return;
        }
        
        // Update UI
        displaySavedOpenings();
        updateCategoryList();
        populatePracticeFilters();
        populateLearnList();
        
        // Show status
        let statusMessage = `✅ Imported ${imported} opening(s)`;
        if (skipped > 0) {
            statusMessage += `, skipped ${skipped}`;
            if (errors.length > 0) {
                statusMessage += `\n\nErrors:\n${errors.join('\n')}`;
            }
        }
        statusEl.textContent = statusMessage;
        statusEl.className = 'status-message success';
        statusEl.style.display = 'block';
        
        setTimeout(() => {
            statusEl.style.display = 'none';
        }, 5000);
    } catch (err) {
        statusEl.textContent = `❌ Error parsing PGN: ${err.message}`;
        statusEl.className = 'status-message error';
        statusEl.style.display = 'block';
    }
}

// Parse a single PGN game
function parseSingleGame(gameText) {
    const lines = gameText.split('\n');
    const headers = {};
    let movesText = '';
    
    // Parse headers - handle both quoted and unquoted values
    lines.forEach(line => {
        const headerMatch = line.match(/\[([^\s]+)\s+"([^"]+)"\]/);
        if (headerMatch) {
            headers[headerMatch[1]] = headerMatch[2];
        } else if (line.trim() && !line.startsWith('[')) {
            movesText += ' ' + line;
        }
    });
    
    // Extract opening information with fallbacks
    const name = headers.Variation || headers.Opening || headers.Event || `Opening ${Date.now()}`;
    const category = headers.ECO ? `${headers.ECO} - ${headers.Opening || 'Unknown'}` : (headers.Opening || 'Imported');
    
    // Determine playing color from headers or default to white
    let playingAs = 'white';
    if (headers.Black && (headers.Black.toLowerCase().includes('player') || headers.Black.toLowerCase().includes('user'))) {
        playingAs = 'black';
    } else if (headers.White && (headers.White.toLowerCase().includes('player') || headers.White.toLowerCase().includes('user'))) {
        playingAs = 'white';
    }
    
    // Parse moves with comprehensive cleaning
    const moves = [];
    if (!movesText.trim()) {
        throw new Error('No moves found in game');
    }
    
    // Remove all PGN annotations and formatting
    movesText = movesText
        .replace(/\{[^}]*\}/g, '')           // Remove comments {like this}
        .replace(/\([^)]*\)/g, '')           // Remove variations (like this)
        .replace(/;[^\n]*/g, '')             // Remove ; comments
        .replace(/\$\d+/g, '')               // Remove NAG annotations $1
        .replace(/[!?]+/g, '')               // Remove move annotations !?, ?!
        .replace(/[+#]/g, '')                // Remove check/mate symbols (chess.js adds them)
        .replace(/\d+\.\.\./g, '')          // Remove black move numbers 1...
        .replace(/\d+\./g, '')               // Remove white move numbers 1.
        .replace(/\s+/g, ' ')                // Normalize whitespace
        .trim();
    
    // Split into tokens and filter out result markers
    const moveTokens = movesText
        .split(/\s+/)
        .filter(m => m && !['1-0', '0-1', '1/2-1/2', '*', ''].includes(m));
    
    if (moveTokens.length === 0) {
        throw new Error('No valid moves after parsing');
    }
    
    // Validate moves with chess.js
    const testGame = new Chess();
    for (let i = 0; i < moveTokens.length; i++) {
        const move = moveTokens[i];
        try {
            const result = testGame.move(move, { sloppy: true });
            if (result) {
                moves.push(result.san);
            } else {
                // Try without any special characters
                const cleanMove = move.replace(/[^a-zA-Z0-9]/g, '');
                const result2 = testGame.move(cleanMove, { sloppy: true });
                if (result2) {
                    moves.push(result2.san);
                }
            }
        } catch (e) {
            // Skip invalid moves silently
        }
    }
    
    if (moves.length === 0) {
        throw new Error('No valid chess moves found');
    }
    
    return {
        name: name,
        category: category,
        playingAs: playingAs,
        moves: moves
    };
}

// Update the move list display
function updateMoveList() {
    const moveListEl = document.getElementById('moveList');
    
    if (moveHistory.length === 0) {
        moveListEl.textContent = 'No moves yet. Make your first move!';
        return;
    }
    
    let moveText = '';
    for (let i = 0; i < moveHistory.length; i++) {
        if (i % 2 === 0) {
            moveText += `${Math.floor(i / 2) + 1}. `;
        }
        moveText += moveHistory[i].san + ' ';
    }
    
    moveListEl.textContent = moveText.trim();
}

// Update status message
function updateStatus() {
    const statusEl = document.getElementById('statusMessage');
    
    if (game.in_checkmate()) {
        statusEl.textContent = 'Game over - Checkmate!';
        statusEl.className = 'status-message error';
    } else if (game.in_draw()) {
        statusEl.textContent = 'Game over - Draw!';
        statusEl.className = 'status-message error';
    } else if (game.in_check()) {
        statusEl.textContent = 'Check!';
        statusEl.className = 'status-message error';
    } else {
        statusEl.style.display = 'none';
    }
}

// Undo last move
function undoMove() {
    if (moveHistory.length === 0) return;
    
    game.undo();
    moveHistory.pop();
    board.position(game.fen());
    updateMoveList();
    updateStatus();
}

// Reset the board
function resetBoard() {
    game.reset();
    board.position('start');
    moveHistory = [];
    updateMoveList();
    document.getElementById('statusMessage').style.display = 'none';
}

// Save opening to local storage
function saveOpening() {
    const variationName = document.getElementById('variationName').value.trim();
    const statusEl = document.getElementById('statusMessage');
    
    // Validation
    if (!variationName) {
        statusEl.textContent = 'Please enter a variation name!';
        statusEl.className = 'status-message error';
        return;
    }
    
    if (moveHistory.length === 0) {
        statusEl.textContent = 'Please make some moves first!';
        statusEl.className = 'status-message error';
        return;
    }
    
    // Get existing openings from local storage
    let openings = JSON.parse(localStorage.getItem('chessOpenings') || '{}');
    
    // Check for duplicate name
    if (openings[variationName]) {
        if (!confirm(`An opening named "${variationName}" already exists. Do you want to overwrite it?`)) {
            return;
        }
    }
    
    // Get category and playing color
    const categoryName = document.getElementById('categoryName').value.trim() || 'Uncategorized';
    const playingColor = document.querySelector('input[name="playingColor"]:checked').value;
    
    // Get first move for filtering
    const firstMove = moveHistory.length > 0 ? moveHistory[0].san : 'None';
    
    // Save the opening
    openings[variationName] = {
        name: variationName,
        category: categoryName,
        playingAs: playingColor,
        firstMove: firstMove,
        moves: moveHistory.map(m => m.san),
        pgn: game.pgn(),
        fen: game.fen(),
        createdAt: new Date().toISOString(),
        lastReviewed: null,
        reviewCount: 0,
        difficulty: 0
    };
    
    localStorage.setItem('chessOpenings', JSON.stringify(openings));
    
    // Update category list
    updateCategoryList();
    
    // Show success message
    statusEl.textContent = `Opening "${variationName}" saved successfully!`;
    statusEl.className = 'status-message success';
    
    // Clear the inputs
    document.getElementById('variationName').value = '';
    document.getElementById('categoryName').value = '';
    
    // Refresh the saved openings list
    displaySavedOpenings();
    
    // Hide success message after 3 seconds
    setTimeout(() => {
        statusEl.style.display = 'none';
    }, 3000);
}

// Update category datalist for autocomplete
function updateCategoryList() {
    const openings = JSON.parse(localStorage.getItem('chessOpenings') || '{}');
    const categories = new Set();
    
    for (const opening of Object.values(openings)) {
        if (opening.category && opening.category !== 'Uncategorized') {
            categories.add(opening.category);
        }
    }
    
    const datalist = document.getElementById('categoryList');
    datalist.innerHTML = '';
    
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        datalist.appendChild(option);
    });
}

// Display saved openings
function displaySavedOpenings() {
    const savedOpeningsEl = document.getElementById('savedOpenings');
    const openings = getOpenings();
    const searchTerm = document.getElementById('openingSearch')?.value.toLowerCase() || '';
    
    if (Object.keys(openings).length === 0) {
        savedOpeningsEl.innerHTML = '<div class="empty-message">No saved openings yet.</div>';
        return;
    }
    
    // Filter openings based on search
    const filteredEntries = Object.entries(openings).filter(([key, opening]) => {
        if (!searchTerm) return true;
        const name = opening.name.toLowerCase();
        const category = (opening.category || 'uncategorized').toLowerCase();
        return name.includes(searchTerm) || category.includes(searchTerm);
    });
    
    if (filteredEntries.length === 0) {
        savedOpeningsEl.innerHTML = '<div class="empty-message">No openings match your search.</div>';
        return;
    }
    
    let html = '';
    for (const [key, opening] of filteredEntries) {
        const moveText = opening.moves.join(' ');
        const category = opening.category || 'Uncategorized';
        const categoryClass = opening.category ? '' : 'no-category';
        const playingAs = opening.playingAs || 'white';
        const colorIcon = playingAs === 'white' ? '⚪' : '⚫';
        const colorClass = playingAs === 'white' ? 'color-white' : 'color-black';
        const firstMove = opening.firstMove || (opening.moves.length > 0 ? opening.moves[0] : 'None');
        html += `
            <div class="opening-item">
                <h4>
                    <span>${opening.name}</span>
                    <span class="category-badge ${categoryClass}">${category}</span>
                    <span class="color-badge ${colorClass}">${colorIcon} ${playingAs}</span>
                    <span class="first-move-badge">${firstMove}</span>
                </h4>
                <div class="moves">${moveText}</div>
                <div class="actions">
                    <button class="load-btn" onclick="loadOpening('${key}')">Load</button>
                    <button class="edit-btn" onclick="editOpeningCategory('${key}')">Edit Info</button>
                    <button class="delete-btn" onclick="deleteOpening('${key}')">Delete</button>
                </div>
            </div>
        `;
    }
    
    savedOpeningsEl.innerHTML = html;
}

// Filter openings list based on search
function filterOpeningsList() {
    displaySavedOpenings();
}

// Load an opening onto the board
function loadOpening(name) {
    const openings = getOpenings();
    const opening = openings[name];
    
    if (!opening) return;
    
    // Reset the board
    resetBoard();
    
    // Play through the moves
    for (const moveStr of opening.moves) {
        const move = game.move(moveStr);
        if (move) {
            moveHistory.push(move);
        }
    }
    
    board.position(game.fen());
    updateMoveList();
    
    // Set the variation name, category, and playing color
    document.getElementById('variationName').value = opening.name;
    document.getElementById('categoryName').value = opening.category || '';
    
    const playingAs = opening.playingAs || 'white';
    document.querySelector(`input[name="playingColor"][value="${playingAs}"]`).checked = true;
    
    const statusEl = document.getElementById('statusMessage');
    statusEl.textContent = `Loaded opening: ${opening.name}`;
    statusEl.className = 'status-message success';
    setTimeout(() => {
        statusEl.style.display = 'none';
    }, 3000);
}

// Edit opening category and color
let currentEditingKey = null;

function editOpeningCategory(name) {
    const openings = getOpenings();
    const opening = openings[name];
    
    if (!opening) return;
    
    currentEditingKey = name;
    
    // Populate modal with current values
    document.getElementById('editVariationName').value = opening.name || name;
    document.getElementById('editCategory').value = opening.category || 'Uncategorized';
    
    const playingAs = opening.playingAs || 'white';
    if (playingAs === 'white') {
        document.getElementById('editColorWhite').checked = true;
    } else {
        document.getElementById('editColorBlack').checked = true;
    }
    
    // Show modal
    document.getElementById('editModal').style.display = 'flex';
}

function saveEditChanges() {
    if (!currentEditingKey) return;
    
    const openings = JSON.parse(localStorage.getItem('chessOpenings') || '{}');
    const opening = openings[currentEditingKey];
    
    if (!opening) return;
    
    // Get new values
    const newName = document.getElementById('editVariationName').value.trim();
    const newCategory = document.getElementById('editCategory').value.trim();
    const newColor = document.querySelector('input[name="editPlayingColor"]:checked').value;
    
    // Update opening
    if (newName) opening.name = newName;
    opening.category = newCategory || 'Uncategorized';
    opening.playingAs = newColor;
    
    openings[currentEditingKey] = opening;
    localStorage.setItem('chessOpenings', JSON.stringify(openings));
    
    displaySavedOpenings();
    updateCategoryList();
    populatePracticeFilters();
    populateLearnList();
    
    currentEditingKey = null;
    
    const statusEl = document.getElementById('statusMessage');
    statusEl.textContent = `Opening info updated!`;
    statusEl.className = 'status-message success';
    statusEl.style.display = 'block';
    setTimeout(() => {
        statusEl.style.display = 'none';
    }, 3000);
}

// Delete an opening
function deleteOpening(name) {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) {
        return;
    }
    
    const openings = JSON.parse(localStorage.getItem('chessOpenings') || '{}');
    delete openings[name];
    localStorage.setItem('chessOpenings', JSON.stringify(openings));
    
    displaySavedOpenings();
    
    const statusEl = document.getElementById('statusMessage');
    statusEl.textContent = `Opening "${name}" deleted.`;
    statusEl.className = 'status-message success';
    setTimeout(() => {
        statusEl.style.display = 'none';
    }, 3000);
}

// Migrate old openings to ensure all have required fields
function migrateOpenings() {
    const openings = JSON.parse(localStorage.getItem('chessOpenings') || '{}');
    let needsSave = false;
    
    // Common white opening moves
    const whiteOpeningMoves = ['e4', 'd4', 'c4', 'Nf3', 'g3', 'b3', 'f4', 'Nc3', 'e3', 'd3', 'c3', 'Nf6', 'g4', 'b4'];
    
    for (const [key, opening] of Object.entries(openings)) {
        // Fix missing playingAs field
        if (!opening.playingAs) {
            // Try to infer from first move
            let inferredColor = 'white';
            if (opening.moves && opening.moves.length > 0) {
                const firstMove = opening.moves[0];
                // If first move is NOT a typical white opening, it's probably black
                if (!whiteOpeningMoves.includes(firstMove)) {
                    inferredColor = 'black';
                }
            }
            opening.playingAs = inferredColor;
            needsSave = true;
        }
        
        // Fix missing firstMove field
        if (!opening.firstMove && opening.moves && opening.moves.length > 0) {
            opening.firstMove = opening.moves[0];
            needsSave = true;
        }
        
        // Fix missing category
        if (!opening.category) {
            opening.category = 'Uncategorized';
            needsSave = true;
        }
    }
    
    if (needsSave) {
        localStorage.setItem('chessOpenings', JSON.stringify(openings));
    }
}

// Initialize everything when DOM is ready
$(document).ready(function() {
    initBoard();
    updateMoveList();
    
    // Migrate old openings to ensure they have playingAs field
    migrateOpenings();
    
    displaySavedOpenings();
    updateCategoryList();
    
    // Load dark mode preference
    const darkMode = localStorage.getItem('darkMode') === 'true';
    if (darkMode) {
        document.body.classList.add('dark-mode');
        document.getElementById('darkModeToggle').checked = true;
    }
    
    // Load click-to-move preference
    const clickToMoveValue = localStorage.getItem('clickToMove');
    const clickToMove = clickToMoveValue === 'true' || clickToMoveValue === null; // Default to true if not set
    if (clickToMoveValue === null) {
        localStorage.setItem('clickToMove', 'true');
    }
    document.getElementById('clickToMove').checked = clickToMove;
    document.querySelectorAll('.click-to-move-toggle').forEach(toggle => {
        toggle.checked = clickToMove;
    });
    
    // Event listeners
    document.getElementById('saveBtn').addEventListener('click', saveOpening);
    document.getElementById('undoBtn').addEventListener('click', undoMove);
    document.getElementById('resetBtn').addEventListener('click', resetBoard);
    document.getElementById('pgnFile').addEventListener('change', handlePGNUpload);
    
    // Theme button listeners
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            setTheme(this.getAttribute('data-theme'));
        });
    });
    
    // Click-to-move toggle listener (main settings page)
    document.getElementById('clickToMove').addEventListener('change', function() {
        const clickToMoveEnabled = this.checked;
        
        // Save preference
        localStorage.setItem('clickToMove', clickToMoveEnabled);
        
        // Sync all toggles
        document.querySelectorAll('.click-to-move-toggle').forEach(toggle => {
            toggle.checked = clickToMoveEnabled;
        });
        
        // Apply to all boards
        removeHighlights();
        selectedSquare = null;
        board.draggable = !clickToMoveEnabled;
        
        if (spacedRepetitionBoard) spacedRepetitionBoard.draggable = !clickToMoveEnabled;
        if (filteredPracticeBoard) filteredPracticeBoard.draggable = !clickToMoveEnabled;
        if (learnBoard) learnBoard.draggable = !clickToMoveEnabled;
    });
    
    // Click-to-move toggle listeners for other pages
    document.querySelectorAll('.click-to-move-toggle').forEach(toggle => {
        toggle.addEventListener('change', function() {
            const clickToMoveEnabled = this.checked;
            
            // Save preference
            localStorage.setItem('clickToMove', clickToMoveEnabled);
            
            // Sync main toggle
            document.getElementById('clickToMove').checked = clickToMoveEnabled;
            
            // Sync all other toggles
            document.querySelectorAll('.click-to-move-toggle').forEach(t => {
                t.checked = clickToMoveEnabled;
            });
            
            // Apply to all boards - Need to update the config object
            removeHighlights();
            selectedSquare = null;
            if (spacedRepetitionSelectedSquare) {
                spacedRepetitionSelectedSquare = null;
                $('#spacedRepetitionBoard .square-55d63').removeClass('highlight-square legal-move');
            }
            if (filteredPracticeSelectedSquare) {
                filteredPracticeSelectedSquare = null;
                $('#practiceBoard .square-55d63').removeClass('highlight-square legal-move');
            }
            if (learnSelectedSquare) {
                learnSelectedSquare = null;
                $('#learnBoard .square-55d63').removeClass('highlight-square legal-move');
            }
            
            // Update draggable property - use the board's config method
            if (board && board.hasOwnProperty('draggable')) {
                board.draggable = !clickToMoveEnabled;
            }
            if (spacedRepetitionBoard) {
                if (spacedRepetitionBoard.hasOwnProperty('draggable')) {
                    spacedRepetitionBoard.draggable = !clickToMoveEnabled;
                }
                // Force redraw by updating position
                const currentPos = spacedRepetitionBoard.position();
                spacedRepetitionBoard.position(currentPos);
            }
            if (filteredPracticeBoard) {
                if (filteredPracticeBoard.hasOwnProperty('draggable')) {
                    filteredPracticeBoard.draggable = !clickToMoveEnabled;
                }
                const currentPos = filteredPracticeBoard.position();
                filteredPracticeBoard.position(currentPos);
            }
            if (learnBoard) {
                if (learnBoard.hasOwnProperty('draggable')) {
                    learnBoard.draggable = !clickToMoveEnabled;
                }
                const currentPos = learnBoard.position();
                learnBoard.position(currentPos);
            }
        });
    });
    
    // Flip board listener
    document.getElementById('flipBoardBtn').addEventListener('click', function() {
        board.flip();
        
        // Toggle the playing color to match board orientation
        const currentColor = document.querySelector('input[name="playingColor"]:checked').value;
        const newColor = currentColor === 'white' ? 'black' : 'white';
        document.querySelector(`input[name="playingColor"][value="${newColor}"]`).checked = true;
    });
    
    // Dark mode toggle listener
    document.getElementById('darkModeToggle').addEventListener('change', function() {
        if (this.checked) {
            document.body.classList.add('dark-mode');
            localStorage.setItem('darkMode', 'true');
        } else {
            document.body.classList.remove('dark-mode');
            localStorage.setItem('darkMode', 'false');
        }
    });
    
    // Edit modal buttons
    document.getElementById('saveEditBtn').addEventListener('click', function() {
        saveEditChanges();
        document.getElementById('editModal').style.display = 'none';
    });
    
    document.getElementById('cancelEditBtn').addEventListener('click', function() {
        document.getElementById('editModal').style.display = 'none';
        currentEditingKey = null;
    });
    
    // Close modal on background click
    document.getElementById('editModal').addEventListener('click', function(e) {
        if (e.target === this) {
            this.style.display = 'none';
            currentEditingKey = null;
        }
    });
    
    // Navigation menu
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const viewName = this.getAttribute('data-view');
            switchView(viewName);
        });
    });
    
    // Initialize all boards
    initSpacedRepetitionBoard();
    initPracticeBoard();
    initLearnBoard();
    
    // Spaced Repetition mode buttons
    document.getElementById('startSpacedRepetitionBtn').addEventListener('click', startSpacedPractice);
    document.getElementById('hintSpacedRepetitionBtn').addEventListener('click', showSpacedRepetitionHint);
    document.getElementById('nextSpacedRepetitionBtn').addEventListener('click', loadNextSpacedRepetitionOpening);
    document.getElementById('spacedRepetitionFlipBtn').addEventListener('click', () => spacedRepetitionBoard.flip());
    document.getElementById('resetProgressBtn').addEventListener('click', resetProgress);
    
    // Practice mode buttons
    document.getElementById('practiceWhiteBtn').addEventListener('click', () => startFilteredPractice('white', null, null));
    document.getElementById('practiceBlackBtn').addEventListener('click', () => startFilteredPractice('black', null, null));
    document.getElementById('practiceByCategory').addEventListener('click', () => {
        const category = document.getElementById('practiceCategoryFilter').value;
        if (category) startFilteredPractice(null, category, null);
    });
    document.getElementById('practiceByFirstMove').addEventListener('click', () => {
        const firstMove = document.getElementById('practiceFirstMoveFilter').value;
        if (firstMove) startFilteredPractice(null, null, firstMove);
    });
    document.getElementById('hintPracticeBtn').addEventListener('click', showFilteredPracticeHint);
    document.getElementById('nextPracticeBtn').addEventListener('click', loadNextFilteredPracticeOpening);
    document.getElementById('practiceFlipBtn').addEventListener('click', () => filteredPracticeBoard.flip());
    
    // Learn mode buttons
    document.getElementById('startLearnBtn').addEventListener('click', startLearnPractice);
    document.getElementById('showLearnAnswerBtn').addEventListener('click', showLearnAnswer);
    document.getElementById('resetLearnBtn').addEventListener('click', resetLearnPractice);
    document.getElementById('learnFlipBtn').addEventListener('click', () => learnBoard.flip());
    
    // Learn filters
    document.getElementById('learnCategoryFilter').addEventListener('change', updateLearnFilters);
    document.getElementById('learnFirstMoveFilter').addEventListener('change', updateLearnFilters);
    document.getElementById('learnColorFilter').addEventListener('change', updateLearnFilters);
    
    // Export/Import data
    document.getElementById('exportDataBtn').addEventListener('click', exportAllData);
    document.getElementById('importDataBtn').addEventListener('click', () => {
        document.getElementById('importDataFile').click();
    });
    document.getElementById('importDataFile').addEventListener('change', importAllData);
    document.getElementById('resetAllProgress').addEventListener('click', resetAllProgress);
    
    // Search/filter openings
    document.getElementById('openingSearch').addEventListener('input', filterOpeningsList);
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
    
    // Initialize filters and queues
    populateLearnList();
    populatePracticeFilters();
    updateSpacedRepetitionQueue();
});

// Switch between views
function switchView(viewName) {
    // Clean up all status message timeouts to prevent leaks
    if (spacedRepetitionStatusTimeout) {
        clearTimeout(spacedRepetitionStatusTimeout);
        spacedRepetitionStatusTimeout = null;
    }
    if (practiceStatusTimeout) {
        clearTimeout(practiceStatusTimeout);
        practiceStatusTimeout = null;
    }
    if (learnStatusTimeout) {
        clearTimeout(learnStatusTimeout);
        learnStatusTimeout = null;
    }
    
    // Hide all views
    document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    
    // Show selected view
    document.getElementById(viewName + 'View').classList.add('active');
    document.querySelector(`[data-view="${viewName}"]`).classList.add('active');
    
    // Update page title
    const titles = {
        'spacedRepetition': 'Spaced Repetition',
        'practice': 'Practice Mode',
        'learn': 'Learn Mode',
        'manage': 'Manage Openings',
        'settings': 'Settings'
    };
    document.title = `${titles[viewName] || 'Chess Opening Trainer'} - Chess Opening Trainer`;
    
    // Update data when switching views
    if (viewName === 'learn') {
        populateLearnList();
    }
    
    if (viewName === 'practice') {
        populatePracticeFilters();
    }
    
    if (viewName === 'spacedRepetition') {
        updateSpacedRepetitionQueue();
    }
}

// Initialize spaced repetition board
function initSpacedRepetitionBoard() {
    const config = {
        draggable: true,
        position: 'start',
        onDragStart: onSpacedRepetitionDragStart,
        onDrop: onSpacedRepetitionDrop,
        onSnapEnd: () => spacedRepetitionBoard.position(spacedRepetitionGame.fen()),
        pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
    };
    spacedRepetitionBoard = Chessboard('spacedRepetitionBoard', config);
    $('#spacedRepetitionBoardWrapper').addClass('theme-' + currentTheme);
    
    // Add click-to-move functionality
    $('#spacedRepetitionBoard').on('click', '.square-55d63', function(e) {
        if (!document.getElementById('clickToMoveSpacedRepetition').checked) return;
        handleSpacedRepetitionSquareClick($(this).attr('data-square'));
    });
}

// Initialize practice board (filtered mode)
function initPracticeBoard() {
    initFilteredPracticeBoard();
}

// Initialize learn board
function initLearnBoard() {
    const config = {
        draggable: true,
        position: 'start',
        onDragStart: onLearnDragStart,
        onDrop: onLearnDrop,
        onSnapEnd: () => learnBoard.position(learnGame.fen()),
        pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
    };
    learnBoard = Chessboard('learnBoard', config);
    $('#learnBoardWrapper').addClass('theme-' + currentTheme);
    
    // Add click-to-move functionality
    $('#learnBoard').on('click', '.square-55d63', function(e) {
        if (!document.getElementById('clickToMoveLearn').checked) return;
        handleLearnSquareClick($(this).attr('data-square'));
    });
}

// Spaced repetition algorithm - calculate next review date
function calculateNextReview(opening, correct) {
    const now = new Date();
    let interval = 1; // days
    
    if (!opening.reviewCount) opening.reviewCount = 0;
    if (!opening.difficulty) opening.difficulty = 0;
    
    if (correct) {
        // Increase interval based on review count
        opening.reviewCount++;
        opening.difficulty = Math.max(0, opening.difficulty - 0.1);
        
        if (opening.reviewCount === 1) interval = 1;
        else if (opening.reviewCount === 2) interval = 3;
        else if (opening.reviewCount === 3) interval = 7;
        else if (opening.reviewCount === 4) interval = 14;
        else interval = Math.min(30, opening.reviewCount * 7);
    } else {
        // Reset for incorrect answers
        opening.reviewCount = 0;
        opening.difficulty = Math.min(1, opening.difficulty + 0.2);
        interval = 0.5; // Review again soon
    }
    
    const nextReview = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);
    opening.lastReviewed = now.toISOString();
    opening.nextReview = nextReview.toISOString();
    
    return opening;
}

// Update spaced repetition queue with openings due for review
function updateSpacedRepetitionQueue() {
    const openings = JSON.parse(localStorage.getItem('chessOpenings') || '{}');
    const now = new Date();
    
    spacedRepetitionQueue = [];
    
    for (const [key, opening] of Object.entries(openings)) {
        const nextReview = opening.nextReview ? new Date(opening.nextReview) : new Date(0);
        
        if (nextReview <= now) {
            spacedRepetitionQueue.push({ key, ...opening });
        }
    }
    
    // Shuffle the queue using Fisher-Yates algorithm
    for (let i = spacedRepetitionQueue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [spacedRepetitionQueue[i], spacedRepetitionQueue[j]] = [spacedRepetitionQueue[j], spacedRepetitionQueue[i]];
    }
    
    updateSpacedRepetitionProgress();
}

// Update spaced repetition progress display
function updateSpacedRepetitionProgress() {
    const progressEl = document.getElementById('spacedRepetitionProgress');
    const totalOpenings = Object.keys(JSON.parse(localStorage.getItem('chessOpenings') || '{}')).length;
    const dueCount = spacedRepetitionQueue.length;
    
    progressEl.innerHTML = `
        <div style="font-size: 1.2em; margin-bottom: 15px;">
            <strong>${dueCount}</strong> opening${dueCount !== 1 ? 's' : ''} due for review
        </div>
        <div style="color: #999;">
            Total openings: ${totalOpenings}
        </div>
    `;
}

// Start spaced repetition practice
function startSpacedPractice() {
    const startBtn = document.getElementById('startSpacedRepetitionBtn');
    
    // Prevent multiple clicks
    if (startBtn.disabled) return;
    startBtn.disabled = true;
    
    spacedRepetitionQueue = [];
    sessionCompletedCount = 0; // Reset session counter
    updateSpacedRepetitionQueue();
    
    if (spacedRepetitionQueue.length === 0) {
        const statusEl = document.getElementById('spacedRepetitionStatus');
        statusEl.textContent = 'No openings due for review! Check back later or add more openings.';
        statusEl.className = 'status-message error';
        statusEl.style.display = 'block';
        startBtn.disabled = false;
        return;
    }
    
    practiceMode = 'spaced';
    loadNextSpacedRepetitionOpening();
    
    // Re-enable button after short delay
    setTimeout(() => {
        startBtn.disabled = false;
    }, 500);
}

// Update progress indicator
function updateProgressIndicator(elementId, completed, total) {
    const progressEl = document.getElementById(elementId);
    if (progressEl && total > 0) {
        progressEl.textContent = `Progress: ${completed} of ${total} completed`;
        progressEl.style.display = 'block';
    }
}

// Load next opening for spaced repetition practice
function loadNextSpacedRepetitionOpening() {
    if (spacedRepetitionQueue.length === 0) {
        const statusEl = document.getElementById('spacedRepetitionStatus');
        statusEl.textContent = `🎉 All done! Completed ${sessionCompletedCount} opening(s) this session!`;
        statusEl.className = 'status-message success';
        document.getElementById('startSpacedRepetitionBtn').style.display = 'block';
        document.getElementById('nextSpacedRepetitionBtn').style.display = 'none';
        document.getElementById('spacedRepetitionProgress').style.display = 'none';
        updateSpacedRepetitionQueue();
        return;
    }
    
    currentSpacedRepetitionOpening = spacedRepetitionQueue[0];
    currentMoveIndex = 0;
    spacedRepetitionHasMistakes = false;
    
    // Update progress indicator
    const totalInSession = sessionCompletedCount + spacedRepetitionQueue.length;
    updateProgressIndicator('spacedRepetitionProgress', sessionCompletedCount, totalInSession);
    
    // Clear any existing status timeout
    if (spacedRepetitionStatusTimeout) {
        clearTimeout(spacedRepetitionStatusTimeout);
        spacedRepetitionStatusTimeout = null;
    }
    spacedRepetitionGame.reset();
    spacedRepetitionBoard.position('start');
    
    // Orient board based on playing color
    const playingColor = currentSpacedRepetitionOpening.playingAs || 'white';
    if (playingColor === 'black') {
        spacedRepetitionBoard.orientation('black');
    } else {
        spacedRepetitionBoard.orientation('white');
    }
    
    // Make opponent's first move if we're playing black
    if (playingColor === 'black' && currentSpacedRepetitionOpening.moves.length > 0) {
        spacedRepetitionGame.move(currentSpacedRepetitionOpening.moves[0]);
        spacedRepetitionBoard.position(spacedRepetitionGame.fen());
        currentMoveIndex = 1;
    }
    
    document.getElementById('spacedRepetitionOpeningName').textContent = currentSpacedRepetitionOpening.category || 'Uncategorized';
    document.getElementById('spacedRepetitionInfo').innerHTML = `
        <p><strong>Playing as:</strong> ${currentSpacedRepetitionOpening.playingAs || 'white'}</p>
        <p><strong>Your turn!</strong> Make your ${currentMoveIndex > 0 ? 'next' : 'first'} move.</p>
    `;
    document.getElementById('spacedRepetitionMoveList').innerHTML = '';
    document.getElementById('spacedRepetitionStatus').style.display = 'none';
    document.getElementById('startSpacedRepetitionBtn').style.display = 'none';
    document.getElementById('hintSpacedRepetitionBtn').style.display = 'inline-block';
    document.getElementById('nextSpacedRepetitionBtn').style.display = 'none';
}

// Handle spaced repetition drag start
function onSpacedRepetitionDragStart(source, piece) {
    // Check if click-to-move is enabled - if so, prevent dragging
    if (document.getElementById('clickToMoveSpacedRepetition') && 
        document.getElementById('clickToMoveSpacedRepetition').checked) {
        return false;
    }
    
    if (!currentSpacedRepetitionOpening) return false;
    if (spacedRepetitionGame.game_over()) return false;
    
    const playerColor = (currentSpacedRepetitionOpening.playingAs || 'white') === 'white' ? 'w' : 'b';
    if (spacedRepetitionGame.turn() !== playerColor) return false;
    
    if ((playerColor === 'w' && piece.search(/^b/) !== -1) ||
        (playerColor === 'b' && piece.search(/^w/) !== -1)) {
        return false;
    }
}

// Handle spaced repetition drop
function onSpacedRepetitionDrop(source, target) {
    if (!currentSpacedRepetitionOpening) return 'snapback';
    
    const move = spacedRepetitionGame.move({
        from: source,
        to: target,
        promotion: 'q'
    });
    
    if (move === null) return 'snapback';
    
    // Check if it matches the expected move
    const expectedMove = currentSpacedRepetitionOpening.moves[currentMoveIndex];
    
    if (move.san === expectedMove) {
        playSuccessSound();
        currentMoveIndex++;
        
        // Update move list
        updateSpacedRepetitionMoveList();
        
        // Check if we're done with this opening (all YOUR moves are complete)
        const playerColor = (currentSpacedRepetitionOpening.playingAs || 'white') === 'white' ? 'w' : 'b';
        
        // Count how many of YOUR moves you've completed
        let yourMovesCompleted = 0;
        for (let i = 0; i < currentMoveIndex; i++) {
            if ((playerColor === 'w' && i % 2 === 0) || (playerColor === 'b' && i % 2 === 1)) {
                yourMovesCompleted++;
            }
        }
        
        // Count total YOUR moves in the opening
        let totalYourMoves = 0;
        for (let i = 0; i < currentSpacedRepetitionOpening.moves.length; i++) {
            if ((playerColor === 'w' && i % 2 === 0) || (playerColor === 'b' && i % 2 === 1)) {
                totalYourMoves++;
            }
        }
        
        if (yourMovesCompleted >= totalYourMoves) {
            // Opening complete!
            setTimeout(() => {
                // Clear any existing timeout that might hide the status
                if (spacedRepetitionStatusTimeout) {
                    clearTimeout(spacedRepetitionStatusTimeout);
                    spacedRepetitionStatusTimeout = null;
                }
                
                const statusEl = document.getElementById('spacedRepetitionStatus');
                statusEl.textContent = spacedRepetitionHasMistakes ? '✅ Opening Complete!' : '✅ Perfect! Opening Complete!';
                statusEl.className = 'status-message success';
                statusEl.style.display = 'block';
                
                // Update opening with correct answer (only if perfect)
                if (!spacedRepetitionHasMistakes) {
                    const openings = JSON.parse(localStorage.getItem('chessOpenings') || '{}');
                    const updated = calculateNextReview(openings[currentSpacedRepetitionOpening.key], true);
                    openings[currentSpacedRepetitionOpening.key] = updated;
                    localStorage.setItem('chessOpenings', JSON.stringify(openings));
                }
                
                // Remove from queue and increment session counter
                spacedRepetitionQueue.shift();
                sessionCompletedCount++;
                
                document.getElementById('hintSpacedRepetitionBtn').style.display = 'none';
                document.getElementById('nextSpacedRepetitionBtn').style.display = 'inline-block';
                updateSpacedRepetitionProgress();
            }, 500);
            return;
        }
        
        // Make opponent's next move
        if (currentMoveIndex < currentSpacedRepetitionOpening.moves.length) {
            setTimeout(() => {
                const opponentMove = spacedRepetitionGame.move(currentSpacedRepetitionOpening.moves[currentMoveIndex]);
                if (opponentMove) {
                    spacedRepetitionBoard.position(spacedRepetitionGame.fen());
                    currentMoveIndex++;
                    updateSpacedRepetitionMoveList();
                    
                    // Check if we've reached the end after opponent's move
                    if (currentMoveIndex >= currentSpacedRepetitionOpening.moves.length) {
                        setTimeout(() => {
                            // Clear any existing timeout that might hide the status
                            if (spacedRepetitionStatusTimeout) {
                                clearTimeout(spacedRepetitionStatusTimeout);
                                spacedRepetitionStatusTimeout = null;
                            }
                            
                            const statusEl = document.getElementById('spacedRepetitionStatus');
                            statusEl.textContent = spacedRepetitionHasMistakes ? '✅ Opening Complete!' : '✅ Perfect! Opening Complete!';
                            statusEl.className = 'status-message success';
                            statusEl.style.display = 'block';
                            
                            // Remove from queue and increment session counter
                            spacedRepetitionQueue.shift();
                            sessionCompletedCount++;
                            
                            document.getElementById('hintSpacedRepetitionBtn').style.display = 'none';
                            document.getElementById('nextSpacedRepetitionBtn').style.display = 'inline-block';
                            updateSpacedRepetitionProgress();
                        }, 500);
                    }
                }
            }, 500);
        }
    } else {
        playErrorSound();
        spacedRepetitionGame.undo();
        spacedRepetitionHasMistakes = true;
        
        const statusEl = document.getElementById('spacedRepetitionStatus');
        statusEl.textContent = `❌ Wrong! Try again!`;
        statusEl.className = 'status-message error';
        statusEl.style.display = 'block';
        
        // Mark as incorrect but don't remove from queue yet
        const openings = JSON.parse(localStorage.getItem('chessOpenings') || '{}');
        const updated = calculateNextReview(openings[currentSpacedRepetitionOpening.key], false);
        openings[currentSpacedRepetitionOpening.key] = updated;
        localStorage.setItem('chessOpenings', JSON.stringify(openings));
        
        // Clear any existing timeout and set new one
        if (spacedRepetitionStatusTimeout) {
            clearTimeout(spacedRepetitionStatusTimeout);
        }
        spacedRepetitionStatusTimeout = setTimeout(() => {
            statusEl.style.display = 'none';
            spacedRepetitionStatusTimeout = null;
        }, 3000);
        
        return 'snapback';
    }
}

// Handle click-to-move for spaced repetition
let spacedRepetitionSelectedSquare = null;
function handleSpacedRepetitionSquareClick(square) {
    if (!currentSpacedRepetitionOpening) return;
    
    if (!spacedRepetitionSelectedSquare) {
        const piece = spacedRepetitionGame.get(square);
        if (piece) {
            const playerColor = (currentSpacedRepetitionOpening.playingAs || 'white') === 'white' ? 'w' : 'b';
            if (piece.color === playerColor) {
                spacedRepetitionSelectedSquare = square;
                $('#spacedRepetitionBoard .square-55d63').removeClass('highlight-square legal-move');
                $(`#spacedRepetitionBoard .square-${square}`).addClass('highlight-square');
                
                // Highlight legal moves
                const moves = spacedRepetitionGame.moves({
                    square: square,
                    verbose: true
                });
                for (let i = 0; i < moves.length; i++) {
                    $(`#spacedRepetitionBoard .square-${moves[i].to}`).addClass('legal-move');
                }
            }
        }
    } else {
        // If clicking the same square, deselect
        if (square === spacedRepetitionSelectedSquare) {
            spacedRepetitionSelectedSquare = null;
            $('#spacedRepetitionBoard .square-55d63').removeClass('highlight-square legal-move');
            return;
        }
        
        const result = onSpacedRepetitionDrop(spacedRepetitionSelectedSquare, square);
        if (result !== 'snapback') {
            spacedRepetitionBoard.position(spacedRepetitionGame.fen());
        }
        spacedRepetitionSelectedSquare = null;
        $('#spacedRepetitionBoard .square-55d63').removeClass('highlight-square legal-move');
    }
}

// Update spaced repetition move list
function updateSpacedRepetitionMoveList() {
    const moveListEl = document.getElementById('spacedRepetitionMoveList');
    let html = '<h3>Moves Played:</h3><div style="background: var(--bg-secondary, #f8f9fa); padding: 15px; border-radius: 6px; font-family: monospace; color: var(--text-primary, #000);">';
    
    for (let i = 0; i < currentMoveIndex; i++) {
        if (i % 2 === 0) {
            html += `${Math.floor(i / 2) + 1}. `;
        }
        html += currentSpacedRepetitionOpening.moves[i] + ' ';
    }
    
    html += '</div>';
    moveListEl.innerHTML = html;
}

// Show hint for current spaced repetition opening (piece type only)
function showSpacedRepetitionHint() {
    if (!currentSpacedRepetitionOpening || currentMoveIndex >= currentSpacedRepetitionOpening.moves.length) return;
    
    const expectedMove = currentSpacedRepetitionOpening.moves[currentMoveIndex];
    
    // Determine piece type from move notation
    let pieceType = 'Pawn';
    if (expectedMove.startsWith('N')) pieceType = 'Knight';
    else if (expectedMove.startsWith('B')) pieceType = 'Bishop';
    else if (expectedMove.startsWith('R')) pieceType = 'Rook';
    else if (expectedMove.startsWith('Q')) pieceType = 'Queen';
    else if (expectedMove.startsWith('K')) pieceType = 'King';
    else if (expectedMove.startsWith('O')) pieceType = 'King';
    
    const moveListEl = document.getElementById('spacedRepetitionMoveList');
    moveListEl.innerHTML = `
        <h3>Hint:</h3>
        <div style="background: var(--bg-secondary, #f8f9fa); padding: 15px; border-radius: 6px; border-left: 4px solid #ffc107; color: var(--text-primary, #000);">
            Move a <strong>${pieceType}</strong>
        </div>
    `;
}

// Show hint for filtered practice opening (piece type only)
function showFilteredPracticeHint() {
    if (!currentFilteredPracticeOpening || currentMoveIndex >= currentFilteredPracticeOpening.moves.length) return;
    
    const expectedMove = currentFilteredPracticeOpening.moves[currentMoveIndex];
    
    // Determine piece type from move notation
    let pieceType = 'Pawn';
    if (expectedMove.startsWith('N')) pieceType = 'Knight';
    else if (expectedMove.startsWith('B')) pieceType = 'Bishop';
    else if (expectedMove.startsWith('R')) pieceType = 'Rook';
    else if (expectedMove.startsWith('Q')) pieceType = 'Queen';
    else if (expectedMove.startsWith('K')) pieceType = 'King';
    else if (expectedMove.startsWith('O')) pieceType = 'King';
    
    const moveListEl = document.getElementById('practiceMoveList');
    moveListEl.innerHTML = `
        <h3>Hint:</h3>
        <div style="background: var(--bg-secondary, #f8f9fa); padding: 15px; border-radius: 6px; border-left: 4px solid #ffc107; color: var(--text-primary, #000);">
            Move a <strong>${pieceType}</strong>
        </div>
    `;
}

// Reset progress for all openings (development tool)
function resetProgress() {
    if (!confirm('Are you sure you want to reset all review progress? This will mark all openings as never reviewed.')) {
        return;
    }
    
    const openings = JSON.parse(localStorage.getItem('chessOpenings') || '{}');
    
    Object.keys(openings).forEach(key => {
        openings[key].reviewCount = 0;
        openings[key].difficulty = 0;
        openings[key].lastReviewed = null;
        openings[key].nextReview = null;
    });
    
    localStorage.setItem('chessOpenings', JSON.stringify(openings));
    
    updateSpacedRepetitionQueue();
    updateSpacedRepetitionProgress();
    
    const statusEl = document.getElementById('spacedRepetitionStatus');
    statusEl.textContent = '✅ Progress reset! All openings are now available for review.';
    statusEl.className = 'status-message success';
    statusEl.style.display = 'block';
    
    setTimeout(() => {
        statusEl.style.display = 'none';
    }, 3000);
}

// Export all data as JSON
function exportAllData() {
    try {
        const data = {
            openings: JSON.parse(localStorage.getItem('chessOpenings') || '{}'),
            theme: localStorage.getItem('boardTheme') || 'blue',
            darkMode: localStorage.getItem('darkMode') === 'true',
            clickToMove: localStorage.getItem('clickToMove') !== 'false',
            version: '1.0',
            exportDate: new Date().toISOString()
        };
        
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `chess-openings-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        alert('✅ Data exported successfully!');
    } catch (err) {
        alert('❌ Failed to export data: ' + err.message);
    }
}

// Import data from JSON file
function importAllData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!confirm('This will replace all your current data. Make sure you have a backup! Continue?')) {
        event.target.value = '';
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            // Validate data structure
            if (!data.openings || typeof data.openings !== 'object') {
                throw new Error('Invalid backup file format');
            }
            
            // Check storage quota before importing
            const quotaCheck = checkStorageQuota();
            if (quotaCheck.warning) {
                alert(`⚠️ ${quotaCheck.message}\n\nImport cancelled.`);
                event.target.value = '';
                return;
            }
            
            // Import data
            localStorage.setItem('chessOpenings', JSON.stringify(data.openings));
            if (data.theme) localStorage.setItem('boardTheme', data.theme);
            if (data.darkMode !== undefined) localStorage.setItem('darkMode', data.darkMode.toString());
            if (data.clickToMove !== undefined) localStorage.setItem('clickToMove', data.clickToMove.toString());
            
            alert(`✅ Successfully imported ${Object.keys(data.openings).length} opening(s)!\n\nRefreshing page...`);
            location.reload();
        } catch (err) {
            alert('❌ Failed to import data: ' + err.message);
        }
        event.target.value = '';
    };
    
    reader.readAsText(file);
}

// Reset all progress (separate from reset individual opening progress)
function resetAllProgress() {
    if (!confirm('⚠️ WARNING: This will permanently delete ALL openings and settings!\n\nThis cannot be undone. Are you absolutely sure?')) {
        return;
    }
    
    if (!confirm('This is your last chance! Click OK to DELETE EVERYTHING or Cancel to keep your data.')) {
        return;
    }
    
    localStorage.clear();
    alert('All data has been deleted. The page will now reload.');
    location.reload();
}

// Show answer for current spaced repetition opening
function showSpacedRepetitionAnswer() {
    const moveListEl = document.getElementById('spacedRepetitionMoveList');
    moveListEl.innerHTML = `
        <h3>Full Opening:</h3>
        <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; font-family: monospace;">
            ${currentSpacedRepetitionOpening.moves.join(' ')}
        </div>
    `;
    
    // Mark as needs review
    const openings = JSON.parse(localStorage.getItem('chessOpenings') || '{}');
    const updated = calculateNextReview(openings[currentSpacedRepetitionOpening.key], false);
    openings[currentSpacedRepetitionOpening.key] = updated;
    localStorage.setItem('chessOpenings', JSON.stringify(openings));
    
    spacedRepetitionQueue.shift();
    
    document.getElementById('hintSpacedRepetitionBtn').style.display = 'none';
    document.getElementById('nextSpacedRepetitionBtn').style.display = 'inline-block';
    updateSpacedRepetitionProgress();
}

// Populate learn mode filters
function populateLearnList() {
    const openings = JSON.parse(localStorage.getItem('chessOpenings') || '{}');
    
    // Get unique categories and first moves
    const categories = new Set();
    const firstMoves = new Set();
    
    for (const opening of Object.values(openings)) {
        if (opening.category) {
            categories.add(opening.category);
        }
        if (opening.firstMove) {
            firstMoves.add(opening.firstMove);
        } else if (opening.moves && opening.moves.length > 0) {
            firstMoves.add(opening.moves[0]);
        }
    }
    
    // Populate category filter
    const categoryFilter = document.getElementById('learnCategoryFilter');
    const currentCategory = categoryFilter.value;
    categoryFilter.innerHTML = '<option value="all">All Categories</option>';
    Array.from(categories).sort().forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        if (cat === currentCategory) option.selected = true;
        categoryFilter.appendChild(option);
    });
    
    // Populate first move filter
    const firstMoveFilter = document.getElementById('learnFirstMoveFilter');
    const currentFirstMove = firstMoveFilter.value;
    firstMoveFilter.innerHTML = '<option value="all">All Moves</option>';
    Array.from(firstMoves).sort().forEach(move => {
        const option = document.createElement('option');
        option.value = move;
        option.textContent = move;
        if (move === currentFirstMove) option.selected = true;
        firstMoveFilter.appendChild(option);
    });
    
    updateLearnFilters();
}

// Update learn mode filtered list
function updateLearnFilters() {
    const openings = JSON.parse(localStorage.getItem('chessOpenings') || '{}');
    const categoryFilter = document.getElementById('learnCategoryFilter').value;
    const firstMoveFilter = document.getElementById('learnFirstMoveFilter').value;
    const colorFilter = document.getElementById('learnColorFilter').value;
    
    const listEl = document.getElementById('learnOpeningsList');
    listEl.innerHTML = '';
    
    let filtered = Object.entries(openings).filter(([key, opening]) => {
        const openingCategory = opening.category || 'Uncategorized';
        const openingColor = opening.playingAs || 'white';
        const openingFirstMove = opening.firstMove || (opening.moves && opening.moves.length > 0 ? opening.moves[0] : '');
        
        if (categoryFilter !== 'all' && openingCategory !== categoryFilter) return false;
        if (firstMoveFilter !== 'all' && openingFirstMove !== firstMoveFilter) return false;
        if (colorFilter !== 'all' && openingColor !== colorFilter) return false;
        return true;
    });
    
    if (filtered.length === 0) {
        listEl.innerHTML = '<div class="empty-message">No openings match the filters.</div>';
        return;
    }
    
    filtered.forEach(([key, opening]) => {
        const playingAs = opening.playingAs || 'white';
        const firstMove = opening.firstMove || (opening.moves && opening.moves.length > 0 ? opening.moves[0] : 'None');
        const category = opening.category || 'Uncategorized';
        
        const div = document.createElement('div');
        div.className = 'opening-item';
        div.style.cursor = 'pointer';
        div.innerHTML = `
            <h4 style="font-size: 1em;">${opening.name}</h4>
            <div style="font-size: 0.85em; color: #666;">${category} • ${playingAs} • ${firstMove}</div>
        `;
        div.onclick = () => selectLearnOpening(key, opening);
        listEl.appendChild(div);
    });
}

// Update learn mode filtered list
function updateLearnFiltersOLD() {
    const openings = JSON.parse(localStorage.getItem('chessOpenings') || '{}');
    const categoryFilter = document.getElementById('categoryFilter').value;
    const firstMoveFilter = document.getElementById('firstMoveFilter').value;
    const colorFilter = document.getElementById('colorFilter').value;
    
    const listEl = document.getElementById('learnOpeningsList');
    listEl.innerHTML = '';
    
    let filtered = Object.entries(openings).filter(([key, opening]) => {
        const openingCategory = opening.category || 'Uncategorized';
        const openingColor = opening.playingAs || 'white';
        const openingFirstMove = opening.firstMove || (opening.moves && opening.moves.length > 0 ? opening.moves[0] : '');
        
        if (categoryFilter !== 'all' && openingCategory !== categoryFilter) return false;
        if (firstMoveFilter !== 'all' && openingFirstMove !== firstMoveFilter) return false;
        if (colorFilter !== 'all' && openingColor !== colorFilter) return false;
        return true;
    });
    
    if (filtered.length === 0) {
        listEl.innerHTML = '<div class="empty-message">No openings match the filters.</div>';
        return;
    }
    
    filtered.forEach(([key, opening]) => {
        // Add fallbacks for missing properties
        const playingAs = opening.playingAs || 'white';
        const firstMove = opening.firstMove || (opening.moves && opening.moves.length > 0 ? opening.moves[0] : 'None');
        const category = opening.category || 'Uncategorized';
        
        const div = document.createElement('div');
        div.className = 'opening-item';
        div.style.cursor = 'pointer';
        div.innerHTML = `
            <h4 style="font-size: 1em;">${opening.name}</h4>
            <div style="font-size: 0.85em; color: #666;">${category} • ${playingAs} • ${firstMove}</div>
        `;
        div.onclick = () => selectLearnOpening(key, opening);
        listEl.appendChild(div);
    });
}

// Select opening for learn mode
function selectLearnOpening(key, opening) {
    currentLearnOpening = { key, ...opening };
    document.getElementById('startLearnBtn').disabled = false;
    
    // Highlight selected
    document.querySelectorAll('#learnOpeningsList .opening-item').forEach(el => {
        el.style.borderLeft = '4px solid #667eea';
    });
    event.target.closest('.opening-item').style.borderLeft = '4px solid #28a745';
}

// Start learn practice
function startLearnPractice() {
    if (!currentLearnOpening) return;
    
    practiceMode = 'learn';
    currentMoveIndex = 0;
    learnHasMistakes = false;
    
    // Clear any existing status timeout
    if (learnStatusTimeout) {
        clearTimeout(learnStatusTimeout);
        learnStatusTimeout = null;
    }
    
    learnGame.reset();
    learnBoard.position('start');
    
    // Orient board
    const playingColor = currentLearnOpening.playingAs || 'white';
    if (playingColor === 'black') {
        learnBoard.orientation('black');
    } else {
        learnBoard.orientation('white');
    }
    
    // Make opponent's first move if playing black
    if (playingColor === 'black' && currentLearnOpening.moves.length > 0) {
        learnGame.move(currentLearnOpening.moves[0]);
        learnBoard.position(learnGame.fen());
        currentMoveIndex = 1;
    }
    
    document.getElementById('learnProgress').innerHTML = `
        <h3>${currentLearnOpening.name}</h3>
        <p><strong>Playing as:</strong> ${playingColor}</p>
        <p>Make your moves!</p>
        <div id="learnMoveList" style="margin-top: 10px; background: #f8f9fa; padding: 15px; border-radius: 6px; font-family: monospace;"></div>
    `;
    
    document.getElementById('startLearnBtn').style.display = 'none';
    document.getElementById('showLearnAnswerBtn').style.display = 'inline-block';
    document.getElementById('resetLearnBtn').style.display = 'inline-block';
    document.getElementById('learnStatus').style.display = 'none';
}

// Handle learn drag start
function onLearnDragStart(source, piece) {
    // Check if click-to-move is enabled - if so, prevent dragging
    if (document.getElementById('clickToMoveLearn') && 
        document.getElementById('clickToMoveLearn').checked) {
        return false;
    }
    
    if (!currentLearnOpening) return false;
    if (learnGame.game_over()) return false;
    
    const playerColor = (currentLearnOpening.playingAs || 'white') === 'white' ? 'w' : 'b';
    if (learnGame.turn() !== playerColor) return false;
    
    if ((playerColor === 'w' && piece.search(/^b/) !== -1) ||
        (playerColor === 'b' && piece.search(/^w/) !== -1)) {
        return false;
    }
}

// Handle learn drop
function onLearnDrop(source, target) {
    if (!currentLearnOpening) return 'snapback';
    
    const move = learnGame.move({
        from: source,
        to: target,
        promotion: 'q'
    });
    
    if (move === null) return 'snapback';
    
    const expectedMove = currentLearnOpening.moves[currentMoveIndex];
    
    if (move.san === expectedMove) {
        playSuccessSound();
        currentMoveIndex++;
        updateLearnMoveList();
        
        // Check if done
        const playerColor = (currentLearnOpening.playingAs || 'white') === 'white' ? 'w' : 'b';
        const ourMoves = currentLearnOpening.moves.filter((m, i) => {
            return (playerColor === 'w' && i % 2 === 0) || (playerColor === 'b' && i % 2 === 1);
        });
        
        if (Math.floor((currentMoveIndex + (playerColor === 'w' ? 0 : 1)) / 2) >= ourMoves.length) {
            setTimeout(() => {
                // Clear any existing timeout that might hide the status
                if (learnStatusTimeout) {
                    clearTimeout(learnStatusTimeout);
                    learnStatusTimeout = null;
                }
                
                const statusEl = document.getElementById('learnStatus');
                statusEl.textContent = learnHasMistakes ? '✅ You completed this opening!' : '✅ Perfect! You completed this opening!';
                statusEl.className = 'status-message success';
                statusEl.style.display = 'block';
            }, 500);
            return;
        }
        
        // Make opponent's move
        if (currentMoveIndex < currentLearnOpening.moves.length) {
            setTimeout(() => {
                const opponentMove = learnGame.move(currentLearnOpening.moves[currentMoveIndex]);
                if (opponentMove) {
                    learnBoard.position(learnGame.fen());
                    currentMoveIndex++;
                    updateLearnMoveList();
                }
            }, 500);
        }
    } else {
        playErrorSound();
        learnGame.undo();
        learnHasMistakes = true;
        
        const statusEl = document.getElementById('learnStatus');
        statusEl.textContent = `❌ Incorrect! Expected: ${expectedMove}`;
        statusEl.className = 'status-message error';
        statusEl.style.display = 'block';
        
        // Clear any existing timeout and set new one
        if (learnStatusTimeout) {
            clearTimeout(learnStatusTimeout);
        }
        learnStatusTimeout = setTimeout(() => {
            statusEl.style.display = 'none';
            learnStatusTimeout = null;
        }, 3000);
        
        return 'snapback';
    }
}

// Handle click-to-move for learn board
let learnSelectedSquare = null;
function handleLearnSquareClick(square) {
    if (!currentLearnOpening) return;
    
    if (!learnSelectedSquare) {
        const piece = learnGame.get(square);
        if (piece) {
            const playerColor = (currentLearnOpening.playingAs || 'white') === 'white' ? 'w' : 'b';
            if (piece.color === playerColor) {
                learnSelectedSquare = square;
                $('#learnBoard .square-55d63').removeClass('highlight-square legal-move');
                $(`#learnBoard .square-${square}`).addClass('highlight-square');
                
                // Highlight legal moves
                const moves = learnGame.moves({
                    square: square,
                    verbose: true
                });
                for (let i = 0; i < moves.length; i++) {
                    $(`#learnBoard .square-${moves[i].to}`).addClass('legal-move');
                }
            }
        }
    } else {
        // If clicking the same square, deselect
        if (square === learnSelectedSquare) {
            learnSelectedSquare = null;
            $('#learnBoard .square-55d63').removeClass('highlight-square legal-move');
            return;
        }
        
        const result = onLearnDrop(learnSelectedSquare, square);
        if (result !== 'snapback') {
            learnBoard.position(learnGame.fen());
        }
        learnSelectedSquare = null;
        $('#learnBoard .square-55d63').removeClass('highlight-square legal-move');
    }
}

// Update learn move list
function updateLearnMoveList() {
    const moveListEl = document.getElementById('learnMoveList');
    if (!moveListEl) return;
    
    let html = '<div style="background: var(--bg-secondary, #f8f9fa); padding: 10px; border-radius: 6px; font-family: monospace; color: var(--text-primary, #000);">';
    for (let i = 0; i < currentMoveIndex; i++) {
        if (i % 2 === 0) {
            html += `${Math.floor(i / 2) + 1}. `;
        }
        html += currentLearnOpening.moves[i] + ' ';
    }
    html += '</div>';
    
    moveListEl.innerHTML = html || '<div style="color: var(--text-primary, #666);">No moves yet</div>';
}

// Show answer in learn mode
function showLearnAnswer() {
    if (!currentLearnOpening) return;
    
    const moveListEl = document.getElementById('learnMoveList');
    if (moveListEl) {
        moveListEl.innerHTML = `
            <h3 style="margin-top: 15px;">Full Opening:</h3>
            <div style="background: var(--bg-secondary, #f8f9fa); padding: 15px; border-radius: 6px; font-family: monospace; border-left: 4px solid #ffc107; color: var(--text-primary, #000); font-size: 14px; line-height: 1.8;">
                ${currentLearnOpening.moves.join(' ')}
            </div>
        `;
    }
}

// Reset learn practice
function resetLearnPractice() {
    if (!currentLearnOpening) return;
    
    currentMoveIndex = 0;
    learnGame.reset();
    learnBoard.position('start');
    
    if (currentLearnOpening.playingAs === 'black' && currentLearnOpening.moves.length > 0) {
        learnGame.move(currentLearnOpening.moves[0]);
        learnBoard.position(learnGame.fen());
        currentMoveIndex = 1;
    }
    
    updateLearnMoveList();
    document.getElementById('learnStatus').style.display = 'none';
}

// ========================================
// FILTERED PRACTICE MODE (NEW)
// ========================================

let filteredPracticeQueue = [];
let currentFilteredPracticeOpening = null;
let filteredPracticeGame = null;
let filteredPracticeBoard = null;

// Initialize filtered practice board
function initFilteredPracticeBoard() {
    const config = {
        draggable: true,
        position: 'start',
        onDragStart: onFilteredPracticeDragStart,
        onDrop: onFilteredPracticeDrop,
        onSnapEnd: onFilteredPracticeSnapEnd,
        pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
    };
    
    filteredPracticeBoard = Chessboard('practiceBoard', config);
    filteredPracticeGame = new Chess();
    $('#practiceBoardWrapper').addClass('theme-' + currentTheme);
    
    // Add click-to-move functionality
    $('#practiceBoard').on('click', '.square-55d63', function(e) {
        if (!document.getElementById('clickToMovePractice').checked) return;
        handleFilteredPracticeSquareClick($(this).attr('data-square'));
    });
}

// Populate filters for practice page
function populatePracticeFilters() {
    const openings = JSON.parse(localStorage.getItem('chessOpenings') || '{}');
    
    const categories = new Set();
    const firstMoves = new Set();
    
    Object.values(openings).forEach(opening => {
        categories.add(opening.category || 'Uncategorized');
        if (opening.firstMove) firstMoves.add(opening.firstMove);
        else if (opening.moves && opening.moves.length > 0) firstMoves.add(opening.moves[0]);
    });
    
    // Populate category filter
    const categoryFilter = document.getElementById('practiceCategoryFilter');
    categoryFilter.innerHTML = '<option value="">Select Category...</option>';
    Array.from(categories).sort().forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        categoryFilter.appendChild(option);
    });
    
    // Populate first move filter
    const firstMoveFilter = document.getElementById('practiceFirstMoveFilter');
    firstMoveFilter.innerHTML = '<option value="">Select First Move...</option>';
    Array.from(firstMoves).sort().forEach(move => {
        const option = document.createElement('option');
        option.value = move;
        option.textContent = move;
        firstMoveFilter.appendChild(option);
    });
}

// Start filtered practice
function startFilteredPractice(colorFilter = null, categoryFilter = null, firstMoveFilter = null) {
    // Prevent multiple rapid clicks
    const buttons = ['practiceByCategory', 'practiceByFirstMove'];
    const clickedButtons = buttons.map(id => document.getElementById(id)).filter(btn => btn);
    if (clickedButtons.some(btn => btn.disabled)) return;
    clickedButtons.forEach(btn => btn.disabled = true);
    
    const openings = JSON.parse(localStorage.getItem('chessOpenings') || '{}');
    
    // Filter openings based on selection
    filteredPracticeQueue = Object.entries(openings)
        .filter(([key, opening]) => {
            if (categoryFilter && (opening.category || 'Uncategorized') !== categoryFilter) return false;
            if (colorFilter && opening.playingAs !== colorFilter) return false;
            if (firstMoveFilter) {
                const openingFirstMove = opening.firstMove || (opening.moves && opening.moves.length > 0 ? opening.moves[0] : '');
                if (openingFirstMove !== firstMoveFilter) return false;
            }
            return true;
        })
        .map(([key, opening]) => ({...opening, key}));
    
    if (filteredPracticeQueue.length === 0) {
        const statusEl = document.getElementById('practiceStatus');
        statusEl.textContent = 'No openings match the selected filters!';
        statusEl.className = 'status-message error';
        statusEl.style.display = 'block';
        clickedButtons.forEach(btn => btn.disabled = false);
        return;
    }
    
    // Reset session counter
    sessionCompletedCount = 0;
    
    // Shuffle the queue
    shuffleArray(filteredPracticeQueue);
    
    loadNextFilteredPracticeOpening();
    
    // Re-enable buttons after short delay
    setTimeout(() => {
        clickedButtons.forEach(btn => btn.disabled = false);
    }, 500);
}

// Shuffle array helper
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// Load next filtered practice opening
function loadNextFilteredPracticeOpening() {
    if (filteredPracticeQueue.length === 0) {
        const statusEl = document.getElementById('practiceStatus');
        statusEl.textContent = `🎉 All done! Completed ${sessionCompletedCount} opening(s) this session!`;
        statusEl.className = 'status-message success';
        statusEl.style.display = 'block';
        document.getElementById('practiceSessionInfo').style.display = 'none';
        document.getElementById('nextPracticeBtn').style.display = 'none';
        document.getElementById('practiceProgress').style.display = 'none';
        return;
    }
    
    // Show session info
    document.getElementById('practiceSessionInfo').style.display = 'block';
    
    currentFilteredPracticeOpening = filteredPracticeQueue[0];
    currentMoveIndex = 0;
    practiceHasMistakes = false;
    
    // Update progress indicator
    const totalInSession = sessionCompletedCount + filteredPracticeQueue.length;
    updateProgressIndicator('practiceProgress', sessionCompletedCount, totalInSession);
    
    // Clear any existing status timeout
    if (practiceStatusTimeout) {
        clearTimeout(practiceStatusTimeout);
        practiceStatusTimeout = null;
    }
    
    filteredPracticeGame.reset();
    filteredPracticeBoard.position('start');
    
    // Orient board based on playing color
    const playingColor = currentFilteredPracticeOpening.playingAs || 'white';
    
    if (playingColor === 'black') {
        filteredPracticeBoard.orientation('black');
        // Make opponent's first move
        if (currentFilteredPracticeOpening.moves.length > 0) {
            filteredPracticeGame.move(currentFilteredPracticeOpening.moves[0]);
            filteredPracticeBoard.position(filteredPracticeGame.fen());
            currentMoveIndex = 1;
        }
    } else {
        filteredPracticeBoard.orientation('white');
    }
    
    const infoEl = document.getElementById('practiceInfo');
    infoEl.innerHTML = `
        <h3>${currentFilteredPracticeOpening.category || 'Uncategorized'}</h3>
        <p><strong>Playing as:</strong> ${currentFilteredPracticeOpening.playingAs || 'white'}</p>
        <p><strong>Your turn!</strong> Make your ${currentMoveIndex > 0 ? 'next' : 'first'} move.</p>
    `;
    document.getElementById('practiceMoveList').innerHTML = '';
    document.getElementById('practiceStatus').style.display = 'none';
    document.getElementById('hintPracticeBtn').style.display = 'inline-block';
    document.getElementById('nextPracticeBtn').style.display = 'none';
}

// Handle filtered practice drag start
function onFilteredPracticeDragStart(source, piece) {
    // Check if click-to-move is enabled - if so, prevent dragging
    if (document.getElementById('clickToMovePractice') && 
        document.getElementById('clickToMovePractice').checked) {
        return false;
    }
    
    if (!currentFilteredPracticeOpening) return false;
    if (filteredPracticeGame.game_over()) return false;
    
    const playerColor = (currentFilteredPracticeOpening.playingAs || 'white') === 'white' ? 'w' : 'b';
    if (filteredPracticeGame.turn() !== playerColor) return false;
    
    if ((playerColor === 'w' && piece.search(/^b/) !== -1) ||
        (playerColor === 'b' && piece.search(/^w/) !== -1)) {
        return false;
    }
}

// Handle filtered practice drop
function onFilteredPracticeDrop(source, target) {
    if (!currentFilteredPracticeOpening) return 'snapback';
    
    const move = filteredPracticeGame.move({
        from: source,
        to: target,
        promotion: 'q'
    });
    
    if (move === null) return 'snapback';
    
    // Check if it matches the expected move
    const expectedMove = currentFilteredPracticeOpening.moves[currentMoveIndex];
    
    if (move.san === expectedMove) {
        playSuccessSound();
        currentMoveIndex++;
        
        // Update move list
        updateFilteredPracticeMoveList();
        
        // Check if all moves completed
        if (currentMoveIndex >= currentFilteredPracticeOpening.moves.length) {
            // Clear any existing timeout that might hide the status
            if (practiceStatusTimeout) {
                clearTimeout(practiceStatusTimeout);
                practiceStatusTimeout = null;
            }
            
            const statusEl = document.getElementById('practiceStatus');
            statusEl.textContent = practiceHasMistakes ? '✅ You completed this opening!' : '✅ Perfect! You completed this opening!';
            statusEl.className = 'status-message success';
            statusEl.style.display = 'block';
            
            document.getElementById('hintPracticeBtn').style.display = 'none';
            document.getElementById('nextPracticeBtn').style.display = 'inline-block';
            
            filteredPracticeQueue.shift();
            sessionCompletedCount++;
        } else {
            // Make opponent's response if needed
            if (currentMoveIndex < currentFilteredPracticeOpening.moves.length) {
                setTimeout(() => {
                    filteredPracticeGame.move(currentFilteredPracticeOpening.moves[currentMoveIndex]);
                    filteredPracticeBoard.position(filteredPracticeGame.fen());
                    currentMoveIndex++;
                    updateFilteredPracticeMoveList();
                }, 300);
            }
        }
    } else {
        playErrorSound();
        filteredPracticeGame.undo();
        practiceHasMistakes = true;
        
        const statusEl = document.getElementById('practiceStatus');
        statusEl.textContent = `❌ Incorrect! Try again.`;
        statusEl.className = 'status-message error';
        statusEl.style.display = 'block';
        
        // Clear any existing timeout and set new one
        if (practiceStatusTimeout) {
            clearTimeout(practiceStatusTimeout);
        }
        practiceStatusTimeout = setTimeout(() => {
            statusEl.style.display = 'none';
            practiceStatusTimeout = null;
        }, 2000);
        
        return 'snapback';
    }
}

// Snap end for filtered practice
function onFilteredPracticeSnapEnd() {
    filteredPracticeBoard.position(filteredPracticeGame.fen());
}

// Click-to-move for filtered practice
let filteredPracticeSelectedSquare = null;

function handleFilteredPracticeSquareClick(square) {
    if (!currentFilteredPracticeOpening) return;
    
    if (!filteredPracticeSelectedSquare) {
        const piece = filteredPracticeGame.get(square);
        if (piece) {
            const playerColor = (currentFilteredPracticeOpening.playingAs || 'white') === 'white' ? 'w' : 'b';
            if (piece.color === playerColor) {
                filteredPracticeSelectedSquare = square;
                $('#practiceBoard .square-55d63').removeClass('highlight-square legal-move');
                $(`#practiceBoard .square-${square}`).addClass('highlight-square');
                
                // Highlight legal moves
                const moves = filteredPracticeGame.moves({
                    square: square,
                    verbose: true
                });
                for (let i = 0; i < moves.length; i++) {
                    $(`#practiceBoard .square-${moves[i].to}`).addClass('legal-move');
                }
            }
        }
    } else {
        // If clicking the same square, deselect
        if (square === filteredPracticeSelectedSquare) {
            filteredPracticeSelectedSquare = null;
            $('#practiceBoard .square-55d63').removeClass('highlight-square legal-move');
            return;
        }
        
        const result = onFilteredPracticeDrop(filteredPracticeSelectedSquare, square);
        if (result !== 'snapback') {
            onFilteredPracticeSnapEnd();
        }
        filteredPracticeSelectedSquare = null;
        $('#practiceBoard .square-55d63').removeClass('highlight-square legal-move');
    }
}

// Update filtered practice move list
function updateFilteredPracticeMoveList() {
    const moveListEl = document.getElementById('practiceMoveList');
    let html = '<h3>Moves Played:</h3><div style="background: var(--bg-secondary, #f8f9fa); padding: 15px; border-radius: 6px; font-family: monospace; color: var(--text-primary, #000);">';
    
    for (let i = 0; i < currentMoveIndex; i++) {
        if (i % 2 === 0) {
            html += `${Math.floor(i / 2) + 1}. `;
        }
        html += currentFilteredPracticeOpening.moves[i] + ' ';
    }
    
    html += '</div>';
    moveListEl.innerHTML = html;
}

// Show answer for filtered practice
function showFilteredPracticeAnswer() {
    const moveListEl = document.getElementById('practiceMoveList');
    moveListEl.innerHTML = `
        <h3>Full Opening:</h3>
        <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; font-family: monospace;">
            ${currentFilteredPracticeOpening.moves.join(' ')}
        </div>
    `;
    
    filteredPracticeQueue.shift();
    filteredPracticeQueue.push(currentFilteredPracticeOpening);
    
    document.getElementById('hintPracticeBtn').style.display = 'none';
    document.getElementById('nextPracticeBtn').style.display = 'inline-block';
}

// Keyboard shortcuts handler
function handleKeyboardShortcuts(event) {
    // Don't trigger shortcuts if user is typing in an input field
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
        return;
    }
    
    const key = event.key.toLowerCase();
    const ctrl = event.ctrlKey || event.metaKey;
    
    // Flip board with 'f' key
    if (key === 'f') {
        event.preventDefault();
        const activeView = document.querySelector('.view.active');
        if (activeView?.id === 'spacedRepetitionView') {
            spacedRepetitionBoard.flip();
        } else if (activeView?.id === 'practiceView') {
            filteredPracticeBoard.flip();
        } else if (activeView?.id === 'learnView') {
            learnBoard.flip();
        } else if (activeView?.id === 'manageView') {
            board.flip();
        }
    }
    
    // Show hint with 'h' key
    if (key === 'h') {
        event.preventDefault();
        const activeView = document.querySelector('.view.active');
        if (activeView?.id === 'spacedRepetitionView') {
            const hintBtn = document.getElementById('hintSpacedRepetitionBtn');
            if (hintBtn.style.display !== 'none') {
                showSpacedRepetitionHint();
            }
        } else if (activeView?.id === 'practiceView') {
            const hintBtn = document.getElementById('hintPracticeBtn');
            if (hintBtn.style.display !== 'none') {
                showFilteredPracticeHint();
            }
        }
    }
    
    // Next opening with 'n' key (when button visible)
    if (key === 'n') {
        event.preventDefault();
        const activeView = document.querySelector('.view.active');
        if (activeView?.id === 'spacedRepetitionView') {
            const nextBtn = document.getElementById('nextSpacedRepetitionBtn');
            if (nextBtn.style.display !== 'none') {
                loadNextSpacedRepetitionOpening();
            }
        } else if (activeView?.id === 'practiceView') {
            const nextBtn = document.getElementById('nextPracticeBtn');
            if (nextBtn.style.display !== 'none') {
                loadNextFilteredPracticeOpening();
            }
        }
    }
    
    // Show keyboard shortcuts help with '?'
    if (key === '?') {
        event.preventDefault();
        alert(`⌨️ Keyboard Shortcuts:

F - Flip board
H - Show hint (when available)
N - Next opening (when available)
? - Show this help

Note: Shortcuts work when not typing in input fields.`);
    }
}
