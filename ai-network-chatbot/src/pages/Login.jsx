import { useState, useEffect } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut
} from "firebase/auth";
import { auth } from "../lib/firebase";

const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("profile");
googleProvider.addScope("email");

// ==================== ICONS ====================
const NetworkIcon = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2.5" strokeLinecap="round">
    <circle cx="12" cy="12" r="10" strokeDasharray="15.7 62.8">
      <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite" />
    </circle>
  </svg>
);

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

const EyeIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

const EyeOffIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

const MailIcon = () => (
  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2"/>
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
  </svg>
);

const BackArrowIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 19l-7-7 7-7"/>
  </svg>
);

// ==================== STYLES ====================
const styles = {
  page: {
    minHeight: "100vh", background: "#0a0a0a", display: "flex",
    fontFamily: "'Geist', system-ui, sans-serif", position: "relative", overflow: "hidden",
  },
  bgBlob: {
    position: "absolute", top: "-50%", right: "-10%", width: "600px", height: "600px",
    background: "radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)",
    borderRadius: "50%", pointerEvents: "none",
  },
  bgBlob2: {
    position: "absolute", bottom: "-30%", left: "-10%", width: "500px", height: "500px",
    background: "radial-gradient(circle, rgba(59,130,246,0.05) 0%, transparent 70%)",
    borderRadius: "50%", pointerEvents: "none",
  },
  left: {
    flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
    padding: "60px", position: "relative", background: "#0a0a0a",
  },
  leftContent: { maxWidth: "460px", width: "100%" },
  logoRow: { display: "flex", alignItems: "center", gap: "12px", marginBottom: "48px" },
  logoIcon: {
    width: "44px", height: "44px", background: "transparent", borderRadius: "12px",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  logoText: { color: "#fff", fontSize: "20px", fontWeight: "700", margin: 0 },
  logoSub: { color: "#6b7280", fontSize: "13px", margin: 0 },
  tagline: { color: "#fff", fontSize: "38px", fontWeight: "700", lineHeight: 1.2, marginBottom: "16px" },
  right: {
    width: "480px", display: "flex", alignItems: "center", justifyContent: "center",
    padding: "40px", background: "#0a0a0a", borderLeft: "1px solid #1a1a1a",
  },
  card: { width: "100%", maxWidth: "400px" },
  cardTitle: { color: "#fff", fontSize: "28px", fontWeight: "700", margin: "0 0 6px" },
  cardSub: { color: "#6b7280", fontSize: "14px", margin: "0 0 32px" },
  label: { display: "block", color: "#9ca3af", fontSize: "13px", fontWeight: "500", marginBottom: "6px" },
  input: {
    width: "100%", background: "#141414", border: "1px solid #262626", borderRadius: "8px",
    padding: "11px 14px", fontSize: "14px", color: "#fff", outline: "none",
    boxSizing: "border-box", transition: "border-color 0.2s",
  },
  primaryBtn: {
    width: "100%", background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
    color: "#fff", border: "none", borderRadius: "10px", padding: "13px 20px",
    fontSize: "15px", fontWeight: "600", cursor: "pointer", transition: "opacity 0.2s",
  },
  switchLink: { color: "#3b82f6", cursor: "pointer", fontWeight: "500" },
  socialBtn: {
    width: "100%", background: "#141414", border: "1px solid #262626", borderRadius: "10px",
    padding: "13px 20px", fontSize: "14px", fontWeight: "500", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
    color: "#e5e7eb", transition: "all 0.2s", marginBottom: "10px",
  },
  divider: { display: "flex", alignItems: "center", gap: "12px", margin: "20px 0" },
  dividerLine: { flex: 1, height: "1px", background: "#1a1a1a" },
  dividerText: { color: "#4b5563", fontSize: "13px" },
  alert: { padding: "11px 14px", borderRadius: "8px", marginBottom: "16px", fontSize: "13px", fontWeight: "500" },
  errorAlert: { background: "rgba(127,29,29,0.5)", color: "#fca5a5", border: "1px solid rgba(220,38,38,0.4)" },
  successAlert: { background: "rgba(20,83,45,0.5)", color: "#86efac", border: "1px solid rgba(34,197,94,0.4)" },
  footer: { textAlign: "center", color: "#2a2a2a", fontSize: "12px", marginTop: "32px" },
};

const globalStyles = `
  @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-20px)} }
  @keyframes fadeSlideIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
  * { box-sizing: border-box; }
  input::placeholder { color: #374151; }
  @media (max-width: 900px) {
    .auth-page { flex-direction: column !important; }
    .auth-left { padding: 40px 24px 32px !important; border-bottom: 1px solid #1a1a1a !important; }
    .auth-right { width: 100% !important; border-left: none !important; padding: 32px 24px 40px !important; }
    .auth-tagline { font-size: 28px !important; }
  }
  @media (max-width: 480px) {
    .auth-left { padding: 24px 16px !important; }
    .auth-right { padding: 24px 16px 32px !important; }
    .auth-tagline { font-size: 22px !important; }
  }
`;

// ==================== PASSWORD INPUT ====================
function PasswordInput({ placeholder, value, onChange, onKeyDown }) {
  const [show, setShow] = useState(false);
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input
        type={show ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          ...styles.input,
          paddingRight: "44px",
          borderColor: focused ? "#3b82f6" : "#262626",
        }}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        style={{
          position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)",
          background: "none", border: "none", cursor: "pointer", padding: "2px",
          display: "flex", alignItems: "center", justifyContent: "center",
          opacity: 0.65, lineHeight: 1,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.65")}
      >
        {show ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}

// ==================== TEXT INPUT ====================
function TextInput({ label, type = "text", placeholder, value, onChange, onKeyDown, hasError }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: "16px" }}>
      {label && <label style={styles.label}>{label}</label>}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          ...styles.input,
          borderColor: hasError ? "rgba(220,38,38,0.5)" : focused ? "#3b82f6" : "#262626",
        }}
      />
    </div>
  );
}

