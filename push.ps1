<#
    .SYNOPSIS
    Automated Gallery Updater for Q Project (push.ps1) - Version 3
#>

# 1. SETUP & LOCATION
Set-Location $PSScriptRoot
Write-Host "--- Q GALLERY AUTOMATION V3 ---" -ForegroundColor Green

# CONFIG
$extensions = @(".png", ".jpg", ".jpeg", ".mp4", ".webm", ".gif")
$repoUrl = "https://github.com/MansfieldPlumbing/art4quinn.git"

# CHECK TOKEN
if (-not $env:GITHUB_PAT) {
    Write-Warning "GITHUB_PAT environment variable is MISSING."
    Write-Warning "You may need to enter credentials manually, or restart your terminal if you just set it."
}

# 2. FIND HIGHEST EXISTING NUMBER
$existingFiles = Get-ChildItem | Where-Object { $_.Name -match "^Q(\d{6})" }
$maxNum = 0
foreach ($file in $existingFiles) {
    if ($file.Name -match "^Q(\d{6})") {
        $num = [int]$matches[1]
        if ($num -gt $maxNum) { $maxNum = $num }
    }
}
Write-Host "Current highest ID is: Q$("{0:D6}" -f $maxNum)" -ForegroundColor Yellow

# 3. FIND & RENAME NEW FILES
$newFiles = Get-ChildItem | Where-Object { 
    ($extensions -contains $_.Extension.ToLower()) -and 
    ($_.Name -notmatch "^Q\d{6}") -and
    ($_.Name -ne "icon.png")
} | Sort-Object CreationTime

if ($newFiles.Count -gt 0) {
    Write-Host "Found $($newFiles.Count) new files to process..." -ForegroundColor Cyan
    foreach ($file in $newFiles) {
        $maxNum++
        $newName = "Q{0:D6}{1}" -f $maxNum, $file.Extension.ToLower()
        try {
            Rename-Item -Path $file.FullName -NewName $newName -ErrorAction Stop
            Write-Host "Renamed: $($file.Name) -> $newName" -ForegroundColor Gray
        } catch {
            Write-Error "Failed to rename $($file.Name). Check if file is open."
            exit
        }
    }
}

# 4. RUN PYTHON INDEXER (USING UV)
Write-Host "`nUpdating CSV Index..." -ForegroundColor Green
try {
    uv run generate_lot.py
} catch {
    Write-Error "UV execution failed. Is uv installed?"
    exit
}

# 5. SYNC WITH GITHUB (PULL THEN PUSH)
Write-Host "`nSyncing with GitHub..." -ForegroundColor Green

# Prepare Auth URL
if ($env:GITHUB_PAT) {
    $authUrl = $repoUrl.Replace("https://", "https://$($env:GITHUB_PAT)@")
} else {
    $authUrl = $repoUrl
}

# A. COMMIT LOCAL CHANGES
$status = git status --porcelain
if ($status) {
    git add .
    git commit -m "Auto-Update: Added new content and updated index"
    Write-Host "Local changes committed." -ForegroundColor Gray
}

# B. PULL REMOTE CHANGES (Fixes 'fetch first' errors)
Write-Host "Pulling latest changes..." -ForegroundColor Gray
git pull $authUrl
if ($LASTEXITCODE -ne 0) {
    Write-Warning "Pull encountered an issue (likely a merge conflict). Trying to push anyway..."
}

# C. PUSH TO REMOTE
Write-Host "Pushing to GitHub..." -ForegroundColor Gray
git push $authUrl

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nSUCCESS! Gallery is live." -ForegroundColor Green
} else {
    Write-Host "`nGit Push failed." -ForegroundColor Red
}

# Pause so you can see the result
Write-Host "`nDone."
Read-Host "Press Enter to close"