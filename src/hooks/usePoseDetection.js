import { useEffect, useRef, useState, useCallback } from 'react';

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm';
const MODEL_ASSET_PATH = '/pose_landmarker_lite.task';

const CONNECTIONS = [
  [11, 13], [13, 15],
  [12, 14], [14, 16],
  [11, 12], [11, 23], [12, 24],
  [23, 25], [25, 27],
  [24, 26], [26, 28],
  [27, 29], [29, 31], [27, 31],
  [28, 30], [30, 32], [28, 32],
];

const LANDMARK_NAMES = {
  0: 'Nose',
  11: 'L-Shoulder', 12: 'R-Shoulder',
  13: 'L-Elbow',   14: 'R-Elbow',
  15: 'L-Wrist',   16: 'R-Wrist',
  23: 'L-Hip',     24: 'R-Hip',
};

const drawSkeleton = (ctx, landmarks, canvasWidth, canvasHeight) => {
  ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
  ctx.lineWidth = 2;

  for (const [start, end] of CONNECTIONS) {
    const s = landmarks[start];
    const e = landmarks[end];
    if (s && e && s.visibility > 0.5 && e.visibility > 0.5) {
      ctx.beginPath();
      ctx.moveTo((1 - s.x) * canvasWidth, s.y * canvasHeight);
      ctx.lineTo((1 - e.x) * canvasWidth, e.y * canvasHeight);
      ctx.stroke();
    }
  }
};

