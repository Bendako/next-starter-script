# Building Your Own Next.js Starter Script

## 🎯 What We're Building
A bash script that automates creating a fully configured Next.js app with your tech stack. You'll learn:
- Bash scripting fundamentals
- File manipulation and creation
- NPM command automation
- User input handling
- Error handling and validation

---

## Step 1: Basic Bash Script Structure

### 1.1 Create Your First Script
Create a file called `create-next-starter.sh`:

```bash
#!/bin/bash
# This is called the "shebang" - tells the system to use bash

echo "Hello, World!"
```

### 1.2 Make It Executable
```bash
chmod +x create-next-starter.sh
./create-next-starter.sh
```

**Key Concepts:**
- `#!/bin/bash` - Specifies the interpreter
- `chmod +x` - Makes the file executable
- `./` - Runs the script from current directory

---

## Step 2: Handle User Input

### 2.1 Basic Input Validation
```bash
#!/bin/bash

# Check if user provided an app name
if [ -z "$1" ]; then
  echo "❌ Error: Please provide an app name"
  echo "Usage: $0 <app-name>"
  exit 1
fi

APP_NAME="$1"
echo "✅ Creating app: $APP_NAME"
```

**What's happening:**
- `$1` - First command line argument
- `[ -z "$1" ]` - Tests if argument is empty
- `exit 1` - Exits with error code
- `$0` - Script name itself

### 2.2 Add More Validation
```bash
#!/bin/bash

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

if [ -z "$1" ]; then
  echo "❌ Error: Please provide an app name"
  echo "Usage: $0 <app-name>"
  exit 1
fi

APP_NAME="$1"
validate_app_name "$APP_NAME"

echo "✅ Creating app: $APP_NAME"
```

**New concepts:**
- `[[ ]]` - Extended test syntax
- `=~` - Regex matching
- `^[a-zA-Z0-9-]+$` - Regex pattern
- Functions in bash

---

## Step 3: Automate NPM Commands

### 3.1 Create Next.js App
```bash
#!/bin/bash

# ... previous validation code ...

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
```

**Key concepts:**
- `\` - Line continuation for long commands
- `$?` - Exit code of last command
- `--yes` - Skip interactive prompts

### 3.2 Navigate and Install Dependencies
```bash
#!/bin/bash

# ... previous code ...

# Navigate to project directory
cd "$APP_NAME" || {
  echo "❌ Failed to enter project directory"
  exit 1
}

echo "📦 Installing additional dependencies..."

# Install packages one by one with error checking
install_package() {
  echo "  Installing $1..."
  npm install "$1"
  if [ $? -ne 0 ]; then
    echo "❌ Failed to install $1"
    exit 1
  fi
}

install_package "convex"
install_package "@clerk/nextjs"
install_package "@radix-ui/react-icons"
install_package "lucide-react"
install_package "class-variance-authority"
install_package "clsx"
install_package "tailwind-merge"

echo "✅ All dependencies installed"
```

**What's new:**
- `||` - OR operator (if cd fails, run the block)
- `{ }` - Command grouping
- Function with parameters
- Error checking for each package

---

## Step 4: File Creation and Manipulation

### 4.1 Create Files with Content
```bash
#!/bin/bash

# ... previous code ...

echo "📄 Creating configuration files..."

# Create environment file
create_env_file() {
  cat > .env.local << EOF
# Convex
CONVEX_DEPLOYMENT=
NEXT_PUBLIC_CONVEX_URL=

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/
EOF
}

create_env_file
echo "✅ Environment file created"
```

**Key concepts:**
- `cat > file << EOF` - Here document (heredoc)
- `EOF` - End marker (can be any word)
- Everything between `<< EOF` and `EOF` goes into the file

### 4.2 Create Complex Files
```bash
#!/bin/bash

# Function to create utils file
create_utils_file() {
  mkdir -p src/lib
  cat > src/lib/utils.ts << 'EOF'
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
EOF
}

# Function to create Convex provider
create_convex_provider() {
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
}

create_utils_file
create_convex_provider
```

**Important:**
- `'EOF'` (quoted) - Prevents variable expansion
- `mkdir -p` - Creates directory and parents if needed
- Breaking large scripts into functions makes them maintainable

---

## Step 5: Template Substitution

### 5.1 Dynamic Content in Files
```bash
#!/bin/bash

