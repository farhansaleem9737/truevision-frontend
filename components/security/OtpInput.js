// truevision/components/security/OtpInput.js
//
// Reusable 6-box OTP input — extracted from the VerifyEmailScreen pattern
// (auto-advance, backspace-to-previous, auto-submit on last digit) and made
// theme-aware so it works on the dark Security screens.
//
// Props:
//   onComplete(code)  — fired when all 6 digits are present
//   disabled          — locks input while a request is in flight
//   accent            — filled-box border color (defaults to theme accent)

import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

const LEN = 6;

const OtpInput = forwardRef(({ onComplete, disabled = false, accent }, ref) => {
  const { colors, isDark } = useTheme();
  const [digits, setDigits] = useState(Array(LEN).fill(''));
  const inputs = useRef([]);

  const reset = () => {
    setDigits(Array(LEN).fill(''));
    setTimeout(() => inputs.current[0]?.focus(), 60);
  };

  // Parent screens call otpRef.current.reset() after a failed verify.
  useImperativeHandle(ref, () => ({ reset }));

  const handleChange = (value, index) => {
    if (!/^\d*$/.test(value)) return;

    // Paste support: a multi-digit value fills forward from this box.
    if (value.length > 1) {
      const pasted = value.slice(0, LEN - index).split('');
      const next = [...digits];
      pasted.forEach((d, i) => { next[index + i] = d; });
      setDigits(next);
      const lastIdx = Math.min(index + pasted.length, LEN - 1);
      inputs.current[lastIdx]?.focus();
      if (next.every(Boolean)) onComplete?.(next.join(''));
      return;
    }

    const next = [...digits];
    next[index] = value;
    setDigits(next);

    if (value && index < LEN - 1) inputs.current[index + 1]?.focus();
    if (value && index === LEN - 1 && next.every(Boolean)) onComplete?.(next.join(''));
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const tint = accent || colors.accent;

  return (
    <View style={S.row}>
      {digits.map((digit, index) => (
        <TextInput
          key={index}
          ref={(r) => { inputs.current[index] = r; }}
          value={digit}
          onChangeText={(v) => handleChange(v, index)}
          onKeyPress={(e) => handleKeyPress(e, index)}
          keyboardType="number-pad"
          maxLength={LEN}    /* >1 so paste can land in one box */
          editable={!disabled}
          autoFocus={index === 0}
          selectTextOnFocus
          style={[
            S.box,
            {
              color: colors.text,
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f8fafc',
              borderColor: digit ? tint : (isDark ? 'rgba(255,255,255,0.14)' : '#e2e8f0'),
            },
          ]}
        />
      ))}
    </View>
  );
});

const S = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  box: {
    width: 46, height: 56,
    borderWidth: 1.6, borderRadius: 12,
    textAlign: 'center', fontSize: 22, fontWeight: '800',
  },
});

export default OtpInput;
