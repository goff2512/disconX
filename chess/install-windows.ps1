# LAN Chess installer and updater for Windows.
# Paste into PowerShell:
#   irm https://raw.githubusercontent.com/goff2512/disconX/ccr-74cac628-im4nmj/chess/install-windows.ps1 | iex
# Run it again any time to update. It creates desktop shortcuts:
#   Chess (home), Chess (online), Update Chess
& {
  $ErrorActionPreference = 'Stop'
  $Branch    = 'ccr-74cac628-im4nmj'
  $ZipUrl    = "https://github.com/goff2512/disconX/archive/refs/heads/$Branch.zip"
  $SelfUrl   = "https://raw.githubusercontent.com/goff2512/disconX/$Branch/chess/install-windows.ps1"
  $Dir       = Join-Path $HOME 'LANChess'

  function Step($text) { Write-Host "  - $text" -ForegroundColor Cyan }
  function Refresh-Path {
    $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
  }

  Write-Host "`n  LAN Chess setup`n" -ForegroundColor Yellow
  Write-Host "  Tip: close any running chess windows first.`n"

  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Step 'Installing Node.js (needed to run the game)...'
    winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
    Refresh-Path
  } else { Step 'Node.js is installed' }

  $cfPaths = @("${env:ProgramFiles(x86)}\cloudflared\cloudflared.exe", "$env:ProgramFiles\cloudflared\cloudflared.exe")
  if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue) -and -not ($cfPaths | Where-Object { Test-Path $_ })) {
    Step 'Installing cloudflared (needed for online play)...'
    winget install -e --id Cloudflare.cloudflared --accept-source-agreements --accept-package-agreements
  } else { Step 'cloudflared is installed' }

  Step 'Downloading the latest LAN Chess...'
  $zip = Join-Path $env:TEMP 'lanchess.zip'
  $tmp = Join-Path $env:TEMP 'lanchess-unpack'
  $ProgressPreference = 'SilentlyContinue'
  Invoke-WebRequest $ZipUrl -OutFile $zip -UseBasicParsing
  if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
  Expand-Archive $zip $tmp -Force
  $src = Get-ChildItem $tmp -Directory | Select-Object -First 1
  New-Item -ItemType Directory -Force $Dir | Out-Null
  Copy-Item (Join-Path $src.FullName 'chess\*') $Dir -Recurse -Force
  # Remove the folder left by the first, manual install (it held an older copy of the game).
  try {
    Get-ChildItem $Dir -Directory -Filter 'disconX-*' | Remove-Item -Recurse -Force
  } catch {
    Write-Host "    (Couldn't remove the old copy yet. Close any open chess windows and run this again to tidy up.)" -ForegroundColor DarkYellow
  }
  Remove-Item $zip -Force
  Remove-Item $tmp -Recurse -Force
  Step "Installed to $Dir"

  Step 'Creating desktop shortcuts...'
  $desktop = [Environment]::GetFolderPath('Desktop')
  $shell = New-Object -ComObject WScript.Shell
  function Make-Shortcut($name, $target, $arguments, $icon, $description) {
    $lnk = $shell.CreateShortcut((Join-Path $desktop "$name.lnk"))
    $lnk.TargetPath = $target
    $lnk.Arguments = $arguments
    $lnk.WorkingDirectory = $Dir
    $lnk.IconLocation = "$icon,0"
    $lnk.Description = $description
    $lnk.Save()
  }
  Make-Shortcut 'Chess (home)'   "$Dir\start-windows.bat"        '' "$Dir\icons\chess.ico"        'Play chess on your home network'
  Make-Shortcut 'Chess (online)' "$Dir\start-online-windows.bat" '' "$Dir\icons\chess-online.ico" 'Play chess over the internet'
  $update = "-NoProfile -ExecutionPolicy Bypass -Command `"irm '$SelfUrl' | iex; Read-Host 'Press Enter to close'`""
  Make-Shortcut 'Update Chess' "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" $update "$Dir\icons\chess.ico" 'Download the latest LAN Chess'

  Write-Host "`n  All done! Double-click 'Chess (home)' or 'Chess (online)' on your desktop.`n" -ForegroundColor Green
}
