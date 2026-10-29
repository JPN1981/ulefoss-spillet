(() => {
  const $ = (id) => document.getElementById(id);
  const nameInput = $("room-name");
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
  let hostName = "";
  let timer = null;

  function setStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle("error", isError);
  }

  function setBusy(busy) {
    nameInput.disabled = busy;
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
    hostName = "";
    if (oldPeer) oldPeer.destroy();
    showMembers([]);
    setBusy(false);
    setStatus(message, isError);
  }

  function validName(name) {
    return typeof name === "string" && name.trim().length > 0 && name.length <= 30;
  }

  function getName() {
    const name = nameInput.value.trim();
    if (!validName(name)) {
      setStatus("Skriv inn et navn på opptil 30 tegn.", true);
      nameInput.focus();
      return null;
    }
    return name;
  }

  function makeCode() {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  }

  function sendRoster() {
    const names = [hostName, ...Array.from(guests.values(), (guest) => guest.name).filter(Boolean)];
    showMembers(names);
    for (const guest of guests.values()) {
      if (guest.name && guest.connection.open) {
        guest.connection.send({ type: "roster", names });
      }
    }
  }

  function acceptGuest(connection) {
    if (guests.size >= maxGuests) {
      connection.on("open", () => {
        connection.send({ type: "rejected", reason: "Rommet er fullt (maks seks deltakere)." });
        setTimeout(() => connection.close(), 1000);
      });
      connection.on("error", () => connection.close());
      return;
    }
    const entry = { connection, name: "", timeout: null };
    guests.set(connection.peer, entry);
    entry.timeout = setTimeout(() => connection.close(), timeoutMs);
    connection.on("data", (message) => {
      if (entry.name || !message || message.type !== "hello" || !validName(message.name)) return;
      entry.name = message.name.trim();
      clearTimeout(entry.timeout);
      sendRoster();
      setStatus(`${entry.name} ble med i rommet.`);
    });
    const remove = () => {
      clearTimeout(entry.timeout);
      if (guests.get(connection.peer) !== entry) return;
      guests.delete(connection.peer);
      sendRoster();
      if (entry.name) setStatus(`${entry.name} forlot rommet.`);
    };
    connection.on("close", remove);
    connection.on("error", () => {
      remove();
      setStatus("En deltaker mistet forbindelsen.", true);
    });
  }

  function startPeer(id, name, isHost) {
    if (typeof Peer !== "function") {
      setStatus("PeerJS kunne ikke lastes. Kontroller internettforbindelsen og last siden på nytt.", true);
      return;
    }
    setBusy(true);
    setStatus(isHost ? "Oppretter rom …" : "Kobler til rommet …");
    const current = isHost ? new Peer(id) : new Peer();
    peer = current;
    timer = setTimeout(() => {
      if (peer === current) reset("Tilkoblingen tok for lang tid. Prøv igjen eller prøv et annet nettverk.", true);
    }, timeoutMs);
    current.on("open", () => {
      if (peer !== current) return;
      if (isHost) {
        clearTimeout(timer);
        timer = null;
        hostName = name;
        showMembers([`${name} (vert)`]);
        setStatus(`Rom ${codeInput.value} er klart. Del romkoden med de andre.`);
        return;
      }
      const connection = current.connect(id, { reliable: true });
      connection.on("open", () => connection.send({ type: "hello", name }));
      connection.on("data", (message) => {
        if (peer !== current || !message || typeof message !== "object") return;
        if (message.type === "rejected") {
          reset(message.reason === "Rommet er fullt (maks seks deltakere)." ? message.reason : "Du kunne ikke bli med i rommet.", true);
        } else if (message.type === "roster" && Array.isArray(message.names) &&
          message.names.length >= 1 && message.names.length <= 6 && message.names.every(validName)) {
          clearTimeout(timer);
          timer = null;
          showMembers(message.names);
          setStatus(`Du er med i rom ${codeInput.value}.`);
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
      if (peer !== current || !isHost) {
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
    const name = getName();
    if (!name) return;
    if (!globalThis.crypto || !crypto.getRandomValues) {
      setStatus("Nettleseren støtter ikke sikker generering av romkoder.", true);
      return;
    }
    codeInput.value = makeCode();
    startPeer(prefix + codeInput.value, name, true);
  });

  joinButton.addEventListener("click", () => {
    const name = getName();
    if (!name) return;
    const code = codeInput.value.trim().toUpperCase();
    if (!/^[A-HJ-NP-Z2-9]{8}$/.test(code)) {
      setStatus("Skriv inn en gyldig romkode på åtte tegn.", true);
      codeInput.focus();
      return;
    }
    codeInput.value = code;
    startPeer(prefix + code, name, false);
  });

  leaveButton.addEventListener("click", () => reset("Du har forlatt rommet."));
  window.addEventListener("pagehide", () => {
    if (peer) reset("Du er ikke i et rom.");
  });
})();
