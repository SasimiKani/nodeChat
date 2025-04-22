// グローバル変数：socket
var socket
var socketId
const rid = location.search.split("?")
	?.map(param => param.split("="))
	?.filter(param => param[0] === "rid")
	?.at(0)?.at(1)
document.querySelector("#rid").textContent = `ルーム：${decodeURIComponent(rid)}`

// 元のタイトルを保持
const originalTitle = document.title
let msgsOnHidden = 0

// ページの表示状態が変化したときのイベントリスナー
document.addEventListener('visibilitychange', () => {
	// アクティブになった（表示状態になった）場合はタイトルをリセット
	if (!document.hidden) {
		document.title = originalTitle
		msgsOnHidden = 0
	}
});
function emitOnHidden() {
	if (document.hidden) {
		document.title = `${originalTitle} [+${++msgsOnHidden}]`
	}
}

// メディアプレビュー中
let isPreview = false

// ローディングオーバーレイのタイムアウトハンドル
let overlayTimeout = -1

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
document.querySelector(`button[name="sendText"]`).onclick = send
function send() {
	if (isPreview) {
		// 画像プレビュー中ならメディア送信
		sendMedia()
	} else {
		// じゃなければテキスト送信
		sendText()
	}
}

// ドラッグドロップ処理
let msgContainer = document.querySelector("#messageContainer")
msgContainer.addEventListener("dragover", (e) => {
	e.preventDefault()
	msgContainer.classList.add("dragover")
})
msgContainer.addEventListener("dragleave", (e) => {
	e.preventDefault()
	msgContainer.classList.remove("dragover")
})
msgContainer.addEventListener("drop", (e) => {
	e.preventDefault()
	msgContainer.classList.remove("dragover")
	const data = e.dataTransfer
	const type = data.items[0]?.type
	if (type.match(/(image|video).*/g)) {
		const inputFile = document.querySelector("input[name='file']")
		inputFile.files = data.files
		previewMedia()
	}
})
msgContainer.addEventListener("paste", (e) => {const items = event.clipboardData.items;
	for (const item of items) {
		if (item.kind === "file" && item.type.startsWith("image/")) {
			const file = item.getAsFile()
			console.log("取得した画像ファイル:", file)
			//const files = FileList(file)
			//files.add(file)
			//document.querySelector("input[name=file]").files = files
		}
	}
})

document.querySelector("input[name=file]").addEventListener("change", () => {
	previewMedia()
})
// メディアプレビュー
function previewMedia() {
	overlayTimeout = setTimeout(() => {
		document.querySelector("#overlayLoad").classList.add("show")
	}, 300)
	
	const username = document.querySelector("input[name='username']").value
	const inputFile = document.querySelector("input[name='file']")
	const formData = new FormData()
	if (inputFile.files === "") return

	for (const file of Array.from(inputFile.files)) {
		formData.append("files", file)
	}
	formData.append("name", username)
	formData.append("rid", rid)
	formData.append("socketId", socketId)

	isPreview = true

	fetch("/previewMedia", {method: "POST", body: formData})
		.then(res => {
		})
		.catch(err => console.error("エラー:", err))
}

// メディア送信処理
function sendMedia() {
	const username = document.querySelector("input[name='username']").value
	//const inputFile = document.querySelector("input[name='file']")
	const filename = document.querySelector("#preview > div").firstChild.src.split("/").pop()
	const mimetype = document.querySelector("#preview > div").lastChild.value
	const formData = new FormData()
	if (filename === "") return

	const reqBody = postRequestBody()
	let bodyObj = JSON.parse(reqBody.body)
	bodyObj.filename = filename
	bodyObj.mimetype = mimetype
	reqBody.body = JSON.stringify(bodyObj)

	// 入力欄をクリア
	inputFile.files = null

	fetch("/sendMedia", reqBody)
		.then(res => response(res))
		.catch(err => console.error("エラー:", err))
}

