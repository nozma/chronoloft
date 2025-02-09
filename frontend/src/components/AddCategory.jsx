import React, { useState } from 'react';
import { addCategory } from '../services/api';

function AddCategory({ onCategoryAdded }) {
  const [name, setName] = useState('');
  const [group, setGroup] = useState('study');
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = await addCategory({ name, group });
      onCategoryAdded(data);
      setName('');
      setGroup('study');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <h2>Add Category</h2>
      {error && <div style={{ color: 'red' }}>{error}</div>}
      <form onSubmit={handleSubmit}>
        <div>
          <label>Name:</label>
          <input 
            type="text" 
            value={name} 
            onChange={e => setName(e.target.value)} 
            required 
          />
        </div>
        <div>
          <label>Group:</label>
          <select value={group} onChange={e => setGroup(e.target.value)}>
            <option value="study">Study</option>
            <option value="game">Game</option>
            <option value="workout">Workout</option>
          </select>
        </div>
        <button type="submit">Add Category</button>
      </form>
    </div>
  );
}

export default AddCategory;