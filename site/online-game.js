(() => {
  const room = window.roomConnection;
  const status = $("online-game-status");
  const turnStatus = $("online-turn-status");
  const setup = $("player-setup");
  const description = $("setup-description");
  const start = $("start-game");
  const newGame = $("new-game");
  const dice = $("roll-dice");
  let connected = false;
  let started = false;
  let pending = false;
  let pendingTimer = null;
  let scheduled = false;
  let localSetup = null;
  let notice = "";
  let gameId = 0;

  function setPending(value) {
    pending = value;
    clearTimeout(pendingTimer);
    pendingTimer = null;
    if (value) {
      pendingTimer = setTimeout(() => {
        pending = false;
        notice = "Verten svarte ikke. Kontroller forbindelsen og prøv igjen.";
        updateControls();
      }, 10000);
    }
  }

  function currentName() {
    return activePlayers()[state.turn]?.name;
  }

  function canAct() {
    return started && room.connected && currentName() === room.self && !state.winner && !turnPending && !pending;
  }

  function updateControls() {
    const inRoom = room.connected;
    setup.hidden = inRoom;
    description.hidden = inRoom;
    status.hidden = !inRoom;
    turnStatus.hidden = !inRoom;
    start.textContent = inRoom ? "Start felles spill" : "Start spill";
    start.disabled = inRoom && (!room.isHost || started || room.names.length < 2);
    newGame.disabled = inRoom && (!room.isHost || !started);
    if (!inRoom) return;
    dice.disabled = !canAct() || state.rolled || state.moving || state.awaitingAnswer;
    $("answers").querySelectorAll("button").forEach((button) => {
      button.disabled = !canAct() || !state.awaitingAnswer || state.moving;
    });
    if (notice) status.textContent = notice;
    else if (!started) status.textContent = room.isHost
      ? "Vent til alle er med, og trykk Start felles spill. Minst to deltakere trengs."
      : `Du er ${room.self}. Vent til verten starter spillet.`;
    else if (state.winner) status.textContent = `${state.winner.name} vant! Verten kan starte et nytt spill.`;
    else if (currentName() === room.self) status.textContent = `Du er ${room.self}. Det er din tur.`;
    else status.textContent = `Du er ${room.self}. Vent på ${currentName()}.`;
    turnStatus.textContent = status.textContent;
  }

  function snapshot() {
    const image = $("card-image");
    return {
      gameId,
      players: players.map(({ name, active, space, score, jailed }) => ({ name, active, space, score, jailed })),
      turn: state.turn,
      round: state.round,
      rolled: state.rolled,
      moving: state.moving,
      awaitingAnswer: state.awaitingAnswer,
      turnPending,
      winnerIndex: state.winner ? players.indexOf(state.winner) : -1,
      die: $("die-face").textContent,
      diceResult: $("dice-result").textContent,
      boardMessage: $("board-message").textContent,
      card: {
        type: $("card-type").textContent,
        title: $("card-title").textContent,
        text: $("card-text").textContent,
        image: image.hidden ? "" : image.getAttribute("src"),
        answers: Array.from($("answers").querySelectorAll("button"), (button) => button.textContent),
        feedback: $("answer-feedback").textContent,
        feedbackVisible: $("card-panel").classList.contains("answer-revealed"),
      },
    };
  }

  function changed() {
    if (!connected || !started || !room.isHost || scheduled) return;
    scheduled = true;
    setTimeout(() => {
      scheduled = false;
      if (!room.connected || !started || !room.isHost) return;
      updateControls();
      room.broadcast({ type: "game-state", state: snapshot() });
    }, 0);
  }

  function validState(data) {
    if (!data || !Number.isSafeInteger(data.gameId) || data.gameId < 1 ||
      !Array.isArray(data.players) || data.players.length !== players.length ||
      !Number.isInteger(data.turn) || !Number.isInteger(data.round) || data.round < 1 ||
      !Number.isInteger(data.winnerIndex) || data.winnerIndex < -1 || data.winnerIndex >= players.length ||
      !["rolled", "moving", "awaitingAnswer", "turnPending"].every((key) => typeof data[key] === "boolean")) return false;
    const active = data.players.filter((player) => player && player.active);
    if (active.length !== room.names.length || data.turn < 0 || data.turn >= active.length ||
      !active.every((player, index) => player.name === room.names[index])) return false;
    if (!data.players.every((player) => player && typeof player.name === "string" &&
      typeof player.active === "boolean" && Object.prototype.hasOwnProperty.call(spaces, player.space) &&
      Number.isInteger(player.score) && player.score >= 0 &&
      Number.isInteger(player.jailed) && player.jailed >= 0)) return false;
    const card = data.card;
    return ["die", "diceResult", "boardMessage"].every((key) => typeof data[key] === "string" && data[key].length <= 500) &&
      card && ["type", "title", "text", "image", "feedback"].every((key) => typeof card[key] === "string" && card[key].length <= 2000) &&
      typeof card.feedbackVisible === "boolean" &&
      (!card.image || Object.values(imageBySource).includes(card.image)) &&
      Array.isArray(card.answers) && card.answers.length <= 6 &&
      card.answers.every((answer) => typeof answer === "string" && answer.length <= 1000);
  }

  function receiveState(data) {
    if (!room.connected || room.isHost) return;
    if (!validState(data)) {
      notice = "Ugyldige spilldata fra verten. Prøv å opprette rommet på nytt.";
      updateControls();
      return;
    }
    if (gameId !== data.gameId) resetGame();
    gameId = data.gameId;
    started = true;
    notice = "";
    setPending(false);
    data.players.forEach((player, index) => Object.assign(players[index], player));
    Object.assign(state, {
      turn: data.turn,
      round: data.round,
      rolled: data.rolled,
      moving: data.moving,
      awaitingAnswer: data.awaitingAnswer,
      winner: data.winnerIndex < 0 ? null : players[data.winnerIndex],
    });
    turnPending = data.turnPending;
    $("die-face").textContent = data.die;
    $("dice-result").textContent = data.diceResult;
    $("board-message").textContent = data.boardMessage;
    $("card-type").textContent = data.card.type;
    $("card-title").textContent = data.card.title;
    $("card-text").textContent = data.card.text;
    $("answer-feedback").textContent = data.card.feedback;
    $("answer-feedback").className = `answer-feedback ${data.card.feedback === "RIKTIG SVAR" ? "correct" : "wrong"}`;
    $("card-panel").classList.toggle("answer-revealed", data.card.feedbackVisible);
    $("card-image").hidden = !data.card.image;
    if (data.card.image) {
      $("card-image").src = data.card.image;
      $("card-image").alt = `Illustrasjon til ${data.card.title}`;
    }
    $("answers").replaceChildren();
    data.card.answers.forEach((answer, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "answer";
      button.textContent = answer;
      button.addEventListener("click", () => sendAction({ type: "answer", index }));
      $("answers").appendChild(button);
    });
    render();
    updateControls();
  }

  function sendAction(action) {
    if (!canAct()) return;
    if (!room.send({ type: "game-action", action })) {
      notice = "Forbindelsen til verten er brutt.";
      updateControls();
      return;
    }
    notice = "";
    setPending(true);
    updateControls();
  }

  function receiveAction(sender, action) {
    if (!started || !room.isHost || !action || sender !== currentName() || state.winner || turnPending) {
      changed();
      return;
    }
    if (action.type === "roll" && !state.rolled && !state.moving && !state.awaitingAnswer) {
      rollDice();
    } else if (action.type === "answer" && state.awaitingAnswer && !state.moving && currentCard &&
      Number.isInteger(action.index) && action.index >= 0 && action.index < currentCard.answers.length) {
      answerQuestion(action.index, currentCard);
      answerRevealed(action.index === currentCard.correct);
    }
    changed();
  }

  function startSharedGame() {
    if (!room.isHost || room.names.length < 2) return;
    notice = "";
    started = true;
    gameId++;
    setPending(false);
    players.forEach((player, index) => {
      player.active = index < room.names.length;
      player.name = room.names[index] || `Spiller ${index + 1}`;
    });
    resetGame();
    updateControls();
    changed();
  }

  function answerRevealed(correct) {
    if (!started || !room.isHost) return;
    $("answer-feedback").className = `answer-feedback ${correct ? "correct" : "wrong"}`;
    $("answer-feedback").textContent = correct ? "RIKTIG SVAR" : "FEIL SVAR";
    $("card-panel").classList.add("answer-revealed");
    changed();
    gameDelay(() => {
      $("card-panel").classList.remove("answer-revealed");
      changed();
    }, 2000);
  }

  function endSharedGame(message) {
    started = false;
    if (!room.isHost) gameId = 0;
    setPending(false);
    notice = message;
    resetGame();
    updateControls();
  }

  function roomChanged() {
    if (room.connected && !connected) {
      connected = true;
      localSetup = players.map(({ name, active }) => ({ name, active }));
      notice = "";
      resetGame();
    } else if (!room.connected && connected) {
      connected = false;
      started = false;
      gameId = 0;
      setPending(false);
      if (localSetup) localSetup.forEach((player, index) => Object.assign(players[index], player));
      localSetup = null;
      notice = "";
      renderSetup();
      resetGame();
    }
    updateControls();
  }

  window.onlineGame = {
    get started() { return started; },
    changed,
    roomChanged,
    receiveState,
    receiveAction,
    answerRevealed,
    sendCurrentState() { changed(); },
    canLocalAct() { return !room.connected || (room.isHost && canAct()); },
    handleRoll() {
      if (!room.connected) return false;
      if (!canAct()) return true;
      if (room.isHost) return false;
      sendAction({ type: "roll" });
      return true;
    },
    handleStart() {
      if (!room.connected) return false;
      if (!started) startSharedGame();
      return true;
    },
    handleReset() {
      if (!room.connected) return false;
      if (room.isHost && started) startSharedGame();
      return true;
    },
    participantLeft(name) {
      if (!started || !room.isHost) return;
      room.broadcast({ type: "game-aborted" });
      endSharedGame(`${name} forlot rommet. Spillet ble avsluttet; verten kan starte på nytt.`);
    },
    gameAborted() {
      if (!started || room.isHost) return;
      endSharedGame("En deltaker forlot rommet. Spillet ble avsluttet; vent på at verten starter på nytt.");
    },
  };
})();
