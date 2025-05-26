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

# Check if user provided an app name
if [ -z "$1" ]; then
  echo "❌ Error: Please provide an app name"
  echo "Usage: $0 <app-name>"
  exit 1
fi

APP_NAME="$1"
validate_app_name "$APP_NAME"

echo "✅ Creating app: $APP_NAME" 