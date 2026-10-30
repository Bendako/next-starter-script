#!/bin/bash
# ============================================================================
# NEXT.JS STARTER SCRIPT v2.5 - Professional Project Generator
# ============================================================================
# 
# DESCRIPTION:
#   Automated Next.js application setup with TypeScript, Tailwind CSS,
#   Convex database, and Clerk authentication. Includes professional
#   project structure, components, and development tools.
#
# AUTHOR: Built with ❤️ for developers who value their time
# VERSION: 2.5
# CREATED: Following the "Building Your Own Next.js Starter Script" tutorial
#
# FEATURES:
#   ✅ Next.js 14+ with App Router
#   ✅ TypeScript & Tailwind CSS  
#   ✅ Convex real-time database
#   ✅ Clerk authentication
#   ✅ Professional project structure
#   ✅ Comprehensive error handling
#   ✅ Progress tracking & logging
#   ✅ Multiple templates (minimal, default, full)
#   ✅ Portable across macOS, Linux, Windows
#   ✅ Network resilience with retries
#   ✅ Dry run mode for previewing
#   ✅ Force mode for overwriting
#   ✅ Verbose logging and debugging
#   ✅ Interactive configuration menu (NEW!)
#   ✅ Backward compatible with command-line flags
#
# USAGE:
#   # Interactive mode (recommended):
#   ./create-next-starter.sh my-app
#   
#   # Command-line mode (for automation):
#   ./create-next-starter.sh [OPTIONS] <app-name>
#   
# EXAMPLES:
#   # Interactive guided setup:
#   ./create-next-starter.sh my-app
#     → Choose: 1) Default, 2) With Auth, or 3) With Database
#   
#   # Command-line with flags:
#   ./create-next-starter.sh --skip-convex --skip-clerk my-app  # Clean default
#   ./create-next-starter.sh --skip-convex my-app              # Default + Auth
#   ./create-next-starter.sh --skip-clerk my-app               # Default + Database
#
# REQUIREMENTS:
#   • Node.js 20.9+ (https://nodejs.org/)
#   • npm (comes with Node.js)
#   • Internet connection
#   • At least 1GB free disk space
#
# ============================================================================

# STEP 10: Complete Script Structure
# This script follows the tutorial structure with all 10 steps implemented:
# Step 1: Basic Bash Script Structure ✅
# Step 2: Handle User Input ✅  
# Step 3: Automate NPM Commands ✅
# Step 4: File Creation and Manipulation ✅
# Step 5: Template Substitution ✅
# Step 6: Initialize External Tools ✅
# Step 7: Progress Indicators and User Experience ✅
# Step 8: Error Handling and Cleanup ✅
# Step 9: Making Your Script Portable ✅
# Step 10: Put It All Together ✅
# BONUS: Interactive Configuration Menu ✅

# STEP 8 & 9: Script configuration and portability features
set -e          # Exit on any error
set -u          # Exit on undefined variable  
set -o pipefail # Exit on pipe failure

# STEP 9.1: Default values for command-line options
SKIP_CONVEX=false
SKIP_CLERK=false
VERBOSE=false
DRY_RUN=false
FORCE=false
TEMPLATE="default"
NODE_VERSION_MIN="20.9"
SCRIPT_VERSION="2.5"

# Global variables for cleanup
CLEANUP_NEEDED=false
TEMP_FILES=()
CREATED_DIRS=()
PARTIAL_INSTALL=false
APP_NAME=""

# Self-test owns a temporary Python registry and two mktemp directories.
# Keep these values global so EXIT/SIGTERM cleanup can reach them.
SELF_TEST_STUB_PID=""
SELF_TEST_STUB_DIR=""
SELF_TEST_PING_DIR=""

# Configuration
MAX_RETRIES=3
RETRY_DELAY=5

# Colors for better output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to log errors with timestamp
log_error() {
  local message="$1"
  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  # Try to write to log file, but don't fail if we can't
  echo "[$timestamp] ERROR: $message" >> "setup-error.log" 2>/dev/null || true
  print_status "$RED" "❌ $message"
}

# Function to log info with timestamp
log_info() {
  local message="$1"
  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  # Try to write to log file, but don't fail if we can't
  echo "[$timestamp] INFO: $message" >> "setup.log" 2>/dev/null || true
}

# Reap self-test's local registry on normal completion and interrupted exit.
# Only remove paths returned by mktemp; never use the app's working directory.
cleanup_self_test_resources() {
  if [ -n "${SELF_TEST_STUB_PID:-}" ]; then
    kill "$SELF_TEST_STUB_PID" 2>/dev/null || true
    wait "$SELF_TEST_STUB_PID" 2>/dev/null || true
    SELF_TEST_STUB_PID=""
  fi
  if [ -n "${SELF_TEST_STUB_DIR:-}" ]; then
    rm -rf -- "$SELF_TEST_STUB_DIR" || true
    SELF_TEST_STUB_DIR=""
  fi
  if [ -n "${SELF_TEST_PING_DIR:-}" ]; then
    rm -rf -- "$SELF_TEST_PING_DIR" || true
    SELF_TEST_PING_DIR=""
  fi
}

# Comprehensive cleanup function
cleanup() {
  # Preserve the original exit status before cleanup commands overwrite $?.
  local exit_code=$?
  cleanup_self_test_resources
  
  if [ $exit_code -ne 0 ] && [ "$CLEANUP_NEEDED" = true ]; then
    print_status "$YELLOW" ""
    print_status "$YELLOW" "🧹 Cleaning up after failed installation..."
    
    # Remove temporary files
    if [ ${#TEMP_FILES[@]} -gt 0 ]; then
      for temp_file in "${TEMP_FILES[@]}"; do
        if [ -f "$temp_file" ]; then
          rm -f "$temp_file"
          print_status "$YELLOW" "  🗑️  Removed temporary file: $temp_file"
        fi
      done
    fi
    
    # Ask user if they want to remove the partially created directory
    if [ -n "${APP_NAME:-}" ] && [ -d "${APP_NAME:-}" ]; then
      print_status "$YELLOW" ""
      print_status "$YELLOW" "❓ The directory '$APP_NAME' was partially created."
      read -p "Do you want to remove it? (y/N): " -n 1 -r
      echo
      if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf "$APP_NAME"
        print_status "$GREEN" "  🗑️  Removed directory: $APP_NAME"
      else
        print_status "$BLUE" "  📁 Keeping directory: $APP_NAME"
        print_status "$BLUE" "     You can continue setup manually or run the script again"
      fi
    fi
    
    print_status "$RED" ""
    print_status "$RED" "❌ Setup failed!"
    print_status "$YELLOW" "📋 Troubleshooting tips:"
    print_status "$YELLOW" "  1. Check your internet connection"
    print_status "$YELLOW" "  2. Ensure you have the latest Node.js and npm"
    print_status "$YELLOW" "  3. Try running: npm cache clean --force"
    print_status "$YELLOW" "  4. Check the error log (if available): setup-error.log"
    print_status "$YELLOW" "  5. Try running the script again"
    
  elif [ $exit_code -eq 0 ]; then
    # Successful completion - clean up logs if they exist and we can write to them
    [ -f "setup-error.log" ] && rm -f "setup-error.log" 2>/dev/null || true
    print_status "$GREEN" "🎉 Setup completed successfully!"
  fi
  
  # Reset error handling for cleanup
  set +e
}

# Set up trap for cleanup on exit
trap cleanup EXIT

# Function to handle interruption (Ctrl+C)
handle_interrupt() {
  print_status "$YELLOW" ""
  print_status "$YELLOW" "⚠️  Setup interrupted by user"
  CLEANUP_NEEDED=true
  exit 130
}
trap handle_interrupt SIGINT SIGTERM

# STEP 9.1: Help system
show_help() {
  cat << EOF
🚀 Next.js Starter Script v${SCRIPT_VERSION} - Professional Project Generator

USAGE:
  # Interactive mode (recommended for new users):
  $0 <app-name>
  
  # Command-line mode (for automation/scripts):
  $0 [OPTIONS] [--] <app-name>

DESCRIPTION:
  Create a new Next.js application with TypeScript, Tailwind CSS, and optionally
  Convex database or Clerk authentication. Professional project structure with
  modern development tools.

INTERACTIVE MODE:
  Simply provide the app name and choose from 4 clear configuration options:
  1) Default - Next.js + TypeScript + Tailwind + shared UI utilities; skips Clerk/Convex
  2) With Auth - Base setup + optional Clerk plumbing; skips Convex
  3) With Database - Base setup + optional Convex plumbing; skips Clerk
  4) Full - Base setup + optional Clerk and Convex plumbing (uses template default)
  
  Menu option 1 uses --template default --skip-clerk --skip-convex.
  --template default alone maps to menu option 4 (both services included).
  The current interactive flow automatically selects option 1.

REQUIRED:
  <app-name>           Lowercase letter or number, then lowercase letters, numbers, and hyphens. 1 to 214 characters. Put the name after -- so it is not read as an option.

COMMAND-LINE OPTIONS:
  --skip-convex        Skip Convex database setup
  --skip-clerk         Skip Clerk authentication setup
  --verbose            Show detailed output and debug information
  --dry-run            Show what would be done without executing
  --force              Overwrite existing directory if it exists
  --template TYPE      Use specific template (default, minimal, full)
  --node-version MIN   Minimum Node.js version required (default: 20.9)
  --test               Run script self-test and exit
  --help, -h           Show this help message
  --version, -v        Show script version

TEMPLATES:
  default              Next.js, TypeScript, Tailwind, shared UI utilities/components,
                       and optional Clerk + Convex plumbing unless skipped
  minimal              Same installed dependencies/components as default;
                       currently no additional template customizations
  full                 Same as default + Loading and ErrorBoundary components

  All templates install Radix icons, lucide-react, class-variance-authority,
  clsx and tailwind-merge. --skip-clerk/--skip-convex apply to every template.
  Included services degrade gracefully without keys; configure keys to use them.

EXAMPLES:
  # Interactive mode (guided setup with numbered selection):
  $0 my-awesome-app
  
  # Command-line mode (for automation):
  $0 --skip-convex my-app              # Default without database
  $0 --skip-clerk my-app               # Default without authentication
  $0 --skip-convex --skip-clerk my-app # Clean default setup
  $0 --template default my-app         # Menu option 4: Clerk + Convex plumbing
  $0 --verbose my-app                  # With detailed output
  $0 --dry-run my-app                  # Preview what would be created

NON-INTERACTIVE:
  With only an app name and no stdin TTY, the menu uses option 1: Default
  (no Clerk, no Convex), standard output, execute. Pass --skip-clerk,
  --skip-convex, or --template flags to choose another configuration.

REQUIREMENTS:
  • Node.js ${NODE_VERSION_MIN}+ (https://nodejs.org/)
  • npm (comes with Node.js)
  • Internet connection
  • At least 1GB free disk space

SUPPORT:
  Documentation: https://github.com/Bendako/next-starter-script
  Issues: https://github.com/Bendako/next-starter-script/issues

EOF
}

# STEP 9.1: Version information
show_version() {
  cat << EOF
Next.js Starter Script v${SCRIPT_VERSION}

Features:
• Next.js 14+ with App Router
• TypeScript & Tailwind CSS
• Convex real-time database
• Clerk authentication
• Professional project structure
• Comprehensive error handling
• Progress tracking & logging
• Interactive numbered selection

Built with ❤️  for developers who value their time.
EOF
}

