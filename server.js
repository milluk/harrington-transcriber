const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require('@google/generative-ai');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and JSON parsing with a higher limit for base64 images
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname)));

// Ensure folders exist
const TRANSCRIPTS_DIR = path.join(__dirname, 'transcripts');
const SAMPLES_DIR = path.join(__dirname, 'samples');

if (!fs.existsSync(TRANSCRIPTS_DIR)) {
  fs.mkdirSync(TRANSCRIPTS_DIR, { recursive: true });
}
if (!fs.existsSync(SAMPLES_DIR)) {
  fs.mkdirSync(SAMPLES_DIR, { recursive: true });
}

// Endpoint: Check API Key status
app.get('/api/status', (req, res) => {
  const hasKey = !!process.env.GEMINI_API_KEY;
  res.json({
    status: hasKey ? 'connected' : 'simulation_only',
    message: hasKey 
      ? 'Gemini API Key loaded successfully. Live transcription is available.' 
      : 'No Gemini API Key found in .env. Operating in Simulation Mode.'
  });
});

// Helper: Convert base64 string to Google Generative AI part object
function fileToGenerativePart(base64Str, mimeType) {
  // Strip metadata prefix if present (e.g. data:image/png;base64,)
  const base64Data = base64Str.replace(/^data:image\/\w+;base64,/, '');
  return {
    inlineData: {
      data: base64Data,
      mimeType: mimeType || 'image/png'
    },
  };
}

// Endpoint: Handle Multimodal Few-Shot Transcription
app.post('/api/transcribe', async (req, res) => {
  const { targetImage, mimeType, glossary, exemplars } = req.body;

  if (!process.env.GEMINI_API_KEY) {
    return res.status(400).json({
      error: 'API_KEY_MISSING',
      message: 'GEMINI_API_KEY environment variable is not set. Please set it in .env or run in Simulation Mode.'
    });
  }

  if (!targetImage) {
    return res.status(400).json({ error: 'Target image is required for transcription.' });
  }

  try {
    // Initialize Google Gen AI
    // Note: The @google/generative-ai SDK usually looks for process.env.GEMINI_API_KEY by default,
    // but we pass it explicitly to be safe.
    const apiKey = process.env.GEMINI_API_KEY;
    
    // Expressing system prompt to guide the transcriber
    const systemInstruction = `You are a specialist paleographer and linguistic anthropologist specializing in transcribing the historical field notes of John Peabody Harrington.
Harrington's handwriting is cursive, messy, hurried, and highly idiosyncratic. 
He documents Native American languages (particularly Chumash and other Californian languages) using a detailed phonetic orthography.

Your goal is to provide a highly accurate, verbatim transcription of the handwritten text in the target image.

Follow these rules:
1. Preserve Harrington's unique phonetic characters (e.g., glottal stop ˀ, voiceless alveolar lateral fricative ł, voiceless postalveolar fricative š, voiceless postalveolar affricate č, voiceless velar fricative x, schwa ə, high-central vowel ɨ, and combining diacritics like underdots or breathings).
2. Transcribe verbatim. If there are marginal comments, abbreviations, Spanish notes, or English comments, transcribe them exactly.
3. If a word is crossed out, transcribe it wrapped in <del>...</del> if possible, or omit if completely illegible.
4. If a word or character is completely illegible, use "[illegible]" or "[?]".
5. Use the user's provided Linguistic Glossary / Legend to guide your transcription of unique symbols and letter shapes.
6. Look closely at the provided training exemplars (image-transcript pairs) to understand the researcher's preferred transcription style and Harrington's hand.

Format your output inside a clear JSON structure like this:
{
  "transcription": "The full text transcription here...",
  "notes": "Any editorial or linguistic notes about specific difficult passages, words, or character translations."
}`;

    // Assemble the API call contents
    const contents = [];

    // 1. Add training exemplars (Few-shot learning)
    if (exemplars && Array.isArray(exemplars) && exemplars.length > 0) {
      contents.push({ text: "--- BEGIN TRAINING EXEMPLARS ---" });
      exemplars.forEach((ex, idx) => {
        if (ex.image && ex.transcript) {
          contents.push({ text: `[Exemplar ${idx + 1} Scan]` });
          contents.push(fileToGenerativePart(ex.image, ex.mimeType || 'image/png'));
          contents.push({ text: `[Exemplar ${idx + 1} Verified Correct Transcription]:\n${ex.transcript}` });
        }
      });
      contents.push({ text: "--- END TRAINING EXEMPLARS ---" });
    }

    // 2. Add Glossary rules
    if (glossary) {
      contents.push({ text: `--- LINGUISTIC GLOSSARY & CHARACTER LEGEND ---\nUse the following custom rules to transcribe this hand:\n${glossary}\n------------------------------------------` });
    }

    // 3. Add target image to transcribe
    contents.push({ text: "Now, transcribe the following target handwritten image carefully following the rules, glossary, and exemplars." });
    contents.push(fileToGenerativePart(targetImage, mimeType || 'image/png'));
    contents.push({ text: "Provide your output as raw JSON matching the required schema (transcription and notes)." });

    // Request using Gemini 1.5 Pro (highly recommended for complex handwriting and reasoning)
    const { GoogleGenAI } = require('@google/generative-ai');
    const ai = new GoogleGenAI({ apiKey });
    const model = ai.getGenerativeModel({ 
      model: 'gemini-1.5-pro',
      generationConfig: {
        responseMimeType: 'application/json'
      }
    });

    console.log('Sending transcription request to Gemini 1.5 Pro...');
    const result = await model.generateContent({
      contents,
      systemInstruction
    });

    const responseText = result.response.text();
    console.log('Transcription completed successfully.');
    
    // Parse response
    const parsedResponse = JSON.parse(responseText);
    res.json(parsedResponse);

  } catch (error) {
    console.error('Transcription API Error:', error);
    res.status(500).json({
      error: 'TRANSCRIPTION_FAILED',
      message: error.message || 'An error occurred during AI transcription.'
    });
  }
});

