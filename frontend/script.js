// Configuration
const API_BASE_URL = 'http://localhost:8000';  // Change to your backend URL
const API_PREFIX = `${API_BASE_URL}/api`;

// Rubrics Data
const levels = [
    { id: "1", label: "Beginner" },
    { id: "2", label: "Developing" },
    { id: "3", label: "Competent" },
    { id: "4", label: "Proficient" },
    { id: "5", label: "Advanced" }
];

const categories = [
    { key: "comprehensibility", name: "Comprehensibility", descriptions: ["Can be understood with effort", "Generally understandable", "Clear & easy to follow", "Very clear, natural", "Effortless clarity; polished"], validLevels: [0,1,2,3,4] },
    { key: "pronunciation", name: "Pronunciation & Intonation", descriptions: ["Basic sounds mostly clear", "Mostly clear; predictable errors", "Clear with appropriate stress", "Natural, controlled intonation", "Expressive, impactful intonation"], validLevels: [0,1,2,3,4] },
    { key: "grammar", name: "Grammar Control", descriptions: ["Simple sentences; frequent errors", "Basic accuracy; attempts variety", "Mostly accurate; some complexity", "Accurate, varied structures", "Sophisticated, precise grammar"], validLevels: [0,1,2,3,4] },
    { key: "vocabulary", name: "Vocabulary & Word Choice", descriptions: ["Very limited; repetitive", "Adequate for common topics", "Good range; mostly appropriate", "Precise, varied vocabulary", "Nuanced, strategic word choice"], validLevels: [0,1,2,3,4] },
    { key: "fluency", name: "Fluency", descriptions: ["Frequent pauses; fragmented", "Hesitant but improving", "Mostly smooth with some pauses", "Smooth, confident", "Effortless, controlled pacing"], validLevels: [0,1,2,3,4] },
    { key: "organization", name: "Organization of Ideas", descriptions: [null, "Basic sequencing", "Clear structure", "Well organized with transitions", "Strategic, persuasive flow"], validLevels: [1,2,3,4] },
    { key: "audience", name: "Audience Awareness", descriptions: [null, null, "Adjusts tone occasionally", "Adapts tone/examples to audience", "Highly adaptive; anticipates reactions"], validLevels: [2,3,4] },
    { key: "interaction", name: "Interaction & Spontaneous Response", descriptions: [null, "Responds to simple questions", "Handles basic Q&A", "Strong, confident interaction", "Agile, persuasive, diplomatic improvisation"], validLevels: [1,2,3,4] }
];

// State
let mediaRecorder;
let audioChunks = [];
let isRecording = false;
let recordingStartTime;
let timerInterval;
let audioBlob;
let transcribedText = '';
let evaluationHistory = [];
let selectedLevel = null;
const selectedCells = new Map();
let uploadedFile = null;
let audioSource = 'none';

// DOM elements
const micButton = document.getElementById('micButton');
const status = document.getElementById('status');
const timer = document.getElementById('timer');
const audioPlayer = document.getElementById('audioPlayer');
const evaluateBtn = document.getElementById('evaluateBtn');
const questionInput = document.getElementById('questionInput');
const resultsContainer = document.getElementById('resultsContainer');
const apiStatus = document.getElementById('apiStatus');
const transcriptionBox = document.getElementById('transcriptionBox');
const transcriptionText = document.getElementById('transcriptionText');
const summaryBody = document.getElementById('summaryBody');
const levelButtons = document.getElementById('levelButtons');
const categoriesList = document.getElementById('categoriesList');
const rubricTabBtn = document.getElementById('rubricTabBtn');
const manualTabBtn = document.getElementById('manualTabBtn');
const rubricTab = document.getElementById('rubricTab');
const manualTab = document.getElementById('manualTab');
const manualRubricsInput = document.getElementById('manualRubricsInput');

const audioFileInput = document.getElementById('audioFileInput');
const uploadBtn = document.getElementById('uploadBtn');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const removeFileBtn = document.getElementById('removeFileBtn');

// Helper: safely parse JSON responses
async function safeJson(response) {
    const text = await response.text();
    if (!response.ok) {
        const detail = text ? text : `${response.status} ${response.statusText}`;
        throw new Error(detail);
    }
    if (!text) return {};
    try {
        return JSON.parse(text);
    } catch (err) {
        throw new Error('Invalid JSON from server: ' + text);
    }
}

