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

const ActiveDevices = new Set(); 

IO.on("connection", (Socket) => {
    console.log("Device connected: " + Socket.id + "!");
    
    ActiveDevices.add(Socket.id);

    Socket.emit("currentDevices", {
		Devices: Array.from(ActiveDevices)
	});

    Socket.broadcast.emit("deviceConnect", {ID: Socket.id});

    Socket.on("disconnect", (Reason) => {
        console.log("Device disconnected: " + Socket.id + ", " + Reason + "!");
        
        ActiveDevices.delete(Socket.id);
        
        IO.emit("deviceDisconnect", {ID: Socket.id});
    });

    Socket.on("sendMessage", (Data) => {
        console.log("Message received: " + Data.Message + ".");
        IO.emit("broadcastMessage", {Message: Data.Message});
    });
});


const Port = 3000

Http.listen(Port, "0.0.0.0", () => {
	console.log("Server running on port " + Port + ".")
})
