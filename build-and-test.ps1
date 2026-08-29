# Octomux Local Build & Test Script (PowerShell)
# This script builds the TypeScript project, runs the test suite, links the package locally, and runs a sanity check.

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  octomux (omx) - Build and Local Installation Test  " -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

# Step 1: Typecheck
Write-Host "`n[1/4] Running TypeScript typecheck..." -ForegroundColor Yellow
npm run typecheck
if ($LASTEXITCODE -ne 0) {
    Write-Host "Typecheck failed! Aborting." -ForegroundColor Red
    exit 1
}
Write-Host "✔ Typecheck passed!" -ForegroundColor Green

# Step 2: Run Unit Tests
Write-Host "`n[2/4] Running Vitest unit tests..." -ForegroundColor Yellow
npm test
if ($LASTEXITCODE -ne 0) {
    Write-Host "Unit tests failed! Aborting." -ForegroundColor Red
    exit 1
}
Write-Host "✔ All unit tests passed!" -ForegroundColor Green

# Step 3: Build Package with tsup
Write-Host "`n[3/4] Building production bundle..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed! Aborting." -ForegroundColor Red
    exit 1
}
Write-Host "✔ Build succeeded in ./dist!" -ForegroundColor Green

# Step 4: Link globally for testing
Write-Host "`n[4/4] Linking octomux and omx commands globally via npm link..." -ForegroundColor Yellow
npm link
if ($LASTEXITCODE -ne 0) {
    Write-Host "npm link failed!" -ForegroundColor Red
    exit 1
}
Write-Host "✔ 'octomux' and 'omx' are now linked globally!" -ForegroundColor Green

Write-Host "`n======================================================" -ForegroundColor Green
Write-Host "  Sanity Check Output:                               " -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Green

node dist/bin/octomux.js --help

Write-Host "`n======================================================" -ForegroundColor Cyan
Write-Host "🎉 Setup Complete! You can now run:" -ForegroundColor Cyan
Write-Host "   - 'omx'             (Interactive command center)" -ForegroundColor White
Write-Host "   - 'omx status'      (Check active identities)" -ForegroundColor White
Write-Host "   - 'omx account add' (Add a new GitHub profile)" -ForegroundColor White
Write-Host "   - 'omx ls'          (List configured accounts)" -ForegroundColor White
Write-Host "======================================================" -ForegroundColor Cyan