# Function to create layout with app name
create_layout_file() {
  cat > src/app/layout.tsx << EOF
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from '@clerk/nextjs'
import ConvexClientProvider from './ConvexClientProvider'

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "$APP_NAME",
  description: "Generated with Next.js starter",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={inter.className}>
          <ConvexClientProvider>
            {children}
          </ConvexClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
EOF
}
```

**Notice:** `$APP_NAME` gets replaced with the actual app name because we use unquoted `EOF`.

### 5.2 Conditional Content
```bash
#!/bin/bash

# Function to create page with dynamic title
create_home_page() {
  cat > src/app/page.tsx << EOF
import { SignInButton, SignedIn, SignedOut, UserButton } from '@clerk/nextjs'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex">
        <h1 className="text-4xl font-bold text-center lg:text-left">
          Welcome to $APP_NAME
        </h1>
        <div className="fixed bottom-0 left-0 flex h-48 w-full items-end justify-center bg-gradient-to-t from-white via-white dark:from-black dark:via-black lg:static lg:h-auto lg:w-auto lg:bg-none">
          <SignedOut>
            <SignInButton>
              <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                Sign In
              </button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <UserButton />
          </SignedIn>
        </div>
      </div>
    </main>
  );
}
EOF
}
```

---

## Step 6: Initialize External Tools

### 6.1 Convex Initialization
```bash
#!/bin/bash

# Function to initialize Convex
initialize_convex() {
  echo "⚡ Initializing Convex..."
  
  # Run convex dev once to set up
  npx convex dev --once
  
  if [ $? -ne 0 ]; then
    echo "❌ Failed to initialize Convex"
    echo "💡 You can run 'npx convex dev' manually later"
  else
    echo "✅ Convex initialized successfully"
  fi
}

# Function to create Convex schema
create_convex_schema() {
  mkdir -p convex
  cat > convex/schema.ts << 'EOF'
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.string(),
    clerkId: v.string(),
  }).index("by_clerk_id", ["clerkId"]),
  
  posts: defineTable({
    title: v.string(),
    content: v.string(),
    authorId: v.id("users"),
    createdAt: v.number(),
  }).index("by_author", ["authorId"]),
});
EOF
}

initialize_convex
create_convex_schema
```

---

## Step 7: Progress Indicators and User Experience

### 7.1 Add Progress Indicators
```bash
#!/bin/bash

# Function to show progress
show_progress() {
  local current=$1
  local total=$2
  local message=$3
  
  echo "[$current/$total] $message"
}

# Main execution with progress
main() {
  show_progress 1 8 "🚀 Creating Next.js application..."
  create_nextjs_app
  
  show_progress 2 8 "📦 Installing dependencies..."
  install_dependencies
  
  show_progress 3 8 "⚙️  Setting up configuration..."
  create_config_files
  
  show_progress 4 8 "🔧 Creating components..."
  create_components
  
  show_progress 5 8 "📊 Setting up database schema..."
  create_convex_schema
  
  show_progress 6 8 "⚡ Initializing Convex..."
  initialize_convex
  
  show_progress 7 8 "🛡️  Setting up authentication..."
  setup_clerk
  
  show_progress 8 8 "✅ Finalizing setup..."
  show_completion_message
}

# Run main function
main
```

### 7.2 Completion Message
```bash
#!/bin/bash

show_completion_message() {
  echo ""
  echo "🎉 Setup complete!"
  echo ""
  echo "📋 Next steps:"
  echo "1. Set up your Convex deployment:"
  echo "   cd $APP_NAME"
  echo "   npx convex dev"
  echo "   Copy the deployment URL to CONVEX_DEPLOYMENT in .env.local"
  echo ""
  echo "2. Set up Clerk:"
  echo "   Go to https://clerk.com and create a new application"
  echo "   Copy your keys to .env.local"
  echo ""
  echo "3. Start your development server:"
  echo "   npm run dev"
  echo ""
  echo "🚀 Your $APP_NAME is ready to go!"
}
```

---

## Step 8: Error Handling and Cleanup

### 8.1 Comprehensive Error Handling
```bash
#!/bin/bash

# Set strict error handling
set -e  # Exit on any error
set -u  # Exit on undefined variable
set -o pipefail  # Exit on pipe failure

# Trap errors and cleanup
cleanup() {
  if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Setup failed!"
    echo "💡 You can safely delete the '$APP_NAME' directory and try again."
  fi
}
trap cleanup EXIT

