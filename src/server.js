import Express from "express";
import {createServer} from "http";
import {Server} from "socket.io";
import Path from "path";
import {fileURLToPath} from "url";

const App = Express();
const Http = createServer(App);
const IO = new Server(Http);

const __filename = fileURLToPath(import.meta.url);
const __dirname = Path.dirname(__filename);

App.use(Express.static(__dirname));

const Rooms = [];

// -- //

function GetRoomID(RoomName) {
  	return RoomName.replace(/\s+/g, "-").toLowerCase();
}

function FindRoomByName(RoomName) {
  	if (!RoomName) return null;
  	return Rooms.find(Room => Room.Name.toLowerCase() === RoomName.trim().toLowerCase()) || null;
}

function IsPlayerInRoom(RoomObject, PlayerName) {
  	if (!RoomObject || !RoomObject.Players || !PlayerName) return false;
  	return RoomObject.Players.some(player => player.Name.toLowerCase() === PlayerName.trim().toLowerCase());
}

// -- //

function ValidatePlayerName(PlayerName, Socket) {
  	const MaxLength = 24;

  	if (!PlayerName || !PlayerName.trim()) {
    	return {
      		PlayerName: Socket ? `Gość_${Socket.id.slice(0, 4)}` : null,
      		Message: Socket ? null : "Nazwa gracza nie może być pusta!",
    	};
  	}
  
  	if (/\s/.test(PlayerName)) {
    	return {
      		PlayerName: null,
      		Message: "Nazwa gracza zawiera nieprawidłowe znaki (spacje)!",
    	};
  	}

  	if (PlayerName.length > MaxLength) {
    	return {
      		PlayerName: null,
      		Message: `Nazwa gracza jest za długa! Maksymalnie ${MaxLength} znaki.`,
    	};
  	}

  	return {
		PlayerName: PlayerName.trim(),
		Message: null
	};
}

function ValidateRoomName(RoomName, PlayerName) {
  	const MaxLength = 64;

  	if (!RoomName || !RoomName.trim()) {
    	return {
      		RoomName: PlayerName ? `Pokój gracza ${PlayerName.trim()}` : null,
      		Message: PlayerName ? null : "Nazwa pokoju nie może być pusta!",
    	};
  	}

  	if (/[^\S ]/.test(RoomName)) {
    	return {
      		RoomName: null,
      		Message: "Nazwa pokoju zawiera nieprawidłowe znaki!",
    	};
  	}

  	if (RoomName.length > MaxLength) {
    	return {
      		RoomName: null,
      		Message: `Nazwa pokoju jest za długa! Maksymalnie ${MaxLength} znaków.`,
    	};
  	}

  	const ExistingRoom = FindRoomByName(RoomName);
  	if (ExistingRoom) {
    	return {
      		RoomName: null,
      		Message: "Pokój o takiej nazwie już istnieje!",
    	};
  	}

  	return {
		RoomName: RoomName.trim(),
		Message: null
	};
}

// -- //

function CreateRoom(Socket, {RoomName, Password, PlayerName}, Callback) {
  	const PlayerNameResult = ValidatePlayerName(PlayerName, Socket);
  	if (!PlayerNameResult.PlayerName) {
    	return Callback({ Status: "Error", Message: PlayerNameResult.Message });
  	}
  	const RealPlayerName = PlayerNameResult.PlayerName;

  	const RoomNameResult = ValidateRoomName(RoomName, RealPlayerName);
  	if (!RoomNameResult.RoomName) {
    	return Callback({ Status: "Error", Message: RoomNameResult.Message });
  	}
  	const RealRoomName = RoomNameResult.RoomName;

  	const RealPassword = Password ? Password.replace(/[^\S ]/g, "") : "";
  	const RoomID = GetRoomID(RealRoomName);

  	const NewRoom = {
		ID: RoomID,
		Name: RealRoomName,
		Password: RealPassword,
		Players: [{
			ID: Socket.id,
			Name: RealPlayerName,
			IsHost: true,
		}],
  	};

  	Rooms.push(NewRoom);

	Socket.join(NewRoom.ID);
	Socket.CurrentRoomID = NewRoom.ID;
	Socket.PlayerName = RealPlayerName;

	console.log(`Player ${RealPlayerName} created room ${NewRoom.Name}!`)

	return Callback({
		Status: "Success",
		Message: "Pokój został utworzony!",
		RoomId: NewRoom.ID,
		PlayerName: RealPlayerName
	});
}

