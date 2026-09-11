import { useState, useEffect } from 'react';
import axios from 'axios';
import { supabase } from './supabaseClient';
import './App.css';

const API = 'http://localhost:5050';

function App() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState('study');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [timing, setTiming] = useState('');
  const [formError, setFormError] = useState('');
  const [joinedIds, setJoinedIds] = useState([]);

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
      setError('Failed to load posts. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (isSignUp) => {
    if (!email || !password) {
      alert("Please enter both an email and a password.");
      return;
    }
    try {
      const { error } = isSignUp 
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err) {
      alert(err.message);
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
      await axios.post(`${API}/posts`, { type, title, description, tags, timing });
      setTitle('');
      setDescription('');
      setTags('');
      setTiming('');
      setShowForm(false);
      fetchPosts();
    } catch (err) {
      setFormError('Failed to create post.');
    }
  };

  const handleJoin = async (id) => {
    const name = user.email.split('@')[0]; 
    try {
      await axios.post(`${API}/posts/${id}/join`, { user_name: name });
      setJoinedIds((prev) => [...prev, id]);
      fetchPosts();
    } catch (err) {
      alert('Failed to join.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;
    try {
      await axios.delete(`${API}/posts/${id}`);
      fetchPosts();
    } catch (err) {
      alert('Failed to delete post.');
    }
  };

  if (!user) {
    return (
      <div className="login-container">
        <div className="login-card">
          <h1>Find Your People 🎓</h1>
          <p className="subtitle" style={{marginBottom: '24px'}}>Student Login</p>
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
    <div className="page">
      <div className="container">
        <header className="hero">
          <div className="hero-top">
            <h1>Find Your People 🎓</h1>
            <div className="user-menu">
              <span className="user-badge">{user.email.split('@')[0]}</span>
              <button className="logout-btn" onClick={handleLogout}>Log Out</button>
            </div>
          </div>
          <p className="subtitle">Study sessions & project teams for students</p>
        </header>

        <div className="controls">
          <div className="filters">
            <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>✨ All</button>
            <button className={filter === 'study' ? 'active' : ''} onClick={() => setFilter('study')}>📘 Study</button>
            <button className={filter === 'project' ? 'active' : ''} onClick={() => setFilter('project')}>🚀 Project</button>
          </div>
          <button className="new-btn" onClick={() => setShowForm(!showForm)}>
            {showForm ? '✕ Cancel' : '+ New Post'}
          </button>
        </div>

        <div className={`form-wrapper ${showForm ? 'open' : ''}`}>
          <form className="post-form" onSubmit={handleSubmit}>
            <div className="type-toggle">
              <button type="button" className={type === 'study' ? 'active' : ''} onClick={() => setType('study')}>📘 Study Session</button>
              <button type="button" className={type === 'project' ? 'active' : ''} onClick={() => setType('project')}>🚀 Project</button>
            </div>
            <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <textarea placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
            <div className="form-row">
              <input placeholder="Tags / Skills" value={tags} onChange={(e) => setTags(e.target.value)} />
              <input placeholder="Timing / Deadline" value={timing} onChange={(e) => setTiming(e.target.value)} />
            </div>
            {formError && <p className="error">⚠ {formError}</p>}
            <button type="submit" className="submit-btn">Post it 🚀</button>
          </form>
        </div>

        {loading && (
          <div className="status">
            <div className="spinner"></div>
            <p>Loading posts...</p>
          </div>
        )}
        {error && <p className="status error">⚠ {error}</p>}
        {!loading && !error && posts.length === 0 && (
          <div className="status empty">
            <p className="empty-emoji">📭</p>
            <p>No posts yet. Be the first to create one!</p>
          </div>
        )}

        <div className="posts">
          {posts.map((post, i) => (
            <div key={post.id} className="post-card" style={{ animationDelay: `${i * 0.06}s` }}>
              <div className="card-top">
                <div style={{ display: 'flex', gap: '8px' }}>
                  <span className={`badge ${post.type}`}>
                    {post.type === 'study' ? '📘 Study' : '🚀 Project'}
                  </span>
                  {post.timing && <span className="timing-pill">⏰ {post.timing}</span>}
                </div>
                <button className="delete-btn" onClick={() => handleDelete(post.id)}>🗑️</button>
              </div>
              <div className="card-content">
                <h3>{post.title}</h3>
                <p className="desc">{post.description}</p>
                {post.tags && (
                  <div className="tag-list">
                    {post.tags.split(',').map((t, idx) => (
                      <span key={idx} className="tag-chip">{t.trim()}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="card-footer">
                <span className="interested">👥 {post.interested_count || 0} interested</span>
                <button
                  className={`join-btn ${joinedIds.includes(post.id) ? 'joined' : ''}`}
                  onClick={() => handleJoin(post.id)}
                >
                  {joinedIds.includes(post.id) ? '✓ Joined' : 'Join'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;