# Function to display a selection menu (simplified approach)
show_selection_menu() {
  local options=("$@")
  local num_options=${#options[@]}
  
  # Display all options with numbers
  for i in "${!options[@]}"; do
    option_num=$((i + 1))
    printf "  ${BLUE}%d) %s${NC}\n" "$option_num" "${options[$i]}"
  done
  echo ""
  
  # Get user selection
  while true; do
    printf "${YELLOW}Choose an option (1-$num_options) or press Enter for default [1]: ${NC}"
    read -r choice </dev/tty
    
    # Default to 1 if empty
    choice=${choice:-1}
    
    # Validate input
    if [[ "$choice" =~ ^[0-9]+$ ]] && [ "$choice" -ge 1 ] && [ "$choice" -le "$num_options" ]; then
      echo $((choice - 1))  # Return 0-based index
      return
    else
      print_status "$RED" "Invalid choice. Please enter a number between 1 and $num_options."
    fi
  done
}

# STEP 9.1: Interactive option selection with arrow key navigation
show_interactive_menu() {
  if [ ! -t 0 ]; then
    print_status "$YELLOW" "Non-interactive session (no TTY) detected: using the default configuration (option 1: Default - no Clerk, no Convex; standard output; execute). Pass --skip-clerk/--skip-convex/--template flags to choose another configuration."
  fi
  print_status "$CYAN" "🎛️  Let's configure your Next.js project!"
  print_status "$BLUE" ""
  
  # Configuration options
  local config_options=(
    "Default - Next.js + TypeScript + Tailwind + shared UI utilities (skips Clerk/Convex)"
    "With Auth - Base setup + optional Clerk plumbing (skips Convex)"
    "With Database - Base setup + optional Convex plumbing (skips Clerk)"
    "Full - Base setup + optional Clerk/Convex plumbing (template default; works without keys)"
  )
  
  # Main configuration choice with arrow key navigation
  print_status "$PURPLE" "📋 Choose your project configuration:"
  echo ""
  local selected_config
  selected_config=0  # Temporarily defaulting to first option
  
  case $selected_config in
    0) 
      TEMPLATE="default"
      SKIP_CONVEX=true
      SKIP_CLERK=true
      print_status "$GREEN" "✅ Configuration: Default (Next.js + TypeScript + Tailwind)"
      ;;
    1) 
      TEMPLATE="default"
      SKIP_CONVEX=true
      SKIP_CLERK=false
      print_status "$GREEN" "✅ Configuration: With Auth (Clerk authentication included)"
      ;;
    2) 
      TEMPLATE="default"
      SKIP_CONVEX=false
      SKIP_CLERK=true
      print_status "$GREEN" "✅ Configuration: With Database (Convex database included)"
      ;;
    3) 
      TEMPLATE="default"
      SKIP_CONVEX=false
      SKIP_CLERK=false
      print_status "$GREEN" "✅ Configuration: Full (Clerk auth + Convex database included)"
      ;;
    *) 
      print_status "$YELLOW" "Invalid selection, using default configuration"
      TEMPLATE="default"
      SKIP_CONVEX=true
      SKIP_CLERK=true
      ;;
  esac
  
  log_info "Configuration selected: Template=$TEMPLATE, SKIP_CONVEX=$SKIP_CONVEX, SKIP_CLERK=$SKIP_CLERK"
  echo ""

  # Output verbosity options
  local verbose_options=(
    "Standard - Normal output with progress indicators"
    "Verbose - Detailed output and debug information"
  )
  
  print_status "$PURPLE" "📝 Choose output verbosity:"
  echo ""
  local selected_verbose
  selected_verbose=0  # Temporarily defaulting to first option
  
  case $selected_verbose in
    0) VERBOSE=false ;;
    1) VERBOSE=true ;;
    *) 
      print_status "$YELLOW" "Invalid selection, using standard output"
      VERBOSE=false
      ;;
  esac
  log_info "Verbose mode: $([ "$VERBOSE" = true ] && echo "enabled" || echo "disabled")"
  print_status "$GREEN" "✅ Output: $([ "$VERBOSE" = true ] && echo "Verbose" || echo "Standard")"
  echo ""

  # Execution mode options
  local execution_options=(
    "Execute - Create the project now"
    "Preview - Show what would be done (dry run)"
  )
  
  print_status "$PURPLE" "🔍 Execution mode:"
  echo ""
  local selected_execution
  selected_execution=0  # Temporarily defaulting to first option
  
  case $selected_execution in
    0) DRY_RUN=false ;;
    1) DRY_RUN=true ;;
    *) 
      print_status "$YELLOW" "Invalid selection, executing normally"
      DRY_RUN=false
      ;;
  esac
  log_info "Execution mode: $([ "$DRY_RUN" = true ] && echo "dry run" || echo "execute")"
  print_status "$GREEN" "✅ Mode: $([ "$DRY_RUN" = true ] && echo "Preview" || echo "Execute")"
  echo ""

  # Force mode (only ask if directory exists)
  if [ -d "$APP_NAME" ]; then
    local force_options=(
      "Cancel - Don't overwrite existing directory"
      "Overwrite - Remove existing directory and continue"
    )
    
    print_status "$PURPLE" "⚠️  Directory '$APP_NAME' already exists:"
    echo ""
    local selected_force
    selected_force=0  # Temporarily defaulting to first option
    
    case $selected_force in
      0) 
        print_status "$YELLOW" "Operation cancelled to preserve existing directory"
        exit 0
        ;;
      1) FORCE=true ;;
      *) 
        print_status "$YELLOW" "Invalid selection, cancelling to be safe"
        exit 0
        ;;
    esac
    log_info "Force mode: enabled (overwrite existing)"
    print_status "$GREEN" "✅ Action: Overwrite existing directory"
    echo ""
  fi

  # Summary of selections
  print_status "$CYAN" "📋 Configuration Summary:"
  print_status "$BLUE" "  📁 Project: $APP_NAME"
  
  # Show configuration description
  local config_desc=""
  if [ "$SKIP_CONVEX" = true ] && [ "$SKIP_CLERK" = true ]; then
    config_desc="Default (Next.js + TypeScript + Tailwind)"
  elif [ "$SKIP_CONVEX" = true ] && [ "$SKIP_CLERK" = false ]; then
    config_desc="With Auth (includes Clerk authentication)"
  elif [ "$SKIP_CONVEX" = false ] && [ "$SKIP_CLERK" = true ]; then
    config_desc="With Database (includes Convex database)"
  else
    config_desc="Full Stack (includes both Clerk auth and Convex database)"
  fi
  
  print_status "$BLUE" "  ⚙️  Configuration: $config_desc"
  print_status "$BLUE" "  📝 Output: $([ "$VERBOSE" = true ] && echo "Verbose" || echo "Standard")"
  print_status "$BLUE" "  🔍 Mode: $([ "$DRY_RUN" = true ] && echo "Preview" || echo "Execute")"
  [ "$FORCE" = true ] && print_status "$BLUE" "  ⚠️  Action: Overwrite existing"
  echo ""
  
  if [ "$DRY_RUN" = false ]; then
    local confirm_options=(
      "Yes - Continue with project creation"
      "No - Cancel and exit"
    )
    
    print_status "$PURPLE" "🚀 Ready to create your project!"
    echo ""
    local selected_confirm
    selected_confirm=0  # Temporarily defaulting to first option
    
    case $selected_confirm in
      0) 
        print_status "$GREEN" "✅ Starting project creation..."
        ;;
      1) 
        print_status "$YELLOW" "Operation cancelled by user"
        exit 0
        ;;
      *) 
        print_status "$YELLOW" "Invalid selection, cancelling to be safe"
        exit 0
        ;;
    esac
  else
    print_status "$CYAN" "🔍 Preview mode - showing what would be created..."
  fi
  echo ""
}

# STEP 9.1: Parse command line options (updated to support both flags and interactive mode)
parse_arguments() {
  local interactive_mode=true
  
  # If no arguments provided, show help
  if [ $# -eq 0 ]; then
    show_help
    exit 0
  fi

  # Check if any flags are provided (non-interactive mode)
  for arg in "$@"; do
    if [[ $arg == --* ]]; then
      interactive_mode=false
      break
    fi
  done

  # If only app name provided and no flags, use interactive mode
  if [ $# -eq 1 ] && [[ $1 != --* ]]; then
    APP_NAME="$1"
    log_info "App name set to: $APP_NAME (interactive mode)"
    show_interactive_menu
    return
  fi

  # Original flag parsing for non-interactive mode
  while [[ $# -gt 0 ]]; do
    case $1 in
      --skip-convex)
        SKIP_CONVEX=true
        log_info "Option: Skip Convex setup enabled"
        shift
        ;;
      --skip-clerk)
        SKIP_CLERK=true
        log_info "Option: Skip Clerk setup enabled"
        shift
        ;;
      --verbose)
        VERBOSE=true
        log_info "Option: Verbose mode enabled"
        shift
        ;;
      --dry-run)
        DRY_RUN=true
        log_info "Option: Dry run mode enabled"
        shift
        ;;
      --force)
        FORCE=true
        log_info "Option: Force mode enabled"
        shift
        ;;
      --template)
        if [ -n "${2:-}" ]; then
          TEMPLATE="$2"
          log_info "Option: Template set to $TEMPLATE"
          shift 2
        else
          log_error "Option --template requires a value"
          exit 1
        fi
        ;;
      --node-version)
        if [ -n "${2:-}" ]; then
          if [[ ! "$2" =~ ^[0-9]+(\.[0-9]+)?$ ]]; then
            log_error "Invalid --node-version: '$2'. Expected a major or major.minor version (e.g. 20 or 20.9)."
            exit 1
          fi
          NODE_VERSION_MIN="$2"
          log_info "Option: Minimum Node.js version set to $NODE_VERSION_MIN"
          shift 2
        else
          log_error "Option --node-version requires a value"
          exit 1
        fi
        ;;
      --test)
        echo "🧪 Running script self-test..."
        if script_self_test; then
          echo "✅ Script is ready to use!"
          exit 0
        else
          echo "❌ Script has issues that need to be fixed"
          exit 1
        fi
        ;;
      --help|-h)
        show_help
        exit 0
        ;;
      --version|-v)
        show_version
        exit 0
        ;;
      --)
        shift
        while [[ $# -gt 0 ]]; do
          if [ -z "$APP_NAME" ]; then
            APP_NAME="$1"
            log_info "App name set to: $APP_NAME"
          else
            log_error "Multiple app names provided: '$APP_NAME' and '$1'"
            print_status "$YELLOW" "💡 Please provide only one app name"
            exit 1
          fi
          shift
        done
        ;;
      -*)
        log_error "Unknown option: $1"
        print_status "$YELLOW" "💡 Use --help to see available options"
        exit 1
        ;;
      *)
        if [ -z "$APP_NAME" ]; then
          APP_NAME="$1"
          log_info "App name set to: $APP_NAME"
        else
          log_error "Multiple app names provided: '$APP_NAME' and '$1'"
          print_status "$YELLOW" "💡 Please provide only one app name"
          exit 1
        fi
        shift
        ;;
    esac
  done

  # Validate that app name was provided
  if [ -z "$APP_NAME" ]; then
    log_error "No app name provided"
    print_status "$RED" "❌ Error: Please provide an app name"
    print_status "$YELLOW" "💡 Use --help for usage information"
    exit 1
  fi

  # Validate template option
  case $TEMPLATE in
    default|minimal|full)
      log_info "Using template: $TEMPLATE"
      ;;
    *)
      log_error "Invalid template: $TEMPLATE"
      print_status "$RED" "❌ Invalid template: $TEMPLATE"
      print_status "$YELLOW" "💡 Available templates: default, minimal, full"
      exit 1
      ;;
  esac
}

