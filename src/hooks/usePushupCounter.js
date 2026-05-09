import { useCallback, useEffect, useRef, useState } from 'react';

const STATE_UP = 'up';
const STATE_DOWN = 'down';

// Landmark indices
const SHOULDER_LEFT = 11;
const SHOULDER_RIGHT = 12;
const ELBOW_LEFT = 13;
const ELBOW_RIGHT = 14;
const WRIST_LEFT = 15;
const WRIST_RIGHT = 16;
const HIP_LEFT = 23;
const HIP_RIGHT = 24;

export const usePushupCounter = (landmarks, bpm, songProgressMs) => {
  const [repCount, setRepCount] = useState(0);
  const [currentState, setCurrentState] = useState(STATE_UP);
  const [lastGrade, setLastGrade] = useState(null);
  const [elbowAngles, setElbowAngles] = useState({ left: 0, right: 0, average: 0 });
  const [backAngle, setBackAngle] = useState(0);
  const [pushupMetrics, setPushupMetrics] = useState({
    depth: 0,           // 0-100, how deep (100 = chest to floor)
    depthScore: 0,      // Grade for depth
    formScore: 0,       // Grade for form
    timingScore: 0,     // Grade for timing
    overallGrade: null, // PERFECT, GOOD, OK, MISS
    downDuration: 0,    // Time spent going down (ms)
    upDuration: 0,      // Time spent going up (ms)
    bottomPause: 0,     // Time paused at bottom (ms)
    topPause: 0,        // Time paused at top (ms)
  });
  
  const lastRepTimeRef = useRef(0);
  const repCooldownRef = useRef(300); // 300ms cooldown
  const hasCountedThisDownRef = useRef(false);
  const handPositionHistoryRef = useRef([]);
  const maxHandMovementRef = useRef(0);
  const handsVisibleRef = useRef(true);
  const initialHandPosRef = useRef(null);
  const stateChangeProgressRef = useRef(null); // Track song progress when state changed (not timestamp)
  
  // Tracking for depth
  const maxDepthYRef = useRef(null);      // Lowest hand Y position during rep
  const minDepthYRef = useRef(null);      // Highest hand Y position at top
  
  // Tracking for timing phases
  const phaseStartTimeRef = useRef(null);
  const downStartTimeRef = useRef(null);
  const upStartTimeRef = useRef(null);
  const upDurationRef = useRef(0);  // Store calculated UP duration
  const bottomPauseStartRef = useRef(null);
  const topPauseStartRef = useRef(null);

  const calculateAngle = useCallback((a, b, c) => {
    // Calculate angle at point b formed by vector from b to a and b to c
    if (!a || !b || !c) return 0;

    const ax = a.x - b.x;
    const ay = a.y - b.y;
    const cx = c.x - b.x;
    const cy = c.y - b.y;

    const dotProduct = ax * cx + ay * cy;
    const magA = Math.sqrt(ax * ax + ay * ay);
    const magC = Math.sqrt(cx * cx + cy * cy);

    if (magA === 0 || magC === 0) return 0;

    const cosAngle = dotProduct / (magA * magC);
    const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle))) * (180 / Math.PI);

    return angle;
  }, []);

  const calculateBackStraightness = useCallback(() => {
    if (!landmarks) return 0;

    const shoulderLeft = landmarks[SHOULDER_LEFT];
    const shoulderRight = landmarks[SHOULDER_RIGHT];
    const hipLeft = landmarks[HIP_LEFT];
    const hipRight = landmarks[HIP_RIGHT];

    if (!shoulderLeft || !shoulderRight || !hipLeft || !hipRight) return 0;

    // Calculate the angle of the spine (shoulder-to-hip alignment)
    const shoulderMidX = (shoulderLeft.x + shoulderRight.x) / 2;
    const shoulderMidY = (shoulderLeft.y + shoulderRight.y) / 2;
    const hipMidX = (hipLeft.x + hipRight.x) / 2;
    const hipMidY = (hipLeft.y + hipRight.y) / 2;

    const dX = hipMidX - shoulderMidX;
    const dY = hipMidY - shoulderMidY;

    // Calculate angle from vertical (90 degrees = perfectly straight)
    const angleFromVertical = Math.atan2(dX, dY) * (180 / Math.PI);
    const angleFromStraight = Math.abs(angleFromVertical);

    return 180 - angleFromStraight;
  }, [landmarks]);

  // Calculate depth score (0-100) based on hand descent
  const calculateDepthScore = useCallback((depth) => {
    // depth is 0-1 scale where 0 = fully extended, 1 = chest to floor
    // Adjusted thresholds for realistic camera-based pushups:
    // Perfect: depth > 0.5 (50% of full range)
    // Good: depth > 0.35 (35% of full range)
    // OK: depth > 0.2 (20% of full range)
    // Miss: depth < 0.2 (too shallow)
    
    if (depth > 0.5) return 'PERFECT';  // Full depth
    if (depth > 0.35) return 'GOOD';    // Good depth
    if (depth > 0.2) return 'OK';       // Partial depth
    return 'MISS';                      // Too shallow
  }, []);

  // Calculate form score based on elbow angle and back straightness
  const calculateFormScore = useCallback((avgElbow, back, lms) => {
    if (!lms) return 'MISS';
    
    const shoulderLeft = lms[SHOULDER_LEFT];
    const elbowLeft = lms[ELBOW_LEFT];
    const shoulderRight = lms[SHOULDER_RIGHT];
    const elbowRight = lms[ELBOW_RIGHT];

    // Check for elbow flare (elbows too far from shoulders)
    let hasFlare = false;
    if (shoulderLeft && elbowLeft && shoulderRight && elbowRight) {
      const leftFlare = Math.abs(elbowLeft.x - shoulderLeft.x) > 0.4;  // More lenient: 0.4 instead of 0.3
      const rightFlare = Math.abs(elbowRight.x - shoulderRight.x) > 0.4;
      hasFlare = leftFlare || rightFlare;
    }

    // Relaxed thresholds for more forgiving scoring
    // Perfect form: straight back, elbows tucked, proper angle at bottom
    if (back > 150 && avgElbow < 110 && !hasFlare) return 'PERFECT';
    // Good form: mostly straight, some elbow flare ok
    if (back > 140 && avgElbow < 130 && !hasFlare) return 'GOOD';
    // OK form: acceptable form with minor issues
    if (back > 120 && avgElbow < 150) return 'OK';
    return 'MISS';
  }, []);

  // Calculate timing score based on phase durations
  const calculateTimingScore = useCallback((downDur, upDur, bottomPause, topPause) => {
    if (!downDur || !upDur) return null; // Can't grade if no timing data
    
    // Calculate balance ratio: ideally down time ≈ up time
    const timeBalance = Math.min(downDur, upDur) / Math.max(downDur, upDur);
    
    // Check for pauses: should have brief pauses at top and bottom (more lenient)
    const hasBottomPause = bottomPause > 30;  // At least 30ms (down from 50ms)
    const hasTopPause = topPause > 30;
    
    // More forgiving timing requirements
    if (timeBalance > 0.75 && (hasBottomPause || hasTopPause)) return 'PERFECT';  // 75% balance instead of 90%
    if (timeBalance > 0.6 && (hasBottomPause || hasTopPause)) return 'GOOD';      // 60% balance instead of 80%
    if (timeBalance > 0.5) return 'OK';                                            // 50% balance instead of 70%
    return 'MISS';
  }, []);

  // Combine all scores into an overall grade
  const combineScores = useCallback((depthGrade, formGrade, timingGrade) => {
    // All three must be MISS to fail overall
    if (depthGrade === 'MISS' || formGrade === 'MISS') {
      return 'MISS';
    }
    
    // Grading scale
    const gradeWeight = {
      'PERFECT': 3,
      'GOOD': 2,
      'OK': 1,
      'MISS': 0,
    };
    
    // Calculate weighted score
    let totalWeight = 0;
    let weightedPoints = 0;
    
    // Depth and form are mandatory
    if (depthGrade) {
      weightedPoints += gradeWeight[depthGrade] * 1.5; // Higher weight for depth
      totalWeight += 1.5;
    }
    if (formGrade) {
      weightedPoints += gradeWeight[formGrade] * 1.5;
      totalWeight += 1.5;
    }
    // Timing is nice-to-have
    if (timingGrade) {
      weightedPoints += gradeWeight[timingGrade] * 1.0;
      totalWeight += 1.0;
    }
    
    const avgScore = weightedPoints / totalWeight;
    
    if (avgScore >= 2.5) return 'PERFECT';
    if (avgScore >= 1.7) return 'GOOD';
    if (avgScore >= 0.8) return 'OK';
    return 'MISS';
  }, []);

  const gradeRep = useCallback((avgElbow, back, lms, depth, downDur, upDur, bottomPause, topPause) => {
    const depthGrade = calculateDepthScore(depth);
    const formGrade = calculateFormScore(avgElbow, back, lms);
    const timingGrade = calculateTimingScore(downDur, upDur, bottomPause, topPause);
    const overallGrade = combineScores(depthGrade, formGrade, timingGrade);
    
    return {
      depth: Math.round(depth * 100),
      depthGrade,
      formGrade,
      timingGrade,
      overallGrade,
      downDuration: downDur || 0,
      upDuration: upDur || 0,
      bottomPause: bottomPause || 0,
      topPause: topPause || 0,
    };
  }, [calculateDepthScore, calculateFormScore, calculateTimingScore, combineScores]);

  // Grade based on BPM timing
  const gradeByTiming = useCallback((stateChangeProgressMs, isGoingDown) => {
    if (!bpm || stateChangeProgressMs === null || stateChangeProgressMs === undefined) {
      // Fallback to form-based grading if no BPM
      return null;
    }

    const beatDurationMs = 60000 / bpm;
    
    // Calculate which beat we're on (beat 1 = 0-beatDurationMs, beat 2 = beatDurationMs-2*beatDurationMs, etc.)
    const beatNumber = Math.floor(stateChangeProgressMs / beatDurationMs) + 1;
    const beatPosition = stateChangeProgressMs % beatDurationMs; // Position within current beat (0 to beatDurationMs)
    
    // Expected windows: ±10% of beat duration for PERFECT
    const expectedWindowWidth = beatDurationMs * 0.1; // ±10%
    
    // Ideal position is at the START of the beat (position = 0)
    const deviationFromBeatStart = Math.min(beatPosition, beatDurationMs - beatPosition);
    
    // Check if we're hitting the right beat
    let isRightBeat = false;
    if (isGoingDown) {
      // DOWN should happen on beats 2, 6, 10, 14... (beats where (beatNumber - 2) % 4 === 0)
      isRightBeat = (beatNumber - 2) % 4 === 0 && beatNumber >= 2;
    } else {
      // UP should happen on beats 4, 8, 12, 16... (beats where beatNumber % 4 === 0)
      isRightBeat = beatNumber % 4 === 0;
    }
    
    if (!isRightBeat) {
      return 'MISS';
    }
    
    // Grade based on timing deviation
    const perfectWindow = expectedWindowWidth; // ±10%
    const goodWindow = expectedWindowWidth * 1.5; // ±15%
    const okWindow = expectedWindowWidth * 1.875; // ±18.75%
    
    if (deviationFromBeatStart <= perfectWindow) return 'PERFECT';
    if (deviationFromBeatStart <= goodWindow) return 'GOOD';
    if (deviationFromBeatStart <= okWindow) return 'OK';
    return 'MISS';
  }, [bpm]);

  useEffect(() => {
    if (!landmarks) return;

    // Calculate hand positions and movement
    const leftWrist = landmarks[WRIST_LEFT];
    const rightWrist = landmarks[WRIST_RIGHT];
    
    // Check if hands are visible with good confidence AND within frame bounds
    const leftInBounds = (leftWrist?.x || 0) > 0 && (leftWrist?.x || 0) < 1 && 
                        (leftWrist?.y || 0) > 0 && (leftWrist?.y || 0) < 1;
    const rightInBounds = (rightWrist?.x || 0) > 0 && (rightWrist?.x || 0) < 1 && 
                         (rightWrist?.y || 0) > 0 && (rightWrist?.y || 0) < 1;
    const handsVisible = (leftWrist?.visibility || 0) > 0.5 && (rightWrist?.visibility || 0) > 0.5 &&
                        leftInBounds && rightInBounds;
    
    // If hands go off screen or visibility drops during a rep, invalidate the rep
    if (!handsVisible) {
      handsVisibleRef.current = false;
    }
    
    // Add current hand positions to history
    const currentHandPos = {
      leftX: leftWrist?.x || 0,
      leftY: leftWrist?.y || 0,
      rightX: rightWrist?.x || 0,
      rightY: rightWrist?.y || 0,
      timestamp: Date.now(),
    };
    
    handPositionHistoryRef.current.push(currentHandPos);
    
    // Keep only last 30 frames worth of history
    if (handPositionHistoryRef.current.length > 30) {
      handPositionHistoryRef.current.shift();
    }
    
    // Calculate hand movement in current frame
    if (handPositionHistoryRef.current.length > 1 && handsVisible) {
      const prevPos = handPositionHistoryRef.current[handPositionHistoryRef.current.length - 2];
      const dx = currentHandPos.leftX - prevPos.leftX;
      const dy = currentHandPos.leftY - prevPos.leftY;
      const movement = Math.sqrt(dx * dx + dy * dy);
      
      // Track max movement during current cycle
      maxHandMovementRef.current = Math.max(maxHandMovementRef.current, movement);
    }

    // Track depth: average Y position of both wrists
    const avgHandY = (leftWrist?.y + rightWrist?.y) / 2;
    
    // Initialize min/max depth on state entry to DOWN
    if (currentState === STATE_DOWN) {
      if (minDepthYRef.current === null) {
        minDepthYRef.current = avgHandY; // Highest point (lowest Y value) at start of DOWN
      }
      if (maxDepthYRef.current === null) {
        maxDepthYRef.current = avgHandY;
      } else {
        maxDepthYRef.current = Math.max(maxDepthYRef.current, avgHandY); // Track lowest point (highest Y value)
      }
    }

    // Calculate elbow angles
    const leftElbowAngle = calculateAngle(
      landmarks[SHOULDER_LEFT],
      landmarks[ELBOW_LEFT],
      landmarks[WRIST_LEFT]
    );
    const rightElbowAngle = calculateAngle(
      landmarks[SHOULDER_RIGHT],
      landmarks[ELBOW_RIGHT],
      landmarks[WRIST_RIGHT]
    );
    const avgElbow = (leftElbowAngle + rightElbowAngle) / 2;

    setElbowAngles({
      left: leftElbowAngle,
      right: rightElbowAngle,
      average: avgElbow,
    });

    // Calculate back straightness
    const back = calculateBackStraightness();
    setBackAngle(back);

    // State machine logic with hysteresis
    const now = Date.now();
    const canCountRep = now - lastRepTimeRef.current > repCooldownRef.current;

    setCurrentState(prevState => {
      let newState = prevState;
      
      // Hysteresis: different thresholds for UP and DOWN to prevent jitter
      if (prevState === STATE_UP && avgElbow < 90) {
        // Entering DOWN state
        if (handsVisible) {
          newState = STATE_DOWN;
          stateChangeProgressRef.current = songProgressMs;
          hasCountedThisDownRef.current = false;
          maxHandMovementRef.current = 0;
          handsVisibleRef.current = true;
          initialHandPosRef.current = {
            leftX: leftWrist?.x || 0,
            leftY: leftWrist?.y || 0,
            rightX: rightWrist?.x || 0,
            rightY: rightWrist?.y || 0,
          };
          downStartTimeRef.current = now;
          // Reset depth refs for new rep
          minDepthYRef.current = null;
          maxDepthYRef.current = null;
          topPauseStartRef.current = null;
        }
      } else if (prevState === STATE_DOWN && avgElbow > 150) {
        // Exiting DOWN state (pushing up)
        // Check if hands moved too far from initial position
        let handsDriftedTooMuch = false;
        if (initialHandPosRef.current && handsVisible) {
          const driftLeft = Math.sqrt(
            Math.pow(leftWrist.x - initialHandPosRef.current.leftX, 2) +
            Math.pow(leftWrist.y - initialHandPosRef.current.leftY, 2)
          );
          const driftRight = Math.sqrt(
            Math.pow(rightWrist.x - initialHandPosRef.current.rightX, 2) +
            Math.pow(rightWrist.y - initialHandPosRef.current.rightY, 2)
          );
          handsDriftedTooMuch = driftLeft > 0.08 || driftRight > 0.08;
        }
        
        // Only count if all conditions met
        const isStationary = maxHandMovementRef.current < 0.08;
        const handsStayedVisible = handsVisibleRef.current && handsVisible && !handsDriftedTooMuch;
        
        if (!hasCountedThisDownRef.current && canCountRep && isStationary && handsStayedVisible) {
          // Calculate metrics for this rep
          const depth = maxDepthYRef.current !== null && minDepthYRef.current !== null
            ? Math.max(0, Math.min(1, maxDepthYRef.current - minDepthYRef.current))
            : 0;
          
          const downDuration = downStartTimeRef.current ? now - downStartTimeRef.current : 0;  // Time spent in DOWN state (going up)
          const upDuration = 0;  // Measured only in next cycle when entering DOWN
          const bottomPause = bottomPauseStartRef.current ? downStartTimeRef.current - bottomPauseStartRef.current : 0;
          const topPause = topPauseStartRef.current ? now - topPauseStartRef.current : 0;
          
          // Grade the rep
          const repMetrics = gradeRep(
            avgElbow,
            back,
            landmarks,
            depth,
            downDuration,
            upDuration,
            bottomPause,
            topPause
          );
          
          setPushupMetrics(repMetrics);
          setRepCount(prev => prev + 1);
          setLastGrade(repMetrics.overallGrade);
          lastRepTimeRef.current = now;
          hasCountedThisDownRef.current = true;
          upDurationRef.current = 0;  // Reset for next rep
        }
        
        newState = STATE_UP;
        upStartTimeRef.current = now;
        maxHandMovementRef.current = 0;
        stateChangeProgressRef.current = null;
        initialHandPosRef.current = null;
        bottomPauseStartRef.current = now;
        // Reset depth tracking for next rep
        minDepthYRef.current = null;
        maxDepthYRef.current = null;
      }
      
      return newState;
    });
  }, [landmarks, songProgressMs, gradeByTiming, calculateAngle, calculateBackStraightness, gradeRep, currentState]);

  return {
    repCount,
    currentState,
    lastGrade,
    elbowAngles,
    backAngle,
    pushupMetrics,
  };
};
