class GreenBackgroundRemover {
    constructor() {
        console.log("Background Remover v2 - Soft Mask + Despill");
        // Target color: #00b140
        this.targetColor = { r: 0, g: 177, b: 64 };
        this.tolerance = 45;
        this.removeWatermark = true;
        this.originalImageData = null;

        this.initElements();
        this.bindEvents();
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

        // Download button
        this.downloadBtn.addEventListener('click', () => this.downloadImage());

        // New image button
        this.newImageBtn.addEventListener('click', () => {
            this.uploadSection.style.display = 'flex';
            this.editorSection.style.display = 'none';
            this.fileInput.value = '';
            this.originalImageData = null;
        });
    }

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
                this.setupCanvases(img);
                this.uploadSection.style.display = 'none';
                this.editorSection.style.display = 'block';
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
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

        // PARAMS (could be made adjustable later)
        // Feathering range: how many units of distance for the soft edge
        // Larger = softer.
        const feather = 20;

        // Tolerance threshold base
        const threshold = 10 + (this.tolerance * 1.5);

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            // 1. Calculate color distance
            // We can improve distance metric by using weighted RGB (human perception)
            // but standard Euclidean is usually fine for green screens.
            // Let's stick to simple Euclidean first but maybe boost Green weight slightly?
            // Actually, let's keep it simple: Euclidean distance
            const dist = this.getColorDistance(r, g, b);

            // 2. Alpha Calc (Soft Masking)
            // if dist < threshold, it's background (alpha 0)
            // if dist > threshold + feather, it's foreground (alpha 255)
            // in between, it ramps up

            let alpha = 0;
            if (dist > threshold + feather) {
                alpha = 255;
            } else if (dist > threshold) {
                // Ramp from 0 to 255
                alpha = Math.floor(255 * (dist - threshold) / feather);
            }

            // Apply alpha
            // We don't overwrite alpha if it was already 0 (e.g. from original image)
            // But here we are processing the original fully opaque image usually.
            data[i + 3] = alpha;

            // 3. Despill (Color Correction)
            // If the pixel is semi-transparent OR fully opaque but "greenish", we fix color.
            // A simple despill: if G > avg(R, B), clamp G.
            if (alpha > 0) {
                // Check if green dominates
                // We only despill if it's close to the target color logic or generally green
                // Simple green spill check:
                if (g > r && g > b) {
                    // avg of R and B is a common grey/magenta replacement for green spill
                    const avgRB = (r + b) / 2;
                    // Intensity of replacement
                    // If we are deep in foreground, we might not want to touch it unless it's green fringe.
                    // But for safety, let's only affect near-edge or green-dominant pixels

                    if (g > avgRB) {
                        // reducing green to average of others removes the green cast
                        // data[i+1] = avgRB; 

                        // Better: blend towards the average based on how "green" it is relative to target
                        // If it's very close to target green, we want to suppress it more.
                        data[i + 1] = avgRB;
                    }
                }
            }
        }

        // Second pass: remove watermark if enabled
        if (this.removeWatermark) {
            this.removeGeminiWatermark(data, width, height);
        }

        this.resultCtx.clearRect(0, 0, this.resultCanvas.width, this.resultCanvas.height);
        this.resultCtx.putImageData(imageData, 0, 0);
    }

    getColorDistance(r, g, b) {
        const dr = r - this.targetColor.r;
        const dg = g - this.targetColor.g;
        const db = b - this.targetColor.b;
        return Math.sqrt(dr * dr + dg * dg + db * db);
    }

    removeGeminiWatermark(data, width, height) {
        // The Gemini watermark is a 4-pointed white star, usually at bottom right
        // We restrict removal to the bottom-right corner (85% width/height)
        // AND check for strict white-ish blend characteristics.

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {

                // PERFORMANCE/SAFETY: Only scan bottom-right corner
                if (x < width * 0.85 || y < height * 0.85) continue;

                const i = (y * width + x) * 4;
                if (data[i + 3] === 0) continue; // Already transparent

                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];

                // Check for "White" blend characteristics
                // The watermark is white (255,255,255) blended with Green (0,177,64).
                // Visible watermark pixels will have elevated R and B channels.
                // Standard green screen has R~0 and B~64.

                // Since we are strictly in the bottom-right corner, we can be more sensitive.
                // White blend means R > 0 and B > 64.
                // A faint star might be R=50, B=100.

                if (r > 40 && b > 90) {
                    // This pixel has significantly more Red and Blue than the green background.
                    // Given the location, it's almost certainly the watermark.
                    data[i + 3] = 0;
                }
            }
        }
    }

    setTargetColor(hex) {
        // Parse hex color to RGB
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
