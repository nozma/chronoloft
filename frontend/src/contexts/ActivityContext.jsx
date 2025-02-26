import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  fetchActivities,
  addActivity,
  updateActivity,
  deleteActivity
} from '../services/api';

const ActivityContext = createContext();

/**
 * ActivityProvider
 * 
 * Provides a global state for activity list and basic CRUD methods.
 * 
 * Usage:
 *   <ActivityProvider>
 *     <App />
 *   </ActivityProvider>
 * 
 * Then in any child component:
 *   const { activities, createActivity, modifyActivity, removeActivity, refreshActivities } = useActivities();
 */
export function ActivityProvider({ children }) {
  const [activities, setActivities] = useState([]);

  // 初回読み込みでアクティビティ一覧を取得
  useEffect(() => {
    refreshActivities();
  }, []);

  // activities 一覧を再取得する
  const refreshActivities = async () => {
    try {
      const data = await fetchActivities();
      setActivities(data);
    } catch (err) {
      console.error("Failed to fetch activities:", err);
    }
  };

  /**
   * Create (POST) a new activity
   * @param {Object} activityData - { name, group_id, unit, asset_key, ... }
   */
  const createActivity = async (activityData) => {
    try {
      const res = await addActivity(activityData);
      // 作成完了後、一覧を再取得
      await refreshActivities();
      return res;
    } catch (err) {
      console.error("Failed to create activity:", err);
      throw err; // re-throw for caller
    }
  };

  /**
   * Update (PUT) an existing activity
   * @param {number} activityId 
   * @param {Object} updateData 
   */
  const modifyActivity = async (activityId, updateData) => {
    try {
      const res = await updateActivity(activityId, updateData);
      await refreshActivities();
      return res;
    } catch (err) {
      console.error("Failed to update activity:", err);
      throw err;
    }
  };

  /**
   * Delete (DELETE) an existing activity
   * @param {number} activityId 
   */
  const removeActivity = async (activityId) => {
    try {
      const res = await deleteActivity(activityId);
      await refreshActivities();
      return res;
    } catch (err) {
      console.error("Failed to delete activity:", err);
      throw err;
    }
  };

  return (
    <ActivityContext.Provider
      value={{
        activities,
        createActivity,
        modifyActivity,
        removeActivity,
        refreshActivities
      }}
    >
      {children}
    </ActivityContext.Provider>
  );
}

/**
 * useActivities()
 * 
 * @returns {Object} 
 *   - activities: Array of all Activity objects
 *   - createActivity: function(activityData)
 *   - modifyActivity: function(activityId, updateData)
 *   - removeActivity: function(activityId)
 *   - refreshActivities: function()
 */
export function useActivities() {
  return useContext(ActivityContext);
}