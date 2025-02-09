export async function fetchActivities() {
    const response = await fetch('/api/activities');
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    return response.json();
  }