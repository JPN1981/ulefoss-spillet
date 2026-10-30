# Site assets

This directory is the static GitHub Pages site artifact. It contains the Ulefoss board game, its local game logic, and only the image assets it references.

The experimental room uses PeerJS public signaling and direct WebRTC connections for two to six participants. The host starts and controls the shared game, and only the active participant can roll or answer. Players join before the game starts; a departure ends the game. The host must remain connected, the room code is not an authentication mechanism, and the game is not cheat-proof.

Experimental audio and video are opt-in: each participant enables their own camera and microphone and grants browser permission. Remote audio starts muted until the participant selects **Hør andre**. Local tracks stop on leaving the room. Camera and microphone access requires HTTPS or localhost. Direct connections may fail on restrictive networks without a TURN service, and video bandwidth grows with the number of participants; six simultaneous video streams are not guaranteed. GitHub Pages serves static files only.
