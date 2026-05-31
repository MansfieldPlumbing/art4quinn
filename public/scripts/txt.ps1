# This is a sample PS1 script.
Write-Host "Hello, world!"
Get-Process | Select-Object Name, Id, CPU | Select -First 10
