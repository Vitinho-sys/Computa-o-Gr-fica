// static/js/app.js
(() => {
  const fileInput = document.getElementById("fileInput");
  const uploadInfo = document.getElementById("uploadInfo");
  const previewImg = document.getElementById("previewImg");
  const dims = document.getElementById("dims");
  const btnReduce75 = document.getElementById("btnReduce75");
  const btnReduce50 = document.getElementById("btnReduce50");
  const btnReduce25 = document.getElementById("btnReduce25");
  const btnWebp = document.getElementById("btnWebp");
  const btnMirror = document.getElementById("btnMirror");
  const btnGray = document.getElementById("btnGray");
  const btnAnalyse = document.getElementById("btnAnalyse");
  const histR = document.getElementById("histR");
  const histG = document.getElementById("histG");
  const histB = document.getElementById("histB");
  const structureList = document.getElementById("structureList");
  const statsArea = document.getElementById("statsArea");
  const btnReport = document.getElementById("btnReport");
  const webpInfo = document.getElementById("webpInfo");

  let currentFilename = null;
  let uploadedInfo = null;

  async function uploadFile(file) {
    const fd = new FormData();
    fd.append("file", file);
    const resp = await fetch("/upload", { method: "POST", body: fd });
    const data = await resp.json();
    if (data.error) {
      alert(data.error);
      return;
    }
    currentFilename = data.filename;
    uploadedInfo = data;
    previewImg.src = data.url;
    uploadInfo.textContent = `${data.filename} — ${data.size_human} — ${data.width} x ${data.height}`;
    dims.textContent = `Dimensões originais: ${data.width} x ${data.height}`;
    btnReport.href = `/report/${encodeURIComponent(currentFilename)}`;
    btnReport.download = `${currentFilename.split(".").slice(0,-1).join(".")}_report.txt`;
  }

  fileInput.addEventListener("change", (ev) => {
    if (ev.target.files && ev.target.files[0]) {
      uploadFile(ev.target.files[0]);
    }
  });

  async function callProcess(op, params = {}) {
    if (!currentFilename) return alert("Carregue uma imagem primeiro.");
    const body = { filename: currentFilename, op: op, params: params };
    const resp = await fetch("/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await resp.json();
    if (data.error) return alert(data.error);
    return data;
  }

  btnReduce75.addEventListener("click", async () => {
    const data = await callProcess("reduce", { scale: 0.75 });
    if (data) {
      previewImg.src = `/outputs/${data.outputs.image}`;
      dims.textContent = `Resultado: ${data.outputs.dimensions[0]} x ${data.outputs.dimensions[1]}`;
      // provide download link by opening image in new tab on click
      window.open(`/outputs/${data.outputs.image}`, "_blank");
    }
  });
  btnReduce50.addEventListener("click", async () => {
    const data = await callProcess("reduce", { scale: 0.5 });
    if (data) {
      previewImg.src = `/outputs/${data.outputs.image}`;
      dims.textContent = `Resultado: ${data.outputs.dimensions[0]} x ${data.outputs.dimensions[1]}`;
      window.open(`/outputs/${data.outputs.image}`, "_blank");
    }
  });
  btnReduce25.addEventListener("click", async () => {
    const data = await callProcess("reduce", { scale: 0.25 });
    if (data) {
      previewImg.src = `/outputs/${data.outputs.image}`;
      dims.textContent = `Resultado: ${data.outputs.dimensions[0]} x ${data.outputs.dimensions[1]}`;
      window.open(`/outputs/${data.outputs.image}`, "_blank");
    }
  });

  btnWebp.addEventListener("click", async () => {
    const data = await callProcess("webp");
    if (data) {
      previewImg.src = `/outputs/${data.outputs.image}`;
      webpInfo.innerHTML = `<strong>WEBP:</strong> Antes: ${Math.round(data.outputs.size_before/1024)} KB — Depois: ${Math.round(data.outputs.size_after/1024)} KB`;
      window.open(`/outputs/${data.outputs.image}`, "_blank");
    }
  });

  btnMirror.addEventListener("click", async () => {
    const data = await callProcess("mirror");
    if (data) {
      previewImg.src = `/outputs/${data.outputs.image}`;
      window.open(`/outputs/${data.outputs.image}`, "_blank");
    }
  });

  btnGray.addEventListener("click", async () => {
    const data = await callProcess("gray");
    if (data) {
      previewImg.src = `/outputs/${data.outputs.image}`;
      window.open(`/outputs/${data.outputs.image}`, "_blank");
    }
  });

  btnAnalyse.addEventListener("click", async () => {
    const data = await callProcess("analyse");
    if (!data) return;
    // structure
    const s = data.outputs.structure;
    structureList.innerHTML = "";
    structureList.innerHTML += `<li>Modo: ${s.mode}</li>`;
    structureList.innerHTML += `<li>Canais: ${s.channels}</li>`;
    structureList.innerHTML += `<li>Bits por canal: ${s.bits_per_channel}</li>`;
    structureList.innerHTML += `<li>Bits por pixel: ${s.bits_per_pixel}</li>`;
    structureList.innerHTML += `<li>Dimensões: ${s.dimensions[0]} x ${s.dimensions[1]}</li>`;
    if (s.file_size_bytes) {
      structureList.innerHTML += `<li>Tamanho do arquivo: ${Math.round(s.file_size_bytes/1024)} KB</li>`;
    }
    // stats
    const stats = data.outputs.hist_stats;
    statsArea.textContent = `R: min=${stats.R.min}, max=${stats.R.max}, mean=${stats.R.mean}, median=${stats.R.median}, std=${stats.R.std}\n`;
    statsArea.textContent += `G: min=${stats.G.min}, max=${stats.G.max}, mean=${stats.G.mean}, median=${stats.G.median}, std=${stats.G.std}\n`;
    statsArea.textContent += `B: min=${stats.B.min}, max=${stats.B.max}, mean=${stats.B.mean}, median=${stats.B.median}, std=${stats.B.std}\n`;
    // show hist images
    histR.src = `/outputs/${data.outputs.hist_images.R}`;
    histG.src = `/outputs/${data.outputs.hist_images.G}`;
    histB.src = `/outputs/${data.outputs.hist_images.B}`;
  });

})();
