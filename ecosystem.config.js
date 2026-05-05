// PM2 ecosystem for AcornArranger.
//
// Manages both the Next.js web app and the Python VRPTW scheduler sidecar
// from a single config. PM2 is expected to be installed globally on the
// host (see the root README for setup):
//
//   npm install pm2 -g
//
// Common workflow on the VPS, run from the repo root (the directory holding
// this file):
//
//   pm2 start ecosystem.config.js          # start both apps
//   pm2 status                             # list managed processes
//   pm2 logs acornarranger-web             # tail web logs
//   pm2 logs acornarranger-scheduler       # tail scheduler logs
//   pm2 restart acornarranger-web          # restart just the web app
//   pm2 reload  ecosystem.config.js        # zero-downtime reload of both
//   pm2 stop    ecosystem.config.js        # stop both
//   pm2 delete  ecosystem.config.js        # remove from PM2's process list
//
// First-time deploy: after `pm2 start ecosystem.config.js`, run `pm2 save`
// once to persist the process list, and `pm2 startup` once to install the
// systemd shim that auto-resurrects the saved list at boot. PM2 manages
// process supervision; the OS only relaunches PM2 itself on reboot.
//
// The web app reads its production secrets from AcornArranger/.env.production
// (Next.js loads that file natively when NODE_ENV=production). The scheduler
// has no env reads in Python; the few process-level vars it needs are set
// inline below.

module.exports = {
  apps: [
    {
      name: "acornarranger-web",
      cwd: "./AcornArranger",
      script: "npm",
      args: "start",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
    {
      name: "acornarranger-scheduler",
      cwd: "./acornarranger-scheduler",
      script: ".venv/bin/uvicorn",
      args: "src.main:app --host 127.0.0.1 --port 8001 --workers 1 --log-level info",
      interpreter: "none",
      env: {
        PYTHONUNBUFFERED: "1",
      },
    },
  ],
};
