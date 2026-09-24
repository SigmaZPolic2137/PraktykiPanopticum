import Express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import Path from "path";
import { fileURLToPath } from "url";
import OS from "os";

const App = Express();
const Http = createServer(App);
const IO = new Server(Http);

const __filename = fileURLToPath(import.meta.url);
const __dirname = Path.dirname(__filename);

App.use(Express.static(Path.join(__dirname, "public")));

// Adresy, pod którymi telefony mogą znaleźć serwer w sieci lokalnej.
// W kontenerze interfejsy sieciowe mogą być inne niż na hoście, więc dev.sh podaje je w HOST_IPS.
App.get("/api/addresses", (Request, Response) => {
    const Addresses = process.env.HOST_IPS
        ? process.env.HOST_IPS.split(/\s+/).filter(Boolean)
        : Object.values(OS.networkInterfaces())
            .flat()
            .filter(Interface => Interface.family === "IPv4" && !Interface.internal)
            .map(Interface => Interface.address);

    Response.json({ Addresses, Port });
});

// Rooms.set(RoomName, { HostID: string, Password: string || null, MaxPlayers: number, InGame: boolean });
// Gra jest symulowana w przeglądarce hosta, serwer tylko przekazuje wiadomości między hostem a telefonami.

const Rooms = new Map();

// (:) //

function ValidatePlayerName(PlayerName) {
    const MaxLength = 24;

    if (!PlayerName || !PlayerName.trim()) {
        return {
            PlayerName: null,
            Message: "Nazwa gracza nie może być pusta!",
        };
    }

    const TrimmedPlayerName = PlayerName.trim();

    if (/\s/.test(TrimmedPlayerName)) {
        return {
            PlayerName: null,
            Message: "Nazwa gracza zawiera nieprawidłowe znaki lub spacje!",
        };
    }

    if (TrimmedPlayerName.length > MaxLength) {
        return {
            PlayerName: null,
            Message: `Nazwa gracza jest za długa! Maksymalnie ${MaxLength} znaki.`,
        };
    }

    return {
        PlayerName: TrimmedPlayerName,
        Message: "Sukces!"
    };
}

function ValidateRoomName(RoomName) {
    const MaxLength = 64;

    if (!RoomName || !RoomName.trim()) {
        return {
            RoomName: null,
            Message: "Nazwa pokoju nie może być pusta!",
        };
    }

    const TrimmedRoomName = RoomName.trim();

    if (/[^\S ]/.test(TrimmedRoomName)) {
        return {
            RoomName: null,
            Message: "Nazwa pokoju zawiera nieprawidłowe znaki!",
        };
    }

    if (TrimmedRoomName.length > MaxLength) {
        return {
            RoomName: null,
            Message: `Nazwa pokoju jest za długa! Maksymalnie ${MaxLength} znaków.`,
        };
    }

    if (Rooms.has(TrimmedRoomName)) {
        return {
            RoomName: null,
            Message: "Pokój o takiej nazwie już istnieje!",
        };
    }

    return {
        RoomName: TrimmedRoomName,
        Message: "Sukces!",
    };
}

function ValidateRoomPassword(Password) {
    const MinLength = 6;
    const MaxLength = 32;

    if (!Password) {
        return {
            Password: null,
            Message: "Sukces!",
        };
    }

    const TrimmedPassword = Password.trim();

    if (/[^\S ]/.test(TrimmedPassword)) {
        return {
            Password: null,
            Message: "Hasło pokoju zawiera nieprawidłowe znaki!",
        };
    }

    if (TrimmedPassword.length < MinLength || TrimmedPassword.length > MaxLength) {
        return {
            Password: null,
            Message: `Hasło musi mieć od ${MinLength} do ${MaxLength} znaków!`,
        };
    }

    return {
        Password: TrimmedPassword,
        Message: "Sukces!",
    };
}

