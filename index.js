const express = require("express")
const multer = require("multer")
const upload = multer({ dest: 'uploads/' })
const http = require("http");				// HTTP サーバーを作成するために必要
const { Server } = require("socket.io"); // socket.io の Server クラスをインポート
const app = express()

const path = require("path")
const fs = require("fs")
const { Blob } = require('buffer')

app.set('view engine', 'ejs')
app.use(express.json())
// 'views'フォルダ内のファイルを静的コンテンツとして公開
app.use(express.static(path.join(__dirname, "views")))
app.use(express.static(path.join(__dirname, "uploads")))

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
	return JSON.stringify(Array.from(chatData[rid]?.data))
}
const lastDataFormat = (rid=undefined) => {
	return JSON.stringify([ Array.from(chatData[rid]?.data)?.reverse()?.at(0) ])
}

const getTime = () => {
	const date = new Date()
	const hour = `00${date.getHours()}`.slice(-2)
	const minute = `00${date.getMinutes()}`.slice(-2)
	return `${hour}:${minute}`
}

const pushData = (reqData, rid=undefined, filesSrc=undefined) => new Promise(r => {
	const time = getTime()
	
	if (filesSrc) {
		chatData[rid]?.data?.push({
			time: time,
			info: reqData?.info,
			name: reqData?.name,
			text: reqData?.text,
			files: filesSrc
		})
		r(`[${time}] 送信：${reqData?.name} text:「${reqData?.text}」 info:「${reqData?.info}」 filesSrc:「${JSON.stringify(filesSrc)}」`)
	} else {
		chatData[rid]?.data?.push({
			time: time,
			info: reqData?.info,
			name: reqData?.name,
			text: reqData?.text,
			files: undefined
		})
		r(`[${time}] 送信：${reqData?.name} text:「${reqData?.text}」 info:「${reqData?.info}」`)
	}
})

app.get("/", (req, res) => {
	res.status(200).render("index")
})

app.post("/sendText", (req, res) => {
	const rid = req.body.rid
	pushData({name: req.body.name, text: req.body.text}, rid).then((msg) => {
		console.log(msg)
		io.emit(`update${rid}`, lastDataFormat(rid))
	})
})
app.post("/rename", (req, res) => {
	const rid = req.body.rid
	pushData({name: req.body.name, info: "名前を変更"}, rid).then((msg) => {
		console.log(msg)
		io.emit(`update${rid}`, lastDataFormat(rid))
	})
})
app.post("/previewMedia", upload.any(), (req, res) => {
	const socketId = req.body.socketId
	const rid = req.body.rid
	const files = req.files
	const filesSrc = []

	let chain = Promise.resolve()
	files.forEach(file => {
		chain = chain.then(() => 
			new Promise(async resolve => {
				const mimetype = file.mimetype
				const filename = file.filename
				filesSrc.push({src: filename, mimetype: mimetype})
				
				resolve()
			})
		)
	})
	chain.then(() => {
		io.emit(`preview${rid}${socketId}`, JSON.stringify(filesSrc))
	})
	
	
})
app.post("/sendMedia", (req, res) => {
	const rid = req.body.rid
	const filesSrc = {src: req.body.filename, mimetype: req.body.mimetype}
	pushData({name: req.body.name}, rid, filesSrc).then((msg) => {
		console.log(msg)
		io.emit(`update${rid}`, lastDataFormat(rid))
	})
})
app.post("/Y", (req, res) => {
	const rid = req.body.rid
	pushData({name: req.body.name, info: "Yボタン押した"}, rid).then((msg) => {
		console.log(msg)
		io.emit(`update${rid}`, dataFormat(rid))
	})
})
app.get("/reset", (req, res) => {
	const rid = req.body?.rid
	chatData[rid].data = chatData[rid]?.data?.filter(a => false)
	io.emit(`update${rid}`, dataFormat(rid))
})

// HTTP サーバーを Express アプリケーションから生成
const server = http.createServer(app)

// socket.io サーバーの初期化
const io = new Server(server)

// クライアントの接続を監視する
io.on("connection", (socket) => {
	const username = socket.handshake.query.username || "無名"
	const rid = socket.handshake.query.rid ?? "無名"
	console.log(`[${getTime()}] ${decodeURIComponent(rid)} に ${username}が入室`)
	
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
	
	io.emit(`update${rid}${socket.id}`, dataFormat(rid))
	io.emit(`getUsers${rid}`, chatData[rid]?.users)

	// 必要に応じて、ここで各種イベントをハンドルする
	socket.on("disconnect", () => {
		const username = socket.handshake.query.username ?? "無名"
		const rid = socket.handshake.query.rid ?? "無名"
		console.log(`[${getTime()}] ${decodeURIComponent(rid)} から ${username}が退室`)
		
		// const rid = getRid(req)
		// pushData({info: `${username}が退室`}, rid)
		
		const index = chatData[rid]?.users.indexOf(username)
		if (index >= 0) {
			chatData[rid]?.users.splice(index, 1)
		}
		
		io.emit(`update${rid}${socket.id}`, dataFormat(rid))
		io.emit(`getUsers${rid}`, chatData[rid]?.users)
		return
	})
})

// 特定の IP アドレスとポートでサーバーを起動
const HOST = "0.0.0.0";  // サーバーに割り当てられたLAN内のIPアドレス
const PORT = 3000
server.listen(PORT, HOST, () => {
  console.log(`Server is running at http://${HOST}:${PORT}/`)
})