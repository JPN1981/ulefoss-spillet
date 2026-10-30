(() => {
  const $ = (id) => document.getElementById(id);
  const codeInput = $("room-code");
  const createButton = $("create-room");
  const joinButton = $("join-room");
  const leaveButton = $("leave-room");
  const status = $("room-status");
  const memberList = $("room-member-list");
  const membersPanel = $("room-members");
  const prefix = "ulefoss-lobby-";
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const maxGuests = 5;
  const timeoutMs = 20000;

  let peer = null;
  let guests = new Map();
  let timer = null;
  let isHost = false;
  let self = "";
  let names = [];
  let hostConnection = null;

  window.roomConnection = {
    get connected() { return Boolean(self); },
    get isHost() { return isHost; },
    get self() { return self; },
    get names() { return names.slice(); },
    broadcast(message) {
      for (const guest of guests.values()) {
        if (guest.name && guest.connection.open) guest.connection.send(message);
      }
    },
    send(message) {
      if (!hostConnection || !hostConnection.open) return false;
      hostConnection.send(message);
      return true;
    },
  };

  function setStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle("error", isError);
  }

  function setBusy(busy) {
    codeInput.disabled = busy;
    createButton.disabled = busy;
    joinButton.disabled = busy;
    leaveButton.disabled = !busy;
  }

  function showMembers(names) {
    memberList.replaceChildren();
    names.forEach((name) => {
      const item = document.createElement("li");
      item.textContent = name;
      memberList.appendChild(item);
    });
    membersPanel.hidden = names.length === 0;
  }

  function reset(message, isError = false) {
    clearTimeout(timer);
    timer = null;
    const oldPeer = peer;
    peer = null;
    guests = new Map();
    hostConnection = null;
    isHost = false;
    self = "";
    names = [];
    if (oldPeer) oldPeer.destroy();
    showMembers([]);
    setBusy(false);
    setStatus(message, isError);
    window.onlineGame?.roomChanged();
  }

  function validName(name) {
    return typeof name === "string" && name.trim().length > 0 && name.length <= 30;
  }

  function makeCode() {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  }

  function sendRoster() {
    names = ["Vert", ...Array.from(guests.values(), (guest) => guest.name).filter(Boolean)];
    showMembers(names);
    for (const guest of guests.values()) {
      if (guest.name && guest.connection.open) {
        guest.connection.send({ type: "roster", names, self: guest.name });
      }
    }
    window.onlineGame?.roomChanged();
  }

  function acceptGuest(connection) {
    if (guests.size >= maxGuests || window.onlineGame?.started) {
      connection.on("open", () => {
        const reason = window.onlineGame?.started ? "Spillet har startet. Vent til verten starter et nytt spill." : "Rommet er fullt (maks seks deltakere).";
        connection.send({ type: "rejected", reason });
        setTimeout(() => connection.close(), 1000);
      });
      connection.on("error", () => connection.close());
      return;
    }
    const entry = { connection, name: "", timeout: null };
    guests.set(connection.peer, entry);
    entry.timeout = setTimeout(() => connection.close(), timeoutMs);
    connection.on("data", (message) => {
      if (entry.name && message?.type === "game-action") {
        window.onlineGame?.receiveAction(entry.name, message.action);
        return;
      }
      if (entry.name || !message || message.type !== "hello") return;
      if (window.onlineGame?.started) {
        connection.send({ type: "rejected", reason: "Spillet har startet. Vent til verten starter et nytt spill." });
        setTimeout(() => connection.close(), 1000);
        return;
      }
      const usedNames = new Set(Array.from(guests.values(), (guest) => guest.name));
      for (let number = 2; number <= maxGuests + 1; number++) {
        const name = `Spiller ${number}`;
        if (!usedNames.has(name)) {
          entry.name = name;
          break;
        }
      }
      clearTimeout(entry.timeout);
      sendRoster();
      setStatus(`${entry.name} ble med i rommet.`);
    });
    const remove = () => {
      clearTimeout(entry.timeout);
      if (guests.get(connection.peer) !== entry) return;
      guests.delete(connection.peer);
      if (entry.name) window.onlineGame?.participantLeft(entry.name);
      sendRoster();
      if (entry.name) setStatus(`${entry.name} forlot rommet.`);
    };
    connection.on("close", remove);
    connection.on("error", () => {
      remove();
      setStatus("En deltaker mistet forbindelsen.", true);
    });
  }

  function startPeer(id, hosting) {
    if (!window.onlineGame) {
      setStatus("Spillmodulen kunne ikke lastes. Kontroller internettforbindelsen og last siden på nytt.", true);
      return;
    }
    if (typeof Peer !== "function") {
      setStatus("PeerJS kunne ikke lastes. Kontroller internettforbindelsen og last siden på nytt.", true);
      return;
    }
    setBusy(true);
    setStatus(hosting ? "Oppretter rom …" : "Kobler til rommet …");
    const current = hosting ? new Peer(id) : new Peer();
    peer = current;
    timer = setTimeout(() => {
      if (peer === current) reset("Tilkoblingen tok for lang tid. Prøv igjen eller prøv et annet nettverk.", true);
    }, timeoutMs);
    current.on("open", () => {
      if (peer !== current) return;
      if (hosting) {
        clearTimeout(timer);
        timer = null;
        isHost = true;
        self = "Vert";
        names = ["Vert"];
        showMembers(["Vert"]);
        setStatus(`Rom ${codeInput.value} er klart. Del romkoden med de andre.`);
        window.onlineGame?.roomChanged();
        return;
      }
      const connection = current.connect(id, { reliable: true });
      hostConnection = connection;
      connection.on("open", () => connection.send({ type: "hello", name: "Spiller" }));
      connection.on("data", (message) => {
        if (peer !== current || !message || typeof message !== "object") return;
        if (message.type === "rejected") {
          const knownReasons = ["Rommet er fullt (maks seks deltakere).", "Spillet har startet. Vent til verten starter et nytt spill."];
          reset(knownReasons.includes(message.reason) ? message.reason : "Du kunne ikke bli med i rommet.", true);
        } else if (message.type === "roster" && Array.isArray(message.names) &&
          message.names.length >= 1 && message.names.length <= 6 && message.names[0] === "Vert" &&
          message.names.every((name, index) => validName(name) && (index === 0 || /^Spiller [2-6]$/.test(name))) &&
          new Set(message.names).size === message.names.length && message.names.includes(message.self)) {
          clearTimeout(timer);
          timer = null;
          names = message.names;
          self = message.self;
          showMembers(message.names);
          setStatus(`Du er med i rom ${codeInput.value}.`);
          window.onlineGame?.roomChanged();
        } else if (message.type === "game-state") {
          window.onlineGame?.receiveState(message.state);
        } else if (message.type === "game-aborted") {
          window.onlineGame?.gameAborted();
        }
      });
      connection.on("close", () => {
        if (peer === current) reset("Forbindelsen til verten ble brutt. Rommet er avsluttet.", true);
      });
      connection.on("error", () => {
        if (peer === current) reset("Kunne ikke koble til verten. Prøv igjen eller prøv et annet nettverk.", true);
      });
    });
    current.on("connection", (connection) => {
      if (peer !== current || !hosting) {
        connection.close();
        return;
      }
      acceptGuest(connection);
    });
    current.on("disconnected", () => {
      if (peer === current) reset("Forbindelsen til PeerJS-tjenesten ble brutt. Prøv igjen.", true);
    });
    current.on("error", (error) => {
      if (peer !== current) return;
      const message = error.type === "peer-unavailable" ? "Fant ikke rommet. Sjekk romkoden og at verten fortsatt er tilkoblet."
        : error.type === "unavailable-id" ? "Romkoden er opptatt. Opprett et nytt rom."
          : `Tilkoblingsfeil (${error.type || "ukjent"}). Prøv igjen.`;
      reset(message, true);
    });
  }

  createButton.addEventListener("click", () => {
    if (!globalThis.crypto || !crypto.getRandomValues) {
      setStatus("Nettleseren støtter ikke sikker generering av romkoder.", true);
      return;
    }
    codeInput.value = makeCode();
    startPeer(prefix + codeInput.value, true);
  });

  joinButton.addEventListener("click", () => {
    const code = codeInput.value.trim().toUpperCase();
    if (!/^[A-HJ-NP-Z2-9]{8}$/.test(code)) {
      setStatus("Skriv inn en gyldig romkode på åtte tegn.", true);
      codeInput.focus();
      return;
    }
    codeInput.value = code;
    startPeer(prefix + code, false);
  });

  leaveButton.addEventListener("click", () => reset("Du har forlatt rommet."));
  window.addEventListener("pagehide", () => {
    if (peer) reset("Du er ikke i et rom.");
  });
})();
