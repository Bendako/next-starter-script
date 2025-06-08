# Next.js Starter Script 🚀

A **production-ready** bash script that automates creating Next.js applications with TypeScript, Tailwind CSS, Convex database, and Clerk authentication. This script eliminates hours of manual setup and provides a professional foundation for modern web applications.

## What This Repository Contains 📁

This repository contains:
- **`create-next-starter.sh`** - The main bash script (2700+ lines)
- **Documentation** - README, examples, and usage guides
- **Version control** - Git history showing development progression

## Quick Start 🏃‍♂️

```bash
# Clone this repository
git clone <repository-url>
cd next-starter

# Make the script executable
chmod +x create-next-starter.sh

# Create a new Next.js app with interactive setup
./create-next-starter.sh my-awesome-app

# Or use command-line flags for automation
./create-next-starter.sh --skip-clerk my-app-with-database
./create-next-starter.sh --skip-convex my-app-with-auth
```

## What the Script Creates 🏗️

When you run the script, it creates a **complete Next.js application** with:

### Core Stack
- **Next.js 14+** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **ESLint** for code quality

### Optional Features
- **Convex** - Real-time database (unless `--skip-convex`)
- **Clerk** - Authentication system (unless `--skip-clerk`)

### Professional Structure
```
your-app/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout with providers
│   │   ├── page.tsx            # Home page with auth status
│   │   └── globals.css         # Global styles
│   ├── components/
│   │   └── ui/
│   │       ├── button.tsx      # Reusable button component
│   │       ├── header.tsx      # Navigation header
│   │       └── status-banner.tsx # Configuration status
│   ├── lib/
│   │   ├── utils.ts            # Utility functions
│   │   └── config-detector.ts  # Service configuration
│   └── middleware.ts           # Clerk middleware (if enabled)
├── convex/                     # Database schema (if enabled)
├── .env.local                  # Environment variables
├── package.json               # Dependencies and scripts
└── tsconfig.json              # TypeScript configuration
```

## Script Features ✨

### Interactive Setup
- **Guided Configuration** - Choose your stack interactively
- **Template Options** - Minimal, default, or full setup
- **Real-time Feedback** - Progress bars and status updates

### Command Line Options
```bash
./create-next-starter.sh [OPTIONS] <app-name>

OPTIONS:
  --skip-convex        Skip Convex database setup
  --skip-clerk         Skip Clerk authentication setup
  --template TYPE      Choose template: minimal, default, full
  --verbose            Show detailed output
  --dry-run            Preview without creating
  --force              Overwrite existing directory
  --test               Run script validation
  --help, -h           Show this help
  --version, -v        Show version info
```

### Production-Ready Features
- **Error Handling** - Comprehensive error recovery and cleanup
- **Network Resilience** - Retry logic for package installations
- **Multi-Platform** - Works on macOS, Linux, and Windows
- **Logging** - Detailed logs for troubleshooting
- **Validation** - Input validation and prerequisite checks

## Usage Examples 💡

### Interactive Mode (Recommended)
```bash
./create-next-starter.sh blog-app
# Prompts you to choose:
# 1) Clean Next.js (no database, no auth)
# 2) With Authentication (Clerk)
# 3) With Database (Convex)
# 4) Full Stack (Both Convex + Clerk)
```

### Command Line Mode
```bash
# Clean Next.js app
./create-next-starter.sh --skip-convex --skip-clerk simple-app

# App with authentication only
./create-next-starter.sh --skip-convex auth-app

# App with database only
./create-next-starter.sh --skip-clerk data-app

# Full-stack app (default)
./create-next-starter.sh full-app
```

### Advanced Usage
```bash
# Preview what would be created
./create-next-starter.sh --dry-run my-app

# Verbose output for debugging
./create-next-starter.sh --verbose my-app

# Force overwrite existing directory
./create-next-starter.sh --force existing-app

# Test script integrity
./create-next-starter.sh --test
```

## Dependencies Created 📦

The script installs these packages automatically:

### Core Dependencies
- `next` - React framework
- `react` & `react-dom` - React library
- `typescript` & `@types/*` - Type definitions
- `tailwindcss` - CSS framework
- `eslint` - Code linting

### Optional Dependencies (based on configuration)
- `convex` - Real-time database
- `@clerk/nextjs` - Authentication
- `@radix-ui/react-icons` - Icon library
- `lucide-react` - Additional icons
- `class-variance-authority` - Component variants
- `clsx` & `tailwind-merge` - Utility functions

## Requirements 📋

- **Node.js 18+** (https://nodejs.org/)
- **npm** (comes with Node.js)
- **Internet connection** for package downloads
- **1GB+ free disk space**
- **Bash shell** (macOS/Linux/Windows WSL)

## Development & Tutorial 👨‍💻

This script was built following a comprehensive tutorial structure that covers:

1. **Basic Bash Scripting** - Fundamentals and structure
2. **User Input Handling** - Validation and error checking
3. **NPM Automation** - Package installation and setup
4. **File Manipulation** - Creating and editing files
5. **Template System** - Dynamic content generation
6. **External Tool Integration** - Convex and Clerk setup
7. **User Experience** - Progress indicators and feedback
8. **Error Handling** - Recovery and cleanup
9. **Portability** - Cross-platform compatibility
10. **Integration** - Putting it all together

### Script Statistics
- **2700+ lines** of production-ready bash code
- **50+ functions** with comprehensive error handling
- **Interactive configuration** with fallback to CLI
- **Multi-platform support** (macOS, Linux, Windows)
- **Professional logging** and progress tracking

## Troubleshooting 🔧

### Common Issues
```bash
# Permission denied
chmod +x create-next-starter.sh

# Node.js too old
node --version  # Should be 18+

# NPM cache issues
npm cache clean --force

# Network problems
./create-next-starter.sh --verbose my-app  # See detailed logs
```

### Error Recovery
The script includes automatic cleanup on failure:
- Removes temporary files
- Optionally removes partial installations
- Provides detailed error logs in `setup-error.log`
- Suggests troubleshooting steps

## Contributing 🤝

1. Fork the repository
2. Review the script structure and comments
3. Test changes with `./create-next-starter.sh --test`
4. Submit pull request with detailed description

## License 📄

MIT License - Use this script freely in your projects!

---

**🎯 Ready to build amazing Next.js applications!** This script eliminates setup friction and provides a professional foundation for your projects. Give it a star ⭐ if it saves you time! 