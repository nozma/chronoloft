import React, { useEffect, useState } from 'react';
import { fetchCategories } from '../services/api';

function CategoryList() {
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchCategories()
      .then(data => setCategories(data))
      .catch(err => setError(err.message));
  }, []);

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div>
      <h2>Categories</h2>
      <ul>
        {categories.map(cat => (
          <li key={cat.id}>
            {cat.name} - Group: {cat.group}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default CategoryList;