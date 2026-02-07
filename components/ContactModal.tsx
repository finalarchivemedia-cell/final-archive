import React, { useMemo, useState } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  onSend: (data: { email: string; message: string }) => Promise<boolean>;
};

export const ContactModal: React.FC<Props> = ({ open, onClose, onSend }) => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const canSend = useMemo(() => {
    return email.trim().length > 3 && message.trim().length > 1 && status !== 'sending';
  }, [email, message, status]);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSend) return;
    setStatus('sending');
    const ok = await onSend({ email: email.trim(), message: message.trim() });
    setStatus(ok ? 'sent' : 'error');
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-sm p-6"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md border border-white/10 bg-black/80 p-6 text-white">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="text-[11px] uppercase tracking-[0.25em] text-white/70">Contact</div>
          <button
            type="button"
            onClick={onClose}
            className="text-[11px] uppercase tracking-[0.25em] text-white/40 hover:text-white/80 transition-colors"
          >
            Close
          </button>
        </div>

        {status === 'sent' ? (
          <div className="pt-6 text-[12px] tracking-widest text-white/60">
            Thanks — message sent.
          </div>
        ) : (
          <form onSubmit={submit} className="pt-6 flex flex-col gap-4">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email"
              className="bg-black border border-white/10 p-3 text-[12px] tracking-widest outline-none focus:border-white/40 placeholder:text-white/20"
            />

            <textarea
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Short message"
              rows={5}
              className="bg-black border border-white/10 p-3 text-[12px] tracking-widest outline-none focus:border-white/40 placeholder:text-white/20 resize-none"
            />

            {status === 'error' && (
              <div className="text-[11px] tracking-widest text-red-500/80">
                Failed to send. Please try again.
              </div>
            )}

            <button
              type="submit"
              disabled={!canSend}
              className="mt-2 w-full border border-white/20 bg-white text-black py-3 text-[11px] font-bold uppercase tracking-[0.3em] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/90 transition-colors"
            >
              {status === 'sending' ? 'Sending...' : 'Send'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