function JoinRoom(Socket, {RoomName, Password, PlayerName}, Callback) {
  	const TargetRoom = FindRoomByName(RoomName);
  	if (!TargetRoom) {
  		return Callback({
			Status: "Error",
			Message: "Nie znaleziono takiego pokoju!",
		});
  	}

  	if (TargetRoom.Password && TargetRoom.Password !== Password) {
  		return Callback({
			Status: "Error",
			Message: "Nieprawidłowe hasło do pokoju!",
		});
  	}

  	const PlayerNameResult = ValidatePlayerName(PlayerName, null);
  	if (!PlayerNameResult.PlayerName) {
  		return Callback({
			Status: "Error",
			Message: PlayerNameResult.Message,
		});
  	}
  	const RealPlayerName = PlayerNameResult.PlayerName;

  	if (IsPlayerInRoom(TargetRoom, RealPlayerName)) {
    	return Callback({
			Status: "Error",
			Message: "Ta nazwa gracza jest już zajęta w tym pokoju!",
		});
  	}

  	TargetRoom.Players.push({
		ID: Socket.id,
		Name: RealPlayerName,
		IsHost: false,
	});

  	Socket.join(TargetRoom.ID);
  	Socket.CurrentRoomID = TargetRoom.ID;
  	Socket.PlayerName = RealPlayerName;
  	
	Socket.to(TargetRoom.ID).emit("playerJoined", {
		Name: RealPlayerName
	});

	console.log(`Player ${RealPlayerName} joined room ${TargetRoom.ID}!`)

  	return Callback({
    	Status: "Success",
    	Message: "Dołączono do pokoju!",
    	RoomId: TargetRoom.ID,
    	PlayerName: RealPlayerName,
  	});
}

function DestroyRoom(RoomObject, ReasonMessage) {
	IO.to(RoomObject.ID).emit("roomDeleted", {
		Message: ReasonMessage
	});
	
	IO.in(RoomObject.ID).socketsLeave(RoomObject.ID);

	const RoomIndex = Rooms.findIndex(Room => Room.ID === RoomObject.ID);
	if (RoomIndex !== -1) {
		Rooms.splice(RoomIndex, 1);
	}

	console.log(`Room destroyed: ${RoomObject.Name}, ${ReasonMessage}!`);
}

// -- //

function HostDestroyRoom(Socket, {RoomName}, Callback) {
	const TargetRoom = FindRoomByName(RoomName);
	if (!TargetRoom) {
		return Callback({
			Status: "Error",
			Message: "Nie znaleziono takiego pokoju!",
		});
	}

	const Requester = TargetRoom.Players.find(p => p.ID === Socket.id);
	if (!Requester || !Requester.IsHost) {
		return Callback({Status: "Error",
			Message: "Tylko gospodarz może usunąć ten pokój!",
		});
	}

	DestroyRoom(TargetRoom, "Gospodarz zamknął pokój.");

	return Callback({
		Status: "Success",
		Message: "Pokój został pomyślnie usunięty!",
	});
}

function HandlePlayerDisconnect(Socket) {
    if (!Socket.CurrentRoomID) return;

    const TargetRoom = Rooms.find(Room => Room.ID === Socket.CurrentRoomID);
    if (!TargetRoom) return;

    const Player = TargetRoom.Players.find(p => p.ID === Socket.id);
    if (!Player) return;

    if (Player.IsHost) {
        DestroyRoom(TargetRoom, "Gospodarz rozłączył się. Pokój został usunięty.");
    } else {
        TargetRoom.Players = TargetRoom.Players.filter(p => p.ID !== Socket.id);
        console.log(`Player ${Player.Name} left room ${TargetRoom.Name}!`);
        Socket.to(TargetRoom.ID).emit("playerLeft", {Name: Player.Name});
    }
}

// -- //

IO.on("connection", (Socket) => {
    console.log(`Device connected: ${Socket.id}!`);

	Socket.on("createRoom", (Data, Callback) => {
		CreateRoom(Socket, Data, Callback);
	});

	Socket.on("joinRoom", (Data, Callback) => {
		JoinRoom(Socket, Data, Callback);
	});

	Socket.on("deleteRoom", (Data, Callback) => {
		HostDestroyRoom(Socket, Data, Callback);
	});

	Socket.on("disconnect", (Reason) => {
        console.log(`Device disconnected: ${Socket.id}, ${Reason}!`);
		HandlePlayerDisconnect(Socket);
	});
});

const Port = 3000;

Http.listen(Port, "0.0.0.0", () => {
    console.log(`Server running on port ${Port}.`);
});
