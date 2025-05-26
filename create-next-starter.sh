#!/bin/bash
# This is called the "shebang" - tells the system to use bash

# Function to validate app name
validate_app_name() {
  if [[ ! "$1" =~ ^[a-zA-Z0-9-]+$ ]]; then
    echo "❌ App name can only contain letters, numbers, and hyphens"
    exit 1
  fi
  
  if [ -d "$1" ]; then
    echo "❌ Directory '$1' already exists"
    exit 1
  fi
}

# Function to create Next.js app
create_nextjs_app() {
  echo "🚀 Creating Next.js application..."

  # Create Next.js app with all options
  npx create-next-app@latest "$APP_NAME" \
    --typescript \
    --tailwind \
    --eslint \
    --app \
    --src-dir \
    --import-alias "@/*" \
    --yes

  # Check if command succeeded
  if [ $? -ne 0 ]; then
    echo "❌ Failed to create Next.js app"
    exit 1
  fi

  echo "✅ Next.js app created successfully"
}

# Function to install a single package with error checking
install_package() {
  echo "  Installing $1..."
  npm install "$1"
  if [ $? -ne 0 ]; then
    echo "❌ Failed to install $1"
    exit 1
  fi
}

# Function to install all dependencies
install_dependencies() {
  # Navigate to project directory
  cd "$APP_NAME" || {
    echo "❌ Failed to enter project directory"
    exit 1
  }

  echo "📦 Installing additional dependencies..."

  # Install packages one by one with error checking
  install_package "convex"
  install_package "@clerk/nextjs"
  install_package "@radix-ui/react-icons"
  install_package "lucide-react"
  install_package "class-variance-authority"
  install_package "clsx"
  install_package "tailwind-merge"

  echo "✅ All dependencies installed"
}

# Check if user provided an app name
if [ -z "$1" ]; then
  echo "❌ Error: Please provide an app name"
  echo "Usage: $0 <app-name>"
  exit 1
fi

APP_NAME="$1"
validate_app_name "$APP_NAME"

echo "✅ Creating app: $APP_NAME"

# Execute the main workflow
create_nextjs_app
install_dependencies

echo "🎉 Setup complete! Your Next.js app '$APP_NAME' is ready." 