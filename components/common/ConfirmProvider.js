// truevision/components/common/ConfirmProvider.js
//
// App-wide, promise-based confirmation so any screen can replace a native
// Alert.alert() confirmation with one line — while rendering the SAME premium
// themed dialog the app already uses (components/ui/ConfirmDialog: rounded
// card, blur + dim backdrop, icon chip, scale/fade). One provider at the root;
// the hook returns a function:
//
//   const confirm = useConfirm();
//   const ok = await confirm({
//     title: 'Unfollow @sara?',
//     message: 'You will stop seeing their posts.',
//     confirmText: 'Unfollow',
//     destructive: true,
//     icon: 'person-remove-outline',
//   });
//   if (ok) { … }
//
// Reuses ConfirmDialog so there is exactly one dialog look across the app.

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import ConfirmDialog from '../ui/ConfirmDialog';

const ConfirmContext = createContext(() => Promise.resolve(false));

/** Promise-based confirmation. Returns confirm(opts) → Promise<boolean>. */
export const useConfirm = () => useContext(ConfirmContext);

const DEFAULTS = {
  title:       'Are you sure?',
  message:     '',
  confirmText: 'Confirm',
  cancelText:  'Cancel',
  destructive: false,
  icon:        'alert-circle-outline',
};

export function ConfirmProvider({ children }) {
  const [visible, setVisible] = useState(false);
  const [opts, setOpts]       = useState(DEFAULTS);
  const resolver = useRef(null);

  const confirm = useCallback((options = {}) => {
    setOpts({ ...DEFAULTS, ...options });
    setVisible(true);
    return new Promise((resolve) => { resolver.current = resolve; });
  }, []);

  const settle = useCallback((result) => {
    setVisible(false);
    const r = resolver.current;
    resolver.current = null;
    r?.(result);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        visible={visible}
        icon={opts.icon}
        title={opts.title}
        message={opts.message}
        confirmLabel={opts.confirmText}
        cancelLabel={opts.cancelText}
        destructive={opts.destructive}
        onConfirm={() => settle(true)}
        onCancel={() => settle(false)}
      />
    </ConfirmContext.Provider>
  );
}
