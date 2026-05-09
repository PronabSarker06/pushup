import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePoseDetection } from './hooks/usePoseDetection';
import { usePushupCounter } from './hooks/usePushupCounter';
import { useScoring } from './hooks/useScoring';
import { useSpotifyAuth } from './hooks/useSpotifyAuth';
import { useSpotifyNowPlaying } from './hooks/useSpotifyNowPlaying';
import { useSpotifyAudioFeatures } from './hooks/useSpotifyAudioFeatures';

export const PushUp = () => {
  const { 
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
    retryWebcam
  } = usePoseDetection();
  const { accessToken, isConnected, connectSpotify } = useSpotifyAuth();
  const { currentTrack } = useSpotifyNowPlaying(accessToken);
  const { bpm, error: bpmError } = useSpotifyAudioFeatures(accessToken, currentTrack);
  
  const { repCount, currentState, lastGrade, pushupMetrics } = usePushupCounter(landmarks, bpm, currentTrack?.progressMs);
  const { score, combo, scoreBreakdown } = useScoring(lastGrade, bpm, currentTrack?.progressMs, pushupMetrics, repCount);

  // Track accuracy counts
  const [accuracy, setAccuracy] = useState({ perfect: 0, good: 0, ok: 0, miss: 0, perfectStreak: 0 });
  const prevRepCountRef = useRef(0);

  // Track PB and blue fire
  const [isPBFlare, setIsPBFlare] = useState(false);
  const maxScoreRef = useRef(0);
  const pbTimeoutRef = useRef(null);

  // Update accuracy counts when a NEW rep is completed (repCount increases)
  useEffect(() => {
    if (repCount > prevRepCountRef.current && lastGrade) {
      setAccuracy(prev => {
        const newAccuracy = { ...prev };
        const gradeKey = lastGrade.toLowerCase();
        if (gradeKey in newAccuracy) {
          newAccuracy[gradeKey]++;
        }
        return newAccuracy;
      });
      prevRepCountRef.current = repCount;
    }
  }, [repCount, lastGrade]);

  // Track PB and keep blue fire on
  useEffect(() => {
    if (score > maxScoreRef.current) {
      maxScoreRef.current = score;
      setIsPBFlare(true);
      // Don't turn off the blue fire - keep it on permanently
    }
  }, [score]);

  // Fire gradient logic
  const fireProgress = Math.min(repCount / 5, 1);
  let bgColor;

  if (isPBFlare) {
    // Blue fire
    bgColor = '#001a33';
  } else {
    // Heat from grey to orange-red
    bgColor = `rgb(${Math.round(58 + (110 - 58) * fireProgress)}, ${Math.round(58 - 58 * fireProgress)}, ${Math.round(58 - 58 * fireProgress)})`;
  }

  if (isLoading) {
    return (
      <div style={{ 
        padding: '20px', 
        fontFamily: 'Nunito, sans-serif',
        backgroundColor: '#3a3a3a',
        color: '#fff',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '20px'
      }}>
        <div style={{ fontSize: '18px', fontWeight: 'bold' }}>Loading MediaPipe...</div>
        <div style={{ fontSize: '12px', color: '#999' }}>
          This may take 10-20 seconds on first load
        </div>

        {/* Camera Selector */}
        {availableCameras.length > 0 && (
          <div style={{ marginTop: '20px', padding: '20px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '12px', maxWidth: '400px' }}>
            <div style={{ fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '12px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>
              Select Camera Source
            </div>
            <select
              value={selectedCameraId}
              onChange={(e) => switchCamera(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                backgroundColor: '#2a2a2a',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '6px',
                fontSize: '14px',
                fontFamily: 'Nunito, sans-serif',
                cursor: 'pointer'
              }}
            >
              {availableCameras.map((camera, idx) => (
                <option key={camera.deviceId} value={camera.deviceId}>
                  {camera.label || `Camera ${idx + 1}`}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    );
  }

  if (error || cameraError) {
    const displayError = cameraError || { title: 'Error', message: error };
    
    return (
      <div style={{ 
        padding: '40px 20px', 
        fontFamily: 'Nunito, sans-serif',
        backgroundColor: '#2a2a2a',
        color: '#fff',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '24px'
      }}>
        {/* Error Icon */}
        <div style={{ fontSize: '48px' }}>⚠️</div>

        {/* Error Title */}
        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ff6b6b' }}>
          {displayError.title || 'Error'}
        </div>

        {/* Error Message */}
        <div style={{ 
          fontSize: '14px', 
          color: 'rgba(255,255,255,0.7)',
          maxWidth: '400px',
          textAlign: 'center',
          lineHeight: '1.6'
        }}>
          {displayError.message || error}
        </div>

        {/* Action Hint */}
        {displayError.actionHint && (
          <div style={{
            padding: '16px 20px',
            backgroundColor: 'rgba(255, 107, 107, 0.1)',
            border: '1px solid rgba(255, 107, 107, 0.3)',
            borderRadius: '8px',
            fontSize: '13px',
            color: '#FFB3B3',
            maxWidth: '400px',
            textAlign: 'center'
          }}>
            💡 {displayError.actionHint}
          </div>
        )}

        {/* Camera Selector if recoverable */}
        {displayError.recoverable && availableCameras.length > 0 && (
          <div style={{
            padding: '20px',
            backgroundColor: 'rgba(255,255,255,0.05)',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '400px'
          }}>
            <div style={{ fontSize: '12px', marginBottom: '12px', color: 'rgba(255,255,255,0.6)', fontWeight: 'bold' }}>
              Try Different Camera:
            </div>
            <select
              value={selectedCameraId}
              onChange={(e) => switchCamera(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#1a1a1a',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '6px',
                fontSize: '13px',
                fontFamily: 'Nunito, sans-serif',
                cursor: 'pointer'
              }}
            >
              {availableCameras.map((camera, idx) => (
                <option key={camera.deviceId} value={camera.deviceId}>
                  {camera.label || `Camera ${idx + 1}`}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Retry Button */}
        {displayError.recoverable && (
          <button
            onClick={retryWebcam}
            style={{
              padding: '12px 28px',
              backgroundColor: '#FF8DA1',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
            onMouseOver={(e) => {
              e.target.style.backgroundColor = '#ff6b85';
              e.target.style.transform = 'scale(1.05)';
            }}
            onMouseOut={(e) => {
              e.target.style.backgroundColor = '#FF8DA1';
              e.target.style.transform = 'scale(1)';
            }}
          >
            🔄 Retry
          </button>
        )}

        {/* Troubleshooting Section */}
        <details style={{
          marginTop: '24px',
          padding: '16px',
          backgroundColor: 'rgba(255,255,255,0.03)',
          borderRadius: '8px',
          maxWidth: '500px',
          width: '100%',
          cursor: 'pointer'
        }}>
          <summary style={{ fontWeight: 'bold', marginBottom: '12px', opacity: 0.7 }}>
            Troubleshooting Steps
          </summary>
          <ol style={{ fontSize: '12px', margin: 0, paddingLeft: '20px', opacity: 0.6, lineHeight: '1.8' }}>
            <li>Close any other applications using the camera (Zoom, Discord, OBS, etc.)</li>
            <li>Check that your camera is properly connected</li>
            <li>Ensure browser has permission to access the camera</li>
            <li>Try refreshing the page (F5)</li>
            <li>Restart your browser and try again</li>
            <li>Check browser console (F12) for detailed error information</li>
          </ol>
        </details>
      </div>
    );
  }

  return (
    <motion.div
      style={{
        position: 'relative',
        backgroundColor: isPBFlare ? '#001a33' : bgColor,
        color: '#fff',
        minHeight: '100vh',
        fontFamily: 'Nunito, sans-serif',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '40px',
        paddingBottom: '120px'
      }}
      animate={{ backgroundColor: isPBFlare ? '#001a33' : bgColor }}
      transition={{ duration: 0.6 }}
    >
      {/* Fire overlay */}
      <motion.div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: 'none',
          background: isPBFlare 
            ? `radial-gradient(ellipse at 50% 110%, #00c6ffaa, transparent 60%)`
            : `radial-gradient(ellipse at 50% 110%, rgba(255, 106, 0, ${0.4 * fireProgress}), transparent 60%)`,
          zIndex: 0
        }}
        animate={{ opacity: fireProgress }}
        transition={{ duration: 0.6 }}
      />

      {/* Content layer */}
      <motion.div style={{ position: 'relative', zIndex: 1, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '40px' }}>
        
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{
            padding: '20px 60px',
            borderRadius: '60px',
            backgroundColor: '#FF8DA1',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            marginTop: '40px'
          }}
        >
          <h1 style={{
            fontFamily: 'Fredoka One, sans-serif',
            fontSize: '48px',
            fontWeight: 'bold',
            margin: 0,
            letterSpacing: '2px',
            color: '#fff'
          }}>
            PushUp!
          </h1>
        </motion.div>

        {/* Combo Section */}
        <motion.div
          style={{
            width: '100%',
            maxWidth: '500px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px'
          }}
        >
          <div style={{
            fontSize: '11px',
            fontWeight: 'bold',
            letterSpacing: '3px',
            color: 'rgba(255,255,255,0.6)',
            textTransform: 'uppercase'
          }}>
            Combo
          </div>
          
          {/* Combo bar */}
          <div style={{
            position: 'relative',
            width: '100%',
            height: '8px',
            backgroundColor: 'rgba(255,255,255,0.1)',
            borderRadius: '999px',
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.2)'
          }}>
            <motion.div
              style={{
                height: '100%',
                width: `${Math.min(combo / 10 * 100, 100)}%`,
                background: isPBFlare 
                  ? 'linear-gradient(90deg, #00c6ff, #0088ff)'
                  : 'linear-gradient(90deg, #ff6a00, #ffa500)',
                borderRadius: '999px'
              }}
              animate={{
                width: `${Math.min(combo / 10 * 100, 100)}%`,
                background: isPBFlare 
                  ? 'linear-gradient(90deg, #00c6ff, #0088ff)'
                  : 'linear-gradient(90deg, #ff6a00, #ffa500)'
              }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />
          </div>

          {/* Combo number */}
          <motion.div
            style={{
              fontFamily: 'Fredoka One, sans-serif',
              fontSize: '54px',
              fontWeight: 'bold',
              textAlign: 'center',
              lineHeight: 1
            }}
            animate={{ scale: combo > 0 ? 1 : 0.8 }}
            transition={{ type: 'spring', stiffness: 200, damping: 10 }}
          >
            {combo}<span style={{ fontSize: '40px', marginLeft: '8px', opacity: 0.7 }}>×</span>
          </motion.div>
        </motion.div>

        {/* Camera View */}
        <motion.div
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: '500px',
            aspectRatio: '4 / 3',
            borderRadius: '24px',
            overflow: 'hidden',
            border: '2px solid rgba(255,255,255,0.1)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)'
          }}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            style={{
              width: '100%',
              height: '100%',
              display: 'block',
              backgroundColor: '#000',
              transform: 'scaleX(-1)'
            }}
          />
          <canvas
            ref={canvasRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              zIndex: 10,
              transform: 'scaleX(-1)'
            }}
          />
          
          {/* Hit burst animation */}
          <AnimatePresence>
            {lastGrade && (
              <motion.div
                key={`${repCount}-${lastGrade}`}
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  fontSize: '48px',
                  fontFamily: 'Fredoka One, sans-serif',
                  fontWeight: 'bold',
                  zIndex: 20,
                  pointerEvents: 'none'
                }}
                initial={{ opacity: 1, y: 0, scale: 1 }}
                animate={{ opacity: 0, y: -60, scale: 1.5 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
              >
                <span style={{
                  ...(lastGrade === 'PERFECT' && {
                    background: 'linear-gradient(90deg, #ff6b6b, #ffd200, #6bff6b, #6bb5ff, #d96bff, #ff6b6b)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    color: 'transparent'
                  }),
                  ...(lastGrade === 'GOOD' && { color: '#50c878' }),
                  ...(lastGrade === 'OK' && { color: '#aaaaff' }),
                  ...(lastGrade === 'MISS' && { color: '#ff6060' })
                }}>
                  {lastGrade}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Real-time Timing Indicator */}
          {pushupMetrics?.downDuration > 0 && (
            <motion.div
              style={{
                position: 'absolute',
                bottom: '20px',
                left: '50%',
                transform: 'translateX(-50%)',
                padding: '12px 20px',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 'bold',
                color: '#fff',
                zIndex: 15,
                border: '1px solid rgba(255, 255, 255, 0.2)'
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div>↓ {pushupMetrics.downDuration}ms</div>
                <div style={{ color: 'rgba(255, 255, 255, 0.5)' }}>|</div>
                <div>↑ {pushupMetrics.upDuration}ms</div>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Rep Count */}
        <motion.div
          style={{
            fontSize: '16px',
            fontWeight: 'bold',
            letterSpacing: '2px',
            color: 'rgba(255,255,255,0.8)',
            textTransform: 'uppercase'
          }}
          key={`reps-${repCount}`}
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 0.3 }}
        >
          {repCount} Reps
        </motion.div>

        {/* Score */}
        <motion.div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: '11px',
            fontWeight: 'bold',
            letterSpacing: '3px',
            color: 'rgba(255,255,255,0.6)',
            marginBottom: '12px',
            textTransform: 'uppercase'
          }}>
            Score
          </div>
          <motion.div
            style={{
              fontFamily: 'Fredoka One, sans-serif',
              fontSize: '64px',
              fontWeight: 'bold',
              textAlign: 'center',
              lineHeight: 1,
              minWidth: '320px'
            }}
            key={`score-${score}`}
            animate={{ scale: [1, 1.12, 1] }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          >
            {String(score).padStart(6, '0')}
          </motion.div>
        </motion.div>

        {/* Accuracy Chips */}
        <motion.div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'center',
          flexWrap: 'wrap',
          width: '100%',
          maxWidth: '600px'
        }}>
          {[
            { label: 'PERFECT', count: accuracy.perfect, bgColor: '#FFD700', isRainbow: true },
            { label: 'GOOD', count: accuracy.good, bgColor: '#2d7a2d' },
            { label: 'OK', count: accuracy.ok, bgColor: '#E8751A' },
            { label: 'MISS', count: accuracy.miss, bgColor: '#8B3333' }
          ].map(chip => {
            const isRainbow = chip.isRainbow;
            return (
              <motion.div
                key={chip.label}
                style={{
                  padding: '10px 18px',
                  backgroundColor: isRainbow ? 'rgba(0,0,0,0.3)' : chip.bgColor,
                  background: isRainbow ? 'linear-gradient(90deg, #ff6b6b, #ffd700, #6bff6b, #6bb5ff, #d96bff, #ff6b6b)' : chip.bgColor,
                  backgroundSize: isRainbow ? '200% auto' : 'auto',
                  borderRadius: '20px',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  letterSpacing: '1px',
                  color: '#fff',
                  textShadow: isRainbow ? '-1px -1px 0 #000, -1px 0px 0 #000, -1px 1px 0 #000, 0px -1px 0 #000, 0px 1px 0 #000, 1px -1px 0 #000, 1px 0px 0 #000, 1px 1px 0 #000' : 'none',
                  textAlign: 'center',
                  animation: isRainbow ? 'shimmer 2.5s linear infinite' : 'none'
                }}
              >
                {chip.label} <span style={{ opacity: 0.8 }}>×{chip.count}</span>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Pushup Metrics Breakdown */}
        {scoreBreakdown && (
          <motion.div
            style={{
              width: '100%',
              maxWidth: '600px',
              padding: '20px',
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderRadius: '16px',
              border: '1px solid rgba(255,255,255,0.1)',
              backdropFilter: 'blur(10px)'
            }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div style={{ fontSize: '12px', fontWeight: 'bold', letterSpacing: '2px', color: 'rgba(255,255,255,0.6)', marginBottom: '16px', textTransform: 'uppercase' }}>
              Last Rep Breakdown
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              {/* Depth */}
              {scoreBreakdown.depth && (
                <div style={{ padding: '10px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>DEPTH</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '4px', color: scoreBreakdown.depth.grade === 'PERFECT' ? '#FFD700' : scoreBreakdown.depth.grade === 'GOOD' ? '#2d7a2d' : scoreBreakdown.depth.grade === 'OK' ? '#E8751A' : '#8B3333' }}>
                    {scoreBreakdown.depth.grade}
                  </div>
                  {scoreBreakdown.depth.value !== undefined && (
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
                      {scoreBreakdown.depth.value}%
                    </div>
                  )}
                </div>
              )}

              {/* Form */}
              {scoreBreakdown.form && (
                <div style={{ padding: '10px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>FORM</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '4px', color: scoreBreakdown.form.grade === 'PERFECT' ? '#FFD700' : scoreBreakdown.form.grade === 'GOOD' ? '#2d7a2d' : scoreBreakdown.form.grade === 'OK' ? '#E8751A' : '#8B3333' }}>
                    {scoreBreakdown.form.grade}
                  </div>
                  {scoreBreakdown.form.points !== undefined && (
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
                      +{scoreBreakdown.form.points}
                    </div>
                  )}
                </div>
              )}

              {/* Timing */}
              {scoreBreakdown.timing || (scoreBreakdown.downDuration && scoreBreakdown.upDuration) ? (
                <div style={{ padding: '10px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>TIMING</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '4px', color: scoreBreakdown.timing?.grade === 'PERFECT' ? '#FFD700' : scoreBreakdown.timing?.grade === 'GOOD' ? '#2d7a2d' : scoreBreakdown.timing?.grade === 'OK' ? '#E8751A' : scoreBreakdown.timing?.grade === 'MISS' ? '#8B3333' : '#666' }}>
                    {scoreBreakdown.timing?.grade || (scoreBreakdown.downDuration ? '⏱' : '—')}
                  </div>
                  {scoreBreakdown.timing?.points !== undefined && (
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
                      +{scoreBreakdown.timing.points}
                    </div>
                  )}
                  {!scoreBreakdown.timing && scoreBreakdown.downDuration && (
                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>
                      (needs BPM)
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            {/* Timing Details */}
            {(scoreBreakdown.downDuration || scoreBreakdown.upDuration) && (
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', marginBottom: '8px' }}>PHASE TIMING</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px' }}>
                  <div>↓ Down: {scoreBreakdown.downDuration}ms</div>
                  <div>↑ Up: {scoreBreakdown.upDuration}ms</div>
                  {scoreBreakdown.bottomPause > 0 && <div>⏸ Bottom: {scoreBreakdown.bottomPause}ms</div>}
                  {scoreBreakdown.topPause > 0 && <div>⏸ Top: {scoreBreakdown.topPause}ms</div>}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* PB Badge */}
        <AnimatePresence>
          {isPBFlare && (
            <motion.div
              style={{
                padding: '14px 28px',
                border: '2px solid #00c6ff',
                borderRadius: '999px',
                fontSize: '16px',
                fontWeight: 'bold',
                letterSpacing: '2px',
                color: '#00c6ff',
                boxShadow: '0 0 30px rgba(0, 198, 255, 0.6)',
                backdropFilter: 'blur(10px)',
                backgroundColor: 'rgba(0, 198, 255, 0.1)'
              }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.4 }}
            >
              🔥 NEW PERSONAL BEST
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Spotify Now Playing Bar - Bottom */}
      <motion.div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
            right: 0,
            padding: '16px 20px',
            backgroundColor: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(12px)',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            zIndex: 50,
            width: '100%',
            boxSizing: 'border-box'
          }}
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          {/* Album Art */}
          {currentTrack?.imageUrl ? (
            <img
              src={currentTrack.imageUrl}
              alt="Album art"
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '8px',
                objectFit: 'cover',
                flexShrink: 0
              }}
            />
          ) : (
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255,255,255,0.1)',
                flexShrink: 0
              }}
            />
          )}

          {/* Track Info */}
          <div style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}>
            {currentTrack ? (
              <>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 'bold',
                    color: '#fff',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {currentTrack.name}
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    color: 'rgba(255,255,255,0.6)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {currentTrack.artist}
                </div>
              </>
            ) : (
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
                Not playing
              </div>
            )}
          </div>

          {/* Equalizer */}
          {currentTrack?.isPlaying && (
            <div style={{
              display: 'flex',
              gap: '3px',
              alignItems: 'flex-end',
              height: '20px',
              flexShrink: 0
            }}>
              {[0.6, 0.8, 0.5].map((duration, i) => (
                <div
                  key={i}
                  style={{
                    width: '3px',
                    backgroundColor: 'rgba(255,255,255,0.7)',
                    borderRadius: '999px',
                    animation: `equalizer ${duration}s ease-in-out infinite`,
                    animationDelay: `${i * 0.1}s`,
                    minHeight: '4px',
                    maxHeight: '16px'
                  }}
                />
              ))}
            </div>
          )}

          {/* Spotify Status */}
          {!isConnected && (
            <button
              onClick={connectSpotify}
              style={{
                padding: '8px 16px',
                backgroundColor: '#1DB954',
                color: '#fff',
                border: 'none',
                borderRadius: '999px',
                cursor: 'pointer',
                fontFamily: 'Nunito, sans-serif',
                fontWeight: 'bold',
                fontSize: '12px',
                transition: 'all 0.3s ease',
                flexShrink: 0
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = '#1ed760'}
              onMouseOut={(e) => e.target.style.backgroundColor = '#1DB954'}
            >
              Connect Spotify
            </button>
          )}
        </motion.div>

      {/* DEBUG TIMER - Remove when done testing */}
      <motion.div
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          padding: '16px 20px',
          backgroundColor: 'rgba(0,0,0,0.8)',
          border: '2px solid #00c6ff',
          borderRadius: '12px',
          fontSize: '12px',
          fontFamily: 'monospace',
          color: '#00c6ff',
          zIndex: 40,
          minWidth: '260px',
          boxShadow: '0 0 20px rgba(0, 198, 255, 0.3)',
          backdropFilter: 'blur(8px)'
        }}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div style={{ fontWeight: 'bold', marginBottom: '12px', color: '#00f0ff' }}>
          ⏱️ DEBUG INFO
        </div>
        
        {/* Spotify Connection Status */}
        <div style={{ marginBottom: '8px' }}>
          <span style={{ color: '#888' }}>Spotify:</span> {isConnected ? '✅ Connected' : '❌ Not Connected'}
        </div>

        {/* BPM */}
        <div style={{ marginBottom: '8px' }}>
          <span style={{ color: '#888' }}>BPM:</span> {bpm || 'Loading...'}
          {bpmError && <span style={{ color: '#ff6b6b' }}> (Error: {bpmError.substring(0, 20)})</span>}
        </div>

        {/* Song Progress */}
        <div style={{ marginBottom: '8px' }}>
          <span style={{ color: '#888' }}>Song:</span> {currentTrack?.name || 'Not Playing'}
        </div>

        <div style={{ marginBottom: '8px' }}>
          <span style={{ color: '#888' }}>Progress:</span> {currentTrack?.progressMs ? `${Math.round(currentTrack.progressMs)}ms` : 'N/A'}
        </div>

        {/* Beat Calculation */}
        {currentTrack?.progressMs && bpm ? (() => {
          const beatDurationMs = 60000 / bpm;
          const beatNumber = Math.floor(currentTrack.progressMs / beatDurationMs) + 1;
          const beatPosition = currentTrack.progressMs % beatDurationMs;
          const beatPercent = ((beatPosition / beatDurationMs) * 100).toFixed(1);
          
          // Expected beat
          let expectedBeat = '';
          if ((beatNumber - 2) % 4 === 0 && beatNumber >= 2) {
            expectedBeat = 'DOWN expected';
          } else if (beatNumber % 4 === 0) {
            expectedBeat = 'UP expected';
          } else {
            expectedBeat = 'transition';
          }

          return (
            <>
              <div style={{ marginBottom: '8px' }}>
                <span style={{ color: '#888' }}>Beat:</span> {beatNumber}
              </div>
              <div style={{ marginBottom: '8px' }}>
                <span style={{ color: '#888' }}>Pos:</span> {beatPercent}%
              </div>
              <div style={{ 
                padding: '8px 12px', 
                backgroundColor: 'rgba(0, 198, 255, 0.2)', 
                borderRadius: '6px',
                marginTop: '8px',
                textAlign: 'center',
                fontWeight: 'bold',
                color: '#00ff00'
              }}>
                {expectedBeat}
              </div>
            </>
          );
        })() : (
          <div style={{ color: '#ff6b6b', marginBottom: '8px' }}>
            ⚠️ Waiting for song data...
          </div>
        )}

        {/* State Info */}
        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(0, 198, 255, 0.3)' }}>
          <span style={{ color: '#888' }}>State:</span> {currentState}
        </div>

        {/* Reps and Score */}
        <div style={{ marginTop: '8px' }}>
          <span style={{ color: '#888' }}>Reps:</span> {repCount}
        </div>

        {/* Last Grade */}
        {lastGrade && (
          <div style={{ marginTop: '8px' }}>
            <span style={{ color: '#888' }}>Grade:</span> {lastGrade}
          </div>
        )}
      </motion.div>

      {/* Camera Selector - Top Left */}
      {availableCameras.length > 1 && (
        <motion.div
          style={{
            position: 'fixed',
            top: '20px',
            left: '20px',
            zIndex: 40,
          }}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <select
            value={selectedCameraId}
            onChange={(e) => switchCamera(e.target.value)}
            style={{
              padding: '10px 14px',
              backgroundColor: 'rgba(0,0,0,0.8)',
              color: '#fff',
              border: '2px solid rgba(255,255,255,0.2)',
              borderRadius: '8px',
              fontSize: '12px',
              fontFamily: 'Nunito, sans-serif',
              cursor: 'pointer',
              fontWeight: 'bold',
              transition: 'all 0.3s ease'
            }}
            onMouseOver={(e) => {
              e.target.style.borderColor = '#FF8DA1';
              e.target.style.backgroundColor = 'rgba(255, 141, 161, 0.1)';
            }}
            onMouseOut={(e) => {
              e.target.style.borderColor = 'rgba(255,255,255,0.2)';
              e.target.style.backgroundColor = 'rgba(0,0,0,0.8)';
            }}
          >
            {availableCameras.map((camera, idx) => (
              <option key={camera.deviceId} value={camera.deviceId}>
                📷 {camera.label || `Camera ${idx + 1}`}
              </option>
            ))}
          </select>
        </motion.div>
      )}

      <style>{`
        @keyframes equalizer {
          0%, 100% {
            height: 4px;
          }
          50% {
            height: 16px;
          }
        }

        @keyframes shimmer {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }
      `}</style>
    </motion.div>
  );
};

export default PushUp;
