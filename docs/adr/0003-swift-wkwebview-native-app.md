# Swift + WKWebView for native macOS app wrapper

**Question:** If we build a native macOS app, what wrapper do we use to host the existing web UI?

We will use a Swift/AppKit shell that creates a window hosting WKWebView, with a bundled Node.js subprocess running the existing Express server. The WKWebView loads `http://localhost:<port>` — identical to the current web dev setup, but the server is a managed subprocess and the shell is native AppKit.

Swift is the standard macOS development language. The shell code is estimated at ~200 lines (window creation, subprocess lifecycle). The Node subprocess will run the same Express API code with zero rewrite. Total bundle target: ~30–40 MB.

This is a macOS-only tool (Apple Music integration via `osascript`). Cross-platform is not a requirement.

For full analysis and comparison matrices, see [Alternative build targets analysis](../../plans/20260715-alternative-build-targets.md).

Rejected alternatives:

1. **Tauri 2 (Rust):** Very good native feel with built-in sidecar lifecycle management, but requires Rust for a minimal shell layer. Cross-platform benefit is irrelevant for a macOS-only tool. Node SEA sidecar adds ~90 MB to the bundle (vs ~40 MB for raw Node binary). The sidecar communication is HTTP to localhost anyway — same as the Swift approach, just with a Rust layer in between.

2. **Electron:** Zero new languages, Express runs natively in main process, but ~200+ MB bundle and 150–300 MB idle RAM. Chromium instead of WKWebView — doesn't feel native, extra battery drain. Too heavy alongside DAWs and DJ software.

3. **Capacitor:** Not viable — no real macOS support. Mac Catalyst is broken (window resize bugs, plugin compilation failures). Designed for iOS/Android, not desktop.