function ValidateRoomMaxPlayers(MaxPlayers) {
    const MinLimit = 1;
    const MaxLimit = 16;
    const DefaultLimit = 8;

    if (MaxPlayers === undefined || MaxPlayers === null || MaxPlayers === "") {
        return {
			MaxPlayers: DefaultLimit,
			Message: "Sukces!"
		};
    }

    const ParsedLimit = parseInt(MaxPlayers, 10);

    if (isNaN(ParsedLimit) || ParsedLimit < MinLimit || ParsedLimit > MaxLimit) {
        return {
            MaxPlayers: null,
            Message: `Liczba graczy musi być liczbą od ${MinLimit} do ${MaxLimit}!`,
        };
    }

    return {
        MaxPlayers: ParsedLimit,
        Message: "Sukces!",
    };
}

// D:D //

async function GetSocketsInRoom(RoomName) {
  	const RoomData = Rooms.get(RoomName); 
  	if (!RoomData) return [];

  	const HostID = RoomData.HostID;
  	const Sockets = await IO.in(RoomName).fetchSockets();

  	return Sockets.filter(socket => socket.id !== HostID);
}

// L:L //

async function UpdateRoom(RoomName) {
	const RoomData = Rooms.get(RoomName);
	if (!RoomData) return;

	const PlayerSockets = await GetSocketsInRoom(RoomName);

	const FormattedPlayers = PlayerSockets.map(Socket => ({
		ID: Socket.id,
		PlayerName: Socket.PlayerName || "Anonymous",
	}));

	IO.to(RoomData.HostID).emit("roomUpdate", {
		PlayerSockets: FormattedPlayers,
        MaxPlayers: RoomData.MaxPlayers,
	});
}

function CreateRoom(Socket, {RoomName, Password, MaxPlayers}, Callback) {
    if (Socket.CurrentRoom) {
        return Callback({
            Success: false,
            Message: "Jesteś już w pokoju!",
        });
    }

    const RoomNameResult = ValidateRoomName(RoomName);
    if (!RoomNameResult.RoomName) {
        return Callback({
            Success: false,
            Message: RoomNameResult.Message,
        });
    }

    const RoomPasswordResult = ValidateRoomPassword(Password);
    if (Password && !RoomPasswordResult.Password) {
        return Callback({
            Success: false,
            Message: RoomPasswordResult.Message,
        });
    }

    const MaxPlayersResult = ValidateRoomMaxPlayers(MaxPlayers);
    if (!MaxPlayersResult.MaxPlayers) {
        return Callback({
            Success: false,
            Message: MaxPlayersResult.Message,
        });
    }

    const RealRoomName = RoomNameResult.RoomName;
    const RealPassword = RoomPasswordResult.Password;
    const RealMaxPlayers = MaxPlayersResult.MaxPlayers;

    Socket.join(RealRoomName);
    Socket.CurrentRoom = RealRoomName;

    Rooms.set(RealRoomName, {
        HostID: Socket.id,
        Password: RealPassword,
        MaxPlayers: RealMaxPlayers,
        InGame: false,
    });

    console.log(`Room created: ${RealRoomName}, ${RealMaxPlayers}, ${Socket.id}.`);

    Callback({
        Success: true,
    });
}

async function CloseRoom(RoomName) {
    const RoomData = Rooms.get(RoomName);
    if (!RoomData) return;

    IO.to(RoomName).emit("roomClosed");
    
    const SocketsInRoom = await GetSocketsInRoom(RoomName);

    Rooms.delete(RoomName);

    const HostSocket = IO.sockets.sockets.get(RoomData.HostID);
    if (HostSocket) {
        HostSocket.leave(RoomName);
        HostSocket.CurrentRoom = null;
    }

	for (const TargetSocket of SocketsInRoom) {
		await LeaveRoom(TargetSocket);
	}

    console.log(`Room closed: ${RoomName}.`);
}

