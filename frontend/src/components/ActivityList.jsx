import React, { useEffect, useState } from 'react';
import { fetchActivities } from '../services/api';
import { DataGrid } from '@mui/x-data-grid';

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

  const columns = [
    { field: 'id', headerName: 'ID', width: 70 },
    { field: 'name', headerName: 'Name', width: 150 },
    { field: 'unit', headerName: 'Unit', width: 100 },
    { field: 'category_name', headerName: 'Category', width: 150 },
    { field: 'asset_key', headerName: 'Asset Key', width: 150 },
    { field: 'created_at', headerName: 'Created At', width: 200 }
  ];

  return (
    <div style={{ height: 400, width: '100%' }}>
    <DataGrid
      rows={activities}
      columns={columns}
      pageSize={5}
      rowsPerPageOptions={[5]}
      disableSelectionOnClick
    />
  </div>
  );
}

export default ActivityList;