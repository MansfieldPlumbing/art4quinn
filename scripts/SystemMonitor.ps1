# System Monitor Script
Get-Process | Sort-Object CPU -Descending | Select-Object Name, CPU, WorkingSet -First 15
Get-WmiObject Win32_OperatingSystem | Select-Object FreePhysicalMemory, TotalVisibleMemorySize
