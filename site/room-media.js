(() => {
  const room = window.roomConnection;
  const cameraButton = $("camera-toggle");
  const microphoneButton = $("mic-toggle");
  const hearButton = $("hear-toggle");
  const retryButton = $("retry-media");
  const status = $("media-status");
  const container = $("media-tiles");
  const outgoing = new Map();
  const incoming = new Map();
  const incomingSequences = new Map();
  const streams = new Map();
  const tiles = new Map();
  const pendingCalls = new Map();
  const callType = "ulefoss-media-v1";
  let localStream = null;
  let connected = false;
  let busy = false;
  let audioEnabled = false;
  let generation = 0;
  let callSequence = 0;

  function setStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle("error", isError);
  }

  function liveTrack(kind) {
    return localStream?.getTracks().find((track) => track.kind === kind && track.readyState === "live");
  }

  function closeOutgoing(id) {
    const entry = outgoing.get(id);
    if (!entry) return;
    outgoing.delete(id);
    clearTimeout(entry.timeout);
    entry.call.close();
  }

  function closeIncoming(id) {
    const call = incoming.get(id);
    incoming.delete(id);
    streams.delete(id);
    if (call) call.close();
  }

  function refreshControls() {
    const available = room.connected && Boolean(localStream);
    cameraButton.disabled = !available || busy;
    microphoneButton.disabled = !available || busy;
    cameraButton.textContent = liveTrack("video") ? "Slå av kamera" : "Slå på kamera";
    microphoneButton.textContent = liveTrack("audio") ? "Slå av mikrofon" : "Slå på mikrofon";
    const hasAudio = room.members.some((member) => member.name !== room.self && member.microphone &&
      streams.get(member.peerId)?.getAudioTracks().some((track) => track.readyState === "live"));
    hearButton.disabled = !available || !hasAudio;
    hearButton.textContent = audioEnabled ? "Demp andre" : "Hør andre";
    retryButton.disabled = !available || busy || !localStream.getTracks().length || room.members.length < 2;
  }

  function muteRemoteAudio() {
    for (const tile of tiles.values()) tile.audio.muted = true;
  }

  function playRemoteAudio(tile) {
    const stream = tile.audio.srcObject;
    const result = tile.audio.play();
    if (result) result.catch((error) => {
      if (error.name === "AbortError" || !room.connected || !audioEnabled || tile.audio.srcObject !== stream) return;
      audioEnabled = false;
      muteRemoteAudio();
      refreshControls();
      setStatus("Nettleseren blokkerte lyden. Trykk «Hør andre» for å prøve igjen.", true);
    });
  }

  function makeTile(member) {
    const element = document.createElement("div");
    element.className = "media-tile";
    const label = document.createElement("strong");
    const video = document.createElement("video");
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("aria-label", `Kamera fra ${member.name}`);
    const audio = document.createElement("audio");
    audio.autoplay = true;
    audio.muted = true;
    const info = document.createElement("p");
    element.append(label, video, audio, info);
    container.appendChild(element);
    const tile = { element, label, video, audio, info };
    tiles.set(member.peerId, tile);
    return tile;
  }

  function renderTiles() {
    const members = room.connected ? room.members : [];
    const ids = new Set(members.map((member) => member.peerId));
    for (const [id, tile] of tiles) {
      if (!ids.has(id)) {
        tile.video.srcObject = null;
        tile.audio.srcObject = null;
        tile.element.remove();
        tiles.delete(id);
      }
    }
    for (const member of members) {
      const local = member.name === room.self;
      const tile = tiles.get(member.peerId) || makeTile(member);
      const stream = local ? localStream : streams.get(member.peerId);
      const camera = local ? Boolean(liveTrack("video")) : member.camera;
      const microphone = local ? Boolean(liveTrack("audio")) : member.microphone;
      const videoReady = camera && stream?.getVideoTracks().some((track) => track.readyState === "live");
      const audioReady = !local && microphone && stream?.getAudioTracks().some((track) => track.readyState === "live");
      const videoWasHidden = tile.video.hidden;
      tile.label.textContent = local ? `${member.name} (deg)` : member.name;
      tile.info.textContent = `Kamera ${camera ? "på" : "av"} · Mikrofon ${microphone ? "på" : "av"}` +
        (!local && (camera || microphone) && !stream ? " · venter på forbindelse" : "");
      tile.video.hidden = !videoReady;
      if (tile.video.srcObject !== (stream || null)) {
        tile.video.srcObject = stream || null;
      }
      if (stream && videoReady && (videoWasHidden || tile.video.paused)) {
        const result = tile.video.play();
        if (result) result.catch((error) => {
          if (error.name !== "AbortError" && room.connected && tile.video.srcObject === stream) {
            setStatus(`Nettleseren kunne ikke vise kameraet til ${member.name}.`, true);
          }
        });
      }
      if (!local && tile.audio.srcObject !== (stream || null)) {
        tile.audio.srcObject = stream || null;
        tile.audio.muted = !audioEnabled || !audioReady;
        if (audioEnabled && audioReady) playRemoteAudio(tile);
      } else {
        tile.audio.muted = local || !audioEnabled || !audioReady;
      }
    }
    refreshControls();
  }

  function startOutgoing(member) {
    const call = room.peer.call(member.peerId, localStream, { metadata: { type: callType, sequence: ++callSequence } });
    if (!call) {
      setStatus(`Kunne ikke starte lyd og bilde til ${member.name}. Prøv sending på nytt.`, true);
      return;
    }
    const entry = { call, timeout: null };
    outgoing.set(member.peerId, entry);
    const connection = call.peerConnection;
    const checkConnection = () => {
      if (outgoing.get(member.peerId) !== entry || !connection) return;
      if (connection.iceConnectionState === "connected" || connection.iceConnectionState === "completed") {
        clearTimeout(entry.timeout);
        entry.timeout = null;
      } else if (connection.iceConnectionState === "failed") {
        setStatus(`Lyd og bilde til ${member.name} fikk ikke forbindelse. Prøv sending på nytt eller et annet nettverk.`, true);
      }
    };
    entry.timeout = setTimeout(() => {
      if (outgoing.get(member.peerId) === entry &&
        (!connection || !["connected", "completed"].includes(connection.iceConnectionState))) {
        setStatus(`Lyd og bilde til ${member.name} tok for lang tid. Prøv sending på nytt eller et annet nettverk.`, true);
      }
    }, 20000);
    if (connection) connection.addEventListener("iceconnectionstatechange", checkConnection);
    call.on("error", () => {
      if (outgoing.get(member.peerId) !== entry) return;
      closeOutgoing(member.peerId);
      setStatus(`Lyd og bilde til ${member.name} ble avbrutt. Prøv sending på nytt.`, true);
    });
    call.on("close", () => {
      if (outgoing.get(member.peerId) !== entry) return;
      outgoing.delete(member.peerId);
      clearTimeout(entry.timeout);
      setStatus(`Sendingen til ${member.name} ble avsluttet. Prøv sending på nytt hvis den andre ikke ser eller hører deg.`, true);
    });
    checkConnection();
  }

  function syncOutgoing() {
    if (!room.connected || !localStream) return;
    const others = room.members.filter((member) => member.name !== room.self);
    const ids = new Set(others.map((member) => member.peerId));
    for (const id of outgoing.keys()) {
      if (!ids.has(id) || !localStream.getTracks().length) closeOutgoing(id);
    }
    if (!localStream.getTracks().length) return;
    for (const member of others) {
      if (!outgoing.has(member.peerId)) startOutgoing(member);
    }
  }

  function restartOutgoing() {
    for (const id of outgoing.keys()) closeOutgoing(id);
    syncOutgoing();
  }

  function answerCall(call) {
    const member = room.members.find((item) => item.peerId === call.peer && item.name !== room.self);
    if (!member) return false;
    if (call.metadata.sequence <= (incomingSequences.get(call.peer) || 0)) {
      call.close();
      return true;
    }
    incomingSequences.set(call.peer, call.metadata.sequence);
    closeIncoming(call.peer);
    incoming.set(call.peer, call);
    call.on("stream", (stream) => {
      if (incoming.get(call.peer) !== call) return;
      streams.set(call.peer, stream);
      renderTiles();
      setStatus(`Lyd og bilde fra ${member.name} er tilkoblet. Trykk «Hør andre» for lyd.`);
    });
    call.on("close", () => {
      if (incoming.get(call.peer) !== call) return;
      incoming.delete(call.peer);
      streams.delete(call.peer);
      renderTiles();
    });
    call.on("error", () => {
      if (incoming.get(call.peer) !== call) return;
      closeIncoming(call.peer);
      renderTiles();
      setStatus(`Kunne ikke motta lyd og bilde fra ${member.name}. Be dem prøve sending på nytt.`, true);
    });
    call.answer();
    return true;
  }

  function receiveCall(call) {
    if (call.metadata?.type !== callType || !Number.isSafeInteger(call.metadata.sequence) ||
      call.metadata.sequence < 1 || !room.peer || pendingCalls.size >= 6) {
      call.close();
      return;
    }
    if (room.connected && answerCall(call)) return;
    const timeout = setTimeout(() => {
      if (!pendingCalls.has(call)) return;
      pendingCalls.delete(call);
      call.close();
      setStatus("Kunne ikke bekrefte hvem som sendte lyd og bilde. Prøv igjen.", true);
    }, 10000);
    pendingCalls.set(call, timeout);
    call.on("close", () => {
      clearTimeout(pendingCalls.get(call));
      pendingCalls.delete(call);
    });
  }

  function roomChanged() {
    if (!room.connected) return;
    if (!connected) {
      connected = true;
      if (typeof MediaStream !== "function" || !navigator.mediaDevices?.getUserMedia) {
        setStatus("Denne nettleseren støtter ikke kamera og mikrofon på siden.", true);
        refreshControls();
        return;
      }
      localStream = new MediaStream();
      setStatus("Kamera og mikrofon er av. Slå dem på når du vil.");
    }
    const ids = new Set(room.members.map((member) => member.peerId));
    for (const id of incoming.keys()) {
      if (!ids.has(id)) closeIncoming(id);
    }
    for (const id of incomingSequences.keys()) {
      if (!ids.has(id)) incomingSequences.delete(id);
    }
    for (const [call, timeout] of pendingCalls) {
      if (answerCall(call)) {
        clearTimeout(timeout);
        pendingCalls.delete(call);
      }
    }
    renderTiles();
    syncOutgoing();
  }

  function roomClosed() {
    generation++;
    connected = false;
    busy = false;
    audioEnabled = false;
    callSequence = 0;
    for (const timeout of pendingCalls.values()) clearTimeout(timeout);
    for (const call of pendingCalls.keys()) call.close();
    pendingCalls.clear();
    for (const id of outgoing.keys()) closeOutgoing(id);
    for (const id of incoming.keys()) closeIncoming(id);
    if (localStream) localStream.getTracks().forEach((track) => track.stop());
    localStream = null;
    streams.clear();
    incomingSequences.clear();
    for (const tile of tiles.values()) {
      tile.video.srcObject = null;
      tile.audio.srcObject = null;
      tile.element.remove();
    }
    tiles.clear();
    refreshControls();
    setStatus("Bli med i et rom for å bruke lyd og bilde.");
  }

  function publishTracks() {
    for (const id of outgoing.keys()) closeOutgoing(id);
    if (!room.setMediaState(Boolean(liveTrack("video")), Boolean(liveTrack("audio")))) {
      localStream.getTracks().forEach((track) => { track.stop(); localStream.removeTrack(track); });
      renderTiles();
      setStatus("Forbindelsen til rommet ble brutt. Kamera og mikrofon er slått av.", true);
      return false;
    }
    syncOutgoing();
    renderTiles();
    return true;
  }

  async function toggleTrack(kind) {
    if (!room.connected || !localStream || busy) return;
    const track = liveTrack(kind);
    const label = kind === "video" ? "Kamera" : "Mikrofon";
    if (track) {
      track.stop();
      localStream.removeTrack(track);
      if (publishTracks()) setStatus(`${label} er slått av.`);
      return;
    }
    busy = true;
    refreshControls();
    setStatus(`Venter på tillatelse til ${kind === "video" ? "kamera" : "mikrofon"} …`);
    const requestGeneration = generation;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: kind === "video", audio: kind === "audio" });
      if (requestGeneration !== generation || !room.connected || !localStream) {
        stream.getTracks().forEach((item) => item.stop());
        return;
      }
      const added = stream.getTracks().find((item) => item.kind === kind);
      if (!added) {
        stream.getTracks().forEach((item) => item.stop());
        setStatus(`Nettleseren fant ikke ${kind === "video" ? "kamera" : "mikrofon"}.`, true);
        return;
      }
      stream.getTracks().filter((item) => item !== added).forEach((item) => item.stop());
      localStream.addTrack(added);
      added.addEventListener("ended", () => {
        if (!localStream || !localStream.getTracks().includes(added)) return;
        localStream.removeTrack(added);
        if (publishTracks()) setStatus(`${label} ble avbrutt. Slå den på igjen hvis du vil.`, true);
      });
      if (publishTracks()) setStatus(`${label} er slått på.`);
    } catch (error) {
      if (requestGeneration !== generation) return;
      const reason = error.name === "NotAllowedError" ? "Tilgang ble ikke gitt i nettleseren."
        : error.name === "NotFoundError" ? "Enheten ble ikke funnet."
          : error.name === "NotReadableError" ? "Enheten kan være i bruk av et annet program."
            : `Nettleseren meldte ${error.name || "en ukjent feil"}.`;
      setStatus(`Kunne ikke slå på ${kind === "video" ? "kamera" : "mikrofon"}. ${reason}`, true);
    } finally {
      if (requestGeneration === generation) {
        busy = false;
        refreshControls();
      }
    }
  }

  cameraButton.addEventListener("click", () => toggleTrack("video"));
  microphoneButton.addEventListener("click", () => toggleTrack("audio"));
  retryButton.addEventListener("click", () => {
    restartOutgoing();
    setStatus("Prøver å sende lyd og bilde på nytt.");
  });
  hearButton.addEventListener("click", () => {
    if (audioEnabled) {
      audioEnabled = false;
      muteRemoteAudio();
      refreshControls();
      setStatus("Lyden fra andre er dempet.");
      return;
    }
    audioEnabled = true;
    renderTiles();
    for (const member of room.members) {
      const tile = tiles.get(member.peerId);
      if (member.name !== room.self && member.microphone && tile && !tile.audio.muted) playRemoteAudio(tile);
    }
    setStatus("Spiller av lyd fra andre. Bruk gjerne hodetelefoner.");
  });

  window.roomMedia = { roomChanged, roomClosed, receiveCall };
})();
