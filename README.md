# Next.js Starter Script 🚀

A **production-ready** bash script that automates the creation of Next.js applications with pre-configured dependencies, comprehensive error handling, and professional project structure.

> **🎉 Tutorial Complete!** This script implements all 10 steps from the "Building Your Own Next.js Starter Script" tutorial and exceeds the requirements with professional-grade features.

## Features ✨

### Version 2.4 - Production Ready 🛡️
- **🧪 Self-Test System**: Built-in script validation (`--test`)
- **🔍 Dry Run Mode**: Preview actions without executing (`--dry-run`)
- **💪 Force Mode**: Overwrite existing directories (`--force`)
- **📋 Template System**: Choose from minimal, default, or full templates
- **🌍 Multi-Platform**: Works on macOS, Linux, and Windows
- **🔧 Environment Detection**: Automatic OS, architecture, and shell detection
- **📊 Comprehensive Logging**: Timestamped logs with error tracking
- **🎯 Advanced CLI**: Professional help system and command-line options

### Core Automation Features
- **🔄 Network Resilience**: Multi-endpoint testing with retry logic
- **🎨 Professional Output**: Color-coded status messages and progress tracking
- **⚡ Smart Recovery**: Graceful error handling with cleanup and recovery
- **📁 Project Structure**: Professional directory organization with components
- **🛠️ Dependency Management**: Intelligent package installation with fallbacks

## Quick Start 🏃‍♂️

```bash
# Make the script executable
chmod +x create-next-starter.sh

# Create a new Next.js app (standard setup)
./create-next-starter.sh my-awesome-app

# Preview what would be created (dry run)
./create-next-starter.sh --dry-run my-app

# Create with minimal template
./create-next-starter.sh --template minimal simple-app

# Create with verbose output and force overwrite
./create-next-starter.sh --verbose --force my-app

# Run self-test to verify script integrity
./create-next-starter.sh --test
```

## Command Line Options 🎛️

```bash
./create-next-starter.sh [OPTIONS] <app-name>

OPTIONS:
  --skip-convex        Skip Convex database setup
  --skip-clerk         Skip Clerk authentication setup
  --verbose            Show detailed output and debug information
  --dry-run            Show what would be done without executing
  --force              Overwrite existing directory if it exists
  --template TYPE      Use specific template (default, minimal, full)
  --node-version MIN   Minimum Node.js version required (default: 18)
  --test               Run script self-test and exit
  --help, -h           Show comprehensive help message
  --version, -v        Show script version and features

TEMPLATES:
  default              Standard setup with all features
  minimal              Basic Next.js with TypeScript and Tailwind only
  full                 Everything + additional tools and components
```

## What Gets Created 📋

### Next.js Configuration
- **Next.js 14+** with App Router
- **TypeScript** - Type safety and better development experience
- **Tailwind CSS** - Utility-first CSS framework with custom components
- **ESLint** - Code linting and formatting
- **Src Directory** - Organized project structure
- **Import Aliases** - Clean import paths with `@/*`

### Backend & Authentication
- **Convex** - Real-time database with schema and functions
- **Clerk** - Authentication and user management
- **Environment Configuration** - Pre-configured `.env.local`

### UI Components & Utilities
- **Custom Button Component** - Professional UI component with variants
- **Header Component** - Navigation with authentication
- **Utility Functions** - Helper functions for common tasks
- **Loading & Error Components** - Professional error handling UI

### Dependencies Installed
- **@clerk/nextjs** - Authentication
- **convex** - Real-time database
- **@radix-ui/react-icons** - High-quality icons
- **lucide-react** - Beautiful icon toolkit
- **class-variance-authority** - Type-safe component variants
- **clsx** - Conditional className utility
- **tailwind-merge** - Merge Tailwind classes without conflicts

## Script Output Example 🎯

