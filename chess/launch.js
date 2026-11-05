// One-step launcher: starts the chess server, optionally a Cloudflare tunnel, and opens the browser.
//   node launch.js            play on your home network
//   node launch.js --online   also make it reachable from the internet (needs cloudflared)
const { spawn, exec } = require('child_process');
const fs = require('fs');

const online = process.argv.includes('--online');
const server = require('./server.js');

function openBrowser(url) {
  const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

function findCloudflared() {
  // Prefer known install locations (a fresh winget install isn't on PATH until you log in again).
  const candidates = [];
  if (process.platform === 'win32') {
    for (const base of [process.env['ProgramFiles(x86)'], process.env.ProgramFiles, process.env.LOCALAPPDATA && process.env.LOCALAPPDATA + '\\Microsoft\\WinGet\\Links']) {
      if (base) candidates.push(base + '\\cloudflared\\cloudflared.exe', base + '\\cloudflared.exe');
    }
  }
  return candidates.find((c) => fs.existsSync(c)) || 'cloudflared';
}

// Ask Cloudflare's public DNS whether the new address exists yet. Checking this way avoids
// the computer caching a "not found" answer, which could block the page for minutes.
async function dnsReady(host) {
  try {
    const r = await fetch(`https://cloudflare-dns.com/dns-query?name=${host}&type=A`, { headers: { accept: 'application/dns-json' } });
    const j = await r.json();
    return j.Status === 0 && Array.isArray(j.Answer) && j.Answer.length > 0;
  } catch (e) {
    return false;
  }
}

function banner(lines) {
  const w = Math.max(...lines.map((l) => l.length)) + 4;
  console.log('\n  ' + '='.repeat(w));
  for (const l of lines) console.log('  ||' + ' ' + l.padEnd(w - 4) + ' ||');
  console.log('  ' + '='.repeat(w) + '\n');
}

function startTunnel(port) {
  const bin = findCloudflared();
  console.log('  Starting the internet tunnel...');
  const cf = spawn(bin, ['tunnel', '--no-autoupdate', '--url', `http://localhost:${port}`], { stdio: ['ignore', 'pipe', 'pipe'] });
  let url = null, opened = false, log = '';

  const onLine = async (text) => {
    log += text;
    if (!url) {
      const m = log.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (m) url = m[0];
    }
    if (url && !opened && /Registered tunnel connection/.test(log)) {
      opened = true;
      console.log('  Tunnel connected. Waiting for the address to go live...');
      const host = new URL(url).host;
      for (let i = 0; i < 30 && !(await dnsReady(host)); i++) await new Promise((r) => setTimeout(r, 2000));
      await new Promise((r) => setTimeout(r, 1500));
      banner([
        'LAN Chess is ONLINE',
        '',
        url,
        '',
        'Create a game, then send the invite link',
        'from the side panel to the other player.',
        'This address changes every time you start.',
      ]);
      console.log('  Keep this window open while you play. Close it to stop.\n');
      openBrowser(url);
    }
  };
  cf.stdout.on('data', (d) => onLine(d.toString()));
  cf.stderr.on('data', (d) => onLine(d.toString()));
  cf.on('error', () => {
    banner(['Could not start the tunnel: cloudflared is not installed.', 'Install it with:  winget install -e --id Cloudflare.cloudflared', 'The game still works on your home network.']);
    openBrowser(`http://localhost:${port}`);
  });
  cf.on('exit', (code) => {
    if (code !== null && code !== 0) {
      console.log(`\n  The tunnel stopped (code ${code}). Last messages:\n`);
      console.log(log.split('\n').slice(-8).join('\n'));
    }
  });
  const stop = () => { try { cf.kill(); } catch (e) { /* already gone */ } process.exit(0); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  process.on('exit', () => { try { cf.kill(); } catch (e) { /* already gone */ } });
}

server.on('listening', () => {
  const port = server.address().port;
  if (online) startTunnel(port);
  else openBrowser(`http://localhost:${port}`);
});