# STEP 9.2: Enhanced environment detection
detect_environment() {
  print_status "$BLUE" "🔍 Detecting environment..."
  
  # Detect operating system
  local os_type=""
  case "$(uname -s)" in
    Darwin*)
      os_type="macOS"
      ;;
    Linux*)
      os_type="Linux"
      ;;
    CYGWIN*|MINGW*|MSYS*)
      os_type="Windows"
      ;;
    *)
      os_type="Unknown"
      ;;
  esac
  
  log_info "Operating System: $os_type"
  
  # Detect architecture
  local arch=$(uname -m)
  log_info "Architecture: $arch"
  
  # Detect shell
  local shell_type=$(basename "$SHELL")
  log_info "Shell: $shell_type"
  
  # Check if running in CI environment
  if [ -n "${CI:-}" ] || [ -n "${GITHUB_ACTIONS:-}" ] || [ -n "${TRAVIS:-}" ]; then
    log_info "CI environment detected"
    print_status "$YELLOW" "⚠️  CI environment detected - some interactive features may be disabled"
  fi
  
  # Check available package managers
  local package_managers=()
  command -v npm &> /dev/null && package_managers+=("npm")
  command -v yarn &> /dev/null && package_managers+=("yarn")
  command -v pnpm &> /dev/null && package_managers+=("pnpm")
  command -v bun &> /dev/null && package_managers+=("bun")
  
  if [ ${#package_managers[@]} -gt 0 ]; then
    log_info "Available package managers: ${package_managers[*]}"
  fi
  
  print_status "$GREEN" "✅ Environment detection completed"
  
  if [ "$VERBOSE" = true ]; then
    print_status "$CYAN" "📊 Environment Summary:"
    print_status "$CYAN" "   OS: $os_type ($arch)"
    print_status "$CYAN" "   Shell: $shell_type"
    print_status "$CYAN" "   Package Managers: ${package_managers[*]:-none}"
  fi
}

# Ask npm to resolve the effective registry (including npmrc location, comments,
# userconfig/globalconfig and env precedence). Do not parse arbitrary .npmrc here.
# npm deliberately refuses to reveal URLs containing passwords. In that case
# a bounded "npm ping" is the safer fallback, unless the URL is from an
# explicit environment setting (which can be validated without reading files).
configured_registry() {
  local registry=""
  if command -v npm >/dev/null 2>&1; then
    registry=$(npm config get registry 2>/dev/null) || registry=""
  fi
  case "$registry" in
    ""|undefined|null)
      if [ -n "${NPM_CONFIG_REGISTRY:-}" ]; then
        registry="$NPM_CONFIG_REGISTRY"
      elif [ -n "${npm_config_registry:-}" ]; then
        registry="$npm_config_registry"
      else
        return 1
      fi
      ;;
  esac
  printf '%s\n' "$registry"
}

# A registry is an HTTP(S) endpoint, not curl flags or a curl config file.
# Disallow characters which would inject new directives into curl -K stdin.
valid_registry_url() {
  local url="$1"
  case "$url" in
    http://*|https://*) ;;
    *) return 1 ;;
  esac
  case "$url" in
    *'"'*|*'\'*|*'?'*|*'#'*) return 1 ;;
  esac
  if [[ "$url" =~ [[:space:][:cntrl:]] ]]; then
    return 1
  fi
  local authority="${url#*://}"
  authority="${authority%%/*}"
  [ -n "$authority" ]
}

# Mask only the authority's userinfo, using its *last* @. An @ in a
# password or in a path segment must not expose credentials or be mangled.
mask_registry() {
  local url="$1"
  local scheme="${url%%://*}"
  local remainder="${url#*://}"
  local authority="${remainder%%/*}"
  local suffix="${remainder#"$authority"}"
  case "$authority" in
    *@*)
      printf '%s://***@%s%s\n' "$scheme" "${authority##*@}" "$suffix"
      ;;
    *)
      printf '%s\n' "$url"
      ;;
  esac
}

bounded_npm_ping() {
  # npm resolves its own registry and auth. Kill a hung npm connection even
  # when --fetch-timeout does not abort TCP connect.
  npm ping --fetch-timeout=5000 --fetch-retries=0 >/dev/null 2>&1 &
  local ping_pid=$!
  local waited=0
  while kill -0 "$ping_pid" 2>/dev/null; do
    if [ "$waited" -ge 5 ]; then
      kill "$ping_pid" 2>/dev/null || true
      wait "$ping_pid" 2>/dev/null || true
      return 1
    fi
    sleep 1
    waited=$((waited + 1))
  done
  wait "$ping_pid"
}

npm_registry_reachable() {
  local registry=""
  local code=""
  if ! registry=$(configured_registry); then
    # Protected npmrc settings remain private. Do not attempt to parse them.
    NPM_REGISTRY="configured npm registry (redacted)"
    bounded_npm_ping
    return $?
  fi
  registry="${registry%/}"
  if ! valid_registry_url "$registry"; then
    NPM_REGISTRY="invalid npm registry (redacted)"
    return 1
  fi
  NPM_REGISTRY=$(mask_registry "$registry")
  # curl cannot parse a password with a raw @ in the URL, while npm can.
  # For multiple @ characters in the URL authority, let npm handle its
  # own configuration/credential parsing rather than breaking reachability.
  local registry_authority="${registry#*://}"
  registry_authority="${registry_authority%%/*}"
  case "$registry_authority" in
    *@*@*) bounded_npm_ping; return $? ;;
  esac
  if command -v curl >/dev/null 2>&1; then
    # -K - puts the URL on stdin instead of the process command line.
    # Only a validated URL can enter this quoted curl config directive.
    # -q disables a user's ~/.curlrc so this check is deterministic.
    code=$(printf 'url = "%s/-/ping"\n' "$registry" |
      curl -q -sS -o /dev/null -m 5 -w '%{http_code}' -K - 2>/dev/null) || true
    case "$code" in
      ""|000) return 1 ;;
    esac
    return 0
  fi
  bounded_npm_ping
}

