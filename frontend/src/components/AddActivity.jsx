import React, { useState } from 'react';

function AddActivity({ onActivityAdded }) {
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [unit, setUnit] = useState('count');
  const [assetKey, setAssetKey] = useState('');
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, category_id: parseInt(categoryId), unit, asset_key: assetKey })
      });
      if (!response.ok) {
        throw new Error('Failed to create activity');
      }
      const data = await response.json();
      onActivityAdded(data);
      setName('');
      setCategoryId('');
      setAssetKey('');
      setUnit('count');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <h2>Add Activity</h2>
      {error && <div style={{color: 'red'}}>{error}</div>}
      <form onSubmit={handleSubmit}>
        <div>
          <label>Name:</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} required />
        </div>
        <div>
          <label>Category ID:</label>
          <input type="number" value={categoryId} onChange={e => setCategoryId(e.target.value)} required />
        </div>
        <div>
          <label>Unit:</label>
          <select value={unit} onChange={e => setUnit(e.target.value)}>
            <option value="count">Count</option>
            <option value="minutes">Minutes</option>
          </select>
        </div>
        <div>
          <label>Asset Key:</label>
          <input type="text" value={assetKey} onChange={e => setAssetKey(e.target.value)} />
        </div>
        <button type="submit">Add Activity</button>
      </form>
    </div>
  );
}

export default AddActivity;