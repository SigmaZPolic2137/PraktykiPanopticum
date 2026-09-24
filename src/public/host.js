const Socket = io();

// Dynamically calculated based on viewport dimensions to remove empty space padding
const World = { Width: 1600, Height: 900, GroundY: 800 };
const PlayerSize = 44;
const RenderDelay = 0.1;

const Canvas = document.getElementById("game-canvas");
const Ctx = Canvas.getContext("2d");

const CreateScreen = document.getElementById("create-screen");
const LobbyScreen = document.getElementById("lobby-screen");
const ResultsScreen = document.getElementById("results-screen");
const PlayerList = document.getElementById("player-list");
const StartButton = document.getElementById("btn-start");

let CurrentRoomName = "";
let Snapshots = [];
let SmoothPlayerAngles = new Map();
let ClockOffset = null;
let GameVisible = false;

document.getElementById("room-name").value = "Pokój " + Math.floor(100 + Math.random() * 900);

// (:) //

function ShowScreen(Screen) {
    for (const Element of [CreateScreen, LobbyScreen, ResultsScreen]) {
        if (Element) Element.classList.toggle("hidden", Element !== Screen);
    }
}

async function ShowJoinAddresses() {
    const Container = document.getElementById("join-addresses");
    if (!Container) return;
    const Urls = [];

    try {
        const Response = await fetch("/api/addresses");
        const { Addresses, Port } = await Response.json();
        for (const Address of Addresses) Urls.push(`http://${Address}:${Port}`);
    } catch {
        // Zostaje adres z paska przeglądarki.
    }

    if (!["localhost", "127.0.0.1"].includes(location.hostname)) Urls.unshift(location.origin);

    Container.innerHTML = "";
    for (const Url of [...new Set(Urls)]) {
        const Element = document.createElement("span");
        Element.className = "address";
        Element.textContent = Url;
        Container.appendChild(Element);
    }

    if (Urls.length === 0) {
        Container.textContent = "Nie udało się ustalić adresu IP komputera – sprawdź go poleceniem `ip addr`.";
    }
}

document.getElementById("btn-create").addEventListener("click", () => {
    const RoomName = document.getElementById("room-name").value;
    const Password = document.getElementById("room-password").value;
    const MaxPlayers = document.getElementById("room-max-players").value;

    Socket.emit("createRoom", { RoomName, Password, MaxPlayers }, (Response) => {
        if (!Response.Success) {
            document.getElementById("create-error").textContent = Response.Message;
            return;
        }

        CurrentRoomName = RoomName.trim();
        document.getElementById("lobby-title").textContent = `Pokój: ${CurrentRoomName}`;
        document.getElementById("create-error").textContent = "";
        RenderPlayerList([], MaxPlayers || 8);
        ShowJoinAddresses();
        ShowScreen(LobbyScreen);
    });
});

document.getElementById("btn-close").addEventListener("click", () => {
    Socket.emit("leaveRoom", () => {
        CurrentRoomName = "";
        ShowScreen(CreateScreen);
    });
});

function StartGame(ErrorElement) {
    Socket.emit("startGame", (Response) => {
        if (!Response.Success) {
            document.getElementById(ErrorElement).textContent = Response.Message;
            return;
        }

        document.getElementById(ErrorElement).textContent = "";
        Snapshots = [];
        ClockOffset = null;
        GameVisible = true;
        ShowScreen(null);
    });
}

if (StartButton) StartButton.addEventListener("click", () => StartGame("lobby-error"));
document.getElementById("btn-again").addEventListener("click", () => StartGame("results-error"));

document.getElementById("btn-lobby").addEventListener("click", () => {
    GameVisible = false;
    ShowScreen(LobbyScreen);
});

