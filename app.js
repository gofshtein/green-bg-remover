class GreenBackgroundRemover {
    constructor() {
        console.log("Background Remover v2 - Soft Mask + Despill");
        // Target color: #00b140
        this.targetColor = { r: 0, g: 177, b: 64 };
        this.tolerance = 45;
        this.removeWatermark = true;
        this.originalImageData = null;
        this.isGenerateMode = false;

        this.initElements();
        this.bindEvents();
        this.loadApiKey();
    }

    initElements() {
        this.uploadZone = document.getElementById('uploadZone');
        this.fileInput = document.getElementById('fileInput');
        this.uploadSection = document.getElementById('uploadSection');
        this.editorSection = document.getElementById('editorSection');
        this.originalCanvas = document.getElementById('originalCanvas');
        this.resultCanvas = document.getElementById('resultCanvas');
        this.toleranceSlider = document.getElementById('tolerance');
        this.toleranceValue = document.getElementById('toleranceValue');
        this.colorPicker = document.getElementById('targetColor');
        this.colorHex = document.getElementById('colorHex');
        this.watermarkCheckbox = document.getElementById('removeWatermark');
        this.resetBtn = document.getElementById('resetBtn');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.newImageBtn = document.getElementById('newImageBtn');

        this.originalCtx = this.originalCanvas.getContext('2d');
        this.resultCtx = this.resultCanvas.getContext('2d');

        // Layout elements for generate vs upload mode
        this.controlsBar = document.getElementById('controlsBar');
        this.generateResultBar = document.getElementById('generateResultBar');
        this.originalPanel = document.getElementById('originalPanel');
        this.arrowDivider = document.getElementById('arrowDivider');
        this.resultLabel = document.getElementById('resultLabel');
        this.previewContainer = document.getElementById('previewContainer');

        // Generate / API key elements
        this.apiKeyToggle = document.getElementById('apiKeyToggle');
        this.apiKeyPanel = document.getElementById('apiKeyPanel');
        this.apiKeyInput = document.getElementById('apiKeyInput');
        this.apiKeySaveBtn = document.getElementById('apiKeySaveBtn');
        this.apiKeyStatus = document.getElementById('apiKeyStatus');
        this.promptInput = document.getElementById('promptInput');
        this.generateBtn = document.getElementById('generateBtn');
        this.generateLoading = document.getElementById('generateLoading');
        this.generateError = document.getElementById('generateError');
        this.refImageBtn = document.getElementById('refImageBtn');
        this.refImageInput = document.getElementById('refImageInput');
        this.refImagePreview = document.getElementById('refImagePreview');
        this.refImageThumb = document.getElementById('refImageThumb');
        this.refImageRemove = document.getElementById('refImageRemove');
        this.refImageBase64 = null;
        this.refImageMime = null;
        this.tabGenerate = document.getElementById('tabGenerate');
        this.tabUpload = document.getElementById('tabUpload');
        this.generateTab = document.getElementById('generateTab');
        this.uploadTab = document.getElementById('uploadTab');
    }

    bindEvents() {
        // Upload zone click
        this.uploadZone.addEventListener('click', () => this.fileInput.click());

        // File input change
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));

        // Drag and drop
        this.uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.uploadZone.classList.add('dragover');
        });

        this.uploadZone.addEventListener('dragleave', () => {
            this.uploadZone.classList.remove('dragover');
        });

        this.uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.uploadZone.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0 && files[0].type.startsWith('image/')) {
                this.loadImage(files[0]);
            }
        });

        // Color picker
        this.colorPicker.addEventListener('input', (e) => {
            this.setTargetColor(e.target.value);
            if (this.originalImageData) {
                this.processImage();
            }
        });

        // Tolerance slider
        this.toleranceSlider.addEventListener('input', (e) => {
            this.tolerance = parseInt(e.target.value);
            this.toleranceValue.textContent = this.tolerance;
            if (this.originalImageData) {
                this.processImage();
            }
        });

        // Watermark checkbox
        this.watermarkCheckbox.addEventListener('change', (e) => {
            this.removeWatermark = e.target.checked;
            if (this.originalImageData) {
                this.processImage();
            }
        });

        // Reset button
        this.resetBtn.addEventListener('click', () => {
            this.toleranceSlider.value = 45;
            this.tolerance = 45;
            this.toleranceValue.textContent = '45';
            this.colorPicker.value = '#00b140';
            this.setTargetColor('#00b140');
            this.watermarkCheckbox.checked = true;
            this.removeWatermark = true;
            if (this.originalImageData) {
                this.processImage();
            }
        });

        // Download buttons
        this.downloadBtn.addEventListener('click', () => this.downloadImage());
        document.getElementById('downloadBtnGen').addEventListener('click', () => this.downloadImage());

        // New image button
        this.newImageBtn.addEventListener('click', () => {
            this.uploadSection.style.display = 'flex';
            this.editorSection.style.display = 'none';
            this.fileInput.value = '';
            this.originalImageData = null;
            this.isGenerateMode = false;
        });

        // API key toggle
        this.apiKeyToggle.addEventListener('click', () => {
            const visible = this.apiKeyPanel.style.display !== 'none';
            this.apiKeyPanel.style.display = visible ? 'none' : 'flex';
        });

        // API key save
        this.apiKeySaveBtn.addEventListener('click', () => this.saveApiKey());
        this.apiKeyInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.saveApiKey();
        });

        // Tab switching
        this.tabGenerate.addEventListener('click', () => this.switchTab('generate'));
        this.tabUpload.addEventListener('click', () => this.switchTab('upload'));

        // Generate button
        this.generateBtn.addEventListener('click', () => this.generateImage());

        // Allow Ctrl+Enter in prompt textarea
        this.promptInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.generateImage();
            }
        });

        // Reference image
        this.refImageBtn.addEventListener('click', () => this.refImageInput.click());
        this.refImageInput.addEventListener('change', (e) => this.handleRefImage(e));
        this.refImageRemove.addEventListener('click', () => this.clearRefImage());
    }

    handleRefImage(e) {
        const file = e.target.files[0];
        if (!file || !file.type.startsWith('image/')) return;
        this.refImageMime = file.type;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const dataUrl = ev.target.result;
            this.refImageBase64 = dataUrl.split(',')[1];
            this.refImageThumb.src = dataUrl;
            this.refImagePreview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }

    clearRefImage() {
        this.refImageBase64 = null;
        this.refImageMime = null;
        this.refImageInput.value = '';
        this.refImagePreview.style.display = 'none';
    }

    // --- Tab switching ---

    switchTab(tab) {
        if (tab === 'generate') {
            this.tabGenerate.classList.add('active');
            this.tabUpload.classList.remove('active');
            this.generateTab.style.display = 'block';
            this.uploadTab.style.display = 'none';
        } else {
            this.tabUpload.classList.add('active');
            this.tabGenerate.classList.remove('active');
            this.uploadTab.style.display = 'block';
            this.generateTab.style.display = 'none';
        }
    }

    // --- API key management ---

    loadApiKey() {
        const key = localStorage.getItem('gemini_api_key') || '';
        this.apiKeyInput.value = key;
        this.updateApiKeyStatus(!!key);
    }

    saveApiKey() {
        const key = this.apiKeyInput.value.trim();
        if (key) {
            localStorage.setItem('gemini_api_key', key);
        } else {
            localStorage.removeItem('gemini_api_key');
        }
        this.updateApiKeyStatus(!!key);
        this.apiKeyPanel.style.display = 'none';
    }

    updateApiKeyStatus(hasKey) {
        this.apiKeyStatus.textContent = hasKey ? 'Set' : 'Not set';
        this.apiKeyStatus.className = 'api-key-status ' + (hasKey ? 'set' : 'not-set');
    }

    // --- Image generation ---

    async generateImage() {
        const apiKey = localStorage.getItem('gemini_api_key');
        if (!apiKey) {
            this.showGenerateError('Please set your Gemini API key first.');
            this.apiKeyPanel.style.display = 'flex';
            return;
        }

        const prompt = this.promptInput.value.trim();
        if (!prompt) {
            this.showGenerateError('Please enter a prompt.');
            return;
        }

        this.setGenerating(true);

        const modifiedPrompt = 'Generate: ' + prompt + '. IMPORTANT: Place the subject on a solid, flat, uniform chromakey green background. The background MUST be exactly hex color #00FF00 (RGB 0, 255, 0) with absolutely no gradients, shadows, textures, or color variations. Add a thin white outline around the subject to cleanly separate it from the green background. Do not use any green colors in the subject itself.';

        try {
            const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent';
            const parts = [{ text: modifiedPrompt }];
            if (this.refImageBase64) {
                parts.push({
                    inlineData: {
                        mimeType: this.refImageMime,
                        data: this.refImageBase64
                    }
                });
            }

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': apiKey
                },
                body: JSON.stringify({
                    contents: [{ parts }],
                    generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }
                })
            });

            if (!response.ok) {
                const errBody = await response.text();
                throw new Error(`API error ${response.status}: ${errBody}`);
            }

            const data = await response.json();

            // Find the inline image in the response
            let imageData = null;
            if (data.candidates) {
                for (const candidate of data.candidates) {
                    if (candidate.content && candidate.content.parts) {
                        for (const part of candidate.content.parts) {
                            if (part.inlineData && part.inlineData.mimeType && part.inlineData.mimeType.startsWith('image/')) {
                                imageData = part.inlineData;
                                break;
                            }
                        }
                    }
                    if (imageData) break;
                }
            }

            if (!imageData) {
                throw new Error('No image was returned by the API. Try a different prompt.');
            }

            // Load base64 image
            const img = new Image();
            img.onload = () => {
                this.isGenerateMode = true;
                this.removeWatermark = false;
                this.watermarkCheckbox.checked = false;
                this.setupCanvases(img);
                this.showEditorForMode();
                this.setGenerating(false);
            };
            img.onerror = () => {
                this.setGenerating(false);
                this.showGenerateError('Failed to load the generated image.');
            };
            img.src = `data:${imageData.mimeType};base64,${imageData.data}`;

        } catch (err) {
            this.setGenerating(false);
            this.showGenerateError(err.message);
        }
    }

    setGenerating(loading) {
        this.generateBtn.disabled = loading;
        this.promptInput.disabled = loading;
        this.generateLoading.style.display = loading ? 'flex' : 'none';
        if (loading) {
            this.generateError.style.display = 'none';
        }
    }

    showGenerateError(message) {
        this.generateError.textContent = message;
        this.generateError.style.display = 'block';
    }

    // --- HSV utilities for chromakey detection ---

    rgbToHsv(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const d = max - min;
        let h = 0;
        const s = max === 0 ? 0 : d / max;
        const v = max;
        if (d !== 0) {
            if (max === r) h = ((g - b) / d + 6) % 6;
            else if (max === g) h = (b - r) / d + 2;
            else h = (r - g) / d + 4;
            h *= 60;
        }
        return { h, s, v }; // h: 0-360, s: 0-1, v: 0-1
    }

    // Check if a pixel is chromakey green in HSV space
    isChromaGreen(r, g, b) {
        const hsv = this.rgbToHsv(r, g, b);
        // Green hue: 80-160, high saturation, decent brightness
        return hsv.h >= 80 && hsv.h <= 160 && hsv.s >= 0.40 && hsv.v >= 0.30;
    }

    // --- Existing functionality ---

    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            this.loadImage(file);
        }
    }

    loadImage(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.isGenerateMode = false;
                this.setupCanvases(img);
                this.showEditorForMode();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    showEditorForMode() {
        this.uploadSection.style.display = 'none';
        this.editorSection.style.display = 'block';

        if (this.isGenerateMode) {
            // Generate mode: show only the result, no controls bar
            this.controlsBar.style.display = 'none';
            this.generateResultBar.style.display = 'flex';
            this.originalPanel.style.display = 'none';
            this.arrowDivider.style.display = 'none';
            this.resultLabel.textContent = 'Generated';
            this.previewContainer.classList.add('single-result');
        } else {
            // Upload mode: show full editor with original + result
            this.controlsBar.style.display = 'flex';
            this.generateResultBar.style.display = 'none';
            this.originalPanel.style.display = 'block';
            this.arrowDivider.style.display = 'block';
            this.resultLabel.textContent = 'Result';
            this.previewContainer.classList.remove('single-result');
        }
    }

    setupCanvases(img) {
        // Set canvas dimensions
        const maxWidth = 500;
        const maxHeight = 400;
        let width = img.width;
        let height = img.height;

        // Scale down if needed
        if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.floor(width * ratio);
            height = Math.floor(height * ratio);
        }

        this.originalCanvas.width = width;
        this.originalCanvas.height = height;
        this.resultCanvas.width = width;
        this.resultCanvas.height = height;

        // Draw original image
        this.originalCtx.drawImage(img, 0, 0, width, height);

        // Store original image data
        this.originalImageData = this.originalCtx.getImageData(0, 0, width, height);

        // Process the image
        this.processImage();
    }

    processImage() {
        if (!this.originalImageData) return;

        const width = this.originalImageData.width;
        const height = this.originalImageData.height;

        const imageData = new ImageData(
            new Uint8ClampedArray(this.originalImageData.data),
            width,
            height
        );

        const data = imageData.data;

        if (this.isGenerateMode) {
            this.processFloodFill(data, width, height);
        } else {
            this.processGlobalColor(data, width, height);
        }

        // Second pass: remove watermark if enabled
        if (this.removeWatermark) {
            this.removeGeminiWatermark(data, width, height);
        }

        this.resultCtx.clearRect(0, 0, this.resultCanvas.width, this.resultCanvas.height);
        this.resultCtx.putImageData(imageData, 0, 0);
    }

    // Flood-fill from edges using HSV green detection
    processFloodFill(data, width, height) {
        const totalPixels = width * height;
        // 0 = unvisited, 1 = background (green), 2 = not green
        const mask = new Uint8Array(totalPixels);

        const isGreen = (idx) => {
            return this.isChromaGreen(data[idx * 4], data[idx * 4 + 1], data[idx * 4 + 2]);
        };

        // Seed queue with all edge pixels that are green
        const queue = [];
        const seedEdge = (idx) => {
            if (mask[idx] === 0 && isGreen(idx)) {
                mask[idx] = 1;
                queue.push(idx);
            }
        };

        for (let x = 0; x < width; x++) {
            seedEdge(x);                              // top row
            seedEdge((height - 1) * width + x);      // bottom row
        }
        for (let y = 1; y < height - 1; y++) {
            seedEdge(y * width);                      // left column
            seedEdge(y * width + (width - 1));        // right column
        }

        // BFS flood fill — only spread through green pixels
        let head = 0;
        while (head < queue.length) {
            const idx = queue[head++];
            const x = idx % width;
            const y = (idx - x) / width;

            const neighbors = [];
            if (x > 0) neighbors.push(idx - 1);
            if (x < width - 1) neighbors.push(idx + 1);
            if (y > 0) neighbors.push(idx - width);
            if (y < height - 1) neighbors.push(idx + width);

            for (const nIdx of neighbors) {
                if (mask[nIdx] !== 0) continue;
                if (isGreen(nIdx)) {
                    mask[nIdx] = 1;
                    queue.push(nIdx);
                } else {
                    mask[nIdx] = 2;
                }
            }
        }

        // Apply: make background pixels transparent, feather edges
        for (let i = 0; i < totalPixels; i++) {
            if (mask[i] === 1) {
                data[i * 4 + 3] = 0; // fully transparent

                // Despill: also clean green from neighboring semi-green pixels
            } else if (mask[i] === 2) {
                // Edge pixel (neighbor of background) — check for green spill
                const r = data[i * 4];
                const g = data[i * 4 + 1];
                const b = data[i * 4 + 2];
                const hsv = this.rgbToHsv(r, g, b);

                // Soften edges: if pixel is somewhat green, make semi-transparent
                if (hsv.h >= 80 && hsv.h <= 160 && hsv.s >= 0.20) {
                    const greenness = Math.min(hsv.s / 0.40, 1.0);
                    data[i * 4 + 3] = Math.floor(255 * (1 - greenness * 0.7));
                    // Despill
                    if (g > r && g > b) {
                        data[i * 4 + 1] = Math.floor((r + b) / 2);
                    }
                }
            }
        }
    }

    // Original global color-distance removal for uploaded green screen images
    processGlobalColor(data, width, height) {
        const feather = 20;
        const threshold = 10 + (this.tolerance * 1.5);

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            const dist = this.getColorDistance(r, g, b);

            let alpha = 0;
            if (dist > threshold + feather) {
                alpha = 255;
            } else if (dist > threshold) {
                alpha = Math.floor(255 * (dist - threshold) / feather);
            }

            data[i + 3] = alpha;

            // Despill green fringe
            if (alpha > 0 && g > r && g > b) {
                const avgRB = (r + b) / 2;
                if (g > avgRB) {
                    data[i + 1] = avgRB;
                }
            }
        }
    }

    getColorDistance(r, g, b) {
        const dr = r - this.targetColor.r;
        const dg = g - this.targetColor.g;
        const db = b - this.targetColor.b;
        return Math.sqrt(dr * dr + dg * dg + db * db);
    }

    removeGeminiWatermark(data, width, height) {
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (x < width * 0.85 || y < height * 0.85) continue;

                const i = (y * width + x) * 4;
                if (data[i + 3] === 0) continue;

                const r = data[i];
                const b = data[i + 2];

                if (r > 40 && b > 90) {
                    data[i + 3] = 0;
                }
            }
        }
    }

    setTargetColor(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (result) {
            this.targetColor = {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            };
            if (this.colorHex) {
                this.colorHex.textContent = hex.toUpperCase();
            }
        }
    }

    downloadImage() {
        const link = document.createElement('a');
        link.download = 'background-removed.png';
        link.href = this.resultCanvas.toDataURL('image/png');
        link.click();
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    new GreenBackgroundRemover();
});
