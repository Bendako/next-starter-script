#!/bin/bash
# This is called the "shebang" - tells the system to use bash

# Configuration
MAX_RETRIES=3
RETRY_DELAY=5

# Colors for better output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
  local color=$1
  local message=$2
  echo -e "${color}${message}${NC}"
}

# Function to validate app name
validate_app_name() {
  if [[ ! "$1" =~ ^[a-zA-Z0-9-]+$ ]]; then
    print_status "$RED" "❌ App name can only contain letters, numbers, and hyphens"
    exit 1
  fi
  
  if [ -d "$1" ]; then
    print_status "$RED" "❌ Directory '$1' already exists"
    exit 1
  fi
}

# Function to check network connectivity
check_network() {
  print_status "$BLUE" "🌐 Checking network connectivity..."
  if ! ping -c 1 registry.npmjs.org &> /dev/null; then
    print_status "$RED" "❌ No network connection to npm registry"
    print_status "$YELLOW" "💡 Please check your internet connection and try again"
    exit 1
  fi
  print_status "$GREEN" "✅ Network connection verified"
}

# Function to create Next.js app with retry logic
create_nextjs_app() {
  print_status "$BLUE" "🚀 Creating Next.js application..."

  local attempt=1
  while [ $attempt -le $MAX_RETRIES ]; do
    print_status "$YELLOW" "📝 Attempt $attempt of $MAX_RETRIES..."
    
    # Create Next.js app with all options
    if npx create-next-app@latest "$APP_NAME" \
      --typescript \
      --tailwind \
      --eslint \
      --app \
      --src-dir \
      --import-alias "@/*" \
      --yes; then
      print_status "$GREEN" "✅ Next.js app created successfully"
      return 0
    fi

    if [ $attempt -eq $MAX_RETRIES ]; then
      print_status "$RED" "❌ Failed to create Next.js app after $MAX_RETRIES attempts"
      exit 1
    fi

    print_status "$YELLOW" "⚠️  Attempt $attempt failed, retrying in $RETRY_DELAY seconds..."
    sleep $RETRY_DELAY
    ((attempt++))
  done
}

# Function to install a single package with retry logic
install_package() {
  local package_name=$1
  local attempt=1
  
  while [ $attempt -le $MAX_RETRIES ]; do
    print_status "$BLUE" "  📦 Installing $package_name (attempt $attempt/$MAX_RETRIES)..."
    
    if npm install "$package_name"; then
      print_status "$GREEN" "  ✅ Successfully installed $package_name"
      return 0
    fi

    if [ $attempt -eq $MAX_RETRIES ]; then
      print_status "$RED" "  ❌ Failed to install $package_name after $MAX_RETRIES attempts"
      print_status "$YELLOW" "  💡 You can try installing it manually later with: npm install $package_name"
      return 1
    fi

    print_status "$YELLOW" "  ⚠️  Installation failed, retrying in $RETRY_DELAY seconds..."
    sleep $RETRY_DELAY
    ((attempt++))
  done
}

# Function to clean npm cache if needed
clean_npm_cache() {
  print_status "$YELLOW" "🧹 Cleaning npm cache to resolve potential issues..."
  npm cache clean --force
  print_status "$GREEN" "✅ npm cache cleaned"
}

# Function to install all dependencies
install_dependencies() {
  # Navigate to project directory
  cd "$APP_NAME" || {
    print_status "$RED" "❌ Failed to enter project directory"
    exit 1
  }

  print_status "$BLUE" "📦 Installing additional dependencies..."

  # List of packages to install
  local packages=(
    "convex"
    "@clerk/nextjs"
    "@radix-ui/react-icons"
    "lucide-react"
    "class-variance-authority"
    "clsx"
    "tailwind-merge"
  )

  local failed_packages=()
  
  # Install packages one by one with error checking
  for package in "${packages[@]}"; do
    if ! install_package "$package"; then
      failed_packages+=("$package")
    fi
  done

  # Report results
  if [ ${#failed_packages[@]} -eq 0 ]; then
    print_status "$GREEN" "✅ All dependencies installed successfully"
  else
    print_status "$YELLOW" "⚠️  Some packages failed to install:"
    for package in "${failed_packages[@]}"; do
      print_status "$YELLOW" "    - $package"
    done
    print_status "$BLUE" "💡 You can install them manually later or run the script again"
  fi
}

# Function to display final instructions
show_final_instructions() {
  print_status "$GREEN" "🎉 Setup complete! Your Next.js app '$APP_NAME' is ready."
  print_status "$BLUE" ""
  print_status "$BLUE" "📋 Next steps:"
  print_status "$BLUE" "  1. cd $APP_NAME"
  print_status "$BLUE" "  2. npm run dev"
  print_status "$BLUE" ""
  print_status "$BLUE" "🔗 Useful commands:"
  print_status "$BLUE" "  • Start development server: npm run dev"
  print_status "$BLUE" "  • Build for production: npm run build"
  print_status "$BLUE" "  • Run linting: npm run lint"
  print_status "$BLUE" ""
}

# Main execution starts here
print_status "$BLUE" "🚀 Next.js Starter Script v2.0"
print_status "$BLUE" "================================"

# Check if user provided an app name
if [ -z "$1" ]; then
  print_status "$RED" "❌ Error: Please provide an app name"
  print_status "$BLUE" "Usage: $0 <app-name>"
  exit 1
fi

APP_NAME="$1"
validate_app_name "$APP_NAME"

print_status "$GREEN" "✅ Creating app: $APP_NAME"

# Execute the main workflow
check_network
create_nextjs_app
install_dependencies
show_final_instructions 