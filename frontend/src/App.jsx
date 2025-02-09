import { useEffect, useState } from 'react'
import './App.css'
import ActivityList from './components/ActivityList';
import AddActivity from './components/AddActivity';

function App() {
    const [refreshFlag, setRefreshFlag] = useState(false);

    const handleActivityAdded = (newActivity) => {
        setRefreshFlag(!refreshFlag);
      };

    return (
      <div>
        <h1>Activity Tracker</h1>
        <AddActivity onActivityAdded={handleActivityAdded} />
        <ActivityList key={refreshFlag} />
      </div>
    );
  }
  
export default App
