import React, { useState, useEffect } from 'react';
import { Button } from '../Button';
import type { TimeBlock } from '../../../types';

export interface TimeBlockFormData {
    name: string;
    startMinute: number;
    endMinute: number;
}

interface TimeBlockFormProps {
    initialData?: TimeBlock;
    onSave: (data: TimeBlockFormData) => void;
    onCancel: () => void;
}

// Convert minutes (0-1439) to "HH:MM" for input fields
const minutesToTime = (minutes: number): string => {
    const h = Math.floor(minutes / 60).toString().padStart(2, '0');
    const m = (minutes % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
};

// Convert "HH:MM" to minutes (0-1439)
const timeToMinutes = (time: string): number => {
    const [h, m] = time.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
};

export const TimeBlockForm: React.FC<TimeBlockFormProps> = ({ initialData, onSave, onCancel }) => {
    const [name, setName] = useState(initialData?.name || '');
    const [startTime, setStartTime] = useState(initialData ? minutesToTime(initialData.startMinute) : '09:00');
    const [endTime, setEndTime] = useState(initialData ? minutesToTime(initialData.endMinute) : '10:00');
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!name.trim()) {
            setError('Name is required');
            return;
        }

        const startMin = timeToMinutes(startTime);
        const endMin = timeToMinutes(endTime);

        if (startMin >= endMin) {
            setError('End time must be after start time');
            return;
        }

        onSave({
            name: name.trim(),
            startMinute: startMin,
            endMinute: endMin
        });
    };

    const isDefault = initialData?.isDefault;

    return (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Block Name</label>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Deep Work, Morning Routine"
                    disabled={isDefault}
                    style={{
                        padding: '0.75rem 1rem',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--glass-border)',
                        background: 'rgba(0,0,0,0.2)',
                        color: 'var(--text-primary)',
                        outline: 'none',
                        fontFamily: 'inherit'
                    }}
                />
                {isDefault && <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>The default block name cannot be changed.</span>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Start Time</label>
                    <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        disabled={isDefault}
                        style={{
                            padding: '0.75rem 1rem',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--glass-border)',
                            background: 'rgba(0,0,0,0.2)',
                            color: 'var(--text-primary)',
                            outline: 'none',
                            fontFamily: 'inherit'
                        }}
                    />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>End Time</label>
                    <input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        disabled={isDefault}
                        style={{
                            padding: '0.75rem 1rem',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--glass-border)',
                            background: 'rgba(0,0,0,0.2)',
                            color: 'var(--text-primary)',
                            outline: 'none',
                            fontFamily: 'inherit'
                        }}
                    />
                </div>
            </div>

            {error && <div style={{ color: 'var(--danger)', fontSize: '0.9rem' }}>{error}</div>}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
                <Button type="submit" variant="primary">
                    {initialData ? 'Update Block' : 'Create Block'}
                </Button>
            </div>
        </form>
    );
};