async function JoinRoom(Socket, {RoomName, PlayerName, Password}, Callback) {
    if (Socket.CurrentRoom) {
        return Callback({
            Success: false,
            Message: "Jesteś już w pokoju!",
        });
    }

    const RoomData = Rooms.get(RoomName);
    if (!RoomData) {
        return Callback({
            Success: false,
            Message: "Taki pokój nie istnieje!",
        });
    }

    if (RoomData.InGame) {
        return Callback({
            Success: false,
            Message: "Gra w tym pokoju już trwa!",
        });
    }

    const CurrentPlayers = await GetSocketsInRoom(RoomName);
    if (CurrentPlayers.length >= RoomData.MaxPlayers) {
        return Callback({
            Success: false,
            Message: "Pokój jest już pełen!",
        });
    }

    const PlayerNameResult = ValidatePlayerName(PlayerName);
    if (!PlayerNameResult.PlayerName) {
        return Callback({
            Success: false,
            Message: PlayerNameResult.Message,
        });
    }

    const SentPassword = Password ? Password.trim() : null;
    if (RoomData.Password && RoomData.Password !== SentPassword) {
        return Callback({
            Success: false,
            Message: "Nieprawidłowe hasło!",
        });
    }

    const RealPlayerName = PlayerNameResult.PlayerName;

    Socket.PlayerName = RealPlayerName;
    Socket.CurrentRoom = RoomName;
    Socket.join(RoomName);

    console.log(`Player joined: ${RoomName}, ${RealPlayerName}, ${Socket.id}.`);

    await UpdateRoom(RoomName);

    Callback({
        Success: true,
    });
}

async function LeaveRoom(Socket, Callback) {
    const RoomName = Socket.CurrentRoom;
    if (!RoomName) return false;

	const RoomData = Rooms.get(RoomName);
	if (RoomData && RoomData.HostID === Socket.id) {
		await CloseRoom(RoomName);

		if (Callback) Callback({
			Success: true,
		})

		return true;
	}

    Socket.leave(RoomName);
    Socket.CurrentRoom = null;

    if (RoomData && RoomData.InGame) {
        IO.to(RoomData.HostID).emit("playerLeft", { ID: Socket.id });
    }

    console.log(`Player left: ${RoomName}, ${Socket.PlayerName || "Anonymous"}, ${Socket.id}.`);

    if (Rooms.has(RoomName)) {
        await UpdateRoom(RoomName);
    }

    if (Callback) Callback({
        Success: true,
    });

    return true;
}

async function KickFromRoom(Socket, {TargetSocketID}, Callback) {
    const RoomName = Socket.CurrentRoom;
    if (!RoomName) return Callback({ Success: false });

    const RoomData = Rooms.get(RoomName);
    if (!RoomData || Socket.id !== RoomData.HostID) {
        return Callback({ Success: false });
    }

    const TargetSocket = IO.sockets.sockets.get(TargetSocketID);
    if (!TargetSocket || TargetSocket.CurrentRoom !== RoomName) {
        return Callback({ Success: false });
    }

    await LeaveRoom(TargetSocket);

    console.log(`Player kicked: ${RoomName}, ${TargetSocket.PlayerName}, ${TargetSocketID}.`);

    TargetSocket.emit("kicked", {
        Message: "Zostałeś wyrzucony z pokoju przez hosta.",
    });

    Callback({
        Success: true,
    });
}

// >:> //

function GetHostRoom(Socket) {
    const RoomData = Rooms.get(Socket.CurrentRoom);
    if (!RoomData || RoomData.HostID !== Socket.id) return null;

    return RoomData;
}

async function StartGame(Socket, Callback) {
    const RoomName = Socket.CurrentRoom;
    const RoomData = GetHostRoom(Socket);
    if (!RoomData) {
        return Callback({
            Success: false,
            Message: "Tylko host może rozpocząć grę!",
        });
    }

    if (RoomData.InGame) {
        return Callback({
            Success: false,
            Message: "Gra już trwa!",
        });
    }

    const PlayerSockets = await GetSocketsInRoom(RoomName);
    if (PlayerSockets.length === 0) {
        return Callback({
            Success: false,
            Message: "W pokoju nie ma żadnych graczy!",
        });
    }

    RoomData.InGame = true;

    console.log(`Game started: ${RoomName}, ${PlayerSockets.length} players.`);

    Callback({
        Success: true,
        Players: PlayerSockets.map(PlayerSocket => ({
            ID: PlayerSocket.id,
            PlayerName: PlayerSocket.PlayerName || "Anonymous",
        })),
    });
}