# STEP 9.2: Enhanced prerequisite checking with version detection
check_prerequisites() {
  print_status "$BLUE" "🔍 Checking prerequisites..."
  local missing=()
  local warnings=()
  
  # Check for required commands
  if ! command -v node &> /dev/null; then
    missing+=("Node.js")
  else
    # Check Node version
    local node_version=$(node --version | cut -d 'v' -f 2)
    local major_version minor_version min_major min_minor
    IFS=. read -r major_version minor_version _ <<< "$node_version"
    IFS=. read -r min_major min_minor <<< "$NODE_VERSION_MIN"
    min_minor=${min_minor:-0}

    if (( 10#$major_version < 10#$min_major ||
          (10#$major_version == 10#$min_major && 10#$minor_version < 10#$min_minor) )); then
      missing+=("Node.js ${NODE_VERSION_MIN}+ required by create-next-app 16 / Next 16 (current: v$node_version)")
    else
      log_info "Node.js version: v$node_version ✓"
      if [ "$VERBOSE" = true ]; then
        print_status "$CYAN" "   Node.js: v$node_version"
      fi
    fi
  fi
  
  if ! command -v npm &> /dev/null; then
    missing+=("npm")
  else
    local npm_version=$(npm --version)
    log_info "npm version: $npm_version ✓"
    if [ "$VERBOSE" = true ]; then
      print_status "$CYAN" "   npm: v$npm_version"
    fi
  fi
  
  if ! command -v git &> /dev/null; then
    warnings+=("Git (recommended for version control)")
  else
    local git_version=$(git --version | cut -d ' ' -f 3)
    log_info "Git version: $git_version ✓"
    if [ "$VERBOSE" = true ]; then
      print_status "$CYAN" "   Git: v$git_version"
    fi
  fi
  
  # Check disk space (at least 1GB free)
  local available_space=$(df . | awk 'NR==2 {print $4}')
  local space_gb=$((available_space / 1048576))
  if [ "$available_space" -lt 1048576 ]; then # 1GB in KB
    warnings+=("Low disk space (${space_gb}GB available, 1GB+ recommended)")
  else
    log_info "Disk space: ${space_gb}GB available ✓"
    if [ "$VERBOSE" = true ]; then
      print_status "$CYAN" "   Disk space: ${space_gb}GB available"
    fi
  fi
  
  # Check internet connectivity
  if ! npm_registry_reachable; then
    missing+=("Internet connection to npm registry")
  else
    log_info "Internet connectivity: ✓"
  fi
  
  # Report missing requirements
  if [ ${#missing[@]} -ne 0 ]; then
    log_error "Missing required tools: ${missing[*]}"
    print_status "$RED" "❌ Missing required tools:"
    for tool in "${missing[@]}"; do
      print_status "$RED" "    - $tool"
    done
    print_status "$YELLOW" ""
    print_status "$YELLOW" "📋 Installation instructions:"
    print_status "$YELLOW" "  Node.js: https://nodejs.org/"
    print_status "$YELLOW" "  npm: Comes with Node.js"
    print_status "$YELLOW" "  Git: https://git-scm.com/"
    exit 1
  fi
  
  # Report warnings
  if [ ${#warnings[@]} -ne 0 ]; then
    print_status "$YELLOW" "⚠️  Warnings:"
    for warning in "${warnings[@]}"; do
      print_status "$YELLOW" "    - $warning"
    done
  fi
  
  print_status "$GREEN" "✅ Prerequisites check passed"
  log_info "Prerequisites check completed successfully"
}

# STEP 9: Dry run functionality
show_dry_run_summary() {
  if [ "$DRY_RUN" = true ]; then
    print_status "$CYAN" ""
    print_status "$CYAN" "🔍 DRY RUN MODE - Preview of actions:"
    print_status "$CYAN" "=================================="
    print_status "$CYAN" "App Name: $APP_NAME"
    print_status "$CYAN" "Template: $TEMPLATE"
    print_status "$CYAN" "Skip Convex: $SKIP_CONVEX"
    print_status "$CYAN" "Skip Clerk: $SKIP_CLERK"
    print_status "$CYAN" "Verbose: $VERBOSE"
    print_status "$CYAN" ""
    print_status "$CYAN" "Would create:"
    print_status "$CYAN" "  📁 Directory: $APP_NAME/"
    print_status "$CYAN" "  📦 Next.js app with TypeScript & Tailwind"
    print_status "$CYAN" "  🔧 Utility functions and components"
    
    if [ "$SKIP_CONVEX" = false ]; then
      print_status "$CYAN" "  ⚡ Convex database setup"
    fi
    
    if [ "$SKIP_CLERK" = false ]; then
      print_status "$CYAN" "  🔐 Clerk authentication setup"
    fi
    
    case $TEMPLATE in
      minimal)
        print_status "$CYAN" "  📋 Minimal template (same dependencies/components as default)"
        ;;
      full)
        print_status "$CYAN" "  📋 Full template (base setup + Loading and ErrorBoundary components)"
        ;;
      *)
        print_status "$CYAN" "  📋 Default template (base setup; services controlled by skip flags)"
        ;;
    esac
    
    print_status "$CYAN" ""
    print_status "$CYAN" "💡 Run without --dry-run to execute these actions"
    exit 0
  fi
}

# Function to print colored output
print_status() {
  local color=$1
  local message=$2
  echo -e "${color}${message}${NC}"
}

require_valid_app_name_format() {
  local app_name="$1"
  if [[ -n "$app_name" && ${#app_name} -le 214 && "$app_name" =~ ^[a-z0-9][a-z0-9-]*$ ]]; then
    return 0
  fi
  log_error "Invalid app name format: $app_name"
  print_status "$YELLOW" "💡 App name requirements:"
  print_status "$YELLOW" "  - Start with a lowercase letter or number"
  print_status "$YELLOW" "  - Then only lowercase letters, numbers, and hyphens"
  print_status "$YELLOW" "  - No spaces or special characters"
  print_status "$YELLOW" "  - 1 to 214 characters"
  print_status "$YELLOW" "  - Example: my-awesome-app"
  exit 1
}

# Function to validate app name with enhanced error handling and FORCE option
validate_app_name() {
  local app_name="$1"
  require_valid_app_name_format "$app_name"
  
  # Check if directory already exists
  if [ -d "$app_name" ]; then
    if [ "$FORCE" = true ]; then
      log_info "Directory exists but FORCE mode enabled, will overwrite: $app_name"
      print_status "$YELLOW" "⚠️  Directory '$app_name' exists - FORCE mode enabled"
      print_status "$BLUE" "🗑️  Removing existing directory..."
      rm -rf "$app_name"
      print_status "$GREEN" "✅ Existing directory removed"
    else
      log_error "Directory already exists: $app_name"
      print_status "$YELLOW" "💡 Solutions:"
      print_status "$YELLOW" "  1. Choose a different name"
      print_status "$YELLOW" "  2. Use --force to overwrite existing directory"
      print_status "$YELLOW" "  3. Remove manually: rm -rf $app_name"
      print_status "$YELLOW" "  4. Use a different location"
      exit 1
    fi
  fi
  
  log_info "App name validation passed: $app_name"
  print_status "$GREEN" "✅ App name '$app_name' is valid"
}

# Function to check network connectivity with enhanced error handling
check_network() {
  print_status "$BLUE" "🌐 Checking network connectivity..."

  if npm_registry_reachable; then
    log_info "Network connectivity verified via $NPM_REGISTRY"
  else
    log_error "No network connectivity detected"
    print_status "$YELLOW" "💡 Troubleshooting network issues:"
    print_status "$YELLOW" "  1. Check your internet connection"
    print_status "$YELLOW" "  2. Verify DNS settings"
    print_status "$YELLOW" "  3. Check firewall/proxy settings"
    print_status "$YELLOW" "  4. Try using a different network"
    exit 1
  fi
  
  print_status "$GREEN" "✅ Network connection verified via $NPM_REGISTRY"
}

# Function to create Next.js app with enhanced error handling
create_nextjs_app() {
  print_status "$BLUE" "🚀 Creating Next.js application..."
  CLEANUP_NEEDED=true  # Enable cleanup from this point
  
  local attempt=1
  while [ $attempt -le $MAX_RETRIES ]; do
    print_status "$YELLOW" "📝 Attempt $attempt of $MAX_RETRIES..."
    log_info "Creating Next.js app: $APP_NAME (attempt $attempt)"
    
    # Create Next.js app with all options
    if npx create-next-app@latest "$APP_NAME" \
      --typescript \
      --tailwind \
      --eslint \
      --app \
      --src-dir \
      --import-alias "@/*" \
      --yes; then
      
      log_info "Next.js app created successfully"
      print_status "$GREEN" "✅ Next.js app created successfully"
      
      # Verify the directory was created
      if [ ! -d "$APP_NAME" ]; then
        log_error "App directory was not created despite successful command"
        exit 1
      fi
      
      return 0
    fi

    if [ $attempt -eq $MAX_RETRIES ]; then
      log_error "Failed to create Next.js app after $MAX_RETRIES attempts"
      print_status "$YELLOW" "💡 Possible solutions:"
      print_status "$YELLOW" "  1. Check your internet connection"
      print_status "$YELLOW" "  2. Try: npm cache clean --force"
      print_status "$YELLOW" "  3. Update npm: npm install -g npm@latest"
      print_status "$YELLOW" "  4. Try a different app name"
      exit 1
    fi

    print_status "$YELLOW" "⚠️  Attempt $attempt failed, retrying in $RETRY_DELAY seconds..."
    log_info "Attempt $attempt failed, retrying..."
    sleep $RETRY_DELAY
    ((attempt++))
  done
}

# Function to install a single package with enhanced error handling
install_package() {
  local package_name=$1
  
  # Use the enhanced safe_npm_install function
  if safe_npm_install "$package_name"; then
    print_status "$GREEN" "  ✅ Successfully installed $package_name"
    return 0
  else
    print_status "$RED" "  ❌ Failed to install $package_name"
    print_status "$YELLOW" "  💡 You can try installing it manually later with: npm install $package_name"
    return 1
  fi
}

# Function to clean npm cache if needed
clean_npm_cache() {
  print_status "$YELLOW" "🧹 Cleaning npm cache to resolve potential issues..."
  npm cache clean --force
  print_status "$GREEN" "✅ npm cache cleaned"
}

# Function to install all dependencies with enhanced error handling
install_dependencies() {
  # Navigate to project directory with error handling
  if ! cd "$APP_NAME"; then
    log_error "Failed to enter project directory: $APP_NAME"
    print_status "$YELLOW" "💡 Possible issues:"
    print_status "$YELLOW" "  1. Directory doesn't exist"
    print_status "$YELLOW" "  2. Permission issues"
    print_status "$YELLOW" "  3. Directory was deleted"
    exit 1
  fi
  
  log_info "Entered project directory: $APP_NAME"
  PARTIAL_INSTALL=true  # Mark that we've started installing

  print_status "$BLUE" "📦 Installing additional dependencies..."

  # Build list of packages to install based on skip flags
  local packages=(
    "@radix-ui/react-icons"
    "lucide-react"
    "class-variance-authority"
    "clsx"
    "tailwind-merge"
  )
  
  # Add Convex if not skipped
  if [ "$SKIP_CONVEX" = false ]; then
    packages+=("convex")
  fi
  
  # Add Clerk if not skipped
  if [ "$SKIP_CLERK" = false ]; then
    packages+=("@clerk/nextjs")
  fi

  local failed_packages=()
  local installed_count=0
  
  # Install packages one by one with error checking
  for package in "${packages[@]}"; do
    if install_package "$package"; then
      ((installed_count++))
    else
      failed_packages+=("$package")
    fi
  done

  # Report results with detailed statistics
  local total_packages=${#packages[@]}
  log_info "Package installation completed: $installed_count/$total_packages successful"
  
  if [ ${#failed_packages[@]} -eq 0 ]; then
    print_status "$GREEN" "✅ All dependencies installed successfully ($installed_count/$total_packages)"
  else
    print_status "$YELLOW" "⚠️  Package installation summary:"
    print_status "$GREEN" "    ✅ Successful: $installed_count/$total_packages"
    print_status "$RED" "    ❌ Failed: ${#failed_packages[@]}/$total_packages"
    print_status "$YELLOW" "    Failed packages:"
    for package in "${failed_packages[@]}"; do
      print_status "$YELLOW" "      - $package"
    done
    print_status "$BLUE" "💡 You can install failed packages manually later or run the script again"
    
    # Log failed packages for troubleshooting
    log_error "Failed to install packages: ${failed_packages[*]}"
  fi
}

# STEP 4: File Creation and Manipulation Functions

# Function to create environment file
create_env_file() {
  print_status "$BLUE" "📄 Creating environment configuration file..."
  
  cat > .env.local << EOF
# Environment Variables for $APP_NAME
# Add your environment variables here

EOF

  # Add Convex configuration if not skipped
  if [ "$SKIP_CONVEX" = false ]; then
    cat >> .env.local << EOF
# Convex Configuration
CONVEX_DEPLOYMENT=
NEXT_PUBLIC_CONVEX_URL=

EOF
  fi

  # Add Clerk configuration if not skipped
  if [ "$SKIP_CLERK" = false ]; then
    cat >> .env.local << EOF
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/

# Production only. true serves protected routes when either Clerk key is missing.
# Otherwise those routes return 503. Public routes stay available either way.
ALLOW_NO_AUTH=

EOF
  fi

  if [ "$SKIP_CLERK" = false ]; then
    cp .env.local .env.example
    if [ -f .gitignore ] && ! grep -q '!.env.example' .gitignore; then
      printf '\n!.env.example\n' >> .gitignore
    fi
  fi

  cat >> .env.local << EOF
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

// Only create Convex client if URL is provided
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

export default function ConvexClientProvider({
  children,
}: {
  children: ReactNode;
}) {
  // If no Convex URL is configured, just render children without provider
  if (!convex) {
    return <>{children}</>;
  }

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
  local header_imports="import { Button } from '@/components/ui/button'"
  local header_auth_section=""
  local header_config_line=""
  
  if [ "$SKIP_CLERK" = false ]; then
    header_imports="import { Suspense } from 'react'
import { Show, SignInButton, UserButton } from '@clerk/nextjs'
import { getServiceConfig } from '@/lib/config-detector'
$header_imports"
    header_config_line=$'  const config = getServiceConfig();\n'
    header_auth_section="          {config.hasClerk ? (
            <Suspense>
              <Show when=\"signed-out\">
                <SignInButton>
                  <Button variant=\"outline\">Sign In</Button>
                </SignInButton>
              </Show>
              <Show when=\"signed-in\">
                <div className=\"flex items-center gap-3\">
                  <span className=\"text-sm text-gray-600\">Welcome back!</span>
                  <UserButton />
                </div>
              </Show>
            </Suspense>
          ) : (
            <Button variant=\"outline\">
              Get Started
            </Button>
          )}"
  else
    header_auth_section="          <Button variant=\"outline\">
            Get Started
          </Button>"
  fi
  
  cat > src/components/layout/header.tsx << EOF
$header_imports

export default function Header() {
$header_config_line  return (
    <header className="border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">A</span>
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            My App
          </h1>
        </div>
        <div>
$header_auth_section
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
  
  # Only create Convex provider if not skipped
  if [ "$SKIP_CONVEX" = false ]; then
    create_convex_provider
  fi
  
  if [ "$SKIP_CLERK" = false ]; then
    create_clerk_middleware
  fi
  
  create_components_structure
  create_status_components
  
  print_status "$GREEN" "✅ All configuration files created successfully"
}

# Function to create status indicator components
create_status_components() {
  print_status "$BLUE" "🎨 Creating status indicator components..."
  
  # Create the config detector utility first
  cat > src/lib/config-detector.ts << 'EOF'
export interface ServiceConfig {
  hasClerk: boolean;
  hasConvex: boolean;
  clerkPublishableKey?: string;
  convexUrl?: string;
}

export function detectClerkConfig(): boolean {
  if (typeof window !== 'undefined') {
    return !!(
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
      (window as unknown as Record<string, unknown>).__CLERK_PUBLISHABLE_KEY
    );
  }
  
  return !!(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
    process.env.CLERK_SECRET_KEY
  );
}

export function detectConvexConfig(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_CONVEX_URL ||
    process.env.CONVEX_DEPLOYMENT
  );
}

export function getServiceConfig(): ServiceConfig {
  const hasClerk = detectClerkConfig();
  const hasConvex = detectConvexConfig();
  
  return {
    hasClerk,
    hasConvex,
    clerkPublishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL,
  };
}

export function getMissingServices(): string[] {
  const config = getServiceConfig();
  const missing: string[] = [];
  
  if (!config.hasClerk) {
    missing.push('Clerk Authentication');
  }
  
  if (!config.hasConvex) {
    missing.push('Convex Database');
  }
  
  return missing;
}

export function isFullyConfigured(): boolean {
  const config = getServiceConfig();
  return config.hasClerk && config.hasConvex;
}
EOF

  # Create the status banner component
  cat > src/components/ui/status-banner.tsx << 'EOF'
'use client';

interface StatusBannerProps {
  hasClerk?: boolean;
  hasConvex?: boolean;
  className?: string;
}

export default function StatusBanner({ hasClerk = false, hasConvex = false, className = '' }: StatusBannerProps) {
  const missingServices: string[] = [];
  if (!hasClerk) missingServices.push('Authentication (Clerk)');
  if (!hasConvex) missingServices.push('Database (Convex)');

  if (missingServices.length === 0) {
    return (
      <div className={`bg-green-50 border border-green-200 rounded-lg p-4 mb-6 ${className}`}>
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 text-green-600">✅</div>
          <div>
            <h3 className="text-sm font-medium text-green-800">All Services Configured</h3>
            <p className="text-sm text-green-700">Your application is fully set up with authentication and database.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="h-5 w-5 text-amber-600 mt-0.5">⚠️</div>
        <div className="flex-1">
          <h3 className="text-sm font-medium text-amber-800">Configuration Required</h3>
          <p className="text-sm text-amber-700 mb-3">
            The following services need to be configured to unlock full functionality:
          </p>
          <div className="space-y-2">
            {!hasClerk && (
              <div className="flex items-center gap-2 text-sm">
                <div className="h-4 w-4 text-amber-600">🔐</div>
                <span className="text-amber-800">Authentication (Clerk) - User sign-in/sign-up</span>
              </div>
            )}
            {!hasConvex && (
              <div className="flex items-center gap-2 text-sm">
                <div className="h-4 w-4 text-amber-600">🗄️</div>
                <span className="text-amber-800">Database (Convex) - Real-time data storage</span>
              </div>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {!hasClerk && (
              <a
                href="https://clerk.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-3 py-1 rounded-md text-xs font-medium bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors"
              >
                Set up Clerk
              </a>
            )}
            {!hasConvex && (
              <a
                href="https://convex.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-3 py-1 rounded-md text-xs font-medium bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors"
              >
                Set up Convex
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
EOF

  print_status "$GREEN" "  ✅ Status indicator components created"
}

# Enhanced safe package installation with recovery
safe_npm_install() {
  local package=$1
  local max_retries=${2:-$MAX_RETRIES}
  local retry=0
  
  while [ $retry -lt $max_retries ]; do
    log_info "Installing $package (attempt $((retry + 1))/$max_retries)"
    
    if npm install "$package" --no-audit --no-fund; then
      log_info "Successfully installed $package"
      return 0
    fi
    
    retry=$((retry + 1))
    
    if [ $retry -lt $max_retries ]; then
      print_status "$YELLOW" "⚠️  Retry $retry/$max_retries for $package..."
      
      # Try different recovery strategies
      case $retry in
        1)
          print_status "$BLUE" "🔄 Trying with --legacy-peer-deps..."
          if npm install "$package" --legacy-peer-deps --no-audit --no-fund; then
            log_info "Successfully installed $package with --legacy-peer-deps"
            return 0
          fi
          ;;
        2)
          print_status "$BLUE" "🧹 Cleaning cache and retrying..."
          npm cache clean --force &> /dev/null || true
          ;;
      esac
      
      sleep $RETRY_DELAY
    fi
  done
  
  log_error "Failed to install $package after $max_retries attempts"
  return 1
}

# Function to verify installation integrity
verify_installation() {
  print_status "$BLUE" "🔍 Verifying installation integrity..."
  
  local errors=()
  
  # Check if package.json exists and is valid
  if [ ! -f "package.json" ]; then
    errors+=("package.json not found")
  else
    if ! node -e "JSON.parse(require('fs').readFileSync('package.json', 'utf8'))" 2>/dev/null; then
      errors+=("package.json is invalid")
    fi
  fi
  
  # Check if node_modules exists
  if [ ! -d "node_modules" ]; then
    errors+=("node_modules directory not found")
  fi
  
  # Check if key files were created
  local required_files=(
    "src/app/layout.tsx"
    "src/app/page.tsx"
    ".env.local"
    "src/lib/utils.ts"
  )
  
  for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
      errors+=("Required file missing: $file")
    fi
  done
  
  if [ ${#errors[@]} -ne 0 ]; then
    log_error "Installation verification failed"
    print_status "$RED" "❌ Installation verification failed:"
    for error in "${errors[@]}"; do
      print_status "$RED" "    - $error"
    done
    return 1
  fi
  
  print_status "$GREEN" "✅ Installation verification passed"
  log_info "Installation verification completed successfully"
  return 0
}

# STEP 5: Template Substitution Functions

# Function to create layout with dynamic app name
create_layout_file() {
  print_status "$BLUE" "🎨 Creating root layout with app branding..."
  
  # Build imports based on what's enabled
  local imports="import type { Metadata } from \"next\";
import { Inter } from \"next/font/google\";
import \"./globals.css\";"
  
  if [ "$SKIP_CLERK" = false ]; then
    imports="$imports
import { ClerkProvider } from '@clerk/nextjs'
import { readClerkRuntime, reportMissingClerk } from '../lib/clerk-runtime'"
  fi
  
  if [ "$SKIP_CONVEX" = false ]; then
    imports="$imports
import ConvexClientProvider from './ConvexClientProvider'"
  fi
  
  # Build keywords based on what's enabled
  local keywords="\"Next.js\", \"React\", \"TypeScript\""
  if [ "$SKIP_CONVEX" = false ]; then
    keywords="$keywords, \"Convex\""
  fi
  if [ "$SKIP_CLERK" = false ]; then
    keywords="$keywords, \"Clerk\""
  fi
  keywords="$keywords, \"$APP_NAME\""
  
  # Build the layout JSX based on what's enabled
  local layout_content="    <html lang=\"en\">
      <body className={inter.className}>"
  
  if [ "$SKIP_CONVEX" = false ]; then
    layout_content="$layout_content
        <ConvexClientProvider>"
  fi
  
  layout_content="$layout_content
        {children}"
  
  if [ "$SKIP_CONVEX" = false ]; then
    layout_content="$layout_content
        </ConvexClientProvider>"
  fi
  
  layout_content="$layout_content
      </body>
    </html>"
  
  # Create the complete layout file
  cat > src/app/layout.tsx << EOF
$imports

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "$APP_NAME",
  description: "A modern web application built with Next.js, powered by $APP_NAME",
  keywords: [$keywords],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
EOF

  # ClerkProvider throws when the publishable key is missing. The check is runtime.
  if [ "$SKIP_CLERK" = false ]; then
    cat >> src/app/layout.tsx << EOF
  const clerk = readClerkRuntime()
  const tree = (
$layout_content
  );

  if (clerk.configured) {
    return <ClerkProvider>{tree}</ClerkProvider>;
  }

  reportMissingClerk(clerk)
  return tree;
}
EOF
  else
    cat >> src/app/layout.tsx << EOF
  return (
$layout_content
  );
}
EOF
  fi

  print_status "$GREEN" "  ✅ Root layout (src/app/layout.tsx) created with app name: $APP_NAME"
}

# Function to create home page with dynamic content
create_home_page() {
  print_status "$BLUE" "🏠 Creating personalized home page..."
  
  # Build imports based on what's enabled
  local imports="import { Button } from '@/components/ui/button'"
  
  # Only include status banner and config detector if at least one service is enabled
  if [ "$SKIP_CLERK" = false ] || [ "$SKIP_CONVEX" = false ]; then
    imports="$imports
import StatusBanner from '@/components/ui/status-banner'
import { getServiceConfig } from '@/lib/config-detector'"
  fi
  
  if [ "$SKIP_CLERK" = false ]; then
    imports="import { Suspense } from 'react'
import { Show, SignInButton, UserButton } from '@clerk/nextjs'
$imports"
  fi
  
  # Build description based on what's enabled
  local description="Your modern web application is ready to go! Built with Next.js, TypeScript"
  if [ "$SKIP_CONVEX" = false ] && [ "$SKIP_CLERK" = false ]; then
    description="$description, and the latest tools."
  elif [ "$SKIP_CONVEX" = false ] || [ "$SKIP_CLERK" = false ]; then
    description="$description, and Tailwind CSS."
  else
    description="$description, and Tailwind CSS."
  fi
  
  # Build action buttons based on what's enabled
  local action_buttons=""
  if [ "$SKIP_CLERK" = false ]; then
    action_buttons="            {config.hasClerk ? (
              <Suspense>
                <Show when=\"signed-out\">
                  <SignInButton>
                    <Button size=\"lg\" className=\"bg-blue-600 hover:bg-blue-700\">
                      Get Started - Sign In
                    </Button>
                  </SignInButton>
                </Show>
                <Show when=\"signed-in\">
                  <div className=\"flex items-center gap-4\">
                    <span className=\"text-green-600 font-medium\">✅ You&apos;re signed in!</span>
                    <UserButton />
                  </div>
                </Show>
              </Suspense>
            ) : (
              <>
                <Button size=\"lg\" className=\"bg-blue-600 hover:bg-blue-700\">
                  Get Started
                </Button>
                <Button variant=\"outline\" size=\"lg\">
                  Learn More
                </Button>
              </>
            )}"
  else
    action_buttons="            <Button size=\"lg\" className=\"bg-blue-600 hover:bg-blue-700\">
              Get Started
            </Button>
            <Button variant=\"outline\" size=\"lg\">
              Learn More
            </Button>"
  fi
  
  # Build feature grid based on what's enabled
  local feature_grid=""
  if [ "$SKIP_CONVEX" = false ]; then
    feature_grid="$feature_grid            <div className=\"p-4 border rounded-lg\">
              <h3 className=\"font-semibold text-blue-600\">⚡ Convex</h3>
              <p className=\"text-sm text-gray-600\">Real-time database</p>
            </div>"
  else
    feature_grid="$feature_grid            <div className=\"p-4 border rounded-lg\">
              <h3 className=\"font-semibold text-blue-600\">⚡ Next.js</h3>
              <p className=\"text-sm text-gray-600\">React framework</p>
            </div>"
  fi
  
  if [ "$SKIP_CLERK" = false ]; then
    feature_grid="$feature_grid
            <div className=\"p-4 border rounded-lg\">
              <h3 className=\"font-semibold text-purple-600\">🔐 Clerk</h3>
              <p className=\"text-sm text-gray-600\">Authentication</p>
            </div>"
  else
    feature_grid="$feature_grid
            <div className=\"p-4 border rounded-lg\">
              <h3 className=\"font-semibold text-purple-600\">📘 TypeScript</h3>
              <p className=\"text-sm text-gray-600\">Type safety</p>
            </div>"
  fi
  
  feature_grid="$feature_grid
            <div className=\"p-4 border rounded-lg\">
              <h3 className=\"font-semibold text-green-600\">🎨 Tailwind</h3>
              <p className=\"text-sm text-gray-600\">Styling</p>
            </div>
            <div className=\"p-4 border rounded-lg\">
              <h3 className=\"font-semibold text-orange-600\">⚛️ React</h3>
              <p className=\"text-sm text-gray-600\">UI Framework</p>
            </div>"
  
  # Build final description based on what's enabled
  local final_description="Your application comes pre-configured with "
  local features=()
  if [ "$SKIP_CLERK" = false ]; then
    features+=("authentication")
  fi
  if [ "$SKIP_CONVEX" = false ]; then
    features+=("real-time database")
  fi
  features+=("TypeScript" "Tailwind CSS" "modern UI components")
  
  # Join features with commas and "and"
  if [ ${#features[@]} -eq 1 ]; then
    final_description="$final_description${features[0]}."
  elif [ ${#features[@]} -eq 2 ]; then
    final_description="$final_description${features[0]} and ${features[1]}."
  else
    local last_index=$((${#features[@]} - 1))
    local last_feature="${features[$last_index]}"
    unset features[$last_index]
    final_description="$final_description$(join_csv "${features[@]}"), and $last_feature."
  fi
  final_description="$final_description Start building your features right away!"
  
  # Build the page content conditionally
  local status_banner_section=""
  local config_usage=""
  
  if [ "$SKIP_CLERK" = false ] || [ "$SKIP_CONVEX" = false ]; then
    config_usage="  const config = getServiceConfig();"
    status_banner_section="      <StatusBanner 
        hasClerk={config.hasClerk} 
        hasConvex={config.hasConvex} 
        className=\"w-full max-w-4xl mb-8\"
      />"
  fi

  cat > src/app/page.tsx << EOF
$imports

export default function Home() {
$config_usage
  
  return (
    <main className="flex min-h-screen min-w-0 flex-col items-center justify-center p-6 sm:p-12 lg:p-24 [overflow-wrap:anywhere]">
$status_banner_section
      
      <div className="z-10 min-w-0 max-w-5xl w-full items-center justify-between gap-8 font-mono text-sm lg:flex">
        <div className="min-w-0 flex-1 text-center lg:text-left">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Welcome to $APP_NAME
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
            $description
          </p>
          <div className="flex min-w-0 flex-col sm:flex-row sm:flex-wrap gap-4 justify-center lg:justify-start [&_button]:min-h-11 [&_button]:min-w-0 [&_button]:max-w-full [&_button]:whitespace-normal">
$action_buttons
          </div>
        </div>
        
        <div className="mt-8 min-w-0 w-full lg:mt-0 lg:w-auto lg:flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-center">
$feature_grid
          </div>
        </div>
      </div>
      
      <div className="mt-16 min-w-0 w-full max-w-2xl text-center">
        <h2 className="text-2xl font-semibold mb-4">Ready to build with $APP_NAME?</h2>
        <p className="text-gray-600 dark:text-gray-300 max-w-2xl">
          $final_description
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
  
  # Build imports based on what's enabled
  local header_imports="import { Button } from '@/components/ui/button'"
  local header_auth_section=""
  local header_config_line=""
  
  if [ "$SKIP_CLERK" = false ]; then
    header_imports="import { Suspense } from 'react'
import { Show, SignInButton, UserButton } from '@clerk/nextjs'
import { getServiceConfig } from '@/lib/config-detector'
$header_imports"
    header_config_line=$'  const config = getServiceConfig();\n'
    header_auth_section="          {config.hasClerk ? (
            <Suspense>
              <Show when=\"signed-out\">
                <SignInButton>
                  <Button variant=\"outline\">Sign In</Button>
                </SignInButton>
              </Show>
              <Show when=\"signed-in\">
                <div className=\"flex items-center gap-3\">
                  <span className=\"text-sm text-gray-600\">Welcome back!</span>
                  <UserButton />
                </div>
              </Show>
            </Suspense>
          ) : (
            <Button variant=\"outline\">
              Get Started
            </Button>
          )}"
  else
    header_auth_section="          <Button variant=\"outline\">
            Get Started
          </Button>"
  fi
  
  cat > src/components/layout/header.tsx << EOF
$header_imports

export default function Header() {
$header_config_line  return (
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
$header_auth_section
        </div>
      </div>
    </header>
  )
}
EOF

  print_status "$GREEN" "  ✅ Header component updated with app branding"
}

# ${array[*]} joins on the first character of IFS, so IFS=', ' emits commas without spaces.
join_csv() {
  local joined=""
  local part
  for part in "$@"; do
    if [ -n "$joined" ]; then
      joined+=", "
    fi
    joined+="$part"
  done
  printf '%s' "$joined"
}

# Function to create package.json scripts section (template substitution example)
create_custom_scripts() {
  print_status "$BLUE" "📝 Adding custom scripts to package.json..."
  
  # Read current package.json and add custom scripts
  if [ -f "package.json" ]; then
    # Create a backup
    cp package.json package.json.backup
    
    # Build description based on what's enabled
    local description_parts=("Next.js")
    if [ "$SKIP_CONVEX" = false ]; then
      description_parts+=("Convex")
    fi
    if [ "$SKIP_CLERK" = false ]; then
      description_parts+=("Clerk")
    fi
    description_parts+=("TypeScript" "Tailwind CSS")
    
    local description="A modern web application: $APP_NAME - built with $(join_csv "${description_parts[@]}")"
    
    # Build scripts based on what's enabled
    local convex_scripts=""
    if [ "$SKIP_CONVEX" = false ]; then
      convex_scripts="'setup:convex': 'npx convex dev --once && node scripts/remove-convex-tsconfig-exclude.mjs',
        'deploy:$APP_NAME': 'npm run build && npx convex deploy',"
    fi
    
    # Use node to modify package.json with app-specific scripts
    node -e "
      const fs = require('fs');
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      
      // Add custom scripts with app name
      const newScripts = {
        ...pkg.scripts
      };
      
      // Add Convex scripts only if not skipped
      if ('$SKIP_CONVEX' === 'false') {
        newScripts['setup:convex'] = 'npx convex dev --once && node scripts/remove-convex-tsconfig-exclude.mjs';
        newScripts['deploy:$APP_NAME'] = 'npm run build && npx convex deploy';
      }
      
      pkg.scripts = newScripts;
      
      // Update description with app name and enabled features
      pkg.description = '$description';
      
      fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
    "
    
    if [ "$SKIP_CONVEX" = false ]; then
      mkdir -p scripts
      cat > scripts/remove-convex-tsconfig-exclude.mjs << 'EOF'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const generated =
  existsSync('convex/_generated/server.js') ||
  existsSync('convex/_generated/server.d.ts')

if (!generated) {
  console.log('convex/_generated is absent. tsconfig exclude left in place.')
  process.exit(0)
}

const file = 'tsconfig.json'

function isWhitespace(ch) {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r'
}

function skipComment(text, i) {
  if (text[i] !== '/') return i
  const n = text[i + 1]
  if (n === '/') {
    let j = i + 2
    while (j < text.length && text[j] !== '\n') j += 1
    return j
  }
  if (n === '*') {
    let j = i + 2
    while (j < text.length && !(text[j] === '*' && text[j + 1] === '/')) j += 1
    return j + 2
  }
  return i
}

function parseJsonc(text) {
  let out = ''
  let i = 0
  let hadComments = false
  while (i < text.length) {
    const c = text[i]
    const n = text[i + 1]
    if (c === '"') {
      out += c
      i += 1
      while (i < text.length) {
        const ch = text[i]
        out += ch
        i += 1
        if (ch === '\\' && i < text.length) {
          out += text[i]
          i += 1
          continue
        }
        if (ch === '"') break
      }
      continue
    }
    if (c === '/' && (n === '/' || n === '*')) {
      hadComments = true
      i = skipComment(text, i)
      continue
    }
    if (c === ',') {
      let j = i + 1
      while (j < text.length) {
        if (isWhitespace(text[j])) {
          j += 1
          continue
        }
        const afterComment = skipComment(text, j)
        if (afterComment === j) break
        hadComments = true
        j = afterComment
      }
      if (text[j] === '}' || text[j] === ']') {
        i += 1
        continue
      }
    }
    out += c
    i += 1
  }
  return { value: JSON.parse(out), hadComments }
}

try {
  const parsed = parseJsonc(readFileSync(file, 'utf8'))
  const ts = parsed.value
  const exclude = Array.isArray(ts.exclude) ? ts.exclude : []
  const next = exclude.filter((item) => item !== 'convex')
  if (next.length !== exclude.length) {
    ts.exclude = next
    writeFileSync(file, JSON.stringify(ts, null, 2) + '\n')
    console.log('Removed convex from tsconfig exclude.')
    if (parsed.hadComments) {
      console.warn('comments in tsconfig.json were removed')
    }
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.warn(`Left tsconfig.json unchanged (${message}). Remove "convex" from exclude by hand.`)
}
EOF
    fi

    print_status "$GREEN" "  ✅ Custom scripts added to package.json"
  else
    print_status "$YELLOW" "  ⚠️  package.json not found, skipping custom scripts"
  fi
}

# STEP 9: Template-specific functionality
apply_template_customizations() {
  case $TEMPLATE in
    minimal)
      print_status "$BLUE" "📋 Applying minimal template customizations..."
      # Minimal currently shares the default dependencies and components
      if [ "$VERBOSE" = true ]; then
        print_status "$CYAN" "   Minimal template: Same dependencies/components as default"
      fi
      ;;
    full)
      print_status "$BLUE" "📋 Applying full template customizations..."
      # Add extra features for full template
      if [ "$VERBOSE" = true ]; then
        print_status "$CYAN" "   Full template: Adding advanced features"
      fi
      create_additional_components
      ;;
    *)
      print_status "$BLUE" "📋 Applying default template customizations..."
      if [ "$VERBOSE" = true ]; then
        print_status "$CYAN" "   Default template: Standard feature set"
      fi
      ;;
  esac
}

# Function to create additional components for full template
create_additional_components() {
  print_status "$BLUE" "🔧 Creating additional components for full template..."
  
  # Create a loading component
  mkdir -p src/components/ui
  cat > src/components/ui/loading.tsx << 'EOF'
import { cn } from "@/lib/utils"

interface LoadingProps {
  className?: string
  size?: "sm" | "md" | "lg"
}

export function Loading({ className, size = "md" }: LoadingProps) {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6", 
    lg: "w-8 h-8"
  }

  return (
    <div className={cn("animate-spin rounded-full border-2 border-gray-300 border-t-blue-600", sizeClasses[size], className)} />
  )
}
EOF

  # Create an error boundary component
  cat > src/components/ui/error-boundary.tsx << 'EOF'
"use client"

import { Component, ReactNode } from "react"

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex items-center justify-center min-h-[200px] p-8">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-red-600 mb-2">Something went wrong</h2>
            <p className="text-gray-600">Please refresh the page and try again.</p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
EOF

  print_status "$GREEN" "  ✅ Additional components created for full template"
}

# Function to orchestrate all template substitution
create_template_files() {
  print_status "$BLUE" "🎯 Creating files with template substitution..."
  
  create_layout_file
  create_home_page
  update_header_component
  create_custom_scripts
  apply_template_customizations
  append_project_readme
  
  print_status "$GREEN" "✅ All template files created with personalized content"
}

append_project_readme() {
  if [ ! -f README.md ]; then
    return 0
  fi

  if [ "$SKIP_CLERK" = false ]; then
    cat >> README.md << 'EOF'

## Authentication without Clerk keys

Development starts when NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY or CLERK_SECRET_KEY is empty. Auth is off. The server logs one warning that names the missing key.

Production returns 503 for protected routes when either key is missing. Public routes stay available. Set ALLOW_NO_AUTH=true to serve protected routes without Clerk. The server logs a warning when that opt-in is set.
EOF
  fi

  if [ "$SKIP_CONVEX" = false ]; then
    cat >> README.md << 'EOF'

## Convex typecheck

next build excludes convex/ until Convex codegen exists. npm run setup:convex runs codegen and removes that exclude after convex/_generated exists. If tsconfig.json has comments, that rewrite removes them and prints "comments in tsconfig.json were removed". If you run npx convex dev yourself, run node scripts/remove-convex-tsconfig-exclude.mjs afterward.
EOF
  fi
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

  # Next typechecks every included .ts file. convex/_generated is created by
  # `npx convex dev`, which needs a Convex login this script does not have.
  if [ ! -f convex/_generated/server.js ] && [ ! -f convex/_generated/server.d.ts ]; then
    node << 'EOF'
const fs = require("fs");
const file = "tsconfig.json";
const ts = JSON.parse(fs.readFileSync(file, "utf8"));
const exclude = Array.isArray(ts.exclude) ? ts.exclude.slice() : [];
if (!exclude.includes("convex")) exclude.push("convex");
ts.exclude = exclude;
fs.writeFileSync(file, JSON.stringify(ts, null, 2) + "\n");
EOF
  fi

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

# Function to create Clerk proxy (Next.js 16 file convention, formerly middleware.ts)
create_clerk_middleware() {
  print_status "$BLUE" "🔐 Creating Clerk proxy..."

  mkdir -p src/lib
  cat > src/lib/clerk-runtime.ts << 'EOF'
export type ClerkKeyName =
  | 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'
  | 'CLERK_SECRET_KEY'

export type ClerkRuntime = {
  configured: boolean
  missing: ClerkKeyName[]
  production: boolean
  allowNoAuth: boolean
}

const clerkKeys: ClerkKeyName[] = [
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'CLERK_SECRET_KEY',
]

// Next inlines process.env.NAME at build time. A computed key is read on each call.
function runtimeEnv(name: string): string {
  const value = process.env[name]
  return typeof value === 'string' ? value.trim() : ''
}

export function readClerkRuntime(): ClerkRuntime {
  const missing = clerkKeys.filter((name) => runtimeEnv(name) === '')
  return {
    configured: missing.length === 0,
    missing,
    production: runtimeEnv('NODE_ENV') === 'production',
    allowNoAuth: runtimeEnv('ALLOW_NO_AUTH') === 'true',
  }
}

const reportedKey = '__clerkAuthReported'

export function reportMissingClerk(clerk: ClerkRuntime): void {
  if (clerk.configured) return
  const globalState = globalThis as Record<string, unknown>
  if (globalState[reportedKey]) return
  globalState[reportedKey] = true

  const missing = clerk.missing.join(', ')
  if (!clerk.production) {
    console.warn(`[auth] Clerk auth is off in development. Missing ${missing}.`)
    return
  }
  if (clerk.allowNoAuth) {
    console.warn(`[auth] ALLOW_NO_AUTH=true. Clerk auth is off in production. Missing ${missing}.`)
    return
  }
  console.error(
    `[auth] Clerk auth is off in production. Missing ${missing}. Protected routes return 503. Set both Clerk keys, or set ALLOW_NO_AUTH=true to allow this.`
  )
}
EOF

  cat > src/proxy.ts << 'EOF'
import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server'
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { readClerkRuntime, reportMissingClerk } from './lib/clerk-runtime'

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)'
])

const handleClerk = clerkMiddleware(async (auth, request) => {
  // Protect all routes that are not public
  if (!isPublicRoute(request)) {
    await auth.protect()
  }
})

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  const clerk = readClerkRuntime()
  if (clerk.configured) {
    return handleClerk(request, event)
  }

  reportMissingClerk(clerk)
  if (clerk.production && !clerk.allowNoAuth && !isPublicRoute(request)) {
    return new NextResponse('Auth not configured', { status: 503 })
  }
  return NextResponse.next()
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ]
}
EOF

  print_status "$GREEN" "  ✅ Clerk proxy (src/proxy.ts) created"
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

# Main execution function with enhanced error handling, progress tracking, and portability
main() {
  local total_steps=10  # Added environment detection step
  local start_time=$(date +%s)
  
  # Initialize logging
  log_info "Starting Next.js project setup script v${SCRIPT_VERSION}"
  log_info "App name: $APP_NAME"
  log_info "Template: $TEMPLATE"
  log_info "Options: SKIP_CONVEX=$SKIP_CONVEX, SKIP_CLERK=$SKIP_CLERK, VERBOSE=$VERBOSE, FORCE=$FORCE"
  log_info "Started at: $(date '+%Y-%m-%d %H:%M:%S')"
  
  print_status "$BLUE" "🚀 Next.js Starter Script v${SCRIPT_VERSION} (Portable & Professional)"
  print_status "$BLUE" "=================================================================="
  print_status "$BLUE" "Creating: $APP_NAME"
  print_status "$BLUE" "Template: $TEMPLATE"
  print_status "$BLUE" "Started at: $(date '+%Y-%m-%d %H:%M:%S')"
      print_status "$BLUE" "Logging to: setup.log (if writable)"
  
  if [ "$VERBOSE" = true ]; then
    print_status "$CYAN" "🔧 Configuration:"
    print_status "$CYAN" "   Skip Convex: $SKIP_CONVEX"
    print_status "$CYAN" "   Skip Clerk: $SKIP_CLERK"
    print_status "$CYAN" "   Force mode: $FORCE"
    print_status "$CYAN" "   Verbose: $VERBOSE"
  fi
  
  echo ""
  
  # Step 0: Environment Detection
  detect_environment
  echo ""
  
  # Run prerequisite checks
  check_prerequisites
  
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
  
  # Step 6: Database Schema (conditional)
  if [ "$SKIP_CONVEX" = false ]; then
    step_start=$(date +%s)
    show_progress 6 $total_steps "📊 Setting up database schema..."
    if create_convex_schema && create_convex_functions; then
      local step_duration=$(($(date +%s) - step_start))
      show_step_complete "Database schema setup" $step_duration
    else
      handle_step_error 6 "Database schema setup" "Failed to create Convex schema"
    fi
  else
    show_progress 6 $total_steps "📊 Skipping database schema (--skip-convex)..."
    print_status "$YELLOW" "  ⏭️  Convex setup skipped as requested"
  fi
  echo ""
  
  # Step 7: External Tools (conditional)
  if [ "$SKIP_CONVEX" = false ]; then
    step_start=$(date +%s)
    show_progress 7 $total_steps "⚡ Initializing external tools..."
    if create_convex_config && update_env_with_convex_instructions; then
      local step_duration=$(($(date +%s) - step_start))
      show_step_complete "External tools initialization" $step_duration
    else
      handle_step_error 7 "External tools initialization" "Failed to initialize tools"
    fi
  else
    show_progress 7 $total_steps "⚡ Skipping external tools (--skip-convex)..."
    print_status "$YELLOW" "  ⏭️  External tools setup skipped as requested"
  fi
  echo ""
  
  # Step 8: Verification
  step_start=$(date +%s)
  show_progress 8 $total_steps "🔍 Verifying installation..."
  if verify_installation; then
    local step_duration=$(($(date +%s) - step_start))
    show_step_complete "Installation verification" $step_duration
  else
    handle_step_error 8 "Installation verification" "Some files may be missing or corrupted"
    print_status "$YELLOW" "⚠️  Continuing with setup, but please check the installation manually"
  fi
  echo ""
  
  # Step 9: Template-specific features
  step_start=$(date +%s)
  show_progress 9 $total_steps "🎨 Applying template customizations..."
  apply_template_customizations
  local step_duration=$(($(date +%s) - step_start))
  show_step_complete "Template customizations" $step_duration
  echo ""
  
  # Step 10: Finalization
  step_start=$(date +%s)
  show_progress 10 $total_steps "✅ Finalizing setup..."
  local total_duration=$(($(date +%s) - start_time))
  local minutes=$((total_duration / 60))
  local seconds=$((total_duration % 60))
  
  # Log completion
  log_info "Setup completed successfully in ${total_duration}s"
  
  # Add timing info to completion message
  print_status "$GREEN" "  ✅ Setup completed in ${minutes}m ${seconds}s"
  echo ""
  show_enhanced_completion_message
}

# ============================================================================
# STEP 10: PUT IT ALL TOGETHER - Complete Script Structure
# ============================================================================

# STEP 10: Script Self-Test Function (Production Ready Feature)
script_self_test() {
  print_status "$BLUE" "🧪 Running script self-test..."
  
  local test_failures=0
  
  # Test 1: Check all required functions exist
  local required_functions=(
    "parse_arguments" "show_help" "show_version" "validate_app_name"
    "check_prerequisites" "detect_environment" "check_network"
    "create_nextjs_app" "install_dependencies" "create_config_files"
    "create_template_files" "verify_installation" "show_enhanced_completion_message"
  )
  
  for func in "${required_functions[@]}"; do
    if ! declare -f "$func" > /dev/null; then
      print_status "$RED" "  ❌ Missing function: $func"
      ((test_failures++))
    fi
  done
  
  # Test 2: Check script permissions
  if [ ! -x "$0" ]; then
    print_status "$RED" "  ❌ Script is not executable"
    ((test_failures++))
  fi
  
  # Test 3: Check required commands
  local required_commands=("node" "npm" "npx")
  for cmd in "${required_commands[@]}"; do
    if ! command -v "$cmd" &> /dev/null; then
      print_status "$RED" "  ❌ Missing command: $cmd"
      ((test_failures++))
    fi
  done
  
  # Test 4: Validate script variables
  if [ -z "${SCRIPT_VERSION:-}" ]; then
    print_status "$RED" "  ❌ SCRIPT_VERSION not set"
    ((test_failures++))
  fi

  local ping_stub_dir
  local saved_path
  local stub_dir
  local portfile
  local logfile
  local port
  local ready
  local i
  local check_out
  ping_stub_dir=$(mktemp -d)
  SELF_TEST_PING_DIR="$ping_stub_dir"
  printf '%s\n' '#!/bin/sh' 'exit 1' > "$ping_stub_dir/ping"
  chmod +x "$ping_stub_dir/ping"
  saved_path="$PATH"

  # Security regression: a registry value must never become a curl option or
  # inject another directive into the curl config provided over stdin.
  if ( npm_config_registry='-K./payload' npm_registry_reachable ) >/dev/null 2>&1 ||
     ( npm_config_registry='http://safe.example/"' npm_registry_reachable ) >/dev/null 2>&1 ||
     ( npm_config_registry=$'http://safe.example/\nurl = "https://attacker.example"' npm_registry_reachable ) >/dev/null 2>&1; then
    print_status "$RED" "  ❌ Unsafe registry accepted"
    test_failures=$((test_failures + 1))
  else
    print_status "$GREEN" "  ✅ Unsafe registry values rejected"
  fi

  if [ "$(mask_registry 'https://u:FAKE@PW@host.example/npm/@scope/')" != 'https://***@host.example/npm/@scope/' ] ||
     [ "$(mask_registry 'https://host.example/npm/@scope/')" != 'https://host.example/npm/@scope/' ]; then
    print_status "$RED" "  ❌ Registry masking failed"
    test_failures=$((test_failures + 1))
  else
    print_status "$GREEN" "  ✅ Registry passwords and scoped paths masked safely"
  fi

  if [ "$(NPM_CONFIG_REGISTRY='http://upper.example/' npm_config_registry='http://lower.example/' configured_registry)" != 'http://upper.example/' ]; then
    print_status "$RED" "  ❌ npm registry environment precedence mismatch"
    test_failures=$((test_failures + 1))
  else
    print_status "$GREEN" "  ✅ npm registry environment precedence respected"
  fi

  if ( no_proxy="127.0.0.1,localhost" NO_PROXY="127.0.0.1,localhost" npm_config_registry="http://127.0.0.1:9" check_prerequisites >/dev/null ); then
    print_status "$RED" "  ❌ Unreachable registry was reported reachable"
    test_failures=$((test_failures + 1))
  else
    print_status "$GREEN" "  ✅ Unreachable registry check fails"
  fi

  if ! command -v python3 >/dev/null 2>&1; then
    print_status "$YELLOW" "  ⚠️  Local registry checks skipped: python3 is not installed"
  else
    stub_dir=$(mktemp -d)
    SELF_TEST_STUB_DIR="$stub_dir"
    portfile="$stub_dir/port"
    logfile="$stub_dir/requests"
    cat > "$stub_dir/server.py" <<'PY'
from http.server import BaseHTTPRequestHandler, HTTPServer
import sys

portfile = sys.argv[1]
logfile = sys.argv[2]

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        auth = self.headers.get("Authorization", "")
        with open(logfile, "a") as handle:
            handle.write(self.path + " " + auth + "\n")
        code = 401 if self.path.startswith("/private") else 200
        body = b"{}"
        self.send_response(code)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        return

server = HTTPServer(("127.0.0.1", 0), Handler)
with open(portfile, "w") as handle:
    handle.write(str(server.server_address[1]))
server.serve_forever()
PY
    python3 "$stub_dir/server.py" "$portfile" "$logfile" >"$stub_dir/server.out" 2>&1 &
    SELF_TEST_STUB_PID=$!
    ready=0
    i=0
    while [ "$i" -lt 5 ]; do
      if [ -s "$portfile" ]; then
        ready=1
        break
      fi
      sleep 1
      i=$((i + 1))
    done
    if [ "$ready" -ne 1 ]; then
      print_status "$RED" "  ❌ Local registry stub did not start"
      test_failures=$((test_failures + 1))
    else
      port=$(cat "$portfile")
      # Let npm resolve project-root .npmrc, inline comments and userconfig.
      mkdir -p "$stub_dir/project/src"
      printf '{"private":true}\n' > "$stub_dir/project/package.json"
      printf 'registry = http://127.0.0.1:%s/ ; comment\n' "$port" > "$stub_dir/project/.npmrc"
      local project_registry
      project_registry=$(cd "$stub_dir/project/src" && unset NPM_CONFIG_REGISTRY npm_config_registry && configured_registry) || project_registry=""
      if [ "$project_registry" != "http://127.0.0.1:$port/" ]; then
        print_status "$RED" "  ❌ Project .npmrc resolution failed"
        test_failures=$((test_failures + 1))
      else
        print_status "$GREEN" "  ✅ Project .npmrc and inline comments resolved by npm"
      fi

      printf 'registry=http://127.0.0.1:%s/private\n' "$port" > "$stub_dir/custom.npmrc"
      local custom_registry
      custom_registry=$(cd "$stub_dir" && unset NPM_CONFIG_REGISTRY npm_config_registry && NPM_CONFIG_USERCONFIG="$stub_dir/custom.npmrc" npm_config_userconfig="$stub_dir/custom.npmrc" configured_registry) || custom_registry=""
      if [ "$custom_registry" != "http://127.0.0.1:$port/private" ]; then
        print_status "$RED" "  ❌ NPM_CONFIG_USERCONFIG registry not honored"
        test_failures=$((test_failures + 1))
      else
        print_status "$GREEN" "  ✅ NPM_CONFIG_USERCONFIG honored"
      fi
      PATH="$ping_stub_dir:$PATH"
      if ( no_proxy="127.0.0.1,localhost" NO_PROXY="127.0.0.1,localhost" npm_config_registry="http://127.0.0.1:${port}/" check_prerequisites >/dev/null ); then
        print_status "$GREEN" "  ✅ Registry check passes when ping fails"
      else
        print_status "$RED" "  ❌ Registry check failed when ping fails"
        test_failures=$((test_failures + 1))
      fi
      PATH="$saved_path"

      check_out=$(no_proxy="127.0.0.1,localhost" NO_PROXY="127.0.0.1,localhost" npm_config_registry="http://127.0.0.1:${port}/" check_network 2>&1) || true
      if printf '%s\n' "$check_out" | grep -F "127.0.0.1:${port}" >/dev/null; then
        print_status "$GREEN" "  ✅ Local registry check passes"
      else
        print_status "$RED" "  ❌ Local registry check failed"
        test_failures=$((test_failures + 1))
      fi

      check_out=$(no_proxy="127.0.0.1,localhost" NO_PROXY="127.0.0.1,localhost" npm_config_registry="http://127.0.0.1:${port}/private" check_network 2>&1) || true
      if printf '%s\n' "$check_out" | grep -F "127.0.0.1:${port}/private" >/dev/null; then
        print_status "$GREEN" "  ✅ HTTP 401 registry check passes"
      else
        print_status "$RED" "  ❌ HTTP 401 registry check failed"
        test_failures=$((test_failures + 1))
      fi

      : > "$logfile"
      check_out=$(no_proxy="127.0.0.1,localhost" NO_PROXY="127.0.0.1,localhost" npm_config_registry="http://user:s3cret@127.0.0.1:${port}/" check_network 2>&1) || true
      if printf '%s\n' "$check_out" | grep -F "s3cret" >/dev/null; then
        print_status "$RED" "  ❌ Credentialed registry printed secrets"
        test_failures=$((test_failures + 1))
      elif printf '%s\n' "$check_out" | grep -F "***@127.0.0.1:${port}" >/dev/null \
        && grep -F "Basic" "$logfile" >/dev/null; then
        print_status "$GREEN" "  ✅ Credentialed registry check passes"
      else
        print_status "$RED" "  ❌ Credentialed registry check failed"
        test_failures=$((test_failures + 1))
      fi

      : > "$logfile"
      check_out=$(no_proxy="127.0.0.1,localhost" NO_PROXY="127.0.0.1,localhost" npm_config_registry="http://user:p%40ss@127.0.0.1:${port}/" check_network 2>&1) || true
      if printf '%s\n' "$check_out" | grep -F "p%40ss" >/dev/null; then
        print_status "$RED" "  ❌ Percent-encoded registry password leaked to output"
        test_failures=$((test_failures + 1))
      elif printf '%s\n' "$check_out" | grep -F "***@127.0.0.1:${port}" >/dev/null \
        && grep -F "Basic" "$logfile" >/dev/null; then
        print_status "$GREEN" "  ✅ Encoded @ password was masked and authenticated"
      else
        print_status "$RED" "  ❌ Encoded @ password test failed"
        test_failures=$((test_failures + 1))
      fi

      : > "$logfile"
      check_out=$(no_proxy="127.0.0.1,localhost" NO_PROXY="127.0.0.1,localhost" npm_config_registry="http://user:p@ss@127.0.0.1:${port}/" check_network 2>&1) || true
      if printf '%s\n' "$check_out" | grep -F 'p@ss' >/dev/null; then
        print_status "$RED" "  ❌ Raw @ password leaked"
        test_failures=$((test_failures + 1))
      elif printf '%s\n' "$check_out" | grep -F "***@127.0.0.1:${port}" >/dev/null \
        && grep -F "Basic" "$logfile" >/dev/null; then
        print_status "$GREEN" "  ✅ Raw @ credentialed registry falls back to npm"
      else
        print_status "$RED" "  ❌ Raw @ registry npm fallback failed"
        test_failures=$((test_failures + 1))
      fi
    fi
  fi
  cleanup_self_test_resources
  
  # Report results
  if [ $test_failures -eq 0 ]; then
    print_status "$GREEN" "  ✅ All self-tests passed"
    return 0
  else
    print_status "$RED" "  ❌ $test_failures test(s) failed"
    return 1
  fi
}

# Function to source all our functions (for organization)
source_functions() {
  # All functions are already defined above in logical order:
  # 1. Configuration and setup functions
  # 2. Utility and helper functions  
  # 3. Validation functions
  # 4. Core functionality functions
  # 5. Template and file creation functions
  # 6. Progress and UI functions
  # 7. Main execution function
  
  log_info "All functions loaded and ready"
  
  # Run self-test in verbose mode
  if [ "$VERBOSE" = true ]; then
    script_self_test
  fi
}

# STEP 10.1: Complete Script Structure - Main Execution Flow
main_execution() {
  # Source all functions (they're already defined above)
  source_functions
  
  # Parse command line arguments
  parse_arguments "$@"

  require_valid_app_name_format "$APP_NAME"
  
  # Show dry run summary if requested (exits if dry run)
  show_dry_run_summary
  
  # Validate the app name with enhanced options
  validate_app_name "$APP_NAME"
  
  # Execute the main workflow with comprehensive error handling
  if ! main; then
    log_error "Main execution failed"
    exit 1
  fi
  
  # Final success message
  log_info "Script execution completed successfully"
}

# ============================================================================
# SCRIPT ENTRY POINT - This is where everything starts
# ============================================================================

# Welcome message for verbose mode
if [[ "${1:-}" == "--verbose" ]] || [[ "${2:-}" == "--verbose" ]] || [[ "${3:-}" == "--verbose" ]]; then
  echo "🚀 Next.js Starter Script v${SCRIPT_VERSION} - Starting..."
  echo "📝 Initializing with arguments: $*"
fi

# Run the complete script
main_execution "$@"

# ============================================================================
# END OF SCRIPT
# ============================================================================

# Final status for verbose mode
if [ "$VERBOSE" = true ]; then
  echo ""
  echo "🎯 Script execution completed at: $(date '+%Y-%m-%d %H:%M:%S')"
  echo "📊 Check setup.log for detailed execution log (if available)"
fi 