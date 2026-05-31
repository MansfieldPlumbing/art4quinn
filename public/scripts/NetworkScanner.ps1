# Network Scanner Script
Test-Connection -ComputerName 8.8.8.8 -Count 4
Get-NetAdapter | Where-Object Status -eq 'Up' | Select-Object Name, InterfaceDescription, MacAddress
