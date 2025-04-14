// グローバル変数：socket
let socket
const rid = location.search.split("?")
	?.map(param => param.split("="))
	?.filter(param => param[0] === "rid")
	?.at(0)?.at(1)
document.querySelector("#rid").textContent = `ルーム：${decodeURIComponent(rid)}`

// テキスト入力欄のEnterキーによる送信処理
function handleTextKeydown(e) {
	if(e.key === 'Enter') {
		document.querySelector('button[name="sendText"]').click()
	}
}
document.querySelector(`input[name="text"]`).onkeydown = handleTextKeydown

// fetch レスポンスの共通処理（必要に応じて実装）
function response(res) {
	const reader = res.body.getReader()
	reader.read().then(msg => {
		const decoder = new TextDecoder("utf-8")
		const decodeMsg = decoder.decode(msg.value)
		// ※必要に応じて処理を追加
	})
}

// POSTリクエスト用のリクエストボディの作成
function postRequestBody() {
	return {
		method: "post",
		headers: {
			"Content-type": "application/json"
		},
		body: JSON.stringify({
			name: document.querySelector("input[name='username']").value,
			rid: rid
		})
	}
}

// メッセージ送信処理
function sendText() {
	const inputText = document.querySelector("input[name='text']")
	if (inputText.value === "") return

	const reqBody = postRequestBody()
	let bodyObj = JSON.parse(reqBody.body)
	bodyObj.text = inputText.value
	reqBody.body = JSON.stringify(bodyObj)

	// 入力欄をクリア
	inputText.value = ""

	fetch("/sendText", reqBody)
		.then(res => response(res))
		.catch(err => console.error("エラー:", err))
}
document.querySelector(`button[name="sendText"]`).onclick = sendText 

// メディア送信処理
function sendMedia() {
	const username = document.querySelector("input[name='username']").value
	const inputFile = document.querySelector("input[name='file']")
	const formData = new FormData()
	if (inputFile.files === "") return

	for (const file of Array.from(inputFile.files)) {
		formData.append("files", file)
	}
	formData.append("name", username)
	formData.append("rid", rid)

	// 入力欄をクリア
	inputFile.files = null

	fetch("/sendMedia", {method: "POST", body: formData})
		.then(res => response(res))
		.catch(err => console.error("エラー:", err))
}
document.querySelector(`button[name="sendMedia"]`).onclick = sendText 
document.querySelector("input[name=file]").addEventListener("change", () => {
	sendMedia()
})

// ユーザー名変更（rename）処理
function rename() {
	if(connect(true)) {
		fetch("/rename", postRequestBody())
			.then(res => response(res))
			.catch(err => console.error("エラー:", err))
	}
}

// socket.io による接続初期化（isRename=trueの場合は再接続）
function connect(isRename = false) {
	// ユーザー名取得／更新処理
	if (isRename) {
		localStorage[`temp.${rid}`] = localStorage[`username.${rid}`]
		localStorage[`username.${rid}`] = ""
	}
	let username = localStorage[`username.${rid}`]
	while(!username) {
		username = prompt("ユーザー名を入力してね")
		if(isRename) {
			localStorage[`username.${rid}`] = username || localStorage[`temp.${rid}`]
			if(!username) return false
		}
		localStorage[`username.${rid}`] = username
	}
	document.querySelector("input[name='username']").value = username

	// 既に接続済みなら再接続
	if (isRename && socket) {
		socket.disconnect()
	}

	// socket.io による接続開始（queryでユーザー名を送信）
	socket = io({
		query: {
			username: username,
			rid: rid
		}
	})

	socket.on("connect", () => {
		console.log("socket.io 接続完了")
	})

	// サーバーからの更新イベント処理
	socket.on(`update${rid}`, (data) => {
		const parsedData = JSON.parse(data)
		updateResponseContainer(parsedData, username)
	})

	// サーバーからのユーザー数取得イベント処理
	socket.on(`getUsers${rid}`, (data) => {
		document.querySelector("#users").textContent = `部屋の人数：${data.length}人`
		
		const userList = document.querySelector("#userList")
		Array.from(userList.children).forEach(user => user.remove())
		
		const head = document.createElement("div")
		head.textContent = "メンバー"
		head.classList.add("head")
		userList.appendChild(head)
		
		for (row of data) {
			const user = document.createElement("div")
			user.classList.add("user-info")
			user.textContent = row + (document.querySelector("input[name=username]")?.value === row ? "（自分）" : "")
			userList.appendChild(user)
		}
	})

	return true
}