// Host wysyła zdarzenia z gry do konkretnego gracza (odliczanie, trafienie, eliminacja).
const PlayerEvents = new Set(["playerStatus", "hit"]);

function SendToPlayer(Socket, { ID, Event, Payload }) {
    const RoomData = GetHostRoom(Socket);
    if (!RoomData || !RoomData.InGame || !PlayerEvents.has(Event)) return;

    const TargetSocket = IO.sockets.sockets.get(ID);
    if (!TargetSocket || TargetSocket.CurrentRoom !== Socket.CurrentRoom || TargetSocket.id === Socket.id) return;

    TargetSocket.emit(Event, Payload && typeof Payload === "object" ? Payload : {});
}

function FinishGame(Socket, { Results }) {
    const RoomName = Socket.CurrentRoom;
    const RoomData = GetHostRoom(Socket);
    if (!RoomData || !RoomData.InGame) return;

    RoomData.InGame = false;

    Socket.to(RoomName).emit("gameOver", {
        Results: Array.isArray(Results) ? Results.slice(0, RoomData.MaxPlayers) : [],
    });

    console.log(`Game finished: ${RoomName}.`);

    UpdateRoom(RoomName);
}

// Stan przycisku z telefonu trafia prosto do hosta, który symuluje grę.
function SetInput(Socket, Data) {
    const RoomData = Rooms.get(Socket.CurrentRoom);
    if (!RoomData || !RoomData.InGame || RoomData.HostID === Socket.id) return;

    IO.to(RoomData.HostID).emit("input", { ID: Socket.id, Holding: Boolean(Data && Data.Holding) });
}

async function ListRooms(Callback) {
    const RoomList = [];

    for (const [RoomName, RoomData] of Rooms) {
        const PlayerSockets = await GetSocketsInRoom(RoomName);

        RoomList.push({
            RoomName,
            Players: PlayerSockets.length,
            MaxPlayers: RoomData.MaxPlayers,
            HasPassword: Boolean(RoomData.Password),
            InGame: RoomData.InGame,
        });
    }

    Callback(RoomList);
}

// ?:? //

async function HandleDisconnect(Socket) {
    const RoomName = Socket.CurrentRoom;
    if (!RoomName) return;

    const RoomData = Rooms.get(RoomName);
    if (!RoomData) return;

    if (RoomData.HostID === Socket.id) {
        await CloseRoom(RoomName);
    } else {
        await LeaveRoom(Socket);
    }
}

// 3:3 //

IO.on("connection", (Socket) => {
    console.log(`Device connected: ${Socket.id}.`);

    // Klient może nie przesłać callbacka (albo przesłać śmieci), serwer nie może się przez to wywrócić.
    const SafeCallback = (Callback) => typeof Callback === "function" ? Callback : () => {};
    const SafeData = (Data) => Data && typeof Data === "object" ? Data : {};

    Socket.on("createRoom", (Data, Callback) => CreateRoom(Socket, SafeData(Data), SafeCallback(Callback)));
    Socket.on("joinRoom", (Data, Callback) => JoinRoom(Socket, SafeData(Data), SafeCallback(Callback)));
    Socket.on("leaveRoom", (Callback) => LeaveRoom(Socket, SafeCallback(Callback)));
    Socket.on("kickPlayer", (Data, Callback) => KickFromRoom(Socket, SafeData(Data), SafeCallback(Callback)));
    Socket.on("listRooms", (Callback) => ListRooms(SafeCallback(Callback)));
    Socket.on("startGame", (Callback) => StartGame(Socket, SafeCallback(Callback)));
    Socket.on("input", (Data) => SetInput(Socket, Data));
    Socket.on("toPlayer", (Data) => SendToPlayer(Socket, SafeData(Data)));
    Socket.on("finishGame", (Data) => FinishGame(Socket, SafeData(Data)));

    Socket.on("disconnect", async (Reason) => {
        console.log(`Device disconnected: ${Socket.id}, ${Reason}.`);

		await HandleDisconnect(Socket);
    });
});

const Port = Number(process.env.PORT) || 3000;

Http.listen(Port, "0.0.0.0", () => {
    console.log(`Server running on port ${Port}.`);
});
