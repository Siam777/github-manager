#!/usr/bin/env bash

# Octomux Local Build & Test Script (Bash)
# Works on Linux, macOS, and Windows (Git Bash / WSL)

set -e

echo -e "\033[1;36m======================================================\033[0m"
echo -e "\033[1;36m  octomux (omx) - Build & Local Installation Test    \033[0m"
echo -e "\033[1;36m======================================================\033[0m"

echo -e "\n\033[1;33m[1/4] Running TypeScript typecheck...\033[0m"
npm run typecheck
echo -e "\033[1;32m✔ Typecheck passed!\033[0m"

echo -e "\n\033[1;33m[2/4] Running Vitest unit tests...\033[0m"
npm test
echo -e "\033[1;32m✔ All unit tests passed!\033[0m"

echo -e "\n\033[1;33m[3/4] Building production bundle...\033[0m"
npm run build
echo -e "\033[1;32m✔ Build succeeded in ./dist!\033[0m"

echo -e "\n\033[1;33m[4/4] Linking octomux & omx commands globally via npm link...\033[0m"
npm link
echo -e "\033[1;32m✔ 'octomux' and 'omx' are now linked globally!\033[0m"

echo -e "\n\033[1;32m======================================================\033[0m"
echo -e "\033[1;32m  Sanity Check Output:                               \033[0m"
echo -e "\033[1;32m======================================================\033[0m"

node dist/bin/octomux.js --help

echo -e "\n\033[1;36m======================================================\033[0m"
echo -e "\033[1;36m🎉 Setup Complete! You can now run:\033[0m"
echo -e "   \033[1;37m- 'omx'             (Interactive command center)\033[0m"
echo -e "   \033[1;37m- 'omx status'      (Check active identities)\033[0m"
echo -e "   \033[1;37m- 'omx account add' (Add a new GitHub profile)\033[0m"
echo -e "   \033[1;37m- 'omx ls'          (List configured accounts)\033[0m"
echo -e "\033[1;36m======================================================\033[0m"
