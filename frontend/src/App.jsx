import { useEffect, useState } from 'react'
import './App.css'
import ActivityList from './components/ActivityList';
import AddActivity from './components/AddActivity';
import CategoryList from './components/CategoryList';
import AddCategory from './components/AddCategory';

function App() {
    const [refreshCategory, setRefreshCategory] = useState(false);
    const [refreshActivity, setRefreshActivity] = useState(false);

    const handleCategoryAdded = (newCategory) => {
        setRefreshCategory(!refreshCategory);
    }
    const handleActivityAdded = (newActivity) => {
        setRefreshActivity(!refreshActivity);
      };

    return (
      <div>
        <h1>Activity Tracker</h1>
        <h2>Categories</h2>
        <AddCategory onCategoryAdded={handleCategoryAdded}/>
        <CategoryList key={refreshCategory} />
        <h2>Activities</h2>
        <AddActivity onActivityAdded={handleActivityAdded} />
        <ActivityList key={refreshActivity} />
      </div>
    );
  }
  
export default App