// ==================== SOCIAL BUTTON ====================
function SocialButton({ icon, label, onClick, disabled }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...styles.socialBtn,
        background: hovered && !disabled ? "#1a1a1a" : "#141414",
        borderColor: hovered && !disabled ? "#333" : "#262626",
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {icon}{label}
    </button>
  );
}

// ==================== FORGOT PASSWORD (inline) ====================
function ForgotPasswordInline({ onClose }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleReset = async () => {
    setError("");
    if (!email.trim()) { setError("Please enter your email address"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("Please enter a valid email address"); return; }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSent(true);
    } catch (err) {
      if (err.code === "auth/user-not-found") setError("No account found with this email.");
      else if (err.code === "auth/invalid-email") setError("Invalid email address.");
      else if (err.code === "auth/too-many-requests") setError("Too many attempts. Try again later.");
      else setError(err.message);
    } finally { setLoading(false); }
  };

  return (
    <div style={{ animation: "fadeSlideIn 0.2s ease" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "20px" }}>
        <div>
          <h2 style={{ ...styles.cardTitle, fontSize: "22px", marginBottom: "4px" }}>Reset password</h2>
          <p style={{ color: "#6b7280", fontSize: "13px", margin: 0 }}>Enter your email to receive a reset link.</p>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none", border: "1px solid #262626", borderRadius: "8px",
            color: "#6b7280", cursor: "pointer", padding: "6px 10px",
            fontSize: "12px", fontWeight: "500", display: "flex", alignItems: "center", gap: "5px",
            whiteSpace: "nowrap", transition: "all 0.2s", marginLeft: "16px", flexShrink: 0,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#404040"; e.currentTarget.style.color = "#c4c4c4"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#262626"; e.currentTarget.style.color = "#6b7280"; }}
        >
          <BackArrowIcon /> Back
        </button>
      </div>

      <div style={{ height: "1px", background: "#1a1a1a", marginBottom: "20px" }} />

      {sent ? (
        <div style={{ animation: "fadeSlideIn 0.2s ease" }}>
          <div style={{
            width: "54px", height: "54px", borderRadius: "14px",
            background: "rgba(59,130,246,0.07)", border: "1px solid rgba(59,130,246,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px",
          }}>
            <MailIcon />
          </div>
          <p style={{ color: "#d1d5db", fontSize: "14px", lineHeight: 1.6, margin: "0 0 16px" }}>
            A reset link was sent to{" "}
            <span style={{ color: "#fff", fontWeight: "600" }}>{email}</span>.
            {" "}Check your inbox and spam folder.
          </p>
          <div style={{ ...styles.alert, ...styles.successAlert }}>✓ Reset email sent successfully</div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={() => { setSent(false); setEmail(""); }}
              style={{
                flex: 1, background: "#141414", border: "1px solid #262626", borderRadius: "8px",
                color: "#9ca3af", cursor: "pointer", padding: "11px", fontSize: "13px",
                fontWeight: "500", transition: "border-color 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#404040")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#262626")}
            >
              Try different email
            </button>
            <button onClick={onClose} style={{ flex: 1, ...styles.primaryBtn, padding: "11px", fontSize: "13px" }}>
              Back to Sign In
            </button>
          </div>
        </div>
      ) : (
        <>
          {error && <div style={{ ...styles.alert, ...styles.errorAlert }}>{error}</div>}
          <TextInput
            label="Email address" type="email" placeholder="you@example.com"
            value={email} onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleReset()} hasError={!!error}
          />
          <button
            onClick={handleReset} disabled={loading}
            style={{ ...styles.primaryBtn, opacity: loading ? 0.7 : 1, cursor: loading ? "not-allowed" : "pointer", marginTop: "4px" }}
          >
            {loading ? "Sending..." : "Send Reset Link"}
          </button>
        </>
      )}
    </div>
  );
}