function RenderPlayerList(Players, MaxPlayers) {
    if (!PlayerList) return;
    PlayerList.innerHTML = "";
    document.getElementById("player-count").textContent = `(${Players.length}/${MaxPlayers})`;
    if (StartButton) StartButton.disabled = Players.length === 0;

    if (Players.length === 0) {
        PlayerList.innerHTML = '<li class="muted">Czekam na graczy…</li>';
        return;
    }

    for (const Player of Players) {
        const Item = document.createElement("li");

        const Name = document.createElement("span");
        Name.className = "name";
        Name.textContent = Player.PlayerName;

        const KickButton = document.createElement("button");
        KickButton.className = "small danger";
        KickButton.textContent = "Wyrzuć";
        KickButton.onclick = () => Socket.emit("kickPlayer", { TargetSocketID: Player.ID }, () => {});

        Item.append(Name, KickButton);
        PlayerList.appendChild(Item);
    }
}

Socket.on("roomUpdate", (Data) => RenderPlayerList(Data.PlayerSockets, Data.MaxPlayers));

Socket.on("gameState", (Snapshot) => {
    const Now = performance.now() / 1000;
    const Offset = Now - Snapshot.T;

    if (ClockOffset === null || Offset < ClockOffset) ClockOffset = Offset;

    Snapshots.push(Snapshot);
    if (Snapshots.length > 60) Snapshots.shift();
});

Socket.on("gameOver", ({ Results }) => {
    const List = document.getElementById("results-list");
    if (!List) return;
    List.innerHTML = "";

    for (const Result of Results) {
        const Item = document.createElement("li");

        const Dot = document.createElement("span");
        Dot.className = "dot";
        Dot.style.background = Result.Color;

        const Name = document.createElement("span");
        Name.className = "name";
        Name.textContent = `${Result.Place}. ${Result.PlayerName}`;

        const Score = document.createElement("span");
        Score.textContent = `${Result.Score} m`;

        Item.append(Dot, Name, Score);
        List.appendChild(Item);
    }

    document.getElementById("results-error").textContent = "";
    ShowScreen(ResultsScreen);
});

Socket.on("disconnect", () => {
    if (!CurrentRoomName) return;

    CurrentRoomName = "";
    GameVisible = false;
    ShowScreen(CreateScreen);
    document.getElementById("create-error").textContent = "Utracono połączenie z serwerem – pokój został zamknięty.";
});

// D:D //  Rysowanie

function Hash(N) {
    const X = Math.sin(N * 127.1 + 311.7) * 43758.5453;
    return X - Math.floor(X);
}

function Lerp(A, B, T) {
    return A + (B - A) * T;
}

function GetRenderState() {
    if (Snapshots.length === 0) return null;

    const Latest = Snapshots[Snapshots.length - 1];
    const RenderT = performance.now() / 1000 - ClockOffset - RenderDelay;

    let Index = Snapshots.length - 1;
    while (Index > 0 && Snapshots[Index - 1].T > RenderT) Index--;

    const B = Snapshots[Index];
    const A = Snapshots[Index - 1];
    if (RenderT >= Latest.T) return Latest;
    if (!A) return B;

    const T = Math.max(0, Math.min(1, (RenderT - A.T) / (B.T - A.T || 1)));
    const PreviousPlayers = new Map(A.Players.map(Player => [Player.ID, Player]));

    return {
        ...B,
        Distance: Lerp(A.Distance, B.Distance, T),
        Players: B.Players.map(Player => {
            const Previous = PreviousPlayers.get(Player.ID);
            if (!Previous) return Player;
            return { ...Player, X: Lerp(Previous.X, Player.X, T), Y: Lerp(Previous.Y, Player.Y, T) };
        }),
    };
}

function DrawCloud(X, Y, Scale) {
    Ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
    Ctx.beginPath();
    for (const [DX, DY, R] of [[0, 0, 40], [45, -18, 50], [95, 0, 42], [48, 12, 40]]) {
        Ctx.moveTo(X + (DX + R) * Scale, Y + DY * Scale);
        Ctx.arc(X + DX * Scale, Y + DY * Scale, R * Scale, 0, Math.PI * 2);
    }
    Ctx.fill();
}

