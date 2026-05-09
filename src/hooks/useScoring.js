import { useEffect, useRef, useState } from 'react';

const GRADE_POINTS = {
  PERFECT: 500,
  GOOD: 300,
  OK: 200,
  MISS: 50,
};

// Detailed scoring breakdown
const COMPONENT_POINTS = {
  depth: {
    PERFECT: 200,  // Full chest-to-floor depth
    GOOD: 120,     // Good depth
    OK: 60,        // Partial depth
    MISS: 0,       // Too shallow
  },
  form: {
    PERFECT: 200,  // Perfect form with straight back and tucked elbows
    GOOD: 120,     // Good form with minor issues
    OK: 60,        // Acceptable form
    MISS: 0,       // Poor form
  },
  timing: {
    PERFECT: 100,  // Balanced timing with pauses
    GOOD: 60,      // Fairly balanced
    OK: 30,        // Somewhat unbalanced
    MISS: 0,       // Very unbalanced or skipped
  },
};

export const useScoring = (lastGrade, bpm, songProgressMs, pushupMetrics = {}, repCount = 0) => {
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [perfectStreak, setPerfectStreak] = useState(0);
  const [scoreBreakdown, setScoreBreakdown] = useState(null);
  const prevGradeRef = useRef(null);
  const prevRepCountRef = useRef(0);
  const setStartTimeRef = useRef(null);

  // Calculate beat duration in milliseconds
  const beatDurationMs = bpm ? 60000 / bpm : null;

  useEffect(() => {
    // Only process NEW reps (when repCount increases), not repeated grades
    if (!lastGrade || repCount === prevRepCountRef.current) {
      return;
    }

    // Mark this rep as processed
    prevRepCountRef.current = repCount;

    // Calculate component-based points if metrics available
    let basePoints = GRADE_POINTS[lastGrade] || 0;
    let breakdown = null;

    if (pushupMetrics && (pushupMetrics.depthGrade || pushupMetrics.formGrade)) {
      // Component-based scoring
      const depthPoints = COMPONENT_POINTS.depth[pushupMetrics.depthGrade] || 0;
      const formPoints = COMPONENT_POINTS.form[pushupMetrics.formGrade] || 0;
      const timingPoints = pushupMetrics.timingGrade 
        ? COMPONENT_POINTS.timing[pushupMetrics.timingGrade] 
        : 0;
      
      basePoints = depthPoints + formPoints + timingPoints;
      breakdown = {
        depth: { grade: pushupMetrics.depthGrade, points: depthPoints, value: pushupMetrics.depth },
        form: { grade: pushupMetrics.formGrade, points: formPoints },
        timing: { grade: pushupMetrics.timingGrade, points: timingPoints },
        downDuration: pushupMetrics.downDuration,
        upDuration: pushupMetrics.upDuration,
        bottomPause: pushupMetrics.bottomPause,
        topPause: pushupMetrics.topPause,
      };
    }

    if (lastGrade === 'MISS') {
      setCombo(0);
      setPerfectStreak(0);
      // Miss still adds a few points to keep session going
      setScore(prev => prev + (COMPONENT_POINTS.depth.MISS || 50));
      setScoreBreakdown({
        depth: { grade: 'MISS', points: 0 },
        form: { grade: 'MISS', points: 0 },
        timing: { grade: 'MISS', points: 0 },
        totalPoints: 50,
        multiplier: 1,
      });
      return;
    }

    if (!bpm || !beatDurationMs) {
      // Fallback to simpler scoring if BPM not available
      if (lastGrade === 'PERFECT') {
        const newPerfectStreak = perfectStreak + 1;
        const perfectMultiplier = 1 + newPerfectStreak * 0.2;
        const points = Math.floor(basePoints * perfectMultiplier);
        
        setScore(prev => prev + points);
        setCombo(combo + 1);
        setPerfectStreak(newPerfectStreak);
        setScoreBreakdown({
          ...breakdown,
          totalPoints: points,
          multiplier: perfectMultiplier,
          streakBonus: Math.floor(basePoints * (perfectMultiplier - 1)),
        });
      } else if (lastGrade === 'GOOD') {
        const newCombo = combo + 1;
        const comboMultiplier = 1 + (newCombo - 1) * 0.1;
        const points = Math.floor(basePoints * comboMultiplier);
        
        setScore(prev => prev + points);
        setCombo(newCombo);
        setPerfectStreak(0);
        setScoreBreakdown({
          ...breakdown,
          totalPoints: points,
          multiplier: comboMultiplier,
          comboBonus: Math.floor(basePoints * (comboMultiplier - 1)),
        });
      } else if (lastGrade === 'OK') {
        const points = Math.floor(basePoints * 0.75);
        setScore(prev => prev + points);
        setCombo(0);
        setPerfectStreak(0);
        setScoreBreakdown({
          ...breakdown,
          totalPoints: points,
          multiplier: 0.75,
        });
      }
      return;
    }

    // BPM-based scoring with component breakdown
    if (lastGrade === 'PERFECT') {
      const newPerfectStreak = perfectStreak + 1;
      const perfectMultiplier = 1 + newPerfectStreak * 0.2;
      const points = Math.floor(basePoints * perfectMultiplier);
      
      setScore(prev => prev + points);
      setCombo(combo + 1);
      setPerfectStreak(newPerfectStreak);
      setScoreBreakdown({
        ...breakdown,
        totalPoints: points,
        multiplier: perfectMultiplier,
        streakBonus: Math.floor(basePoints * (perfectMultiplier - 1)),
        perfectCount: newPerfectStreak,
      });
    } else if (lastGrade === 'GOOD') {
      const newCombo = combo + 1;
      const comboMultiplier = 1 + (newCombo - 1) * 0.1;
      const points = Math.floor(basePoints * comboMultiplier);
      
      setScore(prev => prev + points);
      setCombo(newCombo);
      setPerfectStreak(0);
      setScoreBreakdown({
        ...breakdown,
        totalPoints: points,
        multiplier: comboMultiplier,
        comboBonus: Math.floor(basePoints * (comboMultiplier - 1)),
      });
    } else if (lastGrade === 'OK') {
      const points = Math.floor(basePoints * 0.75);
      setScore(prev => prev + points);
      setCombo(0);
      setPerfectStreak(0);
      setScoreBreakdown({
        ...breakdown,
        totalPoints: points,
        multiplier: 0.75,
      });
    }
  }, [repCount, lastGrade, combo, perfectStreak, bpm, beatDurationMs, pushupMetrics]);

  return {
    score,
    combo,
    perfectStreak,
    scoreBreakdown,
    beatDurationMs,
  };
};
