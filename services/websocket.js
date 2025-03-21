const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: 8080 });

wss.on("connection", (ws) => {
    console.log("📡 Client đã kết nối WebSocket");

    ws.on("message", (message) => {
        console.log("📩 Nhận tin nhắn:", message);
    });

    ws.on("close", () => {
        console.log("❌ Client đã ngắt kết nối");
    });
});

const broadcast = (data) => {
    const message = JSON.stringify(data);
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
};

module.exports = { wss, broadcast };
