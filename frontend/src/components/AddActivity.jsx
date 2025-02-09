import React, { useState, useEffect } from 'react';
import { addActivity } from '../services/api'
import { fetchCategories } from '../services/api';

function AddActivity({ onActivityAdded }) {
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [unit, setUnit] = useState('count');
  const [assetKey, setAssetKey] = useState('');
  const [error, setError] = useState(null);
  const [categories, setCategories] = useState([]);

  // カテゴリ一覧の取得
  useEffect(() => {
    fetchCategories()
      .then(data => setCategories(data))
      .catch(err => console.error("Failed to fetch categories:", err));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await addActivity({ 
        name, 
        category_id: parseInt(categoryId), // セレクトで得られる値は文字列なので数値に変換
        unit, 
        asset_key: assetKey 
      });
      onActivityAdded(response);
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
          <label>Category:</label>
          <select value={categoryId} onChange={e => setCategoryId(e.target.value)} required>
            <option value="">--Select Category--</option>
                {categories.map(cat => (
                <option key={cat.id} value={cat.id}>
                    {cat.name}
                </option>
                ))}
          </select>
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