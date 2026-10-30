# Site assets

This directory is the static GitHub Pages site artifact. It contains the Ulefoss board game, its local game logic, and only the image assets it references.

The experimental room uses PeerJS public signaling and direct WebRTC data connections for two to six participants. The host starts and controls the shared game, and only the active participant can roll or answer. Players join before the game starts; a departure ends the game. The host must remain connected, the room code is not an authentication mechanism, and the game is not cheat-proof. Video is not included. Connections can fail on restrictive networks without a TURN service. GitHub Pages serves static files only.
