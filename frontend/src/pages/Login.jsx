import React, { useState } from 'react'
import { login, auth } from '../api'

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState(null)
  const [loading,  setLoading]  = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!username || !password) { setError('Enter username and password'); return }
    setLoading(true); setError(null)
    try {
      const data = await login(username, password)
      auth.setSession(data.access_token, data.user)
      onLogin(data.user)
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const fillPreset = (u, p) => { setUsername(u); setPassword(p) }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)',
    }}>
      <div style={{ width: 360, animation: 'fadeIn 0.4s ease' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 48, height: 48, background: 'var(--accent)', borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0a0e1a" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.1em' }}>FRAUDNET</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>AI Fraud Detection System v3.0</div>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 10, overflow: 'hidden',
        }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Sign In
            </div>
          </div>

          <form onSubmit={submit} style={{ padding: 20 }}>
            {error && (
              <div style={{
                padding: '8px 12px', background: 'rgba(255,69,96,0.1)',
                border: '1px solid rgba(255,69,96,0.3)', borderRadius: 6,
                fontSize: 11, color: 'var(--danger)', marginBottom: 16,
              }}>
                {error}
              </div>
            )}

            {[
              { label: 'Username', value: username, set: setUsername, type: 'text',     placeholder: 'admin' },
              { label: 'Password', value: password, set: setPassword, type: 'password', placeholder: '••••••••' },
            ].map(({ label, value, set, type, placeholder }) => (
              <div key={label} style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 9, color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5 }}>
                  {label}
                </label>
                <input
                  type={type}
                  value={value}
                  onChange={e => set(e.target.value)}
                  placeholder={placeholder}
                  autoComplete={type === 'password' ? 'current-password' : 'username'}
                  style={{
                    width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)',
                    borderRadius: 5, padding: '9px 12px', fontSize: 12, color: 'var(--text)',
                    outline: 'none', fontFamily: 'var(--font-mono)', boxSizing: 'border-box',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                  onBlur={e  => e.target.style.borderColor = 'var(--border)'}
                />
              </div>
            ))}

            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '11px 0', borderRadius: 6, marginTop: 4,
              background: loading ? 'rgba(0,212,255,0.06)' : 'rgba(0,212,255,0.15)',
              border: '1px solid rgba(0,212,255,0.4)', color: loading ? 'var(--muted)' : 'var(--accent)',
              fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', fontFamily: 'var(--font-mono)',
              cursor: loading ? 'wait' : 'pointer', transition: 'all 0.2s',
            }}>
              {loading ? 'SIGNING IN...' : 'SIGN IN →'}
            </button>
          </form>
        </div>

        {/* Quick-fill presets — development builds only.
            These buttons filled in admin/admin123 with one click, and shipped in
            the production bundle: a login page that hands out an admin session
            to anyone who opens it. import.meta.env.DEV is false in `vite build`,
            so they stay available while developing and never reach the delivered
            artifact. The accounts they reference no longer exist either — the
            first administrator now comes from ADMIN_USERNAME/ADMIN_PASSWORD. */}
        {import.meta.env.DEV && (
        <div style={{ marginTop: 16, padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
          <div style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
            Dev quick-fill — set ADMIN_USERNAME / ADMIN_PASSWORD
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { label: 'Admin',   u: 'admin',   p: 'admin123',   color: 'var(--danger)' },
              { label: 'Analyst', u: 'analyst', p: 'analyst123', color: 'var(--warn)' },
              { label: 'Viewer',  u: 'viewer',  p: 'viewer123',  color: 'var(--muted)' },
            ].map(({ label, u, p, color }) => (
              <button key={label} onClick={() => fillPreset(u, p)} style={{
                flex: 1, padding: '6px 0', borderRadius: 4, fontSize: 9, fontFamily: 'var(--font-mono)',
                background: 'var(--surface2)', border: `1px solid var(--border)`,
                color, cursor: 'pointer', letterSpacing: '0.06em',
              }}>
                {label}
              </button>
            ))}
          </div>
        </div>
        )}
      </div>
    </div>
  )
}