// Tab switching
rubricTabBtn.addEventListener('click', () => {
    rubricTabBtn.classList.add('active');
    manualTabBtn.classList.remove('active');
    rubricTab.classList.add('active');
    manualTab.classList.remove('active');
});

manualTabBtn.addEventListener('click', () => {
    manualTabBtn.classList.add('active');
    rubricTabBtn.classList.remove('active');
    manualTab.classList.add('active');
    rubricTab.classList.remove('active');
});

// Check API connection
async function checkApiConnection() {
    try {
        const response = await fetch(`${API_PREFIX}/health`);
        const data = await safeJson(response);
        
        if (data.status === 'healthy' && data.api_configured) {
            apiStatus.className = 'api-badge connected';
            apiStatus.innerHTML = '<span class="status-dot"></span><span>Connected</span>';
        } else {
            apiStatus.className = 'api-badge disconnected';
            apiStatus.innerHTML = '<span class="status-dot"></span><span>Not Configured</span>';
        }
    } catch (error) {
        console.error('API connection check failed:', error);
        apiStatus.className = 'api-badge disconnected';
        apiStatus.innerHTML = '<span class="status-dot"></span><span>Disconnected</span>';
    }
}

// Render level buttons
function renderLevelButtons() {
    let html = '';
    levels.forEach((level, idx) => {
        html += `<button class="level-btn" data-level-id="${level.id}" data-level-idx="${idx}">${level.label}</button>`;
    });
    levelButtons.innerHTML = html;

    document.querySelectorAll('.level-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.level-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            selectedLevel = parseInt(e.target.dataset.levelIdx);
            selectedCells.clear();
            renderCategories();
            updateSummary();
            
            // Show scoring info
            const levelLabel = levels[selectedLevel].label;
            const multiplier = getMultiplierForLevel(levelLabel);
            const adjustment = ((multiplier - 1) * 100).toFixed(0);
            const adjustmentText = adjustment > 0 ? `+${adjustment}% generous` : 
                                 adjustment < 0 ? `${adjustment}% strict` : 'no adjustment';
            
            status.textContent = `Selected ${levelLabel} level - ${adjustmentText}`;
        });
    });
}

// Get multiplier for level
function getMultiplierForLevel(levelLabel) {
    const multipliers = {
        "Beginner": 1.40,
        "Developing": 1.25,
        "Competent": 1.15,
        "Proficient": 1.00,
        "Advanced": 0.85
    };
    return multipliers[levelLabel] || 1.0;
}

// Render categories
function renderCategories() {
    if (selectedLevel === null) {
        categoriesList.innerHTML = '<p style="color: var(--color-gray-300); font-style: italic;">Select a level first</p>';
        return;
    }

    let html = '';
    categories.forEach(cat => {
        if (cat.validLevels.includes(selectedLevel)) {
            const cellKey = `${cat.key}-${selectedLevel}`;
            const isChecked = selectedCells.has(cellKey);

            html += `
                <div class="category-item">
                    <input type="checkbox" 
                           id="cb-${cellKey}" 
                           data-key="${cellKey}"
                           data-cat="${cat.name}"
                           data-level-idx="${selectedLevel}"
                           data-desc="${cat.descriptions[selectedLevel]}"
                           ${isChecked ? 'checked' : ''}>
                    <label for="cb-${cellKey}">${cat.name}</label>
                </div>
            `;
        }
    });

    categoriesList.innerHTML = html;

    document.querySelectorAll('.category-item input').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const key = e.target.dataset.key;
            const cat = e.target.dataset.cat;
            const levelIdx = parseInt(e.target.dataset.levelIdx);
            const desc = e.target.dataset.desc;

            if (e.target.checked) {
                selectedCells.set(key, { cat, levelIdx, desc });
            } else {
                selectedCells.delete(key);
            }
            updateSummary();
        });
    });
}

