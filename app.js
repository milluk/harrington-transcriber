document.addEventListener('DOMContentLoaded', () => {
  // ==========================================================================
  // App State & Configuration
  // ==========================================================================
  const state = {
    // API & Mode Configuration
    apiStatus: 'simulation_only', // 'connected' or 'simulation_only'
    isSimulationMode: true,
    activeImageName: 'sample_reel_frame1.png',
    activeImageDataUrl: null, // Base64 of custom uploaded images

    // Canvas Transformation
    zoom: 1.0,
    panX: 0,
    panY: 0,
    isDragging: false,
    startX: 0,
    startY: 0,

    // Image Filters
    contrast: 100,
    brightness: 100,
    isGrayscale: true,
    isInverted: false,

    // Few-Shot Exemplars and Glossary
    glossary: `========================================================================
JOHN PEABODY HARRINGTON LINGUISTIC TRANSCRIPTION GUIDE (CHUMASH/CALIFORNIA)
========================================================================
Apply these paleographic and phonetic orthography keys to Harrington's cursive script:

PHONETIC CONSONANTS:
1. Glottal Stop: Transcribed as a superscript glottal mark: ˀ (looks like a superscript question mark, loop, or curly apostrophe).
   - E.g. môˀk (water), táˀa (dog), nóˀni, číˀta.
2. Voiceless Alveolar Lateral Fricative: Transcribed as a barred-l: ł or ɬ (often written as 'l' with a hurried horizontal cross stroke).
3. Voiceless Postalveolar Fricative: Transcribed as 'š' (pronounced 'sh'). Written as a standard cursive 's' with a hasty caron/hacek accent above.
4. Voiceless Postalveolar Affricate: Transcribed as 'č' (pronounced 'ch'). Written as 'c' with a hacek accent above.
5. Velar Fricative: Transcribed as 'x' (voiceless velar fricative, as in German 'bach').
6. Uvular Stop: Transcribed as 'q' (voiceless uvular stop).

PHONETIC VOWELS:
1. Mid-Central Vowel (Schwa): Transcribed as 'ə' (written in cursive as a rounded number '3' or reversed 'e').
2. High-Central Unrounded Vowel: Transcribed as 'ɨ' (written in cursive as a standard letter 'i' with a horizontal bar/crossbar through the center).
3. Low-Mid Back Rounded Vowel: Transcribed as 'ɔ' (open-o).

DIACRITICS & ACCENTS:
1. Combining Underdot (◌̣): Harrington uses underdots (e.g. ṣ, ṭ, ṇ) to mark backed or retroflexed articulations.
2. Long Vowels: Marked with a combining macron (◌̄) above the vowel.
3. Stress/Pitch: Harrington represents syllabic stress or high pitch with combining acute accents (◌́).
4. Intonation Pitch Shifts: Harrington sometimes writes music notation symbols: sharp (♯) for high rising pitch, and flat (♭) for low falling pitch.

ARCHIVAL ABBREVIATIONS:
1. 'cons.' or 'c.' -> Consultor (Consultant/Informant, e.g. Fernando Librado, Maria Solares)
2. 'inf.' or 'i.' -> Informante (Informant)
3. 'sign.' or 's.' -> Significa (Means / translated as)
4. 'esp.' or 'sp.' -> Español (Spanish translation glosses)
5. 'eng.' -> English translation glosses
6. 'lit.' -> Literal translation

PALEOGRAPHY CONVENTIONS:
- Words crossed out hurriedly should be wrapped in <del>...</del> tags.
- Marginal notes and editorial additions are wrapped in square brackets [...] with annotations.`,
    
    exemplars: [] // Will initialize with the standard sample
  };

  // ==========================================================================
  // DOM Elements Selector
  // ==========================================================================
  const el = {
    // Header
    apiStatusBadge: document.getElementById('api-status-badge'),
    apiStatusText: document.getElementById('api-status-text'),
    simulationToggle: document.getElementById('simulation-toggle'),
    btnGuide: document.getElementById('btn-guide'),

    // Canvas
    notesImage: document.getElementById('notes-image'),
    notesPdf: document.getElementById('notes-pdf'),
    canvasViewport: document.getElementById('canvas-viewport'),
    canvasImageWrapper: document.getElementById('canvas-image-wrapper'),
    activeImageNameTag: document.getElementById('active-image-name'),
    imageUpload: document.getElementById('image-upload'),
    btnResetCanvas: document.getElementById('btn-reset-canvas'),
    
    // Canvas Filters
    filterContrast: document.getElementById('filter-contrast'),
    filterBrightness: document.getElementById('filter-brightness'),
    valContrast: document.getElementById('val-contrast'),
    valBrightness: document.getElementById('val-brightness'),
    btnFilterGrayscale: document.getElementById('btn-filter-grayscale'),
    btnFilterInvert: document.getElementById('btn-filter-invert'),

    // Editor & Tabs
    tabButtons: document.querySelectorAll('.tab-btn'),
    tabPanels: document.querySelectorAll('.tab-panel'),
    editorTranscription: document.getElementById('editor-transcription'),
    editorNotes: document.getElementById('editor-notes'),
    lineNumbers: document.getElementById('line-numbers'),
    btnAiTranscribe: document.getElementById('btn-ai-transcribe'),
    btnSave: document.getElementById('btn-save'),
    btnExport: document.getElementById('btn-export'),

    // Training Panel
    trainingGlossary: document.getElementById('training-glossary'),
    exemplarsList: document.getElementById('exemplars-list'),
    exemplarCountBadge: document.getElementById('exemplar-count'),
    exemplarsBadge: document.getElementById('exemplars-badge'),
    btnAddActiveExemplar: document.getElementById('btn-add-active-exemplar'),
    aiModelSelect: document.getElementById('ai-model-select'),
    aiTemperature: document.getElementById('ai-temperature'),
    valTemperature: document.getElementById('val-temperature'),

    // Soft Keyboard
    keyboardKeys: document.querySelectorAll('.soft-keyboard-panel .key'),

    // Dialog Guide
    guideDialog: document.getElementById('guide-dialog'),
    btnCloseGuide: document.getElementById('btn-close-guide'),
    btnUnderstand: document.getElementById('btn-understand'),

    // Directory scanning (v2.0)
    inputDirPath: document.getElementById('input-dir-path'),
    btnScanDir: document.getElementById('btn-scan-dir'),
    selectScanFile: document.getElementById('select-scan-file')
  };

  // ==========================================================================
  // Initialization
  // ==========================================================================
  async function init() {
    checkApiStatus();
    setupCanvas();
    setupFilters();
    setupTabs();
    setupEditorLineNumbers();
    setupSoftKeyboard();
    setupTrainingControls();
    setupFileUploading();
    setupDirectoryScanner();
    setupDialog();
    
    // Set initial glossary UI
    el.trainingGlossary.value = state.glossary;

    // Load initial sample exemplar
    const response = await fetch('samples/sample_reel_frame1.json');
    if (response.ok) {
      const data = await response.json();
      // Add default exemplar
      state.exemplars.push({
        name: 'sample_reel_frame1.png',
        image: 'samples/sample_reel_frame1.png',
        transcript: data.transcription,
        isCustom: false
      });
      updateExemplarsUI();
    }
  }

  // Check backend server connection and API Key status
  async function checkApiStatus() {
    try {
      const response = await fetch('/api/status');
      if (response.ok) {
        const data = await response.json();
        state.apiStatus = data.status;
        
        // Update UI Badge
        const statusDot = el.apiStatusBadge.querySelector('.status-dot');
        statusDot.className = 'status-dot ' + (data.status === 'connected' ? 'connected' : 'simulation');
        el.apiStatusText.textContent = data.message;
        
        // If live API key is configured, default simulation toggle off
        if (data.status === 'connected') {
          state.isSimulationMode = false;
          el.simulationToggle.checked = false;
        } else {
          state.isSimulationMode = true;
          el.simulationToggle.checked = true;
        }
      }
    } catch (error) {
      console.warn('Backend server not detected or disconnected. Running in offline UI sandbox.');
      state.apiStatus = 'disconnected';
      const statusDot = el.apiStatusBadge.querySelector('.status-dot');
      statusDot.className = 'status-dot disconnected';
      el.apiStatusText.textContent = 'Server Disconnected (Offline Workbench Mode)';
      state.isSimulationMode = true;
      el.simulationToggle.checked = true;
      el.simulationToggle.disabled = true;
    }
  }

  // ==========================================================================
  // Canvas Viewport Navigation (Zoom & Pan)
  // ==========================================================================
  function setupCanvas() {
    const view = el.canvasViewport;
    const wrapper = el.canvasImageWrapper;

    // Reset Zoom / Pan
    function resetCanvas() {
      state.zoom = 1.0;
      state.panX = 0;
      state.panY = 0;
      applyTransform();
    }
    
    el.btnResetCanvas.addEventListener('click', resetCanvas);

    function applyTransform() {
      wrapper.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;
    }

    // Drag to Pan
    view.addEventListener('mousedown', (e) => {
      // Ensure it's left click
      if (e.button !== 0) return;
      state.isDragging = true;
      state.startX = e.clientX - state.panX;
      state.startY = e.clientY - state.panY;
      view.style.cursor = 'grabbing';
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (!state.isDragging) return;
      state.panX = e.clientX - state.startX;
      state.panY = e.clientY - state.startY;
      applyTransform();
    });

    window.addEventListener('mouseup', () => {
      if (state.isDragging) {
        state.isDragging = false;
        view.style.cursor = 'grab';
      }
    });

    // Scroll to Zoom relative to mouse cursor
    view.addEventListener('wheel', (e) => {
      e.preventDefault();
      
      const zoomFactor = 1.1;
      let newZoom = state.zoom;
      
      if (e.deltaY < 0) {
        newZoom *= zoomFactor;
      } else {
        newZoom /= zoomFactor;
      }
      
      // Boundaries
      newZoom = Math.max(0.4, Math.min(5.0, newZoom));
      
      // Zoom relative to pointer position
      const rect = view.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // Calculate coordinates relative to image wrapper before scale
      const imageX = (mouseX - state.panX) / state.zoom;
      const imageY = (mouseY - state.panY) / state.zoom;
      
      state.zoom = newZoom;
      state.panX = mouseX - imageX * state.zoom;
      state.panY = mouseY - imageY * state.zoom;
      
      applyTransform();
    }, { passive: false });

    // Initialize Canvas Centering
    setTimeout(() => {
      const imgWidth = el.notesImage.naturalWidth || 800;
      const imgHeight = el.notesImage.naturalHeight || 800;
      const viewWidth = view.clientWidth;
      const viewHeight = view.clientHeight;
      
      // Fit to screen initially
      const scaleX = viewWidth / imgWidth;
      const scaleY = viewHeight / imgHeight;
      state.zoom = Math.min(scaleX, scaleY, 1.0) * 0.9;
      
      // Center
      state.panX = (viewWidth - imgWidth * state.zoom) / 2;
      state.panY = (viewHeight - imgHeight * state.zoom) / 2;
      
      applyTransform();
    }, 500);
  }

  // ==========================================================================
  // Image Enhancements (Dynamic Filters)
  // ==========================================================================
  function setupFilters() {
    const updateFilters = () => {
      const filters = [];
      filters.push(`contrast(${state.contrast}%)`);
      filters.push(`brightness(${state.brightness}%)`);
      if (state.isGrayscale) filters.push('grayscale(100%)');
      if (state.isInverted) filters.push('invert(100%)');
      
      el.notesImage.style.filter = filters.join(' ');
    };

    el.filterContrast.addEventListener('input', (e) => {
      state.contrast = e.target.value;
      el.valContrast.textContent = `${state.contrast}%`;
      updateFilters();
    });

    el.filterBrightness.addEventListener('input', (e) => {
      state.brightness = e.target.value;
      el.valBrightness.textContent = `${state.brightness}%`;
      updateFilters();
    });

    el.btnFilterGrayscale.addEventListener('click', () => {
      state.isGrayscale = !state.isGrayscale;
      el.btnFilterGrayscale.classList.toggle('active', state.isGrayscale);
      updateFilters();
    });

    el.btnFilterInvert.addEventListener('click', () => {
      state.isInverted = !state.isInverted;
      el.btnFilterInvert.classList.toggle('active', state.isInverted);
      updateFilters();
    });

    // Default Grayscale Trigger
    updateFilters();
  }

  // ==========================================================================
  // Tabs Navigation
  // ==========================================================================
  function setupTabs() {
    el.tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        
        // Remove active state
        el.tabButtons.forEach(b => b.classList.remove('active'));
        el.tabPanels.forEach(p => p.classList.remove('active'));
        
        // Set active state
        btn.classList.add('active');
        document.getElementById(targetTab).classList.add('active');
      });
    });
  }

  // ==========================================================================
  // Interactive Line Number Tracker
  // ==========================================================================
  function setupEditorLineNumbers() {
    const textarea = el.editorTranscription;
    const linesContainer = el.lineNumbers;

    function updateLineNumbers() {
      const text = textarea.value;
      const lines = text.split('\n');
      const count = Math.max(1, lines.length);
      
      let html = '';
      for (let i = 1; i <= count; i++) {
        html += `<div>${i}</div>`;
      }
      linesContainer.innerHTML = html;
    }

    // Sync scrolling of line numbers and textarea
    textarea.addEventListener('scroll', () => {
      linesContainer.scrollTop = textarea.scrollTop;
    });

    textarea.addEventListener('input', updateLineNumbers);
    window.addEventListener('resize', updateLineNumbers);

    // Initial run
    updateLineNumbers();
  }

  // ==========================================================================
  // Phonetic Soft Keyboard Insertion
  // ==========================================================================
  function setupSoftKeyboard() {
    el.keyboardKeys.forEach(key => {
      key.addEventListener('click', () => {
        const char = key.getAttribute('data-char');
        const textarea = el.editorTranscription;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;

        // Special behavior for combining diacritics
        // They should attach to the *previous* character if typed
        if (key.classList.contains('diacritic')) {
          if (start > 0) {
            textarea.value = text.substring(0, start) + char + text.substring(end);
            textarea.selectionStart = textarea.selectionEnd = start + 1;
          } else {
            // If at very start, insert combined with a placeholder space
            textarea.value = ' ' + char + text.substring(end);
            textarea.selectionStart = textarea.selectionEnd = 2;
          }
        } else {
          // Standard character insert
          textarea.value = text.substring(0, start) + char + text.substring(end);
          textarea.selectionStart = textarea.selectionEnd = start + char.length;
        }

        // Trigger input event to update line counts
        textarea.dispatchEvent(new Event('input'));
        
        // Refocus textarea so the cursor doesn't jump
        textarea.focus();
      });
    });
  }

  // ==========================================================================
  // Training Panel & Exemplars Logic
  // ==========================================================================
  function setupTrainingControls() {
    // Sync temperature text value
    el.aiTemperature.addEventListener('input', (e) => {
      el.valTemperature.textContent = parseFloat(e.target.value).toFixed(1);
    });

    // Save Glossary updates back to active state
    el.trainingGlossary.addEventListener('input', (e) => {
      state.glossary = e.target.value;
    });

    // Add current transcript as a training exemplar
    el.btnAddActiveExemplar.addEventListener('click', () => {
      const activeText = el.editorTranscription.value.trim();
      if (!activeText) {
        alert('Please transcribe the current scan first before adding it as a training exemplar.');
        return;
      }

      // Read current image source (might be base64 or sample path)
      const currentImageSrc = el.notesImage.src;

      // Avoid duplicates of the same file
      const alreadyExists = state.exemplars.some(ex => ex.name === state.activeImageName);
      if (alreadyExists) {
        const confirmOverwrite = confirm(`An exemplar card for "${state.activeImageName}" already exists. Would you like to overwrite it with your corrected transcription?`);
        if (confirmOverwrite) {
          const idx = state.exemplars.findIndex(ex => ex.name === state.activeImageName);
          state.exemplars[idx].transcript = activeText;
          updateExemplarsUI();
          showNotification('Exemplar card updated successfully.');
        }
        return;
      }

      // Add as new exemplar
      state.exemplars.push({
        name: state.activeImageName,
        image: currentImageSrc,
        transcript: activeText,
        isCustom: true
      });

      updateExemplarsUI();
      showNotification('Current scan added as a few-shot exemplar card!');
      
      // Visual accent flash on the training tab to notify user
      const trainingTabBtn = el.tabButtons[1];
      trainingTabBtn.style.animation = 'pulse 1s 2 alternate';
      setTimeout(() => {
        trainingTabBtn.style.animation = '';
      }, 2000);
    });
  }

  function updateExemplarsUI() {
    const list = el.exemplarsList;
    list.innerHTML = '';

    state.exemplars.forEach((ex, idx) => {
      const card = document.createElement('div');
      card.className = 'exemplar-card';
      
      // Thumbnail
      const thumb = document.createElement('div');
      thumb.className = 'exemplar-thumbnail';
      const img = document.createElement('img');
      img.src = ex.image;
      thumb.appendChild(img);
      card.appendChild(thumb);
      
      // Details
      const details = document.createElement('div');
      details.className = 'exemplar-details';
      
      const meta = document.createElement('div');
      meta.className = 'exemplar-meta';
      const name = document.createElement('span');
      name.className = 'ex-name';
      name.textContent = ex.name;
      name.title = ex.name;
      const status = document.createElement('span');
      status.className = 'ex-status';
      status.textContent = ex.isCustom ? 'User Exemplar' : 'Standard Reference';
      meta.appendChild(name);
      meta.appendChild(status);
      details.appendChild(meta);

      const container = document.createElement('div');
      container.className = 'ex-snippet-container';
      const pre = document.createElement('pre');
      pre.className = 'ex-snippet';
      pre.textContent = ex.transcript;
      container.appendChild(pre);
      details.appendChild(container);
      
      card.appendChild(details);

      // Remove button
      const removeBtn = document.createElement('button');
      removeBtn.className = 'btn-remove-ex';
      removeBtn.innerHTML = '&times;';
      removeBtn.title = ex.isCustom ? 'Remove Exemplar' : 'Cannot remove standard reference';
      removeBtn.disabled = !ex.isCustom;
      removeBtn.addEventListener('click', () => {
        state.exemplars.splice(idx, 1);
        updateExemplarsUI();
        showNotification('Exemplar removed.');
      });
      card.appendChild(removeBtn);

      list.appendChild(card);
    });

    // Update badges
    const count = state.exemplars.length;
    el.exemplarCountBadge.textContent = count;
    el.exemplarsBadge.textContent = `${count} Active`;
  }

  // ==========================================================================
  // File Uploading Logic
  // ==========================================================================
  function setupFileUploading() {
    el.imageUpload.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      state.activeImageName = file.name;
      el.activeImageNameTag.textContent = file.name;

      const reader = new FileReader();
      reader.onload = (event) => {
        state.activeImageDataUrl = event.target.result;
        el.notesImage.src = event.target.result;

        // Reset canvas transformation to fit the new uploaded scan
        setTimeout(() => {
          el.btnResetCanvas.click();
        }, 100);

        showNotification(`Loaded new scan: ${file.name}`);
      };
      reader.readAsDataURL(file);
    });
  }

  // ==========================================================================
  // Local Directory Scanner & Synced Dropbox Loader (v2.0)
  // ==========================================================================
  function setupDirectoryScanner() {
    el.btnScanDir.addEventListener('click', scanDirectory);
    el.selectScanFile.addEventListener('change', loadSelectedScanFile);

    // Initial check: Pre-load Troy Anderson's specific J.P. Harrington folder path
    el.inputDirPath.value = '/Users/troy/Dropbox/Miluk/Language/Harrington';
  }

  async function scanDirectory() {
    const dirPath = el.inputDirPath.value.trim();
    if (!dirPath) {
      alert('Please enter a valid directory path to scan.');
      return;
    }

    el.btnScanDir.disabled = true;
    el.btnScanDir.textContent = 'Scanning...';

    try {
      const response = await fetch(`/api/scans-list?dir=${encodeURIComponent(dirPath)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to list directory contents');
      }

      const select = el.selectScanFile;
      select.innerHTML = '';

      if (data.files.length === 0) {
        select.innerHTML = '<option value="">-- No image files found in folder --</option>';
        select.disabled = true;
        showNotification('Scanned successfully. No images found.');
        return;
      }

      // Add default option
      const defaultOpt = document.createElement('option');
      defaultOpt.value = '';
      defaultOpt.textContent = `-- Select from ${data.files.length} images/PDFs --`;
      select.appendChild(defaultOpt);

      // Populate list
      data.files.forEach(file => {
        const opt = document.createElement('option');
        opt.value = file.path;
        opt.textContent = file.name;
        select.appendChild(opt);
      });

      select.disabled = false;
      showNotification(`Scanned folder! Found ${data.files.length} scans.`);

    } catch (error) {
      console.error(error);
      alert(`Directory scan failed: ${error.message}`);
    } finally {
      el.btnScanDir.disabled = false;
      el.btnScanDir.textContent = 'Scan Folder';
    }
  }

  async function loadSelectedScanFile() {
    const filePath = el.selectScanFile.value;
    if (!filePath) return;

    const fileName = el.selectScanFile.options[el.selectScanFile.selectedIndex].textContent;
    state.activeImageName = fileName;
    el.activeImageNameTag.textContent = fileName;

    // Use our server stream proxy URL as the image/PDF source!
    const proxyUrl = `/api/scan-file?path=${encodeURIComponent(filePath)}`;
    
    // Clear editor to prepare for new transcription
    el.editorTranscription.value = '';
    el.editorNotes.value = '';
    el.editorTranscription.dispatchEvent(new Event('input')); // Update line numbers

    const isPdf = fileName.toLowerCase().endsWith('.pdf');

    if (isPdf) {
      // PDF Flow: Toggle display to iframe, hide image element
      el.notesImage.style.display = 'none';
      el.notesPdf.style.display = 'block';
      el.notesPdf.src = proxyUrl;
      
      // Clear base64 cache as PDFs are too large for standard inline uploads
      state.activeImageDataUrl = null;

      // Reset zoom/pan so PDF displays nicely centered
      setTimeout(() => {
        el.btnResetCanvas.click();
      }, 100);
      showNotification(`Loaded PDF scan: ${fileName}`);
    } else {
      // Image Flow: Toggle display to image element, hide PDF iframe
      el.notesPdf.style.display = 'none';
      el.notesPdf.src = ''; // Release iframe memory
      el.notesImage.style.display = 'block';
      el.notesImage.style.opacity = '0';

      // Pre-fetch the file as base64 to ensure it is immediately available for the AI engine
      try {
        const res = await fetch(proxyUrl);
        if (res.ok) {
          const blob = await res.blob();
          state.activeImageDataUrl = await convertBlobToBase64(blob);
        }
      } catch (err) {
        console.warn('Failed to pre-cache selected file as base64:', err);
      }

      el.notesImage.src = proxyUrl;
      el.notesImage.onload = () => {
        el.notesImage.style.opacity = '1';
        // Reset zoom/pan to center the new page
        setTimeout(() => {
          el.btnResetCanvas.click();
        }, 100);
        showNotification(`Loaded scan: ${fileName}`);
      };
    }
  }

  // ==========================================================================
  // AI Transcription Engine (Live Fetch vs Simulated Inference)
  // ==========================================================================
  el.simulationToggle.addEventListener('change', (e) => {
    state.isSimulationMode = e.target.checked;
    showNotification(`Simulation Mode ${state.isSimulationMode ? 'ENABLED' : 'DISABLED'}`);
  });

  el.btnAiTranscribe.addEventListener('click', async () => {
    // Show Loading state
    el.btnAiTranscribe.disabled = true;
    el.btnAiTranscribe.classList.add('loading');
    el.btnAiTranscribe.innerHTML = `
      <svg class="ai-sparkle" viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
        <path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4-3.9-3.8 5.4-.8z"></path>
      </svg>
      Analyzing Handwriting...
    `;

    try {
      if (state.isSimulationMode) {
        // Run Simulation flow
        await runSimulation();
      } else {
        // Run Live API flow
        await runLiveTranscription();
      }
    } catch (err) {
      console.error(err);
      alert(`Transcription failed: ${err.message}`);
    } finally {
      // Restore Button state
      el.btnAiTranscribe.disabled = false;
      el.btnAiTranscribe.classList.remove('loading');
      el.btnAiTranscribe.innerHTML = `
        <svg class="ai-sparkle" viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
          <path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4-3.9-3.8 5.4-.8z"></path>
        </svg>
        Transcribe with AI
      `;
    }
  });

  async function runSimulation() {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 2200));

    // Check if the currently loaded image is the preloaded sample
    if (state.activeImageName === 'sample_reel_frame1.png') {
      const response = await fetch('samples/sample_reel_frame1.json');
      if (response.ok) {
        const data = await response.json();
        
        // Dynamically alter based on glossary rules just to show interaction
        let finalTrans = data.transcription;
        let finalNotes = data.notes;
        
        if (state.glossary.includes('ə') && !finalTrans.includes('ə')) {
          finalNotes += "\n[Simulated Alert: Glossary schwa 'ə' rule matched and verified.]";
        }

        el.editorTranscription.value = finalTrans;
        el.editorNotes.value = finalNotes;
        el.editorTranscription.dispatchEvent(new Event('input')); // Update line numbers
        showNotification('AI Transcription completed in Simulation Mode!');
      } else {
        throw new Error('Failed to load sample JSON transcription data.');
      }
    } else {
      // User uploaded a custom file. Return a beautifully formatted, simulated transcript
      // using Chumash lexical elements to demonstrate the capability!
      const simulatedChumashTrans = `Smithsonian Institution\nNational Anthropological Archives\nReel 5, Frame 412\n\nConsultant: Maria Solares\nLanguage: Samala (Ineseño Chumash)\n\nlexical items regarding local trees and animals:\n\n1. táˀa — dog\n2. kəwə́ˀl — tree\n3. híˀñi — sun, eye\n4. łup — grass, ground cover\n5. pəš — chia seed\n\n[Transcription completed in Simulation Mode]\nTo transcribe this custom microfilm scan with the live Gemini 1.5 Pro model, please load a valid GEMINI_API_KEY in your local .env configuration file and disable Simulation Mode.`;
      
      const simulatedNotes = `Simulated analysis of custom upload: ${state.activeImageName}. We detected custom glottal stops ˀ and barred-l ł characters. Gemini in-context training is active and simulated. To run on actual historical scans, configure your Gemini API Key in the server .env.`;

      el.editorTranscription.value = simulatedChumashTrans;
      el.editorNotes.value = simulatedNotes;
      el.editorTranscription.dispatchEvent(new Event('input'));
      showNotification('Simulated transcription completed for custom upload!');
    }
  }

  async function runLiveTranscription() {
    // Establish target base64 image/PDF
    let targetBase64 = null;
    let mimeType = 'image/png';

    const isPdf = state.activeImageName.toLowerCase().endsWith('.pdf');

    if (state.activeImageName === 'sample_reel_frame1.png') {
      // Convert the preloaded sample scan to base64
      const imgRes = await fetch('samples/sample_reel_frame1.png');
      const blob = await imgRes.blob();
      targetBase64 = await convertBlobToBase64(blob);
      mimeType = blob.type;
    } else if (isPdf) {
      // PDF Flow: Fetch from local proxy stream dynamically
      const filePath = el.selectScanFile.value;
      if (!filePath) {
        throw new Error('No PDF file path selected.');
      }
      
      showNotification('Fetching PDF payload for AI engine...');
      const proxyUrl = `/api/scan-file?path=${encodeURIComponent(filePath)}`;
      const res = await fetch(proxyUrl);
      if (!res.ok) {
        throw new Error('Failed to retrieve PDF data from proxy stream.');
      }
      const blob = await res.blob();
      
      // Large file warning (Gemini API payload limits)
      if (blob.size > 25 * 1024 * 1024) {
        const confirmLarge = confirm(`This PDF is quite large (${(blob.size / (1024 * 1024)).toFixed(1)} MB). Microfilm rolls can exceed Gemini payload size or timeout limits. Would you like to proceed anyway? (We recommend extracting individual page scans if it fails)`);
        if (!confirmLarge) {
          throw new Error('Transcription canceled by researcher due to PDF size limits.');
        }
      }
      
      targetBase64 = await convertBlobToBase64(blob);
      mimeType = 'application/pdf';
    } else {
      // Custom uploaded file or local directory image
      if (!state.activeImageDataUrl) {
        throw new Error('No custom image base64 data loaded. Please upload an image scan or select one from a scanned folder.');
      }
      targetBase64 = state.activeImageDataUrl;
      // Get mime type
      const match = state.activeImageDataUrl.match(/^data:([^;]+);base64,/);
      if (match) {
        mimeType = match[1];
      }
    }

    // Assemble exemplars base64
    const compiledExemplars = [];
    for (const ex of state.exemplars) {
      let exBase64 = null;
      let exMime = 'image/png';
      
      if (ex.image.startsWith('samples/')) {
        const imgRes = await fetch(ex.image);
        const blob = await imgRes.blob();
        exBase64 = await convertBlobToBase64(blob);
        exMime = blob.type;
      } else {
        exBase64 = ex.image;
        const match = ex.image.match(/^data:(image\/\w+);base64,/);
        if (match) exMime = match[1];
      }

      compiledExemplars.push({
        image: exBase64,
        mimeType: exMime,
        transcript: ex.transcript
      });
    }

    // Trigger API Request
    const response = await fetch('/api/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetImage: targetBase64,
        mimeType: mimeType,
        glossary: state.glossary,
        exemplars: compiledExemplars
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'API request failed');
    }

    const result = await response.json();
    
    // Set results
    el.editorTranscription.value = result.transcription || '';
    el.editorNotes.value = result.notes || '';
    el.editorTranscription.dispatchEvent(new Event('input')); // Update line numbers
    showNotification('AI Transcription completed successfully via Gemini!');
  }

  function convertBlobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // ==========================================================================
  // File Export and Saving
  // ==========================================================================
  el.btnSave.addEventListener('click', async () => {
    const text = el.editorTranscription.value;
    const notes = el.editorNotes.value;
    if (!text) {
      alert('Cannot save an empty transcription. Try clicking Transcribe with AI first!');
      return;
    }

    try {
      const response = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: state.activeImageName.split('.')[0],
          metadata: {
            imageName: state.activeImageName,
            isSimulation: state.isSimulationMode,
            modelUsed: el.aiModelSelect.value
          },
          transcription: text,
          notes: notes
        })
      });

      if (response.ok) {
        const data = await response.json();
        showNotification('Transcription successfully saved to server!');
        console.log(data);
      } else {
        throw new Error('Server returned save failure.');
      }
    } catch (err) {
      // Fallback: Download file directly in the browser if Express server is offline
      console.warn('Server offline. Saving file locally via browser download.');
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
        savedAt: new Date().toISOString(),
        imageName: state.activeImageName,
        transcription: text,
        notes: notes
      }, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `${state.activeImageName.split('.')[0]}_transcription.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showNotification('Saved backup JSON to Downloads.');
    }
  });

  el.btnExport.addEventListener('click', async () => {
    const text = el.editorTranscription.value;
    const notes = el.editorNotes.value;
    if (!text) {
      alert('Cannot export an empty transcription.');
      return;
    }

    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: state.activeImageName,
          transcription: text,
          notes: notes
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${state.activeImageName.split('.')[0]}_report.md`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        showNotification('Markdown report exported successfully!');
      } else {
        throw new Error('Export service failed.');
      }
    } catch (err) {
      // Local fallback
      const mdContent = `# Transcription: ${state.activeImageName}
*Transcribed on: ${new Date().toLocaleDateString()}*

## Verbatim Text
\`\`\`text
${text}
\`\`\`

## Paleographic & Linguistic Notes
${notes || 'No notes provided.'}`;

      const dataStr = "data:text/markdown;charset=utf-8," + encodeURIComponent(mdContent);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `${state.activeImageName.split('.')[0]}_report.md`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showNotification('Exported Markdown report.');
    }
  });

  // ==========================================================================
  // Dialog / Popups
  // ==========================================================================
  function setupDialog() {
    el.btnGuide.addEventListener('click', () => {
      el.guideDialog.showModal();
    });

    el.btnCloseGuide.addEventListener('click', () => {
      el.guideDialog.close();
    });

    el.btnUnderstand.addEventListener('click', () => {
      el.guideDialog.close();
    });

    // Click outside to close
    el.guideDialog.addEventListener('click', (e) => {
      const rect = el.guideDialog.getBoundingClientRect();
      if (
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom
      ) {
        el.guideDialog.close();
      }
    });
  }

  // ==========================================================================
  // Visual Notification Banner Utility
  // ==========================================================================
  function showNotification(message) {
    // Create element
    const banner = document.createElement('div');
    banner.style.position = 'fixed';
    banner.style.bottom = '20px';
    banner.style.right = '20px';
    banner.style.backgroundColor = 'rgba(22, 22, 26, 0.9)';
    banner.style.backdropFilter = 'blur(10px)';
    banner.style.border = '1px solid var(--border-focus)';
    banner.style.boxShadow = 'var(--shadow-md)';
    banner.style.color = 'var(--text-primary)';
    banner.style.padding = '10px 20px';
    banner.style.borderRadius = '6px';
    banner.style.fontSize = '0.8rem';
    banner.style.fontFamily = 'var(--font-body)';
    banner.style.zIndex = '999';
    banner.style.transform = 'translateY(100px)';
    banner.style.opacity = '0';
    banner.style.transition = 'all var(--transition-normal)';
    
    banner.textContent = message;
    document.body.appendChild(banner);

    // Animate In
    setTimeout(() => {
      banner.style.transform = 'translateY(0)';
      banner.style.opacity = '1';
    }, 50);

    // Animate Out
    setTimeout(() => {
      banner.style.transform = 'translateY(100px)';
      banner.style.opacity = '0';
      setTimeout(() => {
        banner.remove();
      }, 500);
    }, 3500);
  }

  // Start the application
  init();
});
