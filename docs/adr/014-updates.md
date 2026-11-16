# ADR-014 — The desktop app updates itself, if the person says yes

**Status**: Accepted
**Date**: 2026-11-15
**Decision**: The desktop app asks once whether it may update itself. With a yes, it looks for a new version when it opens and installs it; a version found while it runs waits for a click. The answer can be changed in Settings, where the person can also look for an update by hand. Updates come from the latest GitHub release and are installed only if they carry the project's signature.

---

## Context

Until 0.2.0 the only way to a new version was to download the installer again from the site. The author asked for automatic updates, chosen once by the person and changeable in Settings.

## Decision

- **Tauri's updater plugin**, with the official flow: every release build signs its update files with the project's private key (a GitHub secret, `TAURI_SIGNING_PRIVATE_KEY`), and `latest.json` on the release says where each platform's file is and its signature. The app holds the public key (`plugins.updater.pubkey` in `tauri.conf.json`) and installs nothing that does not match it.
- **Where it looks**: `https://github.com/Felichz/life-ui/releases/latest/download/latest.json`. A draft release is not "latest": an update reaches people when the release is published.
- **Asked once**: a card in the corner, not a dialog, so it never stands in front of the model setup. No answer means nothing automatic happens.
- **When it installs**: at launch, before anything is under way, it installs at once and the app opens again on the new version. While the app runs it looks every six hours and only says a version is ready ("Update now" / "Later"), because on Windows the installer closes the app.
- **Windows**: the installer runs in passive mode (a progress bar, no questions). The NSIS installer now offers "just me" or "every user" (`installMode: both`); the second asks for admin, which is what installing to Program Files needs.
- **The portable copy** is never updated in place: it says so in Settings (download the new one and keep `LifeUI-data`).

## Consequences

- The private key lives on the author's machine (`~/.tauri/lifeui-updater.key`) and in the repository's secrets. Losing it means installed copies can no longer verify updates: they would have to be reinstalled by hand once, with a new key.
- Copies of 0.2.0 or earlier have no updater: they are updated by hand once, to the first version that has it.
