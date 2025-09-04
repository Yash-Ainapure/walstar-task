import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

const BlinkingCircle = ({ isTracking }) => {
  // Use useRef for the animated value to prevent it from resetting on re-renders
  const opacityAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Define the blinking animation
    const blinkingAnimation = Animated.loop(
      Animated.sequence([
        // Fade out to 20% opacity
        Animated.timing(opacityAnim, {
          toValue: 0.2,
          duration: 700, // Duration of the fade out
          useNativeDriver: true,
        }),
        // Fade back in to full opacity
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 700, // Duration of the fade in
          useNativeDriver: true,
        }),
      ])
    );

    if (isTracking) {
      // If tracking is active, start the animation
      blinkingAnimation.start();
    } else {
      // If tracking is stopped, stop the animation and reset opacity to full
      blinkingAnimation.stop();
      opacityAnim.setValue(1);
    }

    // Cleanup function to stop the animation when the component unmounts
    return () => blinkingAnimation.stop();
  }, [isTracking, opacityAnim]);

  return (
    <Animated.View
      style={[
        styles.circle,
        // Apply the animated opacity
        { opacity: opacityAnim },
        // Change color based on tracking status
        { backgroundColor: isTracking ? '#28a745' : '#6c757d' },
      ]}
    />
  );
};

const styles = StyleSheet.create({
  circle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
});

export default BlinkingCircle;