document.addEventListener('DOMContentLoaded', () => {
    const canvasContainer = document.querySelector('.canvas-container');
    const canvas = document.getElementById('pixel-canvas');
    const ctx = canvas.getContext('2d');
    const colorPicker = document.getElementById('color-picker');
    const gradientPickerStart = document.getElementById('gradient-picker-start');
    const gradientPickerEnd = document.getElementById('gradient-picker-end');
    const applyBgGradientBtn = document.getElementById('apply-bg-gradient');
    const brushSizeSlider = document.getElementById('brush-size');
    const brushSizeValue = document.getElementById('brush-size-value');
    const colorPaletteContainer = document.getElementById('color-palette');
    const drawToolBtn = document.getElementById('draw-tool');
    const eraseToolBtn = document.getElementById('erase-tool');
    const fillToolBtn = document.getElementById('fill-tool');
    const eyedropperToolBtn = document.getElementById('eyedropper-tool');
    const gradientToolBtn = document.getElementById('gradient-tool');
    const toggleGridBtn = document.getElementById('toggle-grid-button');
    const exportBtn = document.getElementById('export-button');
    const widthInput = document.getElementById('canvas-width-input');
    const heightInput = document.getElementById('canvas-height-input');
    const resizeBtn = document.getElementById('resize-button');
    const howToUseBtn = document.getElementById('how-to-use-button');
    const modalContainer = document.getElementById('modal-container');
    const modalCloseBtn = document.getElementById('modal-close-button');
    const welcomeModalContainer = document.getElementById('welcome-modal-container');
    const welcomeCloseBtn = document.getElementById('welcome-close-button');
    const welcomeClearBtn = document.getElementById('welcome-clear-button');
    const layersPanel = document.getElementById('layers-panel');
    const addLayerBtn = document.getElementById('add-layer-button');
    const clearLayerBtn = document.getElementById('clear-layer-button');
    const undoBtn = document.getElementById('undo-button');
    const redoBtn = document.getElementById('redo-button');
    const exampleWelcomeBtn = document.getElementById('example-welcome');
    const exampleAppleBtn = document.getElementById('example-apple');
    const exampleCatBtn = document.getElementById('example-cat');

    let PIXEL_SIZE = 20;
    let GRID_WIDTH = 32;
    let GRID_HEIGHT = 32;
    let brushSize = 1;
    const EMPTY_COLOR = null;
    let canvasLayers = [];
    let activeLayerIndex = 0;
    let isDrawing = false;
    let showGrid = true;
    let gradientStartPoint = null;
    let selectedColor = '#FF8F00';
    let currentTool = 'draw';
    let lastMousePos = { x: -1, y: -1 };
    let animationFrameRequest = null;
    
    ctx.imageSmoothingEnabled = false;

    const paletteColors = ['#FFFFFF','#C2C2C2','#858585','#474747','#000000','#D0021B','#F5A623','#F8E71C','#7ED321','#4A90E2','#4A4AE2','#9013FE','#BD10E0'];
    const deepCopyGrid = (grid) => JSON.parse(JSON.stringify(grid));
    function hexToRgb(hex) { const r = parseInt(hex.slice(1, 3), 16),g = parseInt(hex.slice(3, 5), 16),b = parseInt(hex.slice(5, 7), 16);return { r, g, b };}
    function hexToRgba(hex, alpha) {const {r,g,b} = hexToRgb(hex);return `rgba(${r}, ${g}, ${b}, ${alpha})`;}
    function rgbToHex(r, g, b) { return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();}
    function lerpColor(c1, c2, a) { const C1=hexToRgb(c1),C2=hexToRgb(c2),r=Math.round(C1.r+(C2.r-C1.r)*a),g=Math.round(C1.g+(C2.g-C1.g)*a),b=Math.round(C1.b+(C2.b-C1.b)*a);return rgbToHex(r,g,b);}
    function getLinePixels(x0,y0,x1,y1){const p=[],dx=Math.abs(x1-x0),dy=Math.abs(y1-y0),sx=x0<x1?1:-1,sy=y0<y1?1:-1;let err=dx-dy;while(!0){p.push({x:x0,y:y0});if(x0===x1&&y0===y1)break;let e2=2*err;e2>-dy&&(err-=dy,x0+=sx),e2<dx&&(err+=dx,y0+=sy)}return p}

    function createNewLayer() {
        const grid = Array(GRID_HEIGHT).fill(null).map(() => Array(GRID_WIDTH).fill(EMPTY_COLOR));
        return { grid: grid, history: [], redo: [] };
    }
    function saveState() {
        const activeLayer = canvasLayers[activeLayerIndex]; if (!activeLayer) return;
        activeLayer.history.push(deepCopyGrid(activeLayer.grid)); activeLayer.redo = [];
        if (activeLayer.history.length > 50) activeLayer.history.shift();
    }
    function loadExample(example, confirmFirst = true) {
        if (confirmFirst && !confirm("This will clear your current project. Are you sure?")) return;
        GRID_WIDTH = example.width;
        GRID_HEIGHT = example.height;
        const newLayer = createNewLayer();
        newLayer.grid = example.data;
        canvasLayers = [newLayer];
        activeLayerIndex = 0;
        startApp();
    }

    function drawScene() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvasLayers.forEach((layer, index) => {
            const grid = layer.grid;
            const isDimmed = index !== activeLayerIndex;
            for (let y = 0; y < GRID_HEIGHT; y++) {
                for (let x = 0; x < GRID_WIDTH; x++) {
                    if (grid[y][x]) {
                        ctx.fillStyle = isDimmed ? hexToRgba(grid[y][x], 0.3) : grid[y][x];
                        ctx.fillRect(x * PIXEL_SIZE, y * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
                    }
                }
            }
        });
        if (showGrid) drawGrid();
    }
    function drawGrid() {
        if (!showGrid) return;
        ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1;
        for (let x = 0; x <= canvas.width; x += PIXEL_SIZE) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
        for (let y = 0; y <= canvas.height; y += PIXEL_SIZE) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }
    }
    function drawHoverPreview() {
        if (lastMousePos.x === -1 || currentTool === 'fill' || currentTool === 'eyedropper' || isDrawing) return;
        const offset = Math.floor(brushSize / 2);
        const x = lastMousePos.x - offset;
        const y = lastMousePos.y - offset;
        ctx.fillStyle = "rgba(74, 144, 226, 0.4)";
        ctx.strokeStyle = "rgba(74, 144, 226, 0.8)";
        ctx.lineWidth = 1;
        ctx.strokeRect(x * PIXEL_SIZE - 0.5, y * PIXEL_SIZE - 0.5, brushSize * PIXEL_SIZE + 1, brushSize * PIXEL_SIZE + 1);
    }
    function render() {
        if (animationFrameRequest) cancelAnimationFrame(animationFrameRequest);
        animationFrameRequest = requestAnimationFrame(() => {
            drawScene();
            drawHoverPreview();
        });
    }

    function applyBrush(x, y, color) {
        const targetColor = color !== undefined ? color : (currentTool === 'erase' ? EMPTY_COLOR : selectedColor);
        const offset = Math.floor(brushSize / 2);
        for (let i = 0; i < brushSize; i++) {
            for (let j = 0; j < brushSize; j++) {
                const drawX = x + i - offset;
                const drawY = y + j - offset;
                if (drawY >= 0 && drawY < GRID_HEIGHT && drawX >= 0 && drawX < GRID_WIDTH) {
                    canvasLayers[activeLayerIndex].grid[drawY][drawX] = targetColor;
                }
            }
        }
    }
    function floodFill(startX, startY) {
        const activeGrid = canvasLayers[activeLayerIndex].grid;
        const startColor = activeGrid[startY][startX]; if (startColor === selectedColor) return;
        const pixelStack = [[startX, startY]];
        while (pixelStack.length) {
            const [x, y] = pixelStack.pop();
            if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT || activeGrid[y][x] !== startColor) continue;
            activeGrid[y][x] = selectedColor;
            pixelStack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }
    }

    function renderLayersUI() { 
        layersPanel.innerHTML = '';
        canvasLayers.forEach((layer, index) => {
            const item = document.createElement('div');
            item.className = 'layer-item';
            const layerBtn = document.createElement('button');
            layerBtn.className = 'layer-button';
            layerBtn.textContent = `Layer ${index + 1}`;
            if (index === activeLayerIndex) layerBtn.classList.add('active');
            layerBtn.addEventListener('click', () => { activeLayerIndex = index; renderLayersUI(); render(); });
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-layer-btn';
            deleteBtn.innerHTML = `<i class="material-icons">close</i>`;
            deleteBtn.title = 'Delete Layer';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (canvasLayers.length > 1) {
                    canvasLayers.splice(index, 1);
                    if (activeLayerIndex >= index) activeLayerIndex = Math.max(0, activeLayerIndex - 1);
                    renderLayersUI(); render();
                } else { alert("Cannot delete the last layer!"); }
            });
            item.appendChild(layerBtn);
            item.appendChild(deleteBtn);
            layersPanel.prepend(item);
        });
    }
    function updateActiveTool(tool) {
        currentTool = tool; gradientStartPoint = null;
        const buttons = [drawToolBtn, eraseToolBtn, fillToolBtn, eyedropperToolBtn, gradientToolBtn];
        buttons.forEach(btn => btn.classList.remove('active'));
        document.getElementById(`${tool}-tool`).classList.add('active');
    }
    function populatePalette() {
        colorPaletteContainer.innerHTML = '';
        paletteColors.forEach(color => {
            const colorBox = document.createElement('div');
            colorBox.className = 'color-box'; colorBox.style.backgroundColor = color;
            colorBox.dataset.color = color;
            if (color === selectedColor) colorBox.classList.add('selected');
            colorBox.addEventListener('click', () => {
                selectedColor = color;
                colorPicker.value = color;
                document.querySelector('.color-box.selected')?.classList.remove('selected');
                colorBox.classList.add('selected');
            });
            colorPaletteContainer.appendChild(colorBox);
        });
    }

    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        lastMousePos.x = Math.floor((e.clientX - rect.left) / PIXEL_SIZE);
        lastMousePos.y = Math.floor((e.clientY - rect.top) / PIXEL_SIZE);
        if (isDrawing) {
            applyBrush(lastMousePos.x, lastMousePos.y);
            render();
        } else {
            render();
        }
    });
    canvas.addEventListener('mouseleave', () => { lastMousePos = {x: -1, y: -1}; isDrawing = false; render(); });
    canvas.addEventListener('mousedown', (e) => {
        const x = lastMousePos.x;
        const y = lastMousePos.y;
        if (currentTool === 'eyedropper') {
            for (let i = canvasLayers.length - 1; i >= 0; i--) {
                const color = canvasLayers[i].grid[y][x];
                if (color) {
                    selectedColor = color; colorPicker.value = color;
                    populatePalette(); updateActiveTool('draw'); break;
                }
            }
            return;
        }
        isDrawing = true;
        saveState();
        if (currentTool === 'fill') {
            floodFill(x, y); isDrawing = false;
        } else if (currentTool === 'gradient') {
            if (!gradientStartPoint) { gradientStartPoint = { x, y }; }
            else {
                const points = getLinePixels(gradientStartPoint.x, gradientStartPoint.y, x, y);
                const color1 = gradientPickerStart.value, color2 = gradientPickerEnd.value;
                points.forEach((p, i) => {
                    const interpolatedColor = lerpColor(color1, color2, i / (points.length - 1));
                    applyBrush(p.x, p.y, interpolatedColor);
                });
                gradientStartPoint = null;
            }
            isDrawing = false;
        } else {
            applyBrush(x, y);
        }
        render();
    });
    canvas.addEventListener('mouseup', () => { isDrawing = false; });
    
    colorPicker.addEventListener('input', (e) => { selectedColor = e.target.value; document.querySelector('.color-box.selected')?.classList.remove('selected'); });
    brushSizeSlider.addEventListener('input', (e) => { brushSize = parseInt(e.target.value, 10); brushSizeValue.textContent = brushSize; });
    drawToolBtn.addEventListener('click', () => updateActiveTool('draw')); eraseToolBtn.addEventListener('click', () => updateActiveTool('erase'));
    fillToolBtn.addEventListener('click', () => updateActiveTool('fill')); gradientToolBtn.addEventListener('click', () => updateActiveTool('gradient'));
    eyedropperToolBtn.addEventListener('click', () => updateActiveTool('eyedropper'));
    toggleGridBtn.addEventListener('click', () => { showGrid = !showGrid; render(); });
    applyBgGradientBtn.addEventListener('click', () => { saveState(); const c1=gradientPickerStart.value,c2=gradientPickerEnd.value,g=canvasLayers[activeLayerIndex].grid;for(let y=0;y<GRID_HEIGHT;y++){const a=y/(GRID_HEIGHT-1),rc=lerpColor(c1,c2,a);for(let x=0;x<GRID_WIDTH;x++)g[y][x]=rc}render()});
    addLayerBtn.addEventListener('click', () => { saveState(); canvasLayers.push(createNewLayer()); activeLayerIndex = canvasLayers.length - 1; renderLayersUI(); render(); });
    clearLayerBtn.addEventListener('click', () => { saveState(); canvasLayers[activeLayerIndex] = createNewLayer(); render(); });
    undoBtn.addEventListener('click', () => { const a=canvasLayers[activeLayerIndex]; if(a.history.length>0){ a.redo.push(deepCopyGrid(a.grid)); a.grid=a.history.pop(); render()}});
    redoBtn.addEventListener('click', () => { const a=canvasLayers[activeLayerIndex]; if(a.redo.length>0){ a.history.push(deepCopyGrid(a.grid)); a.grid=a.redo.pop(); render()}});
    resizeBtn.addEventListener('click', () => { if(confirm("Resizing will clear all work. Continue?")){GRID_WIDTH=parseInt(widthInput.value,10);GRID_HEIGHT=parseInt(heightInput.value,10);initialBoot(true, true)}});
    exportBtn.addEventListener('click', () => { const t=document.createElement('canvas');t.width=GRID_WIDTH;t.height=GRID_HEIGHT;const x=t.getContext('2d'),d=x.createImageData(GRID_WIDTH,GRID_HEIGHT);canvasLayers.forEach(l=>{for(let y=0;y<GRID_HEIGHT;y++)for(let x=0;x<GRID_WIDTH;x++)if(l.grid[y][x]){const c=hexToRgb(l.grid[y][x]),i=(y*GRID_WIDTH+x)*4;d.data[i]=c.r;d.data[i+1]=c.g;d.data[i+2]=c.b;d.data[i+3]=255}});x.putImageData(d,0,0);const a=document.createElement('a');a.download='dream-weave.png';a.href=t.toDataURL('image/png');a.click()});
    howToUseBtn.addEventListener('click', () => modalContainer.classList.remove('hidden'));
    modalCloseBtn.addEventListener('click', () => modalContainer.classList.add('hidden'));
    welcomeCloseBtn.addEventListener('click', () => welcomeModalContainer.classList.add('hidden'));
    welcomeClearBtn.addEventListener('click', () => {
        welcomeModalContainer.classList.add('hidden');
        initialBoot(true, true);
    });
    exampleWelcomeBtn.addEventListener('click', () => loadExample(examples.welcome));
    exampleAppleBtn.addEventListener('click', () => loadExample(examples.apple));
    exampleCatBtn.addEventListener('click', () => loadExample(examples.cat));

    function handleResize() {
        const containerRect = canvasContainer.getBoundingClientRect();
        const sizeX = Math.floor(containerRect.width / GRID_WIDTH);
        const sizeY = Math.floor(containerRect.height / GRID_HEIGHT);
        PIXEL_SIZE = Math.max(1, Math.min(sizeX, sizeY));
        canvas.width = GRID_WIDTH * PIXEL_SIZE;
        canvas.height = GRID_HEIGHT * PIXEL_SIZE;
        render();
    }
    function initialBoot(createDefaultLayer = true, blank = false) {
        if (createDefaultLayer) {
            canvasLayers = [];
            if (blank) {
                canvasLayers.push(createNewLayer());
            } else {
                loadExample(examples.welcome, false);
                return; // loadExample calls startApp
            }
        }
        startApp();
    }
    function startApp() {
        widthInput.value = GRID_WIDTH;
        heightInput.value = GRID_HEIGHT;
        updateActiveTool('draw');
        renderLayersUI();
        handleResize();
    }
    
    populatePalette();
    initialBoot();
    new ResizeObserver(handleResize).observe(canvasContainer);
});
