require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Get all posts (optionally filter by type)
// Get all posts including who joined
// Get all posts
app.get('/posts', async (req, res) => {
  const { type } = req.query;

  try {
    let query = supabase
      .from('posts')
      .select('*, joins(user_name, user_id)')
      .order('created_at', { ascending: false });

    if (type) query = query.eq('type', type);

    const { data, error } = await query;

    if (error) {
      console.error('Supabase query error:', error.message);

      // Fallback: fetch posts and joins independently if relation isn't recognized yet
      let fallbackQuery = supabase.from('posts').select('*').order('created_at', { ascending: false });
      if (type) fallbackQuery = fallbackQuery.eq('type', type);
      const { data: postsData, error: postsErr } = await fallbackQuery;
      if (postsErr) throw postsErr;

      const { data: joinsData } = await supabase.from('joins').select('*');
      const formatted = postsData.map((post) => {
        const postJoins = (joinsData || []).filter((j) => j.post_id === post.id);
        return {
          ...post,
          members: postJoins,
          interested_count: postJoins.length
        };
      });
      return res.json(formatted);
    }

    const formatted = data.map((post) => ({
      ...post,
      members: post.joins || [],
      interested_count: (post.joins || []).length
    }));

    res.json(formatted);
  } catch (err) {
    console.error('Server error in /posts:', err);
    res.status(500).json({ error: err.message });
  }
});

// Join a post (atomic duplicate prevention)
// Toggle Join / Unjoin
app.post('/posts/:id/join', async (req, res) => {
  const { id } = req.params;
  const { user_name, user_id } = req.body;

  if (!user_name && !user_id) {
    return res.status(400).json({ error: 'User identification required' });
  }

  try {
    // 1. Check if user already joined (match user_id or user_name)
    let query = supabase.from('joins').select('id, user_name, user_id').eq('post_id', id);

    if (user_id) {
      query = query.or(`user_id.eq.${user_id},user_name.eq.${user_name}`);
    } else {
      query = query.eq('user_name', user_name);
    }

    const { data: matches, error: fetchErr } = await query;
    if (fetchErr) throw fetchErr;

    if (matches && matches.length > 0) {
      // 2. Already joined -> Remove (Unjoin)
      const idsToDelete = matches.map((m) => m.id);
      const { error: delErr } = await supabase
        .from('joins')
        .delete()
        .in('id', idsToDelete);

      if (delErr) throw delErr;

      return res.json({ action: 'unjoined', message: 'Successfully unjoined' });
    } else {
      // 3. Not joined -> Insert new record (Join)
      const { error: insErr } = await supabase
        .from('joins')
        .insert([{ post_id: id, user_name, user_id }]);

      if (insErr) throw insErr;

      return res.json({ action: 'joined', message: 'Successfully joined' });
    }
  } catch (err) {
    console.error('Error toggling join:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get a single post
// Join a post (prevents duplicate joins)
// Create a post (stores user_id)
app.post('/posts', async (req, res) => {
  const { type, title, description, tags, timing, user_id } = req.body;
  if (!type || !title || !description) {
    return res.status(400).json({ error: 'type, title, and description are required' });
  }
  const { data, error } = await supabase
    .from('posts')
    .insert([{ type, title, description, tags, timing, user_id, interested_count: 0 }])
    .select();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data[0]);
});

// Toggle Join / Leave a post
app.post('/posts/:id/join', async (req, res) => {
  const { id } = req.params;
  const { user_name, user_id } = req.body;

  if (!user_name) return res.status(400).json({ error: 'user_name is required' });

  try {
    // 1. Check if user already joined
    let joinCheck = supabase
      .from('joins')
      .select('id')
      .eq('post_id', id);

    if (user_id) {
      joinCheck = joinCheck.or(`user_id.eq.${user_id},user_name.eq.${user_name}`);
    } else {
      joinCheck = joinCheck.eq('user_name', user_name);
    }

    const { data: existingJoin, error: fetchErr } = await joinCheck.maybeSingle();
    if (fetchErr) throw fetchErr;

    if (existingJoin) {
      // 2. Already joined -> Remove (Unjoin)
      const { error: delErr } = await supabase
        .from('joins')
        .delete()
        .eq('id', existingJoin.id);

      if (delErr) throw delErr;

      return res.json({ action: 'unjoined', message: 'Successfully unjoined post' });
    } else {
      // 3. Not joined -> Insert (Join)
      const { error: insErr } = await supabase
        .from('joins')
        .insert([{ post_id: id, user_name, user_id }]);

      if (insErr) throw insErr;

      return res.json({ action: 'joined', message: 'Successfully joined post' });
    }
  } catch (err) {
    console.error('Error toggling join:', err);
    res.status(500).json({ error: err.message });
  }
});
// Delete a post (only allowed by author)
app.delete('/posts/:id', async (req, res) => {
  const { id } = req.params;
  const { user_id } = req.body;

  try {
    const { data: post, error: fetchErr } = await supabase
      .from('posts')
      .select('user_id')
      .eq('id', id)
      .single();

    if (fetchErr || !post) return res.status(404).json({ error: 'Post not found' });

    // Enforce ownership check
    if (post.user_id && post.user_id !== user_id) {
      return res.status(403).json({ error: 'Unauthorized: You can only delete your own posts' });
    }

    await supabase.from('joins').delete().eq('post_id', id);
    const { error: delErr } = await supabase.from('posts').delete().eq('id', id);
    if (delErr) throw delErr;

    res.json({ message: 'Post deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5050;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));