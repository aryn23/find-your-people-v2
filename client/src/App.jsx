import { useState, useEffect } from 'react';
import axios from 'axios';
import { supabase } from './supabaseClient';
import './App.css';

const API = 'https://find-your-people-v2-production.up.railway.app';

function App() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);

  // Form states
  const [type, setType] = useState('study');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [timing, setTiming] = useState('');
  const [formError, setFormError] = useState('');
  const [joinedIds, setJoinedIds] = useState([]);
  // Disable past dates and cap selection to 1 year ahead
  const todayStr = new Date().toISOString().split('T')[0];
  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() + 1);
  const maxStr = maxDate.toISOString().split('T')[0];

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) fetchPosts();
  }, [filter, user]);

  const fetchPosts = async () => {
    setLoading(true);
    setError('');
    try {
      const url = filter === 'all' ? `${API}/posts` : `${API}/posts?type=${filter}`;
      const res = await axios.get(url);
      setPosts(res.data);
    } catch (err) {
      setError('Failed to load posts. Make sure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (isSignUp) => {
    if (!email || !password) {
      alert('Please enter both email and password.');
      return;
    }

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;

        if (data?.user?.identities?.length === 0) {
          alert('An account with this email already exists. Please log in instead.');
          return;
        }
        alert('Account created successfully!');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (
            error.message.toLowerCase().includes('invalid login credentials') ||
            error.message.toLowerCase().includes('user not found')
          ) {
            alert('No account found with this email, or the password is incorrect. Please sign up first.');
          } else {
            alert(error.message);
          }
          return;
        }
      }
    } catch (err) {
      if (err.message.toLowerCase().includes('user already registered')) {
        alert('An account with this email already exists. Please log in instead.');
      } else {
        alert(err.message);
      }
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!title.trim() || !description.trim()) {
      setFormError('Title and description are required.');
      return;
    }
    try {
      await axios.post(`${API}/posts`, {
        type,
        title,
        description,
        tags,
        timing,
        user_id: user.id
      });
      setTitle('');
      setDescription('');
      setTags('');
      setTiming('');
      setShowModal(false);
      fetchPosts();
    } catch (err) {
      setFormError('Failed to create post.');
    }
  };

  const handleJoin = async (id) => {
    const name = user.email.split('@')[0];
    try {
      await axios.post(`${API}/posts/${id}/join`, { 
        user_name: name,
        user_id: user.id
      });
      fetchPosts();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update join status.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;
    try {
      await axios.delete(`${API}/posts/${id}`, {
        data: { user_id: user.id }
      });
      fetchPosts();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete post.');
    }
  };

  if (!user) {
    return (
      <div className="login-container">
        <div className="login-card">
          <h1>Find Your People 🎓</h1>
          <p className="subtitle">Student Login</p>
          <input
            className="auth-input"
            placeholder="University Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="auth-input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="submit-btn auth-btn" onClick={() => handleAuth(false)}>Log In</button>
          <button className="new-btn auth-btn" onClick={() => handleAuth(true)}>Sign Up</button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      {/* Left Sidebar */}
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-icon">🎓</span>
          <h2>Find your peeps</h2>
        </div>

        <nav className="nav-menu">
          <button
            className={`nav-item ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            <span className="icon">🏠</span> Dashboard (All)
          </button>
          <button
            className={`nav-item ${filter === 'study' ? 'active' : ''}`}
            onClick={() => setFilter('study')}
          >
            <span className="icon">📘</span> Study Groups
          </button>
          <button
            className={`nav-item ${filter === 'project' ? 'active' : ''}`}
            onClick={() => setFilter('project')}
          >
            <span className="icon">🚀</span> Project Teams
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="user-profile">
            <span className="user-dot"></span>
            <span className="user-name">{user.email.split('@')[0]}</span>
          </div>
          <button className="nav-logout" onClick={handleLogout}>
            🚪 Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header className="topbar">
          <div>
            <h1>Dashboard</h1>
            <p className="topbar-sub">Find study partners and project collaborators</p>
          </div>
          <button className="action-btn" onClick={() => setShowModal(true)}>
            + Add New Post
          </button>
        </header>

        {/* Modal for Creating New Post */}
        {showModal && (
          <div className="modal-backdrop" onClick={() => setShowModal(false)}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Create New Listing</h3>
                <button className="close-btn" onClick={() => setShowModal(false)}>✕</button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="type-toggle">
                  <button
                    type="button"
                    className={type === 'study' ? 'active' : ''}
                    onClick={() => setType('study')}
                  >
                    📘 Study Group
                  </button>
                  <button
                    type="button"
                    className={type === 'project' ? 'active' : ''}
                    onClick={() => setType('project')}
                  >
                    🚀 Project Team
                  </button>
                </div>
                <input
                  placeholder="Title (e.g., OS Unit-5 Prep)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
                <textarea
                  placeholder="Description..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
                <div className="form-row">
                  <input
                    placeholder="Tags (comma separated)"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                  />
                  {/* Native Date Picker */}
                  <input
                    type="date"
                    className="date-input"
                    min={todayStr}
                    max={maxStr}
                    value={timing}
                    onChange={(e) => setTiming(e.target.value)}
                  />
                </div>
                {formError && <p className="error">⚠ {formError}</p>}
                <button type="submit" className="submit-btn" style={{ width: '100%', marginTop: '12px' }}>
                  Post to Hub 🚀
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Content Status */}
        {loading && (
          <div className="status">
            <div className="spinner"></div>
            <p>Loading listings...</p>
          </div>
        )}
        {error && <p className="status error">⚠ {error}</p>}
        {!loading && !error && posts.length === 0 && (
          <div className="status empty">
            <p className="empty-emoji">📭</p>
            <p>No listings found in this category. Click "+ Add New Post" above to start one!</p>
          </div>
        )}

        {/* Cards Grid */}
        {/* Cards Grid */}
        <div className="grid-container">
          {posts.map((post) => {
            const userName = user.email.split('@')[0];
            const isJoined = post.members?.some(
              (m) => m.user_id === user.id || m.user_name === userName
            );
            const count = post.interested_count ?? (post.members ? post.members.length : 0);

            return (
              <div key={post.id} className="grid-card">
                <div className="grid-card-header">
                  <span className={`pill ${post.type}`}>
                    {post.type === 'study' ? '📘 Study' : '🚀 Project'}
                  </span>
                  {user && post.user_id === user.id && (
                    <button className="del-icon" onClick={() => handleDelete(post.id)}>🗑️</button>
                  )}
                </div>

                <h3>{post.title}</h3>
                <p className="grid-card-desc">{post.description}</p>

                {post.tags && (
                  <div className="tags-row">
                    {post.tags.split(',').map((tag, idx) => (
                      <span key={idx} className="tag-item">#{tag.trim()}</span>
                    ))}
                  </div>
                )}

                <div className="grid-card-footer">
                  <div className="meta-left">
                    <span className="timing">
                      📅 {post.timing ? post.timing : 'Flexible'}
                    </span>
                    <span className="member-pill">
                      👥 {count} {count === 1 ? 'member' : 'members'}
                    </span>
                  </div>

                  <button
                    className={`card-join-btn ${isJoined ? 'joined' : ''}`}
                   
                    onClick={() => handleJoin(post.id)}
                  >
                    {isJoined ? '✓ Joined' : 'Join +'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}

export default App;