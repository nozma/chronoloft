import React, { useEffect, useState } from 'react';
import { fetchActivities } from '../services/api';

function ActivityList() {
  const [activities, setActivities] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchActivities()
      .then(data => setActivities(data))
      .catch(err => setError(err.message));
  }, []);

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div>
      <h2>Activities</h2>
      <ul>
        {activities.map(activity => (
          <li key={activity.id}>
            {activity.name} - Unit: {activity.unit} - Category ID: {activity.category_id}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default ActivityList;