document.querySelector("button[name=rename]").onclick = rename
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
		
		socketId = socket.id
	
		// サーバーからの更新イベント処理
		socket.on(`update${rid}${socket.id}`, (data) => {
			emitOnHidden()
			
			const parsedData = JSON.parse(data)
			updateResponseContainer(parsedData, username)
		})
		socket.on(`update${rid}`, (data) => {
			emitOnHidden()
			
			const parsedData = JSON.parse(data)
			updateResponseContainer(parsedData, username)
		})
		
		// プレビュー
		socket.on(`preview${rid}${socket.id}`, (data) => {
			emitOnHidden()
			
			const parsedData = JSON.parse(data)
			const preview = document.querySelector("#preview")
			preview.classList.add("show")
			preview.innerHTML = ""
			
			parsedData.forEach(data => {
				const {src, mimetype} = data
				
				const media = document.createElement("div")
				const type = document.createElement("input")
				const remove = document.createElement("button")
				
				type.type = "hidden"
				type.value = mimetype
				
				remove.textContent = "x"
				remove.classList.add("remove-preview")	
				remove.onclick = () => {
					preview.classList.remove("show")
					preview.firstChild.remove()
					isPreview = false
				}

				if(getDeviceType() === "Mobile") {
					remove.classList.add("mobi-3")
				}
				if (mimetype.match(/image.*/g)) {
					const img = document.createElement("img")
					lazyLoadMedia(img, src)
					media.appendChild(img)
				}
				else if (mimetype.match(/video.*/g)) {
					const video = document.createElement("video")

					lazyLoadMedia(video, src)
					video.controls = true
					media.appendChild(video)
				}
				else if (mimetype.match(/audio.*/g)) {
					// カスタムプレイヤー
					const {player, controls} = createAudio(media, src)
					remove.style.transform = "translate(10px, 10px)"
				}
				media.appendChild(remove)
				media.appendChild(type)
				preview.appendChild(media)
				
				clearTimeout(overlayTimeout)
				document.querySelector("#overlayLoad").classList.remove("show")
			})
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
	
//	console.log (messageList)
	if (messageList.length > 1) {
		container.innerHTML = ""; // 既存要素のクリア
	}
	
//console.time("set div")
	messageList.forEach(row => {
		// 各行ごとに表示用コンテナを生成
		const responseItem = document.createElement("div")
		responseItem.classList.add("responseItem")

		// 要素生成（各要素は createElem() で生成）
		const timeDiv = createElem("div", "item item-time", row?.time)
		const infoDiv = createElem("div", "item item-info", row?.info)
		const nameDiv = createElem("div", "item item-name", row?.name)
		const textDiv = createElem("div", "item item-text", row?.text)
		const filesDiv = document.createElement("div")
		filesDiv.classList.add("item-files")
		
		if (row?.info) {
			responseItem.classList.add("responseItem-info")
		} else if (currentUsername !== row?.name) {
			responseItem.classList.add("responseItem-he")
			filesDiv.classList.add("item-files-he")
		}

		// テキスト部分（名前と本文）の生成
		const textItem = document.createElement("div")
		textItem.classList.add("textItem")
		if(row?.name !== currentUsername) {
			textItem.appendChild(nameDiv)
		}
		if(row?.text) {
			textItem.appendChild(textDiv)
		} else if (row.files) {
			textItem.appendChild(filesDiv)
		}
		
		// Mobile用のクラス追加処理
		if(getDeviceType() === "Mobile") {
			textItem.classList.add("mobi-100")
			timeDiv.classList.add("mobi-25")
			infoDiv.classList.add("mobi-25")
			nameDiv.classList.add("mobi-25")
			textDiv.classList.add("mobi-2")
			filesDiv.classList.add("mobi-100")
		}

		if(row?.time) {
			textItem.appendChild(timeDiv)
		}

		// 表示順の調整：files → info → textItem → time
		if(row?.info) responseItem.appendChild(infoDiv)
		if(row?.name) responseItem.appendChild(textItem)

		if (container.children.length > 0)
			container.children[0].before(responseItem)
		else
			container.appendChild(responseItem)
	})
//console.timeEnd("set div")
//console.time("set files")
	Array.from(messageList).reverse().forEach((row, i) => {
		const filesDiv = container.children[i].querySelector(".textItem .item-files")
		if (row.files) {
			const {src, mimetype} = row.files
			if (mimetype.match(/image.*/g)) {
				const img = document.createElement("img")
				lazyLoadMedia(img, src)
				filesDiv.appendChild(img)
			}
			else if (mimetype.match(/video.*/g)) {
				const video = document.createElement("video")
				lazyLoadMedia(video, src)
				video.controls = true
				filesDiv.appendChild(video)
			}
			else if (mimetype.match(/audio.*/g)) {
				// カスタムプレイヤー
				createAudio(filesDiv, src)
			}
			
			filesDiv.classList.add("item")
			filesDiv.classList.add("item-files")
			
			// プレビューを削除
			if (isPreview) {
				document.querySelector(".remove-preview").click()
			}
		}
	})
//console.timeEnd("set files")
}

function lazyLoadMedia(mediaElem, src) {
  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        mediaElem.src = src;
        obs.unobserve(entry.target);
      }
    });
  }, { rootMargin: '100px' });
  observer.observe(mediaElem);
}

