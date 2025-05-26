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



# STEP 5: Template Substitution Functions

# Function to create layout with dynamic app name
create_layout_file() {
  print_status "$BLUE" "🎨 Creating root layout with app branding..."
  
  cat > src/app/layout.tsx << EOF
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from '@clerk/nextjs'
import ConvexClientProvider from './ConvexClientProvider'

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "$APP_NAME",
  description: "A modern web application built with Next.js, powered by $APP_NAME",
  keywords: ["Next.js", "React", "TypeScript", "Convex", "Clerk", "$APP_NAME"],
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

  print_status "$GREEN" "  ✅ Root layout (src/app/layout.tsx) created with app name: $APP_NAME"
}

# Function to create home page with dynamic content
create_home_page() {
  print_status "$BLUE" "🏠 Creating personalized home page..."
  
  cat > src/app/page.tsx << EOF
import { SignInButton, SignedIn, SignedOut, UserButton } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex">
        <div className="text-center lg:text-left">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Welcome to $APP_NAME
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
            Your modern web application is ready to go! Built with Next.js, TypeScript, and the latest tools.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
            <SignedOut>
              <SignInButton>
                <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
                  Get Started - Sign In
                </Button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <div className="flex items-center gap-4">
                <span className="text-green-600 font-medium">✅ You're signed in!</span>
                <UserButton />
              </div>
            </SignedIn>
          </div>
        </div>
        
        <div className="mt-8 lg:mt-0">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold text-blue-600">⚡ Convex</h3>
              <p className="text-sm text-gray-600">Real-time database</p>
            </div>
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold text-purple-600">🔐 Clerk</h3>
              <p className="text-sm text-gray-600">Authentication</p>
            </div>
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold text-green-600">🎨 Tailwind</h3>
              <p className="text-sm text-gray-600">Styling</p>
            </div>
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold text-orange-600">⚛️ React</h3>
              <p className="text-sm text-gray-600">UI Framework</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-16 text-center">
        <h2 className="text-2xl font-semibold mb-4">Ready to build with $APP_NAME?</h2>
        <p className="text-gray-600 dark:text-gray-300 max-w-2xl">
          Your application comes pre-configured with authentication, real-time database, 
          and modern UI components. Start building your features right away!
        </p>
      </div>
    </main>
  );
}
EOF

  print_status "$GREEN" "  ✅ Home page (src/app/page.tsx) created with personalized content"
}

# Function to update header component with app name
update_header_component() {
  print_status "$BLUE" "🔄 Updating header component with app branding..."
  
  cat > src/components/layout/header.tsx << EOF
import { SignInButton, SignedIn, SignedOut, UserButton } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'

export default function Header() {
  return (
    <header className="border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">${APP_NAME:0:1}</span>
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            $APP_NAME
          </h1>
        </div>
        <div>
          <SignedOut>
            <SignInButton>
              <Button variant="outline">Sign In</Button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">Welcome back!</span>
              <UserButton />
            </div>
          </SignedIn>
        </div>
      </div>
    </header>
  )
}
EOF

  print_status "$GREEN" "  ✅ Header component updated with app branding"
}

# Function to create package.json scripts section (template substitution example)
create_custom_scripts() {
  print_status "$BLUE" "📝 Adding custom scripts to package.json..."
  
  # Read current package.json and add custom scripts
  if [ -f "package.json" ]; then
    # Create a backup
    cp package.json package.json.backup
    
    # Use node to modify package.json with app-specific scripts
    node -e "
      const fs = require('fs');
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      
      // Add custom scripts with app name
      pkg.scripts = {
        ...pkg.scripts,
        'dev:$APP_NAME': 'next dev',
        'build:$APP_NAME': 'next build',
        'start:$APP_NAME': 'next start',
        'setup:convex': 'npx convex dev --once',
        'deploy:$APP_NAME': 'npm run build && npx convex deploy'
      };
      
      // Update description with app name
      pkg.description = 'A modern web application: $APP_NAME - built with Next.js, Convex, and Clerk';
      
      fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
    "
    
    print_status "$GREEN" "  ✅ Custom scripts added to package.json"
  else
    print_status "$YELLOW" "  ⚠️  package.json not found, skipping custom scripts"
  fi
}

