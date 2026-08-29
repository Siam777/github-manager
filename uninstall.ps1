# Octomux Safe Uninstallation Script (PowerShell)
# This script runs the built-in safe cleanup and unlinks the package globally.

Write-Host "======================================================" -ForegroundColor Yellow
Write-Host "         octomux (omx) - Safe Uninstallation         " -ForegroundColor Yellow
Write-Host "======================================================" -ForegroundColor Yellow

# Step 1: Run the built-in octomux clean up
if (Test-Path "dist/bin/octomux.js") {
    node dist/bin/octomux.js uninstall
} else {
    Write-Host "dist/bin/octomux.js not found, building first..." -ForegroundColor Yellow
    npm run build
    node dist/bin/octomux.js uninstall
}

# Step 2: Unlink globally from npm
Write-Host "`n[Unlinking npm global links]..." -ForegroundColor Yellow
npm unlink -g octomux
Write-Host "✔ 'octomux' and 'omx' global binary links removed!" -ForegroundColor Green

Write-Host "`n======================================================" -ForegroundColor Green
Write-Host "🎉 Uninstallation complete! All configurations cleaned." -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Green
