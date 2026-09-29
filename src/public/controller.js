/*
    Copyright (C) 2026 SigmaZPolic2137
    
    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as
    published by the Free Software Foundation, either version 3 of the
    License, or (at your option) any later version.
*/

const Socket = io();

const JoinScreen = document.getElementById("join-screen");
const ControllerScreen = document.getElementById("controller-screen");
const PlayerNameInput = document.getElementById("player-name");
const RoomNameInput = document.getElementById("room-name");
const RoomPasswordInput = document.getElementById("room-password");
const RoomList = document.getElementById("room-list");
const JoinError = document.getElementById("join-error");
const MyColor = document.getElementById("my-color");
const MyName = document.getElementById("my-name");
const Status = document.getElementById("controller-status");
const Pad = document.getElementById("pad");
const ReadyButton = document.getElementById("btn-ready");
const PadArrow = document.getElementById("pad-arrow");
const PadLabel = document.getElementById("pad-label");

let InRoom = false;
let AutoStart = false;
let Ready = false;
let Playing = false;
let Holding = false;
const ActivePointers = new Set();

function Storage(Key, Value) {
    try {
        if (Value === undefined) return localStorage.getItem(Key) || "";
        localStorage.setItem(Key, Value);
    } catch {
        return "";
    }
}

PlayerNameInput.value = Storage("PlayerName");
RoomNameInput.value = new URLSearchParams(location.search).get("room") || "";

// (:) //

function RefreshRooms() {
    if (InRoom || !Socket.connected) return;

    Socket.emit("listRooms", (Rooms) => {
        RoomList.innerHTML = "";

        if (Rooms.length === 0) {
            RoomList.innerHTML = '<p class="muted">Brak pokoi. Utwórz pokój na ekranie (host.html).</p>';
            return;
        }

        for (const Room of Rooms) {
            const Button = document.createElement("button");
            Button.className = "room-button";
            Button.classList.toggle("selected", Room.RoomName === RoomNameInput.value);
            Button.disabled = Room.InGame || Room.Players >= Room.MaxPlayers;

            const Name = document.createElement("span");
            Name.textContent = (Room.HasPassword ? "🔒 " : "") + Room.RoomName;

            const Info = document.createElement("span");
            Info.textContent = Room.InGame ? "Gra trwa..." : `${Room.Players}/${Room.MaxPlayers}`;

            Button.append(Name, Info);
            Button.onclick = () => {
                RoomNameInput.value = Room.RoomName;
                RefreshRooms();
            };

            RoomList.appendChild(Button);
        }
    });
}

setInterval(RefreshRooms, 2000);
Socket.on("connect", RefreshRooms);

document.getElementById("btn-join").addEventListener("click", () => {
    const PlayerName = PlayerNameInput.value;
    const RoomName = RoomNameInput.value.trim();
    const Password = RoomPasswordInput.value;

    JoinError.textContent = "";

    Socket.emit("joinRoom", { RoomName, PlayerName, Password }, (Response) => {
        if (!Response.Success) {
            JoinError.textContent = Response.Message;
            return;
        }

        AutoStart = Boolean(Response.AutoStart);
        Storage("PlayerName", PlayerName.trim());
        ShowController(PlayerName.trim());
    });
});

document.getElementById("btn-leave").addEventListener("click", () => {
    Socket.emit("leaveRoom", () => ShowJoin(""));
});

// Przycisk gotowości – widoczny tylko, gdy host włączył automatyczny start, i tylko między rundami.
// Czerwony: nie gotowy, zielony: gotowy. Gdy wszyscy są gotowi, gra startuje sama po odliczaniu.
ReadyButton.addEventListener("click", () => {
    Socket.emit("setReady", { Ready: !Ready }, (Response) => {
        if (!Response.Success) return;

        SetReady(Response.Ready);
        SetStatus(LobbyStatus());
    });
});

function SetReady(Value) {
    Ready = Value;
    ReadyButton.textContent = Value ? "Gotowy ✓" : "Nie gotowy ✗";
    ReadyButton.classList.toggle("ready", Value);
}

function ShowReadyButton(Value) {
    ReadyButton.classList.toggle("hidden", !Value || !AutoStart);
    if (!Value) SetReady(false);
}

function LobbyStatus() {
    if (!AutoStart) return "Czekam, aż host rozpocznie grę…";
    if (!Ready) return "Naciśnij czerwony przycisk „Nie gotowy”, gdy będziesz gotowy do gry.";
    return "Jesteś gotowy! Gra wystartuje, gdy wszyscy będą gotowi.";
}

// D:D //

function ShowController(PlayerName) {
    InRoom = true;
    MyName.textContent = PlayerName;
    MyColor.style.background = "transparent";
    SetReady(false);
    ShowReadyButton(true);
    SetStatus(LobbyStatus());
    SetPlaying(false);
    Pad.style.background = "";

    JoinScreen.classList.add("hidden");
    ControllerScreen.classList.remove("hidden");
}

