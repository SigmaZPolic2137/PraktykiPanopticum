import Express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import Path from "path";
import { fileURLToPath } from "url";

const App = Express();
const Http = createServer(App);
const IO = new Server(Http);

const __filename = fileURLToPath(import.meta.url);
const __dirname = Path.dirname(__filename);

App.use(Express.static(__dirname));

// Rooms.set(RoomName, { HostID: string, Password: string || null, MaxPlayers: number });

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
    const MinLimit = 2;
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
    });

    console.log(`Room created: ${RealRoomName}, ${RealMaxPlayers}, ${Socket.id}.`);

    Callback({
        Success: true,
    });
}

async function CloseRoom(RoomName) {
    if (!Rooms.has(RoomName)) return;

    IO.to(RoomName).emit("roomClosed");
    
    const SocketsInRoom = await GetSocketsInRoom(RoomName);

    Rooms.delete(RoomName);

	for (const TargetSocket of SocketsInRoom) {
		await LeaveRoom(TargetSocket);
	}

    console.log(`Room closed: ${RoomName}.`);
}

async function JoinRoom(Socket, {RoomName, PlayerName, Password}, Callback) {
    const RoomData = Rooms.get(RoomName);
    if (!RoomData) {
        return Callback({
            Success: false,
            Message: "Taki pokój nie istnieje!",
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

    Socket.on("createRoom", (Data, Callback) => CreateRoom(Socket, Data, Callback));
    Socket.on("joinRoom", (Data, Callback) => JoinRoom(Socket, Data, Callback));
    Socket.on("leaveRoom", (Callback) => LeaveRoom(Socket, Callback));
    Socket.on("kickPlayer", (Data, Callback) => KickFromRoom(Socket, Data, Callback));

    Socket.on("disconnect", async (Reason) => {
        console.log(`Device disconnected: ${Socket.id}, ${Reason}.`);

		await HandleDisconnect(Socket);
    });
});

const Port = 3000;

Http.listen(Port, "0.0.0.0", () => {
    console.log(`Server running on port ${Port}.`);
});
