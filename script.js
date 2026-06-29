const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');
const uploadContent = document.getElementById('uploadContent');
const preview = document.getElementById('preview');
const analyzeBtn = document.getElementById('analyzeBtn');
const resultsBody = document.getElementById('resultsBody');
const pdfBtn = document.getElementById('pdfBtn');
const scanAgainBtn = document.getElementById('scanAgainBtn');
const historySection = document.getElementById('historySection');
const historyList = document.getElementById('historyList');
const classLabel = document.getElementById('classLabel');
const classConf = document.getElementById('classConf');
const stepFill = document.getElementById('stepFill');

let selectedFile = null;
let currentResult = null;
let currentClassification = null;
let currentImageDataUrl = null;

// ── STEP MANAGEMENT ──────────────────────────────────────
function goStep(n) {
    [0, 1, 2, 3].forEach(i => {
        document.getElementById('panel-' + i).classList.add('hidden');
        const circle = document.getElementById('sc' + i);
        const step = document.querySelector('.step[data-step="' + i + '"]');
        if (i < n) {
            step.classList.add('done'); step.classList.remove('active');
            circle.innerHTML = '<i class="ti ti-check"></i>';
        } else if (i === n) {
            step.classList.add('active'); step.classList.remove('done');
        } else {
            step.classList.remove('active', 'done');
        }
    });
    document.getElementById('panel-' + n).classList.remove('hidden');
    stepFill.style.width = [0, 33, 66, 100][n] + '%';
}

// ── UPLOAD ───────────────────────────────────────────────
uploadZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));
uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('dragover'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
uploadZone.addEventListener('drop', (e) => { e.preventDefault(); uploadZone.classList.remove('dragover'); handleFile(e.dataTransfer.files[0]); });

function handleFile(file) {
    if (!file) return;
    selectedFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
        currentImageDataUrl = e.target.result;
        preview.src = currentImageDataUrl;
        preview.classList.remove('hidden');
        uploadContent.classList.add('hidden');
    };
    reader.readAsDataURL(file);
    analyzeBtn.classList.remove('hidden');
}

// ── ANALYZE ──────────────────────────────────────────────
analyzeBtn.addEventListener('click', async () => {
    if (!selectedFile) return;
    goStep(1);
    animateScan();
    try {
        const formData = new FormData();
        formData.append('plant', selectedFile);
        const response = await fetch('/analyze', { method: 'POST', body: formData });
        const data = await response.json();
        if (data.success) {
            currentResult = data.explanation;
            currentClassification = data.classification;
            goStep(2);
            setTimeout(() => showResults(data), 1500);
        } else {
            goStep(0);
            alert('Error: ' + data.error);
        }
    } catch (err) {
        goStep(0);
        alert('Something went wrong: ' + err.message);
    }
});

function animateScan() {
    let p = 0;
    const fill = document.getElementById('scanFill');
    const pct = document.getElementById('scanPct');
    const iv = setInterval(() => {
        p += Math.random() * 6 + 3;
        if (p >= 95) { p = 95; clearInterval(iv); }
        fill.style.width = Math.min(p, 100) + '%';
        pct.textContent = Math.round(Math.min(p, 100)) + '%';
    }, 120);
}

function showResults(data) {
    goStep(3);
    classLabel.textContent = data.classification.label;
    classConf.textContent = data.classification.confidence + '%';
    renderResult(data.explanation);
    saveToHistory(data.explanation, data.classification, currentImageDataUrl);
}

