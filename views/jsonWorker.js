// jsonWorker.js
onmessage = function(event) {
  try {
    const parsedData = JSON.parse(event.data);
    postMessage(parsedData);
  } catch (error) {
    console.error("Worker 内でエラーが発生:", error);
    postMessage({ error: error.toString() });
  }
};