# Function to orchestrate all template substitution
create_template_files() {
  print_status "$BLUE" "🎯 Creating files with template substitution..."
  
  create_layout_file
  create_home_page
  update_header_component
  create_custom_scripts
  
  print_status "$GREEN" "✅ All template files created with personalized content"
}

# STEP 6: Initialize External Tools

# Function to initialize Convex
initialize_convex() {
  print_status "$BLUE" "⚡ Initializing Convex..."
  
  # Check if convex is available
  if ! command -v npx &> /dev/null; then
    print_status "$RED" "❌ npx not found. Please install Node.js and npm"
    return 1
  fi
  
  # Run convex dev once to set up
  print_status "$YELLOW" "  🔧 Running Convex initialization (this may take a moment)..."
  
  if npx convex dev --once --yes 2>/dev/null; then
    print_status "$GREEN" "  ✅ Convex initialized successfully"
    print_status "$BLUE" "  📝 Convex deployment created and configured"
    return 0
  else
    print_status "$YELLOW" "  ⚠️  Convex initialization skipped (requires manual setup)"
    print_status "$BLUE" "  💡 Run 'npx convex dev' manually to complete Convex setup"
    print_status "$BLUE" "  📋 Then copy the deployment URL to CONVEX_DEPLOYMENT in .env.local"
    return 1
  fi
}

