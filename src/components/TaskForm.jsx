import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Save, X, AlertCircle } from 'lucide-react';

export default function TaskForm({ activeTask, onSave, onCancel }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  
  // Default start date/time: now (rounded to nearest minute or 30m)
  // Default end date/time: now + 1 hour
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (activeTask) {
      setTitle(activeTask.title || '');
      setDescription(activeTask.description || '');
      setStartDate(activeTask.startDate ? formatDateTimeLocal(activeTask.startDate) : '');
      setEndDate(activeTask.endDate ? formatDateTimeLocal(activeTask.endDate) : '');
    } else {
      // Set default values for a new task: start now, end in 1 hour
      const now = new Date();
      const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);
      setStartDate(formatDateTimeLocal(now));
      setEndDate(formatDateTimeLocal(inOneHour));
      setTitle('');
      setDescription('');
    }
    setErrors({});
  }, [activeTask]);

  // Helper to format Date to YYYY-MM-DDTHH:MM for datetime-local input
  const formatDateTimeLocal = (dateString) => {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const validate = () => {
    const newErrors = {};
    if (!title.trim()) {
      newErrors.title = 'Назва задачі є обов’язковою';
    } else if (title.trim().length < 3) {
      newErrors.title = 'Назва повинна мати принаймні 3 символи';
    }

    if (!startDate) {
      newErrors.startDate = 'Початкова дата/час є обов’язковою';
    }

    if (!endDate) {
      newErrors.endDate = 'Кінцева дата/час є обов’язковою';
    }

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (end < start) {
        newErrors.endDate = 'Кінцева дата не може бути раніше за початкову';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    onSave({
      title: title.trim(),
      description: description.trim(),
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString(),
    });

    if (!activeTask) {
      // Clear form only on creation
      setTitle('');
      setDescription('');
      const now = new Date();
      const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);
      setStartDate(formatDateTimeLocal(now));
      setEndDate(formatDateTimeLocal(inOneHour));
    }
  };

  return (
    <div className="panel-card">
      <h2 className="panel-card-title">
        <Calendar size={20} />
        {activeTask ? 'Редагувати задачу' : 'Створити задачу'}
      </h2>
      
      <form onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label className="form-label" htmlFor="task-title">Назва задачі</label>
          <input
            id="task-title"
            type="text"
            className="form-control"
            placeholder="Наприклад: Підготуватися до співбесіди"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (errors.title) setErrors(prev => ({ ...prev, title: null }));
            }}
          />
          {errors.title && (
            <div className="form-error">
              <AlertCircle size={14} />
              {errors.title}
            </div>
          )}
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="task-desc">Опис (необов'язково)</label>
          <textarea
            id="task-desc"
            className="form-control"
            placeholder="Додайте деталі, посилання або план..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="task-start">Початок події</label>
          <input
            id="task-start"
            type="datetime-local"
            className="form-control"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              if (errors.startDate) setErrors(prev => ({ ...prev, startDate: null }));
            }}
          />
          {errors.startDate && (
            <div className="form-error">
              <AlertCircle size={14} />
              {errors.startDate}
            </div>
          )}
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="task-end">Завершення події</label>
          <input
            id="task-end"
            type="datetime-local"
            className="form-control"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              if (errors.endDate) setErrors(prev => ({ ...prev, endDate: null }));
            }}
          />
          {errors.endDate && (
            <div className="form-error">
              <AlertCircle size={14} />
              {errors.endDate}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
          <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
            {activeTask ? <Save size={16} /> : <Plus size={16} />}
            {activeTask ? 'Зберегти зміни' : 'Додати задачу'}
          </button>
          
          {activeTask && (
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              <X size={16} />
              Скасувати
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
