<#
    .SYNOPSIS
    Automated Gallery Updater for Q Project (push.ps1)
    
    .DESCRIPTION
    1. Renames new media files sequentially (Q0000xx).
    2. Updates the CSV index using Python.
    3. Pushes changes to GitHub.
#>

# 1. SETUP & LOCATION
Set-Location $PSScriptRoot
Write-Host "--- Q GALLERY AUTOMATION ---" -ForegroundColor Green

# Define valid extensions
$extensions = @(".png", ".jpg", ".jpeg", ".mp4", ".webm", ".gif")

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
# Get files that match extensions BUT:
# - Do not match the Q000000 pattern
# - Are NOT the icon.png file (THIS IS THE CRITICAL FIX)
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
        }
        catch {
            Write-Error "Failed to rename $($file.Name). Check if file is open."
            Read-Host "Press Enter to exit..."
            exit
        }
    }
} else {
    Write-Host "No new files to rename." -ForegroundColor DarkGray
}

# 4. RUN PYTHON INDEXER
Write-Host "`nUpdating CSV Index..." -ForegroundColor Green
try {
    python generate_lot.py
}
catch {
    Write-Error "Python script failed to run. Is Python installed and in PATH?"
    Read-Host "Press Enter to exit..."
    exit
}

# 5. GIT COMMIT & PUSH
Write-Host "`nPushing to GitHub..." -ForegroundColor Green
$status = git status --porcelain

if ($status) {
    git add .
    git commit -m "Auto-Update: Added new content and updated index"
    git push
    if ($LASTEXITCODE -eq 0) {
        Write-Host "SUCCESS! Gallery is live." -ForegroundColor Green
    } else {
        Write-Host "Git Push failed. Check your internet or credentials." -ForegroundColor Red
    }
} else {
    Write-Host "No changes to commit." -ForegroundColor Yellow
}

# Pause so you can see the result before window closes
Write-Host "`nDone."
Read-Host "Press Enter to close"