function DrawScenery(Distance, ViewLeft, ViewRight) {
    // Niebo
    const Sky = Ctx.createLinearGradient(0, -200, 0, World.GroundY);
    Sky.addColorStop(0, "#4aa8e8");
    Sky.addColorStop(1, "#bfe6ff");
    Ctx.fillStyle = Sky;
    Ctx.fillRect(ViewLeft, -2000, ViewRight - ViewLeft, 2000 + World.GroundY);

    // Chmury
    const CloudScroll = Distance * 0.15;
    const CloudSpacing = 320;
    const FirstCloud = Math.floor((ViewLeft + CloudScroll) / CloudSpacing) - 1;
    const LastCloud = Math.ceil((ViewRight + CloudScroll) / CloudSpacing) + 1;
    for (let I = FirstCloud; I <= LastCloud; I++) {
        if (Hash(I + 3) < 0.35) continue;
        const X = I * CloudSpacing + Hash(I) * 180 - CloudScroll;
        const Y = 70 + Hash(I + 99) * 320;
        DrawCloud(X, Y, 0.6 + Hash(I + 7) * 0.8);
    }

    // Wzgórza
    const HillScroll = Distance * 0.35;
    Ctx.fillStyle = "#8ccf7e";
    Ctx.beginPath();
    Ctx.moveTo(ViewLeft, World.GroundY);
    for (let X = ViewLeft; X <= ViewRight + 20; X += 20) {
        const WorldX = X + HillScroll;
        const Y = World.GroundY - 90 - 50 * Math.sin(WorldX * 0.004) - 30 * Math.sin(WorldX * 0.011 + 1);
        Ctx.lineTo(X, Y);
    }
    Ctx.lineTo(ViewRight, World.GroundY);
    Ctx.fill();

    // Trawa
    Ctx.fillStyle = "#4caf50";
    Ctx.fillRect(ViewLeft, World.GroundY, ViewRight - ViewLeft, 2000);

    const StripeWidth = 80;
    Ctx.fillStyle = "#43a047";

    const AbsoluteWorldX = ViewLeft + Distance;
    let StripeIndex = Math.floor(AbsoluteWorldX / StripeWidth);

    if (Math.abs(StripeIndex) % 2 !== 0) {
        StripeIndex--;
    }

    for (let X = StripeIndex * StripeWidth - Distance; X < ViewRight; X += StripeWidth * 2) {
        Ctx.fillRect(X, World.GroundY + 14, StripeWidth, 2000);
    }

    Ctx.fillStyle = "#6fcf57";
    Ctx.fillRect(ViewLeft, World.GroundY, ViewRight - ViewLeft, 14);

    const TuftSpacing = 26;
    Ctx.beginPath();
    const StartIndex = Math.floor((ViewLeft + Distance) / TuftSpacing);
    for (let X = StartIndex * TuftSpacing - Distance; X < ViewRight; X += TuftSpacing) {
        const WorldIdx = Math.round((X + Distance) / TuftSpacing);
        const Height = 8 + Hash(WorldIdx) * 10;
        
        Ctx.moveTo(X, World.GroundY + 1);
        Ctx.lineTo(X + 5, World.GroundY - Height);
        Ctx.lineTo(X + 10, World.GroundY + 1);
    }
    Ctx.fill();
}

