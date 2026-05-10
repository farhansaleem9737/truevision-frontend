// truevision/hooks/useThemedScreen.js
//
// Returns the props needed to theme a settings sub-screen's root View + StatusBar.
// Usage:
//   const { rootStyle, statusBarProps, colors } = useThemedScreen();
//   return (
//     <View style={[S.root, rootStyle]}>
//       <StatusBar {...statusBarProps} />
//       ...
//     </View>
//   );

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme }          from '../context/ThemeContext';

export default function useThemedScreen() {
  const insets    = useSafeAreaInsets();
  const { colors } = useTheme();

  return {
    insets,
    colors,
    rootStyle: { paddingTop: insets.top, backgroundColor: colors.surface },
    statusBarProps: {
      barStyle:        colors.statusBarStyle,
      backgroundColor: colors.bg,
    },
  };
}
