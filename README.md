# Reframe Systems — offline app (Webflow Cloud)

An offline, installable copy of www.reframe.systems, packaged as a **static
Webflow Cloud app mounted at `/app`**, e.g. `https://www.reframe.systems/app/`.

- The pages, scripts and styles are in this repo (~9 MB).
- Images and video stay on Webflow's own file server
  (`cdn.prod.website-files.com`), which keeps the deploy well under Webflow
  Cloud's 100 MB limit. On first visit the service worker (`sw.js`) saves all
  ~1,130 files, including that media, so the app then works with no internet.
- Removed for offline use: Vimeo, YouTube, the 3D tour, the HubSpot form, the
  cookie banner and Google Tag Manager. Pages are marked `noindex`.

## Deploy

1. Push this folder to a GitHub repository.
2. In the client's Webflow site: **Apps → Webflow Cloud → Create new app**,
   then select the repo and branch.
3. Set the mount path to **`/app`** and click **Deploy**.

`webflow.json` declares this a static app (no build step); Webflow Cloud
serves the files exactly as committed.

**Using a different mount path?** Every link in the files includes `/app`, so
rebuild with the matching `--base` (see *Updating*), or it won't work.

## Install on an iPad

1. Open `https://<the Webflow domain>/app/` in Safari, on Wi-Fi.
2. Share → **Add to Home Screen**, then open it from the new icon.
3. Wait for the bottom-left badge: "Saving for offline… N / 1133" →
   "Ready offline ✓".
4. Test: Airplane Mode on, force-quit, reopen from the icon.

## Updating after Webflow changes

The build script lives in the sibling `reframe-systems-offline` folder:

```bash
cd ../reframe-systems-offline
python3 _mirror.py --out ../reframe-webflow-cloud --base /app --remote-media
```

Then commit, push and redeploy. Installed iPads pick up the new version the
next time they open the app online.

Rebuild after deleting or replacing images in Webflow too: the app points at
the file-server URLs that existed when it was built.

## Test locally

Serving must mimic the `/app` mount path, e.g. from a folder containing a
symlink `app -> reframe-webflow-cloud`:

```bash
mkdir -p /tmp/mount && ln -sfn "$PWD" /tmp/mount/app
python3 -m http.server 8020 --directory /tmp/mount
```

Then open http://localhost:8020/app/.
