# Site assets

This directory is the static GitHub Pages site artifact. It contains the Ulefoss board game, its local game logic, and only the image assets it references.

The experimental room uses PeerJS public signaling and direct WebRTC data connections for up to six participants. The host must remain connected; the room code is not an authentication mechanism. Rooms do not synchronize game state and do not provide video. Connections can fail on restrictive networks without a TURN service. GitHub Pages serves static files only.
