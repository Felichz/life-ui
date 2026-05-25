import React, { useState } from 'react';
import { Button } from '../Button';
import type { ActivityInstance, TimeboxingType } from '../../../types';

interface ActivityInstanceFormProps {
    instance: ActivityInstance;
    onSave: (data: Partial<ActivityInstance>) => void;
    onCancel: () => void;
}

export const ActivityInstanceForm: React.FC<ActivityInstanceFormProps> = ({ instance, onSave, onCancel }) => {
    // Determine the type based on which settings object exists
    const isClearObjective = !!instance.clearObjectiveSettings;
    const isFlexible = !!instance.flexibleDurationSettings;
    const isTimeboxing = !!instance.timeboxingSettings;

    // State for Clear Objective
    const [estimatedDuration, setEstimatedDuration] = useState(
        instance.clearObjectiveSettings?.estimatedDurationMinutes || 30
    );

    // State for Flexible
    const [minDurationFlex, setMinDurationFlex] = useState(
        instance.flexibleDurationSettings?.minimumDurationMinutes || 15
    );
    const [maxDurationFlex, setMaxDurationFlex] = useState(
        instance.flexibleDurationSettings?.maximumDurationMinutes || 60
    );

    // State for Timeboxing
    const [timeboxingType, setTimeboxingType] = useState<TimeboxingType>(
        instance.timeboxingSettings?.type || 'both'
    );
    const [minDurationTimebox, setMinDurationTimebox] = useState(
        instance.timeboxingSettings?.minimumDurationMinutes || 15
    );
    const [maxDurationTimebox, setMaxDurationTimebox] = useState(
        instance.timeboxingSettings?.maximumDurationMinutes || 60
    );

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const updateData: Partial<ActivityInstance> = {};

        if (isClearObjective) {
            updateData.clearObjectiveSettings = {
                estimatedDurationMinutes: estimatedDuration
            };
        } else if (isFlexible) {
            updateData.flexibleDurationSettings = {
                minimumDurationMinutes: minDurationFlex,
                maximumDurationMinutes: maxDurationFlex
            };
        } else if (isTimeboxing) {
            updateData.timeboxingSettings = {
                type: timeboxingType,
                minimumDurationMinutes: ['minimum-time', 'both'].includes(timeboxingType) ? minDurationTimebox : undefined,
                maximumDurationMinutes: ['maximum-time', 'both'].includes(timeboxingType) ? maxDurationTimebox : undefined
            };
        }

        onSave(updateData);
    };

    const renderClearObjectiveSettings = () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Estimated Duration (minutes)</label>
            <input
                type="number"
                min="1"
                value={estimatedDuration}
                onChange={(e) => setEstimatedDuration(Number(e.target.value))}
                style={{
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--glass-border)',
                    background: 'rgba(0,0,0,0.2)',
                    color: 'var(--text-primary)',
                    fontFamily: 'inherit'
                }}
            />
        </div>
    );

    const renderFlexibleSettings = () => (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Minimum Duration (min)</label>
                <input
                    type="number"
                    min="1"
                    value={minDurationFlex}
                    onChange={(e) => setMinDurationFlex(Number(e.target.value))}
                    style={{
                        padding: '0.75rem 1rem',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--glass-border)',
                        background: 'rgba(0,0,0,0.2)',
                        color: 'var(--text-primary)',
                        fontFamily: 'inherit'
                    }}
                />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Maximum Duration (min)</label>
                <input
                    type="number"
                    min={minDurationFlex}
                    value={maxDurationFlex}
                    onChange={(e) => setMaxDurationFlex(Number(e.target.value))}
                    style={{
                        padding: '0.75rem 1rem',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--glass-border)',
                        background: 'rgba(0,0,0,0.2)',
                        color: 'var(--text-primary)',
                        fontFamily: 'inherit'
                    }}
                />
            </div>
        </div>
    );

    const renderTimeboxingSettings = () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Timeboxing Rule</label>
                <select
                    value={timeboxingType}
                    onChange={(e) => setTimeboxingType(e.target.value as TimeboxingType)}
                    style={{
                        padding: '0.75rem 1rem',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--glass-border)',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        fontFamily: 'inherit',
                        cursor: 'pointer'
                    }}
                >
                    <option value="both">Minimum and Maximum Time</option>
                    <option value="minimum-time">Minimum Time Only</option>
                    <option value="maximum-time">Maximum Time Only</option>
                </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {['minimum-time', 'both'].includes(timeboxingType) && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Min Duration (min)</label>
                        <input
                            type="number"
                            min="1"
                            value={minDurationTimebox}
                            onChange={(e) => setMinDurationTimebox(Number(e.target.value))}
                            style={{
                                padding: '0.75rem 1rem',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--glass-border)',
                                background: 'rgba(0,0,0,0.2)',
                                color: 'var(--text-primary)',
                                fontFamily: 'inherit'
                            }}
                        />
                    </div>
                )}
                {['maximum-time', 'both'].includes(timeboxingType) && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Max Duration (min)</label>
                        <input
                            type="number"
                            min={timeboxingType === 'both' ? minDurationTimebox : 1}
                            value={maxDurationTimebox}
                            onChange={(e) => setMaxDurationTimebox(Number(e.target.value))}
                            style={{
                                padding: '0.75rem 1rem',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--glass-border)',
                                background: 'rgba(0,0,0,0.2)',
                                color: 'var(--text-primary)',
                                fontFamily: 'inherit'
                            }}
                        />
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--glass-border)' }}>
                <p style={{ margin: '0 0 1rem 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    Configure the specific parameters for this particular activity instance.
                </p>
                {isClearObjective && renderClearObjectiveSettings()}
                {isFlexible && renderFlexibleSettings()}
                {isTimeboxing && renderTimeboxingSettings()}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
                <Button type="submit" variant="primary">Save Configuration</Button>
            </div>
        </form>
    );
};
