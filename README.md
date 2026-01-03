# Chess Opening Trainer ♞

A comprehensive web-based chess opening trainer with spaced repetition, practice modes, and progress tracking. Master your chess openings efficiently with scientifically-proven learning techniques.

## ✨ Features

### 📚 Spaced Repetition Mode
- Learn openings using the SM-2 algorithm
- Automatic difficulty adjustment based on performance
- Review scheduling optimized for long-term retention
- Track perfect runs vs. mistakes

### 🎯 Practice Mode
- Filter by color (White/Black)
- Filter by category
- Filter by first move
- Randomized practice sessions
- Progress tracking (X of Y completed)

### 🎓 Learn Mode
- Study openings at your own pace
- Show/hide answer functionality
- Interactive board with legal move highlighting

### 📝 Opening Management
- Add custom openings manually
- Import from PGN files (with full parser)
- Edit opening details (name, category, color)
- Search/filter your opening library
- Delete unwanted openings
- Edit descriptive data for existing openings

### 🎨 Customization
- 5 board themes (Blue, Green, Brown, Purple, Gray)
- Dark mode support
- Click-to-move or drag-to-move
- Board flip on all pages

### 💾 Data Management
- Export all data as JSON backup
- Import data from backup
- localStorage-based (no server needed)
- Storage quota warnings
- Migration support for old data formats

### ⚡ Performance & Polish
- Cached localStorage parsing
- Mobile responsive design
- Touch-friendly interface
- Keyboard shortcuts (F=flip, H=hint, N=next, ?=help)
- ARIA labels for accessibility
- Dynamic page titles
- Progress indicators

## 🚀 Getting Started

### Usage (Local)
1. Download all files to a folder
2. Open `index.html` in a web browser
3. Start adding openings or import a PGN file
4. Begin practicing!

## 🎮 How to Use

### Adding Openings

**Method 1: Manual Entry**
1. Go to "Manage" tab
2. Set up the opening on the board
3. Enter opening name and category
4. Click "Save Opening"

**Method 2: PGN Import**
1. Go to "Settings" tab
2. Click "Import PGN"
3. Select a PGN file with chess games
4. Parser extracts openings automatically

### Practice Modes

**Spaced Repetition**
- Reviews openings when they're due
- Best for long-term retention
- Click "Start Practice" to begin
- Make moves as prompted
- System adjusts difficulty based on performance

**Practice Mode**
- Quick practice sessions
- Filter by White/Black, Category, or First Move
- Great for focused training
- Shows completion progress

**Learn Mode**
- Study without pressure
- Select opening from list
- Make moves, then click "Show Answer"
- Perfect for initial learning

### Keyboard Shortcuts
- **F** - Flip board
- **H** - Show hint (when available)
- **N** - Next opening (when button visible)
- **?** - Show keyboard shortcuts help

### Data Backup
- **Export**: Settings → "Export All Data" → saves JSON file
- **Import**: Settings → "Import Data" → upload JSON backup
- Recommended: Export regularly and keep backups in cloud storage

## 🛠️ Technologies Used

- **HTML5/CSS3/JavaScript** - Core web technologies
- **chess.js** (v0.10.3) - Move validation and game logic
- **chessboard.js** (v1.0.0) - Interactive chess board UI
- **jQuery** (v3.6.0) - DOM manipulation
- **localStorage API** - Client-side data persistence

## 📱 Browser Support

- Chrome/Edge (recommended)
- Firefox
- Safari
- Mobile browsers (iOS Safari, Chrome Mobile) - though this still needs work...

## 🔒 Privacy

- All data stored locally in your browser
- No server, no tracking, no analytics
- No account required
- Your openings never leave your device (unless you export them)

## 📊 Storage Limits

- Typical capacity: 5-10MB (varies by browser)
- Approximately 10,000+ openings
- Warning at 90% capacity
- Export/import for data management

## 🐛 Known Limitations

- localStorage is device-specific (no automatic cloud sync)
- PGN parser handles most formats but may skip malformed games
- Some very old browsers may not support all features
- No "default" openings (yet)

## 🤝 Contributing

Contributions are welcome! This is an open-source project.

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- SM-2 algorithm by Piotr Woźniak
- chess.js by Jeff Hlywa
- chessboard.js by Chris Oakman
- Inspired by chess learning platforms like Lichess, Chessly, and Chess.com

## 📧 Support

For issues or questions, please open an issue on the GitHub repository.

---

**Happy training! May your openings be sharp and your memory strong! ♟️**

