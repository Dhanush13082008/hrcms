import React, { useState, useEffect, createContext, useContext } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Home,
  LayoutDashboard,
  MessageSquare,
  DoorOpen,
  Users,
  ChartNoAxesCombined,
  Settings,
  LogOut,
  ArrowUpRight,
  ArrowRight,
  Plus,
  Search,
  ChevronRight,
  ChevronLeft,
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  X,
  Menu,
  LoaderCircle,
  Building2,
  Wrench,
  ShieldCheck,
  UserRound,
  Mail,
  KeyRound,
  Eye,
  EyeOff,
  ArrowLeft,
  Star,
  Send,
  Download,
  CheckCircle2,
  LifeBuoy,
  MapPin,
  BedDouble,
  Wind,
  CalendarDays,
  SlidersHorizontal,
  RefreshCw,
  Inbox,
  MoreHorizontal,
  Pencil,
  Layers,
  CheckCircle,
} from 'lucide-react';
import { api, setToken } from './api';
import './styles.css';

const Context = createContext(null);
const useApp = () => useContext(Context);
const statuses = [
  'OPEN',
  'ASSIGNED',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
  'REJECTED',
];
const labels = {
  OPEN: 'Open',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
  REJECTED: 'Rejected',
  STUDENT: 'Student',
  WARDEN: 'Warden',
  STAFF: 'Maintenance',
  ADMIN: 'Administrator',
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  VACATED: 'Vacated',
  AVAILABLE: 'Available',
  FULL: 'Full',
  BLOCKED: 'Unavailable',
};
const fmtDate = (v, options = { month: 'short', day: 'numeric' }) =>
  v
    ? new Date(
        v.length === 10 ? v + 'T00:00:00' : v.replace(' ', 'T') + 'Z',
      ).toLocaleDateString('en-IN', options)
    : '—';
const money = (v) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(v || 0);
const initials = (name) =>
  (name || '?')
    .split(' ')
    .slice(0, 2)
    .map((s) => s[0])
    .join('');
