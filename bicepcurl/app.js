class BicepCurlCounter {
    constructor() {
        // DOM elements
        this.video = document.getElementById('video');
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.statusEl = document.getElementById('status');
        this.fpsEl = document.getElementById('fps');
        this.loadingEl = document.getElementById('loading');
        this.loadingTextEl = document.getElementById('loadingText');
        this.progressFillEl = document.getElementById('progressFill');
        this.beepSound = document.getElementById('beepSound');
        
        // Counter elements
        this.leftCountEl = document.getElementById('leftCount');
        this.rightCountEl = document.getElementById('rightCount');
        this.leftAngleEl = document.getElementById('leftAngle');
        this.rightAngleEl = document.getElementById('rightAngle');
        this.leftStateEl = document.getElementById('leftState');
        this.rightStateEl = document.getElementById('rightState');
        
        // Buttons
        this.resetBtn = document.getElementById('resetBtn');
        this.toggleCameraBtn = document.getElementById('toggleCamera');
        
        // Pose detection variables
        this.detector = null;
        this.isModelLoaded = false;
        this.isDetecting = false;
        this.isCameraOn = true;
        this.stream = null;
        
        // Pose keypoint indices (from provided data)
        this.keypoints = {
            LEFT_SHOULDER: 5,
            LEFT_ELBOW: 7,
            LEFT_WRIST: 9,
            RIGHT_SHOULDER: 6,
            RIGHT_ELBOW: 8,
            RIGHT_WRIST: 10
        };
        
        // Angle thresholds (from provided data)
        this.thresholds = {
            DOWN_THRESHOLD: 150,
            UP_THRESHOLD: 60,
            MIN_CONFIDENCE: 0.5
        };
        
        // Tracking variables
        this.leftArmState = 'ready'; // 'ready', 'down', 'up'
        this.rightArmState = 'ready';
        this.leftRepCount = 0;
        this.rightRepCount = 0;
        
        // Performance tracking
        this.fps = 0;
        this.frameCount = 0;
        this.lastTime = performance.now();
        this.lastFpsTime = performance.now();
        
        this.init();
    }
    
    async init() {
        try {
            this.setupEventListeners();
            await this.setupTensorFlow();
            await this.setupCamera();
            await this.loadModel();
            this.startDetection();
        } catch (error) {
            console.error('Initialization error:', error);
            this.showError('Failed to initialize application', error.message);
        }
    }
    
    setupEventListeners() {
        this.resetBtn.addEventListener('click', () => this.resetCounters());
        this.toggleCameraBtn.addEventListener('click', () => this.toggleCamera());
        
        // Handle window resize
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // Handle video events
        this.video.addEventListener('loadedmetadata', () => {
            console.log('Video metadata loaded');
            this.resizeCanvas();
        });
        
        this.video.addEventListener('loadeddata', () => {
            console.log('Video data loaded');
            this.resizeCanvas();
        });
    }
    
    async setupTensorFlow() {
        try {
            this.updateStatus('Setting up TensorFlow...', 'info');
            this.loadingTextEl.textContent = 'Setting up TensorFlow...';
            this.updateProgress(10);
            
            // Force WebGL backend as specified
            try {
                await tf.setBackend('webgl');
                await tf.ready();
                console.log('TensorFlow.js backend:', tf.getBackend());
            } catch (error) {
                console.warn('WebGL backend failed, falling back to CPU:', error);
                await tf.setBackend('cpu');
                await tf.ready();
                console.log('TensorFlow.js backend:', tf.getBackend());
            }
            
            this.updateProgress(25);
        } catch (error) {
            console.error('TensorFlow setup error:', error);
            throw new Error('Failed to setup TensorFlow: ' + error.message);
        }
    }
    
    async setupCamera() {
        try {
            this.updateStatus('Requesting camera access...', 'info');
            this.loadingTextEl.textContent = 'Requesting camera access...';
            this.updateProgress(35);
            
            console.log('Requesting camera access...');
            
            // Check if mediaDevices is available
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Camera access not supported in this browser');
            }
            
            // Request camera access with detailed constraints
            const constraints = {
                video: {
                    width: { ideal: 640, min: 320, max: 1280 },
                    height: { ideal: 480, min: 240, max: 720 },
                    frameRate: { ideal: 30, min: 15, max: 60 },
                    facingMode: 'user'
                },
                audio: false
            };
            
            console.log('Requesting stream with constraints:', constraints);
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            console.log('Camera stream obtained:', this.stream);
            
            if (!this.stream) {
                throw new Error('No camera stream received');
            }
            
            // Set up video element
            this.video.srcObject = this.stream;
            this.video.muted = true;
            this.video.autoplay = true;
            this.video.playsInline = true;
            
            console.log('Video element setup complete');
            this.updateProgress(45);
            
            // Wait for video to be ready
            await new Promise((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    reject(new Error('Video loading timeout'));
                }, 10000);
                
                const handleLoadedData = () => {
                    clearTimeout(timeoutId);
                    console.log('Video loaded and ready');
                    this.video.removeEventListener('loadeddata', handleLoadedData);
                    this.video.removeEventListener('error', handleError);
                    resolve();
                };
                
                const handleError = (error) => {
                    clearTimeout(timeoutId);
                    console.error('Video loading error:', error);
                    this.video.removeEventListener('loadeddata', handleLoadedData);
                    this.video.removeEventListener('error', handleError);
                    reject(new Error('Video failed to load'));
                };
                
                this.video.addEventListener('loadeddata', handleLoadedData);
                this.video.addEventListener('error', handleError);
                
                // Try to play the video
                this.video.play().catch(e => {
                    console.warn('Auto-play failed, but video should still work:', e);
                });
            });
            
            this.updateProgress(50);
            this.resizeCanvas();
            console.log('Camera setup complete');
            
        } catch (error) {
            console.error('Camera setup error:', error);
            
            let errorMessage = 'Please allow camera access to use this application';
            
            if (error.name === 'NotAllowedError') {
                errorMessage = 'Camera access denied. Please refresh and allow camera access.';
            } else if (error.name === 'NotFoundError') {
                errorMessage = 'No camera found. Please ensure you have a camera connected.';
            } else if (error.name === 'NotSupportedError') {
                errorMessage = 'Camera access not supported in this browser.';
            } else if (error.name === 'NotReadableError') {
                errorMessage = 'Camera is already in use by another application.';
            }
            
            this.showError('Camera access failed', errorMessage);
            throw error;
        }
    }
    
    async loadModel() {
        try {
            this.updateStatus('Loading MoveNet model...', 'info');
            this.loadingTextEl.textContent = 'Loading pose detection model...';
            this.updateProgress(60);
            
            console.log('Loading MoveNet model...');
            
            // Create detector with MoveNet SinglePose Lightning
            this.detector = await poseDetection.createDetector(
                poseDetection.SupportedModels.MoveNet,
                {
                    modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING
                }
            );
            
            console.log('Model loaded successfully');
            this.updateProgress(100);
            this.isModelLoaded = true;
            this.updateStatus('Ready to detect poses', 'success');
            
            // Hide loading overlay
            setTimeout(() => {
                this.loadingEl.classList.add('hidden');
            }, 500);
            
        } catch (error) {
            console.error('Model loading error:', error);
            this.showError('Failed to load pose detection model', error.message);
            throw error;
        }
    }
    
    resizeCanvas() {
        if (this.video.videoWidth && this.video.videoHeight) {
            const videoAspectRatio = this.video.videoWidth / this.video.videoHeight;
            const containerWidth = this.video.offsetWidth;
            const containerHeight = this.video.offsetHeight;
            
            this.canvas.width = containerWidth;
            this.canvas.height = containerHeight;
            
            console.log(`Canvas resized to: ${this.canvas.width}x${this.canvas.height}`);
        }
    }
    
    startDetection() {
        if (!this.isModelLoaded) {
            console.error('Model not loaded, cannot start detection');
            return;
        }
        
        console.log('Starting pose detection...');
        this.isDetecting = true;
        this.detectLoop();
    }
    
    async detectLoop() {
        if (!this.isDetecting || !this.isCameraOn) {
            requestAnimationFrame(() => this.detectLoop());
            return;
        }
        
        try {
            // Clear canvas
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            
            // Only proceed if video is ready
            if (this.video.readyState >= 2) {
                // Detect poses
                const poses = await this.detector.estimatePoses(this.video);
                
                if (poses && poses.length > 0) {
                    const pose = poses[0];
                    this.processPose(pose);
                    this.drawPose(pose);
                }
            }
            
            // Update FPS
            this.updateFPS();
            
        } catch (error) {
            console.error('Detection error:', error);
        }
        
        requestAnimationFrame(() => this.detectLoop());
    }
    
    processPose(pose) {
        const keypoints = pose.keypoints;
        
        // Get keypoints for both arms
        const leftShoulder = keypoints[this.keypoints.LEFT_SHOULDER];
        const leftElbow = keypoints[this.keypoints.LEFT_ELBOW];
        const leftWrist = keypoints[this.keypoints.LEFT_WRIST];
        
        const rightShoulder = keypoints[this.keypoints.RIGHT_SHOULDER];
        const rightElbow = keypoints[this.keypoints.RIGHT_ELBOW];
        const rightWrist = keypoints[this.keypoints.RIGHT_WRIST];
        
        // Process left arm
        if (this.isValidKeypoint(leftShoulder) && 
            this.isValidKeypoint(leftElbow) && 
            this.isValidKeypoint(leftWrist)) {
            
            const leftAngle = this.calculateAngle(leftShoulder, leftElbow, leftWrist);
            this.processArmMovement('left', leftAngle);
        } else {
            this.leftAngleEl.textContent = '--°';
        }
        
        // Process right arm
        if (this.isValidKeypoint(rightShoulder) && 
            this.isValidKeypoint(rightElbow) && 
            this.isValidKeypoint(rightWrist)) {
            
            const rightAngle = this.calculateAngle(rightShoulder, rightElbow, rightWrist);
            this.processArmMovement('right', rightAngle);
        } else {
            this.rightAngleEl.textContent = '--°';
        }
    }
    
    isValidKeypoint(keypoint) {
        return keypoint && keypoint.score > this.thresholds.MIN_CONFIDENCE;
    }
    
    calculateAngle(p1, p2, p3) {
        // Calculate angle at p2 using vectors p2->p1 and p2->p3
        const v1x = p1.x - p2.x;
        const v1y = p1.y - p2.y;
        const v2x = p3.x - p2.x;
        const v2y = p3.y - p2.y;
        
        // Calculate dot product and magnitudes
        const dot = v1x * v2x + v1y * v2y;
        const mag1 = Math.sqrt(v1x * v1x + v1y * v1y);
        const mag2 = Math.sqrt(v2x * v2x + v2y * v2y);
        
        // Prevent division by zero
        if (mag1 === 0 || mag2 === 0) return 0;
        
        // Calculate angle in radians then convert to degrees
        const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
        const angleRad = Math.acos(cosAngle);
        const angleDeg = (angleRad * 180) / Math.PI;
        
        return Math.round(angleDeg);
    }
    
    processArmMovement(side, angle) {
        const currentState = side === 'left' ? this.leftArmState : this.rightArmState;
        let newState = currentState;
        
        // State machine for bicep curl detection
        switch (currentState) {
            case 'ready':
                if (angle > this.thresholds.DOWN_THRESHOLD) {
                    newState = 'down';
                }
                break;
                
            case 'down':
                if (angle < this.thresholds.UP_THRESHOLD) {
                    // Complete rep detected!
                    this.incrementCounter(side);
                    this.playBeep();
                    newState = 'ready';
                } else if (angle < this.thresholds.DOWN_THRESHOLD) {
                    // Moved back up without completing curl
                    newState = 'ready';
                }
                break;
        }
        
        // Update state and UI
        if (side === 'left') {
            this.leftArmState = newState;
            this.leftAngleEl.textContent = `${angle}°`;
            this.leftStateEl.textContent = newState.charAt(0).toUpperCase() + newState.slice(1);
            this.leftStateEl.className = `state-value ${newState}`;
        } else {
            this.rightArmState = newState;
            this.rightAngleEl.textContent = `${angle}°`;
            this.rightStateEl.textContent = newState.charAt(0).toUpperCase() + newState.slice(1);
            this.rightStateEl.className = `state-value ${newState}`;
        }
    }
    
    incrementCounter(side) {
        if (side === 'left') {
            this.leftRepCount++;
            this.leftCountEl.textContent = this.leftRepCount;
            console.log(`Left arm rep: ${this.leftRepCount}`);
        } else {
            this.rightRepCount++;
            this.rightCountEl.textContent = this.rightRepCount;
            console.log(`Right arm rep: ${this.rightRepCount}`);
        }
    }
    
    playBeep() {
        try {
            // Reset and play the beep sound
            this.beepSound.currentTime = 0;
            const playPromise = this.beepSound.play();
            
            if (playPromise !== undefined) {
                playPromise.catch(e => {
                    console.warn('Audio play failed, using Web Audio API fallback:', e);
                    this.createBeepSound();
                });
            }
        } catch (error) {
            console.warn('Error playing beep, using fallback:', error);
            this.createBeepSound();
        }
    }
    
    createBeepSound() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.1);
        } catch (error) {
            console.error('Error creating beep sound:', error);
        }
    }
    
    drawPose(pose) {
        const keypoints = pose.keypoints;
        const scaleX = this.canvas.width / this.video.videoWidth;
        const scaleY = this.canvas.height / this.video.videoHeight;
        
        // Draw left arm
        this.drawArm(
            keypoints[this.keypoints.LEFT_SHOULDER],
            keypoints[this.keypoints.LEFT_ELBOW],
            keypoints[this.keypoints.LEFT_WRIST],
            scaleX, scaleY, '#32b6c4', 'left-arm'
        );
        
        // Draw right arm
        this.drawArm(
            keypoints[this.keypoints.RIGHT_SHOULDER],
            keypoints[this.keypoints.RIGHT_ELBOW],
            keypoints[this.keypoints.RIGHT_WRIST],
            scaleX, scaleY, '#e68161', 'right-arm'
        );
    }
    
    drawArm(shoulder, elbow, wrist, scaleX, scaleY, color, className) {
        if (!this.isValidKeypoint(shoulder) || 
            !this.isValidKeypoint(elbow) || 
            !this.isValidKeypoint(wrist)) return;
        
        // Scale coordinates to canvas size
        const shoulderX = shoulder.x * scaleX;
        const shoulderY = shoulder.y * scaleY;
        const elbowX = elbow.x * scaleX;
        const elbowY = elbow.y * scaleY;
        const wristX = wrist.x * scaleX;
        const wristY = wrist.y * scaleY;
        
        // Set drawing style
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 4;
        this.ctx.lineCap = 'round';
        
        // Draw shoulder to elbow
        this.ctx.beginPath();
        this.ctx.moveTo(shoulderX, shoulderY);
        this.ctx.lineTo(elbowX, elbowY);
        this.ctx.stroke();
        
        // Draw elbow to wrist
        this.ctx.beginPath();
        this.ctx.moveTo(elbowX, elbowY);
        this.ctx.lineTo(wristX, wristY);
        this.ctx.stroke();
        
        // Draw keypoints
        this.ctx.fillStyle = color;
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        
        [
            [shoulderX, shoulderY],
            [elbowX, elbowY],
            [wristX, wristY]
        ].forEach(([x, y]) => {
            this.ctx.beginPath();
            this.ctx.arc(x, y, 6, 0, 2 * Math.PI);
            this.ctx.fill();
            this.ctx.stroke();
        });
    }
    
    updateFPS() {
        this.frameCount++;
        const now = performance.now();
        
        if (now - this.lastFpsTime >= 1000) {
            this.fps = Math.round((this.frameCount * 1000) / (now - this.lastFpsTime));
            this.fpsEl.textContent = this.fps;
            this.frameCount = 0;
            this.lastFpsTime = now;
        }
    }
    
    resetCounters() {
        this.leftRepCount = 0;
        this.rightRepCount = 0;
        this.leftArmState = 'ready';
        this.rightArmState = 'ready';
        
        // Update UI
        this.leftCountEl.textContent = '0';
        this.rightCountEl.textContent = '0';
        this.leftAngleEl.textContent = '--°';
        this.rightAngleEl.textContent = '--°';
        this.leftStateEl.textContent = 'Ready';
        this.rightStateEl.textContent = 'Ready';
        this.leftStateEl.className = 'state-value ready';
        this.rightStateEl.className = 'state-value ready';
        
        console.log('Counters reset');
    }
    
    toggleCamera() {
        this.isCameraOn = !this.isCameraOn;
        
        if (this.isCameraOn) {
            this.video.style.display = 'block';
            this.toggleCameraBtn.textContent = 'Turn Off Camera';
            document.body.classList.remove('camera-off');
            this.updateStatus('Camera on - ready to detect poses', 'success');
        } else {
            this.video.style.display = 'none';
            this.toggleCameraBtn.textContent = 'Turn On Camera';
            document.body.classList.add('camera-off');
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.updateStatus('Camera off', 'info');
        }
    }
    
    updateStatus(message, type = 'info') {
        this.statusEl.textContent = message;
        this.statusEl.className = `status status--${type}`;
    }
    
    updateProgress(percentage) {
        this.progressFillEl.style.width = `${percentage}%`;
    }
    
    showError(title, message) {
        const existingError = document.querySelector('.error-message');
        if (existingError) {
            existingError.remove();
        }
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.innerHTML = `<strong>${title}</strong>${message}`;
        
        const container = document.querySelector('.container');
        const header = container.querySelector('.app-header');
        container.insertBefore(errorDiv, header.nextSibling);
        
        this.updateStatus('Error occurred', 'error');
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing Bicep Curl Counter...');
    new BicepCurlCounter();
});