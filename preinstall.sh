#!/bin/bash

# Exit on any error
set -e

echo "=== PREINSTALL SCRIPT STARTED ==="

# Remove pnpm completely
echo "Removing pnpm..."
rm -rf $(which pnpm) 2>/dev/null || true
rm -rf ~/.pnpm-store 2>/dev/null || true
rm -rf ~/.pnpm 2>/dev/null || true

# Set npm config
echo "Configuring npm..."
npm config set user-agent "npm/10.0.0 node/v20.10.0 linux x64"
npm config set prefer-offline true
npm config set fund false
npm config set audit false

# Clean up
echo "Cleaning up..."
rm -rf node_modules 2>/dev/null || true
rm -f package-lock.json 2>/dev/null || true

# Verify npm is available
echo "Verifying npm..."
npm -v

echo "=== PREINSTALL SCRIPT COMPLETED ==="
