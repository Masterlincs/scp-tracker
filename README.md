# SCP Tracker

A browser extension that tracks which SCP Foundation articles you've read.

## Quick Start

**Install from Chrome Web Store**: Search "SCP Tracker"
**Install from Firefox Web Store**: Search "SCP Tracker"

**Manual Chrome Install**:
1. Download latest release
2. Go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select extension folder

**Manual Firefox Install**:
1. Download latest release
2. Go to `about:debugging`
3. Click "This Firefox"
4. Click "Load Temporary Add-on"
5. Select extension folder

## How It Works

**Automatic Tracking**: Visit any SCP wiki page and scroll to the bottom - articles are automatically marked as read.

**Manual Control**: Click the extension icon to view your reading list and manually mark articles as read/unread.

**Settings**: Right-click the extension icon → Options to customize features like auto-marking and dictionary tooltips.

## Features

- **Reading Tracker**: Automatically tracks SCP articles and tales
- **Dictionary**: Hover over terms for instant definitions
- **Cross-Links**: Navigate between referenced SCPs easily
- **Progress Indicators**: See what's read/unread at a glance
- **Data Management**: Export/import your reading history
- **Keyboard Shortcuts**: Quick access to common actions

## Development

```bash
# Install dependencies
npm install

# Build for development
npm run build

# Build for production
npm run build:prod

# Run tests
npm test
```

## Browser Support

- Chrome 88+
- Firefox 78+
- Edge 88+


### Privacy Policy

SCP Tracker helps you track which SCP Wiki articles and tales you’ve read and optionally provides reader and accessibility enhancements. It runs only on official SCP Wiki domains and stores data in your browser.

- Data collected: None. Your reading history and settings are stored locally and/or in your browser’s sync storage. No data is sent to external servers we control.
- Permissions and purposes:
  - storage — save your reading history and preferences (local/sync).
  - tabs — read the current tab’s URL/context to update read status and show relevant UI.
  - alarms — small, periodic maintenance (e.g., cache refresh) to keep data accurate.
  - host permissions (SCP Wiki domains) — enable page detection, tooltips, and Reader Mode only on SCP Wiki sites.

Contact: open an issue on this repository (see “Issues” tab) or refer to the contact fields in [package.json](package.json) (repository, bugs, homepage).

### License

- Code: MIT License – see [LICENSE](LICENSE).
- Assets (icons derived from the SCP insignia): CC BY-SA 3.0 – see [LICENSE-assets](LICENSE-assets) and [CREDITS](CREDITS.md).

This project is unaffiliated with and not endorsed by the SCP Foundation or the SCP Wiki. The SCP insignia is a trademark of its respective owners.

## Support

Report issues on [GitHub Issues](https://github.com/Masterlincs/scp-tracker/issues)