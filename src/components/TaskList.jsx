import React, { useState } from 'react';
import { 
  Check, Trash2, Edit2, RefreshCw, Calendar, 
  Clock, Filter, AlertTriangle, FileText, CheckCircle2 
} from 'lucide-react';

export default function TaskList({ 
  tasks, 
  isAuthenticated, 
  onToggleComplete, 
  onEdit, 
  onDelete, 
  onSyncTask,
  onSyncAllLocal
}) {
  const [filter, setFilter] = useState('all'); // all, active, completed, local, synced

  const filteredTasks = tasks.filter(task => {
    if (filter === 'active') return !task.completed;
    if (filter === 'completed') return task.completed;
    if (filter === 'local') return !task.googleEventId;
    if (filter === 'synced') return !!task.googleEventId;
    return true;
  });

  const formatDateTime = (isoString) => {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const hasLocalOnlyTasks = tasks.some(t => !t.googleEventId);

  return (
    <div className="panel-card" style={{ height: '100%' }}>
      <div className="filter-bar">
        <h2 className="panel-card-title" style={{ borderBottom: 'none', margin: 0, padding: 0 }}>
          <Clock size={20} />
          Завдання ({filteredTasks.length})
        </h2>
        
        {isAuthenticated && hasLocalOnlyTasks && (
          <button 
            onClick={onSyncAllLocal}
            className="btn btn-secondary" 
            style={{ fontSize: '12px', padding: '6px 12px' }}
            title="Синхронізувати всі локальні завдання з Google Calendar"
          >
            <RefreshCw size={12} />
            Синхронізувати все
          </button>
        )}
      </div>

      <div className="filter-bar" style={{ borderBottom: '1px solid rgba(154, 134, 120, 0.15)', paddingBottom: '16px' }}>
        <div className="filter-tabs" style={{ width: '100%', overflowX: 'auto' }}>
          <button 
            className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            Всі
          </button>
          <button 
            className={`filter-tab ${filter === 'active' ? 'active' : ''}`}
            onClick={() => setFilter('active')}
          >
            Активні
          </button>
          <button 
            className={`filter-tab ${filter === 'completed' ? 'active' : ''}`}
            onClick={() => setFilter('completed')}
          >
            Виконані
          </button>
          {isAuthenticated && (
            <>
              <button 
                className={`filter-tab ${filter === 'local' ? 'active' : ''}`}
                onClick={() => setFilter('local')}
              >
                Локальні
              </button>
              <button 
                className={`filter-tab ${filter === 'synced' ? 'active' : ''}`}
                onClick={() => setFilter('synced')}
              >
                Google Calendar
              </button>
            </>
          )}
        </div>
      </div>

      <div className="tasks-container" style={{ marginTop: '16px' }}>
        {filteredTasks.length === 0 ? (
          <div className="empty-state">
            <FileText size={40} style={{ display: 'block', margin: '0 auto 12px' }} />
            <p style={{ margin: 0 }}>Завдань не знайдено</p>
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
              {filter === 'all' 
                ? 'Створіть нову задачу за допомогою форми ліворуч' 
                : 'Немає задач, що відповідають вибраному фільтру'}
            </span>
          </div>
        ) : (
          filteredTasks.map(task => {
            const isGoogleSynced = !!task.googleEventId;
            const isPendingSync = task.syncStatus === 'pending';

            return (
              <div 
                key={task.id} 
                className={`task-item ${task.completed ? 'completed' : ''} ${
                  isPendingSync ? 'sync-pending' : isGoogleSynced ? 'synced' : 'local-only'
                }`}
              >
                <div className="task-header">
                  <div className="task-title-group">
                    <button 
                      className={`task-checkbox ${task.completed ? 'checked' : ''}`}
                      onClick={() => onToggleComplete(task.id)}
                      title={task.completed ? 'Позначити як невиконане' : 'Позначити як виконане'}
                    >
                      {task.completed && <Check size={14} strokeWidth={3} />}
                    </button>
                    <div>
                      <h3 className="task-title">{task.title}</h3>
                      {task.description && (
                        <p className="task-description" style={{ marginTop: '4px' }}>
                          {task.description}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="task-actions">
                    {isAuthenticated && !isGoogleSynced && (
                      <button 
                        onClick={() => onSyncTask(task.id)}
                        className="btn btn-secondary btn-icon-only"
                        title="Синхронізувати з Google Calendar"
                        style={{ padding: '6px' }}
                      >
                        <RefreshCw size={14} />
                      </button>
                    )}
                    <button 
                      onClick={() => onEdit(task)}
                      className="btn btn-secondary btn-icon-only"
                      title="Редагувати задачу"
                      style={{ padding: '6px' }}
                    >
                      <Edit2 size={14} />
                    </button>
                    <button 
                      onClick={() => onDelete(task.id)}
                      className="btn btn-danger btn-icon-only"
                      title="Видалити задачу"
                      style={{ padding: '6px' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="task-meta">
                  <div className="task-time">
                    <Clock size={12} />
                    <span>
                      {formatDateTime(task.startDate)}
                    </span>
                    <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                    <span>
                      {formatDateTime(task.endDate)}
                    </span>
                  </div>

                  <div>
                    {isPendingSync ? (
                      <span className="sync-badge pending">
                        <RefreshCw size={10} className="spinner" style={{ animation: 'spin 1.5s linear infinite' }} />
                        Синхронізація
                      </span>
                    ) : isGoogleSynced ? (
                      <span className="sync-badge synced" title="Синхронізовано з вашим Google календарем">
                        <Calendar size={10} />
                        Google Calendar
                      </span>
                    ) : (
                      <span className="sync-badge local" title="Збережено лише локально у браузері">
                        Локально
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      
      {/* Add inline spin animation style to override custom animations */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
