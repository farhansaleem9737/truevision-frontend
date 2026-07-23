// truevision/context/CallProvider.js
//
// App-root provider for voice/video calling. It:
//   • (re)binds the call:* socket listeners whenever the user logs in,
//   • mirrors CallService state into React,
//   • renders the full-screen CallScreen overlay whenever a call is active
//     (incoming OR outgoing) — so an incoming call surfaces from ANY screen.
//
// Any screen starts a call via useCall().placeCall(peer, mode). Everything else
// (accept / decline / hangup / mute / speaker / camera) is exposed here too.

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import callService from '../services/CallService';
import { useAuth } from './AuthContext';
import CallScreen from '../screens/CallScreen';

const CallContext = createContext(null);
export const useCall = () => useContext(CallContext);

export function CallProvider({ children }) {
  const { user } = useAuth();
  const [state, setState] = useState(() => callService.snapshot());

  // Mirror CallService → React.
  useEffect(() => callService.subscribe(setState), []);

  // Bind (or re-bind) the signalling listeners when the signed-in user changes.
  useEffect(() => {
    if (user?._id) callService.attachSocketHandlers();
  }, [user?._id]);

  const api = useMemo(() => ({
    state,
    placeCall:     (peer, mode) => callService.placeCall(peer, mode),
    accept:        () => callService.acceptIncoming(),
    decline:       () => callService.declineIncoming(),
    hangup:        () => callService.hangup(),
    dismiss:       () => callService.dismiss(),
    toggleMute:    () => callService.toggleMute(),
    toggleCamera:  () => callService.toggleCamera(),
    switchCamera:  () => callService.switchCamera(),
    toggleSpeaker: () => callService.toggleSpeaker(),
  }), [state]);

  return (
    <CallContext.Provider value={api}>
      {children}
      {state.status !== 'idle' && <CallScreen />}
    </CallContext.Provider>
  );
}

export default CallProvider;
