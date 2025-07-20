class AIBicepCurlCounter {
    constructor() {
        // Initialize DOM elements
        this.initializeElements();
        
        // App state
        this.isModelLoaded = false;
        this.isWorkoutActive = false;
        this.isCameraOn = true;
        this.stream = null;
        this.detector = null;
        
        // Model configurations from provided data
        this.modelConfigs = {
            'movenet-lightning': {
                name: 'MoveNet Lightning',
                type: poseDetection.SupportedModels.MoveNet,
                config: { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING },
                performance: 'Fast',
                keypoints: 17
            },
            'movenet-thunder': {
                name: 'MoveNet Thunder',
                type: poseDetection.SupportedModels.MoveNet,
                config: { modelType: poseDetection.movenet.modelType.SINGLEPOSE_THUNDER },
                performance: 'Accurate',
                keypoints: 17
            },
            'blazepose': {
                name: 'BlazePose',
                type: poseDetection.SupportedModels.BlazePose,
                config: { runtime: 'tfjs', modelType: 'full' },
                performance: 'Advanced',
                keypoints: 33
            }
        };
        
        // Current model
        this.currentModelKey = 'auto';
        this.deviceType = 'detecting';
        
        // Pose keypoints (MoveNet indices)
        this.keypoints = {
            LEFT_SHOULDER: 5,
            LEFT_ELBOW: 7,
            LEFT_WRIST: 9,
            RIGHT_SHOULDER: 6,
            RIGHT_ELBOW: 8,
            RIGHT_WRIST: 10
        };
        
        // Detection thresholds from provided data
        this.thresholds = {
            DOWN_ANGLE: 150,
            UP_ANGLE: 60,
            MIN_CONFIDENCE: 0.3,
            MIN_ANGLE_CHANGE: 20
        };
        
        // Tracking state
        this.leftArm = {
            state: 'ready',
            count: 0,
            lastAngle: 0,
            angleHistory: [],
            confidence: 0
        };
        
        this.rightArm = {
            state: 'ready', 
            count: 0,
            lastAngle: 0,
            angleHistory: [],
            confidence: 0
        };
        
        // Performance tracking
        this.fps = 0;
        this.frameCount = 0;
        this.lastTime = performance.now();
        this.fpsHistory = [];
        
        // Session tracking
        this.sessionStartTime = null;
        this.sessionDuration = 0;
        this.totalReps = 0;
        
        // Settings
        this.settings = {
            volume: 0.5,
            smoothing: 5,
            selectedModel: 'auto'
        };
        
        // Audio context for beeps
        this.audioContext = null;
        this.initializeAudio();
        
        this.initialize();
    }
    
    initializeElements() {
        // Video elements
        this.video = document.getElementById('video');
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Status elements
        this.statusEl = document.getElementById('status');
        this.fpsEl = document.getElementById('fps');
        this.currentModelEl = document.getElementById('currentModel');
        this.deviceTypeEl = document.getElementById('deviceType');
        
        // Loading elements
        this.loadingEl = document.getElementById('loading');
        this.loadingTextEl = document.getElementById('loadingText');
        this.progressFillEl = document.getElementById('progressFill');
        this.progressTextEl = document.getElementById('progressText');
        
        // Counter elements
        this.leftCountEl = document.getElementById('leftCount');
        this.rightCountEl = document.getElementById('rightCount');
        this.leftAngleEl = document.getElementById('leftAngle');
        this.rightAngleEl = document.getElementById('rightAngle');
        this.leftStateEl = document.getElementById('leftState');
        this.rightStateEl = document.getElementById('rightState');
        
        // Session elements
        this.totalRepsEl = document.getElementById('totalReps');
        this.sessionTimeEl = document.getElementById('sessionTime');
        this.avgFpsEl = document.getElementById('avgFps');
        
        // Control elements
        this.startWorkoutBtn = document.getElementById('startWorkout');
        this.stopWorkoutBtn = document.getElementById('stopWorkout');
        this.resetCountersBtn = document.getElementById('resetCounters');
        this.toggleCameraBtn = document.getElementById('toggleCamera');
        
        // Settings elements
        this.modelSelectEl = document.getElementById('modelSelect');
        this.volumeSliderEl = document.getElementById('volumeSlider');
        this.volumeValueEl = document.getElementById('volumeValue');
        this.smoothingSliderEl = document.getElementById('smoothingSlider');
        this.smoothingValueEl = document.getElementById('smoothingValue');
        
        // Indicators
        this.leftIndicator = document.querySelector('.left-indicator');
        this.rightIndicator = document.querySelector('.right-indicator');
    }
    
    async initialize() {
        try {
            this.setupEventListeners();
            await this.setupTensorFlow();
            await this.detectDeviceCapabilities();
            await this.setupCamera();
            await this.loadOptimalModel();
            this.updateStatus('Ready to start workout', 'success');
            this.currentModelEl.textContent = this.modelConfigs[this.currentModelKey].name;
        } catch (error) {
            console.error('Initialization error:', error);
            this.showError('Initialization Failed', error.message);
        }
    }
    
    setupEventListeners() {
        // Workout controls
        this.startWorkoutBtn.addEventListener('click', () => this.startWorkout());
        this.stopWorkoutBtn.addEventListener('click', () => this.stopWorkout());
        this.resetCountersBtn.addEventListener('click', () => this.resetCounters());
        this.toggleCameraBtn.addEventListener('click', () => this.toggleCamera());
        
        // Settings
        this.modelSelectEl.addEventListener('change', (e) => this.changeModel(e.target.value));
        this.volumeSliderEl.addEventListener('input', (e) => this.updateVolume(e.target.value));
        this.smoothingSliderEl.addEventListener('input', (e) => this.updateSmoothing(e.target.value));
        
        // Video events
        this.video.addEventListener('loadedmetadata', () => this.resizeCanvas());
        this.video.addEventListener('loadeddata', () => this.resizeCanvas());
        
        // Window events
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                if (this.isWorkoutActive) {
                    this.stopWorkout();
                } else {
                    this.startWorkout();
                }
            }
        });
    }
    
    async setupTensorFlow() {
        try {
            this.updateStatus('Setting up TensorFlow...', 'info');
            this.updateLoadingText('Initializing TensorFlow.js...');
            this.updateProgress(10);
            
            // Try WebGL first, fallback to CPU
            try {
                await tf.setBackend('webgl');
                await tf.ready();
                console.log('TensorFlow.js backend: WebGL');
            } catch (error) {
                console.warn('WebGL failed, using CPU backend:', error);
                await tf.setBackend('cpu');
                await tf.ready();
                console.log('TensorFlow.js backend: CPU');
            }
            
            this.updateProgress(25);
            console.log('TensorFlow.js initialized successfully');
            
        } catch (error) {
            console.error('TensorFlow setup error:', error);
            throw new Error('Failed to initialize TensorFlow.js: ' + error.message);
        }
    }
    
    async detectDeviceCapabilities() {
        try {
            this.updateLoadingText('Detecting device capabilities...');
            this.updateProgress(35);
            
            // Detect WebGL support
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            const hasWebGL = !!gl;
            
            // Estimate device performance based on various factors
            const performance = {
                cores: navigator.hardwareConcurrency || 2,
                memory: navigator.deviceMemory || 2,
                webgl: hasWebGL,
                mobile: /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
            };
            
            // Determine device type
            if (performance.mobile) {
                this.deviceType = 'Mobile';
                this.recommendedModel = 'movenet-lightning';
            } else if (performance.cores >= 8 && performance.memory >= 8 && hasWebGL) {
                this.deviceType = 'High-end';
                this.recommendedModel = 'blazepose';
            } else if (performance.cores >= 4 && hasWebGL) {
                this.deviceType = 'Mid-range';
                this.recommendedModel = 'movenet-thunder';
            } else {
                this.deviceType = 'Low-end';
                this.recommendedModel = 'movenet-lightning';
            }
            
            this.deviceTypeEl.textContent = this.deviceType;
            console.log('Device capabilities detected:', performance);
            console.log('Recommended model:', this.recommendedModel);
            
        } catch (error) {
            console.error('Device detection error:', error);
            this.deviceType = 'Unknown';
            this.recommendedModel = 'movenet-lightning';
            this.deviceTypeEl.textContent = this.deviceType;
        }
    }
    
    async setupCamera() {
        try {
            this.updateStatus('Requesting camera access...', 'info');
            this.updateLoadingText('Requesting camera access...');
            this.updateProgress(45);
            
            if (!navigator.mediaDevices?.getUserMedia) {
                throw new Error('Camera access not supported in this browser');
            }
            
            const constraints = {
                video: {
                    width: { ideal: 640, min: 320, max: 1280 },
                    height: { ideal: 480, min: 240, max: 720 },
                    frameRate: { ideal: 30, min: 15, max: 60 },
                    facingMode: 'user'
                },
                audio: false
            };
            
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = this.stream;
            this.video.muted = true;
            this.video.autoplay = true;
            this.video.playsInline = true;
            
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Video loading timeout')), 10000);
                
                const handleLoaded = () => {
                    clearTimeout(timeout);
                    this.video.removeEventListener('loadeddata', handleLoaded);
                    resolve();
                };
                
                this.video.addEventListener('loadeddata', handleLoaded);
                this.video.play().catch(console.warn);
            });
            
            this.updateProgress(55);
            this.resizeCanvas();
            console.log('Camera setup complete');
            
        } catch (error) {
            console.error('Camera setup error:', error);
            const errorMessage = this.getCameraErrorMessage(error);
            this.showError('Camera Access Failed', errorMessage);
            throw error;
        }
    }
    
    getCameraErrorMessage(error) {
        switch (error.name) {
            case 'NotAllowedError':
                return 'Please allow camera access and refresh the page.';
            case 'NotFoundError':
                return 'No camera detected. Please connect a camera and try again.';
            case 'NotSupportedError':
                return 'Camera access is not supported in this browser.';
            case 'NotReadableError':
                return 'Camera is being used by another application.';
            default:
                return 'Failed to access camera. Please check your camera settings.';
        }
    }
    
    async loadOptimalModel() {
        try {
            const modelKey = this.settings.selectedModel === 'auto' ? this.recommendedModel : this.settings.selectedModel;
            await this.loadModel(modelKey);
        } catch (error) {
            console.error('Failed to load optimal model, falling back to lightning:', error);
            await this.loadModel('movenet-lightning');
        }
    }
    
    async loadModel(modelKey) {
        try {
            const config = this.modelConfigs[modelKey];
            if (!config) {
                throw new Error(`Unknown model: ${modelKey}`);
            }
            
            this.updateStatus(`Loading ${config.name}...`, 'info');
            this.updateLoadingText(`Loading ${config.name} model...`);
            this.updateProgress(65);
            
            console.log(`Loading model: ${config.name}`);
            
            this.detector = await poseDetection.createDetector(config.type, config.config);
            this.currentModelKey = modelKey;
            this.isModelLoaded = true;
            
            // Update UI to show loaded model
            this.currentModelEl.textContent = config.name;
            this.updateProgress(100);
            
            // Hide loading overlay
            setTimeout(() => {
                this.loadingEl.classList.add('hidden');
            }, 500);
            
            console.log(`Model loaded successfully: ${config.name}`);
            
        } catch (error) {
            console.error('Model loading error:', error);
            throw new Error(`Failed to load ${this.modelConfigs[modelKey]?.name || modelKey}: ${error.message}`);
        }
    }
    
    async changeModel(modelKey) {
        if (modelKey === this.currentModelKey || (!this.isModelLoaded && modelKey === 'auto')) return;
        
        try {
            this.settings.selectedModel = modelKey;
            this.isModelLoaded = false;
            
            if (this.isWorkoutActive) {
                this.stopWorkout();
            }
            
            this.loadingEl.classList.remove('hidden');
            this.updateStatus('Changing model...', 'info');
            
            const targetModel = modelKey === 'auto' ? this.recommendedModel : modelKey;
            await this.loadModel(targetModel);
            
            this.updateStatus('Model changed successfully - Ready to start workout', 'success');
            
        } catch (error) {
            console.error('Model change error:', error);
            this.showError('Model Change Failed', error.message);
            this.loadingEl.classList.add('hidden');
        }
    }
    
    initializeAudio() {
        try {
            // Initialize on first user interaction to comply with browser policies
            const initAudio = () => {
                if (!this.audioContext) {
                    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    document.removeEventListener('click', initAudio);
                    document.removeEventListener('touchstart', initAudio);
                    console.log('Audio context initialized');
                }
            };
            
            document.addEventListener('click', initAudio);
            document.addEventListener('touchstart', initAudio);
        } catch (error) {
            console.warn('Web Audio API not supported:', error);
        }
    }
    
    startWorkout() {
        if (!this.isModelLoaded) {
            this.showError('Model Not Ready', 'Please wait for the model to load completely.');
            return;
        }
        
        this.isWorkoutActive = true;
        this.sessionStartTime = Date.now();
        
        this.startWorkoutBtn.disabled = true;
        this.stopWorkoutBtn.disabled = false;
        
        this.updateStatus('Workout active - detecting poses', 'success');
        this.startDetectionLoop();
        
        console.log('Workout started');
    }
    
    stopWorkout() {
        this.isWorkoutActive = false;
        this.sessionStartTime = null;
        
        this.startWorkoutBtn.disabled = false;
        this.stopWorkoutBtn.disabled = true;
        
        this.updateStatus('Workout stopped - Ready to start workout', 'info');
        this.clearCanvas();
        
        console.log('Workout stopped');
    }
    
    startDetectionLoop() {
        if (!this.isWorkoutActive) return;
        
        this.detectPoses()
            .then(() => {
                this.updateFPS();
                this.updateSessionStats();
                requestAnimationFrame(() => this.startDetectionLoop());
            })
            .catch(error => {
                console.error('Detection error:', error);
                requestAnimationFrame(() => this.startDetectionLoop());
            });
    }
    
    async detectPoses() {
        if (!this.isCameraOn || this.video.readyState < 2) return;
        
        try {
            this.clearCanvas();
            
            const poses = await this.detector.estimatePoses(this.video);
            
            if (poses && poses.length > 0) {
                const pose = poses[0];
                this.processPose(pose);
                this.drawPose(pose);
            }
            
        } catch (error) {
            console.warn('Pose detection error:', error);
        }
    }
    
    processPose(pose) {
        const keypoints = pose.keypoints;
        
        // Process left arm
        this.processArm('left', {
            shoulder: keypoints[this.keypoints.LEFT_SHOULDER],
            elbow: keypoints[this.keypoints.LEFT_ELBOW],
            wrist: keypoints[this.keypoints.LEFT_WRIST]
        });
        
        // Process right arm
        this.processArm('right', {
            shoulder: keypoints[this.keypoints.RIGHT_SHOULDER],
            elbow: keypoints[this.keypoints.RIGHT_ELBOW],
            wrist: keypoints[this.keypoints.RIGHT_WRIST]
        });
    }
    
    processArm(side, joints) {
        const arm = side === 'left' ? this.leftArm : this.rightArm;
        
        if (!this.areJointsValid(joints)) {
            this.updateArmUI(side, arm, null);
            return;
        }
        
        const angle = this.calculateAngle(joints.shoulder, joints.elbow, joints.wrist);
        const smoothedAngle = this.smoothAngle(arm, angle);
        
        // State machine for bicep curl detection
        const previousState = arm.state;
        const newState = this.updateArmState(arm, smoothedAngle);
        
        if (newState !== previousState) {
            arm.state = newState;
            
            // Check for completed rep: transition from 'up' back to 'ready'
            if (previousState === 'up' && newState === 'ready') {
                this.incrementRepCount(side);
                this.playBeepSound();
            }
        }
        
        arm.lastAngle = smoothedAngle;
        this.updateArmUI(side, arm, smoothedAngle);
    }
    
    areJointsValid(joints) {
        return joints.shoulder?.score > this.thresholds.MIN_CONFIDENCE &&
               joints.elbow?.score > this.thresholds.MIN_CONFIDENCE &&
               joints.wrist?.score > this.thresholds.MIN_CONFIDENCE;
    }
    
    calculateAngle(p1, p2, p3) {
        const v1x = p1.x - p2.x;
        const v1y = p1.y - p2.y;
        const v2x = p3.x - p2.x;
        const v2y = p3.y - p2.y;
        
        const dot = v1x * v2x + v1y * v2y;
        const mag1 = Math.sqrt(v1x * v1x + v1y * v1y);
        const mag2 = Math.sqrt(v2x * v2x + v2y * v2y);
        
        if (mag1 === 0 || mag2 === 0) return 0;
        
        const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
        const angleRad = Math.acos(cosAngle);
        return Math.round((angleRad * 180) / Math.PI);
    }
    
    smoothAngle(arm, newAngle) {
        arm.angleHistory.push(newAngle);
        
        const maxHistory = this.settings.smoothing;
        if (arm.angleHistory.length > maxHistory) {
            arm.angleHistory.shift();
        }
        
        // Moving average
        const sum = arm.angleHistory.reduce((a, b) => a + b, 0);
        return Math.round(sum / arm.angleHistory.length);
    }
    
    updateArmState(arm, angle) {
        switch (arm.state) {
            case 'ready':
                if (angle > this.thresholds.DOWN_ANGLE) {
                    return 'down';
                }
                break;
                
            case 'down':
                if (angle < this.thresholds.UP_ANGLE) {
                    return 'up';
                } else if (angle < this.thresholds.DOWN_ANGLE - this.thresholds.MIN_ANGLE_CHANGE) {
                    return 'ready';
                }
                break;
                
            case 'up':
                if (angle > this.thresholds.DOWN_ANGLE) {
                    return 'ready';
                }
                break;
        }
        
        return arm.state;
    }
    
    incrementRepCount(side) {
        const arm = side === 'left' ? this.leftArm : this.rightArm;
        arm.count++;
        this.totalReps++;
        
        console.log(`${side} arm rep completed: ${arm.count}`);
    }
    
    updateArmUI(side, arm, angle) {
        const isLeft = side === 'left';
        const countEl = isLeft ? this.leftCountEl : this.rightCountEl;
        const angleEl = isLeft ? this.leftAngleEl : this.rightAngleEl;
        const stateEl = isLeft ? this.leftStateEl : this.rightStateEl;
        const indicator = isLeft ? this.leftIndicator : this.rightIndicator;
        
        countEl.textContent = arm.count;
        angleEl.textContent = angle !== null ? `${angle}°` : '--°';
        stateEl.textContent = arm.state.charAt(0).toUpperCase() + arm.state.slice(1);
        stateEl.className = `detail-value state-value ${arm.state}`;
        
        // Update indicator
        if (angle !== null && (arm.state === 'down' || arm.state === 'up')) {
            indicator.classList.add('active');
        } else {
            indicator.classList.remove('active');
        }
    }
    
    playBeepSound() {
        if (!this.audioContext || this.settings.volume === 0) return;
        
        try {
            // Resume context if suspended (browser policy)
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
            
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            
            const volume = this.settings.volume;
            gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.15);
            
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + 0.15);
            
        } catch (error) {
            console.warn('Audio playback error:', error);
        }
    }
    
    drawPose(pose) {
        const keypoints = pose.keypoints;
        const scaleX = this.canvas.width / this.video.videoWidth;
        const scaleY = this.canvas.height / this.video.videoHeight;
        
        // Draw arms with clean styling
        this.drawCleanArm('left', {
            shoulder: keypoints[this.keypoints.LEFT_SHOULDER],
            elbow: keypoints[this.keypoints.LEFT_ELBOW],
            wrist: keypoints[this.keypoints.LEFT_WRIST]
        }, scaleX, scaleY, '#32b6c4');
        
        this.drawCleanArm('right', {
            shoulder: keypoints[this.keypoints.RIGHT_SHOULDER],
            elbow: keypoints[this.keypoints.RIGHT_ELBOW],
            wrist: keypoints[this.keypoints.RIGHT_WRIST]
        }, scaleX, scaleY, '#e68161');
    }
    
    drawCleanArm(side, joints, scaleX, scaleY, color) {
        if (!this.areJointsValid(joints)) return;
        
        const points = [
            { x: joints.shoulder.x * scaleX, y: joints.shoulder.y * scaleY },
            { x: joints.elbow.x * scaleX, y: joints.elbow.y * scaleY },
            { x: joints.wrist.x * scaleX, y: joints.wrist.y * scaleY }
        ];
        
        // Draw smooth lines
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 4;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        // Upper arm
        this.ctx.beginPath();
        this.ctx.moveTo(points[0].x, points[0].y);
        this.ctx.lineTo(points[1].x, points[1].y);
        this.ctx.stroke();
        
        // Forearm
        this.ctx.beginPath();
        this.ctx.moveTo(points[1].x, points[1].y);
        this.ctx.lineTo(points[2].x, points[2].y);
        this.ctx.stroke();
        
        // Draw clean joint points
        this.ctx.fillStyle = color;
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        
        points.forEach(point => {
            this.ctx.beginPath();
            this.ctx.arc(point.x, point.y, 6, 0, 2 * Math.PI);
            this.ctx.fill();
            this.ctx.stroke();
        });
    }
    
    updateFPS() {
        this.frameCount++;
        const now = performance.now();
        
        if (now - this.lastTime >= 1000) {
            this.fps = Math.round((this.frameCount * 1000) / (now - this.lastTime));
            this.fpsEl.textContent = this.fps;
            
            this.fpsHistory.push(this.fps);
            if (this.fpsHistory.length > 60) {
                this.fpsHistory.shift();
            }
            
            this.frameCount = 0;
            this.lastTime = now;
        }
    }
    
    updateSessionStats() {
        if (!this.sessionStartTime) {
            this.sessionTimeEl.textContent = '00:00';
            return;
        }
        
        this.sessionDuration = Date.now() - this.sessionStartTime;
        const minutes = Math.floor(this.sessionDuration / 60000);
        const seconds = Math.floor((this.sessionDuration % 60000) / 1000);
        
        this.totalRepsEl.textContent = this.totalReps;
        this.sessionTimeEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        if (this.fpsHistory.length > 0) {
            const avgFps = Math.round(this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length);
            this.avgFpsEl.textContent = avgFps;
        }
    }
    
    updateVolume(value) {
        this.settings.volume = value / 100;
        this.volumeValueEl.textContent = `${value}%`;
    }
    
    updateSmoothing(value) {
        this.settings.smoothing = parseInt(value);
        this.smoothingValueEl.textContent = value;
    }
    
    resetCounters() {
        this.leftArm = { state: 'ready', count: 0, lastAngle: 0, angleHistory: [], confidence: 0 };
        this.rightArm = { state: 'ready', count: 0, lastAngle: 0, angleHistory: [], confidence: 0 };
        this.totalReps = 0;
        this.sessionStartTime = this.isWorkoutActive ? Date.now() : null;
        
        this.updateArmUI('left', this.leftArm, null);
        this.updateArmUI('right', this.rightArm, null);
        this.updateSessionStats();
        
        console.log('Counters reset');
    }
    
    toggleCamera() {
        this.isCameraOn = !this.isCameraOn;
        
        if (this.isCameraOn) {
            this.video.style.display = 'block';
            this.toggleCameraBtn.textContent = 'Turn Off Camera';
            document.body.classList.remove('camera-off');
            this.updateStatus(this.isWorkoutActive ? 'Workout active - detecting poses' : 'Camera enabled - Ready to start workout', 'success');
        } else {
            this.video.style.display = 'none';
            this.toggleCameraBtn.textContent = 'Turn On Camera';
            document.body.classList.add('camera-off');
            this.clearCanvas();
            this.updateStatus('Camera disabled', 'info');
        }
    }
    
    resizeCanvas() {
        if (this.video.videoWidth && this.video.videoHeight) {
            this.canvas.width = this.video.offsetWidth;
            this.canvas.height = this.video.offsetHeight;
            console.log(`Canvas resized: ${this.canvas.width}x${this.canvas.height}`);
        }
    }
    
    clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    updateStatus(message, type = 'info') {
        this.statusEl.textContent = message;
        this.statusEl.className = `status status--${type}`;
    }
    
    updateLoadingText(text) {
        this.loadingTextEl.textContent = text;
    }
    
    updateProgress(percentage) {
        this.progressFillEl.style.width = `${percentage}%`;
        this.progressTextEl.textContent = `${percentage}%`;
    }
    
    showError(title, message) {
        const existingError = document.querySelector('.error-banner');
        if (existingError) {
            existingError.remove();
        }
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-banner';
        errorDiv.innerHTML = `<strong>${title}</strong>${message}`;
        
        const container = document.querySelector('.container');
        const header = container.querySelector('.app-header');
        container.insertBefore(errorDiv, header.nextSibling);
        
        this.updateStatus('Error occurred', 'error');
        
        // Auto-remove error after 10 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.remove();
            }
        }, 10000);
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing AI Bicep Curl Counter...');
    
    // Check for required dependencies
    if (typeof tf === 'undefined') {
        console.error('TensorFlow.js not loaded');
        return;
    }
    
    if (typeof poseDetection === 'undefined') {
        console.error('Pose Detection library not loaded');
        return;
    }
    
    // Initialize the app
    window.bicepCounter = new AIBicepCurlCounter();
});