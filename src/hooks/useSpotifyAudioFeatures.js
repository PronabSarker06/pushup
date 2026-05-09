import { useEffect, useState } from 'react';

export const useSpotifyAudioFeatures = (accessToken, currentTrack) => {
  const [bpm, setBpm] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!accessToken || !currentTrack) {
      console.log('useSpotifyAudioFeatures: Missing accessToken or currentTrack', { 
        hasToken: !!accessToken, 
        hasTrack: !!currentTrack,
        currentTrack 
      });
      return;
    }

    const fetchAudioFeatures = async () => {
      try {
        // Get track ID from the current track
        // We need to fetch currently playing to get the track ID
        console.log('Fetching currently playing track...');
        const playerResponse = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });

        console.log('Player response status:', playerResponse.status);

        if (playerResponse.status === 200) {
          const playerData = await playerResponse.json();
          console.log('Player data:', playerData);
          
          if (playerData.item?.id) {
            const trackId = playerData.item.id;
            console.log('Track ID:', trackId);
            
            // Fetch audio features using the track ID
            console.log('Fetching audio features for track:', trackId);
            const featuresResponse = await fetch(
              `https://api.spotify.com/v1/audio-features/${trackId}`,
              {
                headers: {
                  'Authorization': `Bearer ${accessToken}`
                }
              }
            );

            console.log('Features response status:', featuresResponse.status);

            if (featuresResponse.status === 200) {
              const features = await featuresResponse.json();
              console.log('Audio features:', features);
              setBpm(Math.round(features.tempo));
              setError(null);
            } else {
              const errorData = await featuresResponse.json();
              console.error('Failed to fetch audio features:', errorData);
              setError(`Failed to fetch audio features: ${featuresResponse.status}`);
            }
          } else {
            console.warn('No track item in player data');
            setError('No track currently playing');
          }
        } else if (playerResponse.status === 401) {
          console.error('Spotify token expired');
          setError('Spotify token expired');
        } else if (playerResponse.status === 204) {
          console.warn('No currently playing track');
          setError('No track playing');
        } else {
          const errorData = await playerResponse.json();
          console.error('Player response error:', errorData);
          setError(`Player error: ${playerResponse.status}`);
        }
      } catch (err) {
        console.error('Error fetching audio features:', err);
        setError('Error fetching BPM: ' + err.message);
      }
    };

    // Fetch BPM when track changes
    fetchAudioFeatures();
  }, [accessToken, currentTrack]); // Re-fetch when track changes

  return { bpm, error };
};
