import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ScreenContainer({ 
  children, 
  backgroundColor = '#ffffff',
  edges = ['top', 'bottom'], // Include bottom by default
}) {
  const insets = useSafeAreaInsets();
  
  // Calculate padding based on edges prop
  const paddingTop = edges.includes('top') ? insets.top : 0;
  const paddingBottom = edges.includes('bottom') ? insets.bottom : 0;
  const paddingLeft = edges.includes('left') ? insets.left : 0;
  const paddingRight = edges.includes('right') ? insets.right : 0;

  return (
    <View 
      style={[
        styles.container, 
        { 
          backgroundColor,
          paddingTop,
          paddingBottom,
          paddingLeft,
          paddingRight,
        }
      ]}
    >
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});