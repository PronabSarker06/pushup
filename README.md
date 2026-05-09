# PushUp! 💪

A real-time pushup form analyzer that uses computer vision to detect your form, count reps, and score your performance. Get instant feedback on depth, form, and timing with seamless Spotify integration for music-driven motivation.

## Features

### 🎥 Real-Time Pose Detection
- **MediaPipe PoseLandmarker** provides 33-point pose estimation from your webcam
- Live skeleton visualization overlaid on your video feed
- 30+ FPS processing for responsive feedback
- Multi-camera support—switch between multiple camera sources

### 📊 Intelligent Scoring System
The app scores each pushup based on three key metrics:

**1. Depth** (How deep you go)
- Measures hand position from top to bottom of each rep
- **PERFECT**: >50% depth (chest near floor)
- **GOOD**: >35% depth
- **OK**: >20% depth
- **MISS**: <20% depth

**2. Form** (Quality of movement)
- **Back Straightness**: Spine alignment angle must be >150° for PERFECT form
- **Elbow Angle**: Should reach <110° at bottom for PERFECT form
- **Elbow Flare**: Prevents elbows from spreading too wide (>0.4 width = flawed form)
- Combines all factors into a comprehensive form score

**3. Timing** (Tempo consistency)
- **Down Duration**: Time spent lowering your body
- **Up Duration**: Time spent pressing back up
- **Bottom Pause**: Rest time at lowest point
- **Top Pause**: Rest time at full extension
- **Balance Ratio**: Min(down, up) / Max(down, up) should be >0.75 for PERFECT timing
- Requires Spotify connection for BPM-based grading

### 🎵 Spotify Integration
- Connect your Spotify account to sync current song BPM
- Timing scores align with your song's tempo for music-driven form
- See now-playing track, progress, and beat synchronization
- Visual equalizer animation for immersive workout experience

### 🎯 Real-Time Feedback
- **Rep Counter**: Tracks completed pushups with validation
- **Score Display**: Accumulating total with visual animations
- **Combo Multiplier**: 1.1x-1.3x points for consecutive good/perfect reps
- **Perfect Streak**: 1.2x-2.0x multiplier for chains of PERFECT reps
- **PB Flame**: Blue fire indicator when you hit a new personal best
- **Breakdown Card**: Detailed metrics for each rep (depth %, form quality, timing details)
- **Real-Time Timing Indicator**: On-canvas display showing current rep's down/up duration

### 🔧 Camera Management
- **Multi-Camera Support**: Enumerate and switch between available cameras
- **Error Handling**: User-friendly messages for permission denied, camera in use, device not found
- **Fallback Logic**: Automatic fallback to generic facingMode if specific device ID fails
- **Diagnostics**: Detailed error information for troubleshooting

## Getting Started

### Prerequisites
- Node.js (v14+)
- npm or yarn
- Modern web browser with camera access
- Spotify account (optional, for timing features)

### Installation

```bash
# Clone the repository
git clone https://github.com/PronabSarker06/pushup.git
cd pushup

# Install dependencies
npm install

# Start the development server
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser. Grant camera permissions when prompted.

### Build for Production

```bash
npm run build
```

Builds the app for production to the `build` folder.

## How to Use

1. **Grant Camera Access**: Allow the app to access your webcam
2. **Select Camera** (optional): Choose a different camera from the dropdown if you have multiple devices
3. **Connect Spotify** (optional): Click Spotify Connect for music-synced timing scores
4. **Start Moving**: Position yourself in frame and begin pushups
5. **Watch Feedback**: See rep count, score, grade, and detailed metrics update in real-time

## Scoring Breakdown

Each pushup is graded on a scale:
- **PERFECT** (500 pts) ✨
- **GOOD** (300 pts) ✅
- **OK** (200 pts) ⚠️
- **MISS** (50 pts) ❌

Bonus multipliers apply for:
- **Perfect Streak**: 1.2x–2.0x for consecutive perfects
- **Combo**: 1.1x–1.3x for consecutive good/perfect reps

## Technical Stack

- **React 18** with Hooks for component state and side effects
- **MediaPipe** for pose detection (pose_landmarker_lite.task)
- **Framer Motion** for smooth UI animations and transitions
- **Spotify Web API** for track and BPM data
- **WebRTC / getUserMedia API** for camera access
- **HTML5 Canvas** for pose visualization

## Project Structure

```
src/
├── hooks/
│   ├── usePoseDetection.js        # Pose detection & camera management
│   ├── usePushupCounter.js        # Rep counting & rep grading logic
│   ├── useScoring.js              # Score calculation & multipliers
│   ├── useSpotifyAuth.js          # Spotify authentication
│   ├── useSpotifyNowPlaying.js    # Current track data
│   └── useSpotifyAudioFeatures.js # BPM retrieval
├── PushUp.jsx                     # Main UI component
├── App.js                         # Root component with animations
└── index.js                       # React entry point
```

## Troubleshooting

**No camera showing up?**
- Ensure you've granted browser permission
- Try selecting a different camera from the dropdown
- Check that another application isn't using the camera

**Score stuck at 0?**
- Perform clear, full-range pushups (go deeper!)
- Ensure your form meets minimum requirements
- Check the breakdown card for which metric is failing

**Timing always shows MISS?**
- Connect your Spotify account for BPM-based grading
- Or ensure your up/down times are balanced

## License

MIT

## Contributing

Contributions welcome! Feel free to submit issues and pull requests.

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
