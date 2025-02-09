export async function fetchActivities() {
    const response = await fetch('/api/activities');
    if (!response.ok) {
        throw new Error('Network response was not ok');
    }
    return response.json();
}

export async function fetchCategories() {
    const response = await fetch('/api/categories');
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