// Endpoint: Save Transcriptions
app.post('/api/save', (req, res) => {
  const { filename, metadata, transcription, notes } = req.body;
  if (!filename) {
    return res.status(400).json({ error: 'Filename is required' });
  }

  const safeFilename = filename.replace(/[^a-z0-9_-]/gi, '_').toLowerCase() + '.json';
  const filePath = path.join(TRANSCRIPTS_DIR, safeFilename);

  const dataToSave = {
    savedAt: new Date().toISOString(),
    metadata: metadata || {},
    transcription: transcription || '',
    notes: notes || ''
  };

  try {
    fs.writeFileSync(filePath, JSON.stringify(dataToSave, null, 2), 'utf8');
    res.json({
      success: true,
      message: `Transcription successfully saved to ${safeFilename}`,
      path: filePath
    });
  } catch (error) {
    console.error('Save File Error:', error);
    res.status(500).json({ error: 'Failed to save transcription locally.' });
  }
});

// Endpoint: Export Markdown
app.post('/api/export', (req, res) => {
  const { title, transcription, notes } = req.body;
  
  const markdown = `# Transcription: ${title || 'Unnamed Note'}
*Transcribed on: ${new Date().toLocaleDateString()}*

## Verbatim Text
\`\`\`text
${transcription || ''}
\`\`\`

## Paleographic & Linguistic Notes
${notes || 'No notes provided.'}
`;

  res.setHeader('Content-disposition', `attachment; filename=transcription.md`);
  res.setHeader('Content-type', 'text/markdown');
  res.send(markdown);
});

// Endpoint: List scans in a local directory (Dropbox, etc.)
app.get('/api/scans-list', (req, res) => {
  const dirPath = req.query.dir;
  if (!dirPath) {
    return res.status(400).json({ error: 'Directory path (dir) query parameter is required' });
  }

  // Resolve tilde (~) if present in the path
  let resolvedPath = dirPath;
  if (dirPath.startsWith('~')) {
    resolvedPath = path.join(process.env.HOME || '/Users/troy', dirPath.slice(1));
  }

  try {
    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({ error: `Directory not found: ${resolvedPath}` });
    }

    const stats = fs.statSync(resolvedPath);
    if (!stats.isDirectory()) {
      return res.status(400).json({ error: 'Path provided is a file, not a directory.' });
    }

    const imageFiles = [];
    const supportedExtensions = ['.png', '.jpg', '.jpeg', '.tiff', '.tif', '.webp', '.pdf'];

    function scanDirRecursive(currentPath, depth = 0) {
      if (depth > 2) return; // Prevent infinite loops or scanning too deep
      
      const files = fs.readdirSync(currentPath);
      files.forEach(file => {
        if (file.startsWith('.')) return; // Skip hidden system files
        
        const fullPath = path.join(currentPath, file);
        const stats = fs.statSync(fullPath);
        
        if (stats.isDirectory()) {
          scanDirRecursive(fullPath, depth + 1);
        } else if (stats.isFile()) {
          const ext = path.extname(file).toLowerCase();
          if (supportedExtensions.includes(ext)) {
            // Get relative path for easier reading in select list dropdown
            const relativeName = path.relative(resolvedPath, fullPath);
            imageFiles.push({
              name: relativeName,
              path: fullPath
            });
          }
        }
      });
    }

    scanDirRecursive(resolvedPath);

    // Sort files alphabetically so they display logically
    imageFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

    res.json({
      directory: resolvedPath,
      files: imageFiles
    });

  } catch (error) {
    console.error('Scans List Error:', error);
    res.status(500).json({ error: `Failed to scan directory: ${error.message}` });
  }
});

// Endpoint: Stream a local image file securely (local scan proxy)
app.get('/api/scan-file', (req, res) => {
  const filePath = req.query.path;
  if (!filePath) {
    return res.status(400).send('Path query parameter is required');
  }

  // Resolve tilde
  let resolvedPath = filePath;
  if (filePath.startsWith('~')) {
    resolvedPath = path.join(process.env.HOME || '/Users/troy', filePath.slice(1));
  }

  try {
    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).send('File not found');
    }

    const stats = fs.statSync(resolvedPath);
    if (!stats.isFile()) {
      return res.status(400).send('Path provided is not a file.');
    }

    const ext = path.extname(resolvedPath).toLowerCase();
    const mimeTypes = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.tiff': 'image/tiff',
      '.tif': 'image/tiff'
    };

    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    fs.createReadStream(resolvedPath).pipe(res);

  } catch (error) {
    console.error('Scan File Stream Error:', error);
    res.status(500).send(`Server error: ${error.message}`);
  }
});

app.listen(PORT, () => {
  console.log(`=============================================================`);
  console.log(` Harrington Transcriber server running at http://localhost:${PORT}`);
  console.log(` Operating mode: Checking environment variables...`);
  console.log(` API Key Present: ${!!process.env.GEMINI_API_KEY ? 'YES' : 'NO (Simulation Mode Enabled)'}`);
  console.log(`=============================================================`);
});