function DrawSpikes(Spikes, Distance) {
  Ctx.lineJoin = "miter";

  for (const Spike of Spikes) {
    const Left = Spike.X - Distance;
    const Right = Left + Spike.W;
    const CenterX = Left + Spike.W / 2;
    const IsUp = Spike.Dir === "up";
    const Dir = IsUp ? -1 : 1;
    const BaseY = Spike.Y;
    const TipY = BaseY + Spike.H * Dir;

    // Outer outline
    Ctx.beginPath();
    Ctx.moveTo(Left, BaseY);
    Ctx.lineTo(Right, BaseY);
    Ctx.lineTo(CenterX, TipY);
    Ctx.closePath();
    Ctx.strokeStyle = "#0e1114";
    Ctx.lineWidth = 6;
    Ctx.stroke();

    // Left half shading (Light)
    Ctx.beginPath();
    Ctx.moveTo(Left, BaseY);
    Ctx.lineTo(CenterX, BaseY);
    Ctx.lineTo(CenterX, TipY);
    Ctx.closePath();
    Ctx.fillStyle = "#5c6470";
    Ctx.fill();

    // Right half shading (Dark)
    Ctx.beginPath();
    Ctx.moveTo(CenterX, BaseY);
    Ctx.lineTo(Right, BaseY);
    Ctx.lineTo(CenterX, TipY);
    Ctx.closePath();
    Ctx.fillStyle = "#343942";
    Ctx.fill();

    // Center dividing line
    Ctx.beginPath();
    Ctx.moveTo(CenterX, BaseY);
    Ctx.lineTo(CenterX, TipY);
    Ctx.strokeStyle = "#808b9c";
    Ctx.lineWidth = 2;
    Ctx.stroke();

    // Spike base band
    Ctx.fillStyle = "#1e2126";
    const BaseHeight = 8 * Dir;
    Ctx.fillRect(Left, BaseY, Spike.W, BaseHeight);
    Ctx.strokeStyle = "#0e1114";
    Ctx.lineWidth = 3;
    Ctx.strokeRect(Left, BaseY, Spike.W, BaseHeight);
  }
}

function DrawPlayers(Players, Speed, Time) {
  const Half = PlayerSize / 2;
  const CurrentPlayerIDs = new Set(Players.map(P => P.ID));

  // Clean up disconnected players from rotation cache
  for (const ID of SmoothPlayerAngles.keys()) {
    if (!CurrentPlayerIDs.has(ID)) SmoothPlayerAngles.delete(ID);
  }

  for (const Player of Players) {
    if (!Player.Alive) continue;

    Ctx.save();
    Ctx.translate(Player.X, Player.Y);

    // Flashing effect if slowed
    if (Player.Slowed) {
      Ctx.globalAlpha = 0.45 + 0.4 * Math.abs(Math.sin(Time * 18));
    }

    Ctx.save();
    
    // Smooth angle rotation
    const TargetAngle = Math.atan2(Player.VY, Speed) * 0.7;
    let CurrentAngle = SmoothPlayerAngles.has(Player.ID) 
      ? SmoothPlayerAngles.get(Player.ID) 
      : TargetAngle;
    
    CurrentAngle = Lerp(CurrentAngle, TargetAngle, 0.15);
    SmoothPlayerAngles.set(Player.ID, CurrentAngle);
    
    Ctx.rotate(CurrentAngle);

    // Draw cube body
    Ctx.fillStyle = Player.Color;
    Ctx.strokeStyle = "#111";
    Ctx.lineWidth = 4;
    Ctx.fillRect(-Half, -Half, PlayerSize, PlayerSize);
    Ctx.strokeRect(-Half, -Half, PlayerSize, PlayerSize);

    // Inner gloss layer
    Ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    Ctx.fillRect(-Half + 8, -Half + 8, PlayerSize - 16, PlayerSize - 16);

    // Face / Eye detail
    Ctx.fillStyle = "#111";
    Ctx.fillRect(4, -8, 8, 8);
    Ctx.restore();

    // Draw player name above avatar
    Ctx.font = "bold 22px system-ui, sans-serif";
    Ctx.textAlign = "center";
    Ctx.lineWidth = 5;
    Ctx.strokeStyle = "rgba(0, 0, 0, 0.7)";
    Ctx.fillStyle = "#fff";
    Ctx.strokeText(Player.PlayerName, 0, -Half - 12);
    Ctx.fillText(Player.PlayerName, 0, -Half - 12);
    
    Ctx.restore();
  }
}