# Function with error recovery
safe_npm_install() {
  local package=$1
  local max_retries=3
  local retry=0
  
  while [ $retry -lt $max_retries ]; do
    if npm install "$package"; then
      return 0
    fi
    
    retry=$((retry + 1))
    echo "⚠️  Retry $retry/$max_retries for $package..."
    sleep 2
  done
  
  echo "❌ Failed to install $package after $max_retries attempts"
  return 1
}
```

**Advanced concepts:**
- `set -e` - Exit immediately on error
- `trap` - Run function on script exit
- Retry logic with loops
- `$((math))` - Arithmetic evaluation

---

## Step 9: Making Your Script Portable

### 9.1 Add Options and Flags
```bash
#!/bin/bash

# Default values
SKIP_CONVEX=false
SKIP_CLERK=false
VERBOSE=false

# Parse command line options
while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-convex)
      SKIP_CONVEX=true
      shift
      ;;
    --skip-clerk)
      SKIP_CLERK=true
      shift
      ;;
    --verbose)
      VERBOSE=true
      shift
      ;;
    --help)
      show_help
      exit 0
      ;;
    -*)
      echo "Unknown option $1"
      exit 1
      ;;
    *)
      APP_NAME="$1"
      shift
      ;;
  esac
done

show_help() {
  cat << EOF
Usage: $0 [OPTIONS] <app-name>

Create a new Next.js app with Convex and Clerk

OPTIONS:
  --skip-convex    Skip Convex setup
  --skip-clerk     Skip Clerk setup  
  --verbose        Show detailed output
  --help           Show this help message

EXAMPLES:
  $0 my-app
  $0 --skip-convex my-app
  $0 --verbose --skip-clerk my-app
EOF
}
```

### 9.2 Environment Detection
```bash
#!/bin/bash

# Check prerequisites
check_prerequisites() {
  local missing=()
  
  # Check for required commands
  if ! command -v node &> /dev/null; then
    missing+=("Node.js")
  fi
  
  if ! command -v npm &> /dev/null; then
    missing+=("npm")
  fi
  
  if [ ${#missing[@]} -ne 0 ]; then
    echo "❌ Missing required tools: ${missing[*]}"
    echo "Please install them and try again."
    exit 1
  fi
  
  # Check Node version
  local node_version=$(node --version | cut -d 'v' -f 2)
  local major_version=$(echo $node_version | cut -d '.' -f 1)
  
  if [ "$major_version" -lt 18 ]; then
    echo "❌ Node.js 18+ required (found: v$node_version)"
    exit 1
  fi
  
  echo "✅ Prerequisites check passed"
}
```

---

## Step 10: Put It All Together

### 10.1 Complete Script Structure
```bash
#!/bin/bash

# Script configuration
set -e
set -u
set -o pipefail

# Global variables
APP_NAME=""
SKIP_CONVEX=false
SKIP_CLERK=false
VERBOSE=false

# Import all your functions here...
source_functions() {
  # All the functions we created above
}

# Main execution
main() {
  parse_arguments "$@"
  check_prerequisites
  validate_app_name "$APP_NAME"
  
  create_nextjs_app
  install_dependencies
  create_config_files
  create_components
  
  if [ "$SKIP_CONVEX" = false ]; then
    setup_convex
  fi
  
  if [ "$SKIP_CLERK" = false ]; then
    setup_clerk
  fi
  
  show_completion_message
}

# Run the script
main "$@"
```

---

## 🎉 Congratulations!

You now know how to build automation scripts! You've learned:

### ✅ Bash Fundamentals:
- Script structure and execution
- Variables and user input
- Functions and control flow
- Error handling and validation

### ✅ File Operations:
- Creating files with heredocs
- Template substitution
- Directory manipulation
- Environment file creation

### ✅ NPM Automation:
- Running commands programmatically
- Error checking and retries
- Package installation automation

### ✅ User Experience:
- Progress indicators
- Help messages
- Command line options
- Error messages and recovery

## 🚀 Next Steps:

1. **Extend your script** with more frameworks (Prisma, tRPC, etc.)
2. **Create templates** for different project types
3. **Add interactive prompts** for configuration
4. **Publish to npm** as a global CLI tool
5. **Add tests** for your script

## 💡 Pro Tips:

- Always test your script in a clean environment
- Use version pinning for critical dependencies
- Provide clear error messages and recovery steps
- Make it idempotent (safe to run multiple times)
- Document all available options

Your starter script is now a powerful tool that can save hours of setup time for every new project!