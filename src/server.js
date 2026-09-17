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

function UpdateHosts() {
    const AllSockets = Array.from(IO.sockets.sockets.keys());

    IO.to("hosts").emit("hostDataUpdate", {
        Count: IO.sockets.sockets.size,
        Devices: AllSockets
    });
}

IO.on("connection", (Socket) => {
    console.log(`Device connected: ${Socket.id}!`);

    UpdateHosts();

    Socket.on("registerAsHost", () => {
        Socket.join("hosts");
        UpdateHosts();
    });

    Socket.on("disconnect", (Reason) => {
        console.log(`Device disconnected: ${Socket.id}, ${Reason}!`);
        UpdateHosts();
    });

    Socket.on("sendMessage", (Data) => {
        console.log(`Message received: ${Data.Message}.`);
        IO.emit("broadcastMessage", {
            Message: Data.Message
        });
    });
});

const Port = 3000;

Http.listen(Port, "0.0.0.0", () => {
    console.log(`Server running on port ${Port}.`);
});
