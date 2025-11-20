// static/js/app.js
(() => {
  const fileInput = document.getElementById("fileInput");
  const uploadInfo = document.getElementById("uploadInfo");
  const previewImg = document.getElementById("previewImg");
  const originalPlaceholder = document.getElementById("originalPlaceholder");
  const dims = document.getElementById("dims");
  const previewsContainer = document.getElementById("previewsContainer");
  const structureList = document.getElementById("structureList");
  const statsArea = document.getElementById("statsArea");
  const histR = document.getElementById("histR");
  const histG = document.getElementById("histG");
  const histB = document.getElementById("histB");
  const histRStats = document.getElementById("histRStats");
  const histGStats = document.getElementById("histGStats");
  const histBStats = document.getElementById("histBStats");
  const histogramsPlaceholder = document.getElementById("histogramsPlaceholder");
  const histogramsContent = document.getElementById("histogramsContent");
  const btnReport = document.getElementById("btnReport");

  let currentFilename = null;
  let uploadedInfo = null;
  let currentPreviews = {};

  async function uploadFile(file) {
    const fd = new FormData();
    fd.append("file", file);
    
    try {
      const resp = await fetch("/upload", { method: "POST", body: fd });
      const data = await resp.json();
      
      if (data.error) {
        alert(data.error);
        return;
      }
      
      currentFilename = data.filename;
      uploadedInfo = data;
      
      // Mostrar imagem original
      originalPlaceholder.style.display = 'none';
      previewImg.style.display = 'block';
      previewImg.src = data.url;
      
      uploadInfo.textContent = `${data.filename} — ${data.size_human} — ${data.width} x ${data.height}`;
      dims.textContent = `Dimensões: ${data.width} x ${data.height} • Tamanho: ${data.size_human}`;
      
      // Atualizar link do relatório
      updateReportLink();
      
      // Limpar previews anteriores
      previewsContainer.innerHTML = '';
      currentPreviews = {};
      
      // Atualizar informações da imagem
      updateImageInfo();
      
    } catch (error) {
      alert("Erro ao carregar imagem: " + error.message);
    }
  }

  function updateReportLink() {
    if (currentFilename) {
      btnReport.href = `/report/${encodeURIComponent(currentFilename)}`;
      btnReport.download = `${currentFilename.split('.').slice(0,-1).join('_')}_relatorio.txt`;
    }
  }

  function updateImageInfo() {
    structureList.innerHTML = `
      <li><span>Formato:</span> <span>${currentFilename.split('.').pop().toUpperCase()}</span></li>
      <li><span>Largura:</span> <span>${uploadedInfo.width}px</span></li>
      <li><span>Altura:</span> <span>${uploadedInfo.height}px</span></li>
      <li><span>Tamanho do arquivo:</span> <span>${uploadedInfo.size_human}</span></li>
    `;
  }

  async function createPreview(op, params, title) {
    if (!currentFilename) {
      alert("Carregue uma imagem primeiro.");
      return;
    }

    // Verificar se preview já existe
    const previewId = `${op}_${JSON.stringify(params)}`;
    if (currentPreviews[previewId]) {
      currentPreviews[previewId].scrollIntoView({ behavior: 'smooth' });
      return;
    }

    try {
      const body = { filename: currentFilename, op: op, params: params };
      const resp = await fetch("/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      
      const data = await resp.json();
      
      if (data.error) {
        alert(data.error);
        return;
      }

      // Criar elemento do preview
      const previewElement = createPreviewElement(data, title, op, params);
      previewsContainer.appendChild(previewElement);
      
      // Salvar referência
      currentPreviews[previewId] = previewElement;
      
      // Rolar para o novo preview
      previewElement.scrollIntoView({ behavior: 'smooth' });

    } catch (error) {
      alert("Erro ao processar imagem: " + error.message);
    }
  }

  function createPreviewElement(data, title, op, params) {
    const previewId = `preview_${Date.now()}`;
    const element = document.createElement('div');
    element.className = 'preview-section';
    element.id = previewId;

    let infoContent = '';
    let statsContent = '';

    if (op === 'reduce') {
      const scale = params.scale * 100;
      const newWidth = data.outputs.dimensions[0];
      const newHeight = data.outputs.dimensions[1];
      const originalWidth = uploadedInfo.width;
      const originalHeight = uploadedInfo.height;
      
      infoContent = `Imagem reduzida para ${scale}% do tamanho original`;
      statsContent = `
        <div class="stat-item">
          <div class="stat-label">Largura Original</div>
          <div class="stat-value">${originalWidth}px</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Nova Largura</div>
          <div class="stat-value">${newWidth}px</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Redução</div>
          <div class="stat-value">${scale}%</div>
        </div>
      `;
    } else if (op === 'webp') {
      const originalKB = Math.round(data.outputs.size_before / 1024);
      const webpKB = Math.round(data.outputs.size_after / 1024);
      const savings = Math.round(((originalKB - webpKB) / originalKB) * 100);
      infoContent = `Conversão para formato WEBP com compressão avançada`;
      statsContent = `
        <div class="stat-item">
          <div class="stat-label">Tamanho Original</div>
          <div class="stat-value">${originalKB} KB</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Tamanho WEBP</div>
          <div class="stat-value">${webpKB} KB</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Economia</div>
          <div class="stat-value">${savings}%</div>
        </div>
      `;
    } else if (op === 'mirror') {
      infoContent = 'Espelhamento vertical aplicado - imagem refletida no eixo horizontal';
      statsContent = `
        <div class="stat-item">
          <div class="stat-label">Tipo</div>
          <div class="stat-value">Espelhamento</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Eixo</div>
          <div class="stat-value">Vertical</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Dimensões</div>
          <div class="stat-value">${uploadedInfo.width} × ${uploadedInfo.height}</div>
        </div>
      `;
    } else if (op === 'gray') {
      infoContent = 'Conversão para escala de cinza - removida informação de cor, mantida luminância';
      statsContent = `
        <div class="stat-item">
          <div class="stat-label">Modo de Cor</div>
          <div class="stat-value">Escala de Cinza</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Canais</div>
          <div class="stat-value">1 (Luminância)</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Dimensões</div>
          <div class="stat-value">${uploadedInfo.width} × ${uploadedInfo.height}</div>
        </div>
      `;
    }

    element.innerHTML = `
      <div class="preview-header">
        <h6 class="mb-0">${title}</h6>
        <button class="btn-close-preview" onclick="closePreview('${previewId}')">✕</button>
      </div>
      <div class="preview-content">
        <img src="/outputs/${data.outputs.image}" alt="${title}" class="preview-image" />
        <div class="preview-info">
          ${infoContent}
        </div>
        <div class="preview-stats">
          ${statsContent}
        </div>
        <button class="btn-download-preview" onclick="downloadImage('${data.outputs.image}')">
          <span>⬇️</span>
          <span>Baixar Imagem Processada</span>
        </button>
      </div>
    `;

    return element;
  }

  async function generateHistograms() {
    if (!currentFilename) {
      alert("Carregue uma imagem primeiro.");
      return;
    }

    try {
      const body = { filename: currentFilename, op: "analyse" };
      const resp = await fetch("/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      
      const data = await resp.json();
      
      if (data.error) {
        alert(data.error);
        return;
      }

      // Atualizar informações da imagem
      const s = data.outputs.structure;
      structureList.innerHTML += `
        <li><span>Modo:</span> <span>${s.mode}</span></li>
        <li><span>Canais:</span> <span>${s.channels}</span></li>
        <li><span>Bits por canal:</span> <span>${s.bits_per_channel}</span></li>
        <li><span>Bits por pixel:</span> <span>${s.bits_per_pixel}</span></li>
        <li><span>Tamanho em memória:</span> <span>${(s.size_in_memory_bytes / 1024).toFixed(1)} KB</span></li>
      `;

      // Atualizar estatísticas
      const stats = data.outputs.hist_stats;
      statsArea.innerHTML = `
        <strong>Estatísticas dos Canais RGB:</strong><br><br>
        <strong>🔴 Vermelho (R):</strong><br>
        • Mínimo: ${stats.R.min}<br>
        • Máximo: ${stats.R.max}<br>
        • Média: ${stats.R.mean.toFixed(1)}<br>
        • Mediana: ${stats.R.median}<br>
        • Desvio Padrão: ${stats.R.std.toFixed(1)}<br><br>
        
        <strong>🟢 Verde (G):</strong><br>
        • Mínimo: ${stats.G.min}<br>
        • Máximo: ${stats.G.max}<br>
        • Média: ${stats.G.mean.toFixed(1)}<br>
        • Mediana: ${stats.G.median}<br>
        • Desvio Padrão: ${stats.G.std.toFixed(1)}<br><br>
        
        <strong>🔵 Azul (B):</strong><br>
        • Mínimo: ${stats.B.min}<br>
        • Máximo: ${stats.B.max}<br>
        • Média: ${stats.B.mean.toFixed(1)}<br>
        • Mediana: ${stats.B.median}<br>
        • Desvio Padrão: ${stats.B.std.toFixed(1)}
      `;

      // Atualizar estatísticas individuais dos histogramas
      histRStats.innerHTML = `
        <div>Mín: ${stats.R.min}</div>
        <div>Máx: ${stats.R.max}</div>
        <div>Média: ${stats.R.mean.toFixed(1)}</div>
        <div>Mediana: ${stats.R.median}</div>
        <div>Desvio: ${stats.R.std.toFixed(1)}</div>
      `;

      histGStats.innerHTML = `
        <div>Mín: ${stats.G.min}</div>
        <div>Máx: ${stats.G.max}</div>
        <div>Média: ${stats.G.mean.toFixed(1)}</div>
        <div>Mediana: ${stats.G.median}</div>
        <div>Desvio: ${stats.G.std.toFixed(1)}</div>
      `;

      histBStats.innerHTML = `
        <div>Mín: ${stats.B.min}</div>
        <div>Máx: ${stats.B.max}</div>
        <div>Média: ${stats.B.mean.toFixed(1)}</div>
        <div>Mediana: ${stats.B.median}</div>
        <div>Desvio: ${stats.B.std.toFixed(1)}</div>
      `;

      // Mostrar histogramas
      histogramsPlaceholder.style.display = 'none';
      histogramsContent.style.display = 'block';
      
      histR.src = `/outputs/${data.outputs.hist_images.R}`;
      histG.src = `/outputs/${data.outputs.hist_images.G}`;
      histB.src = `/outputs/${data.outputs.hist_images.B}`;

      // Rolar para histogramas
      document.querySelector('.card-histograms').scrollIntoView({ behavior: 'smooth' });

    } catch (error) {
      alert("Erro ao gerar histogramas: " + error.message);
    }
  }

  // Funções globais
  window.closePreview = function(previewId) {
    const element = document.getElementById(previewId);
    if (element) {
      element.remove();
    }
  };

  window.downloadImage = function(imageName) {
    window.open(`/outputs/${imageName}`, "_blank");
  };

  // Event Listeners INDIVIDUAIS (GARANTIDO QUE FUNCIONAM)
  fileInput.addEventListener("change", (ev) => {
    if (ev.target.files && ev.target.files[0]) {
      uploadFile(ev.target.files[0]);
    }
  });

  // Botões de operação - LISTENERS INDIVIDUAIS
  document.getElementById("btnReduce75").addEventListener("click", () => {
    createPreview("reduce", { scale: 0.75 }, "🔄 75% - Imagem Reduzida");
  });

  document.getElementById("btnReduce50").addEventListener("click", () => {
    createPreview("reduce", { scale: 0.5 }, "🔄 50% - Imagem Reduzida");
  });

  document.getElementById("btnReduce25").addEventListener("click", () => {
    createPreview("reduce", { scale: 0.25 }, "🔄 25% - Imagem Reduzida");
  });

  document.getElementById("btnWebp").addEventListener("click", () => {
    createPreview("webp", {}, "🖼️ WEBP - Imagem Convertida");
  });

  document.getElementById("btnMirror").addEventListener("click", () => {
    createPreview("mirror", {}, "🪞 Espelhamento - Imagem Espelhada");
  });

  document.getElementById("btnGray").addEventListener("click", () => {
    createPreview("gray", {}, "⚫ Tons de Cinza - Imagem em Escala de Cinza");
  });

  document.getElementById("btnAnalyse").addEventListener("click", () => {
    generateHistograms();
  });

  // Botão de relatório
  btnReport.addEventListener('click', function(e) {
    if (!currentFilename) {
      e.preventDefault();
      alert("Carregue uma imagem primeiro para gerar o relatório.");
    }
  });

  // Debug
  console.log("Aplicação carregada com sucesso!");

})();