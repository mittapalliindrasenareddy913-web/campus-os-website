import React, { useState, useContext, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';

export default function CampusLogin() {
  const { portalType } = useParams<{ portalType: string }>(); // 'principal', 'hod', 'faculty', 'admin'
  const navigate = useNavigate();
  const auth = useContext(AuthContext);

  const [collegeCode, setCollegeCode] = useState('');
  const [emailOrEmpId, setEmailOrEmpId] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [requireFace, setRequireFace] = useState(false);
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanStep, setScanStep] = useState('READY');

  if (!auth) return null;

  const getPortalTitle = () => {
    switch (portalType) {
      case 'principal': return 'Principal Portal';
      case 'hod': return 'HOD Portal';
      case 'faculty': return 'Faculty Portal';
      case 'admin': return 'Administration Portal';
      default: return 'Campus OS Portal';
    }
  };

  const getPlaceholder = () => {
    if (portalType === 'principal' || portalType === 'admin') {
      return 'principal@college.edu';
    }
    return 'e.g. ECEFAC023 / ECEHOD001';
  };

  const isSuperAdmin = 
    portalType === 'super-admin' || 
    portalType === 'admin' ||
    emailOrEmpId.trim().toLowerCase() === 'indra0408' ||
    emailOrEmpId.trim().toLowerCase() === 'mittapalliindrasenareddy913@gmail.com' ||
    emailOrEmpId.trim().toLowerCase() === 'superadmin';

  useEffect(() => {
    if (portalType === 'super-admin') {
      setEmailOrEmpId('indra0408');
      setPassword('ISR@MB@d');
    } else if (portalType === 'hod') {
      setCollegeCode('ASCET001');
      setEmailOrEmpId('hod@college.edu');
      setPassword('ASCET001');
    } else if (portalType === 'faculty') {
      setCollegeCode('ASCET001');
      setEmailOrEmpId('faculty@college.edu');
      setPassword('ASCET001');
    } else if (portalType === 'principal') {
      setCollegeCode('ASCET001');
      setEmailOrEmpId('principal');
      setPassword('ASCET001');
    } else {
      setCollegeCode('ASCET001');
    }
  }, [portalType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Auto-fill college code for Super Admin
    const effectiveCollegeCode = isSuperAdmin ? '473383' : collegeCode;
    
    if (!effectiveCollegeCode && !isSuperAdmin) {
      setError('College code is required.');
      return;
    }
    if (!emailOrEmpId || !password) {
      setError('All login credentials are required.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await auth.login(effectiveCollegeCode.toUpperCase(), emailOrEmpId.trim(), password, portalType || 'faculty');
      setLoading(false);

      if (res.requireFaceAuth && res.tempToken) {
        setTempToken(res.tempToken);
        setRequireFace(true);
      } else if (res.success) {
        setSuccessMsg('Logged in successfully!');
        if (rememberMe) {
          localStorage.setItem('campus_remember_session', 'true');
        }
        // Redirect will be handled by App router listening to Auth state
      } else {
        setError(res.error || 'Incorrect credentials.');
      }
    } catch (err: any) {
      setLoading(false);
      setError('Connection refused by authentication servers.');
    }
  };

  const handleFaceVerify = async () => {
    if (!tempToken) return;
    setScanning(true);
    setScanStep('CAPTURING');

    setTimeout(() => {
      setScanStep('VERIFYING');
      setTimeout(async () => {
        const res = await auth.verifyFace(tempToken, 'MOCK_DESCRIPTOR_BASE64');
        setScanning(false);
        if (res.success) {
          setScanStep('SUCCESS');
          setSuccessMsg('Face signature verified. Access granted.');
        } else {
          setScanStep('READY');
          setError(res.error || 'Face matching mismatch.');
          setRequireFace(false);
          setTempToken(null);
        }
      }, 1500);
    }, 1500);
  };

  return (
    <div className="relative min-h-screen bg-dark-bg flex items-center justify-center overflow-hidden px-4">
      {/* Gradients blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-primary/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-accent/10 blur-[130px] pointer-events-none" />

      <div className="w-full max-w-md glass-card glass-glow p-8 relative z-10 space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-black text-white tracking-widest">CAMPUS <span className="text-gradient">OS</span></h1>
          <h2 className="text-base font-bold text-gray-200 mt-3">{getPortalTitle()}</h2>
          <p className="text-[11px] text-text-secondary mt-1">Workspace-enforced portal validations</p>
        </div>

        {error && (
          <div className="bg-red-950/40 border border-red-800/50 text-red-300 text-xs p-3.5 rounded-lg text-center font-medium">
            ⚠️ {error}
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-950/40 border border-emerald-800/50 text-emerald-300 text-xs p-3.5 rounded-lg text-center font-medium">
            ✓ {successMsg}
          </div>
        )}

        {!requireFace ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-2">
                {portalType === 'principal' || portalType === 'admin' ? 'Official Email / Super Admin Email' : 'Employee ID'}
              </label>
              <input
                type="text"
                placeholder={portalType === 'principal' ? 'principal@college.edu or Super Admin email' : getPlaceholder()}
                className="w-full h-11 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-4 text-xs text-white focus:outline-none focus:border-primary"
                value={emailOrEmpId}
                onChange={(e) => setEmailOrEmpId(e.target.value)}
              />
            </div>

            {!isSuperAdmin && (
              <div>
                <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-2">College Code</label>
                <input
                  type="text"
                  placeholder="e.g. ASCET001"
                  className="w-full h-11 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-4 text-xs text-white focus:outline-none focus:border-primary uppercase"
                  value={collegeCode}
                  onChange={(e) => setCollegeCode(e.target.value)}
                />
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-2">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                className="w-full h-11 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-4 text-xs text-white focus:outline-none focus:border-primary"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {/* Remember Me and Forgot password Row */}
            <div className="flex items-center justify-between text-[11px] font-bold text-text-secondary">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-purple-900/30 bg-dark-bg/60 text-primary focus:ring-primary h-3.5 w-3.5"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                Remember Me
              </label>
              <a href="#forgot" onClick={(e) => { e.preventDefault(); alert('Please contact college Admin IT support to reset credentials.'); }} className="hover:text-white hover:underline">
                Forgot Password?
              </a>
            </div>

            <button
              type="submit"
              className="w-full h-12 bg-gradient-to-r from-primary to-accent hover:brightness-110 active:scale-[0.98] rounded-xl text-white font-bold text-xs tracking-wider transition-all"
              disabled={loading}
            >
              {loading ? 'Verifying Credentials...' : 'Access Portal'}
            </button>

            <button
              type="button"
              onClick={() => navigate('/welcome')}
              className="w-full h-12 border border-purple-900/30 hover:bg-purple-950/20 rounded-xl text-xs font-bold transition-all text-text-secondary hover:text-white"
            >
              Cancel
            </button>
          </form>
        ) : (
          <div className="text-center space-y-6">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white">Face ID Authentication Required</h3>
              <p className="text-xs text-text-secondary">Perform liveness scanning to release credentials sessions</p>
            </div>

            <div className="flex justify-center">
              <div className={`w-36 h-36 rounded-full border-4 ${scanning ? 'border-teal-500 animate-pulse' : 'border-purple-900/20'} bg-dark-bg/40 flex items-center justify-center overflow-hidden`}>
                {scanning ? (
                  <div className="text-xs font-bold text-teal-400">
                    {scanStep === 'CAPTURING' && 'CAPTURING...'}
                    {scanStep === 'VERIFYING' && 'MATCHING...'}
                  </div>
                ) : (
                  <span className="text-4xl">📸</span>
                )}
              </div>
            </div>

            {!scanning ? (
              <button
                onClick={handleFaceVerify}
                className="w-full h-12 bg-teal-600 hover:bg-teal-500 rounded-xl text-xs font-bold tracking-wider"
              >
                Scan Face
              </button>
            ) : (
              <span className="block text-xs font-bold text-text-secondary animate-pulse">Checking facial liveness...</span>
            )}

            <button
              onClick={() => { setRequireFace(false); setTempToken(null); }}
              className="block w-full text-xs text-red-400 font-bold hover:underline"
              disabled={scanning}
            >
              Cancel Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
