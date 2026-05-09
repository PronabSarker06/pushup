# Pushup App Scoring System

## Overview
The scoring system evaluates pushups across three main dimensions: **Depth**, **Form**, and **Timing**. Each component contributes to an overall grade (PERFECT, GOOD, OK, MISS), which determines the points awarded.

---

## Scoring Components

### 1. **Depth Scoring** (Max 200 points)
Measures how deep the user goes during each pushup.

#### Grading Scale:
- **PERFECT (200 pts)**: Depth > 70%
  - Chest nearly touching the floor
  - Full range of motion through the entire descent
  
- **GOOD (120 pts)**: Depth 55-70%
  - Good depth, chest getting close to ground
  - Adequate range of motion
  
- **OK (60 pts)**: Depth 40-55%
  - Partial depth, moderate range of motion
  - Still counts as a valid rep
  
- **MISS (0 pts)**: Depth < 40%
  - Too shallow, insufficient range of motion

**How it's tracked:**
- Hand Y-position is monitored from top (STATE_UP) to bottom (STATE_DOWN)
- Depth is calculated as: `maxDepthY - minDepthY` (normalized 0-1)
- Tracked in real-time during each rep

---

### 2. **Form Scoring** (Max 200 points)
Evaluates proper pushup form including back alignment and elbow positioning.

#### Grading Scale:
- **PERFECT (200 pts)**: Back > 165°, Elbow < 95°, No elbow flare
  - Perfectly straight back
  - Elbows tucked close to body
  - Minimal movement outside body plane
  
- **GOOD (120 pts)**: Back > 160°, Elbow < 110°, No elbow flare
  - Mostly straight back
  - Acceptable elbow positioning
  
- **OK (60 pts)**: Back > 150°, Elbow < 120°
  - Acceptable form with minor issues
  - Some back deviation or elbow angle
  
- **MISS (0 pts)**: Fails above criteria
  - Poor form invalidates the rep

**How it's tracked:**
- Back straightness: Calculated from shoulder-to-hip alignment
  - Checks if spine line maintains near-vertical orientation
  - Detects forward/backward lean
  
- Elbow angle: Calculated at WRIST→ELBOW→SHOULDER angle
  - Uses inverse kinematics to determine elbow bend
  - Triggers perfect form at bottom of motion
  
- Elbow flare: Calculated as horizontal distance from shoulder
  - Flare detected when `|elbowX - shoulderX| > 0.3`

---

### 3. **Timing Scoring** (Max 100 points)
Ensures controlled, balanced pushup movement with proper pauses.

#### Grading Scale:
- **PERFECT (100 pts)**: Time balance > 90%, Bottom & Top pauses detected
  - Equal time going down and up (±10%)
  - Clear pause at bottom (≥50ms)
  - Clear pause at top (≥50ms)
  
- **GOOD (60 pts)**: Time balance 80-90%, At least one pause detected
  - Fairly balanced up/down timing
  - At least one pause present
  
- **OK (30 pts)**: Time balance 70-80%
  - Somewhat unbalanced timing
  - Still acceptable form
  
- **MISS (0 pts)**: Time balance < 70% or very unbalanced
  - Explosive/ballistic movement
  - No control at bottom or top

**How it's tracked:**
- Phase durations:
  - `downDuration`: Time from STATE_UP to STATE_DOWN (elbow bend phase)
  - `upDuration`: Time from STATE_DOWN to STATE_UP (elbow extension phase)
  - `bottomPause`: Time elbow stays below threshold before pressing up
  - `topPause`: Time elbow stays extended before next rep
  
- Time balance ratio: `min(downDur, upDur) / max(downDur, upDur)`
  - 1.0 = perfect balance
  - 0.7 = acceptable (≥30% difference)

---

## Overall Grade Calculation

The final rep grade combines all three components using weighted scoring:

### Weighting:
- **Depth**: 1.5x weight (mandatory)
- **Form**: 1.5x weight (mandatory)  
- **Timing**: 1.0x weight (bonus)

### Grade Determination:
```
Average Score = (Depth×1.5 + Form×1.5 + Timing×1.0) / 4.0
```

- **PERFECT**: Average ≥ 2.5 (all three PERFECT or strong scores)
- **GOOD**: Average ≥ 1.7 (mostly good scores)
- **OK**: Average ≥ 0.8 (acceptable mixed scores)
- **MISS**: Average < 0.8 or critical component failed

