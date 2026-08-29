#!/usr/bin/env bash

# Octomux Safe Uninstallation Script (Bash)
# Works on Linux, macOS, and Windows (Git Bash / WSL)

set -e

echo -e "\033[1;33m======================================================\033[0m"
echo -e "\033[1;33m         octomux (omx) - Safe Uninstallation         \033[0m"
echo -e "\033[1;33m======================================================\033[0m"

# Step 1: Run built-in cleanup
if [ -f "dist/bin/octomux.js" ]; then
    node dist/bin/octomux.js uninstall
else
    echo -e "\033[1;33mdist/bin/octomux.js not found, building first...\033[0m"
    npm run build
    node dist/bin/octomux.js uninstall
fi

# Step 2: Unlink globally from npm
echo -e "\n\033[1;33m[Unlinking npm global links]...\033[0m"
npm unlink -g octomux || true
echo -e "\033[1;32m✔ 'octomux' and 'omx' global binary links removed!\033[0m"

echo -e "\n\033[1;32m======================================================\033[0m"
echo -e "\033[1;32m🎉 Uninstallation complete! All configurations cleaned.\033[0m"
echo -e "\033[1;32m======================================================\033[0m"
