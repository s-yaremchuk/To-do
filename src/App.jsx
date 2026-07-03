import React, { useState, useEffect, useCallback } from 'react';
import { useGoogleAuth } from './context/GoogleAuthContext';
import TaskForm from './components/TaskForm';
import TaskList from './components/TaskList';
import { 
  createCalendarEvent, 
  updateCalendarEvent, 
  deleteCalendarEvent 
} from './services/googleCalendar';
import { 
  Calendar, CheckCircle, LogIn, LogOut, Settings, 
  HelpCircle, Eye, EyeOff, ShieldCheck, Info 
} from 'lucide-react';

function AppContent() {
  const {
    clientId,
    accessToken,
    user,
    isAuthenticated,
    isLoading,
    error: authError,
    updateClientId,
    login,
    logout
  } = useGoogleAuth();

  const [tasks, setTasks] = useState(() => {
    const saved = localStorage.getItem('smart_todo_tasks');
    return saved ? JSON.parse(saved) : [];
  });

  const [activeTask, setActiveTask] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [tempClientId, setTempClientId] = useState(clientId);
  const [toasts, setToasts] = useState([]);

  // Toast notification helper
  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  // Sync tempClientId state when context loaded
  useEffect(() => {
    setTempClientId(clientId);
  }, [clientId]);

  // Persist tasks to localStorage
  useEffect(() => {
    localStorage.setItem('smart_todo_tasks', JSON.stringify(tasks));
  }, [tasks]);

  // Save or Edit Task
  const handleSaveTask = async (taskData) => {
    let updatedTasks;
    let taskToSync;

    if (activeTask) {
      // Editing
      taskToSync = {
        ...activeTask,
        ...taskData,
        syncStatus: activeTask.googleEventId ? 'pending' : 'local'
      };
      
      updatedTasks = tasks.map(t => t.id === activeTask.id ? taskToSync : t);
      addToast('Задачу оновлено локально', 'success');
      setActiveTask(null);
    } else {
      // Creating
      taskToSync = {
        id: Date.now().toString(),
        ...taskData,
        completed: false,
        googleEventId: null,
        syncStatus: 'local'
      };
      
      updatedTasks = [taskToSync, ...tasks];
      addToast('Задачу додано локально', 'success');
    }

    setTasks(updatedTasks);

    // Auto-sync with Google Calendar if logged in
    if (isAuthenticated) {
      await syncSingleTask(taskToSync.id, updatedTasks);
    }
  };

  // Sync a single task with Google Calendar
  const syncSingleTask = async (taskId, currentTasks = tasks) => {
    if (!isAuthenticated || !accessToken) {
      addToast('Увійдіть через Google для синхронізації', 'warning');
      return;
    }

    const task = currentTasks.find(t => t.id === taskId);
    if (!task) return;

    // Mark task as pending sync in state
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, syncStatus: 'pending' } : t));

    try {
      if (task.googleEventId) {
        // Event exists -> Update
        const response = await updateCalendarEvent(task, accessToken);
        
        if (response.wasDeletedExternally) {
          // If deleted in Google Calendar, re-create it
          addToast('Подію було видалено з календаря. Створюємо нову...', 'warning');
          const newEvent = await createCalendarEvent(task, accessToken);
          setTasks(prev => prev.map(t => t.id === taskId ? { 
            ...t, 
            googleEventId: newEvent.id, 
            syncStatus: 'synced' 
          } : t));
          addToast('Синхронізовано з Google Calendar', 'success');
        } else {
          setTasks(prev => prev.map(t => t.id === taskId ? { 
            ...t, 
            syncStatus: 'synced' 
          } : t));
          addToast('Календар оновлено', 'success');
        }
      } else {
        // Event does not exist -> Create
        const newEvent = await createCalendarEvent(task, accessToken);
        setTasks(prev => prev.map(t => t.id === taskId ? { 
          ...t, 
          googleEventId: newEvent.id, 
          syncStatus: 'synced' 
        } : t));
        addToast('Синхронізовано з Google Calendar', 'success');
      }
    } catch (err) {
      console.error(err);
      setTasks(prev => prev.map(t => t.id === taskId ? { 
        ...t, 
        syncStatus: 'local' 
      } : t));
      addToast(`Помилка синхронізації: ${err.message}`, 'error');
    }
  };

  // Sync all local tasks to Google Calendar
  const handleSyncAllLocal = async () => {
    const localTasks = tasks.filter(t => !t.googleEventId);
    if (localTasks.length === 0) {
      addToast('Усі завдання вже синхронізовані', 'info');
      return;
    }

    addToast(`Синхронізація ${localTasks.length} завдань...`, 'info');
    
    // Copy current task list state
    let updatedList = [...tasks];
    
    for (const task of localTasks) {
      try {
        // Update to pending state
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, syncStatus: 'pending' } : t));
        
        const newEvent = await createCalendarEvent(task, accessToken);
        
        updatedList = updatedList.map(t => t.id === task.id ? {
          ...t,
          googleEventId: newEvent.id,
          syncStatus: 'synced'
        } : t);
      } catch (err) {
        console.error(`Error syncing task ${task.id}:`, err);
        updatedList = updatedList.map(t => t.id === task.id ? {
          ...t,
          syncStatus: 'local'
        } : t);
      }
    }
    
    setTasks(updatedList);
    addToast('Синхронізацію локальних завдань завершено', 'success');
  };

  // Toggle complete
  const handleToggleComplete = async (taskId) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const updatedTask = {
      ...task,
      completed: !task.completed,
      syncStatus: task.googleEventId ? 'pending' : 'local'
    };

    const updatedTasks = tasks.map(t => t.id === taskId ? updatedTask : t);
    setTasks(updatedTasks);

    // If synced, update the title in Google Calendar to show/hide checkmark
    if (updatedTask.googleEventId && isAuthenticated) {
      try {
        await updateCalendarEvent(updatedTask, accessToken);
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, syncStatus: 'synced' } : t));
        addToast(updatedTask.completed ? 'Завдання виконано' : 'Завдання відновлено', 'success');
      } catch (err) {
        console.error(err);
        addToast('Не вдалося оновити статус у Google Calendar', 'error');
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, syncStatus: 'synced' } : t)); // revert pending visual status
      }
    }
  };

  // Delete Task
  const handleDeleteTask = async (taskId) => {
    const taskToDelete = tasks.find(t => t.id === taskId);
    if (!taskToDelete) return;

    // Remove locally
    setTasks(prev => prev.filter(t => t.id !== taskId));
    addToast('Завдання видалено', 'success');

    if (activeTask && activeTask.id === taskId) {
      setActiveTask(null);
    }

    // Remove from Google Calendar if synced
    if (taskToDelete.googleEventId && isAuthenticated) {
      try {
        await deleteCalendarEvent(taskToDelete.googleEventId, accessToken);
        addToast('Подію видалено з Google Calendar', 'success');
      } catch (err) {
        console.error(err);
        addToast('Не вдалося видалити подію з Google Calendar', 'error');
      }
    }
  };

  // Save Settings (Client ID)
  const handleSaveSettings = (e) => {
    e.preventDefault();
    updateClientId(tempClientId);
    setShowSettings(false);
    addToast('Google Client ID збережено', 'success');
  };

  return (
    <div className="app-container">
      {/* Toast notifications rendering */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            <Info size={18} />
            <span>{toast.message}</span>
          </div>
        ))}
      </div>

      <header className="app-header">
        <div className="logo-section">
          <h1>
            <CheckCircle size={28} style={{ color: 'var(--color-accent)' }} />
            Smart To-Do
          </h1>
          <p>Списки завдань, що синхронізуються з вашим реальним життям</p>
        </div>

        <div className="auth-panel">
          {isAuthenticated ? (
            <>
              <div className="user-profile">
                {user?.picture ? (
                  <img src={user.picture} alt={user.name} className="user-avatar" />
                ) : (
                  <div className="user-avatar" style={{ backgroundColor: 'var(--color-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-dark)', fontWeight: 'bold' }}>
                    {user?.name?.charAt(0) || 'U'}
                  </div>
                )}
                <div className="user-info">
                  <span className="user-name">{user?.name}</span>
                  <span className="user-status">Підключено</span>
                </div>
              </div>
              <button onClick={logout} className="btn btn-danger">
                <LogOut size={16} />
                Вийти
              </button>
            </>
          ) : (
            <>
              <button 
                onClick={() => setShowSettings(!showSettings)} 
                className="btn btn-secondary"
                title="Налаштування інтеграції Google"
              >
                <Settings size={16} />
                Налаштування
              </button>
              <button 
                onClick={login} 
                className="btn btn-primary"
                disabled={!clientId || isLoading}
              >
                <LogIn size={16} />
                {isLoading ? 'Завантаження...' : 'Увійти з Google'}
              </button>
            </>
          )}
        </div>
      </header>

      {/* Show Auth errors if any */}
      {authError && (
        <div style={{ backgroundColor: 'rgba(221, 122, 122, 0.15)', border: '1px solid var(--color-error)', color: 'var(--color-error)', padding: '12px 18px', borderRadius: 'var(--radius-md)', marginBottom: '24px', fontSize: '14px' }}>
          <strong>Помилка: </strong>{authError}
        </div>
      )}

      {/* Google Integration Settings Drawer */}
      {(showSettings || !clientId) && (
        <div className="client-id-bar">
          <div className="client-id-info">
            <h3>⚙️ Налаштування інтеграції з Google Calendar</h3>
            <p>
              Оскільки цей додаток працює повністю у вашому браузері (без бекенду), вам потрібен власний Google Client ID.
              Він зберігається локально. Створіть його як <strong>Single-Page Application (SPA)</strong> у Google Cloud Console.
            </p>
            <div style={{ display: 'flex', gap: '16px', marginTop: '10px', fontSize: '11px' }}>
              <span style={{ color: 'var(--color-success)' }}>
                ✓ Authorized Javascript Origin: <code>{window.location.origin}</code>
              </span>
              <span style={{ color: 'var(--color-success)' }}>
                ✓ Redirect URI: <code>{window.location.origin + window.location.pathname}</code>
              </span>
            </div>
          </div>
          <form onSubmit={handleSaveSettings} className="client-id-form">
            <input
              type="text"
              placeholder="Вставте ваш Google Client ID тут..."
              value={tempClientId}
              onChange={(e) => setTempClientId(e.target.value)}
              required
            />
            <button type="submit" className="btn btn-primary">Зберегти</button>
            {clientId && (
              <button type="button" className="btn btn-secondary" onClick={() => setShowSettings(false)}>
                Скасувати
              </button>
            )}
          </form>
        </div>
      )}

      <main className="app-grid">
        <section>
          <TaskForm 
            activeTask={activeTask}
            onSave={handleSaveTask}
            onCancel={() => setActiveTask(null)}
          />

          <div className="panel-card" style={{ marginTop: '24px', fontSize: '13px', background: 'rgba(32, 41, 64, 0.4)' }}>
            <h3 style={{ fontSize: '14px', marginBottom: '8px', color: 'var(--color-accent)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={16} /> Безпека та конфіденційність
            </h3>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-muted)', lineHeight: '1.5' }}>
              Усі завдання, токени авторизації та налаштування зберігаються виключно у локальному сховищі (localStorage) вашого веб-браузера. 
              Запити до API Google Calendar відбуваються напряму з вашого комп'ютера без використання сторонніх серверів чи баз даних.
            </p>
          </div>
        </section>

        <section>
          <TaskList 
            tasks={tasks}
            isAuthenticated={isAuthenticated}
            onToggleComplete={handleToggleComplete}
            onEdit={setActiveTask}
            onDelete={handleDeleteTask}
            onSyncTask={syncSingleTask}
            onSyncAllLocal={handleSyncAllLocal}
          />
        </section>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AppContent />
  );
}