```bash
🚀 Next.js Starter Script v2.4 - Professional Project Generator
==================================================================
Creating: my-awesome-app
Template: default
Started at: 2024-01-15 10:30:00
Logging to: setup.log

🔍 Detecting environment...
✅ Environment detection completed

🔍 Checking prerequisites...
✅ Prerequisites check passed

[1/10] ████████████████████████████████ 100% - 🌐 Checking network connectivity...
  ✅ Network connectivity check completed in 2s

[2/10] ████████████████████████████████ 100% - 🚀 Creating Next.js application...
  ✅ Next.js application creation completed in 45s

[3/10] ████████████████████████████████ 100% - 📦 Installing dependencies...
  ✅ All dependencies installed successfully (7/7)

[4/10] ████████████████████████████████ 100% - ⚙️ Setting up configuration files...
  ✅ Configuration files setup completed in 3s

[5/10] ████████████████████████████████ 100% - 🔧 Creating template components...
  ✅ Template components creation completed in 2s

[6/10] ████████████████████████████████ 100% - 📊 Setting up database schema...
  ✅ Database schema setup completed in 1s

[7/10] ████████████████████████████████ 100% - ⚡ Initializing external tools...
  ✅ External tools initialization completed in 5s

[8/10] ████████████████████████████████ 100% - 🔍 Verifying installation...
  ✅ Installation verification completed in 1s

[9/10] ████████████████████████████████ 100% - 🎨 Applying template customizations...
  ✅ Template customizations completed in 1s

[10/10] ████████████████████████████████ 100% - ✅ Finalizing setup...
  ✅ Setup completed in 1m 5s

🎉 Setup Complete! Your my-awesome-app is ready!
```

## Error Handling & Recovery 🛡️

The script includes comprehensive error handling:

- **Network Resilience**: Tests multiple endpoints and retries failed operations
- **Package Installation**: Continues with other packages if some fail
- **Directory Conflicts**: Prevents overwriting unless `--force` is used
- **Input Validation**: Validates app names and provides helpful suggestions
- **Cleanup System**: Removes partial installations on failure
- **Logging System**: Detailed logs for troubleshooting

## Self-Test System 🧪

Verify script integrity before use:

```bash
./create-next-starter.sh --test

🧪 Running script self-test...
  ✅ All self-tests passed
✅ Script is ready to use!
```

The self-test validates:
- All required functions exist
- Script has proper permissions
- Required commands are available
- Script variables are properly set

## Requirements 📋

- **Node.js 18+** (https://nodejs.org/)
- **npm** (comes with Node.js)
- **Internet connection**
- **At least 1GB free disk space**
- **macOS, Linux, or Windows** (with bash)

## Troubleshooting 🔧

### Run Diagnostics
```bash
# Check script integrity
./create-next-starter.sh --test

# Preview what would be created
./create-next-starter.sh --dry-run my-app

# Get detailed output
./create-next-starter.sh --verbose my-app
```

### Common Solutions
```bash
# Clean npm cache if packages fail
npm cache clean --force

# Update npm to latest version
npm install -g npm@latest

# Check Node.js version
node --version  # Should be 18+
```

## Development 👨‍💻

### Project Structure
```
next-starter-script/
├── create-next-starter.sh           # Main script (2000+ lines)
├── STEP_10_COMPLETION_SUMMARY.md    # Tutorial completion summary
├── CHANGELOG.md                     # Version history
├── README.md                        # This documentation
├── spec.md                          # Tutorial specification
└── .git/                            # Git repository
```

### Script Statistics
- **2000+ lines** of professional bash code
- **25+ functions** with comprehensive error handling
- **10 tutorial steps** fully implemented
- **Multi-platform compatibility**
- **Production-ready** with extensive testing

## Version History 📚

### v2.4 - Tutorial Complete (Current) 🎉
- **✅ All 10 tutorial steps implemented**
- Added self-test functionality and dry run mode
- Implemented template system (minimal, default, full)
- Added comprehensive CLI options and help system
- Enhanced error handling with cleanup and recovery
- Multi-platform compatibility and environment detection
- Professional logging and progress tracking
- Network resilience with retry logic

### v2.0 - Enhanced Features
- Added retry logic and network resilience
- Implemented colored output and progress tracking
- Enhanced error handling and recovery

### v1.0 - Basic Implementation
- Basic Next.js app creation
- Dependency installation
- Input validation

## Contributing 🤝

1. Fork the repository
2. Create a feature branch
3. Test your changes thoroughly
4. Run the self-test: `./create-next-starter.sh --test`
5. Submit a pull request

## License 📄

MIT License - feel free to use this script in your projects!

## Repository 🔗

**GitHub**: https://github.com/Bendako/next-starter-script

**Latest Release**: v2.4-tutorial-complete

---

**🎯 Ready to build amazing Next.js applications!** This script saves hours of setup time and provides a professional foundation for your projects. 🚀 