# Function to create Convex schema
create_convex_schema() {
  print_status "$BLUE" "📊 Creating Convex database schema..."
  
  # Create convex directory if it doesn't exist
  mkdir -p convex
  
  # Create the main schema file
  cat > convex/schema.ts << 'EOF'
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Users table for storing user profiles
  users: defineTable({
    name: v.string(),
    email: v.string(),
    clerkId: v.string(),
    imageUrl: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"]),
  
  // Posts table for blog posts or content
  posts: defineTable({
    title: v.string(),
    content: v.string(),
    excerpt: v.optional(v.string()),
    authorId: v.id("users"),
    published: v.boolean(),
    tags: v.optional(v.array(v.string())),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_author", ["authorId"])
    .index("by_published", ["published"])
    .index("by_created_at", ["createdAt"]),
  
  // Comments table for post comments
  comments: defineTable({
    content: v.string(),
    postId: v.id("posts"),
    authorId: v.id("users"),
    parentId: v.optional(v.id("comments")), // For nested comments
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_post", ["postId"])
    .index("by_author", ["authorId"])
    .index("by_parent", ["parentId"]),
});
EOF

  print_status "$GREEN" "  ✅ Convex schema (convex/schema.ts) created"
}

# Function to create sample Convex functions
create_convex_functions() {
  print_status "$BLUE" "🔧 Creating sample Convex functions..."
  
  # Create users functions
  cat > convex/users.ts << 'EOF'
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Create or update user profile
export const createUser = mutation({
  args: {
    clerkId: v.string(),
    name: v.string(),
    email: v.string(),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (existingUser) {
      // Update existing user
      await ctx.db.patch(existingUser._id, {
        name: args.name,
        email: args.email,
        imageUrl: args.imageUrl,
        updatedAt: Date.now(),
      });
      return existingUser._id;
    } else {
      // Create new user
      return await ctx.db.insert("users", {
        clerkId: args.clerkId,
        name: args.name,
        email: args.email,
        imageUrl: args.imageUrl,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  },
});

// Get user by Clerk ID
export const getUserByClerkId = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();
  },
});

// Get all users
export const getUsers = query({
  handler: async (ctx) => {
    return await ctx.db.query("users").collect();
  },
});
EOF

  # Create posts functions
  cat > convex/posts.ts << 'EOF'
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Create a new post
export const createPost = mutation({
  args: {
    title: v.string(),
    content: v.string(),
    excerpt: v.optional(v.string()),
    authorId: v.id("users"),
    published: v.optional(v.boolean()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("posts", {
      title: args.title,
      content: args.content,
      excerpt: args.excerpt,
      authorId: args.authorId,
      published: args.published ?? false,
      tags: args.tags,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

// Get all published posts
export const getPublishedPosts = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("posts")
      .withIndex("by_published", (q) => q.eq("published", true))
      .order("desc")
      .collect();
  },
});

// Get posts by author
export const getPostsByAuthor = query({
  args: { authorId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("posts")
      .withIndex("by_author", (q) => q.eq("authorId", args.authorId))
      .order("desc")
      .collect();
  },
});

// Get a single post with author info
export const getPostWithAuthor = query({
  args: { postId: v.id("posts") },
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.postId);
    if (!post) return null;

    const author = await ctx.db.get(post.authorId);
    return {
      ...post,
      author,
    };
  },
});
EOF

  print_status "$GREEN" "  ✅ Sample Convex functions created"
  print_status "$BLUE" "    • convex/users.ts - User management functions"
  print_status "$BLUE" "    • convex/posts.ts - Post management functions"
}

# Function to create Convex configuration
create_convex_config() {
  print_status "$BLUE" "⚙️  Creating Convex configuration..."
  
  # Create convex.json if it doesn't exist
  if [ ! -f "convex.json" ]; then
    cat > convex.json << EOF
{
  "functions": "convex/",
  "generateCommonJSApi": false,
  "node": {
    "externalPackages": ["@clerk/nextjs"]
  }
}
EOF
    print_status "$GREEN" "  ✅ Convex configuration (convex.json) created"
  else
    print_status "$BLUE" "  ℹ️  Convex configuration already exists"
  fi
}

# Function to update environment file with Convex instructions
update_env_with_convex_instructions() {
  print_status "$BLUE" "📝 Adding Convex setup instructions to .env.local..."
  
  # Add instructions as comments to the env file
  cat >> .env.local << 'EOF'

# Convex Setup Instructions:
# 1. Run: npx convex dev
# 2. Follow the prompts to create your Convex deployment
# 3. Copy the deployment URL and paste it above in NEXT_PUBLIC_CONVEX_URL
# 4. Copy the deployment name and paste it above in CONVEX_DEPLOYMENT
# 
# Example:
# CONVEX_DEPLOYMENT=your-deployment-name-123
# NEXT_PUBLIC_CONVEX_URL=https://your-deployment-name-123.convex.cloud
EOF

  print_status "$GREEN" "  ✅ Convex setup instructions added to .env.local"
}

# Function to orchestrate all external tools initialization
initialize_external_tools() {
  print_status "$BLUE" "🛠️  Initializing external tools and services..."
  
  create_convex_schema
  create_convex_functions
  create_convex_config
  update_env_with_convex_instructions
  
  # Try to initialize Convex (may fail if not logged in)
  if initialize_convex; then
    print_status "$GREEN" "✅ Convex fully initialized and ready to use"
  else
    print_status "$YELLOW" "⚠️  Convex setup requires manual completion"
  fi
  
  print_status "$GREEN" "✅ External tools initialization complete"
}

# STEP 7: Progress Indicators and User Experience

# Function to show progress with visual indicators and time estimation
show_progress() {
  local current=$1
  local total=$2
  local message=$3
  local percentage=$((current * 100 / total))
  
  # Create progress bar
  local bar_length=30
  local filled_length=$((current * bar_length / total))
  local bar=""
  
  for ((i=0; i<filled_length; i++)); do
    bar+="█"
  done
  
  for ((i=filled_length; i<bar_length; i++)); do
    bar+="░"
  done
  
  # Calculate estimated time remaining (rough estimates)
  local step_times=(30 120 90 15 20 10 15 5)  # Estimated seconds per step
  local remaining_time=0
  for ((i=current; i<total; i++)); do
    remaining_time=$((remaining_time + step_times[i]))
  done
  
  local time_display=""
  if [ $remaining_time -gt 60 ]; then
    local minutes=$((remaining_time / 60))
    local seconds=$((remaining_time % 60))
    time_display=" (~${minutes}m ${seconds}s remaining)"
  elif [ $remaining_time -gt 0 ]; then
    time_display=" (~${remaining_time}s remaining)"
  fi
  
  print_status "$BLUE" "[$current/$total] $bar $percentage%$time_display - $message"
}

# Function to show step completion with timing
show_step_complete() {
  local step_name=$1
  local duration=${2:-""}
  
  if [ -n "$duration" ]; then
    print_status "$GREEN" "  ✅ $step_name completed in ${duration}s"
  else
    print_status "$GREEN" "  ✅ $step_name completed"
  fi
}

# Function to handle errors with progress context
handle_step_error() {
  local step_number=$1
  local step_name=$2
  local error_message=$3
  
  print_status "$RED" "  ❌ Step $step_number failed: $step_name"
  print_status "$RED" "     Error: $error_message"
  print_status "$YELLOW" "     💡 You can try running the script again or complete this step manually"
}

# Enhanced completion message with detailed next steps
show_enhanced_completion_message() {
  echo ""
  print_status "$GREEN" "🎉 Setup Complete! Your $APP_NAME is ready!"
  echo ""
  print_status "$BLUE" "📁 Project Structure Created:"
  print_status "$BLUE" "   ├── src/app/                 # App Router pages"
  print_status "$BLUE" "   ├── src/components/          # Reusable components"
  print_status "$BLUE" "   ├── src/lib/                 # Utility functions"
  print_status "$BLUE" "   ├── convex/                  # Backend functions"
  print_status "$BLUE" "   ├── .env.local               # Environment variables"
  print_status "$BLUE" "   └── package.json             # Dependencies"
  echo ""
  print_status "$YELLOW" "🚀 Next Steps:"
  print_status "$YELLOW" "   1. Navigate to your project:"
  print_status "$BLUE" "      cd $APP_NAME"
  echo ""
  print_status "$YELLOW" "   2. Set up Convex (Backend):"
  print_status "$BLUE" "      npx convex dev"
  print_status "$BLUE" "      → Follow prompts to create deployment"
  print_status "$BLUE" "      → Copy URLs to .env.local"
  echo ""
  print_status "$YELLOW" "   3. Set up Clerk (Authentication):"
  print_status "$BLUE" "      → Visit: https://clerk.com"
  print_status "$BLUE" "      → Create new application"
  print_status "$BLUE" "      → Copy API keys to .env.local"
  echo ""
  print_status "$YELLOW" "   4. Start development server:"
  print_status "$BLUE" "      npm run dev"
  print_status "$BLUE" "      → Open: http://localhost:3000"
  echo ""
  print_status "$GREEN" "✨ Features Included:"
  print_status "$GREEN" "   • TypeScript & Tailwind CSS"
  print_status "$GREEN" "   • Convex real-time database"
  print_status "$GREEN" "   • Clerk authentication"
  print_status "$GREEN" "   • Custom UI components"
  print_status "$GREEN" "   • Utility functions"
  print_status "$GREEN" "   • Professional project structure"
  echo ""
  print_status "$BLUE" "📚 Documentation:"
  print_status "$BLUE" "   • Next.js: https://nextjs.org/docs"
  print_status "$BLUE" "   • Convex: https://docs.convex.dev"
  print_status "$BLUE" "   • Clerk: https://clerk.com/docs"
  print_status "$BLUE" "   • Tailwind: https://tailwindcss.com/docs"
  echo ""
  print_status "$GREEN" "🎯 Happy coding with $APP_NAME!"
}

# Main execution function with progress tracking and timing
main() {
  local total_steps=8
  local start_time=$(date +%s)
  
  print_status "$BLUE" "🚀 Next.js Starter Script v2.2"
  print_status "$BLUE" "================================"
  print_status "$BLUE" "Creating: $APP_NAME"
  print_status "$BLUE" "Started at: $(date '+%Y-%m-%d %H:%M:%S')"
  echo ""
  
  # Step 1: Network Check
  local step_start=$(date +%s)
  show_progress 1 $total_steps "🌐 Checking network connectivity..."
  if check_network; then
    local step_duration=$(($(date +%s) - step_start))
    show_step_complete "Network connectivity check" $step_duration
  else
    handle_step_error 1 "Network connectivity check" "Unable to reach npm registry"
    exit 1
  fi
  echo ""
  
  # Step 2: Create Next.js App
  step_start=$(date +%s)
  show_progress 2 $total_steps "🚀 Creating Next.js application..."
  if create_nextjs_app; then
    local step_duration=$(($(date +%s) - step_start))
    show_step_complete "Next.js application creation" $step_duration
  else
    handle_step_error 2 "Next.js application creation" "Failed to create app"
    exit 1
  fi
  echo ""
  
  # Step 3: Install Dependencies
  step_start=$(date +%s)
  show_progress 3 $total_steps "📦 Installing dependencies..."
  install_dependencies  # This function handles its own errors gracefully
  local step_duration=$(($(date +%s) - step_start))
  show_step_complete "Dependencies installation" $step_duration
  echo ""
  
  # Step 4: Configuration Files
  step_start=$(date +%s)
  show_progress 4 $total_steps "⚙️  Setting up configuration files..."
  if create_config_files; then
    local step_duration=$(($(date +%s) - step_start))
    show_step_complete "Configuration files setup" $step_duration
  else
    handle_step_error 4 "Configuration files setup" "Failed to create config files"
  fi
  echo ""
  
  # Step 5: Template Files
  step_start=$(date +%s)
  show_progress 5 $total_steps "🔧 Creating template components..."
  if create_template_files; then
    local step_duration=$(($(date +%s) - step_start))
    show_step_complete "Template components creation" $step_duration
  else
    handle_step_error 5 "Template components creation" "Failed to create templates"
  fi
  echo ""
  
  # Step 6: Database Schema
  step_start=$(date +%s)
  show_progress 6 $total_steps "📊 Setting up database schema..."
  if create_convex_schema && create_convex_functions; then
    local step_duration=$(($(date +%s) - step_start))
    show_step_complete "Database schema setup" $step_duration
  else
    handle_step_error 6 "Database schema setup" "Failed to create Convex schema"
  fi
  echo ""
  
  # Step 7: External Tools
  step_start=$(date +%s)
  show_progress 7 $total_steps "⚡ Initializing external tools..."
  if create_convex_config && update_env_with_convex_instructions; then
    local step_duration=$(($(date +%s) - step_start))
    show_step_complete "External tools initialization" $step_duration
  else
    handle_step_error 7 "External tools initialization" "Failed to initialize tools"
  fi
  echo ""
  
  # Step 8: Finalization
  step_start=$(date +%s)
  show_progress 8 $total_steps "✅ Finalizing setup..."
  local total_duration=$(($(date +%s) - start_time))
  local minutes=$((total_duration / 60))
  local seconds=$((total_duration % 60))
  
  # Add timing info to completion message
  print_status "$GREEN" "  ✅ Setup completed in ${minutes}m ${seconds}s"
  echo ""
  show_enhanced_completion_message
}

# Script entry point
if [ -z "$1" ]; then
  print_status "$RED" "❌ Error: Please provide an app name"
  print_status "$BLUE" "Usage: $0 <app-name>"
  print_status "$BLUE" "Example: $0 my-awesome-app"
  exit 1
fi

APP_NAME="$1"
validate_app_name "$APP_NAME"

# Execute the main workflow with progress tracking
main 