function ShowJoin(Message) {
    InRoom = false;
    ShowReadyButton(false);
    SetPlaying(false);
    SetPadPaused(false);

    ControllerScreen.classList.add("hidden");
    JoinScreen.classList.remove("hidden");
    JoinError.textContent = Message;

    RefreshRooms();
}

function SetStatus(Text) {
    Status.textContent = Text;
}

// Podczas pauzy przycisk pokazuje, że gra stoi.
function SetPadPaused(Value) {
    PadArrow.textContent = Value ? "⏸" : "⬆";
    PadLabel.textContent = Value ? "PAUZA" : "TRZYMAJ";
}

function SetPlaying(Value) {
    Playing = Value;
    Pad.classList.toggle("disabled", !Value);
    if (!Value) SetHolding(false);
}

function SetHolding(Value) {
    if (Holding === Value) return;
    Holding = Value;
    Pad.classList.toggle("pressed", Value);

    if (Playing || !Value) Socket.emit("input", { Holding: Value });
}

// Trzymanie przycisku: działa dotykiem, myszką i spacją (do testów na komputerze).

Pad.addEventListener("pointerdown", (Event) => {
    Event.preventDefault();
    Pad.setPointerCapture(Event.pointerId);
    ActivePointers.add(Event.pointerId);
    SetHolding(true);
});

function ReleasePointer(Event) {
    ActivePointers.delete(Event.pointerId);
    if (ActivePointers.size === 0) SetHolding(false);
}

Pad.addEventListener("pointerup", ReleasePointer);
Pad.addEventListener("pointercancel", ReleasePointer);
Pad.addEventListener("lostpointercapture", ReleasePointer);
Pad.addEventListener("contextmenu", (Event) => Event.preventDefault());

document.addEventListener("keydown", (Event) => {
    if (!InRoom || Event.repeat) return;
    if (Event.code === "Space" || Event.code === "ArrowUp") {
        Event.preventDefault();
        SetHolding(true);
    }
});

document.addEventListener("keyup", (Event) => {
    if (Event.code === "Space" || Event.code === "ArrowUp") SetHolding(false);
});

window.addEventListener("blur", () => {
    ActivePointers.clear();
    SetHolding(false);
});

document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
        ActivePointers.clear();
        SetHolding(false);
    }
});

// L:L //

Socket.on("playerStatus", (Data) => {
    if (Data.Color) {
        MyColor.style.background = Data.Color;
        Pad.style.background = Data.Color;
    }

    SetPadPaused(Data.State === "paused");

    // W trakcie gry gotowość nie ma znaczenia; serwer i tak ją zeruje na starcie.
    ShowReadyButton(false);

    if (Data.State === "countdown") {
        SetPlaying(false);
        SetStatus("Przygotuj się! Trzymaj, żeby lecieć w górę, puść, żeby spadać.");
    } else if (Data.State === "paused") {
        SetPlaying(false);
        SetStatus("Gra została zatrzymana przez hosta. Po wznowieniu będzie odliczanie.");
        if (navigator.vibrate) navigator.vibrate(100);
    } else if (Data.State === "playing") {
        SetPlaying(true);
        // Gracz mógł już trzymać palec na przycisku podczas odliczania.
        if (Holding) Socket.emit("input", { Holding: true });
        SetStatus("Leć! Unikaj kolców.");
    } else if (Data.State === "eliminated") {
        SetPlaying(false);
        SetStatus(`Odpadłeś! Miejsce ${Data.Place}/${Data.Total}, dystans ${Data.Score} m.`);
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    }
});

Socket.on("hit", () => {
    SetStatus("Au! Kolec cię spowolnił.");
    if (navigator.vibrate) navigator.vibrate(150);

    ControllerScreen.classList.remove("hit");
    void ControllerScreen.offsetWidth;
    ControllerScreen.classList.add("hit");

    setTimeout(() => {
        if (Playing) SetStatus("Leć! Unikaj kolców.");
    }, 2000);
});

Socket.on("gameOver", ({ Results }) => {
    SetPlaying(false);
    SetPadPaused(false);

    const Mine = Results.find(Result => Result.ID === Socket.id);
    const Summary = Mine ? `Koniec gry! Miejsce ${Mine.Place}/${Results.length}, dystans ${Mine.Score} m.` : "Koniec gry!";

    ShowReadyButton(true);
    SetStatus(`${Summary} ${AutoStart ? LobbyStatus() : "Czekaj na kolejną rundę…"}`);
});

Socket.on("roomClosed", () => ShowJoin("Host zamknął pokój."));
Socket.on("kicked", (Data) => ShowJoin(Data.Message));

Socket.on("disconnect", () => {
    if (InRoom) ShowJoin("Utracono połączenie z serwerem.");
});
