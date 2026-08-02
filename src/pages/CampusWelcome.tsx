import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import api from '../services/api';

export default function CampusWelcome() {
  const navigate = useNavigate();
  const [showContactModal, setShowContactModal] = useState(false);
  const [modalTab, setModalTab] = useState<'demo' | 'contact'>('demo');

  // Form states
  const [collegeName, setCollegeName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [studentStrength, setStudentStrength] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const workspaces = [
    {
      title: '🏛️ PRINCIPAL PORTAL',
      desc: 'College Administration & Analytics',
      path: '/login/principal',
      color: 'from-blue-600/20 to-indigo-600/20 hover:border-blue-500/50'
    },
    {
      title: '🎓 HOD PORTAL',
      desc: 'Department Management & Faculty Workloads',
      path: '/login/hod',
      color: 'from-purple-600/20 to-pink-600/20 hover:border-purple-500/50'
    },
    {
      title: '👨‍🏫 FACULTY PORTAL',
      desc: 'Teaching, Attendance & Student Services',
      path: '/login/faculty',
      color: 'from-teal-600/20 to-emerald-600/20 hover:border-teal-500/50'
    },
    {
      title: '🛡️ ADMINISTRATION PORTAL',
      desc: 'COE • Exam Cell • Accounts • Library • Placement • Hostel • Transport',
      path: '/login/admin',
      color: 'from-orange-600/20 to-red-600/20 hover:border-orange-500/50'
    }
  ];

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard.`);
  };

  const handleDemoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collegeName || !contactPerson || !mobileNumber || !email || !city) {
      toast.error('Please fill all mandatory fields.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/leads', {
        collegeName,
        contactPerson,
        mobileNumber,
        email,
        city,
        studentStrength,
        message
      });
      toast.success('Demo Request submitted successfully! Our team will contact you shortly.');
      
      // Clear form
      setCollegeName('');
      setContactPerson('');
      setMobileNumber('');
      setEmail('');
      setCity('');
      setStudentStrength('');
      setMessage('');
      
      setShowContactModal(false);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed submitting request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-dark-bg flex flex-col items-center justify-center overflow-hidden px-4 py-16">
      {/* Decorative premium gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-primary/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-accent/10 blur-[130px] pointer-events-none" />

      <div className="w-full max-w-4xl relative z-10 text-center space-y-12">
        {/* Branding header */}
        <div className="space-y-4">
          <h1 className="text-5xl font-black text-white tracking-widest">
            WELCOME TO CAMPUS <span className="text-gradient">OS</span>
          </h1>
          <p className="text-lg text-text-secondary font-medium tracking-wide">
            Enterprise Smart Campus Management Platform
          </p>
        </div>

        {/* Choose Workspace Grid */}
        <div className="space-y-6">
          <h3 className="text-xs font-black text-text-secondary uppercase tracking-widest text-left max-w-3xl mx-auto">
            Choose Your Workspace
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {workspaces.map((ws) => (
              <div
                key={ws.title}
                onClick={() => navigate(ws.path)}
                className={`glass-card p-6 bg-gradient-to-br ${ws.color} transition-all duration-300 transform hover:scale-[1.02] cursor-pointer text-left flex flex-col justify-between min-h-[140px]`}
              >
                <h4 className="text-base font-black text-white tracking-wide">{ws.title}</h4>
                <p className="text-xs text-text-secondary font-semibold mt-2">{ws.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Register College gate */}
        <div className="max-w-md mx-auto pt-6 border-t border-purple-950/30">
          <span className="text-xs font-black text-text-secondary tracking-wider block mb-4 uppercase">OR</span>
          <div
            onClick={() => { setShowContactModal(true); setModalTab('demo'); }}
            className="glass-card p-5 bg-gradient-to-r from-purple-950/20 to-blue-950/20 hover:border-primary/40 cursor-pointer transition-all duration-300 transform hover:scale-[1.01] text-left"
          >
            <h4 className="text-sm font-bold text-white tracking-wide">🏫 Register College</h4>
            <p className="text-xs text-text-secondary mt-1">Book an official onboarding demo session for your institution.</p>
          </div>
        </div>
      </div>

      {/* Register College / Request Demo Modal */}
      {showContactModal && (
        <div className="fixed inset-0 bg-[#06030e]/80 backdrop-blur-md z-50 flex items-center justify-center p-4 transition-all duration-300">
          <div className="w-full max-w-lg glass-card glass-glow p-6 relative border border-primary/30 max-h-[90vh] overflow-y-auto space-y-5">
            
            {/* Header info */}
            <div className="text-center space-y-1">
              <span className="text-3xl">🏢</span>
              <h3 className="text-lg font-black text-white tracking-wide uppercase">Register College</h3>
              <p className="text-xs text-text-secondary leading-relaxed max-w-md mx-auto">
                Campus OS is an enterprise ERP solution. To register your college, please submit a demo request or contact ISR Web Design.
              </p>
            </div>

            {/* Modal Tabs */}
            <div className="flex bg-[#110a24]/60 border border-purple-900/30 rounded-lg p-0.5">
              <button
                onClick={() => setModalTab('demo')}
                className={`flex-1 h-8 rounded text-xs font-bold transition-all ${
                  modalTab === 'demo' ? 'bg-primary text-white' : 'text-text-secondary hover:text-white'
                }`}
              >
                📝 Request Demo
              </button>
              <button
                onClick={() => setModalTab('contact')}
                className={`flex-1 h-8 rounded text-xs font-bold transition-all ${
                  modalTab === 'contact' ? 'bg-primary text-white' : 'text-text-secondary hover:text-white'
                }`}
              >
                📞 Direct Contact
              </button>
            </div>

            {/* TAB 1: DEMO REQUEST FORM */}
            {modalTab === 'demo' && (
              <form onSubmit={handleDemoSubmit} className="space-y-3.5 text-xs text-left">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-text-secondary uppercase">College Name *</label>
                    <input
                      type="text"
                      className="w-full h-9 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded px-3 text-xs text-white"
                      value={collegeName}
                      onChange={(e) => setCollegeName(e.target.value)}
                      placeholder="e.g. Adelaide Engineering College"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-text-secondary uppercase">Contact Person *</label>
                    <input
                      type="text"
                      className="w-full h-9 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded px-3 text-xs text-white"
                      value={contactPerson}
                      onChange={(e) => setContactPerson(e.target.value)}
                      placeholder="e.g. Principal / HOD Name"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-text-secondary uppercase">Mobile Number *</label>
                    <input
                      type="text"
                      className="w-full h-9 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded px-3 text-xs text-white font-mono"
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value)}
                      placeholder="+91-XXXXXXXXXX"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-text-secondary uppercase">Official Email *</label>
                    <input
                      type="email"
                      className="w-full h-9 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded px-3 text-xs text-white"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. principal@college.edu"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-text-secondary uppercase">City *</label>
                    <input
                      type="text"
                      className="w-full h-9 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded px-3 text-xs text-white"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. Hyderabad"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-text-secondary uppercase">Student Strength</label>
                    <input
                      type="text"
                      className="w-full h-9 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded px-3 text-xs text-white font-mono"
                      value={studentStrength}
                      onChange={(e) => setStudentStrength(e.target.value)}
                      placeholder="e.g. 1500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-text-secondary uppercase">Message / Requirements</label>
                  <textarea
                    className="w-full p-3 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded text-xs text-white h-16 resize-none"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="We want to onboard our ECE & CSE departments..."
                  />
                </div>

                <button
                  type="submit"
                  className="w-full h-10 bg-primary hover:brightness-110 text-white font-bold rounded-lg transition-all"
                  disabled={loading}
                >
                  {loading ? 'Submitting request details...' : 'Submit Demo Request'}
                </button>
              </form>
            )}

            {/* TAB 2: DIRECT CONTACT INFORMATION */}
            {modalTab === 'contact' && (
              <div className="space-y-4 text-left text-xs">
                
                {/* Vendor profile details */}
                <div className="space-y-3 bg-[#110a24]/50 p-4 border border-purple-900/20 rounded-xl">
                  <div className="flex justify-between items-center pb-2 border-b border-purple-950/10">
                    <span className="text-text-secondary uppercase font-bold">Company</span>
                    <span className="text-white font-bold">ISR Web Design</span>
                  </div>
                  
                  <div className="space-y-1 pt-1">
                    <span className="text-text-secondary uppercase font-bold block mb-1">Contact Numbers</span>
                    <div className="flex items-center justify-between">
                      <p className="font-mono text-purple-400 font-bold">📞 +91 9110740255</p>
                      <button
                        onClick={() => handleCopy('+91 9110740255', 'Phone Number')}
                        className="text-[9px] bg-purple-950/40 text-purple-300 border border-purple-900/30 px-1.5 py-0.5 rounded font-mono font-bold"
                      >
                        Copy
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="font-mono text-purple-400 font-bold">📞 +91 8886304204</p>
                      <button
                        onClick={() => handleCopy('+91 8886304204', 'Alternative Phone')}
                        className="text-[9px] bg-purple-950/40 text-purple-300 border border-purple-900/30 px-1.5 py-0.5 rounded font-mono font-bold"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                  
                  <div className="pt-2 border-t border-purple-950/10 space-y-1">
                    <span className="text-text-secondary uppercase font-bold block mb-1">Official Email</span>
                    <div className="flex items-center justify-between">
                      <p className="font-mono text-white select-all">📧 mittapalliindrsenareddy913@gmail.com</p>
                      <button
                        onClick={() => handleCopy('mittapalliindrsenareddy913@gmail.com', 'Email Address')}
                        className="text-[9px] bg-purple-950/40 text-purple-300 border border-purple-900/30 px-1.5 py-0.5 rounded font-mono font-bold"
                      >
                        Copy
                      </button>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-purple-950/10 text-center">
                    <span className="text-text-secondary uppercase font-bold block mb-1">Office Hours</span>
                    <p className="font-semibold text-white">Monday – Saturday</p>
                    <p className="font-mono text-purple-400 font-bold">9:00 AM – 7:00 PM IST</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    onClick={() => window.open('tel:+919110740255')}
                    className="h-10 bg-[#160d36] hover:bg-purple-900/30 text-white font-bold rounded-lg border border-purple-900/30"
                  >
                    📞 Call Now
                  </button>
                  <button
                    onClick={() => window.open('https://wa.me/919110740255')}
                    className="h-10 bg-emerald-950/40 text-emerald-400 font-bold rounded-lg border border-emerald-900/30 hover:bg-emerald-900/20"
                  >
                    💬 WhatsApp
                  </button>
                  <button
                    onClick={() => window.open('https://isrwebdesign.com', '_blank')}
                    className="col-span-2 h-10 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-lg hover:brightness-110"
                  >
                    🌐 Visit Website (isrwebdesign.com)
                  </button>
                </div>
              </div>
            )}

            {/* Footer and Close Row */}
            <div className="border-t border-purple-950/30 pt-4 flex flex-col items-center space-y-3">
              <button
                onClick={() => setShowContactModal(false)}
                className="w-full h-10 border border-purple-900/30 hover:bg-purple-950/20 rounded-lg text-text-secondary hover:text-white font-bold"
              >
                Close
              </button>
              
              <div className="text-[10px] text-text-secondary font-mono text-center">
                <p className="font-bold">Campus OS · Version 1.0</p>
                <p className="mt-0.5">Powered by <span className="text-purple-400 font-semibold">ISR Web Design</span></p>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