// Update summary box
function updateSummary() {
    if (selectedCells.size === 0) {
        summaryBody.innerHTML = '<span class="summary-empty">Select categories to see summary...</span>';
        return;
    }

    let html = '';
    selectedCells.forEach(({ cat, levelIdx, desc }) => {
        const levelLabel = levels[levelIdx].label;
        const multiplier = getMultiplierForLevel(levelLabel);
        const adjustment = ((multiplier - 1) * 100).toFixed(0);
        const adjustmentText = adjustment > 0 ? `(+${adjustment}%)` : 
                             adjustment < 0 ? `(${adjustment}%)` : '';
        
        html += `
            <div class="summary-item">
                <div class="summary-item-cat">${cat}</div>
                <div class="summary-item-level">Level: ${levelLabel} ${adjustmentText}</div>
                <div class="summary-item-desc">${desc}</div>
            </div>
        `;
    });

    summaryBody.innerHTML = html;
}

// Initialize
window.addEventListener('load', () => {
    checkApiConnection();
    renderLevelButtons();
    
    if (navigator.permissions) {
        navigator.permissions.query({ name: 'microphone' }).then(result => {
            if (result.state === 'denied') {
                status.textContent = 'Microphone access denied. Please enable it in browser settings.';
                micButton.disabled = true;
            }
        });
    }
});

// Microphone button handler
micButton.addEventListener('click', async () => {
    if (!isRecording) {
        await startRecording();
    } else {
        stopRecording();
    }
});

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
            audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            const audioUrl = URL.createObjectURL(audioBlob);
            audioPlayer.src = audioUrl;
            audioPlayer.style.display = 'block';
            
            stream.getTracks().forEach(track => track.stop());
            await transcribeAudio();
        };

        mediaRecorder.start();
        isRecording = true;
        micButton.classList.add('recording');
        micButton.textContent = '⏹️';
        status.textContent = 'Recording in progress...';
        transcriptionBox.style.display = 'none';
        
        recordingStartTime = Date.now();
        updateTimer();
        timerInterval = setInterval(updateTimer, 1000);

    } catch (error) {
        console.error('Error accessing microphone:', error);
        status.textContent = 'Error: Could not access microphone';
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        isRecording = false;
        micButton.classList.remove('recording');
        micButton.textContent = '🎤';
        clearInterval(timerInterval);
    }
}

function updateTimer() {
    const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
    const seconds = (elapsed % 60).toString().padStart(2, '0');
    timer.textContent = `${minutes}:${seconds}`;
}

// File Upload Handling
audioFileInput?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
        alert('File size too large. Maximum 25MB allowed.');
        return;
    }

    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/webm', 'audio/ogg', 'audio/x-m4a'];
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|m4a|webm|ogg)$/i)) {
        alert('Invalid file type. Please upload an audio file (MP3, WAV, M4A, WebM, OGG).');
        return;
    }

    uploadedFile = file;
    audioSource = 'upload';

    fileName.textContent = file.name;
    fileInfo.style.display = 'flex';
    uploadBtn.style.display = 'none';

    const fileUrl = URL.createObjectURL(file);
    audioPlayer.src = fileUrl;
    audioPlayer.style.display = 'block';

    audioBlob = null;
    timer.textContent = '00:00';

    await transcribeUploadedFile(file);
});

removeFileBtn?.addEventListener('click', () => {
    uploadedFile = null;
    audioSource = 'none';
    audioFileInput.value = '';
    fileInfo.style.display = 'none';
    uploadBtn.style.display = 'flex';
    audioPlayer.style.display = 'none';
    transcriptionBox.style.display = 'none';
    evaluateBtn.disabled = true;
    status.textContent = 'Click microphone to start recording or upload a file';
});

async function transcribeUploadedFile(file) {
    status.innerHTML = '<span class="loading"></span>Transcribing uploaded audio...';
    evaluateBtn.disabled = true;
    micButton.disabled = true;

    try {
        const formData = new FormData();
        formData.append('audio', file);

        const response = await fetch(`${API_PREFIX}/transcribe`, {
            method: 'POST',
            body: formData
        });

        const data = await safeJson(response);
        transcribedText = data.text || '';

        transcriptionBox.style.display = 'block';
        transcriptionText.textContent = transcribedText;

        evaluateBtn.disabled = false;
        status.textContent = '✅ Transcription complete - Ready to evaluate';

    } catch (error) {
        console.error('Transcription error:', error);
        status.textContent = `❌ Transcription failed: ${error.message}`;
    }

    micButton.disabled = false;
}

