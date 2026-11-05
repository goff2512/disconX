# LAN Chess

Two-player chess in the browser over your home network. No installs beyond Node.js, no internet needed.

## Run it

```bash
cd chess
node server.js          # or: npm start
```

The server prints its addresses:

```
On this computer:   http://localhost:3000
On your network:    http://192.168.1.42:3000
```

1. Open the address, enter your name, click **Create new game**.
2. Send the **invite link** shown in the side panel to the other player (any phone, tablet or computer on the same Wi-Fi).
3. The first person in plays White and the second plays Black. Anyone else who opens the link watches.

Use `PORT=8080 node server.js` to pick another port. If the other device can't connect, allow Node through
the host computer's firewall (Windows asks the first time; on macOS it's System Settings → Network → Firewall).

## Features

- Full rules: castling, en passant, promotion, check/checkmate/stalemate, 50-move rule, threefold repetition, insufficient material
- The server checks every move, so a misbehaving client can't make illegal moves
- Click a piece to see its legal moves; last move and check are highlighted
- Move list in standard notation, captured pieces and material count
- Offer/accept draw, resign, rematch (colors swap)
- Reload or a dropped Wi-Fi connection reconnects to your seat automatically
- Two tabs on one computer count as two players (handy for testing)

## Notes

- Games live in the server's memory; they're gone when you stop the server.
- Your seat belongs to your browser tab. If you close the tab, open the link again and click **Play as …**, which shows up while that seat is offline.
- Home Assistant users: it runs fine on any always-on box (Pi, NAS, HA host with Node available).

`npm test` runs the rules engine against standard perft positions.
