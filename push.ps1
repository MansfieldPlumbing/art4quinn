<#
    .SYNOPSIS
    Automated Gallery Updater for Q Project (push.ps1) - Version 4 (Conflict Proof)
#>

# 1. SETUP & LOCATION
Set-Location $PSScriptRoot
Write-Host "--- Q GALLERY AUTOMATION V4 ---" -ForegroundColor Green

# CONFIG
$extensions = @(".png", ".jpg", ".jpeg", ".mp4", ".webm", ".gif")
$repoUrl = "https://github.com/MansfieldPlumbing/art4quinn.git"

# CHECK TOKEN (With Fallback)
if (-not $env:GITHUB_PAT) {
    Write-Warning "GITHUB_PAT env var is missing in this session."
    $manualToken = Read-Host "Please paste your GitHub Token here (or press Enter to try manual login)"
    if ($manualToken) {
        $env:GITHUB_PAT = $manualToken
    }
}

# 2. FIND & RENAME NEW FILES
# We do this first so new files are ready
$existingFiles = Get-ChildItem | Where-Object { $_.Name -match "^Q(\d{6})" }
$maxNum = 0
foreach ($file in $existingFiles) {
    if ($file.Name -match "^Q(\d{6})") {
        $num = [int]$matches[1]
        if ($num -gt $maxNum) { $maxNum = $num }
    }
}

$newFiles = Get-ChildItem | Where-Object { 
    ($extensions -contains $_.Extension.ToLower()) -and 
    ($_.Name -notmatch "^Q\d{6}") -and
    ($_.Name -ne "icon.png")
} | Sort-Object CreationTime

if ($newFiles.Count -gt 0) {
    Write-Host "Renaming $($newFiles.Count) new files..." -ForegroundColor Cyan
    foreach ($file in $newFiles) {
        $maxNum++
        $newName = "Q{0:D6}{1}" -f $maxNum, $file.Extension.ToLower()
        Rename-Item -Path $file.FullName -NewName $newName -ErrorAction Stop
        Write-Host "Renamed: $($file.Name) -> $newName" -ForegroundColor Gray
    }
}

# 3. SYNC: PULL *BEFORE* GENERATING CSV
Write-Host "`nFetching latest changes from GitHub..." -ForegroundColor Green

# Prepare Auth URL
if ($env:GITHUB_PAT) {
    $authUrl = $repoUrl.Replace("https://", "https://$($env:GITHUB_PAT)@")
} else {
    $authUrl = $repoUrl
}

# Pull latest state. If lot.csv conflicts, we don't care because we will overwrite it in Step 4.
git pull $authUrl
if ($LASTEXITCODE -ne 0) {
    Write-Warning "Pull had issues. Resetting lot.csv to ensure clean generation..."
    git checkout lot.csv
}

# 4. RUN PYTHON INDEXER (UV)
Write-Host "Updating CSV Index..." -ForegroundColor Green
try {
    uv run generate_lot.py
} catch {
    Write-Error "UV execution failed."
    exit
}

# 5. COMMIT & PUSH
Write-Host "Pushing to GitHub..." -ForegroundColor Green
$status = git status --porcelain

if ($status) {
    git add .
    git commit -m "Auto-Update: Q$("{0:D6}" -f $maxNum)"
    git push $authUrl

    if ($LASTEXITCODE -eq 0) {
        Write-Host "`nSUCCESS! Gallery is live." -ForegroundColor Green
    } else {
        Write-Host "`nGit Push failed. Check your Token permissions." -ForegroundColor Red
    }
} else {
    Write-Host "Everything is already up to date." -ForegroundColor Yellow
}

# Pause
Write-Host "`nDone."
Read-Host "Press Enter to close"