### Failure Conditions:
- A rep is MISS if Depth = MISS OR Form = MISS (either is critical)
- Timing doesn't cause failure alone, only reduces score

---

## Points Awarded

### Base Points by Overall Grade:
| Grade | Base Points | Purpose |
|-------|------------|---------|
| PERFECT | 500 | Excellent form, depth, and timing |
| GOOD | 300 | Good form and depth, acceptable timing |
| OK | 200 | Acceptable performance |
| MISS | 50 | Rep counts but minimal points |

### Multipliers Applied:

#### Perfect Streak Bonus:
```
Multiplier = 1 + (perfectCount × 0.2)
- 1st PERFECT: 1.2x (600 pts)
- 2nd PERFECT: 1.4x (700 pts)
- 3rd PERFECT: 1.6x (800 pts)
- Caps at 2.0x at 5+ streak
```
*Broken by any non-PERFECT grade*

#### Combo Multiplier (for GOOD grades):
```
Multiplier = 1 + ((comboCount - 1) × 0.1)
- 1st GOOD in combo: 1.0x (300 pts)
- 2nd GOOD in combo: 1.1x (330 pts)
- 3rd GOOD in combo: 1.2x (360 pts)
```
*Broken by miss or OK grade*

#### OK Grade Multiplier:
```
Points = basePoints × 0.75 = 150 pts
Breaks both combo and perfect streak
```

---

## Real-Time Feedback

### Visual Feedback (UI):
The app displays a live breakdown after each rep:

```
┌─ LAST REP BREAKDOWN ─┐
│ DEPTH    │ FORM     │ TIMING   │
│ PERFECT  │ GOOD     │ PERFECT  │
│ 85%      │ +120     │ +100     │
├──────────────────────┤
│ PHASE TIMING         │
│ ↓ Down: 800ms        │
│ ↑ Up: 750ms          │
│ ⏸ Bottom: 120ms      │
│ ⏸ Top: 150ms         │
└──────────────────────┘
```

### Grades Displayed:
- Each component shows its individual grade
- Points contribution from each component shown
- Phase timing details help users understand what to improve

---

## Implementation Files

### Core Scoring Logic:

1. **[usePushupCounter.js](src/hooks/usePushupCounter.js)**
   - Tracks rep state machine (UP ↔ DOWN)
   - Monitors hand position and depth
   - Calculates elbow/form angles
   - Measures timing phase durations
   - Calls `gradeRep()` with all metrics

2. **[useScoring.js](src/hooks/useScoring.js)**
   - Converts grades to points
   - Applies combo/perfect streak multipliers
   - Maintains running score and combo counter
   - Generates detailed score breakdown

3. **[PushUp.jsx](src/PushUp.jsx)**
   - Displays all metrics in real-time
   - Shows breakdown cards for each component
   - Tracks perfect/good/ok/miss accuracy counts
   - Animates score updates and personal bests

---

## Calibration Guidelines

### For Webcam Setup:
- Ensure full body is visible in frame
- Good lighting helps pose detection
- Position camera at chest height, ~3-4 feet away

### Depth Adjustment:
- Default: 70% for PERFECT (requires significant depth)
- Too strict? Lower to 60%+
- Too lenient? Raise to 80%+

### Form Strictness:
- Default thresholds work for most users
- Adjust elbow flare threshold (0.3) if needed
- Back angle thresholds can be tweaked based on user capability

### Timing Expectations:
- Default: Equal time up/down for 90%+ accuracy
- Explosive movers: Lower threshold to 80%+
- Controlled lifters: Expect 90%+ naturally

---

## Tips for Perfect Scores

1. **Depth**: Go ALL the way down each time
   - Chest almost touches ground
   - Pause briefly at bottom

2. **Form**: 
   - Keep back straight (no sag or arch)
   - Keep elbows close (not flared out)
   - Maintain neutral head position

3. **Timing**:
   - Take same time going down as going up
   - Hold 50-100ms at bottom
   - Hold 50-100ms at top before next rep

---

## Future Enhancements

- [ ] Hand position tracking (shoulder width, not too wide/narrow)
- [ ] Hip sag detection (lower back not sagging)
- [ ] ROM tracking over time (progressive improvement metrics)
- [ ] Video playback with form annotations
- [ ] Difficulty levels with different criteria
- [ ] Audio feedback (beep at bottom/top for timing)
