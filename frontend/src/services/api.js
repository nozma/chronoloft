export async function fetchCategories() {
    const response = await fetch('/api/categories');
    if (!response.ok) {
        throw new Error('Network response was not ok');
    }
    return response.json();
}

export async function addCategory(categoryData) {
    const response = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(categoryData)
    });
    if (!response.ok) {
        throw new Error('Failed to create category');
    }
    return response.json();
}


export async function fetchActivities() {
    const response = await fetch('/api/activities');
    if (!response.ok) {
        throw new Error('Network response was not ok');
    }
    return response.json();
}

export async function addActivity(activityData) {
    const response = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(activityData)
    });
    if (!response.ok) {
        throw new Error('Failed to create activity');
    }
    return response.json();
}

export async function updateActivity(activityId, updateData) {
    const response = await fetch(`/api/activities/${activityId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
    });
    if (!response.ok) {
        throw new Error('Failed to update activity');
    }
    return response.json();
}

export async function deleteActivity(activityId) {
    const response = await fetch(`/api/activities/${activityId}`, {
        method: 'DELETE',
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete activity');
    }
    return response.json();
}


export async function fetchRecords() {
    const response = await fetch('/api/records');
    if (!response.ok) {
      throw new Error('Failed to fetch records');
    }
    return response.json();
  }
  
  export async function updateRecord(recordId, updateData) {
    const response = await fetch(`/api/records/${recordId}`, {
      method: 'PUT',  // または PATCH を使用する場合もあります
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData),
    });
    if (!response.ok) {
      throw new Error('Failed to update record');
    }
    return response.json();
  }
  
  export async function deleteRecord(recordId) {
    const response = await fetch(`/api/records/${recordId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      // エラー内容が JSON で返ってくる場合、エラーメッセージを抽出します
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to delete record');
    }
    return response.json();
  }