async function transcribeAudio() {
    status.innerHTML = '<span class="loading"></span>Transcribing audio...';
    evaluateBtn.disabled = true;
    micButton.disabled = true;

    try {
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');

        const response = await fetch(`${API_PREFIX}/transcribe`, {
            method: 'POST',
            body: formData
        });

        const data = await safeJson(response);
        transcribedText = data.text || '';

        transcriptionBox.style.display = 'block';
        transcriptionText.textContent = transcribedText;

        evaluateBtn.disabled = false;
        status.textContent = '✅ Transcription complete - Ready to evaluate';

    } catch (error) {
        console.error('Transcription error:', error);
        status.textContent = `❌ Transcription failed: ${error.message}`;
    }

    micButton.disabled = false;
}

// Extract level from manual input
function extractLevelFromManualInput(rubricsText) {
    const levelKeywords = {
        'beginner': 'Beginner',
        'developing': 'Developing', 
        'competent': 'Competent',
        'proficient': 'Proficient',
        'advanced': 'Advanced'
    };
    
    const lowerText = rubricsText.toLowerCase();
    for (const [keyword, level] of Object.entries(levelKeywords)) {
        if (lowerText.includes(keyword)) {
            return level;
        }
    }
    return '';
}

// Evaluate button handler
evaluateBtn.addEventListener('click', () => {
    const question = questionInput.value.trim();

    if (!question) {
        alert('Please enter a question');
        return;
    }

    let rubricsText = '';
    let selectedLevelLabel = '';

    if (rubricTabBtn.classList.contains('active')) {
        if (selectedCells.size === 0) {
            alert('Please select evaluation rubrics');
            return;
        }

        if (selectedLevel !== null) {
            selectedLevelLabel = levels[selectedLevel].label;
        }

        selectedCells.forEach(({ cat, levelIdx, desc }) => {
            const levelLabel = levels[levelIdx].label;
            rubricsText += `${cat} (${levelLabel} Level)\n${desc}\n\n`;
        });

        if (selectedLevelLabel) {
            rubricsText = `EVALUATION LEVEL: ${selectedLevelLabel}\n\n` + rubricsText;
        }
    } else {
        rubricsText = manualRubricsInput.value.trim();
        if (!rubricsText) {
            alert('Please enter evaluation rubrics');
            return;
        }
        selectedLevelLabel = extractLevelFromManualInput(rubricsText);
    }

    if (!transcribedText) {
        alert('Please record audio or upload a file first');
        return;
    }

    performEvaluation(question, rubricsText, transcribedText, selectedLevelLabel);
});

async function performEvaluation(question, rubricsText, response, levelLabel = '') {
    status.innerHTML = '<span class="loading"></span>Evaluating with AI...';
    evaluateBtn.disabled = true;
    micButton.disabled = true;

    try {
        const formData = new FormData();
        formData.append('question', question);
        formData.append('rubrics', rubricsText);
        formData.append('response', response);
        
        if (levelLabel) {
            formData.append('level', levelLabel);
        }

        const result = await fetch(`${API_PREFIX}/evaluate`, {
            method: 'POST',
            body: formData
        });

        const evaluation = await safeJson(result);

        // Store with additional metadata
        evaluation.timestamp = new Date().toLocaleString();
        evaluation.question = question;
        evaluation.response = response.length > 100 ? response.substring(0, 100) + '...' : response;
        evaluation.fullResponse = response;
        evaluation.overallScore = evaluation.overall_score || evaluation.overallScore || 0;
        evaluation.baseScore = evaluation.base_score || evaluation.baseScore || 70;
        evaluation.level = levelLabel || evaluation.evaluated_level || 'Not specified';
        evaluation.multiplier = evaluation.multiplier_applied || evaluation.scaling_applied || 1.0;
        
        // Add cache info if available
        if (evaluation.cache_used !== undefined) {
            evaluation.cacheInfo = evaluation.cache_used ? "Used cached base score" : "Calculated new base score";
        }

        evaluationHistory.unshift(evaluation);
        displayResults();

        scrollToResults();

        const adjustment = ((evaluation.multiplier - 1) * 100).toFixed(0);
        const adjustmentText = adjustment > 0 ? `+${adjustment}% generous` : 
                             adjustment < 0 ? `${adjustment}% strict` : 'no adjustment';
        
        status.textContent = `✅ Evaluation complete: ${evaluation.overallScore}/100 for ${evaluation.level} (${adjustmentText})`;

    } catch (error) {
        console.error('Evaluation error:', error);
        status.textContent = `❌ Evaluation failed: ${error.message}`;
    }

    evaluateBtn.disabled = false;
    micButton.disabled = false;
}

