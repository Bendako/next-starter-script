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

# STEP 4: File Creation and Manipulation Functions

# Function to create environment file
create_env_file() {
  print_status "$BLUE" "📄 Creating environment configuration file..."
  
  cat > .env.local << EOF
# Convex Configuration
CONVEX_DEPLOYMENT=
NEXT_PUBLIC_CONVEX_URL=

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/

# Add your other environment variables here
EOF

  print_status "$GREEN" "  ✅ Environment file (.env.local) created"
}

# Function to create utility functions file
create_utils_file() {
  print_status "$BLUE" "🔧 Creating utility functions..."
  
  # Create lib directory if it doesn't exist
  mkdir -p src/lib
  
  cat > src/lib/utils.ts << 'EOF'
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Utility function to merge Tailwind CSS classes
 * Combines clsx for conditional classes and tailwind-merge for deduplication
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a date to a readable string
 */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date)
}

/**
 * Capitalize the first letter of a string
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Generate a random ID
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15)
}
EOF

  print_status "$GREEN" "  ✅ Utility functions (src/lib/utils.ts) created"
}

# Function to create Convex provider component
create_convex_provider() {
  print_status "$BLUE" "⚡ Creating Convex provider component..."
  
  cat > src/app/ConvexClientProvider.tsx << 'EOF'
"use client";

import { ReactNode } from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export default function ConvexClientProvider({
  children,
}: {
  children: ReactNode;
}) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
EOF

  print_status "$GREEN" "  ✅ Convex provider component created"
}

# Function to create a basic UI components directory structure
create_components_structure() {
  print_status "$BLUE" "🎨 Creating components directory structure..."
  
  # Create components directories
  mkdir -p src/components/ui
  mkdir -p src/components/layout
  
  # Create a basic Button component
  cat > src/components/ui/button.tsx << 'EOF'
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
EOF

  # Create a basic Header component
  cat > src/components/layout/header.tsx << 'EOF'
import { SignInButton, SignedIn, SignedOut, UserButton } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'

export default function Header() {
  return (
    <header className="border-b">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold">My App</h1>
        <div>
          <SignedOut>
            <SignInButton>
              <Button>Sign In</Button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <UserButton />
          </SignedIn>
        </div>
      </div>
    </header>
  )
}
EOF

  print_status "$GREEN" "  ✅ Components directory structure created"
}

# Function to create all configuration files
create_config_files() {
  print_status "$BLUE" "📁 Creating configuration files and components..."
  
  create_env_file
  create_utils_file
  create_convex_provider
  create_components_structure
  
  print_status "$GREEN" "✅ All configuration files created successfully"
}

# Function to display final instructions
show_final_instructions() {
  print_status "$GREEN" "🎉 Setup complete! Your Next.js app '$APP_NAME' is ready."
  print_status "$BLUE" ""
  print_status "$BLUE" "📋 Next steps:"
  print_status "$BLUE" "  1. cd $APP_NAME"
  print_status "$BLUE" "  2. Set up your environment variables in .env.local"
  print_status "$BLUE" "  3. npm run dev"
  print_status "$BLUE" ""
  print_status "$BLUE" "🔗 Useful commands:"
  print_status "$BLUE" "  • Start development server: npm run dev"
  print_status "$BLUE" "  • Build for production: npm run build"
  print_status "$BLUE" "  • Run linting: npm run lint"
  print_status "$BLUE" ""
  print_status "$BLUE" "📁 Files created:"
  print_status "$BLUE" "  • .env.local - Environment variables"
  print_status "$BLUE" "  • src/lib/utils.ts - Utility functions"
  print_status "$BLUE" "  • src/app/ConvexClientProvider.tsx - Convex provider"
  print_status "$BLUE" "  • src/components/ui/button.tsx - Button component"
  print_status "$BLUE" "  • src/components/layout/header.tsx - Header component"
  print_status "$BLUE" ""
}

# Main execution starts here
print_status "$BLUE" "🚀 Next.js Starter Script v2.1"
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
create_config_files
show_final_instructions 