function DrawLeaderboard(Players, X, Y) {
  // Sort by Alive state first, then by high Score
  const Sorted = [...Players].sort((A, B) => (B.Alive - A.Alive) || (B.Score - A.Score));
  const RowHeight = 30;
  const Width = 300;
  const Height = 46 + Sorted.length * RowHeight;

  // Background panel
  Ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  Ctx.beginPath();
  Ctx.roundRect(X, Y, Width, Height, 14);
  Ctx.fill();

  // Header text
  Ctx.textBaseline = "middle";
  Ctx.textAlign = "left";
  Ctx.fillStyle = "#fff";
  Ctx.font = "bold 20px system-ui, sans-serif";
  Ctx.fillText("Ranking", X + 16, Y + 24);

  // Render rows
  Sorted.forEach((Player, Index) => {
    const RowY = Y + 56 + Index * RowHeight;
    Ctx.globalAlpha = Player.Alive ? 1 : 0.5;

    // Player color indicator square
    Ctx.fillStyle = Player.Color;
    Ctx.fillRect(X + 16, RowY - 8, 16, 16);

    // Name text (truncated if too long)
    Ctx.fillStyle = "#fff";
    Ctx.font = "18px system-ui, sans-serif";
    Ctx.textAlign = "left";
    const Name = Player.PlayerName.length > 14 
      ? Player.PlayerName.slice(0, 13) + "…" 
      : Player.PlayerName;
    
    Ctx.fillText(`${Index + 1}. ${Name}${Player.Alive ? "" : " ✖"}`, X + 42, RowY);

    // Score text
    Ctx.textAlign = "right";
    Ctx.fillText(`${Player.Score} m`, X + Width - 16, RowY);
    Ctx.globalAlpha = 1;
  });

  Ctx.textBaseline = "alphabetic";
}

function DrawCountdown(Value) {
  Ctx.font = "900 200px system-ui, sans-serif";
  Ctx.textAlign = "center";
  Ctx.textBaseline = "middle";
  Ctx.lineWidth = 12;
  Ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
  Ctx.fillStyle = "#fff";
  Ctx.strokeText(String(Value), World.Width / 2, World.Height / 2 - 60);
  Ctx.fillText(String(Value), World.Width / 2, World.Height / 2 - 60);
  Ctx.textBaseline = "alphabetic";
}

function Frame() {
  // Dynamic canvas dimensions setup to cover the window seamlessly
  if (Canvas.clientWidth !== window.innerWidth || Canvas.clientHeight !== window.innerHeight) {
    Canvas.style.width = "100vw";
    Canvas.style.height = "100vh";
    Canvas.style.position = "fixed";
    Canvas.style.top = "0";
    Canvas.style.left = "0";
    Canvas.style.zIndex = "0";
  }

  const Ratio = window.devicePixelRatio || 1;
  const Width = Math.round(window.innerWidth * Ratio);
  const Height = Math.round(window.innerHeight * Ratio);

  if (Canvas.width !== Width || Canvas.height !== Height) {
    Canvas.width = Width;
    Canvas.height = Height;
  }

  // Locks vertical logic to 900px, allows horizontal width to scale fluidly
  const Scale = Height / World.Height;
  World.Width = Width / Scale;

  const ViewLeft = 0;
  const ViewRight = World.Width;
  const Time = performance.now() / 1000;

  Ctx.setTransform(Scale, 0, 0, Scale, 0, 0);

  const State = GameVisible ? GetRenderState() : null;

  if (!State) {
    DrawScenery(Time * 120, ViewLeft, ViewRight);
  } else {
    DrawScenery(State.Distance, ViewLeft, ViewRight);
    DrawSpikes(State.Spikes, State.Distance);
    DrawPlayers(State.Players, State.Speed, Time);
    DrawLeaderboard(State.Players, ViewLeft + 20, 20);
    
    if (State.Countdown > 0) {
      DrawCountdown(State.Countdown);
    }
  }

  requestAnimationFrame(Frame);
}

// Start the loop
requestAnimationFrame(Frame);