// ヘルパー関数：タグ、クラス、テキストを指定して要素生成
function createElem(tag, classNames, text) {
	const elem = document.createElement(tag)
	classNames.split(" ").forEach(cls => elem.classList.add(cls))
	elem.textContent = text || ""
	return elem
}

function createAudio(parent, src) {
	// カスタムプレイヤー
	const player   = document.createElement("audio")
	const controls   = document.createElement("div")
	const rowMain   = document.createElement("div")
	const rowSub   = document.createElement("div")
	const playBtn = document.createElement("button")
	const seek    = document.createElement("input")
	const time    = document.createElement("span")
	const vol     = document.createElement("input")
	
	// メディアソース設定
	player.src = src
	
	// クラス設定
	parent.classList.add("player-container")
	controls.classList.add("controls")
	rowMain.classList.add("row")
	rowMain.classList.add("row-main")
	rowSub.classList.add("row")
	rowSub.classList.add("row-sub")
	
	seek.classList.add("seek")
	vol.classList.add("vol")
	time.classList.add("play-time")
	
	// 属性値設定
	playBtn.setAttribute("aria-label", "再生/一時停止")
	playBtn.textContent = "▶️"

	seek.setAttribute("type", "range")
	seek.setAttribute("value", 0)
	seek.setAttribute("min", 0)
	seek.setAttribute("step", 0.1)

	time.textContent = "0:00 / 0:00"

	vol.setAttribute("type", "range")
	vol.setAttribute("value", 1)
	vol.setAttribute("min", 0)
	vol.setAttribute("max", 1)
	vol.setAttribute("step", 0.01)

	// モバイルクラス
	if (getDeviceType() == "Mobile") {
		parent.classList.add("mobi-audio")
		player.classList.add("mobi-audio")
		controls.classList.add("mobi-audio")
	}

	// 要素追加
	rowMain.appendChild(playBtn)
	rowMain.appendChild(seek)

	rowSub.appendChild(time)
	rowSub.appendChild(vol)

	controls.appendChild(rowMain)
	controls.appendChild(rowSub)
	
	parent.appendChild(player)
	parent.appendChild(controls)

	playBtn.addEventListener('click', () => {
	  if (player.paused) {
		player.play()
		playBtn.textContent = '⏸️'
	  } else {
		player.pause()
		playBtn.textContent = '▶️'
	  }
	})
	
	// メタデータ取得後にシーク上限を確定
	player.addEventListener('loadedmetadata', () => {
	  seek.max = player.duration
	  updateTime()
	})
	
	/* 進捗を計算して CSS 変数を更新する関数 */
	const refreshSeek = (seek) =>{
		const p = 100 * (seek.value / seek.max);          // 0–100
		seek.style.setProperty('--seek-before', `${p}%`);
	};
	
	// 再生位置が変わったらシークバーと時間を同期
	player.addEventListener('timeupdate', () => {
	  seek.value = player.currentTime
	  updateTime()
	  refreshSeek(seek);
	})
	
	// シークバー操作
	seek.addEventListener('input', () => {
	  player.currentTime = seek.value
	  refreshSeek(seek)
	})
	
	// 音量操作
	vol.addEventListener('input', () => {
	  player.volume = vol.value
	  refreshSeek(vol)
	})
	refreshSeek(vol)
	
	// 時間表示を mm:ss 形式で更新
	function updateTime() {
	  const fmt = s => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`
	  time.textContent = `${fmt(player.currentTime)} / ${fmt(player.duration)}`
	}

	return {player, controls}
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
		document.querySelector('#room-info').classList.add("mobi-2")
		document.querySelector('#users').classList.add("mobi-25")
		document.querySelector("#userList").classList.add("mobi-25")
		document.querySelector('input[name="username"]').classList.add("mobi-25")
		document.querySelector('label[for="inputFile"]').classList.add("mobi-35")
		document.querySelector('#response').classList.add("mobi-25")
		document.querySelector('input[name="text"]').classList.add("mobi-25")
		document.querySelector('button[name="sendText"]').classList.add("mobi-2")
	}
	connect()
})