const nowYear = () => {
  const y = new Date().getFullYear();
  return `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
};
function navigate(path) {
  window.location.hash = path;
}
function useRoute() {
  const [route, setRoute] = useState(window.location.hash.slice(1) || '/');
  useEffect(() => {
    const f = () => setRoute(window.location.hash.slice(1) || '/');
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return route;
}
function useData(path) {
  const { revision } = useApp();
  const [state, setState] = useState({
    data: null,
    loading: true,
    error: null,
  });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    if (!path) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    api(path)
      .then((data) => {
        if (active) setState({ data, loading: false, error: null });
      })
      .catch((error) => {
        if (active)
          setState({ data: null, loading: false, error: error.message });
      });
    return () => {
      active = false;
    };
  }, [path, revision, version]);
  return { ...state, reload: () => setVersion((v) => v + 1) };
}
function Button({
  children,
  variant = 'primary',
  className = '',
  busy = false,
  disabled = false,
  ...props
}) {
  return (
    <button
      className={`btn ${variant} ${className}`}
      disabled={busy || disabled}
      {...props}
    >
      {busy ? <LoaderCircle size={16} className="spin" /> : null}
      {children}
    </button>
  );
}
function Badge({ value }) {
  return (
    <span className={`badge ${value?.toLowerCase()}`}>
      <span className="dot" />
      {labels[value] || value}
    </span>
  );
}
function Priority({ value }) {
  return (
    <span className={`priority ${value?.toLowerCase()}`}>
      <span />
      {labels[value]}
    </span>
  );
}
function Empty({
  icon: Icon = Inbox,
  title = 'Nothing here yet',
  text = 'New records will appear here.',
  action,
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon size={28} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
function Loading() {
  return (
    <div className="loading">
      <LoaderCircle className="spin" size={24} />
      <span>Getting things ready…</span>
    </div>
  );
}
function ErrorBox({ message, retry }) {
  return (
    <div className="error-box" role="alert">
      <AlertCircle size={20} />
      <div>
        <strong>We couldn’t load this</strong>
        <p>{message}</p>
      </div>
      {retry && (
        <Button variant="ghost" onClick={retry}>
          <RefreshCw size={16} />
          Retry
        </Button>
      )}
    </div>
  );
}
function Resource({ state, children }) {
  if (state.loading) return <Loading />;
  if (state.error)
    return <ErrorBox message={state.error} retry={state.reload} />;
  return children(state.data);
}
function PageHeader({ eyebrow, title, subtitle, action }) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action}
    </div>
  );
}
function Field({ label, children, hint }) {
  const labelId = React.useId();
  const hintId = React.useId();
  const associate = (child) => {
    if (!React.isValidElement(child)) return child;
    if (['input', 'select', 'textarea'].includes(child.type)) {
      return React.cloneElement(child, {
        'aria-labelledby': labelId,
        'aria-describedby': hint ? hintId : undefined,
      });
    }
    if (child.type === 'div') {
      return React.cloneElement(child, {
        children: React.Children.map(child.props.children, associate),
      });
    }
    return child;
  };
  return (
    <label className="field">
      <span id={labelId}>{label}</span>
      {React.Children.map(children, associate)}
      {hint && <small id={hintId}>{hint}</small>}
    </label>
  );
}
function Modal({ title, subtitle, onClose, children, wide = false }) {
  useEffect(() => {
    const before = document.activeElement;
    const key = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const items = [
          ...document.querySelectorAll(
            '.modal [tabindex="0"],.modal button:not([disabled]),.modal input,.modal select,.modal textarea',
          ),
        ].filter((e) => e.offsetParent !== null);
        const first = items[0],
          last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', key);
    document.body.style.overflow = 'hidden';
    document.querySelector('.modal input,.modal select,.modal button')?.focus();
    return () => {
      document.removeEventListener('keydown', key);
      document.body.style.overflow = '';
      before?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className={`modal ${wide ? 'wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-heading">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            className="icon-btn"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
function useSubmit() {
  const { notify, refresh } = useApp();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const submit = async (fn, onSuccess) => {
    setBusy(true);
    setError('');
    try {
      const result = await fn();
      notify(result.message || 'Saved successfully');
      refresh();
      onSuccess?.(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, submit };
}
function FormError({ error }) {
  return error ? (
    <div className="form-error" role="alert">
      <AlertCircle size={16} />
      {error}
    </div>
  ) : null;
}

function Login({ onLogin }) {
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const demos = [
    ['Student', 'arjun@student.edu', UserRound],
    ['Warden', 'warden.a@hrcms.edu', ShieldCheck],
    ['Staff', 'ramesh@hrcms.edu', Wrench],
    ['Admin', 'admin@hrcms.edu', Settings],
  ];
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      onLogin(
        await api('/auth/login', { method: 'POST', body: { email, password } }),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="login-page">
      <section className="login-story">
        <a className="brand light" href="#/">
          <span className="brand-mark">
            <Home size={23} />
          </span>
          haven<span className="brand-period">.</span>
        </a>
        <div className="story-content">
          <span className="story-kicker">
            <span className="live-dot" />A LITTLE MORE LIKE HOME
          </span>
          <h1>
            A better place
            <br />
            to call <em>home.</em>
          </h1>
          <p>
            Less paperwork. Quicker fixes. More room for the things that matter.
          </p>
          <div className="building-art" aria-hidden="true">
            <div className="art-sun" />
            <div className="art-cloud cloud-one" />
            <div className="art-building building-back">
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
            <div className="art-building building-front">
              {Array.from({ length: 12 }, (_, i) => (
                <i key={i} />
              ))}
              <div className="art-door" />
            </div>
            <div className="art-tree tree-one" />
            <div className="art-tree tree-two" />
            <div className="art-ground" />
          </div>
          <div className="story-features">
            <span>
              <DoorOpen size={16} />
              Your space
            </span>
            <span>
              <Wrench size={16} />
              Support that works
            </span>
            <span>
              <Users size={16} />
              Your community
            </span>
          </div>
        </div>
        <div className="login-footer">
          HOSTEL ROOM & COMPLAINT MANAGEMENT<span>Made for campus life.</span>
        </div>
      </section>
      <section className="login-form-area">
        <div className="login-form">
          <span className="eyebrow">WELCOME TO HAVEN</span>
          <h2>Good to have you here.</h2>
          <p>Sign in to your hostel workspace.</p>
          <form onSubmit={submit}>
            <Field label="Email address">
              <div className="input-icon">
                <Mail size={18} />
                <input
                  type="email"
                  autoComplete="username"
                  required
                  placeholder="you@hrcms.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </Field>
            <Field label="Password">
              <div className="input-icon">
                <KeyRound size={18} />
                <input
                  type={show ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="password-toggle"
                  aria-label={show ? 'Hide password' : 'Show password'}
                  onClick={() => setShow(!show)}
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </Field>
            <FormError error={error} />
            <Button busy={busy} className="full" type="submit">
              Sign in to Haven
              <ArrowRight size={17} />
            </Button>
          </form>
          <div className="demo-divider">
            <span>EXPLORE WITH A DEMO ACCOUNT</span>
          </div>
          <div className="demo-grid">
            {demos.map(([label, address, Icon]) => (
              <button
                type="button"
                key={label}
                onClick={() => {
                  setEmail(address);
                  setPassword('Hostel@123');
                  setError('');
                }}
              >
                <Icon size={18} />
                {label}
                <ArrowUpRight size={13} />
              </button>
            ))}
          </div>
          <p className="demo-note">
            Choose a role, then sign in. Demo password: <code>Hostel@123</code>
          </p>
          <div className="login-security">
            <ShieldCheck size={15} />
            Secure access. One connected campus.
          </div>
        </div>
        <span className="login-copyright">
          © {new Date().getFullYear()} Haven · HRCMS
        </span>
      </section>
    </div>
  );
}

const navigation = [
  {
    path: '/',
    label: 'Overview',
    icon: LayoutDashboard,
    roles: ['STUDENT', 'WARDEN', 'STAFF', 'ADMIN'],
  },
  {
    path: '/complaints',
    label: 'Complaints',
    staffLabel: 'My work orders',
    icon: MessageSquare,
    roles: ['STUDENT', 'WARDEN', 'STAFF', 'ADMIN'],
  },
  { path: '/my-room', label: 'My room', icon: DoorOpen, roles: ['STUDENT'] },
  {
    path: '/rooms',
    label: 'Rooms & allotments',
    icon: DoorOpen,
    roles: ['WARDEN', 'ADMIN'],
  },
  {
    path: '/team',
    label: 'Maintenance team',
    icon: Users,
    roles: ['WARDEN', 'ADMIN'],
  },
  {
    path: '/reports',
    label: 'Reports & insights',
    icon: ChartNoAxesCombined,
    roles: ['WARDEN', 'ADMIN'],
  },
  {
    path: '/admin',
    label: 'Administration',
    icon: SlidersHorizontal,
    roles: ['ADMIN'],
  },
];
function Shell({ route, children }) {
  const { user, logout } = useApp();
  const [mobile, setMobile] = useState(false);
  useEffect(() => setMobile(false), [route]);
  const current = navigation.find((n) =>
    n.path === '/' ? route === '/' : route.startsWith(n.path),
  );
  return (
    <div className="app-shell">
      {mobile && (
        <div className="sidebar-scrim" onClick={() => setMobile(false)} />
      )}
      <aside className={`sidebar ${mobile ? 'open' : ''}`}>
        <a className="brand" href="#/">
          <span className="brand-mark">
            <Home size={23} />
          </span>
          haven<span className="brand-period">.</span>
        </a>
        <div className="workspace-label">
          <span className="workspace-icon">
            <Building2 size={16} />
          </span>
          <div>
            Campus workspace<small>Hostel management</small>
          </div>
          <span className="tiny-dot" />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {navigation
            .filter((n) => n.roles.includes(user.role))
            .map((n) => (
              <a
                key={n.path}
                href={'#' + n.path}
                className={current?.path === n.path ? 'active' : ''}
              >
                <n.icon size={19} />
                {user.role === 'STAFF' && n.staffLabel ? n.staffLabel : n.label}
                {current?.path === n.path && (
                  <span className="nav-active-dot" />
                )}
              </a>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <a className={route === '/help' ? 'active' : ''} href="#/help">
            <LifeBuoy size={18} />
            Help & guidance
            <ArrowUpRight size={14} />
          </a>
          <div className="sidebar-note">
            <span className="tiny-dot" />A little care goes a long way.
            <p>Let’s make hostel life better, together.</p>
          </div>
          <button className="user-chip" onClick={() => navigate('/profile')}>
            <span className="avatar">{initials(user.full_name)}</span>
            <span>
              <strong>{user.full_name}</strong>
              <small>{labels[user.role]}</small>
            </span>
            <Settings size={16} />
          </button>
          <button className="logout" onClick={logout}>
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-btn mobile-menu"
              onClick={() => setMobile(true)}
              aria-label="Open navigation"
            >
              <Menu size={21} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>
              {current
                ? user.role === 'STAFF' && current.staffLabel
                  ? current.staffLabel
                  : current.label
                : route === '/profile'
                  ? 'Your profile'
                  : 'Help & guidance'}
            </strong>
          </div>
          <div className="topbar-right">
            <span className="today">
              <CalendarDays size={15} />
              {new Date().toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
            <span className="topbar-divider" />
            <span className="role-tag">{labels[user.role]} workspace</span>
            <button
              className="avatar small"
              aria-label="Open profile"
              onClick={() => navigate('/profile')}
            >
              {initials(user.full_name)}
            </button>
          </div>
        </header>
        <main key={route.split('?')[0]}>{children}</main>
        <footer className="app-footer">
          <span>
            Haven <span>·</span> A little more like home.
          </span>
          <span>HRCMS / CAMPUS OPERATIONS</span>
        </footer>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, foot, tone = 'green', onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`stat-card ${tone}`}
    >
      <div className="stat-top">
        <span>{label}</span>
        <span className="stat-icon">
          <Icon size={19} />
        </span>
      </div>
      <div className="stat-value">{value ?? 0}</div>
      <div className="stat-foot">
        {foot}
        {onClick && <ArrowUpRight size={14} />}
      </div>
    </button>
  );
}
function ComplaintTable({ items, compact = false }) {
  return (
    <div className="table-scroll">
      <table className="complaint-table">
        <thead>
          <tr>
            <th>COMPLAINT</th>
            {!compact && <th>ROOM</th>}
            <th>STATUS</th>
            <th>PRIORITY</th>
            <th>RAISED</th>
            <th aria-label="Open" />
          </tr>
        </thead>
        <tbody>
          {items.map((c) => (
            <tr
              key={c.complaint_id}
              onClick={() => navigate('/complaints/' + c.complaint_id)}
            >
              <td>
                <button
                  className="table-title"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate('/complaints/' + c.complaint_id);
                  }}
                >
                  {c.title}
                </button>
                <span className="table-sub">
                  #{String(c.complaint_id).padStart(4, '0')} <span>·</span>{' '}
                  {c.category_name}
                  {compact && ` · ${c.room_number}`}
                </span>
              </td>
              {!compact && (
                <td>
                  <span className="room-label">{c.room_number}</span>
                  <span className="table-sub">{c.block_name}</span>
                </td>
              )}
              <td>
                <Badge value={c.status} />
                {!!c.is_overdue && (
                  <span className="overdue-text">Past SLA</span>
                )}
              </td>
              <td>
                <Priority value={c.priority} />
              </td>
              <td className="muted nowrap">{fmtDate(c.created_at)}</td>
              <td>
                <ChevronRight size={16} className="muted" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Dashboard() {
  const { user } = useApp();
  const state = useData('/dashboard'),
    room = useData(user.role === 'STUDENT' ? '/rooms/my' : null);
  const [newComplaint, setNewComplaint] = useState(false);
  const name =
    user.full_name === 'Hostel Administrator'
      ? 'Admin'
      : user.full_name
          .replace(/^Dr\.\s*/, '')
          .split(/\s+/)
          .find((part) => part.replaceAll('.', '').length > 1) ||
        user.full_name;
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  return (
    <>
      <PageHeader
        eyebrow="YOUR CAMPUS, AT A GLANCE"
        title={
          <>
            {greeting}, {name}
            <span className="greeting-dot">.</span>
          </>
        }
        subtitle={
          user.role === 'STUDENT'
            ? 'Make yourself at home. Here’s what’s happening in your space.'
            : user.role === 'STAFF'
              ? 'A little maintenance makes a big difference. Here’s your day ahead.'
              : 'A clear view of your hostel, so you can focus on what needs care.'
        }
        action={
          user.role === 'STUDENT' ? (
            <Button onClick={() => setNewComplaint(true)}>
              <Plus size={17} />
              New complaint
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => navigate('/complaints')}>
              View complaints
              <ArrowUpRight size={17} />
            </Button>
          )
        }
      />
      <Resource state={state}>
        {({ data: d }) => (
          <>
            <section className="welcome-banner">
              <div className="welcome-copy">
                <span className="banner-label">
                  <span className="live-dot" />
                  YOUR HOSTEL, CONNECTED
                </span>
                <h2>
                  {user.role === 'STUDENT'
                    ? 'Your space. Our care.'
                    : user.role === 'STAFF'
                      ? 'Small fixes. Better days.'
                      : 'A well-run hostel starts here.'}
                </h2>
                <p>
                  {user.role === 'STUDENT'
                    ? 'A dripping tap or a flickering light? Tell us. We’ll take it from here.'
                    : user.role === 'STAFF'
                      ? 'Keep work moving, leave a clear update, and help someone feel at home.'
                      : 'Keep rooms organised, your team connected, and every concern accounted for.'}
                </p>
                <button
                  className="text-link"
                  onClick={() =>
                    user.role === 'STUDENT'
                      ? setNewComplaint(true)
                      : navigate('/reports')
                  }
                >
                  {user.role === 'STUDENT'
                    ? 'Let’s get it fixed'
                    : 'See the bigger picture'}
                  <ArrowRight size={16} />
                </button>
              </div>
              <div className="banner-art" aria-hidden="true">
                <div className="banner-circle" />
                <Building2 size={120} strokeWidth={1} />
                <div className="banner-mini">
                  <Check size={15} />A little more like home
                </div>
              </div>
            </section>
            <div className="stats-grid">
              <StatCard
                label="Active complaints"
                value={d.stats.active}
                icon={MessageSquare}
                foot="Being taken care of"
                onClick={() => navigate('/complaints')}
              />
              <StatCard
                label={
                  user.role === 'STAFF' ? 'Jobs completed' : 'Resolved & closed'
                }
                value={d.stats.resolved}
                icon={CheckCheck}
                tone="sage"
                foot="A step toward better living"
                onClick={() => navigate('/complaints?status=COMPLETED')}
              />
              <StatCard
                label={
                  user.role === 'STUDENT'
                    ? 'Awaiting your feedback'
                    : 'Awaiting feedback'
                }
                value={d.stats.awaiting_feedback}
                icon={Star}
                tone="yellow"
                foot="Ready for a final check"
                onClick={() => navigate('/complaints?status=RESOLVED')}
              />
              <StatCard
                label={d.occupancy ? 'Available beds' : 'Past service target'}
                value={d.occupancy ? d.occupancy.available : d.stats.overdue}
                icon={d.occupancy ? BedDouble : Clock}
                tone="peach"
                foot={
                  d.occupancy
                    ? `${d.occupancy.occupied} of ${d.occupancy.beds} beds occupied`
                    : 'A little extra attention needed'
                }
                onClick={() =>
                  navigate(d.occupancy ? '/rooms' : '/complaints?overdue=true')
                }
              />
            </div>
            <div className="dashboard-columns">
              <section className="panel recent-panel">
                <div className="panel-heading">
                  <div>
                    <h2>
                      {user.role === 'STAFF'
                        ? 'Your recent work orders'
                        : 'Recent complaints'}
                    </h2>
                    <p>A small update makes a big difference.</p>
                  </div>
                  <button
                    className="text-link subtle"
                    onClick={() => navigate('/complaints')}
                  >
                    View all
                    <ArrowUpRight size={15} />
                  </button>
                </div>
                {d.complaints.length ? (
                  <ComplaintTable items={d.complaints} compact />
                ) : (
                  <Empty
                    title="All quiet here"
                    text="Your complaints and updates will appear here."
                  />
                )}
              </section>
              <div className="dashboard-side">
                {user.role === 'STUDENT' ? (
                  <section className="panel my-room-widget">
                    <div className="mini-heading">
                      <span>YOUR ROOM</span>
                      <DoorOpen size={18} />
                    </div>
                    <Resource state={room}>
                      {(r) =>
                        r.data ? (
                          <>
                            <div className="room-widget-title">
                              {r.data.room_number}
                              <span>{r.data.block_name}</span>
                            </div>
                            <div className="room-widget-details">
                              <span>
                                <BedDouble size={16} />
                                {r.data.type_code.toLowerCase()} sharing
                              </span>
                              <span>
                                <Users size={16} />
                                {r.data.occupied} / {r.data.capacity} occupied
                              </span>
                            </div>
                            <div className="room-widget-bottom">
                              <span className="badge available">
                                <span className="dot" />
                                You’re all settled
                              </span>
                              <button
                                className="round-arrow"
                                aria-label="View my room"
                                onClick={() => navigate('/my-room')}
                              >
                                <ArrowUpRight size={18} />
                              </button>
                            </div>
                          </>
                        ) : (
                          <Empty
                            icon={DoorOpen}
                            title="A room awaits"
                            text="Contact your warden to get a room allotted."
                          />
                        )
                      }
                    </Resource>
                  </section>
                ) : (
                  <section className="panel occupancy-widget">
                    <div className="mini-heading">
                      <span>
                        {d.occupancy ? 'ROOM OCCUPANCY' : 'YOUR PROGRESS'}
                      </span>
                      <ChartNoAxesCombined size={18} />
                    </div>
                    <div
                      className="occupancy-ring"
                      style={{
                        '--progress': `${d.occupancy ? (d.occupancy.beds ? (d.occupancy.occupied / d.occupancy.beds) * 100 : 0) : d.stats.total ? (d.stats.resolved / d.stats.total) * 100 : 0}%`,
                      }}
                    >
                      <div>
                        <strong>
                          {Math.round(
                            d.occupancy
                              ? d.occupancy.beds
                                ? (d.occupancy.occupied / d.occupancy.beds) *
                                  100
                                : 0
                              : d.stats.total
                                ? (d.stats.resolved / d.stats.total) * 100
                                : 0,
                          )}
                          %
                        </strong>
                        <span>{d.occupancy ? 'occupied' : 'completed'}</span>
                      </div>
                    </div>
                    <p>
                      {d.occupancy
                        ? `${d.occupancy.rooms} rooms across your workspace`
                        : `${d.stats.resolved} of ${d.stats.total} work orders completed`}
                    </p>
                  </section>
                )}
                <section className="care-card">
                  <span className="care-icon">
                    <LifeBuoy size={21} />
                  </span>
                  <h3>A little help, right here.</h3>
                  <p>
                    Find out how room allotments, complaints, and updates work.
                  </p>
                  <button
                    className="text-link"
                    onClick={() => navigate('/help')}
                  >
                    Visit the help desk
                    <ArrowUpRight size={15} />
                  </button>
                </section>
              </div>
            </div>
          </>
        )}
      </Resource>
      {newComplaint && <NewComplaint onClose={() => setNewComplaint(false)} />}
    </>
  );
}

function NewComplaint({ onClose }) {
  const categories = useData('/categories');
  const [d, setD] = useState({
    category_id: '',
    title: '',
    description: '',
    priority: '',
  });
  const { busy, error, submit } = useSubmit();
  const set = (k, v) => setD((s) => ({ ...s, [k]: v }));
  return (
    <Modal
      title="Let’s get it fixed."
      subtitle="Tell us what needs attention. Your current room is linked automatically."
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(
            () =>
              api('/complaints', {
                method: 'POST',
                body: { ...d, priority: d.priority || null },
              }),
            (r) => {
              onClose();
              navigate('/complaints/' + r.data.complaint_id);
            },
          );
        }}
      >
        <Resource state={categories}>
          {({ data }) => (
            <Field label="What needs care?">
              <select
                required
                value={d.category_id}
                onChange={(e) => set('category_id', e.target.value)}
              >
                <option value="">Choose a category</option>
                {data.map((c) => (
                  <option key={c.category_id} value={c.category_id}>
                    {c.category_name} · {c.sla_hours}h service target
                  </option>
                ))}
              </select>
            </Field>
          )}
        </Resource>
        <Field label="Give it a short title">
          <input
            required
            minLength={5}
            maxLength={120}
            value={d.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="e.g. Ceiling fan isn’t working"
          />
        </Field>
        <Field
          label="Tell us a little more"
          hint="Include the location and when you noticed the issue."
        >
          <textarea
            required
            minLength={10}
            maxLength={5000}
            rows={4}
            value={d.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Describe the issue so our team can come prepared…"
          />
        </Field>
        <Field
          label="How urgent is it?"
          hint="Leave this as recommended to use the category’s default priority."
        >
          <select
            value={d.priority}
            onChange={(e) => set('priority', e.target.value)}
          >
            <option value="">Use recommended priority</option>
            {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => (
              <option key={p} value={p}>
                {labels[p]}
              </option>
            ))}
          </select>
        </Field>
        <FormError error={error} />
        <div className="modal-actions">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" busy={busy}>
            <Send size={16} />
            Submit complaint
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function Complaints({ route }) {
  const { user } = useApp();
  const query = route.includes('?') ? route.slice(route.indexOf('?') + 1) : '';
  const initial = new URLSearchParams(query);
  const [status, setStatus] = useState(initial.get('status') || ''),
    [priority, setPriority] = useState(''),
    [overdue, setOverdue] = useState(initial.get('overdue') === 'true'),
    [search, setSearch] = useState(''),
    [searchQuery, setSearchQuery] = useState(''),
    [page, setPage] = useState(1),
    [showNew, setShowNew] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      setSearchQuery(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);
  const params = new URLSearchParams({
    status,
    priority,
    search: searchQuery,
    page: String(page),
    overdue: String(overdue),
  });
  for (const [k, v] of [...params]) if (!v) params.delete(k);
  const state = useData('/complaints?' + params.toString());
  return (
    <>
      <PageHeader
        eyebrow={
          user.role === 'STAFF'
            ? 'EVERY FIX COUNTS'
            : 'A LITTLE CARE GOES A LONG WAY'
        }
        title={user.role === 'STAFF' ? 'Your work orders' : 'Complaints'}
        subtitle={
          user.role === 'STUDENT'
            ? 'Raise a concern, follow its progress, and help us close the loop.'
            : 'Keep every concern moving toward a resolution.'
        }
        action={
          user.role === 'STUDENT' && (
            <Button onClick={() => setShowNew(true)}>
              <Plus size={17} />
              New complaint
            </Button>
          )
        }
      />
      <section className="panel">
        <div className="complaint-tabs">
          <button
            className={!status ? 'selected' : ''}
            onClick={() => {
              setStatus('');
              setPage(1);
            }}
          >
            All complaints
          </button>
          {['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map((s) => (
            <button
              key={s}
              className={status === s ? 'selected' : ''}
              onClick={() => {
                setStatus(s);
                setPage(1);
              }}
            >
              {labels[s]}
            </button>
          ))}
        </div>
        <div className="filter-bar">
          <div className="input-icon search">
            <Search size={17} />
            <input
              aria-label="Search complaints"
              placeholder="Search complaints, rooms, people…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="filter-select">
            <select
              aria-label="Filter status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              <option value="COMPLETED">Resolved & closed</option>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {labels[s]}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter priority"
              value={priority}
              onChange={(e) => {
                setPriority(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All priorities</option>
              {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((s) => (
                <option key={s} value={s}>
                  {labels[s]}
                </option>
              ))}
            </select>
            <button
              className={`filter-toggle ${overdue ? 'selected' : ''}`}
              onClick={() => {
                setOverdue(!overdue);
                setPage(1);
              }}
            >
              <Clock size={15} />
              Past SLA
            </button>
          </div>
        </div>
        <Resource state={state}>
          {(result) =>
            result.data.length ? (
              <>
                <ComplaintTable items={result.data} />
                <div className="table-footer">
                  <span>
                    {result.total} complaint{result.total !== 1 ? 's' : ''} ·
                    Page {result.page} of{' '}
                    {Math.max(1, Math.ceil(result.total / result.page_size))}
                  </span>
                  <div>
                    <Button
                      variant="ghost"
                      disabled={page === 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ChevronLeft size={16} />
                      Previous
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={page * result.page_size >= result.total}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                      <ChevronRight size={16} />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <Empty
                title="No complaints found"
                text={
                  search || status || priority || overdue
                    ? 'Try another filter or search term.'
                    : 'Everything looks good. Your new complaints will appear here.'
                }
                action={
                  user.role === 'STUDENT' && (
                    <Button
                      variant="secondary"
                      onClick={() => setShowNew(true)}
                    >
                      <Plus size={16} />
                      Raise a complaint
                    </Button>
                  )
                }
              />
            )
          }
        </Resource>
      </section>
      {showNew && <NewComplaint onClose={() => setShowNew(false)} />}
    </>
  );
}

function ComplaintDetail({ id }) {
  const { user } = useApp();
  const state = useData('/complaints/' + id);
  const [action, setAction] = useState(null);
  return (
    <>
      <button className="back-link" onClick={() => navigate('/complaints')}>
        <ArrowLeft size={16} />
        Back to complaints
      </button>
      <Resource state={state}>
        {({ data: c }) => (
          <>
            <PageHeader
              eyebrow={`COMPLAINT #${String(c.complaint_id).padStart(4, '0')}`}
              title={c.title}
              subtitle={`${c.room_number} · ${c.block_name} · Raised ${fmtDate(c.created_at, { day: 'numeric', month: 'long', year: 'numeric' })}`}
              action={<Badge value={c.status} />}
            />
            <div className="detail-grid">
              <div>
                <section className="panel detail-body">
                  <div className="detail-section-title">
                    <MessageSquare size={19} />
                    <h2>The concern</h2>
                    <Priority value={c.priority} />
                  </div>
                  <p className="description-text">{c.description}</p>
                  <div className="detail-meta">
                    <div>
                      <span>CATEGORY</span>
                      <strong>{c.category_name}</strong>
                    </div>
                    <div>
                      <span>RAISED BY</span>
                      <strong>{c.student_name}</strong>
                    </div>
                    <div>
                      <span>ASSIGNED TO</span>
                      <strong>{c.staff_name || 'Awaiting assignment'}</strong>
                    </div>
                    <div>
                      <span>SERVICE TARGET</span>
                      <strong>
                        {c.sla_hours} hours
                        {!!c.is_overdue && (
                          <small className="overdue-text">Past target</small>
                        )}
                      </strong>
                    </div>
                  </div>
                </section>
                <section className="panel timeline-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Every step, accounted for.</h2>
                      <p>Your complaint’s journey, from raised to resolved.</p>
                    </div>
                    <Clock size={20} className="muted" />
                  </div>
                  <ol className="timeline">
                    {c.history.map((log, i) => (
                      <li key={log.log_id}>
                        <span
                          className={`timeline-mark ${i === c.history.length - 1 ? 'latest' : ''}`}
                        >
                          {i === c.history.length - 1 ? (
                            <Check size={13} />
                          ) : (
                            <span />
                          )}
                        </span>
                        <div>
                          <div className="timeline-top">
                            <strong>
                              {log.old_status === log.new_status
                                ? 'Assignment updated'
                                : labels[log.new_status]}
                            </strong>
                            <time>
                              {fmtDate(log.changed_at, {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </time>
                          </div>
                          <p>{log.remark || 'Status updated'}</p>
                          <small>{log.changed_by_name || 'System'}</small>
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
                {c.feedback && (
                  <section className="panel feedback-card">
                    <div className="stars">
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star
                          key={i}
                          size={20}
                          fill={i < c.feedback.rating ? 'currentColor' : 'none'}
                        />
                      ))}
                    </div>
                    <h3>Thanks for closing the loop.</h3>
                    <p>{c.feedback.comments || 'Feedback submitted.'}</p>
                    <small>{fmtDate(c.feedback.submitted_at)}</small>
                  </section>
                )}
              </div>
              <aside>
                <section className="panel action-card">
                  <h2>What’s next?</h2>
                  {['WARDEN', 'ADMIN'].includes(user.role) &&
                  ['OPEN', 'ASSIGNED'].includes(c.status) ? (
                    <>
                      <p>Find the right person to take care of this.</p>
                      <Button
                        className="full"
                        onClick={() => setAction('assign')}
                      >
                        <Wrench size={16} />
                        {c.assigned_staff_id
                          ? 'Reassign staff'
                          : 'Assign to staff'}
                      </Button>
                      <Button
                        variant="ghost"
                        className="full danger-text"
                        onClick={() => setAction('REJECTED')}
                      >
                        Reject with a reason
                      </Button>
                    </>
                  ) : user.role === 'STAFF' &&
                    ['ASSIGNED', 'IN_PROGRESS'].includes(c.status) ? (
                    <>
                      <p>
                        {c.status === 'ASSIGNED'
                          ? 'Ready when you are. Start work to keep the student updated.'
                          : 'All fixed? Leave a remark so the student knows what changed.'}
                      </p>
                      <Button
                        className="full"
                        onClick={() =>
                          setAction(
                            c.status === 'ASSIGNED'
                              ? 'IN_PROGRESS'
                              : 'RESOLVED',
                          )
                        }
                      >
                        {c.status === 'ASSIGNED' ? (
                          <Wrench size={16} />
                        ) : (
                          <CheckCircle2 size={16} />
                        )}{' '}
                        {c.status === 'ASSIGNED'
                          ? 'Start work'
                          : 'Mark resolved'}
                      </Button>
                    </>
                  ) : user.role === 'STUDENT' && c.status === 'RESOLVED' ? (
                    <>
                      <p>
                        Our team has marked this as resolved. Is everything
                        working well?
                      </p>
                      <Button
                        className="full"
                        onClick={() => setAction('feedback')}
                      >
                        <Star size={16} />
                        Rate & close complaint
                      </Button>
                      <Button
                        className="full"
                        variant="ghost"
                        onClick={() => setAction('OPEN')}
                      >
                        Still an issue? Reopen
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="action-illustration">
                        <CheckCircle2 size={35} />
                      </span>
                      <p>
                        {c.status === 'CLOSED'
                          ? 'All wrapped up. Thanks for helping us keep Haven running smoothly.'
                          : c.status === 'REJECTED'
                            ? 'This complaint has been reviewed. See the timeline for the reason.'
                            : c.status === 'RESOLVED'
                              ? 'The repair is complete. Waiting for the student to confirm and rate it.'
                              : 'Your complaint is with the team. Each update will appear in the timeline.'}
                      </p>
                    </>
                  )}
                </section>
                <div className="help-note">
                  <ShieldCheck size={19} />
                  <p>
                    Every status change is saved automatically, so everyone
                    stays on the same page.
                  </p>
                </div>
              </aside>
            </div>
            {action && (
              <ComplaintAction
                action={action}
                complaint={c}
                onClose={() => setAction(null)}
              />
            )}
          </>
        )}
      </Resource>
    </>
  );
}
function ComplaintAction({ action, complaint: c, onClose }) {
  const staff = useData(
    action === 'assign'
      ? `/staff?block_id=${c.block_id}&category_id=${c.category_id}`
      : null,
  );
  const [staffId, setStaffId] = useState(''),
    [remark, setRemark] = useState(''),
    [rating, setRating] = useState(0);
  const { busy, error, submit } = useSubmit();
  const titles = {
    assign: 'The right person for the job.',
    feedback: 'How did we do?',
    OPEN: 'Let’s take another look.',
    IN_PROGRESS: 'Ready to get started?',
    RESOLVED: 'All fixed up?',
    REJECTED: 'Why is this being rejected?',
  };
  return (
    <Modal title={titles[action]} subtitle={c.title} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(
            () =>
              action === 'assign'
                ? api(`/complaints/${c.complaint_id}/assign`, {
                    method: 'POST',
                    body: { staff_id: staffId },
                  })
                : action === 'feedback'
                  ? api(`/complaints/${c.complaint_id}/feedback`, {
                      method: 'POST',
                      body: { rating, comments: remark || null },
                    })
                  : api(`/complaints/${c.complaint_id}/status`, {
                      method: 'PATCH',
                      body: { status: action, remark },
                    }),
            onClose,
          );
        }}
      >
        {action === 'assign' ? (
          <Resource state={staff}>
            {({ data }) =>
              data.length ? (
                <Field label="Available specialists">
                  <select
                    required
                    value={staffId}
                    onChange={(e) => setStaffId(e.target.value)}
                  >
                    <option value="">Choose a staff member</option>
                    {data.map((s) => (
                      <option key={s.staff_id} value={s.staff_id}>
                        {s.full_name} · {s.active_jobs} active jobs
                      </option>
                    ))}
                  </select>
                </Field>
              ) : (
                <div className="notice">
                  <AlertCircle size={18} />
                  <p>
                    No active specialist is available for this category and
                    block. Ask an administrator to add or update a staff
                    account.
                  </p>
                </div>
              )
            }
          </Resource>
        ) : (
          <>
            {action === 'feedback' && (
              <Field label="Your rating">
                <div className="rating-input" role="group" aria-label="Rating">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      aria-label={`Rate ${n} star${n > 1 ? 's' : ''}`}
                      aria-pressed={rating === n}
                      onClick={() => setRating(n)}
                    >
                      <Star
                        size={34}
                        fill={n <= rating ? 'currentColor' : 'none'}
                      />
                    </button>
                  ))}
                  <span>{rating ? `${rating} of 5` : 'Choose a rating'}</span>
                </div>
              </Field>
            )}
            <Field
              label={
                action === 'feedback'
                  ? 'Anything you’d like to add? (optional)'
                  : 'Leave an update'
              }
            >
              <textarea
                rows={4}
                required={action !== 'feedback'}
                minLength={action === 'feedback' ? 0 : 3}
                maxLength={action === 'feedback' ? 500 : 255}
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder={
                  action === 'RESOLVED'
                    ? 'What did you fix or replace?'
                    : action === 'OPEN'
                      ? 'Tell us what still needs attention…'
                      : 'A short, helpful update…'
                }
              />
            </Field>
          </>
        )}
        <FormError error={error} />
        <div className="modal-actions">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            busy={busy}
            disabled={
              action === 'feedback'
                ? !rating
                : action === 'assign'
                  ? !staffId
                  : false
            }
            type="submit"
          >
            {action === 'feedback'
              ? 'Submit & close'
              : action === 'assign'
                ? 'Assign complaint'
                : 'Save update'}
            <Check size={16} />
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function MyRoom() {
  const state = useData('/rooms/my');
  return (
    <>
      <PageHeader
        eyebrow="YOUR LITTLE CORNER OF CAMPUS"
        title="Make yourself at home."
        subtitle="Your room, your roommates, and all the details in one place."
      />
      <Resource state={state}>
        {(result) =>
          result.data ? (
            <>
              <div className="my-room-grid">
                <section className="room-hero">
                  <div className="room-hero-top">
                    <span className="banner-label">
                      {result.data.block_name.toUpperCase()}
                    </span>
                    <Badge value="ACTIVE" />
                  </div>
                  <DoorOpen
                    className="room-hero-icon"
                    size={110}
                    strokeWidth={1}
                  />
                  <h2>{result.data.room_number}</h2>
                  <p>
                    Floor {result.data.floor_no} ·{' '}
                    {result.data.type_code.toLowerCase()} sharing
                    {result.data.has_ac ? ' · Air conditioned' : ''}
                  </p>
                  <div className="room-hero-footer">
                    <span>
                      <CalendarDays size={16} />
                      Home since{' '}
                      {fmtDate(result.data.allocated_on, {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </span>
                    <Home size={22} />
                  </div>
                </section>
                <section className="panel room-detail-card">
                  <div className="panel-heading">
                    <h2>The little details</h2>
                    <Layers size={19} />
                  </div>
                  <dl>
                    <div>
                      <dt>
                        <BedDouble size={18} />
                        Room capacity
                      </dt>
                      <dd>{result.data.capacity} beds</dd>
                    </div>
                    <div>
                      <dt>
                        <Users size={18} />
                        Currently occupied
                      </dt>
                      <dd>{result.data.occupied} beds</dd>
                    </div>
                    <div>
                      <dt>
                        <Wind size={18} />
                        Air conditioning
                      </dt>
                      <dd>{result.data.has_ac ? 'Included' : 'Non-AC'}</dd>
                    </div>
                    <div>
                      <dt>
                        <CalendarDays size={18} />
                        Academic year
                      </dt>
                      <dd>{result.data.academic_year}</dd>
                    </div>
                    <div>
                      <dt>
                        <Building2 size={18} />
                        Annual room fee
                      </dt>
                      <dd>{money(result.data.annual_fee)}</dd>
                    </div>
                  </dl>
                  <p className="fine-print">
                    Room fee is shown for reference. Contact the hostel office
                    for payment information.
                  </p>
                </section>
              </div>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Good company.</h2>
                    <p>The people who share your space.</p>
                  </div>
                  <span className="count-badge">
                    {result.data.roommates.length} roommate
                    {result.data.roommates.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {result.data.roommates.length ? (
                  <div className="roommate-list">
                    {result.data.roommates.map((r) => (
                      <div className="roommate" key={r.reg_no}>
                        <span className="avatar large">
                          {initials(r.full_name)}
                        </span>
                        <div>
                          <h3>{r.full_name}</h3>
                          <p>{r.reg_no}</p>
                          <small>
                            {r.department} · Year {r.year_of_study}
                          </small>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty
                    icon={Users}
                    title="A space of your own"
                    text="You don’t have any roommates at the moment."
                  />
                )}
              </section>
              <AllocationHistory items={result.history} />
            </>
          ) : (
            <>
              <section className="panel">
                <Empty
                  icon={DoorOpen}
                  title="Your next chapter starts here."
                  text="You don’t have an active room allotment yet. Contact your block warden to find your space."
                />
              </section>
              {result.history.length > 0 && (
                <AllocationHistory items={result.history} />
              )}
            </>
          )
        }
      </Resource>
    </>
  );
}
function AllocationHistory({ items }) {
  return (
    <section className="panel history-panel">
      <div className="panel-heading">
        <h2>Your room journey</h2>
        <Clock size={18} />
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>ROOM</th>
              <th>ACADEMIC YEAR</th>
              <th>ALLOTTED ON</th>
              <th>VACATED ON</th>
              <th>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.allocation_id}>
                <td>
                  <strong>{a.room_number}</strong>
                  <span className="table-sub">{a.block_name}</span>
                </td>
                <td>{a.academic_year}</td>
                <td>{fmtDate(a.allocated_on)}</td>
                <td>{fmtDate(a.vacated_on)}</td>
                <td>
                  <Badge value={a.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Rooms() {
  const rooms = useData('/rooms'),
    allocations = useData('/allocations');
  const [filter, setFilter] = useState(''),
    [block, setBlock] = useState(''),
    [view, setView] = useState('rooms'),
    [allocation, setAllocation] = useState(null),
    [vacating, setVacating] = useState(null);
  const blocks = [
    ...new Set((rooms.data?.data || []).map((r) => r.block_name)),
  ];
  return (
    <>
      <PageHeader
        eyebrow="A SPACE FOR EVERY STUDENT"
        title="Rooms & allotments"
        subtitle="A clear picture of who’s settled in and where there’s room for more."
        action={
          <Button onClick={() => setAllocation({})}>
            <Plus size={17} />
            Allot a room
          </Button>
        }
      />
      <section className="panel">
        <div className="complaint-tabs">
          <button
            className={view === 'rooms' ? 'selected' : ''}
            onClick={() => setView('rooms')}
          >
            Room overview
          </button>
          <button
            className={view === 'allotments' ? 'selected' : ''}
            onClick={() => setView('allotments')}
          >
            Active allotments
          </button>
        </div>
        <div className="filter-bar">
          <span className="list-caption">
            <DoorOpen size={17} />
            {rooms.data?.data.length || 0} rooms in your workspace
          </span>
          <div className="filter-select">
            <select
              aria-label="Filter block"
              value={block}
              onChange={(e) => setBlock(e.target.value)}
            >
              <option value="">All blocks</option>
              {blocks.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
            {view === 'rooms' && (
              <select
                aria-label="Filter availability"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="">All availability</option>
                <option value="AVAILABLE">Available</option>
                <option value="FULL">Full</option>
                <option value="BLOCKED">Blocked</option>
              </select>
            )}
          </div>
        </div>
        {view === 'rooms' ? (
          <Resource state={rooms}>
            {({ data }) => {
              const list = data.filter(
                (r) =>
                  (!filter || r.availability === filter) &&
                  (!block || r.block_name === block),
              );
              return list.length ? (
                <div className="rooms-grid">
                  {list.map((r) => (
                    <article
                      className={`room-card ${r.availability.toLowerCase()}`}
                      key={r.room_id}
                    >
                      <div className="room-card-top">
                        <span>
                          <DoorOpen size={20} />
                        </span>
                        <Badge value={r.availability} />
                      </div>
                      <h3>{r.room_number}</h3>
                      <p>
                        {r.block_name} · Floor {r.floor_no}
                      </p>
                      <div className="room-chips">
                        <span>
                          <BedDouble size={14} />
                          {r.type_code.toLowerCase()}
                        </span>
                        {!!r.has_ac && (
                          <span>
                            <Wind size={14} />
                            AC
                          </span>
                        )}
                      </div>
                      <div className="occupancy-line">
                        <span>
                          {r.occupied} <small>/ {r.capacity} beds</small>
                        </span>
                        <small>{r.vacancies} vacant</small>
                      </div>
                      <div className="progress-track">
                        <span
                          style={{
                            width: `${(r.occupied / r.capacity) * 100}%`,
                          }}
                        />
                      </div>
                      <Button
                        className="full"
                        variant="secondary"
                        disabled={r.availability !== 'AVAILABLE'}
                        onClick={() => setAllocation(r)}
                      >
                        {r.availability === 'AVAILABLE' ? (
                          <>
                            Allot room
                            <Plus size={15} />
                          </>
                        ) : r.availability === 'FULL' ? (
                          'Fully occupied'
                        ) : (
                          'Unavailable'
                        )}
                      </Button>
                    </article>
                  ))}
                </div>
              ) : (
                <Empty
                  icon={DoorOpen}
                  title="No rooms match"
                  text="Try another block or availability filter."
                />
              );
            }}
          </Resource>
        ) : (
          <Resource state={allocations}>
            {({ data }) => {
              const list = data.filter((a) => !block || a.block_name === block);
              return list.length ? (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>STUDENT</th>
                        <th>ROOM</th>
                        <th>ACADEMIC YEAR</th>
                        <th>ALLOTTED</th>
                        <th>ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((a) => (
                        <tr key={a.allocation_id}>
                          <td>
                            <strong>{a.full_name}</strong>
                            <span className="table-sub">
                              {a.reg_no} · {a.department}
                            </span>
                          </td>
                          <td>
                            <strong>{a.room_number}</strong>
                            <span className="table-sub">{a.block_name}</span>
                          </td>
                          <td>{a.academic_year}</td>
                          <td>{fmtDate(a.allocated_on)}</td>
                          <td>
                            <Button
                              variant="ghost"
                              className="danger-text"
                              onClick={() => setVacating(a)}
                            >
                              Vacate
                              <ArrowUpRight size={14} />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty
                  title="No active allotments"
                  text="New room allotments will appear here."
                />
              );
            }}
          </Resource>
        )}
      </section>
      {allocation && (
        <AllocateRoom room={allocation} onClose={() => setAllocation(null)} />
      )}{' '}
      {vacating && (
        <Confirm
          title={`Vacate ${vacating.full_name}’s room?`}
          text={`This ends the active allotment for ${vacating.room_number}. The history will be kept.`}
          action="Vacate room"
          onClose={() => setVacating(null)}
          run={() =>
            api(`/allocations/${vacating.allocation_id}/vacate`, {
              method: 'POST',
            })
          }
        />
      )}
    </>
  );
}
function AllocateRoom({ room, onClose }) {
  const rooms = useData('/rooms?availability=AVAILABLE'),
    students = useData('/students/unallocated');
  const [roomId, setRoomId] = useState(room.room_id || ''),
    [student, setStudent] = useState(''),
    [year, setYear] = useState(nowYear());
  const { busy, error, submit } = useSubmit();
  const selected = rooms.data?.data.find((r) => r.room_id === Number(roomId));
  return (
    <Modal
      title="A new place to settle in."
      subtitle="Allot an available room to a student. Capacity and block rules are checked automatically."
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(
            () =>
              api('/rooms/allocate', {
                method: 'POST',
                body: {
                  room_id: roomId,
                  student_id: student,
                  academic_year: year,
                },
              }),
            onClose,
          );
        }}
      >
        <Resource state={rooms}>
          {({ data }) => (
            <Field label="Room">
              <select
                required
                value={roomId}
                onChange={(e) => {
                  setRoomId(e.target.value);
                  setStudent('');
                }}
              >
                <option value="">Choose an available room</option>
                {data.map((r) => (
                  <option key={r.room_id} value={r.room_id}>
                    {r.room_number} · {r.block_name} · {r.vacancies} vacant ·{' '}
                    {r.gender_type.toLowerCase()}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </Resource>
        <Resource state={students}>
          {({ data }) => (
            <Field
              label="Student"
              hint="Only students without an active allotment and matching the block’s gender are shown."
            >
              <select
                required
                value={student}
                onChange={(e) => setStudent(e.target.value)}
              >
                <option value="">Choose a student</option>
                {data
                  .filter((s) => !selected || s.gender === selected.gender_type)
                  .map((s) => (
                    <option key={s.student_id} value={s.student_id}>
                      {s.full_name} · {s.reg_no}
                    </option>
                  ))}
              </select>
            </Field>
          )}
        </Resource>
        <Field label="Academic year">
          <input
            required
            pattern="[0-9]{4}-[0-9]{2}"
            maxLength={7}
            value={year}
            onChange={(e) => setYear(e.target.value)}
          />
        </Field>
        <FormError error={error} />
        <div className="modal-actions">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" busy={busy} disabled={!roomId || !student}>
            <Check size={16} />
            Confirm allotment
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function Confirm({ title, text, action, run, onClose }) {
  const { busy, error, submit } = useSubmit();
  return (
    <Modal title={title} onClose={onClose}>
      <p className="confirm-text">{text}</p>
      <FormError error={error} />
      <div className="modal-actions">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button busy={busy} onClick={() => submit(run, onClose)}>
          {action}
        </Button>
      </div>
    </Modal>
  );
}

function Team() {
  const state = useData('/staff');
  return (
    <>
      <PageHeader
        eyebrow="THE PEOPLE BEHIND THE FIXES"
        title="A team that cares."
        subtitle="Find the right specialist and keep workloads balanced."
      />
      <Resource state={state}>
        {({ data }) =>
          data.length ? (
            <div className="team-grid">
              {data.map((s) => (
                <section className="panel staff-card" key={s.staff_id}>
                  <div className="staff-card-top">
                    <span className="avatar large">
                      {initials(s.full_name)}
                    </span>
                    <Badge value="ACTIVE" />
                  </div>
                  <h2>{s.full_name}</h2>
                  <p>{s.category_name}</p>
                  <div className="staff-meta">
                    <span>
                      <MapPin size={15} />
                      {s.block_name}
                    </span>
                    <span>
                      <Clock size={15} />
                      {s.shift.toLowerCase()} shift
                    </span>
                  </div>
                  <div className="staff-workload">
                    <div>
                      <strong>{s.active_jobs}</strong>
                      <span>Active jobs</span>
                    </div>
                    <div>
                      <strong>{s.completed_jobs}</strong>
                      <span>Completed</span>
                    </div>
                  </div>
                  <a className="staff-email" href={`mailto:${s.email}`}>
                    <Mail size={15} />
                    {s.email}
                  </a>
                </section>
              ))}
            </div>
          ) : (
            <section className="panel">
              <Empty
                icon={Users}
                title="Your team is coming together"
                text="An administrator can create maintenance staff for your block."
              />
            </section>
          )
        }
      </Resource>
    </>
  );
}

function Reports() {
  const state = useData('/dashboard'),
    overdue = useData('/reports/overdue');
  const { notify } = useApp();
  const [exporting, setExporting] = useState(false);
  const download = async () => {
    setExporting(true);
    try {
      let page = 1,
        list = [],
        result;
      do {
        result = await api('/complaints?page=' + page++);
        list.push(...result.data);
      } while (list.length < result.total);
      const cell = (v) => {
        const str = String(v ?? '');
        return (
          '"' +
          (/^[=+@\-\t\r]/.test(str) ? "'" + str : str).replaceAll('"', '""') +
          '"'
        );
      };
      const csv = [
        [
          'ID',
          'Title',
          'Student',
          'Block',
          'Room',
          'Category',
          'Priority',
          'Status',
          'Assigned to',
          'Raised',
          'Resolved',
        ],
        ...list.map((c) => [
          c.complaint_id,
          c.title,
          c.student_name,
          c.block_name,
          c.room_number,
          c.category_name,
          c.priority,
          c.status,
          c.staff_name,
          c.created_at,
          c.resolved_at,
        ]),
      ]
        .map((r) => r.map(cell).join(','))
        .join('\r\n');
      const url = URL.createObjectURL(
        new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }),
      );
      const a = document.createElement('a');
      a.href = url;
      a.download = 'haven-complaints.csv';
      a.click();
      URL.revokeObjectURL(url);
      notify('Complaint report exported');
    } catch (e) {
      notify(e.message, 'error');
    } finally {
      setExporting(false);
    }
  };
  return (
    <>
      <PageHeader
        eyebrow="CLARITY FOR BETTER DECISIONS"
        title="The bigger picture."
        subtitle="See what’s working, what needs care, and where your team makes a difference."
        action={
          <Button variant="secondary" busy={exporting} onClick={download}>
            <Download size={16} />
            Export complaints
          </Button>
        }
      />
      <Resource state={state}>
        {({ data: d }) => (
          <>
            <div className="stats-grid">
              <StatCard
                label="Total complaints"
                value={d.stats.total}
                icon={MessageSquare}
                foot="Across your workspace"
              />
              <StatCard
                label="Average resolution"
                value={
                  d.metrics.avg_resolution_hours != null
                    ? d.metrics.avg_resolution_hours + 'h'
                    : '—'
                }
                icon={Clock}
                tone="sage"
                foot="For resolved complaints"
              />
              <StatCard
                label="Student satisfaction"
                value={
                  d.metrics.avg_rating != null
                    ? d.metrics.avg_rating + ' / 5'
                    : '—'
                }
                icon={Star}
                tone="yellow"
                foot="From submitted feedback"
              />
              <StatCard
                label="Past service target"
                value={d.stats.overdue}
                icon={AlertCircle}
                tone="peach"
                foot="Needs your attention"
              />
            </div>
            <div className="report-grid">
              <section className="panel chart-panel">
                <div className="panel-heading">
                  <div>
                    <h2>By category</h2>
                    <p>Where your hostel needs care.</p>
                  </div>
                  <Layers size={19} />
                </div>
                <div className="category-chart">
                  {d.by_category.length ? (
                    d.by_category.map((c, i) => (
                      <div className="category-bar" key={c.category_name}>
                        <div>
                          <span>{c.category_name}</span>
                          <strong>{c.total}</strong>
                        </div>
                        <div className="chart-track">
                          <span
                            style={{
                              width: `${(c.total / Math.max(...d.by_category.map((c) => c.total))) * 100}%`,
                              background: [
                                '#285c4b',
                                '#688b66',
                                '#a9b87a',
                                '#cfb16c',
                                '#b7c8a6',
                                '#e0bd96',
                              ][i % 6],
                            }}
                          />
                        </div>
                        <small>{c.resolved} resolved or closed</small>
                      </div>
                    ))
                  ) : (
                    <Empty
                      title="No data yet"
                      text="Charts will appear as complaints are raised."
                    />
                  )}
                </div>
              </section>
              <section className="panel chart-panel">
                <div className="panel-heading">
                  <div>
                    <h2>The resolution journey</h2>
                    <p>Every stage, in focus.</p>
                  </div>
                  <ChartNoAxesCombined size={19} />
                </div>
                <div className="status-chart">
                  {statuses.map((s) => {
                    const n =
                      d.by_status.find((c) => c.status === s)?.count || 0;
                    return (
                      <div key={s}>
                        <Badge value={s} />
                        <div className="chart-track">
                          <span
                            style={{
                              width: `${d.stats.total ? (n / d.stats.total) * 100 : 0}%`,
                            }}
                          />
                        </div>
                        <strong>{n}</strong>
                      </div>
                    );
                  })}
                </div>
                <div className="resolution-highlight">
                  <CheckCheck size={24} />
                  <div>
                    <strong>
                      {d.stats.total
                        ? Math.round((d.stats.resolved / d.stats.total) * 100)
                        : 0}
                      %
                    </strong>
                    <p>of complaints resolved or closed</p>
                  </div>
                </div>
              </section>
            </div>
          </>
        )}
      </Resource>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>A little extra attention.</h2>
            <p>
              Open complaints that have passed their category’s service target.
            </p>
          </div>
          <span className="badge urgent">
            <Clock size={13} />
            Past SLA
          </span>
        </div>
        <Resource state={overdue}>
          {({ data }) =>
            data.length ? (
              <ComplaintTable items={data} />
            ) : (
              <Empty
                icon={CheckCircle2}
                title="Right on track"
                text="No complaints are past their service target."
              />
            )
          }
        </Resource>
      </section>
    </>
  );
}

const adminResources = [
  ['users', 'People', Users],
  ['blocks', 'Hostel blocks', Building2],
  ['rooms', 'Rooms', DoorOpen],
  ['types', 'Room types', BedDouble],
  ['categories', 'Categories', Layers],
];
function Administration() {
  const [resource, setResource] = useState('users'),
    [search, setSearch] = useState(''),
    [editing, setEditing] = useState(null);
  const state = useData('/admin/' + resource);
  const name = adminResources.find((r) => r[0] === resource)[1];
  return (
    <>
      <PageHeader
        eyebrow="THE FOUNDATIONS OF YOUR CAMPUS"
        title="Administration"
        subtitle="Keep people, spaces, and services organised in one place."
        action={
          <div className="button-row">
            <Button onClick={() => setEditing({ isNew: true })}>
              <Plus size={17} />
              Add{' '}
              {resource === 'users'
                ? 'person'
                : resource === 'types'
                  ? 'room type'
                  : resource === 'categories'
                    ? 'category'
                    : resource === 'blocks'
                      ? 'block'
                      : 'room'}
            </Button>
            {resource === 'users' && (
              <Button
                variant="secondary"
                onClick={() =>
                  setEditing({ isNew: true, role: 'STUDENT', lockRole: true })
                }
              >
                <Plus size={17} />
                Add student
              </Button>
            )}
          </div>
        }
      />
      <section className="panel">
        <div className="admin-tabs">
          {adminResources.map(([key, label, Icon]) => (
            <button
              key={key}
              className={resource === key ? 'selected' : ''}
              onClick={() => {
                setResource(key);
                setSearch('');
              }}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>
        <div className="filter-bar">
          <span className="list-caption">
            {name}
            <span className="count-badge">{state.data?.data.length || 0}</span>
          </span>
          <div className="input-icon search">
            <Search size={17} />
            <input
              aria-label={`Search ${name}`}
              placeholder={`Search ${name.toLowerCase()}…`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <Resource state={state}>
          {({ data }) => {
            const list = data.filter((d) =>
              Object.values(d).some((v) =>
                String(v ?? '')
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              ),
            );
            return list.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>
                        {resource === 'users'
                          ? 'PERSON'
                          : resource === 'blocks'
                            ? 'BLOCK'
                            : resource === 'rooms'
                              ? 'ROOM'
                              : resource === 'types'
                                ? 'TYPE'
                                : 'CATEGORY'}
                      </th>
                      <th>DETAILS</th>
                      <th>
                        {resource === 'types'
                          ? 'ANNUAL FEE'
                          : resource === 'categories'
                            ? 'SERVICE TARGET'
                            : 'INFORMATION'}
                      </th>
                      <th>STATUS</th>
                      <th>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((d) => {
                      const key =
                        d.user_id ||
                        d.room_id ||
                        d.block_id ||
                        d.type_code ||
                        d.category_id;
                      return (
                        <tr key={key}>
                          <td>
                            <div className="person-cell">
                              {resource === 'users' && (
                                <span className="avatar">
                                  {initials(d.full_name)}
                                </span>
                              )}
                              <div>
                                <strong>
                                  {d.full_name ||
                                    (d.block_name &&
                                      resource === 'blocks' &&
                                      d.block_name) ||
                                    d.room_number ||
                                    d.type_code ||
                                    d.category_name}
                                </strong>
                                <span className="table-sub">
                                  {resource === 'users'
                                    ? d.email
                                    : resource === 'rooms'
                                      ? d.block_name
                                      : resource === 'blocks'
                                        ? `${d.total_floors} floors`
                                        : resource === 'types'
                                          ? `${d.capacity} beds`
                                          : `Default: ${labels[d.default_priority]}`}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td>
                            {resource === 'users' ? (
                              <span className="role-tag">{labels[d.role]}</span>
                            ) : resource === 'blocks' ? (
                              d.gender_type === 'MALE' ? (
                                'Men’s hostel'
                              ) : (
                                'Women’s hostel'
                              )
                            ) : resource === 'rooms' ? (
                              d.type_code
                            ) : resource === 'types' ? (
                              `${d.capacity} sharing`
                            ) : (
                              labels[d.default_priority]
                            )}
                          </td>
                          <td>
                            {resource === 'users'
                              ? d.reg_no || d.department || '—'
                              : resource === 'blocks'
                                ? `Warden #${d.warden_id || '—'}`
                                : resource === 'rooms'
                                  ? `${d.occupied} / ${d.capacity} occupied`
                                  : resource === 'types'
                                    ? money(d.annual_fee)
                                    : `${d.sla_hours} hours`}
                          </td>
                          <td>
                            <Badge
                              value={d.is_active ? 'ACTIVE' : 'INACTIVE'}
                            />
                          </td>
                          <td>
                            <Button
                              variant="ghost"
                              onClick={() => setEditing({ ...d, isNew: false })}
                            >
                              <Pencil size={14} />
                              Edit
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty
                title="No records found"
                text="Add a record or try another search."
              />
            );
          }}
        </Resource>
      </section>
      {editing && (
        <AdminForm
          resource={resource}
          existing={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

const resourceDefaults = {
  users: {
    full_name: '',
    email: '',
    password: '',
    role: 'STUDENT',
    is_active: true,
    phone_no: '',
    reg_no: '',
    gender: 'MALE',
    department: '',
    year_of_study: 1,
    guardian_name: '',
    designation: 'Warden',
    office_room: '',
    category_id: '',
    block_id: '',
    shift: 'MORNING',
  },
  blocks: {
    block_name: '',
    gender_type: 'MALE',
    total_floors: 3,
    warden_id: '',
    is_active: true,
  },
  rooms: {
    room_number: '',
    block_id: '',
    floor_no: 0,
    type_code: '',
    has_ac: false,
    status: 'ACTIVE',
    is_active: true,
  },
  types: { type_code: '', capacity: 2, annual_fee: 75000, is_active: true },
  categories: {
    category_name: '',
    default_priority: 'MEDIUM',
    sla_hours: 24,
    is_active: true,
  },
};
function AdminForm({ resource, existing, onClose }) {
  const isNew = existing.isNew;
  const [d, setD] = useState(() => {
    const base = { ...resourceDefaults[resource] };
    for (const key of Object.keys(base))
      if (existing[key] != null)
        base[key] =
          typeof base[key] === 'boolean' ? !!existing[key] : existing[key];
    return base;
  });
  const meta = useData('/admin/metadata');
  const { busy, error, submit } = useSubmit();
  const set = (k, v) => setD((s) => ({ ...s, [k]: v }));
  const input = (key, label, type = 'text', extra = {}) => (
    <Field label={label}>
      <input
        type={type}
        value={d[key]}
        onChange={(e) => set(key, e.target.value)}
        {...extra}
      />
    </Field>
  );
  const select = (key, label, options, extra = {}) => (
    <Field label={label}>
      <select
        value={d[key]}
        onChange={(e) => set(key, e.target.value)}
        {...extra}
      >
        {options.map((o) =>
          Array.isArray(o) ? (
            <option key={o[0]} value={o[0]}>
              {o[1]}
            </option>
          ) : (
            <option key={o} value={o}>
              {labels[o] || o}
            </option>
          ),
        )}
      </select>
    </Field>
  );
  const save = (e) => {
    e.preventDefault();
    const body = { ...d };
    if (resource === 'users') {
      if (!body.password) delete body.password;
      if (d.role !== 'STUDENT')
        for (const k of [
          'reg_no',
          'gender',
          'department',
          'year_of_study',
          'guardian_name',
        ])
          delete body[k];
      if (d.role !== 'WARDEN')
        for (const k of ['designation', 'office_room']) delete body[k];
      if (d.role !== 'STAFF')
        for (const k of ['category_id', 'block_id', 'shift']) delete body[k];
    }
    const key = {
      users: 'user_id',
      blocks: 'block_id',
      rooms: 'room_id',
      types: 'type_code',
      categories: 'category_id',
    }[resource];
    submit(
      () =>
        api(
          `/admin/${resource}${isNew ? '' : '/' + encodeURIComponent(existing[key])}`,
          { method: isNew ? 'POST' : 'PATCH', body },
        ),
      onClose,
    );
  };
  return (
    <Modal
      wide
      title={
        existing.lockRole
          ? 'Add student'
          : `${isNew ? 'Add' : 'Edit'} ${resource === 'users' ? 'person' : resource === 'types' ? 'room type' : resource === 'categories' ? 'category' : resource === 'blocks' ? 'hostel block' : 'room'}`
      }
      subtitle={
        existing.lockRole
          ? 'Create a student account with registration and academic details.'
          : 'Keep your campus details accurate and up to date.'
      }
      onClose={onClose}
    >
      <Resource state={meta}>
        {({ data: m }) => (
          <form onSubmit={save}>
            <div className="form-grid">
              {resource === 'users' ? (
                <>
                  {input('full_name', 'Full name', 'text', {
                    required: true,
                    maxLength: 100,
                  })}
                  {input('email', 'Email address', 'email', {
                    required: true,
                    maxLength: 120,
                  })}
                  {select(
                    'role',
                    'Role',
                    ['STUDENT', 'WARDEN', 'STAFF', 'ADMIN'],
                    { disabled: !isNew || existing.lockRole },
                  )}
                  {input(
                    'password',
                    isNew
                      ? 'Initial password'
                      : 'New password (leave blank to keep)',
                    'password',
                    {
                      required: isNew,
                      minLength: 10,
                      maxLength: 72,
                      autoComplete: 'new-password',
                    },
                  )}
                  {input('phone_no', 'Phone number', 'tel', {
                    pattern: '[0-9+][0-9]{9,14}',
                    maxLength: 15,
                  })}
                  {d.role === 'STUDENT' && (
                    <>
                      {input('reg_no', 'Register number', 'text', {
                        required: true,
                        maxLength: 15,
                      })}
                      {select('gender', 'Gender', ['MALE', 'FEMALE'])}
                      {input('department', 'Department', 'text', {
                        required: true,
                        maxLength: 60,
                      })}
                      {input('year_of_study', 'Year of study', 'number', {
                        min: 1,
                        max: 5,
                        required: true,
                      })}
                      {input('guardian_name', 'Guardian name', 'text', {
                        maxLength: 100,
                      })}
                    </>
                  )}
                  {d.role === 'WARDEN' && (
                    <>
                      {input('designation', 'Designation', 'text', {
                        required: true,
                        maxLength: 50,
                      })}
                      {input('office_room', 'Office room', 'text', {
                        maxLength: 20,
                      })}
                    </>
                  )}
                  {d.role === 'STAFF' && (
                    <>
                      {select(
                        'block_id',
                        'Hostel block',
                        [
                          ['', 'Choose block'],
                          ...m.blocks
                            .filter(
                              (b) =>
                                b.is_active ||
                                b.block_id === Number(d.block_id),
                            )
                            .map((b) => [b.block_id, b.block_name]),
                        ],
                        { required: true },
                      )}
                      {select(
                        'category_id',
                        'Specialisation',
                        [
                          ['', 'Choose category'],
                          ...m.categories
                            .filter(
                              (c) =>
                                c.is_active ||
                                c.category_id === Number(d.category_id),
                            )
                            .map((c) => [c.category_id, c.category_name]),
                        ],
                        { required: true },
                      )}
                      {select('shift', 'Shift', [
                        'MORNING',
                        'EVENING',
                        'NIGHT',
                      ])}
                    </>
                  )}
                </>
              ) : resource === 'blocks' ? (
                <>
                  {input('block_name', 'Block name', 'text', {
                    required: true,
                    maxLength: 30,
                  })}
                  {select('gender_type', 'Hostel gender', ['MALE', 'FEMALE'])}
                  {input('total_floors', 'Number of floors', 'number', {
                    required: true,
                    min: 1,
                    max: 20,
                  })}
                  {select('warden_id', 'Managing warden', [
                    ['', 'No warden assigned'],
                    ...m.wardens.map((w) => [w.user_id, w.full_name]),
                  ])}
                </>
              ) : resource === 'rooms' ? (
                <>
                  {input('room_number', 'Room number', 'text', {
                    required: true,
                    maxLength: 10,
                  })}
                  {select(
                    'block_id',
                    'Block',
                    [
                      ['', 'Choose block'],
                      ...m.blocks.map((b) => [b.block_id, b.block_name]),
                    ],
                    { required: true },
                  )}
                  {input('floor_no', 'Floor number (ground = 0)', 'number', {
                    min: 0,
                    max: 20,
                    required: true,
                  })}
                  {select(
                    'type_code',
                    'Room type',
                    [
                      ['', 'Choose type'],
                      ...m.types.map((t) => [
                        t.type_code,
                        `${t.type_code} · ${t.capacity} beds`,
                      ]),
                    ],
                    { required: true },
                  )}
                  {select('status', 'Room status', [
                    ['ACTIVE', 'Available for allotment'],
                    ['UNDER_MAINTENANCE', 'Under maintenance'],
                  ])}
                  <label className="checkbox-field">
                    <input
                      type="checkbox"
                      checked={d.has_ac}
                      onChange={(e) => set('has_ac', e.target.checked)}
                    />
                    Air conditioning
                  </label>
                </>
              ) : resource === 'types' ? (
                <>
                  {input('type_code', 'Type code', 'text', {
                    required: true,
                    maxLength: 10,
                    pattern: '[A-Z0-9_]+',
                    readOnly: !isNew,
                  })}
                  {input('capacity', 'Capacity (beds)', 'number', {
                    min: 1,
                    max: 6,
                    required: true,
                  })}
                  {input('annual_fee', 'Annual fee (₹)', 'number', {
                    min: 0,
                    max: 99999999.99,
                    step: 0.01,
                    required: true,
                  })}
                </>
              ) : (
                <>
                  {input('category_name', 'Category name', 'text', {
                    required: true,
                    maxLength: 40,
                  })}
                  {select('default_priority', 'Default priority', [
                    'LOW',
                    'MEDIUM',
                    'HIGH',
                    'URGENT',
                  ])}
                  {input('sla_hours', 'Service target (hours)', 'number', {
                    min: 1,
                    max: 32767,
                    required: true,
                  })}
                </>
              )}
            </div>
            <label className="checkbox-field active-checkbox">
              <input
                type="checkbox"
                checked={d.is_active}
                onChange={(e) => set('is_active', e.target.checked)}
              />
              <span>
                Active
                <small>Inactive records remain available in history.</small>
              </span>
            </label>
            <FormError error={error} />
            <div className="modal-actions">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" busy={busy}>
                <Check size={16} />
                {isNew ? 'Create record' : 'Save changes'}
              </Button>
            </div>
          </form>
        )}
      </Resource>
    </Modal>
  );
}

function Profile() {
  const { user, setUser } = useApp();
  const state = useData('/profile');
  return (
    <>
      <PageHeader
        eyebrow="YOUR CORNER OF HAVEN"
        title="Your profile"
        subtitle="A few details that help us keep in touch."
      />
      <Resource state={state}>
        {({ data }) => (
          <ProfileForms
            profile={data}
            onUpdate={(name) => setUser({ ...user, full_name: name })}
          />
        )}
      </Resource>
    </>
  );
}
function ProfileForms({ profile: p, onUpdate }) {
  const [d, setD] = useState({
    full_name: p.full_name,
    phone_no: p.phones[0] || '',
  });
  const [pw, setPw] = useState({ current_password: '', new_password: '' });
  const basic = useSubmit(),
    password = useSubmit();
  return (
    <div className="profile-grid">
      <section className="panel profile-card">
        <span className="avatar profile-avatar">{initials(p.full_name)}</span>
        <h2>{p.full_name}</h2>
        <span className="role-tag">{labels[p.role]}</span>
        <div className="profile-info">
          <span>
            <Mail size={16} />
            {p.email}
          </span>
          {p.reg_no && (
            <span>
              <UserRound size={16} />
              {p.reg_no}
            </span>
          )}
          {p.department && (
            <span>
              <Building2 size={16} />
              {p.department} · Year {p.year_of_study}
            </span>
          )}
          {p.block_name && (
            <span>
              <MapPin size={16} />
              {p.block_name}
            </span>
          )}
        </div>
        <small>
          Part of Haven since{' '}
          {fmtDate(p.created_at, { month: 'long', year: 'numeric' })}
        </small>
      </section>
      <div>
        <section className="panel settings-panel">
          <h2>Personal details</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              basic.submit(
                () => api('/profile', { method: 'PATCH', body: d }),
                () => onUpdate(d.full_name),
              );
            }}
          >
            <Field label="Full name">
              <input
                required
                minLength={2}
                maxLength={100}
                value={d.full_name}
                onChange={(e) => setD({ ...d, full_name: e.target.value })}
              />
            </Field>
            <Field label="Phone number">
              <input
                type="tel"
                pattern="[0-9+][0-9]{9,14}"
                maxLength={15}
                value={d.phone_no}
                onChange={(e) => setD({ ...d, phone_no: e.target.value })}
              />
            </Field>
            <FormError error={basic.error} />
            <Button type="submit" busy={basic.busy}>
              Save details
              <Check size={16} />
            </Button>
          </form>
        </section>
        <section className="panel settings-panel">
          <h2>Change password</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              password.submit(
                () => api('/profile/password', { method: 'PATCH', body: pw }),
                () => setPw({ current_password: '', new_password: '' }),
              );
            }}
          >
            <Field label="Current password">
              <input
                required
                type="password"
                autoComplete="current-password"
                value={pw.current_password}
                onChange={(e) =>
                  setPw({ ...pw, current_password: e.target.value })
                }
              />
            </Field>
            <Field
              label="New password"
              hint="At least 10 characters, with upper/lower case letters and a number."
            >
              <input
                required
                minLength={10}
                maxLength={72}
                type="password"
                autoComplete="new-password"
                value={pw.new_password}
                onChange={(e) => setPw({ ...pw, new_password: e.target.value })}
              />
            </Field>
            <FormError error={password.error} />
            <Button type="submit" variant="secondary" busy={password.busy}>
              Update password
              <KeyRound size={16} />
            </Button>
          </form>
        </section>
      </div>
    </div>
  );
}
function Help() {
  const { user } = useApp();
  const guides =
    user.role === 'STUDENT'
      ? [
          [
            'Find your space',
            'My room shows your current allotment, roommates, room details and past allotments. If you have no room yet, contact your warden.',
          ],
          [
            'Raise a concern',
            'Choose New complaint, select a category and describe the problem. The complaint is linked to your current room. One unresolved complaint per room and category is allowed.',
          ],
          [
            'Follow the journey',
            'Open a complaint to see its status, assigned staff and timeline. Once resolved, rate the work to close it, or reopen it with a reason.',
          ],
        ]
      : user.role === 'STAFF'
        ? [
            [
              'Your work, in one place',
              'My work orders lists only complaints assigned to you. Filter by status and priority to plan your day.',
            ],
            [
              'Keep everyone in the loop',
              'Start an assigned job to move it to In progress. When done, mark it Resolved with a helpful repair note. The student then confirms it with feedback.',
            ],
          ]
        : [
            [
              'Allot rooms with confidence',
              'Rooms & allotments shows capacity, occupancy and vacancies. Choose an available room and a student without an active allotment. Block gender and room capacity are enforced.',
            ],
            [
              'Get the right help',
              'Open a complaint and assign it to a matching specialist in the same block. A complaint can be reassigned while Assigned. To reject a request, leave a reason.',
            ],
            [
              'See what needs attention',
              'Reports & insights shows category totals, resolution times, feedback ratings and complaints past their service target. Export complaints to CSV for further review.',
            ],
            ...(user.role === 'ADMIN'
              ? [
                  [
                    'Keep campus details current',
                    'Administration lets you create and edit people, blocks, rooms, room types and complaint categories. Deactivate records to preserve history. Vacate rooms and reassign work before deactivating accounts.',
                  ],
                ]
              : []),
          ];
  return (
    <>
      <PageHeader
        eyebrow="A LITTLE GUIDANCE GOES A LONG WAY"
        title="How can we help?"
        subtitle="A quick guide to making the most of your Haven workspace."
      />
      <div className="help-layout">
        <section className="panel help-guides">
          {guides.map(([title, text], i) => (
            <div className="help-guide" key={title}>
              <span>{String(i + 1).padStart(2, '0')}</span>
              <div>
                <h2>{title}</h2>
                <p>{text}</p>
              </div>
            </div>
          ))}
        </section>
        <section className="care-card help-contact">
          <LifeBuoy size={31} />
          <h2>Need a person?</h2>
          <p>
            Contact your hostel office or block warden for allotments, account
            changes, or urgent support.
          </p>
          <div className="notice">
            <AlertCircle size={18} />
            <p>
              For an immediate safety concern, contact hostel security directly.
              Complaint forms are for maintenance requests.
            </p>
          </div>
        </section>
      </div>
      <section className="panel workflow-guide">
        <h2>From concern to care.</h2>
        <div>
          {['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map(
            (s, i) => (
              <React.Fragment key={s}>
                <Badge value={s} />
                {i < 4 && <ArrowRight size={17} />}
              </React.Fragment>
            ),
          )}
        </div>
        <p>
          Every change is recorded automatically. A resolved complaint can be
          reopened by its owner if the issue persists.
        </p>
      </section>
    </>
  );
}

class ErrorBoundary extends React.Component {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="fatal-error">
        <AlertCircle size={32} />
        <h1>Something didn’t load correctly.</h1>
        <p>Refresh the page to get back to your workspace.</p>
        <Button onClick={() => window.location.reload()}>Refresh page</Button>
      </div>
    ) : (
      this.props.children
    );
  }
}
function App() {
  const [user, setUser] = useState(null),
    [ready, setReady] = useState(false),
    [revision, setRevision] = useState(0),
    [toast, setToast] = useState(null);
  const route = useRoute();
  const logout = () => {
    setToken(null);
    setUser(null);
    navigate('/');
  };
  const notify = (message, type = 'success') => setToast({ message, type });
  useEffect(() => {
    const expired = () => {
      logout();
      notify('Your session ended. Please sign in again.', 'error');
    };
    window.addEventListener('haven:expired', expired);
    if (sessionStorage.getItem('haven_token'))
      api('/auth/me')
        .then((r) => setUser(r.data))
        .catch((e) => {
          setToken(null);
          notify(e.message, 'error');
        })
        .finally(() => setReady(true));
    else setReady(true);
    return () => window.removeEventListener('haven:expired', expired);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);
  let page;
  if (route.startsWith('/complaints/'))
    page = <ComplaintDetail id={route.split('/')[2]} />;
  else if (route.startsWith('/complaints'))
    page = <Complaints key={route} route={route} />;
  else if (route === '/my-room' && user?.role === 'STUDENT') page = <MyRoom />;
  else if (route === '/rooms' && ['ADMIN', 'WARDEN'].includes(user?.role))
    page = <Rooms />;
  else if (route === '/team' && ['ADMIN', 'WARDEN'].includes(user?.role))
    page = <Team />;
  else if (route === '/reports' && ['ADMIN', 'WARDEN'].includes(user?.role))
    page = <Reports />;
  else if (route === '/admin' && user?.role === 'ADMIN')
    page = <Administration />;
  else if (route === '/profile') page = <Profile />;
  else if (route === '/help') page = <Help />;
  else if (route === '/') page = <Dashboard />;
  else
    page = (
      <Empty
        title="This page isn’t in your workspace"
        text="Head back to your overview to find what you need."
        action={<Button onClick={() => navigate('/')}>Go to overview</Button>}
      />
    );
  return (
    <ErrorBoundary>
      <Context.Provider
        value={{
          user,
          setUser,
          logout,
          revision,
          refresh: () => setRevision((v) => v + 1),
          notify,
        }}
      >
        {!ready ? (
          <div className="boot">
            <Loading />
          </div>
        ) : !user ? (
          <Login
            onLogin={({ token, user }) => {
              setToken(token);
              setUser(user);
              navigate('/');
            }}
          />
        ) : (
          <Shell route={route}>{page}</Shell>
        )}
        {toast && (
          <div role="status" className={`toast ${toast.type}`}>
            <span>
              {toast.type === 'error' ? (
                <AlertCircle size={19} />
              ) : (
                <CheckCircle2 size={19} />
              )}
            </span>
            {toast.message}
            <button
              className="icon-btn"
              aria-label="Dismiss notification"
              onClick={() => setToast(null)}
            >
              <X size={16} />
            </button>
          </div>
        )}
      </Context.Provider>
    </ErrorBoundary>
  );
}
createRoot(document.getElementById('root')).render(<App />);
