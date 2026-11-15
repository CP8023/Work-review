# Build deploy.zip from the dist\ folder with forward-slash entry paths.
# ASCII-only content: safe to run under any Windows codepage.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$dist = Join-Path $root 'dist'
$zipPath = Join-Path $root 'deploy.zip'

if (-not (Test-Path $dist)) { Write-Error 'dist\ not found. Run the packaging .bat first.'; exit 1 }
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

Add-Type -AssemblyName System.IO.Compression.FileSystem
$distFull = (Resolve-Path $dist).Path
$zip = [System.IO.Compression.ZipFile]::Open($zipPath, 'Create')
try {
  Get-ChildItem $dist -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring($distFull.Length + 1) -replace '\\', '/'
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $rel) | Out-Null
  }
} finally {
  $zip.Dispose()
}
Write-Host ('deploy.zip created: ' + (Get-Item $zipPath).Length + ' bytes')
