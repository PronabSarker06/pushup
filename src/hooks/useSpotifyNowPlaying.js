import { useEffect, useState } from 'react';

export const useSpotifyNowPlaying = (accessToken) => {
  const [currentTrack, setCurrentTrack] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!accessToken) return;

    const fetchCurrentTrack = async () => {
      try {
        const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });

        if (response.status === 204 || response.status === 200) {
          // 204 = no content playing
          if (response.status === 204) {
            setCurrentTrack(null);
            return;
          }

          const data = await response.json();
          
          if (data.item) {
            setCurrentTrack({
              name: data.item.name,
              artist: data.item.artists[0]?.name || 'Unknown Artist',
              album: data.item.album?.name || 'Unknown Album',
              imageUrl: data.item.album?.images[0]?.url || null,
              isPlaying: data.is_playing,
              progressMs: data.progress_ms,
              durationMs: data.item.duration_ms,
              url: data.item.external_urls?.spotify || null
            });
            setError(null);
          } else {
            setCurrentTrack(null);
          }
        } else if (response.status === 401) {
          // Token expired
          setError('Spotify token expired. Please reconnect.');
          localStorage.removeItem('spotifyToken');
          localStorage.removeItem('spotifyTokenExpiry');
        } else {
          setError('Failed to fetch current track');
        }
      } catch (err) {
        console.error('Error fetching current track:', err);
        setError('Error fetching track');
      }
    };

    // Fetch immediately
    fetchCurrentTrack();

    // Poll every 3 seconds while playing, every 10 seconds when paused
    const interval = setInterval(fetchCurrentTrack, currentTrack?.isPlaying ? 3000 : 10000);
    return () => clearInterval(interval);
  }, [accessToken, currentTrack?.isPlaying]);

  return { currentTrack, error };
};
