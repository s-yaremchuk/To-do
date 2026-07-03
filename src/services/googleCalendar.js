/**
 * Google Calendar API Service
 * Handles event creation, updates, and deletion on the primary calendar.
 */

const BASE_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

/**
 * Helper to construct the event resource body for Google Calendar API
 */
const constructEventBody = (task) => {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  // Mark completed tasks with a checkmark in Google Calendar
  const title = task.completed ? `✓ ${task.title}` : task.title;

  return {
    summary: title,
    description: task.description || '',
    start: {
      dateTime: new Date(task.startDate).toISOString(),
      timeZone: timeZone,
    },
    end: {
      dateTime: new Date(task.endDate).toISOString(),
      timeZone: timeZone,
    },
  };
};

/**
 * Creates a new event in the user's Google Calendar.
 * @param {Object} task 
 * @param {string} token - Google access token
 * @returns {Promise<Object>} The created Google Calendar event
 */
export async function createCalendarEvent(task, token) {
  if (!token) throw new Error('Авторизація Google відсутня');

  const eventBody = constructEventBody(task);

  const response = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(eventBody),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Не вдалося створити подію в Google Календарі');
  }

  return await response.json();
}

/**
 * Updates an existing event in the user's Google Calendar.
 * @param {Object} task 
 * @param {string} token - Google access token
 * @returns {Promise<Object>} The updated Google Calendar event
 */
export async function updateCalendarEvent(task, token) {
  if (!token) throw new Error('Авторизація Google відсутня');
  if (!task.googleEventId) throw new Error('ID події Google відсутній');

  const eventBody = constructEventBody(task);

  const response = await fetch(`${BASE_URL}/${task.googleEventId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(eventBody),
  });

  if (!response.ok) {
    const errorData = await response.json();
    
    // If the event was deleted manually in Google Calendar, we might get 410 Gone or 404 Not Found.
    // In this case, we treat it as deleted and return a signal to re-create.
    if (response.status === 404 || response.status === 410) {
      return { wasDeletedExternally: true };
    }
    
    throw new Error(errorData.error?.message || 'Не вдалося оновити подію в Google Календарі');
  }

  return await response.json();
}

/**
 * Deletes an event from the user's Google Calendar.
 * @param {string} googleEventId 
 * @param {string} token - Google access token
 * @returns {Promise<boolean>}
 */
export async function deleteCalendarEvent(googleEventId, token) {
  if (!token) throw new Error('Авторизація Google відсутня');
  if (!googleEventId) return true; // Already deleted or not synced

  const response = await fetch(`${BASE_URL}/${googleEventId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    // If it's already gone (404/410), ignore and succeed
    if (response.status === 404 || response.status === 410) {
      return true;
    }
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Не вдалося видалити подію з Google Календаря');
  }

  return true;
}