document.querySelector("#users").addEventListener("click", () => {
	document.querySelector("#userList").classList.add("show")
	document.querySelector("#overlayBack").classList.add("show")
})
document.querySelector("#overlayBack").addEventListener("click", () => {
	document.querySelector("#userList").classList.remove("show")
	document.querySelector("#overlayBack").classList.remove("show")
})

document.querySelector('#rid').addEventListener("click", () => {
	try {
		const text = document.createElement("input")
		text.value = location.href
		text.style.position = "fixed"
		text.style.opacity = 0
		document.body.appendChild(text)
		text.focus()
		text.select()
		if (document.execCommand("copy")) {
			alert("URLをクリップボードにコピーしました")
		} else {
			alert("クリップボードにコピーできませんでした")
		}
	} catch (err) {
		alert("クリップボードにコピーできませんでした")
	} finally {
		document.body.removeChild(text)
	}
})

// チャットメッセージ表示領域の更新処理
function updateResponseContainer(messageList, currentUsername) {
	const container = document.querySelector("div#responseContainer")
	container.innerHTML = ""; // 既存要素のクリア

	messageList.forEach(async row => {
		// 各行ごとに表示用コンテナを生成
		const responseItem = document.createElement("div")
		responseItem.classList.add("responseItem")

		// 要素生成（各要素は createElem() で生成）
		const timeDiv = createElem("div", "item item-time", row?.time)
		const infoDiv = createElem("div", "item item-info", row?.info)
		const nameDiv = createElem("div", "item item-name", row?.name)
		const textDiv = createElem("div", "item item-text", row?.text)
		const filesDiv = document.createElement("div")
		
		if (row.files) {
			row.files.forEach(file => {
				const {src, mimetype} = file
				if (mimetype.match(/image.*/g)) {
					const img = document.createElement("img")
					img.src = src
					filesDiv.appendChild(img)
				}
				else if (mimetype.match(/video.*/g)) {
					const video = document.createElement("video")
					video.src = src
					video.controls = true
					filesDiv.appendChild(video)
				}
			})
			
			filesDiv.classList.add("item")
			filesDiv.classList.add("item-files")
		}
		
		if (row?.info) {
			responseItem.classList.add("responseItem-info")
		} else if (currentUsername !== row?.name) {
			responseItem.classList.add("responseItem-he")
			filesDiv.classList.add("item-files-he")
		}

		// Mobile用のクラス追加処理
		if(getDeviceType() === "Mobile") {
			timeDiv.classList.add("mobi-25")
			infoDiv.classList.add("mobi-25")
			nameDiv.classList.add("mobi-25")
			textDiv.classList.add("mobi-3")
		}

		// テキスト部分（名前と本文）の生成
		const textItem = document.createElement("div")
		textItem.classList.add("textItem")
		if(row?.name !== currentUsername) {
			textItem.appendChild(nameDiv)
		}
		if(row?.text) {
			textItem.appendChild(textDiv)
		} else if (row.files?.length > 0) {
			textItem.appendChild(filesDiv)
		}

		// 表示順の調整：files → info → textItem → time
		if(row?.info) responseItem.appendChild(infoDiv)
		if(row?.name) responseItem.appendChild(textItem)
		if(row?.time) responseItem.appendChild(timeDiv)

		container.appendChild(responseItem)
	})
}

// ヘルパー関数：タグ、クラス、テキストを指定して要素生成
function createElem(tag, classNames, text) {
	const elem = document.createElement(tag)
	classNames.split(" ").forEach(cls => elem.classList.add(cls))
	elem.textContent = text || ""
	return elem
}

// 端末の種類を判定する関数（Mobile/Tablet/Desktop）
function getDeviceType() {
	const ua = navigator.userAgent
	if (/Mobi|Android/i.test(ua)) {
		if (/iPad|Tablet|Nexus 7/i.test(ua)) {
			return "Tablet"
		}
		return "Mobile"
	}
	return "Desktop"
}

// ページ読み込み完了時の初期処理（モバイル用クラス設定、初期接続）
document.addEventListener("DOMContentLoaded", () => {
	if(getDeviceType() === "Mobile") {
		document.querySelector('#container').classList.add("mobi-100")
		document.querySelector('#room-info').classList.add("mobi-25")
		document.querySelector('#users').classList.add("mobi-25")
		document.querySelector("#userList").classList.add("mobi-25")
		document.querySelector('input[name="username"]').classList.add("mobi-4")
		document.querySelector('#response').classList.add("mobi-25")
		document.querySelector('input[name="text"]').classList.add("mobi-25")
		document.querySelector('button[name="sendText"]').classList.add("mobi-25")
	}
	connect()
})