const drawLandmarks = (ctx, landmarks, canvasWidth, canvasHeight) => {
  for (let i = 0; i < landmarks.length; i++) {
    const lm = landmarks[i];
    if (lm.visibility <= 0.5) continue;

    const x = (1 - lm.x) * canvasWidth;
    const y = lm.y * canvasHeight;
    const isKey = !!LANDMARK_NAMES[i];

    ctx.fillStyle = isKey ? 'rgba(255, 100, 0, 0.9)' : 'rgba(0, 255, 0, 0.7)';
    ctx.strokeStyle = isKey ? 'rgba(255, 200, 0, 1)' : 'rgba(0, 200, 0, 1)';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.arc(x, y, isKey ? 10 : 6, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    if (isKey) {
      ctx.fillStyle = 'rgba(255, 255, 0, 1)';
      ctx.font = 'bold 9px monospace';
      ctx.fillText(LANDMARK_NAMES[i], x + 12, y - 5);
    }
  }
};

export const usePoseDetection = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const poseDetectorRef = useRef(null);
  const animationIdRef = useRef(null);
  const frameCountRef = useRef(0);
  const lastUpdateFrameRef = useRef(0);

  const [landmarks, setLandmarks] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [availableCameras, setAvailableCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('default');
  const [cameraError, setCameraError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  const detect = useCallback(() => {
    frameCountRef.current++;
    const frameCount = frameCountRef.current;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const detector = poseDetectorRef.current;

    if (!video || !canvas || !detector) {
      animationIdRef.current = requestAnimationFrame(detect);
      return;
    }

    try {
      const ctx = canvas.getContext('2d');

      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const timestampMs = frameCount * 33;
      const result = detector.detectForVideo(video, timestampMs);

      if (result.landmarks?.length > 0) {
        const poseLandmarks = result.landmarks[0];

        if (frameCount - lastUpdateFrameRef.current >= 1) {
          setLandmarks(poseLandmarks);
          lastUpdateFrameRef.current = frameCount;
        }

        drawSkeleton(ctx, poseLandmarks, canvas.width, canvas.height);
        drawLandmarks(ctx, poseLandmarks, canvas.width, canvas.height);
      }
    } catch (err) {
      console.error('Detection error:', err);
    }

    animationIdRef.current = requestAnimationFrame(detect);
  }, []);

  const startDetectionLoop = useCallback(() => {
    detect();
  }, [detect]);

  // Enumerate available cameras
  const enumerateCameras = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      if (videoDevices.length === 0) {
        setError('No cameras found');
        return [];
      }

      setAvailableCameras(videoDevices);
      
      // If only one camera or no camera selected yet, auto-select the first one
      if (videoDevices.length > 0 && selectedCameraId === 'default') {
        setSelectedCameraId(videoDevices[0].deviceId);
      }

      return videoDevices;
    } catch (err) {
      console.error('Error enumerating cameras:', err);
      setError('Could not access camera list');
      return [];
    }
  }, [selectedCameraId]);

  // Switch to a different camera
  const switchCamera = useCallback(async (deviceId) => {
    setSelectedCameraId(deviceId);
    setCameraError(null);
    
    // Stop current stream
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
    }

    // Request new stream from selected camera
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } }
      });

      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;

      const onCanPlay = () => {
        startDetectionLoop();
        videoRef.current?.removeEventListener('canplay', onCanPlay);
      };

      videoRef.current.addEventListener('canplay', onCanPlay);
      setRetryCount(0);
    } catch (err) {
      const errorMsg = getDetailedCameraError(err, deviceId);
      setCameraError(errorMsg);
      console.error('Error switching camera:', err);
    }
  }, [startDetectionLoop]);

  // Parse specific camera errors and return user-friendly message
  const getDetailedCameraError = useCallback((err, attemptedDeviceId) => {
    const errorName = err.name || 'UnknownError';
    
    if (errorName === 'NotReadableError') {
      return {
        title: 'Camera In Use',
        message: 'The camera is already being used by another application. Close any other apps using the camera (Zoom, Discord, OBS, Camera app, etc.) and try again.',
        actionHint: 'Close other camera apps and retry',
        recoverable: true
      };
    }
    
    if (errorName === 'NotAllowedError') {
      return {
        title: 'Permission Denied',
        message: 'Camera permission was denied. Check your browser settings and site permissions.',
        actionHint: 'Grant camera permission in browser settings',
        recoverable: true
      };
    }
    
    if (errorName === 'NotFoundError') {
      return {
        title: 'Camera Not Found',
        message: 'The selected camera is not available. It may have been disconnected.',
        actionHint: 'Check camera connection and try a different camera',
        recoverable: true
      };
    }
    
    if (errorName === 'OverconstrainedError') {
      return {
        title: 'Camera Constraints Not Met',
        message: 'This camera does not support the required resolution or format.',
        actionHint: 'Try a different camera or adjust settings',
        recoverable: true
      };
    }
    
    return {
      title: 'Camera Error',
      message: `${errorName}: ${err.message || 'Unknown camera error'}`,
      actionHint: 'Try refreshing the page or using a different camera',
      recoverable: true
    };
  }, []);

  const startWebcamAccess = useCallback(async () => {
    setCameraError(null);
    
    try {
      // First enumerate cameras
      const cameras = await enumerateCameras();
      
      if (cameras.length === 0) {
        setCameraError({
          title: 'No Cameras Found',
          message: 'No camera devices were detected on your system. Please check that a camera is connected and functioning.',
          actionHint: 'Connect a camera and refresh the page',
          recoverable: true
        });
        setError('No cameras available');
        return;
      }

      // Use selected camera or first available
      const cameraId = selectedCameraId !== 'default' ? selectedCameraId : cameras[0].deviceId;
      
      // Try with exact device ID first
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: cameraId } }
        });

        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;

        const onCanPlay = () => {
          startDetectionLoop();
          videoRef.current?.removeEventListener('canplay', onCanPlay);
        };

        videoRef.current.addEventListener('canplay', onCanPlay);
        setRetryCount(0);
      } catch (exactErr) {
        // If exact device ID fails, try without constraints
        console.warn('Exact device ID failed, trying with fallback constraints...', exactErr);
        
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user' }
          });

          if (!videoRef.current) return;
          videoRef.current.srcObject = stream;

          const onCanPlay = () => {
            startDetectionLoop();
            videoRef.current?.removeEventListener('canplay', onCanPlay);
          };

          videoRef.current.addEventListener('canplay', onCanPlay);
          setRetryCount(0);
        } catch (fallbackErr) {
          // Both attempts failed
          const errorMsg = getDetailedCameraError(fallbackErr, cameraId);
          setCameraError(errorMsg);
          console.error('Camera access failed:', fallbackErr);
        }
      }
    } catch (err) {
      const errorMsg = getDetailedCameraError(err, 'unknown');
      setCameraError(errorMsg);
      console.error('Webcam initialization error:', err);
    }
  }, [startDetectionLoop, enumerateCameras, selectedCameraId, getDetailedCameraError]);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        console.log('Starting MediaPipe initialization...');
        const { PoseLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');

        const filesetResolver = await FilesetResolver.forVisionTasks(WASM_URL);

        const poseLandmarker = await PoseLandmarker.createFromOptions(filesetResolver, {
          baseOptions: { modelAssetPath: MODEL_ASSET_PATH },
          runningMode: 'VIDEO',
        });

        if (!isMounted) return;

        poseDetectorRef.current = poseLandmarker;
        console.log('PoseLandmarker initialized');
        setIsLoading(false);
        startWebcamAccess();
      } catch (err) {
        if (!isMounted) return;
        setError(`MediaPipe Load Error: ${err instanceof Error ? err.message : String(err)}`);
        console.error('MediaPipe initialization error:', err);
      }
    };

    init();

    return () => {
      isMounted = false;
      if (animationIdRef.current) cancelAnimationFrame(animationIdRef.current);
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      }
    };
  }, [startWebcamAccess]);

  return { 
    videoRef, 
    canvasRef, 
    landmarks, 
    isLoading, 
    error,
    cameraError,
    availableCameras,
    selectedCameraId,
    switchCamera,
    enumerateCameras,
    retryWebcam: startWebcamAccess
  };
};