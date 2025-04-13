const express = require("express")
const http = require("http");				// HTTP サーバーを作成するために必要
const { Server } = require("socket.io"); // socket.io の Server クラスをインポート
const app = express()

const path = require("path")
const fs = require("fs")

app.set('view engine', 'ejs');
app.use(express.json());
// 'views'フォルダ内のファイルを静的コンテンツとして公開
app.use(express.static(path.join(__dirname, "views")));

let data = []
let users = []
const dataFormat = () => {
	return JSON.stringify(Array.from(data).reverse())
}

const pushData = (reqData) => {
	const date = new Date()
	const hour = `00${date.getHours()}`.slice(-2)
	const minute = `00${date.getMinutes()}`.slice(-2)
	const time = `${hour}:${minute}`
	data.push({
		time: time,
		info: reqData?.info,
		name: reqData?.name,
		text: reqData?.text
	})
}

app.get("/", (req, res) => {
	res.status(200).render("index")
})

app.post("/sendText", (req, res) => {
	console.log(req.body)
	pushData({name: req.body.name, text: req.body.text})
	io.emit("update", dataFormat());
})
app.post("/rename", (req, res) => {
	pushData({name: req.body.name, info: "名前を変更"})
	io.emit("update", dataFormat());
})
app.post("/X", (req, res) => {
	pushData({name: req.body.name, info: "Xボタン押した"})
	io.emit("update", dataFormat());
})
app.post("/Y", (req, res) => {
	pushData({name: req.body.name, info: "Yボタン押した"})
	io.emit("update", dataFormat());
})
app.get("/reset", (req, res) => {
	data = data.filter(a => false)
	io.emit("update", dataFormat());
})

// HTTP サーバーを Express アプリケーションから生成
const server = http.createServer(app);

// socket.io サーバーの初期化
const io = new Server(server);

// クライアントの接続を監視する
io.on("connection", (socket) => {
	const username = socket.handshake.query.username || "無名";
	console.log(`${username}が入室`);
	// pushData({info: `${username}が入室`})
	
	users.push(username)
	
	io.emit("update", dataFormat());
	io.emit("getUsers", users);

	// 必要に応じて、ここで各種イベントをハンドルする
	socket.on("disconnect", () => {
		const username = socket.handshake.query.username ?? "無名";
		console.log(`${username}が退室`);
		// pushData({info: `${username}が退室`})
		
		const index = users.indexOf(username)
		if (index >= 0) {
			users.splice(index)
		}
		
		io.emit("update", dataFormat());
		io.emit("getUsers", users);
	});
});

// 特定の IP アドレスとポートでサーバーを起動
const HOST = "172.16.15.37";  // サーバーに割り当てられたLAN内のIPアドレス
const PORT = 3000;
server.listen(PORT, HOST, () => {
  console.log(`Server is running at http://${HOST}:${PORT}/`);
});