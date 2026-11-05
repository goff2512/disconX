@echo off
setlocal
title Update LAN Chess
rem Runs from a temporary copy, so this file can safely be replaced during the update.
if /i not "%~1"=="--run" (
  copy /y "%~f0" "%TEMP%\lanchess-update.bat" >nul
  call "%TEMP%\lanchess-update.bat" --run "%~dp0"
  exit /b
)
set "DEST=%~2"
if "%DEST:~-1%"=="\" set "DEST=%DEST:~0,-1%"
set "ZIP=%TEMP%\lanchess.zip"
set "UNPACK=%TEMP%\lanchess-unpack"
echo.
echo   Updating LAN Chess in %DEST%
echo   (Close any open chess windows first.)
echo.
echo   Downloading...
"%SystemRoot%\System32\curl.exe" -fsSL -o "%ZIP%" "https://github.com/goff2512/disconX/archive/refs/heads/ccr-74cac628-im4nmj.zip"
if errorlevel 1 goto :fail
if exist "%UNPACK%" rmdir /s /q "%UNPACK%"
mkdir "%UNPACK%"
echo   Unpacking...
"%SystemRoot%\System32\tar.exe" -xf "%ZIP%" -C "%UNPACK%"
if errorlevel 1 goto :fail
set "SRC="
for /d %%D in ("%UNPACK%\*") do set "SRC=%%D\chess"
if not exist "%SRC%\launch.js" goto :fail
echo   Installing...
xcopy "%SRC%" "%DEST%" /e /i /y /q >nul
if errorlevel 1 goto :fail
for /d %%O in ("%DEST%\disconX-*") do rmdir /s /q "%%O" 2>nul
rmdir /s /q "%UNPACK%"
del "%ZIP%"
echo.
echo   Done! Start the game again from your desktop icon.
echo.
pause
exit /b 0

:fail
echo.
echo   The update did not finish. Check your internet connection and try again.
echo.
pause
exit /b 1
