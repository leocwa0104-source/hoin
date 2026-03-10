import React, { useMemo, useState } from 'react';
import { api } from '../api';

const Auth = ({ onAuthed }) => {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState('request');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const canRequest = useMemo(() => email.trim().length > 3, [email]);
  const canRegister = useMemo(() => email && code.length === 6 && password.length >= 8, [email, code, password]);
  const canLogin = useMemo(() => email && password.length > 0, [email, password]);

  const resetError = () => setError('');

  const requestOtp = async () => {
    resetError();
    setBusy(true);
    try {
      await api.post('/auth/request-otp', { email });
      setStep('verify');
    } catch (err) {
      setError(err?.response?.data?.error || 'request_failed');
    } finally {
      setBusy(false);
    }
  };

  const register = async () => {
    resetError();
    setBusy(true);
    try {
      const res = await api.post('/auth/register', { email, code, password });
      onAuthed(res.data);
    } catch (err) {
      setError(err?.response?.data?.error || 'register_failed');
    } finally {
      setBusy(false);
    }
  };

  const login = async () => {
    resetError();
    setBusy(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      onAuthed(res.data);
    } catch (err) {
      setError(err?.response?.data?.error || 'login_failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-gray-50 p-4 font-sans">
      <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-sm border border-gray-100">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">GeoChat</h1>
          <p className="text-gray-500 text-sm">Define your world. Listen in.</p>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setStep('request');
              resetError();
            }}
            className={`flex-1 py-2 rounded-xl text-sm font-bold border ${mode === 'login' ? 'bg-black text-white border-black' : 'bg-white text-gray-700 border-gray-200'}`}
          >
            登录
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setStep('request');
              resetError();
            }}
            className={`flex-1 py-2 rounded-xl text-sm font-bold border ${mode === 'register' ? 'bg-black text-white border-black' : 'bg-white text-gray-700 border-gray-200'}`}
          >
            注册
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1 ml-1">Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-4 bg-gray-50 rounded-xl border-2 border-transparent focus:border-black focus:bg-white outline-none transition-all font-medium"
            />
          </div>

          {mode === 'register' && step === 'verify' && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1 ml-1">验证码</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="6 位数字"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full p-4 bg-gray-50 rounded-xl border-2 border-transparent focus:border-black focus:bg-white outline-none transition-all font-medium tracking-widest text-center"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1 ml-1">密码</label>
            <input
              type="password"
              placeholder={mode === 'register' ? '至少 8 位' : '输入密码'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-4 bg-gray-50 rounded-xl border-2 border-transparent focus:border-black focus:bg-white outline-none transition-all font-medium"
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 px-4 py-3 rounded-xl">
              {String(error)}
            </div>
          )}

          {mode === 'login' && (
            <button
              type="button"
              disabled={busy || !canLogin}
              onClick={login}
              className="w-full bg-black text-white p-4 rounded-xl font-bold text-lg hover:scale-[1.02] active:scale-[0.98] transition-transform disabled:opacity-50"
            >
              登录
            </button>
          )}

          {mode === 'register' && step === 'request' && (
            <button
              type="button"
              disabled={busy || !canRequest}
              onClick={requestOtp}
              className="w-full bg-black text-white p-4 rounded-xl font-bold text-lg hover:scale-[1.02] active:scale-[0.98] transition-transform disabled:opacity-50"
            >
              获取验证码
            </button>
          )}

          {mode === 'register' && step === 'verify' && (
            <button
              type="button"
              disabled={busy || !canRegister}
              onClick={register}
              className="w-full bg-black text-white p-4 rounded-xl font-bold text-lg hover:scale-[1.02] active:scale-[0.98] transition-transform disabled:opacity-50"
            >
              完成注册
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;