// ==================== SIGN IN PANEL ====================
function SignInPanel({ onSwitch }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForgot, setShowForgot] = useState(false);

  const handleEmailSignIn = async () => {
    setError(""); setSuccess("");
    if (!email) { setError("Please enter your email"); return; }
    if (!password) { setError("Please enter your password"); return; }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setSuccess("Signed in successfully!");
      setEmail(""); setPassword("");
    } catch (err) {
      if (err.message.includes("user-not-found")) setError("Email not found. Please create an account.");
      else if (err.message.includes("wrong-password")) setError("Incorrect password.");
      else setError(err.message);
    } finally { setLoading(false); }
  };

  const handleGoogleSignIn = async () => {
    setError(""); setSuccess(""); setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      setSuccess("Signed in with Google!");
    } catch (err) {
      if (err.code !== "auth/popup-closed-by-user") setError(err.message);
    } finally { setLoading(false); }
  };

  if (showForgot) {
    return (
      <div style={styles.card}>
        <ForgotPasswordInline onClose={() => setShowForgot(false)} />
        
      </div>
    );
  }

  return (
    <div style={styles.card}>
      <h2 style={styles.cardTitle}>Sign in</h2>
      <p style={styles.cardSub}>
        New user?{" "}
        <span style={styles.switchLink} onClick={onSwitch}>Create an account</span>
      </p>

      {error && <div style={{ ...styles.alert, ...styles.errorAlert }}>{error}</div>}
      {success && <div style={{ ...styles.alert, ...styles.successAlert }}>{success}</div>}

      <TextInput label="Email address" type="email" placeholder="" value={email} onChange={(e) => setEmail(e.target.value)} hasError={!!error} />

      <label style={styles.label}>Password</label>
      <PasswordInput
        placeholder=""
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleEmailSignIn()}
      />

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px", marginBottom: "20px" }}>
        <button
          type="button" onClick={() => setShowForgot(true)}
          style={{ background: "none", border: "none", padding: 0, color: "#3b82f6", fontSize: "12px", fontWeight: "500", cursor: "pointer", transition: "color 0.2s" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#60a5fa")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#3b82f6")}
        >
          Forgot password?
        </button>
      </div>

      <button
        onClick={handleEmailSignIn} disabled={loading}
        style={{ ...styles.primaryBtn, opacity: loading ? 0.7 : 1, cursor: loading ? "not-allowed" : "pointer" }}
      >
        {loading ? "Signing in..." : "Sign In"}
      </button>

      <div style={styles.divider}>
        <div style={styles.dividerLine} />
        <span style={styles.dividerText}>Or continue with</span>
        <div style={styles.dividerLine} />
      </div>

      <SocialButton icon={<GoogleIcon />} label="Google" onClick={handleGoogleSignIn} disabled={loading} />

      {/* <p style={styles.footer}>Abdul Wali Khan University Mardan — Final Year Project</p> */}
    </div>
  );
}

// ==================== SIGN UP PANEL ====================
function SignUpPanel({ onSwitch }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleEmailSignUp = async () => {
    setError(""); setSuccess("");
    if (!email || !password || !confirmPassword) { setError("Please fill in all fields"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }
    setLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      setSuccess("Account created successfully!");
      setEmail(""); setPassword(""); setConfirmPassword("");
      setTimeout(() => onSwitch(), 1500);
    } catch (err) {
      if (err.message.includes("email-already-in-use")) setError("Email already in use");
      else if (err.message.includes("weak-password")) setError("Password is too weak");
      else setError(err.message);
    } finally { setLoading(false); }
  };

  const handleGoogleSignUp = async () => {
    setError(""); setSuccess(""); setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      setSuccess("Account created with Google!");
    } catch (err) {
      if (err.code !== "auth/popup-closed-by-user") setError(err.message);
    } finally { setLoading(false); }
  };

  return (
    <div style={styles.card}>
      <p style={{ color: "#6b7280", fontSize: "12px", margin: "0 0 4px" }}>Create your account</p>
      <h2 style={styles.cardTitle}>Sign up</h2>
      <p style={{ ...styles.cardSub, marginBottom: "24px" }}>
        Already have an account?{" "}
        <span style={styles.switchLink} onClick={onSwitch}>Sign in</span>
      </p>

      {error && <div style={{ ...styles.alert, ...styles.errorAlert }}>{error}</div>}
      {success && <div style={{ ...styles.alert, ...styles.successAlert }}>{success}</div>}

      {/* Google only */}
      <button
        onClick={handleGoogleSignUp} disabled={loading}
        style={{
          ...styles.socialBtn, marginBottom: "20px",
          background: "#141414", opacity: loading ? 0.5 : 1,
          cursor: loading ? "not-allowed" : "pointer",
        }}
        onMouseEnter={(e) => !loading && (e.currentTarget.style.background = "#1a1a1a")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "#141414")}
      >
        <GoogleIcon /> Continue with Google
      </button>

      <div style={styles.divider}>
        <div style={styles.dividerLine} />
        <span style={styles.dividerText}>Or sign up with email</span>
        <div style={styles.dividerLine} />
      </div>

      <TextInput label="Email address" type="email" placeholder="" value={email} onChange={(e) => setEmail(e.target.value)} hasError={!!error} />

      <div style={{ marginBottom: "6px" }}><label style={styles.label}>Password</label></div>
      <div style={{ marginBottom: "16px" }}>
        <PasswordInput placeholder="" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>

      <div style={{ marginBottom: "6px" }}><label style={styles.label}>Confirm Password</label></div>
      <div style={{ marginBottom: "16px" }}>
        <PasswordInput placeholder="" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleEmailSignUp()} />
      </div>

      <button
        onClick={handleEmailSignUp} disabled={loading}
        style={{ ...styles.primaryBtn, opacity: loading ? 0.7 : 1, cursor: loading ? "not-allowed" : "pointer" }}
      >
        {loading ? "Creating account..." : "Create Account"}
      </button>

      {/* <p style={styles.footer}>Abdul Wali Khan University Mardan — Final Year Project</p> */}
    </div>
  );
}