// Auto-scroll to results
function scrollToResults() {
    setTimeout(() => {
        resultsContainer.scrollIntoView({ 
            behavior: 'smooth',
            block: 'start'
        });
    }, 100);
}

function getScoreClass(score) {
    if (score >= 90) return 'excellent';
    if (score >= 80) return 'good';
    if (score >= 70) return 'fair';
    if (score >= 60) return 'fair';
    return 'poor';
}

function displayResults() {
    if (evaluationHistory.length === 0) {
        resultsContainer.innerHTML = '<div class="empty-state">No evaluations yet.</div>';
        return;
    }

    let html = '';
    evaluationHistory.forEach((evalItem, index) => {
        const levelInfo = evalItem.level || evalItem.evaluated_level || 'Not specified';
        const baseScore = evalItem.baseScore || 70;
        const finalScore = evalItem.overallScore;
        const multiplier = evalItem.multiplier || 1.0;
        
        const adjustment = ((multiplier - 1) * 100).toFixed(0);
        let adjustmentHtml = '';
        if (adjustment > 0) {
            adjustmentHtml = `<span style="color: #10b981; font-weight: 600;">(+${adjustment}% generous)</span>`;
        } else if (adjustment < 0) {
            adjustmentHtml = `<span style="color: #ef4444; font-weight: 600;">(${adjustment}% strict)</span>`;
        }
        
        const cacheInfo = evalItem.cacheInfo ? `<div style="font-size: 12px; color: #6b7280; margin-top: 4px;">${evalItem.cacheInfo}</div>` : '';
        
        html += `
            <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--color-border);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <strong>Evaluation #${evaluationHistory.length - index}</strong>
                    <span style="color: var(--color-gray-300); font-size: 13px;">${evalItem.timestamp}</span>
                </div>
                <div style="margin-bottom: 8px;">
                    <strong>Question:</strong> ${evalItem.question}
                </div>
                <div style="margin-bottom: 8px;">
                    <strong>Proficiency Level:</strong> 
                    <span style="color: var(--color-primary); font-weight: 600;">${levelInfo}</span>
                    ${adjustmentHtml}
                    ${cacheInfo}
                </div>
                <div style="margin-bottom: 8px;">
                    <strong>Response:</strong> <span style="color: var(--color-gray-300);">${evalItem.response}</span>
                </div>
                <div style="margin-bottom: 8px; background: rgba(var(--color-teal-500-rgb), 0.05); padding: 12px; border-radius: 8px;">
                    <strong>Scoring (CONSISTENT base score):</strong> 
                    <div style="display: flex; gap: 20px; margin-top: 8px;">
                        <div>
                            <span style="font-size: 12px; color: var(--color-gray-300);">Base Score (Native Speaker):</span><br>
                            <span style="font-size: 18px; font-weight: 700;">${baseScore}/100</span>
                        </div>
                        <div style="color: var(--color-gray-300);">× ${multiplier.toFixed(2)} →</div>
                        <div>
                            <span style="font-size: 12px; color: var(--color-gray-300);">Adjusted for ${levelInfo}:</span><br>
                            <span class="score ${getScoreClass(finalScore)}" style="font-size: 18px;">${finalScore}/100</span>
                        </div>
                    </div>
                </div>
                ${evalItem.summary ? `<div style="margin-bottom: 12px;"><strong>Summary:</strong> ${evalItem.summary}</div>` : ''}
                <table class="results-table">
                    <thead>
                        <tr>
                            <th>Criterion</th>
                            <th>Score</th>
                            <th>Feedback</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        (evalItem.rubrics || []).forEach(rubric => {
            html += `
                <tr>
                    <td>${rubric.criterion}</td>
                    <td><span class="score ${getScoreClass(rubric.score)}">${rubric.score}/100</span></td>
                    <td>${rubric.feedback || ''}</td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;
    });

    resultsContainer.innerHTML = html;
}