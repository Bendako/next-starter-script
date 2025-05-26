# Changelog

All notable changes to the Next.js Starter Script will be documented in this file.

## [2.0.0] - 2024-05-26

### 🎉 Major Release - Network Resilience & User Experience

### Added
- **Retry Logic**: Automatic retry mechanism for failed npm installations (up to 3 attempts)
- **Network Connectivity Check**: Verifies connection to npm registry before starting
- **Colored Terminal Output**: Beautiful, colored output for better user experience
- **Graceful Error Handling**: Script continues even if some packages fail to install
- **Progress Reporting**: Clear indication of installation attempts and progress
- **Final Instructions**: Helpful next steps and command reference after completion
- **Smart Recovery**: Manual installation commands provided for failed packages
- **Enhanced Validation**: Better error messages and user guidance

### Changed
- **Improved Package Installation**: Each package installed individually with retry logic
- **Better Error Messages**: More descriptive and actionable error messages
- **Enhanced User Feedback**: Real-time progress updates during installation
- **Modular Functions**: Refactored code into smaller, focused functions

### Technical Improvements
- Added configuration variables for retry attempts and delays
- Implemented colored output system with consistent styling
- Enhanced error handling with graceful degradation
- Added network connectivity verification
- Improved logging and user feedback

### Dependencies Installed
- `convex` - Backend-as-a-Service for real-time applications
- `@clerk/nextjs` - Authentication and user management
- `@radix-ui/react-icons` - High-quality icon library
- `lucide-react` - Beautiful & consistent icon toolkit
- `class-variance-authority` - Type-safe component variants
- `clsx` - Conditional className utility
- `tailwind-merge` - Merge Tailwind classes without conflicts

## [1.0.0] - 2024-05-26

### 🚀 Initial Release

### Added
- **Basic Next.js App Creation**: Automated creation with TypeScript, Tailwind CSS, and ESLint
- **Input Validation**: App name validation and directory conflict prevention
- **Dependency Installation**: Basic npm package installation
- **Error Handling**: Simple error checking and exit codes
- **Git Integration**: Automatic Git repository initialization

### Features
- Creates Next.js app with modern configuration
- TypeScript support out of the box
- Tailwind CSS for styling
- ESLint for code quality
- App Router architecture
- Src directory structure
- Import aliases (`@/*`)

### Configuration
- Uses latest Next.js version
- Enables all recommended options
- Sets up organized project structure

---

## Legend

- 🎉 Major release
- ✨ New features
- 🐛 Bug fixes
- 📚 Documentation
- 🔧 Technical improvements
- ⚡ Performance improvements
- 🛡️ Security improvements 