require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Get all posts (optionally filter by type)
app.get('/posts', async (req, res) => {
  const { type } = req.query;
  let query = supabase.from('posts').select('*').order('created_at', { ascending: false });
  if (type) query = query.eq('type', type);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Get a single post
app.get('/posts/:id', async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase.from('posts').select('*').eq('id', id).single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Create a post
app.post('/posts', async (req, res) => {
  const { type, title, description, tags, timing } = req.body;
  if (!type || !title || !description) {
    return res.status(400).json({ error: 'type, title, and description are required' });
  }
  const { data, error } = await supabase
    .from('posts')
    .insert([{ type, title, description, tags, timing, interested_count: 0 }])
    .select();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data[0]);
});

// Join a post
app.post('/posts/:id/join', async (req, res) => {
  const { id } = req.params;
  const { user_name } = req.body;
  if (!user_name) return res.status(400).json({ error: 'user_name is required' });

  const { error: joinError } = await supabase.from('joins').insert([{ post_id: id, user_name }]);
  if (joinError) return res.status(500).json({ error: joinError.message });

  const { data: post } = await supabase.from('posts').select('interested_count').eq('id', id).single();
  const { data: updated, error: updateError } = await supabase
    .from('posts')
    .update({ interested_count: (post.interested_count || 0) + 1 })
    .eq('id', id)
    .select();
  if (updateError) return res.status(500).json({ error: updateError.message });

  res.json(updated[0]);
});

// Delete a post and its associated joins
app.delete('/posts/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await supabase.from('joins').delete().eq('post_id', id);
    const { error } = await supabase.from('posts').delete().eq('id', id);
    if (error) throw error;
    res.json({ message: 'Post deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5050;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));