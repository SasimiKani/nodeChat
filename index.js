const express = require("express")
const multer = require("multer")
const upload = multer()
const http = require("http");				// HTTP サーバーを作成するために必要
const { Server } = require("socket.io"); // socket.io の Server クラスをインポート
const app = express()

const path = require("path")
const fs = require("fs")

app.set('view engine', 'ejs');
app.use(express.json());
// 'views'フォルダ内のファイルを静的コンテンツとして公開
app.use(express.static(path.join(__dirname, "views")));

let chatData = {}
let data = []
let users = []

const getParams = (req) => {
	const query = req._parsedUrl.query
	const params = new Object()
	query?.split("&")?.forEach(param => {
		const split = param?.split("=")
		params[split[0]] = split[1]
	})
	if (!query) {
		const split = query?.split("=")
		params[split[0]] = split[1]
	}
	
	return params
}
const getRid = (req) => {
	const params = getParams(req)
	return params?.rid
}

const dataFormat = (rid=undefined) => {
	return JSON.stringify(Array.from(chatData[rid]?.data)?.reverse())
}

const pushData = (reqData, rid=undefined, files=undefined) => {
	const date = new Date()
	const hour = `00${date.getHours()}`.slice(-2)
	const minute = `00${date.getMinutes()}`.slice(-2)
	const time = `${hour}:${minute}`
	
	const filesSrc = []
	if (files) {
		files.forEach(file => {
			const mimetype = file.mimetype
			console.log(mimetype)
			if (mimetype.match(/image.*/g)) {
				const base64Image = file.buffer.toString('base64');
				const imgSrc = `data:${mimetype};base64,${base64Image}`;
				filesSrc.push({src: imgSrc, mimetype: mimetype})
			}
			else if (mimetype.match(/video.*/g)) {
				const base64Video = file.buffer.toString('base64');
				const dataUrl = `data:${mimetype};base64,${base64Video}`;
				filesSrc.push({src: dataUrl, mimetype: mimetype})
			}
		})
	}
	
	chatData[rid]?.data?.push({
		time: time,
		info: reqData?.info,
		name: reqData?.name,
		text: reqData?.text,
		files: filesSrc
	})
}

app.get("/", (req, res) => {
	res.status(200).render("index")
})

app.post("/sendText", (req, res) => {
	console.log(req.body)
	const rid = req.body.rid
	pushData({name: req.body.name, text: req.body.text}, rid)
	io.emit(`update${rid}`, dataFormat(rid));
})
app.post("/rename", (req, res) => {
	const rid = req.body.rid
	pushData({name: req.body.name, info: "名前を変更"}, rid)
	io.emit(`update${rid}`, dataFormat(rid));
})
app.post("/sendMedia", upload.any(), (req, res) => {
	const rid = req.body.rid
	const files = req.files
	pushData({name: req.body.name}, rid, files)
	io.emit(`update${rid}`, dataFormat(rid));
})
app.post("/Y", (req, res) => {
	const rid = req.body.rid
	pushData({name: req.body.name, info: "Yボタン押した"}, rid)
	io.emit(`update${rid}`, dataFormat(rid));
})
app.get("/reset", (req, res) => {
	const rid = req.body?.rid
	chatData[rid].data = chatData[rid]?.data?.filter(a => false)
	io.emit(`update${rid}`, dataFormat(rid));
})

// HTTP サーバーを Express アプリケーションから生成
const server = http.createServer(app);

// socket.io サーバーの初期化
const io = new Server(server);

// クライアントの接続を監視する
io.on("connection", (socket) => {
	const username = socket.handshake.query.username || "無名";
	const rid = socket.handshake.query.rid ?? "無名";
	console.log(`${decodeURIComponent(rid)} に ${username}が入室`);
	
	if (!chatData[rid]) {
		chatData[rid] = {
			data: new Array(),
			users: new Array()
		}
	}
	
	// const rid = getRid(req)
	// pushData({info: `${username}が入室`}, rid)
	
	chatData[rid]?.users.push(username)
	//console.log(JSON.stringify(chatData, null, "\t"))
	
	io.emit(`update${rid}`, dataFormat(rid));
	io.emit(`getUsers${rid}`, chatData[rid]?.users);

	// 必要に応じて、ここで各種イベントをハンドルする
	socket.on("disconnect", () => {
		const username = socket.handshake.query.username ?? "無名";
		const rid = socket.handshake.query.rid ?? "無名";
		console.log(`${decodeURIComponent(rid)} から ${username}が退室`);
		
		// const rid = getRid(req)
		// pushData({info: `${username}が退室`}, rid)
		
		const index = chatData[rid]?.users.indexOf(username)
		console.log(chatData[rid]?.users)
		console.log(index)
		if (index >= 0) {
			chatData[rid]?.users.splice(index, 1)
		}
		console.log(chatData[rid]?.users)
		
		io.emit(`update${rid}`, dataFormat(rid));
		io.emit(`getUsers${rid}`, chatData[rid]?.users);
		return
	});
});

// 特定の IP アドレスとポートでサーバーを起動
const HOST = "172.16.15.37";  // サーバーに割り当てられたLAN内のIPアドレス
const PORT = 3000;
server.listen(PORT, HOST, () => {
  console.log(`Server is running at http://${HOST}:${PORT}/`);
});