// ==================== MAIN ====================
export default function Login() {
  const [view, setView] = useState("signin");
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", color: "#fff" }}>
          Loading...
        </div>
      </div>
    );
  }

  if (currentUser) {
    return (
      <div style={styles.page}>
        <style>{globalStyles}</style>
        <div style={{ ...styles.bgBlob, animation: "float 20s ease-in-out infinite" }} />
        <div style={styles.bgBlob2} />
        <div style={styles.left} className="auth-left">
          <div style={styles.leftContent}>
            <div style={styles.logoRow}>
              <div style={styles.logoIcon}><NetworkIcon size={26} /></div>
              <div>
                <p style={styles.logoText}>AI Network Chatbot</p>
                <p style={styles.logoSub}>Cisco IOS Command Generator</p>
              </div>
            </div>
            <h1 style={styles.tagline} className="auth-tagline">Welcome!</h1>
            <p style={{ color: "#9ca3af", fontSize: "16px", lineHeight: 1.6 }}>You are now signed in.</p>
          </div>
        </div>
        <div style={styles.right} className="auth-right">
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Account Details</h2>
            <div style={{ ...styles.alert, ...styles.successAlert, marginBottom: "20px" }}>Successfully signed in</div>
            <div style={{ marginBottom: "14px" }}>
              <label style={styles.label}>Email</label>
              <div style={{ ...styles.input, padding: "11px 14px", color: "#e5e7eb" }}>{currentUser.email}</div>
            </div>
            <div style={{ marginBottom: "14px" }}>
              <label style={styles.label}>UID</label>
              <div style={{ ...styles.input, padding: "11px 14px", wordBreak: "break-all", fontSize: "11px", color: "#9ca3af" }}>{currentUser.uid}</div>
            </div>
            {currentUser.displayName && (
              <div style={{ marginBottom: "14px" }}>
                <label style={styles.label}>Name</label>
                <div style={{ ...styles.input, padding: "11px 14px", color: "#e5e7eb" }}>{currentUser.displayName}</div>
              </div>
            )}
            <button onClick={() => signOut(auth)} style={{ ...styles.primaryBtn, background: "linear-gradient(135deg, #ef4444, #dc2626)", marginTop: "8px" }}>
              Sign Out
            </button>
            {/* <p style={styles.footer}>Abdul Wali Khan University Mardan — Final Year Project</p> */}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page} className="auth-page">
      <style>{globalStyles}</style>
      <div style={{ ...styles.bgBlob, animation: "float 20s ease-in-out infinite" }} />
      <div style={styles.bgBlob2} />
      <div style={styles.left} className="auth-left">
        <div style={styles.leftContent}>
          <div style={styles.logoRow}>
            <div style={styles.logoIcon}><NetworkIcon size={26} /></div>
            <div>
              <p style={styles.logoText}>AI Network Chatbot</p>
              <p style={styles.logoSub}>Cisco IOS Command Generator</p>
            </div>
          </div>
          <h1 style={styles.tagline} className="auth-tagline">Sign In Or{"\n"}Create An Account</h1>
        </div>
      </div>
      <div style={styles.right} className="auth-right">
        {view === "signin"
          ? <SignInPanel onSwitch={() => setView("signup")} />
          : <SignUpPanel onSwitch={() => setView("signin")} />
        }
      </div>
    </div>
  );
}
