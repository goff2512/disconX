# LAN Chess

Two-player chess in the browser over your home network. No installs beyond Node.js, no internet needed.

## Run it

### Windows: one-time setup with desktop icons

Paste this into PowerShell:

```powershell
irm https://raw.githubusercontent.com/goff2512/disconX/ccr-74cac628-im4nmj/chess/install-windows.ps1 | iex
```

It installs Node.js and cloudflared if needed, puts the game in `%USERPROFILE%\LANChess`, and adds three desktop icons:

| Icon | What it does |
|------|--------------|
| **Chess (home)** | Starts the game for your home network and opens the browser |
| **Chess (online)** | Also opens a Cloudflare tunnel, waits until the public address works, then opens it |
| **Update Chess** | Downloads the latest version |

### Double-click launchers

| System  | Home network            | Online |
|---------|-------------------------|--------|
| Windows | `start-windows.bat`     | `start-online-windows.bat` |
| macOS   | `start-mac.command` (first time: right-click → Open) | `./start-mac.command --online` |
| Linux   | `start-linux.sh`        | `./start-linux.sh --online` |

**Or from a terminal:**

```bash
cd chess
node server.js          # just the server
node launch.js --online  # server + tunnel + browser
```

> Don't double-click `server.js` itself. On Windows that runs it with the wrong program and shows a "JScript" error.

Keep the window open while you play. It shows the addresses to use (yours will have different numbers):

```
On this computer:   http://localhost:3000
On your network:    http://192.168.x.x:3000    <- your PC's real address
```

On the PC running the server, `http://localhost:3000` always works. Other devices use the "On your network" address.

1. Open the address, enter your name, click **Create new game**.
2. Send the **invite link** shown in the side panel to the other player (any phone, tablet or computer on the same Wi-Fi).
3. The first person in plays White and the second plays Black. Anyone else who opens the link watches.

If port 3000 is busy it tries 3001, 3002, and so on. Use `PORT=8080 node server.js` to pick a port yourself. If the other device can't connect, allow Node through
the host computer's firewall (Windows asks the first time; on macOS it's System Settings → Network → Firewall).

## Features

- Full rules: castling, en passant, promotion, check/checkmate/stalemate, 50-move rule, threefold repetition, insufficient material
- The server checks every move, so a misbehaving client can't make illegal moves
- Click a piece to see its legal moves; last move and check are highlighted
- Move list in standard notation, captured pieces and material count
- Offer/accept draw, resign, rematch (colors swap)
- Reload or a dropped Wi-Fi connection reconnects to your seat automatically
- Two tabs on one computer count as two players (handy for testing)

## Learning mode

Flip the **Learning mode** switch in the side panel. It only changes that player's own screen, and it's remembered on that device.

- Tap a piece to see how it moves and what it's worth
- Green dots are safe squares, red dots are squares where the piece could be captured
- Red ring: one of your pieces is in danger. Green ring: an opponent's piece you can win
- An "Are you sure?" warning before you give away a piece for free
- When you're in check, it explains your three options and shows the attacker
- **Hint** button suggests a move and explains why
- Beginner tips while you wait for the other player

## Notes

- Games live in the server's memory; they're gone when you stop the server.
- Your seat belongs to your browser tab, not your name. To play your side on another device (e.g. move from PC to phone), click **Use on phone** and scan the QR code. Keep that link private: whoever opens it plays your side.
- Before the first move, a seat whose player has left goes to the next person who opens the invite link. Mid-game, use **Play as …**, which appears while a seat's player is offline.
- Home Assistant users: it runs fine on any always-on box (Pi, NAS, HA host with Node available).

`npm test` runs the rules engine against standard perft positions.
