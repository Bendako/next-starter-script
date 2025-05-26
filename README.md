# Next.js Starter Script 🚀

A robust bash script that automates the creation of Next.js applications with pre-configured dependencies and best practices.

## Features ✨

### Version 2.0 Enhancements
- **🔄 Retry Logic**: Automatically retries failed npm installations (up to 3 attempts)
- **🌐 Network Checking**: Verifies internet connectivity before starting
- **🎨 Colored Output**: Beautiful, colored terminal output for better user experience
- **⚡ Graceful Error Handling**: Continues installation even if some packages fail
- **📋 Helpful Instructions**: Displays next steps and useful commands after completion
- **🔧 Smart Recovery**: Provides manual installation commands for failed packages

### Core Features
- **📦 Automated Setup**: Creates Next.js app with TypeScript, Tailwind CSS, and ESLint
- **🛠️ Pre-configured Dependencies**: Installs essential packages for modern development
- **✅ Input Validation**: Validates app names and prevents directory conflicts
- **📁 Organized Structure**: Uses `src/` directory and import aliases

## Quick Start 🏃‍♂️

```bash
# Make the script executable
chmod +x create-next-starter.sh

# Create a new Next.js app
./create-next-starter.sh my-awesome-app
```

## What Gets Installed 📋

### Next.js Configuration
- **TypeScript** - Type safety and better development experience
- **Tailwind CSS** - Utility-first CSS framework
- **ESLint** - Code linting and formatting
- **App Router** - Modern Next.js routing system
- **Src Directory** - Organized project structure
- **Import Aliases** - Clean import paths with `@/*`

### Additional Dependencies
- **Convex** - Backend-as-a-Service for real-time applications
- **Clerk** - Authentication and user management
- **Radix UI Icons** - High-quality icon library
- **Lucide React** - Beautiful & consistent icon toolkit
- **Class Variance Authority** - Type-safe component variants
- **clsx** - Conditional className utility
- **tailwind-merge** - Merge Tailwind classes without conflicts

## Script Output Example 🎯

```bash
🚀 Next.js Starter Script v2.0
================================
✅ Creating app: my-awesome-app
🌐 Checking network connectivity...
✅ Network connection verified
🚀 Creating Next.js application...
📝 Attempt 1 of 3...
✅ Next.js app created successfully
📦 Installing additional dependencies...
  📦 Installing convex (attempt 1/3)...
  ✅ Successfully installed convex
  📦 Installing @clerk/nextjs (attempt 1/3)...
  ✅ Successfully installed @clerk/nextjs
...
✅ All dependencies installed successfully
🎉 Setup complete! Your Next.js app 'my-awesome-app' is ready.

📋 Next steps:
  1. cd my-awesome-app
  2. npm run dev

🔗 Useful commands:
  • Start development server: npm run dev
  • Build for production: npm run build
  • Run linting: npm run lint
```

## Error Handling 🛡️

The script includes robust error handling:

- **Network Issues**: Checks connectivity and retries failed installations
- **Package Failures**: Continues with other packages and reports failures
- **Directory Conflicts**: Prevents overwriting existing directories
- **Invalid Names**: Validates app names before starting

If a package fails to install after 3 attempts, the script will:
1. Continue with remaining packages
2. Report which packages failed
3. Provide manual installation commands

## Configuration ⚙️

You can modify these variables at the top of the script:

```bash
MAX_RETRIES=3      # Number of retry attempts
RETRY_DELAY=5      # Seconds to wait between retries
```

## Requirements 📋

- **Node.js** (v18 or higher)
- **npm** (comes with Node.js)
- **Internet connection**
- **macOS/Linux** (bash shell)

## Troubleshooting 🔧

### Common Issues

**Network timeouts during installation:**
```bash
# The script will automatically retry, but you can also:
npm cache clean --force
./create-next-starter.sh my-app
```

**Permission denied:**
```bash
chmod +x create-next-starter.sh
```

**App name validation errors:**
- Use only letters, numbers, and hyphens
- Ensure the directory doesn't already exist

## Development 👨‍💻

### Project Structure
```
next-starter/
├── create-next-starter.sh    # Main script
├── README.md                 # Documentation
└── .git/                     # Git repository
```

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Version History 📚

### v2.0 (Current)
- Added retry logic and network resilience
- Implemented colored output
- Enhanced error handling
- Added helpful instructions

### v1.0
- Basic Next.js app creation
- Dependency installation
- Input validation

## License 📄

MIT License - feel free to use this script in your projects!

---

**Happy coding!** 🎉 