// ── TEXT CLEANER ─────────────────────────────────────────
function cleanMarkdown(text) {
    return text
        .replace(/#{1,3}\s*/g, '')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/`(.*?)`/g, '$1')
        .replace(/^\s*[-*]\s+/gm, '• ')
        .replace(/---+/g, '')
        .replace(/[🌱🔬🦠📊👩‍🌾🌿✅⚠️🧪🌾🍃🍂]/gu, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function cleanMarkdownToHTML(text) {
    return text
        .replace(/#{1,3}\s*/g, '')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/^\s*[-*]\s+/gm, '• ')
        .replace(/---+/g, '<hr>')
        .replace(/[🌱🔬🦠📊👩‍🌾🌿✅⚠️🧪🌾🍃🍂]/gu, '')
        .replace(/\n{2,}/g, '</p><p>')
        .replace(/\n/g, '<br>')
        .trim();
}

// ── RENDER RESULT ────────────────────────────────────────
function renderResult(text) {
    // Parse sections from markdown headers
    const sections = [];
    const lines = text.split('\n');
    let currentSection = null;
    let currentContent = [];

    for (const line of lines) {
        const headerMatch = line.match(/^#{1,3}\s+(?:\d+\.\s+)?(?:[^\w\s]?\s*)?(.+)/);
        if (headerMatch) {
            if (currentSection !== null) {
                sections.push({ title: currentSection, content: currentContent.join('\n').trim() });
            }
            currentSection = headerMatch[1]
                .replace(/[🌱🔬🦠📊👩‍🌾🌿✅⚠️🧪🌾🍃🍂]/gu, '')
                .replace(/\*\*/g, '')
                .replace(/[()]/g, '')
                .trim();
            currentContent = [];
        } else {
            if (currentSection !== null) currentContent.push(line);
        }
    }
    if (currentSection !== null) {
        sections.push({ title: currentSection, content: currentContent.join('\n').trim() });
    }

    // If no sections parsed, fall back to full clean text
    if (sections.length === 0) {
        resultsBody.innerHTML = `<div class="report-card">
            <div class="report-value"><p>${cleanMarkdownToHTML(text)}</p></div>
        </div>`;
        return;
    }

    let html = '';
    for (const sec of sections) {
        const isSeverity = sec.title.toLowerCase().includes('severity');
        const cleanContent = cleanMarkdownToHTML(sec.content);

        if (isSeverity) {
            const raw = sec.content.toLowerCase();
            let cls = 'severity-healthy';
            if (raw.includes('severe')) cls = 'severity-severe';
            else if (raw.includes('moderate')) cls = 'severity-moderate';
            else if (raw.includes('mild')) cls = 'severity-mild';
            const label = sec.content.replace(/[*#\n]/g, '').trim().split('\n')[0].trim();
            html += `<div class="report-card">
                <div class="report-label">${sec.title}</div>
                <div class="report-value"><span class="severity-badge ${cls}">${label}</span></div>
            </div>`;
        } else {
            html += `<div class="report-card">
                <div class="report-label">${sec.title}</div>
                <div class="report-value"><p>${cleanContent}</p></div>
            </div>`;
        }
    }

    resultsBody.innerHTML = html;
}

// ── SCAN AGAIN ───────────────────────────────────────────
scanAgainBtn.addEventListener('click', () => {
    selectedFile = null; currentResult = null;
    currentClassification = null; currentImageDataUrl = null;
    preview.classList.add('hidden');
    uploadContent.classList.remove('hidden');
    analyzeBtn.classList.add('hidden');
    fileInput.value = '';
    goStep(0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ── PDF EXPORT ───────────────────────────────────────────
pdfBtn.addEventListener('click', () => {
    if (!currentResult) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const margin = 20;
    let y = 0;

    // Header
    doc.setFillColor(27, 94, 32);
    doc.rect(0, 0, pw, 24, 'F');
    doc.setFillColor(76, 175, 80);
    doc.rect(0, 24, pw, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text('PLANT DISEASE REPORT', margin, 15);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(165, 214, 167);
    doc.text('MobileNetV2 + Gemma 4 · For educational purposes only', pw - margin, 15, { align: 'right' });

    y = 34;

    // Classification banner
    if (currentClassification) {
        doc.setFillColor(232, 245, 233);
        doc.roundedRect(margin, y, pw - margin * 2, 18, 3, 3, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(46, 125, 50);
        doc.text('DETECTED', margin + 4, y + 6);
        doc.setFontSize(10);
        doc.setTextColor(27, 94, 32);
        doc.text(currentClassification.label, margin + 4, y + 13);
        doc.setFontSize(7.5);
        doc.setTextColor(46, 125, 50);
        doc.text('CONFIDENCE', pw / 2, y + 6);
        doc.setFontSize(10);
        doc.setTextColor(27, 94, 32);
        doc.text(currentClassification.confidence + '%', pw / 2, y + 13);
        y += 26;
    }

    // Image thumbnail top right
    if (currentImageDataUrl) {
        try { doc.addImage(currentImageDataUrl, 'JPEG', pw - margin - 50, 28, 50, 45, '', 'FAST'); }
        catch (e) { doc.addImage(currentImageDataUrl, 'PNG', pw - margin - 50, 28, 50, 45, '', 'FAST'); }
    }

    // Generated date
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
    y += 8;

    // Divider
    doc.setDrawColor(200, 230, 201);
    doc.line(margin, y, pw - margin, y);
    y += 8;

    // Parse sections for PDF
    const lines2 = currentResult.split('\n');
    let pdfSections = [];
    let curTitle = null;
    let curLines = [];

    for (const line of lines2) {
        const hm = line.match(/^#{1,3}\s+(?:\d+\.\s+)?(?:[^\w\s]?\s*)?(.+)/);
        if (hm) {
            if (curTitle) pdfSections.push({ title: curTitle, content: curLines.join('\n').trim() });
            curTitle = hm[1].replace(/[🌱🔬🦠📊👩‍🌾🌿✅⚠️🧪🌾🍃🍂]/gu, '').replace(/\*\*/g, '').trim();
            curLines = [];
        } else {
            if (curTitle) curLines.push(line);
        }
    }
    if (curTitle) pdfSections.push({ title: curTitle, content: curLines.join('\n').trim() });

    // If no sections, dump full text
    if (pdfSections.length === 0) {
        const cleanFull = cleanMarkdown(currentResult);
        const allLines = doc.splitTextToSize(cleanFull, pw - margin * 2);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(30, 30, 30);
        for (const line of allLines) {
            if (y > ph - 20) { doc.addPage(); y = 20; }
            doc.text(line, margin, y);
            y += 5.2;
        }
    } else {
        for (const sec of pdfSections) {
            const cleanContent = cleanMarkdown(sec.content);
            if (!cleanContent) continue;
            const textLines = doc.splitTextToSize(cleanContent, pw - margin * 2 - 8);
            const blockH = textLines.length * 5.2 + 14;
            if (y + blockH > ph - 20) { doc.addPage(); y = 20; }

            // Section label
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(46, 125, 50);
            doc.text(sec.title.toUpperCase(), margin, y);
            y += 5;

            // Content box
            doc.setFillColor(232, 245, 233);
            doc.roundedRect(margin, y - 1, pw - margin * 2, blockH - 4, 2, 2, 'F');
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9.5);
            doc.setTextColor(27, 50, 27);
            doc.text(textLines, margin + 4, y + 5);
            y += blockH + 2;

            // Separator
            doc.setDrawColor(200, 230, 201);
            doc.line(margin, y, pw - margin, y);
            y += 6;
        }
    }

    // Footer
    doc.setFillColor(232, 245, 233);
    doc.rect(0, ph - 12, pw, 12, 'F');
    doc.setFillColor(76, 175, 80);
    doc.rect(0, ph - 12, pw, 1, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 150, 100);
    doc.text('For educational purposes only. Consult an agricultural expert for serious crop diseases.', pw / 2, ph - 5, { align: 'center' });

    doc.save(`plant-report-${Date.now()}.pdf`);
});

// ── HISTORY ──────────────────────────────────────────────
function saveToHistory(result, classification, imageDataUrl) {
    const history = JSON.parse(localStorage.getItem('plant-history') || '[]');
    history.unshift({ result, classification, image: imageDataUrl, date: new Date().toLocaleString() });
    if (history.length > 10) history.pop();
    localStorage.setItem('plant-history', JSON.stringify(history));
    renderHistory();
}

function renderHistory() {
    const history = JSON.parse(localStorage.getItem('plant-history') || '[]');
    if (history.length === 0) return;
    historySection.style.display = 'block';
    historyList.innerHTML = history.map((item, i) => `
        <div class="history-item" onclick="loadHistory(${i})">
            <img class="history-thumb" src="${item.image}" alt="plant">
            <div class="history-meta">
                <div class="history-date">${item.date}</div>
                <div class="history-preview"><strong>${item.classification?.label || 'Unknown'}</strong> · ${item.classification?.confidence || '—'}% confidence</div>
            </div>
        </div>
    `).join('');
}

function loadHistory(index) {
    const history = JSON.parse(localStorage.getItem('plant-history') || '[]');
    const item = history[index];
    currentResult = item.result;
    currentClassification = item.classification;
    currentImageDataUrl = item.image;
    classLabel.textContent = item.classification?.label || '—';
    classConf.textContent = (item.classification?.confidence || '—') + '%';
    goStep(3);
    renderResult(item.result);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

renderHistory();